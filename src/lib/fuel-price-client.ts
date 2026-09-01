export type FuelPrice = { key: string; name: string; price: number };
export type FuelPriceResponse = {
  source: string;
  date: string;
  updatedAt: string;
  cached: boolean;
  prices: FuelPrice[];
};

/**
 * Reads today's PTT prices through our own backend proxy (no CORS issues).
 * Throws a Thai, user-facing error so callers can fall back to manual entry.
 */
export async function fetchPttFuelPrices(timeoutMs = 10000): Promise<FuelPriceResponse> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch("/api/public/fuel-prices", {
      headers: { accept: "application/json" },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as FuelPriceResponse & { error?: string };
    if (!res.ok || json.error || !json.prices?.length)
      throw new Error(json.error || "ดึงราคาน้ำมันไม่สำเร็จ กรุณากรอกราคาเอง");
    return json;
  } catch (e: any) {
    throw new Error(
      e?.name === "AbortError" ? "หมดเวลาเชื่อมต่อ กรุณากรอกราคาเอง" : e?.message || "ดึงราคาน้ำมันไม่สำเร็จ กรุณากรอกราคาเอง",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
