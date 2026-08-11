/**
 * Fuel Cost Calculator — international standard formula
 *
 *   Fuel Cost = (Total Distance / Fuel Efficiency) * Fuel Price
 *
 * Distance in km, efficiency in km/litre, price in currency/litre.
 * All functions are pure and framework-agnostic so they can be reused on
 * the client (live preview) and on the server (report generation).
 */

export type FuelCostInput = {
  /** Actual driven distance in kilometres (from a routing API, not straight line). */
  distanceKm: number;
  /** Vehicle fuel efficiency in km per litre. */
  fuelEfficiency: number;
  /** Current fuel price per litre. */
  fuelPrice: number;
  /**
   * Optional flat reimbursement rate per km. When greater than 0 it overrides
   * the fuel formula (many companies reimburse a fixed ฿/km instead).
   */
  ratePerKm?: number;
  /** Optional origin/destination labels, carried through to the output. */
  origin?: string;
  destination?: string;
};

export type FuelCostResult = {
  distanceKm: number;
  litresUsed: number;
  fuelCost: number;
  /** "fuel" = (distance / efficiency) * price, "rate" = distance * ratePerKm */
  method: "fuel" | "rate";
  effectiveCostPerKm: number;
  origin?: string;
  destination?: string;
};

export class FuelCostError extends Error {
  constructor(
    message: string,
    public field: keyof FuelCostInput,
  ) {
    super(message);
    this.name = "FuelCostError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const finitePositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Core calculation. Throws FuelCostError on invalid input.
 */
export function calculateFuelCost(input: FuelCostInput): FuelCostResult {
  const { distanceKm, fuelEfficiency, fuelPrice, ratePerKm = 0, origin, destination } = input;

  if (!finitePositive(distanceKm)) {
    throw new FuelCostError("ระยะทางต้องเป็นตัวเลขมากกว่า 0", "distanceKm");
  }

  if (finitePositive(ratePerKm)) {
    const fuelCost = round2(distanceKm * ratePerKm);
    return {
      distanceKm: round2(distanceKm),
      litresUsed: finitePositive(fuelEfficiency) ? round2(distanceKm / fuelEfficiency) : 0,
      fuelCost,
      method: "rate",
      effectiveCostPerKm: round2(ratePerKm),
      ...(origin !== undefined ? { origin } : {}),
      ...(destination !== undefined ? { destination } : {}),
    };
  }

  if (!finitePositive(fuelEfficiency)) {
    throw new FuelCostError("อัตราสิ้นเปลืองน้ำมัน (กม./ลิตร) ต้องมากกว่า 0", "fuelEfficiency");
  }
  if (!finitePositive(fuelPrice)) {
    throw new FuelCostError("ราคาน้ำมันต่อลิตรต้องมากกว่า 0", "fuelPrice");
  }

  const litresUsed = distanceKm / fuelEfficiency;
  const fuelCost = litresUsed * fuelPrice;

  return {
    distanceKm: round2(distanceKm),
    litresUsed: round2(litresUsed),
    fuelCost: round2(fuelCost),
    method: "fuel",
    effectiveCostPerKm: round2(fuelCost / distanceKm),
    ...(origin !== undefined ? { origin } : {}),
    ...(destination !== undefined ? { destination } : {}),
  };
}

/** Non-throwing wrapper for UI usage. */
export function tryCalculateFuelCost(
  input: FuelCostInput,
): { ok: true; data: FuelCostResult } | { ok: false; error: string; field?: string } {
  try {
    return { ok: true, data: calculateFuelCost(input) };
  } catch (e) {
    if (e instanceof FuelCostError) return { ok: false, error: e.message, field: e.field };
    return { ok: false, error: e instanceof Error ? e.message : "คำนวณไม่สำเร็จ" };
  }
}

/**
 * JSON Schema (draft 2020-12) for the calculator payload — useful for API
 * validation, form generation, or documenting the endpoint.
 */
export const FUEL_COST_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "FuelCostCalculation",
  type: "object",
  required: ["input", "output"],
  properties: {
    input: {
      type: "object",
      required: ["distanceKm", "fuelEfficiency", "fuelPrice"],
      properties: {
        origin: { type: "string", description: "Start address or 'lat,lng'" },
        destination: { type: "string", description: "End address or 'lat,lng'" },
        distanceKm: { type: "number", exclusiveMinimum: 0, description: "Actual route distance" },
        fuelEfficiency: { type: "number", exclusiveMinimum: 0, description: "km per litre" },
        fuelPrice: { type: "number", exclusiveMinimum: 0, description: "currency per litre" },
        ratePerKm: { type: "number", minimum: 0, description: "Flat rate override (0 = off)" },
      },
    },
    output: {
      type: "object",
      required: ["distanceKm", "litresUsed", "fuelCost", "method", "effectiveCostPerKm"],
      properties: {
        distanceKm: { type: "number" },
        litresUsed: { type: "number" },
        fuelCost: { type: "number" },
        method: { type: "string", enum: ["fuel", "rate"] },
        effectiveCostPerKm: { type: "number" },
      },
    },
  },
} as const;
