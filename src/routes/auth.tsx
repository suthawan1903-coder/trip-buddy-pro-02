import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, User, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, hasAdminAccount } from "@/lib/employees.functions";
import logoUrl from "@/assets/engcorp-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ | EJH Check In" },
      { name: "description", content: "เข้าสู่ระบบ EJH Check In ด้วยรหัสพนักงานและรหัสผ่าน เพื่อบันทึกงานและดูรายงานของคุณ" },
      { property: "og:title", content: "เข้าสู่ระบบ | EJH Check In" },
      { property: "og:description", content: "เข้าสู่ระบบด้วยรหัสพนักงานเพื่อบันทึกงานและดูรายงานของคุณ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(hasAdminAccount);
  const createFirstAdmin = useServerFn(bootstrapAdmin);

  const [mode, setMode] = useState<"login" | "setup">("login");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        void navigate({ to: "/app", replace: true });
        return;
      }
      try {
        const res = await checkAdmin();
        if (!res.hasAdmin) {
          setNeedsSetup(true);
          setMode("setup");
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanCode = code.trim().toLowerCase();
    if (!cleanCode || !password) {
      setError("กรอกรหัสพนักงานและรหัสผ่านให้ครบ");
      return;
    }
    setBusy(true);
    try {
      if (mode === "setup") {
        await createFirstAdmin({
          data: { employeeCode: cleanCode, fullName: fullName.trim(), password },
        });
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: `${cleanCode}@ejh.local`,
        password,
      });
      if (signInError) throw new Error("รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง");
      void navigate({ to: "/app", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-700 via-blue-600 to-indigo-700 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-5 py-10 max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-[28px] bg-white shadow-2xl grid place-items-center overflow-hidden">
            <img src={logoUrl} alt="โลโก้ Engcorp EJH Check In" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white">EJH Check In</h1>
          <p className="mt-1 text-sm text-blue-100/90 font-medium">
            ระบบบันทึกงานนอกสถานที่ & GPS
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] p-6 space-y-4"
        >
          {mode === "setup" ? (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-amber-800">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <p className="text-xs font-medium leading-relaxed">
                ยังไม่มีผู้ดูแลระบบ — สร้างบัญชีแอดมินคนแรกเพื่อเริ่มใช้งาน
                หลังจากนั้นแอดมินจะเพิ่มรายชื่อพนักงานได้
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-slate-900">เข้าสู่ระบบ</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ใช้รหัสพนักงานที่แอดมินสร้างให้คุณ
              </p>
            </div>
          )}

          {mode === "setup" && (
            <Field label="ชื่อ-นามสกุล">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full h-14 rounded-2xl bg-slate-100 px-4 text-[15px] font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          )}

          <Field label="รหัสพนักงาน">
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="เช่น emp001"
                className="w-full h-14 rounded-2xl bg-slate-100 pl-11 pr-4 text-[15px] font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Field>

          <Field label="รหัสผ่าน">
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-14 rounded-2xl bg-slate-100 pl-11 pr-4 text-[15px] font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Field>

          {error && (
            <p className="text-sm font-medium text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-[15px] shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {mode === "setup" ? "สร้างบัญชีแอดมิน & เข้าสู่ระบบ" : "เข้าสู่ระบบ"}
            {!busy && <ArrowRight size={18} />}
          </button>

          {needsSetup && (
            <button
              type="button"
              onClick={() => setMode(mode === "setup" ? "login" : "setup")}
              className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              {mode === "setup" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "ตั้งค่าแอดมินคนแรก"}
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-[11px] text-blue-100/80">
          Engcorp. — ข้อมูลการเดินทางของคุณจะถูกเก็บเป็นส่วนตัว
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
