/** Sales item model used by the fixed-choice "สินค้าที่ขาย" section of the job form. */

/** Only these two products can be sold — no free text allowed. */
export const PRODUCT_OPTIONS = ["Handset", "SIM"] as const;
export type ProductName = (typeof PRODUCT_OPTIONS)[number];

export type SalesItem = {
  id: string;
  name: ProductName;
  qty: number;
  unitPrice: number;
};

export const newSalesItem = (name: ProductName = "Handset"): SalesItem => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name,
  qty: 1,
  unitPrice: 0,
});


/** Row total = qty * unitPrice (never NaN / negative). */
export const lineTotal = (item: Pick<SalesItem, "qty" | "unitPrice">): number => {
  const qty = Number(item.qty);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.max(0, Math.round(qty * price * 100) / 100);
};

export const salesTotal = (items: Pick<SalesItem, "qty" | "unitPrice">[]): number =>
  Math.round(items.reduce((sum, i) => sum + lineTotal(i), 0) * 100) / 100;

/** Drop empty rows before persisting. */
export const cleanSalesItems = (items: SalesItem[]) =>
  items
    .filter((i) => i.name.trim() !== "" && lineTotal(i) >= 0)
    .map((i) => ({
      name: i.name.trim(),
      qty: Number(i.qty) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      total: lineTotal(i),
    }));

export const thb = (n: number) =>
  `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
