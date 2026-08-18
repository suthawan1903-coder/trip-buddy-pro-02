/**
 * Shared formatting for the "รายงานสรุปการทำงาน" report:
 * - text message (fallback / altText)
 * - LINE Flex Message payload (header + summary + detailed list)
 * - Excel row mapping (summary block on top, then raw detail rows)
 */
import { formatMinutes } from "@/lib/geo";
import { thb } from "@/lib/sales";

export type ReportSalesItem = { name: string; qty: number; unitPrice?: number; total: number };

export type ReportTrip = {
  date: string;
  employeeName: string;
  employeePosition?: string | null;
  place: string;
  province?: string | null;
  district?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  dist: number;
  cost: number;
  durationMin?: number | null;
  jobType?: string | null;
  job?: string | null;
  status?: string | null;
  salesItems?: ReportSalesItem[] | null;
  salesTotal?: number | null;
};

export type ReportTotals = {
  stores: number;
  distance: number;
  cost: number;
  minutes: number;
  sales: number;
  litres: number;
  handsets: number;
  sims: number;
};

export const thaiDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

const qtyOf = (t: ReportTrip, name: string) =>
  (t.salesItems ?? [])
    .filter((i) => i.name.toLowerCase() === name.toLowerCase())
    .reduce((s, i) => s + (Number(i.qty) || 0), 0);

export const computeTotals = (trips: ReportTrip[], fuelEfficiency = 0): ReportTotals => {
  const distance = trips.reduce((s, t) => s + (Number(t.dist) || 0), 0);
  return {
    stores: trips.length,
    distance,
    cost: trips.reduce((s, t) => s + (Number(t.cost) || 0), 0),
    minutes: trips.reduce((s, t) => s + (Number(t.durationMin) || 0), 0),
    sales: trips.reduce(
      (s, t) => s + (Number(t.salesTotal) || (t.salesItems ?? []).reduce((a, i) => a + (Number(i.total) || 0), 0)),
      0,
    ),
    litres: fuelEfficiency > 0 ? distance / fuelEfficiency : 0,
    handsets: trips.reduce((s, t) => s + qtyOf(t, "Handset"), 0),
    sims: trips.reduce((s, t) => s + qtyOf(t, "SIM"), 0),
  };
};

const soldLabel = (t: ReportTrip) => {
  const items = (t.salesItems ?? []).filter((i) => (Number(i.qty) || 0) > 0);
  if (items.length === 0) return "";
  return items.map((i) => `${i.name} x${i.qty}`).join(", ");
};

/** Well-structured plain-text report (used as LINE altText and text fallback). */
export const buildReportText = (opts: {
  date: string;
  employeeName?: string;
  trips: ReportTrip[];
  fuelPrice?: number;
  fuelEfficiency?: number;
}) => {
  const { date, employeeName, trips, fuelPrice = 0, fuelEfficiency = 0 } = opts;
  const t = computeTotals(trips, fuelEfficiency);
  const lines = [
    "📋 รายงานสรุปการทำงาน",
    `🗓 วันที่: ${thaiDate(date)} (${date})`,
    `👤 พนักงาน: ${employeeName?.trim() || "ทุกคน"}`,
    "———————————",
    `🏪 เช็คอินทั้งหมด: ${t.stores} ร้าน`,
    `🚗 ระยะทางรวม: ${t.distance.toFixed(1)} กม.`,
    `⛽ น้ำมันโดยประมาณ: ${t.litres.toFixed(2)} ลิตร${fuelPrice ? ` (฿${fuelPrice}/ลิตร)` : ""}`,
    `💰 ค่าเดินทางรวม: ${thb(t.cost)}`,
    `⏱ เวลาปฏิบัติงานรวม: ${formatMinutes(t.minutes)}`,
    `📦 สินค้าที่ขาย: Handset ${t.handsets} · SIM ${t.sims} (${thb(t.sales)})`,
    "———————————",
    "📍 รายละเอียดการเช็คอิน:",
  ];
  trips.forEach((tr, i) => {
    const sold = soldLabel(tr);
    lines.push(
      `${i + 1}. ${tr.place} - ${Number(tr.dist).toFixed(1)} km - ${thb(Number(tr.cost))}${
        sold ? ` - ขาย: ${sold}` : ""
      }`,
    );
    const meta = [
      `${tr.timeIn || "--:--"}-${tr.timeOut || "--:--"}`,
      formatMinutes(tr.durationMin ?? null),
      tr.jobType || "",
      tr.status || "",
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`   ↳ ${meta}`);
    if (tr.job) lines.push(`   ↳ ${tr.job}`);
  });
  if (trips.length === 0) lines.push("— ไม่มีรายการในวันนี้ —");
  return lines.join("\n");
};

const row = (label: string, value: string) => ({
  type: "box",
  layout: "horizontal",
  contents: [
    { type: "text", text: label, size: "sm", color: "#8A93A0", flex: 4 },
    { type: "text", text: value, size: "sm", color: "#111827", weight: "bold", flex: 5, align: "end", wrap: true },
  ],
});

