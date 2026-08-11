import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, UserPlus, Users, KeyRound, ShieldCheck, Power } from "lucide-react";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/employees.functions";

type Row = {
  id: string;
  employee_code: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  active: boolean;
  role: string;
};

export default function EmployeesView({
  showToast,
  currentUserId,
}: {
  showToast: (msg: string, type?: string) => void;
  currentUserId: string | null;
}) {
  const fetchList = useServerFn(listEmployees);
  const addEmployee = useServerFn(createEmployee);
  const patchEmployee = useServerFn(updateEmployee);
  const removeEmployee = useServerFn(deleteEmployee);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeCode: "",
    fullName: "",
    phone: "",
    position: "",
    password: "",
    role: "employee" as "employee" | "admin",
  });


  const reload = useCallback(async () => {
    try {
      const data = await fetchList();
      setRows(data as Row[]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "โหลดรายชื่อไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async () => {
    if (!form.employeeCode.trim() || !form.fullName.trim() || form.password.length < 6) {
      showToast("กรอกรหัสพนักงาน ชื่อ และรหัสผ่าน (6 ตัวขึ้นไป)", "error");
      return;
    }
    setBusy(true);
    try {
      await addEmployee({ data: { ...form, employeeCode: form.employeeCode.trim().toLowerCase() } });
      showToast("เพิ่มพนักงานเรียบร้อย ✅");
      setForm({ employeeCode: "", fullName: "", phone: "", position: "", password: "", role: "employee" });
      setOpen(false);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: Row) => {
    try {
      await patchEmployee({ data: { id: row.id, active: !row.active } });
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ", "error");
    }
  };

  const resetPassword = async (row: Row) => {
    const pwd = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${row.full_name} (6 ตัวขึ้นไป)`);
    if (!pwd) return;
    if (pwd.length < 6) {
      showToast("รหัสผ่านสั้นเกินไป", "error");
      return;
    }
    try {
      await patchEmployee({ data: { id: row.id, password: pwd } });
      showToast("เปลี่ยนรหัสผ่านเรียบร้อย");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ", "error");
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`ลบพนักงาน ${row.full_name} และข้อมูลงานทั้งหมด?`)) return;
    try {
      await removeEmployee({ data: { id: row.id } });
      showToast("ลบเรียบร้อย");
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "ลบไม่สำเร็จ", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 grid place-items-center">
              <Users size={20} />
            </span>
            <div>
              <h2 className="font-bold">รายชื่อพนักงาน</h2>
              <p className="text-[11px] text-slate-500">ทั้งหมด {rows.length} คน</p>
            </div>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="h-11 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/25 active:scale-95 transition"
          >
            <Plus size={16} /> เพิ่ม
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="รหัสพนักงาน"
                value={form.employeeCode}
                onChange={(v) => setForm({ ...form, employeeCode: v })}
                placeholder="emp001"
              />
              <Input
                label="ชื่อ-นามสกุล"
                value={form.fullName}
                onChange={(v) => setForm({ ...form, fullName: v })}
                placeholder="สมชาย ใจดี"
              />
              <Input
                label="เบอร์โทร"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="08x-xxx-xxxx"
              />
              <Input
                label="รหัสผ่านเริ่มต้น"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder="อย่างน้อย 6 ตัว"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                สิทธิ์การใช้งาน
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["employee", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, role: r })}
                    className={`h-11 rounded-xl text-sm font-bold transition ${
                      form.role === r
                        ? "bg-blue-600 text-white shadow"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {r === "employee" ? "พนักงาน" : "แอดมิน"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={submit}
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              สร้างบัญชีพนักงาน
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 flex items-center gap-3"
            >
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center font-bold text-sm shrink-0">
                {row.full_name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate">{row.full_name}</p>
                  {row.role === "admin" && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <ShieldCheck size={10} /> แอดมิน
                    </span>
                  )}
                  {!row.active && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {row.employee_code}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <IconBtn title="ตั้งรหัสผ่านใหม่" onClick={() => resetPassword(row)}>
                  <KeyRound size={16} />
                </IconBtn>
                <IconBtn title="เปิด/ปิดใช้งาน" onClick={() => toggleActive(row)}>
                  <Power size={16} />
                </IconBtn>
                {row.id !== currentUserId && (
                  <IconBtn title="ลบ" danger onClick={() => remove(row)}>
                    <Trash2 size={16} />
                  </IconBtn>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">ยังไม่มีพนักงานในระบบ</p>
          )}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        className="w-full h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-9 h-9 rounded-xl grid place-items-center transition active:scale-95 ${
        danger
          ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
