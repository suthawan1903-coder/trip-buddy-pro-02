export type FuelPrice = { key: string; name: string; price: number };
export type FuelPricePayload = {
  source: string;
  date: string;
  updatedAt: string;
  cached: boolean;
  prices: FuelPrice[];
};

const LABELS: Record<string, string> = {
  gasohol_95: "แก๊สโซฮอล์ 95",
  gasohol_91: "แก๊สโซฮอล์ 91",
  gasohol_e20: "แก๊สโซฮอล์ E20",
  gasohol_e85: "แก๊สโซฮอล์ E85",
  gasoline_95: "เบนซิน 95",
  diesel: "ดีเซล B7",
  diesel_b7: "ดีเซล B7",
  diesel_b20: "ดีเซล B20",
  premium_diesel: "ดีเซล พรีเมียม",
  premium_gasohol_95: "แก๊สโซฮอล์ 95 พรีเมียม",
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/** Official PTT OR SOAP returns a SOAP envelope containing escaped XML rows. */
export function parsePttSoap(xml: string): FuelPricePayload {
  const result = xml.match(/<CurrentOilPriceResult[^>]*>([\s\S]*?)<\/CurrentOilPriceResult>/i)?.[1];
  if (!result) throw new Error("PTT SOAP response missing CurrentOilPriceResult");
  const data = decodeXml(result);
  const prices: FuelPrice[] = [];
  let date = "";
  for (const row of data.matchAll(/<FUEL>([\s\S]*?)<\/FUEL>/gi)) {
    const field = (name: string) => row[1]?.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.trim() ?? "";
    const product = decodeXml(field("PRODUCT"));
    const rawPrice = field("PRICE").replace(/,/g, "");
    const price = Number.parseFloat(rawPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    date ||= field("PRICE_DATE").slice(0, 10);
    const productLower = product.toLowerCase();
    const key = productLower.includes("b20") ? "diesel_b20"
      : productLower.includes("ดีเซล") || productLower.includes("diesel") ? "diesel_b7"
      : productLower.includes("e85") ? "gasohol_e85"
      : productLower.includes("e20") ? "gasohol_e20"
      : productLower.includes("91") ? "gasohol_91"
      : productLower.includes("95") && productLower.includes("พรีเมียม") ? "premium_gasohol_95"
      : productLower.includes("95") ? "gasohol_95"
      : productLower.includes("เบนซิน") ? "gasoline_95"
      : "";
    if (!key) continue;
    const existing = prices.find((entry) => entry.key === key);
    const entry = { key, name: LABELS[key] ?? product, price: Math.round(price * 100) / 100 };
    if (existing) Object.assign(existing, entry);
    else prices.push(entry);
  }
  if (!prices.length) throw new Error("PTT SOAP response contains no valid fuel prices");
  return { source: "PTT OR (official)", date: date || new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString(), cached: false, prices };
}

/** Compatibility parser for the existing community JSON API if official SOAP is down. */
export function parseThaiOilApi(json: unknown): FuelPricePayload {
  const root = json as { response?: { date?: string; stations?: Record<string, Record<string, { name?: string; price?: string | number }> & { oil?: Record<string, { name?: string; price?: string | number }> }> } };
  const station = root.response?.stations?.ptt;
  const oil = station?.oil ?? station;
  const prices = Object.entries(oil ?? {}).flatMap(([key, item]) => {
    if (!item || typeof item !== "object") return [];
    const price = Number.parseFloat(String(item.price ?? ""));
    if (!Number.isFinite(price) || price <= 0) return [];
    const normalizedKey = key === "diesel" ? "diesel_b7" : key;
    return [{ key: normalizedKey, name: LABELS[normalizedKey] ?? item.name ?? normalizedKey, price: Math.round(price * 100) / 100 }];
  });
  if (!prices.length) throw new Error("Thai oil JSON response contains no valid PTT fuel prices");
  if (!prices.some((price) => price.key === "diesel_b7")) {
    const diesel = prices.find((price) => price.key === "diesel");
    if (diesel) prices.unshift({ ...diesel, key: "diesel_b7", name: LABELS.diesel_b7 });
  }
  return { source: "PTT (thai-oil-api fallback)", date: root.response?.date ?? new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString(), cached: false, prices };
}