/** LINE Flex Message (bubble) — Header / Summary / Detailed list. */
export const buildReportFlex = (opts: {
  date: string;
  employeeName?: string;
  trips: ReportTrip[];
  fuelPrice?: number;
  fuelEfficiency?: number;
  maxDetail?: number;
}) => {
  const { date, employeeName, trips, fuelPrice = 0, fuelEfficiency = 0, maxDetail = 20 } = opts;
  const t = computeTotals(trips, fuelEfficiency);
  const shown = trips.slice(0, maxDetail);

  const detail = shown.map((tr, i) => {
    const sold = soldLabel(tr);
    return {
      type: "box",
      layout: "vertical",
      spacing: "none",
      margin: "md",
      contents: [
        {
          type: "text",
          text: `${i + 1}. ${tr.place}`,
          size: "sm",
          weight: "bold",
          color: "#111827",
          wrap: true,
        },
        {
          type: "text",
          text: `${Number(tr.dist).toFixed(1)} km · ${thb(Number(tr.cost))} · ${formatMinutes(
            tr.durationMin ?? null,
          )}${tr.jobType ? ` · ${tr.jobType}` : ""}`,
          size: "xs",
          color: "#6B7280",
          wrap: true,
        },
        ...(sold
          ? [{ type: "text", text: `ขาย: ${sold}`, size: "xs", color: "#059669", wrap: true }]
          : []),
      ],
    };
  });

  if (trips.length > shown.length)
    detail.push({
      type: "box",
      layout: "vertical",
      spacing: "none",
      margin: "md",
      contents: [
        {
          type: "text",
          text: `… และอีก ${trips.length - shown.length} รายการ (ดูรายละเอียดในไฟล์ Excel)`,
          size: "xs",
          color: "#6B7280",
          wrap: true,
        },
      ],
    });

  return {
    type: "bubble" as const,
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#2563EB",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "รายงานสรุปการทำงาน", color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: thaiDate(date), color: "#DBEAFE", size: "sm", margin: "xs" },
        {
          type: "text",
          text: `พนักงาน: ${employeeName?.trim() || "ทุกคน"}`,
          color: "#FFFFFF",
          size: "sm",
          margin: "sm",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "สรุปภาพรวม", weight: "bold", size: "sm", color: "#2563EB" },
        row("🏪 เช็คอิน", `${t.stores} ร้าน`),
        row("🚗 ระยะทางรวม", `${t.distance.toFixed(1)} กม.`),
        row("⛽ ค่าน้ำมัน/ค่าเดินทาง", `${thb(t.cost)}${fuelPrice ? ` (฿${fuelPrice}/ล.)` : ""}`),
        row("⏱ เวลาปฏิบัติงาน", formatMinutes(t.minutes)),
        row("📦 สินค้าที่ขาย", `Handset ${t.handsets} · SIM ${t.sims}`),
        row("💰 ยอดขายรวม", thb(t.sales)),
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: "รายละเอียดการเช็คอิน",
          weight: "bold",
          size: "sm",
          color: "#2563EB",
          margin: "lg",
        },
        ...(detail.length > 0
          ? detail
          : [{ type: "text", text: "ไม่มีรายการในวันนี้", size: "sm", color: "#6B7280" }]),
      ],
    },
  };
};

/** Rows for SheetJS: summary block on top, blank line, header, then every check-in. */
export const buildExcelAoa = (opts: {
  title: string;
  rangeLabel: string;
  employeeName?: string;
  trips: ReportTrip[];
  fuelPrice?: number;
  fuelEfficiency?: number;
}) => {
  const { title, rangeLabel, employeeName, trips, fuelPrice = 0, fuelEfficiency = 0 } = opts;
  const t = computeTotals(trips, fuelEfficiency);

  const aoa: (string | number)[][] = [
    [title],
    ["ช่วงวันที่", rangeLabel, "พนักงาน", employeeName?.trim() || "ทุกคน"],
    [
      "เช็คอิน (ร้าน)",
      t.stores,
      "ระยะทางรวม (กม.)",
      Number(t.distance.toFixed(2)),
      "ค่าเดินทางรวม (บาท)",
      Number(t.cost.toFixed(2)),
      "เวลาปฏิบัติงานรวม",
      formatMinutes(t.minutes),
    ],
    [
      "น้ำมันโดยประมาณ (ลิตร)",
      Number(t.litres.toFixed(2)),
      "ราคาน้ำมัน (บาท/ลิตร)",
      Number(fuelPrice || 0),
      "Handset (ชิ้น)",
      t.handsets,
      "SIM (ชิ้น)",
      t.sims,
    ],
    ["ยอดขายรวม (บาท)", Number(t.sales.toFixed(2))],
    [],
    [
      "วันที่",
      "เวลาเข้า",
      "เวลาออก",
      "พนักงาน",
      "ตำแหน่ง",
      "ร้านค้า",
      "จังหวัด",
      "อำเภอ",
      "ระยะทาง (กม.)",
      "ค่าน้ำมัน/ค่าเดินทาง (บาท)",
      "เวลาปฏิบัติงาน",
      "ประเภทงาน",
      "รายละเอียดงาน",
      "Handset (ชิ้น)",
      "SIM (ชิ้น)",
      "ยอดขาย (บาท)",
      "สินค้าที่ขาย",
      "สถานะ",
    ],
  ];

  for (const tr of trips) {
    aoa.push([
      tr.date,
      tr.timeIn || "",
      tr.timeOut || "",
      tr.employeeName,
      tr.employeePosition ?? "",
      tr.place,
      tr.province ?? "",
      tr.district ?? "",
      Number(Number(tr.dist || 0).toFixed(2)),
      Number(Number(tr.cost || 0).toFixed(2)),
      formatMinutes(tr.durationMin ?? null),
      tr.jobType ?? "",
      tr.job ?? "",
      qtyOf(tr, "Handset"),
      qtyOf(tr, "SIM"),
      Number(
        (
          Number(tr.salesTotal) ||
          (tr.salesItems ?? []).reduce((a, i) => a + (Number(i.total) || 0), 0)
        ).toFixed(2),
      ),
      soldLabel(tr),
      tr.status ?? "",
    ]);
  }

  return aoa;
};

export const EXCEL_COL_WIDTHS = [
  12, 9, 9, 18, 14, 26, 12, 14, 13, 20, 14, 20, 34, 13, 10, 14, 28, 12,
].map((wch) => ({ wch }));
