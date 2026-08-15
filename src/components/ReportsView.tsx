import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { CalendarRange, Download, Loader2, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendLineGroupSummary } from "@/lib/line.functions";
import { formatMinutes, utcDateString } from "@/lib/geo";
import { thb } from "@/lib/sales";

type ReportRow = {
  id: string;
  trip_date: string;
  employee_name: string;
  employee_position: string | null;
  place: string;
  province: string | null;
  district: string | null;
  time_in: string | null;
  time_out: string | null;
  distance: number;
  cost: number;
  duration_min: number | null;
  job: string | null;
  job_type: string | null;
  status: string;
  sales_total: number;
  sales_items: { name: string; qty: number; unitPrice: number; total: number }[] | null;
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function ReportsView({
  showToast,
  lineNotifyToken,
}: {
  showToast: (m: string, t?: string) => void;
  lineNotifyToken: string;
}) {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(utcDateString());
  const [employee, setEmployee] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const notify = useServerFn(sendLineGroupSummary);

  const load = useCallback(async () => {
    if (from > to) {
      showToast("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด", "error");
      return;
    }
    setLoading(true);
    // ตัวกรองช่วงวันที่ (SQL: WHERE trip_date BETWEEN :from AND :to)
    let query = supabase
      .from("trips")
      .select(
        "id, trip_date, employee_name, employee_position, place, province, district, time_in, time_out, distance, cost, duration_min, job, job_type, status, sales_total, sales_items",
      )
      .gte("trip_date", from)
      .lte("trip_date", to)
      .order("trip_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (employee.trim()) query = query.ilike("employee_name", `%${employee.trim()}%`);
    const { data, error } = await query;
    if (error) showToast(error.message, "error");
    else setRows((data ?? []) as unknown as ReportRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, employee]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const distance = rows.reduce((s, r) => s + Number(r.distance || 0), 0);
    const cost = rows.reduce((s, r) => s + Number(r.cost || 0), 0);
    const sales = rows.reduce((s, r) => s + Number(r.sales_total || 0), 0);
    const minutes = rows.reduce((s, r) => s + Number(r.duration_min || 0), 0);
    const staff = new Set(rows.map((r) => r.employee_name)).size;
    return { distance, cost, sales, minutes, staff, checkins: rows.length };
  }, [rows]);

  const exportExcel = () => {
    if (rows.length === 0) return showToast("ไม่มีข้อมูลให้ส่งออก", "error");

    const sheetRows = rows.map((r) => ({
      วันที่: r.trip_date,
      พนักงาน: r.employee_name,
      ตำแหน่ง: r.employee_position ?? "",
      ร้านค้า: r.place,
      จังหวัด: r.province ?? "",
      อำเภอ: r.district ?? "",
      เวลาเข้า: r.time_in ?? "",
      เวลาออก: r.time_out ?? "",
      "ระยะเวลา (นาที)": Number(r.duration_min ?? 0),
      "ระยะทาง (กม.)": Number(r.distance ?? 0),
      "ค่าเดินทาง (บาท)": Number(r.cost ?? 0),
      "ยอดขาย (บาท)": Number(r.sales_total ?? 0),
      ประเภทงาน: r.job_type ?? "",
      รายละเอียดงาน: r.job ?? "",
      สถานะ: r.status,
      สินค้าที่ขาย: (r.sales_items ?? [])
        .map((i) => `${i.name} x${i.qty} = ${i.total}`)
        .join(" | "),
    }));

    const wsMain = XLSX.utils.json_to_sheet(sheetRows);
    wsMain["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 40 },
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ["สรุปรายงานการปฏิบัติงาน — EJH Check In"],
      ["ช่วงวันที่", `${from} ถึง ${to}`],
      ["จำนวนพนักงาน", totals.staff],
      ["จำนวนเช็คอิน (ร้าน)", totals.checkins],
      ["ระยะทางรวม (กม.)", Number(totals.distance.toFixed(2))],
      ["ค่าเดินทางรวม (บาท)", Number(totals.cost.toFixed(2))],
      ["ยอดขายรวม (บาท)", Number(totals.sales.toFixed(2))],
      ["เวลาปฏิบัติงานรวม", formatMinutes(totals.minutes)],
    ]);
    wsSummary["!cols"] = [{ wch: 26 }, { wch: 28 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุป");
    XLSX.utils.book_append_sheet(wb, wsMain, "รายการงาน");
    XLSX.writeFile(wb, `EJH-report_${from}_${to}.xlsx`);
    showToast("ส่งออกไฟล์ Excel เรียบร้อย ✅");
  };

  const summaryText = () => {
    const byStaff = new Map<string, { cost: number; sales: number; count: number }>();
    for (const r of rows) {
      const cur = byStaff.get(r.employee_name) ?? { cost: 0, sales: 0, count: 0 };
      cur.cost += Number(r.cost || 0);
      cur.sales += Number(r.sales_total || 0);
      cur.count += 1;
      byStaff.set(r.employee_name, cur);
    }
    const lines = [
      "📊 สรุปรายงาน EJH Check In",
      `🗓 ช่วงวันที่: ${from} ถึง ${to}`,
      `🏪 เช็คอิน: ${totals.checkins} ร้าน (พนักงาน ${totals.staff} คน)`,
      `🚗 ระยะทางรวม: ${totals.distance.toFixed(1)} กม.`,
      `⛽ ค่าน้ำมัน/ค่าเดินทาง: ${thb(totals.cost)}`,
      `💰 ยอดขายรวม: ${thb(totals.sales)}`,
      `⏱ เวลาปฏิบัติงาน: ${formatMinutes(totals.minutes)}`,
      "———————————",
      ...[...byStaff.entries()].map(
        ([name, v]) =>
          `👤 ${name}: ${v.count} ร้าน · ขาย ${thb(v.sales)} · เดินทาง ${thb(v.cost)}`,
      ),
    ];
    return lines.join("\n");
  };

  const sendToGroup = async () => {
    if (!lineNotifyToken) return showToast("ยังไม่ได้ตั้งค่า LINE token ในหน้าตั้งค่า", "error");
    if (rows.length === 0) return showToast("ไม่มีข้อมูลให้ส่ง", "error");
    setSending(true);
    try {
      await notify({ data: { token: lineNotifyToken, message: summaryText() } });
      showToast("ส่งสรุปเข้ากลุ่ม LINE เรียบร้อย ✅");
    } catch (e: any) {
      showToast(`ส่งไม่สำเร็จ: ${e?.message || "unknown"}`, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 grid place-items-center">
            <CalendarRange size={20} />
          </span>
          <div>
            <h2 className="font-bold">รายงานย้อนหลัง</h2>
            <p className="text-[11px] text-slate-500">เลือกช่วงวันที่ · ส่งออก Excel · ส่งเข้ากลุ่ม LINE</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-slate-500">
            วันที่เริ่ม
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
            />
          </label>
          <label className="text-[11px] font-bold text-slate-500">
            วันที่สิ้นสุด
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
            />
          </label>
        </div>

        <input
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          placeholder="กรองชื่อพนักงาน (เว้นว่าง = ทุกคน)"
          className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {[
            { label: "วันนี้", f: utcDateString(), t: utcDateString() },
            { label: "7 วัน", f: daysAgo(6), t: utcDateString() },
            { label: "30 วัน", f: daysAgo(29), t: utcDateString() },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setFrom(p.f);
                setTo(p.t);
              }}
              className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-bold"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="h-11 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} ค้นหา
          </button>
          <button
            onClick={exportExcel}
            className="h-11 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => void sendToGroup()}
            disabled={sending}
            className="h-11 rounded-xl bg-[#06C755] text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} LINE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "เช็คอิน", value: `${totals.checkins} ร้าน` },
          { label: "ระยะทางรวม", value: `${totals.distance.toFixed(1)} กม.` },
          { label: "ค่าเดินทาง", value: thb(totals.cost) },
          { label: "ยอดขายรวม", value: thb(totals.sales) },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 font-bold">{c.label}</p>
            <p className="text-lg font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{r.place}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {r.trip_date} · {r.employee_name} · {formatMinutes(r.duration_min)}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 whitespace-nowrap">
                  {r.status}
                </span>
              </div>
              <p className="text-sm font-bold mt-1">
                {Number(r.distance).toFixed(2)} กม. · {thb(Number(r.cost))}
                {Number(r.sales_total) > 0 && (
                  <span className="ml-2 text-emerald-600">ขาย {thb(Number(r.sales_total))}</span>
                )}
              </p>
              {(r.sales_items ?? []).length > 0 && (
                <ul className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                  {(r.sales_items ?? []).map((i, idx) => (
                    <li key={idx}>
                      • {i.name} × {i.qty} = {thb(i.total)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">ไม่พบข้อมูลในช่วงวันที่นี้</p>
          )}
        </div>
      )}
    </div>
  );
}
