import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  CalendarRange,
  Car,
  Clock,
  Coins,
  Download,
  Fuel,
  Loader2,
  Package,
  RefreshCw,
  Store,
  User,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notifyFlexReport } from "@/lib/line.functions";
import {
  buildExcelAoa,
  buildReportFlex,
  buildReportText,
  buildSummaryFlex,
  computeTotals,
  EXCEL_COL_WIDTHS,
  thaiDate,
  type ReportTrip,
} from "@/lib/report-format";
import { formatMinutes, utcDateString } from "@/lib/geo";
import { thb } from "@/lib/sales";
import type { AppSettings } from "@/components/TripTrackApp";

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
  accessToken,
  groupId,
  personalUserId,
  settings,
}: {
  showToast: (m: string, t?: string) => void;
  lineNotifyToken?: string;
  accessToken: string;
  groupId: string;
  personalUserId: string;
  settings: AppSettings;
}) {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(utcDateString());
  const [employee, setEmployee] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<"group" | "personal" | null>(null);
  const notify = useServerFn(notifyFlexReport);

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

  const reportTrips: ReportTrip[] = useMemo(
    () =>
      rows.map((r) => ({
        date: r.trip_date,
        employeeName: r.employee_name,
        employeePosition: r.employee_position ?? "",
        place: r.place,
        province: r.province ?? "",
        district: r.district ?? "",
        timeIn: r.time_in ?? "",
        timeOut: r.time_out ?? "",
        dist: Number(r.distance) || 0,
        cost: Number(r.cost) || 0,
        durationMin: r.duration_min ?? null,
        jobType: r.job_type ?? "",
        job: r.job ?? "",
        status: r.status,
        salesItems: r.sales_items ?? [],
        salesTotal: Number(r.sales_total) || 0,
      })),
    [rows],
  );

  const totals = useMemo(
    () => computeTotals(reportTrips, settings.fuelEfficiency),
    [reportTrips, settings.fuelEfficiency],
  );

  const exportExcel = () => {
    if (rows.length === 0) return showToast("ไม่มีข้อมูลให้ส่งออก", "error");
    const aoa = buildExcelAoa({
      title: "รายงานสรุปการทำงาน — EJH Check In",
      rangeLabel: `${from} ถึง ${to}`,
      employeeName: employee,
      trips: reportTrips,
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = EXCEL_COL_WIDTHS;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงาน");
    XLSX.writeFile(wb, `EJH-report_${from}_${to}.xlsx`);
    showToast("ส่งออกไฟล์ Excel เรียบร้อย ✅");
  };


  const reportArgs = () => ({
    date: to,
    dateLabel: `${from} ถึง ${to}`,
    employeeName: employee,
    trips: reportTrips,
  });

  /**
   * LINE Messaging API push:
   *  - group    → Flex แบบสั้น (สรุปเท่านั้น)
   *  - personal → Flex แบบละเอียด (สรุป + separator + ทุกเช็คอิน)
   */
  const sendReport = async (targetType: "group" | "personal") => {
    if (!accessToken) return showToast("ยังไม่ได้ตั้งค่า Channel access token ในหน้าตั้งค่า", "error");
    const targetId = targetType === "group" ? groupId : personalUserId;
    if (!targetId)
      return showToast(
        targetType === "group"
          ? "ยังไม่ได้ตั้งค่า Group ID ในหน้าตั้งค่า"
          : "ยังไม่ได้ตั้งค่า User ID ในหน้าตั้งค่า",
        "error",
      );
    if (rows.length === 0) return showToast("ไม่มีข้อมูลให้ส่ง", "error");

    setSending(targetType);
    try {
      const args = reportArgs();
      await notify({
        data: {
          accessToken,
          targetType,
          targetId,
          altText: `รายงานสรุปการทำงาน ${from} - ${to}`,
          flex: targetType === "group" ? buildSummaryFlex(args) : buildReportFlex(args),
          ...(targetType === "personal" ? { fallbackText: buildReportText(args) } : {}),
        },
      });
      showToast(
        targetType === "group" ? "ส่งรายงานเข้ากลุ่ม LINE แล้ว ✅" : "ส่งรายงานแบบส่วนตัวแล้ว ✅",
      );
    } catch (e: any) {
      showToast(`ส่งไม่สำเร็จ: ${e?.message || "unknown"}`, "error");
    } finally {
      setSending(null);
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

        <div className="grid grid-cols-2 gap-2">
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
            onClick={() => void sendReport("group")}
            disabled={sending !== null}
            className="h-11 rounded-xl bg-[#06C755] text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60"
          >
            {sending === "group" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Users size={14} />
            )}{" "}
            แจ้งเตือนกลุ่ม LINE
          </button>
          <button
            onClick={() => void sendReport("personal")}
            disabled={sending !== null}
            className="h-11 rounded-xl bg-[#06C755]/85 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60"
          >
            {sending === "personal" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <User size={14} />
            )}{" "}
            แจ้งเตือนส่วนตัว
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        /* ===== การ์ดสรุปการทำงานสไตล์ LINE ===== */
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 text-white px-5 py-4">
            <p className="font-extrabold text-base">รายงานสรุปการทำงาน</p>
            <p className="text-xs text-indigo-100">
              วันที่ {thaiDate(from)}{from !== to ? ` - ${thaiDate(to)}` : ""}
            </p>
            <p className="text-xs text-indigo-100">
              พนักงาน: {employee.trim() || "ทุกคน"}
            </p>
          </div>

          {/* ส่วนที่ 1: สรุปภาพรวม */}
          <div className="p-5 space-y-2.5">
            <p className="font-bold text-indigo-600 text-sm">สรุปภาพรวม</p>
            <SummaryRow icon={<Store size={16} />} label="เช็คอิน" value={`${totals.stores} ร้าน`} />
            <SummaryRow icon={<Car size={16} />} label="ระยะทางรวม" value={`${totals.distance.toFixed(1)} กม.`} />
            <SummaryRow
              icon={<Fuel size={16} />}
              label="ค่าน้ำมัน/ค่าเดินทาง"
              value={`${thb(totals.cost)}${settings.fuelPrice > 0 ? ` (฿${settings.fuelPrice}/ล.)` : ""}`}
            />
            <SummaryRow icon={<Clock size={16} />} label="เวลาปฏิบัติงาน" value={`${totals.minutes} นาที`} />
            <SummaryRow icon={<Package size={16} />} label="สินค้าที่ขาย" value={`Handset ${totals.handsets} - SIM ${totals.sims}`} />
            <SummaryRow icon={<Coins size={16} />} label="ยอดขายรวม" value={thb(totals.sales)} />
          </div>

          {/* ส่วนที่ 2: รายละเอียดการเช็คอิน */}
          <div className="border-t border-slate-100 dark:border-slate-700 p-5">
            <p className="font-bold text-indigo-600 text-sm mb-3">รายละเอียดการเช็คอิน</p>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">ไม่พบข้อมูลในช่วงวันที่นี้</p>
            ) : (
              <ol className="space-y-3">
                {rows.map((r, i) => (
                  <li key={r.id} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 text-[11px] font-extrabold grid place-items-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {r.place}
                        {r.district ? ` (${r.district})` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {Number(r.distance).toFixed(2)} กม. - {thb(Number(r.cost))} - {r.job_type || "เยี่ยมร้านค้า"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
