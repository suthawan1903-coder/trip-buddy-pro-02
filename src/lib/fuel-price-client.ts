export type FuelPrice = { key: string; name: string; price: number };
export type FuelPriceResponse = {
  source: string;
  date: string;
  updatedAt: string;
  cached: boolean;
  prices: FuelPrice[];
};

/** Reads today's PTT prices through our own backend proxy (no CORS issues). */
export async function fetchPttFuelPrices(): Promise<FuelPriceResponse> {
  const res = await fetch("/api/public/fuel-prices", { headers: { accept: "application/json" } });
  const json = (await res.json()) as FuelPriceResponse & { error?: string };
  if (!res.ok || json.error) throw new Error(json.error || "ดึงราคาน้ำมันไม่สำเร็จ");
  return json;
}
