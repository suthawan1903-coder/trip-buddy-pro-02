import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Trash2, Check, X, Save, Filter } from "lucide-react";
import { formatMinutes } from "@/lib/geo";

type AdminTrip = {
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
  route_min: number | null;
  job: string | null;
  job_type: string | null;
  status: string;
};

const STATUSES = ["รออนุมัติ", "อนุมัติแล้ว", "ไม่อนุมัติ"];

export default function AdminTripsView({
  showToast,
}: {
  showToast: (m: string, t?: string) => void;
}) {
  const [rows, setRows] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ทั้งหมด");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ distance: string; cost: string; job: string }>({
    distance: "",
    cost: "",
    job: "",
  });

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("trips")
      .select(
        "id, trip_date, employee_name, employee_position, place, province, district, time_in, time_out, distance, cost, duration_min, route_min, job, job_type, status",
      )
      .order("trip_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) showToast(error.message, "error");
    else setRows((data ?? []) as AdminTrip[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setStatus = async (row: AdminTrip, status: string) => {
    const { error } = await supabase.from("trips").update({ status }).eq("id", row.id);
    if (error) return showToast(error.message, "error");
    showToast(`อัปเดตสถานะเป็น "${status}"`);
    void reload();
  };

  const remove = async (row: AdminTrip) => {
    if (!window.confirm(`ลบรายการ "${row.place}" ของ ${row.employee_name}?`)) return;
    const { error } = await supabase.from("trips").delete().eq("id", row.id);
    if (error) return showToast(error.message, "error");
    showToast("ลบรายการเรียบร้อย");
    void reload();
  };

  const startEdit = (row: AdminTrip) => {
    setEditing(row.id);
    setDraft({ distance: String(row.distance), cost: String(row.cost), job: row.job ?? "" });
  };

  const saveEdit = async (row: AdminTrip) => {
    const { error } = await supabase
      .from("trips")
      .update({
        distance: parseFloat(draft.distance) || 0,
        cost: parseFloat(draft.cost) || 0,
        job: draft.job || null,
      })
      .eq("id", row.id);
    if (error) return showToast(error.message, "error");
    setEditing(null);
    showToast("แก้ไขข้อมูลเรียบร้อย ✅");
    void reload();
  };

  const filtered =
    statusFilter === "ทั้งหมด" ? rows : rows.filter((r) => r.status === statusFilter);
  const totalCost = filtered.reduce((s, r) => s + Number(r.cost || 0), 0);
  const totalDist = filtered.reduce((s, r) => s + Number(r.distance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 grid place-items-center">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="font-bold">ดูแลรายการงานทั้งหมด</h2>
            <p className="text-[11px] text-slate-500">
              {filtered.length} รายการ · {totalDist.toFixed(1)} กม. · ฿{totalCost.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {["ทั้งหมด", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 h-9 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === s
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Filter size={12} className="inline mr-1" />
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((row) => (
            <div key={row.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{row.place}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {row.trip_date} · {row.employee_name}
                    {row.employee_position ? ` (${row.employee_position})` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {row.time_in || "--:--"} - {row.time_out || "--:--"} ·{" "}
                    {formatMinutes(row.duration_min)}
                    {row.district ? ` · อ.${row.district}` : ""}
                    {row.province ? ` จ.${row.province}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                    row.status === "อนุมัติแล้ว"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.status === "ไม่อนุมัติ"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {row.status}
                </span>
              </div>

              {editing === row.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={draft.distance}
                      onChange={(e) => setDraft({ ...draft, distance: e.target.value })}
                      className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
                      placeholder="ระยะทาง (กม.)"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={draft.cost}
                      onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                      className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
                      placeholder="ค่าเดินทาง (฿)"
                    />
                  </div>
                  <textarea
                    value={draft.job}
                    onChange={(e) => setDraft({ ...draft, job: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 text-sm outline-none"
                    placeholder="รายละเอียดงาน"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(row)}
                      className="flex-1 h-10 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Save size={14} /> บันทึก
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-bold"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold">
                    {Number(row.distance).toFixed(2)} กม. · ฿{Number(row.cost).toFixed(2)}
                    {row.job_type ? (
                      <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {row.job_type}
                      </span>
                    ) : null}
                  </p>
                  {row.job && <p className="text-[11px] text-slate-500">{row.job}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      onClick={() => setStatus(row, "อนุมัติแล้ว")}
                      className="h-9 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Check size={14} /> อนุมัติ
                    </button>
                    <button
                      onClick={() => setStatus(row, "ไม่อนุมัติ")}
                      className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <X size={14} /> ไม่อนุมัติ
                    </button>
                    <button
                      onClick={() => startEdit(row)}
                      className="h-9 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => remove(row)}
                      className="h-9 px-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 size={14} /> ลบ
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">ไม่มีรายการในสถานะนี้</p>
          )}
        </div>
      )}
    </div>
  );
}
