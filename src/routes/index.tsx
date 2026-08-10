import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MapPin, ShieldCheck, BarChart3, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/engcorp-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EJH Check In — ระบบบันทึกงาน & GPS" },
      { name: "description", content: "EJH Check In: ระบบเช็คอินงานนอกสถานที่ พร้อม GPS คำนวณค่าเดินทาง และแจ้งเตือนผ่าน LINE สำหรับทีมงาน Engcorp" },
      { property: "og:title", content: "EJH Check In — ระบบบันทึกงาน & GPS" },
      { property: "og:description", content: "เช็คอินงานนอกสถานที่ พร้อม GPS คำนวณค่าเดินทาง และรายงานสรุปรายวัน" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) void navigate({ to: "/app", replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute top-40 -left-20 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />

        <div className="relative max-w-md mx-auto px-6 pt-14 pb-10">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-2xl grid place-items-center overflow-hidden">
            <img src={logoUrl} alt="โลโก้ Engcorp" className="w-11 h-11 object-contain" />
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight">
            EJH Check In
          </h1>
          <p className="mt-3 text-slate-300 text-[15px] leading-relaxed">
            เช็คอินงานนอกสถานที่ คำนวณระยะทางและค่าเดินทางอัตโนมัติ
            พร้อมรายงานสรุปรายวันของคุณเอง
          </p>

          <Link
            to="/auth"
            className="mt-8 w-full h-14 rounded-2xl bg-white text-slate-900 font-bold text-[15px] flex items-center justify-center gap-2 shadow-2xl active:scale-[0.99] transition"
          >
            เข้าสู่ระบบด้วยรหัสพนักงาน <ArrowRight size={18} />
          </Link>

          <div className="mt-10 space-y-3">
            <Feature icon={<MapPin size={18} />} title="GPS & ระยะทางจริง" desc="วัดระยะทางตามเส้นทางถนน ไม่ต้องเดา" />
            <Feature icon={<ShieldCheck size={18} />} title="ข้อมูลส่วนตัว" desc="พนักงานเห็นเฉพาะงานของตัวเอง" />
            <Feature icon={<BarChart3 size={18} />} title="รายงานรายวัน" desc="สรุปจำนวนงาน ระยะทาง และค่าใช้จ่าย" />
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/5 border border-white/10 p-4">
      <span className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-300 grid place-items-center shrink-0">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
