import { createFileRoute } from "@tanstack/react-router";

/**
 * Backend proxy for Thailand (PTT) fuel prices.
 *
 * Why a proxy: the upstream feeds do not send CORS headers, so the browser
 * cannot read them directly. This route fetches, normalises and caches the
 * data, then serves clean JSON to the frontend.
 */

export type FuelPrice = { key: string; name: string; price: number };
export type FuelPricePayload = {
  source: string;
  date: string;
  updatedAt: string;
  cached: boolean;
  prices: FuelPrice[];
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — never spam upstream
let cache: { at: number; payload: FuelPricePayload } | null = null;

const THAI_LABELS: Record<string, string> = {
  gasohol_95: "แก๊สโซฮอล์ 95",
  gasohol_91: "แก๊สโซฮอล์ 91",
  gasohol_e20: "แก๊สโซฮอล์ E20",
  gasohol_e85: "แก๊สโซฮอล์ E85",
  gasoline_95: "เบนซิน 95",
  premium_gasohol_95: "แก๊สโซฮอล์ 95 พรีเมียม",
  diesel: "ดีเซล",
  premium_diesel: "ดีเซล พรีเมียม",
  diesel_b7: "ดีเซล B7",
  diesel_b20: "ดีเซล B20",
  ngv: "NGV",
};

const label = (key: string, fallback?: string) =>
  THAI_LABELS[key] ?? fallback ?? key.replace(/_/g, " ");

type OilEntry = { name?: string; price?: string | number };

function normalizeThaiOilApi(json: unknown): FuelPricePayload | null {
  const root = json as {
    response?: {
      date?: string;
      stations?: Record<string, Record<string, OilEntry> & { oil?: Record<string, OilEntry> }>;
    };
  };
  const station = root.response?.stations?.["ptt"];
  // Upstream has shipped both `stations.ptt.<fuel>` and `stations.ptt.oil.<fuel>`.
  const oil = (station?.oil ?? station) as Record<string, OilEntry> | undefined;
  if (!oil) return null;

  const prices: FuelPrice[] = [];
  for (const [key, value] of Object.entries(oil)) {
    if (!value || typeof value !== "object") continue;
    const price = Number.parseFloat(String(value.price ?? ""));
    if (!Number.isFinite(price) || price <= 0) continue;
    prices.push({ key, name: label(key, value.name), price: Math.round(price * 100) / 100 });
  }
  if (prices.length === 0) return null;


  return {
    source: "PTT (ptt.com)",
    date: root.response?.date ?? new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    cached: false,
    prices,
  };
}

async function fetchUpstream(): Promise<FuelPricePayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.chnwt.dev/thai-oil-api/latest", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const normalized = normalizeThaiOilApi(await res.json());
    if (!normalized) throw new Error("unexpected upstream shape");
    return normalized;
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/public/fuel-prices")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        if (cache && now - cache.at < CACHE_TTL_MS) {
          return Response.json(
            { ...cache.payload, cached: true },
            { headers: { "cache-control": "public, max-age=600" } },
          );
        }

        try {
          const payload = await fetchUpstream();
          cache = { at: now, payload };
          return Response.json(payload, {
            headers: { "cache-control": "public, max-age=600" },
          });
        } catch (error) {
          console.error("[fuel-prices] upstream failed", error);
          if (cache) {
            // Serve stale data rather than nothing.
            return Response.json({ ...cache.payload, cached: true });
          }
          return Response.json(
            { error: "ดึงราคาน้ำมันไม่สำเร็จ กรุณากรอกราคาเอง" },
            { status: 502 },
          );
        }
      },
    },
  },
});
