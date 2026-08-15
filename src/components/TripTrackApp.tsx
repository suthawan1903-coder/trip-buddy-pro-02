import React, { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import EmployeesView from "@/components/EmployeesView";
import AdminTripsView from "@/components/AdminTripsView";
import ReportsView from "@/components/ReportsView";

import {
  LogOut,
  Users as UsersIcon,
  ShieldCheck,
  MapPin,
  Camera,
  FileText,
  BarChart3,
  Moon,
  Sun,
  Locate,
  Car,
  Truck,
  Bike,
  Save,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
  Send,
  Settings as SettingsIcon,
  KeyRound,
  ExternalLink,
  Fuel,
  Edit3,
  Satellite,
  Store,
  Loader2,
  Globe2,
  CalendarRange,
  Plus,
  Trash2,
  ShoppingCart,

} from "lucide-react";
import { sendLineMessage } from "@/lib/line.functions";
import { getAppSettings, updateAppSettings } from "@/lib/settings.functions";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/engcorp-logo.png";
import InstallPrompt from "@/components/InstallPrompt";
import { calculateFuelCost, tryCalculateFuelCost } from "@/lib/fuel-cost";
import { compressImageFiles } from "@/lib/image-capture";
import { fetchPttFuelPrices, type FuelPrice } from "@/lib/fuel-price-client";
import {
  fetchRoute,
  geocodeDistrict,
  geocodeProvince,
  getPosition,
  haversineKm,
  minutesBetween,
  formatMinutes,
  utcDateString,
  watchPosition,
  type LatLng,
} from "@/lib/geo";

declare global {
  interface Window {
    L: any;
  }
}

const vehicleRates: Record<string, { name: string; rate: number; kmPerLitre: number }> = {
  car: { name: "รถยนต์", rate: 4.5, kmPerLitre: 12 },
  pickup: { name: "รถกระบะ", rate: 5.0, kmPerLitre: 10 },
  motorcycle: { name: "มอเตอร์ไซค์", rate: 2.0, kmPerLitre: 35 },
};

const JOB_PRESETS = [
  "ติดตั้ง",
  "ซ่อม/แก้ไข",
  "ตรวจเช็คระบบ",
  "ส่งของ",
  "เข้าพบลูกค้า",
  "เก็บเงิน",
  "สำรวจหน้างาน",
  "อบรม/ประชุม",
];

type Customer = { id: string; name: string; province: string; district: string };

const mockCustomers: Customer[] = [
  { id: "EHS-AR-5801-0534", name: "ร้านกันเองเทเลคอม", province: "อุดรธานี", district: "หนองหาน" },
];

type Trip = {
  id: string;
  date: string;
  employeeName: string;
  place: string;
  timeIn: string;
  timeOut: string;
  dist: string | number;
  cost: string | number;
  status: string;
  durationMin?: number | null;
  jobType?: string | null;
  job?: string | null;
};

export type AppSettings = {
  lineToken: string;
  lineSecret: string;
  lineNotifyToken: string;
  fuelPrice: number;
  fuelEfficiency: number;
  ratePerKm: number;
  checkinRadiusKm: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  lineToken: "",
  lineSecret: "",
  lineNotifyToken: "",
  fuelPrice: 38,
  fuelEfficiency: 12,
  ratePerKm: 0,
  checkinRadiusKm: 5,
};


export default function TripTrackApp() {
  const { profile, isAdmin, userId } = useSession();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "form" | "dashboard" | "settings" | "employees" | "admin" | "reports"
  >("form");

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const loadSettings = useServerFn(getAppSettings);
  const saveSettingsFn = useServerFn(updateAppSettings);
  const employeeName = profile?.full_name ?? "";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.body.appendChild(script);
    }

    (async () => {
      try {
        const s = await loadSettings();
        setSettings({ ...DEFAULT_SETTINGS, ...s });
      } catch {
        try {
          const raw = localStorage.getItem("appSettings");
          if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        } catch {
          /* ignore */
        }
      }
    })();

    (async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (!error && data) {
        setTrips(
          data.map((r: any) => ({
            id: r.id,
            date: r.trip_date,
            employeeName: r.employee_name,
            place: r.place,
            timeIn: r.time_in || "",
            timeOut: r.time_out || "",
            dist: r.distance,
            cost: r.cost,
            status: r.status,
            durationMin: r.duration_min,
            jobType: r.job_type,
            job: r.job,
          })),
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const showToast = (msg: string, type: string = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddTrip = (newTrip: Trip) => setTrips((prev) => [newTrip, ...prev]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const saveSettings = async (s: AppSettings) => {
    setSettings(s);
    localStorage.setItem("appSettings", JSON.stringify(s));
    try {
      await saveSettingsFn({
        data: {
          fuelPrice: s.fuelPrice,
          fuelEfficiency: s.fuelEfficiency,
          ratePerKm: s.ratePerKm,
          checkinRadiusKm: s.checkinRadiusKm,
          lineToken: s.lineToken,
          lineSecret: s.lineSecret,
        },
      });
      showToast("บันทึกการตั้งค่าส่วนกลางเรียบร้อย ✅");
    } catch (e: any) {
      showToast(e?.message || "บันทึกการตั้งค่าไม่สำเร็จ", "error");
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "dark bg-slate-950 text-slate-100"
          : "bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 text-slate-900"
      } pb-24`}
    >
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm grid place-items-center overflow-hidden">
              <img src={logoUrl} alt="EJH Logo" className="w-9 h-9 object-contain" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                EJH Check In
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {profile?.position ? profile.position : "ระบบบันทึกงาน & GPS"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <span className="hidden sm:block text-[11px] font-semibold text-slate-600 dark:text-slate-300 max-w-[110px] truncate">
                {profile.full_name}
              </span>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              aria-label="toggle dark mode"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 transition"
              aria-label="ออกจากระบบ"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto pt-3">
        <InstallPrompt />
      </div>

      <main className="max-w-2xl mx-auto p-4">
        {activeTab === "form" && (
          <FormView
            showToast={showToast}
            onAddTrip={handleAddTrip}
            employeeName={employeeName}
            employeePosition={profile?.position ?? ""}
            settings={settings}
          />
        )}
        {activeTab === "dashboard" && (
          <DashboardView
            trips={trips}
            employeeName={employeeName}
            showToast={showToast}
            settings={settings}
          />
        )}
        {activeTab === "settings" && (
          <SettingsView
            settings={settings}
            onSave={saveSettings}
            showToast={showToast}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "admin" && isAdmin && <AdminTripsView showToast={showToast} />}
        {activeTab === "reports" && isAdmin && (
          <ReportsView showToast={showToast} lineNotifyToken={settings.lineNotifyToken || settings.lineToken} />
        )}
        {activeTab === "employees" && isAdmin && (
          <EmployeesView showToast={showToast} currentUserId={userId} />
        )}

      </main>

      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl text-white flex items-center gap-2 backdrop-blur ${
            toast.type === "success" ? "bg-emerald-600/95" : "bg-red-600/95"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      <nav className="fixed bottom-3 left-3 right-3 max-w-2xl mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl flex z-30 shadow-2xl">
        <NavButton icon={<FileText />} label="บันทึกงาน" isActive={activeTab === "form"} onClick={() => setActiveTab("form")} />
        <NavButton icon={<BarChart3 />} label="รายงาน" isActive={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
        {isAdmin && (
          <NavButton icon={<ShieldCheck />} label="จัดการงาน" isActive={activeTab === "admin"} onClick={() => setActiveTab("admin")} />
        )}
        {isAdmin && (
          <NavButton icon={<CalendarRange />} label="ย้อนหลัง" isActive={activeTab === "reports"} onClick={() => setActiveTab("reports")} />
        )}
        {isAdmin && (
          <NavButton icon={<UsersIcon />} label="พนักงาน" isActive={activeTab === "employees"} onClick={() => setActiveTab("employees")} />

        )}
        <NavButton icon={<SettingsIcon />} label="ตั้งค่า" isActive={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
      </nav>
    </div>
  );
}

function NavButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactElement;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-semibold transition rounded-2xl mx-1 my-1 ${
        isActive
          ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      <span>{label}</span>
    </button>
  );
}

/* ================================================================== */
/* FORM                                                               */
/* ================================================================== */

function FormView({
  showToast,
  onAddTrip,
  employeeName,
  employeePosition,
  settings,
}: {
  showToast: (m: string, t?: string) => void;
  onAddTrip: (t: Trip) => void;
  employeeName: string;
  employeePosition: string;
  settings: AppSettings;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "error">("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [routeMin, setRouteMin] = useState<number | null>(null);
  const [manualDistance, setManualDistance] = useState<string>("");
  const [manualCost, setManualCost] = useState<string>("");
  const [trackingMode, setTrackingMode] = useState<"gps" | "manual">("gps");
  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);
  const [vehicle, setVehicle] = useState<"car" | "pickup" | "motorcycle">("car");
  const [saving, setSaving] = useState(false);
  const [nearby, setNearby] = useState<{ c: Customer; km: number }[]>([]);
  const [scanningNearby, setScanningNearby] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const routeLayerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const radiusLayerRef = useRef<any>(null);

  const [formData, setFormData] = useState({
    date: utcDateString(),
    prov: "",
    dist: "",
    place: "",
    timeIn: "",
    timeOut: "",
    jobTypes: [] as string[],
    salesItems: [] as SalesItem[],

    job: "",
    images: [] as string[],
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  const efficiency = settings.fuelEfficiency > 0 ? settings.fuelEfficiency : vehicleRates[vehicle].kmPerLitre;

  /* --- automatic date from universal time (UTC), refreshed every minute --- */
  useEffect(() => {
    const tick = () =>
      setFormData((prev) =>
        prev.date === utcDateString() ? prev : { ...prev, date: utcDateString() },
      );
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  /* ------------------------- customers from sheet ------------------------ */
  useEffect(() => {
    const fetchCustomersFromSheet = async () => {
      setIsLoadingCustomers(true);
      try {
        const sheetId = "1IrczuPsYCNKjAsPCuPnW9FgoRIr1Q0WPXlDRwLrNrUw";
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const csvText = await response.text();
        const rows = csvText.split("\n");
        const newCustomers: Customer[] = [];
        let nameCol = 2,
          distCol = 12,
          provCol = 14,
          startRow = 1;

        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const headerCols = rows[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
          const nIdx = headerCols.findIndex((c) => c === "ชื่อลูกค้า");
          if (nIdx !== -1) {
            nameCol = nIdx;
            const dIdx = headerCols.findIndex((c) => c === "อำเภอ");
            if (dIdx !== -1) distCol = dIdx;
            const pIdx = headerCols.findIndex((c) => c === "จังหวัด");
            if (pIdx !== -1) provCol = pIdx;
            startRow = i + 1;
            break;
          }
        }

        for (let i = startRow; i < rows.length; i++) {
          if (!rows[i].trim()) continue;
          const cols = rows[i]
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((col) => (col ? col.replace(/^"|"$/g, "").trim() : ""));
          const id = cols[1] || "";
          const name = cols[nameCol] || "";
          if (name && name !== "ชื่อลูกค้า") {
            const district = (cols[distCol] || "").trim().replace(/^(อำเภอ|อ\.|เขต)\s*/g, "").trim();
            const province = (cols[provCol] || "").trim().replace(/^(จังหวัด|จ\.)\s*/g, "").trim();
            newCustomers.push({ id, name, district, province });
          }
        }
        if (newCustomers.length > 0) setCustomers(newCustomers);
      } catch {
        /* keep fallback */
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    void fetchCustomersFromSheet();
  }, []);

  /* ------------------------------ map init ------------------------------ */
  useEffect(() => {
    if (trackingMode !== "gps") return;
    if (!mapRef.current || mapInstance) return;
    let cancelled = false;
    const initMap = async () => {
      let attempts = 0;
      while (!window.L && attempts < 30) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }
      if (cancelled || !window.L || !mapRef.current) return;
      const map = window.L.map(mapRef.current).setView([13.7563, 100.5018], 12);
      window.L
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
        })
        .addTo(map);
      setMapInstance(map);
    };
    void initMap();
    return () => {
      cancelled = true;
    };
  }, [mapInstance, trackingMode]);

  /* --------------------- auto GPS (Android/iOS friendly) ------------------ */
  useEffect(() => {
    let stopped = false;
    setGpsStatus("locating");
    getPosition()
      .then((pos) => {
        if (stopped) return;
        setStartPoint([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
        setGpsStatus("ready");
      })
      .catch(() => {
        if (!stopped) setGpsStatus("error");
      });
    const stopWatch = watchPosition(
      (p, acc) => {
        setStartPoint(p);
        setAccuracy(acc);
        setGpsStatus("ready");
      },
      () => setGpsStatus((s) => (s === "ready" ? s : "error")),
    );
    return () => {
      stopped = true;
      stopWatch();
    };
  }, []);

  /* --------------- draw my marker + radius circle on the map -------------- */
  useEffect(() => {
    if (!mapInstance || !window.L || !startPoint) return;
    if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
    startMarkerRef.current = window.L
      .marker(startPoint)
      .addTo(mapInstance)
      .bindPopup("ตำแหน่งของคุณ");
    if (radiusLayerRef.current) mapInstance.removeLayer(radiusLayerRef.current);
    radiusLayerRef.current = window.L
      .circle(startPoint, {
        radius: settings.checkinRadiusKm * 1000,
        color: "#2563eb",
        weight: 1,
        fillOpacity: 0.06,
      })
      .addTo(mapInstance);
    if (!destPoint) mapInstance.setView(startPoint, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, startPoint, settings.checkinRadiusKm]);

  /* ----------- auto list of stores within the check-in radius ------------- */
  useEffect(() => {
    if (!startPoint || customers.length === 0) return;
    let cancelled = false;
    const scan = async () => {
      setScanningNearby(true);
      const provinces = Array.from(new Set(customers.map((c) => c.province).filter(Boolean)));
      const nearProvinces: string[] = [];
      for (const p of provinces) {
        if (cancelled) return;
        const point = await geocodeProvince(p);
        if (point && haversineKm(startPoint, point) < 200) nearProvinces.push(p);
      }
      const districtKeys = Array.from(
        new Set(
          customers
            .filter((c) => nearProvinces.includes(c.province))
            .map((c) => `${c.province}|${c.district}`),
        ),
      ).slice(0, 60);

      const found: { c: Customer; km: number }[] = [];
      for (const key of districtKeys) {
        if (cancelled) return;
        const [prov, dist] = key.split("|");
        const point = await geocodeDistrict(dist, prov);
        if (!point) continue;
        const km = haversineKm(startPoint, point);
        if (km <= settings.checkinRadiusKm) {
          customers
            .filter((c) => c.province === prov && c.district === dist)
            .forEach((c) => found.push({ c, km: Math.round(km * 100) / 100 }));
          if (!cancelled) setNearby([...found].sort((a, b) => a.km - b.km));
        }
      }
      if (!cancelled) {
        setNearby(found.sort((a, b) => a.km - b.km));
        setScanningNearby(false);
      }
    };
    void scan();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint === null, customers.length, settings.checkinRadiusKm]);

  /* ------------------------------- routing -------------------------------- */
  const drawRoute = async (dest: LatLng, from: LatLng | null = startPoint) => {
    if (!from) return;
    const route = await fetchRoute(from, dest);
    if (!route) {
      const straight = haversineKm(from, dest);
      setDistance(Math.round(straight * 1.3 * 100) / 100);
      setRouteMin(Math.round((straight * 1.3) / 50 * 60));
      showToast("ใช้ระยะทางประมาณการ (เส้นทางจริงเรียกไม่ได้)", "error");
      return;
    }
    setDistance(route.distanceKm);
    setRouteMin(route.durationMin);
    if (mapInstance && window.L) {
      if (routeLayerRef.current) mapInstance.removeLayer(routeLayerRef.current);
      routeLayerRef.current = window.L
        .polyline(route.coordinates, { color: "#3b82f6", weight: 5, opacity: 0.85 })
        .addTo(mapInstance);
      try {
        mapInstance.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      } catch {
        /* ignore */
      }
    }
  };

  const selectCustomer = async (c: Customer) => {
    setFormData((prev) => {
      const next = { ...prev, place: c.name, prov: c.province, dist: c.district };
      saveDraftToLocal(next);
      return next;
    });
    setShowSuggestions(false);
    if (trackingMode !== "gps") return;
    const point = await geocodeDistrict(c.district, c.province);
    if (!point) {
      showToast(`ไม่พบพิกัด อ.${c.district}`, "error");
      return;
    }
    setDestPoint(point);
    if (mapInstance && window.L) {
      if (destMarkerRef.current) mapInstance.removeLayer(destMarkerRef.current);
      destMarkerRef.current = window.L
        .marker(point, {
          icon: new window.L.Icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        })
        .addTo(mapInstance)
        .bindPopup(`📍 ${c.name}`)
        .openPopup();
    }
    await drawRoute(point);
  };

  const refreshGps = async () => {
    setGpsStatus("locating");
    try {
      const pos = await getPosition();
      const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
      setStartPoint(p);
      setAccuracy(pos.coords.accuracy);
      setGpsStatus("ready");
      showToast("อัปเดตตำแหน่ง GPS แล้ว 📍");
      if (destPoint) await drawRoute(destPoint, p);
    } catch (e: any) {
      setGpsStatus("error");
      showToast(e?.message || "เปิด GPS ไม่สำเร็จ กรุณาอนุญาตการเข้าถึงตำแหน่ง", "error");
    }
  };

  /* ------------------------------ cost calc ------------------------------- */
  const finalDistance =
    trackingMode === "manual" ? parseFloat(manualDistance || "0") || 0 : distance;

  const costResult = useMemo(
    () =>
      tryCalculateFuelCost({
        distanceKm: finalDistance,
        fuelEfficiency: efficiency,
        fuelPrice: settings.fuelPrice,
        ratePerKm: settings.ratePerKm,
      }),
    [finalDistance, efficiency, settings.fuelPrice, settings.ratePerKm],
  );

  const autoCost = costResult.ok ? costResult.data.fuelCost : 0;
  const litres = costResult.ok ? costResult.data.litresUsed : 0;
  const finalCost =
    trackingMode === "manual" && manualCost ? parseFloat(manualCost) || 0 : autoCost;

  const workMinutes = minutesBetween(formData.timeIn, formData.timeOut);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displaySuggestions = customers.filter((c) => {
    const matchProv = !formData.prov || c.province === formData.prov;
    const matchSearch = c.name.toLowerCase().includes(formData.place.toLowerCase());
    return matchProv && matchSearch;
  });

  const saveDraftToLocal = (data: typeof formData) => {
    localStorage.setItem("tripDraft", JSON.stringify({ ...data, images: [] }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    if (name === "prov") newData.dist = "";
    setFormData(newData);
    saveDraftToLocal(newData);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files || files.length === 0) return;
    setProcessingPhoto(true);
    try {
      const captured = await compressImageFiles(files);
      if (captured.length === 0) showToast("ไม่พบไฟล์รูปที่ใช้ได้", "error");
      else
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...captured.map((c) => c.dataUrl)],
        }));
    } catch {
      showToast("เพิ่มรูปไม่สำเร็จ", "error");
    } finally {
      setProcessingPhoto(false);
      // reset so selecting the same photo again still fires onChange (old iOS)
      input.value = "";
    }
  };

  const handleRemoveImage = (idx: number) =>
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  /* ===== dynamic sales items ===== */
  const totalSales = useMemo(() => salesTotal(formData.salesItems), [formData.salesItems]);

  const setSalesItems = (items: SalesItem[]) => {
    const next = { ...formData, salesItems: items };
    setFormData(next);
    saveDraftToLocal(next);
  };
  const addSalesItem = () => setSalesItems([...formData.salesItems, newSalesItem()]);
  const removeSalesItem = (id: string) =>
    setSalesItems(formData.salesItems.filter((i) => i.id !== id));
  const updateSalesItem = (id: string, patch: Partial<SalesItem>) =>
    setSalesItems(formData.salesItems.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggleJobType = (job: string) => {

    const next = {
      ...formData,
      jobTypes: formData.jobTypes.includes(job)
        ? formData.jobTypes.filter((j) => j !== job)
        : [...formData.jobTypes, job],
    };
    setFormData(next);
    saveDraftToLocal(next);
  };

  const handleTimeStamp = (field: "timeIn" | "timeOut") => {
    const timeString = new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const newData = { ...formData, [field]: timeString };
    setFormData(newData);
    saveDraftToLocal(newData);
    showToast(`บันทึกเวลา${field === "timeIn" ? "เข้า" : "ออก"}: ${timeString}`);
  };

  const handleSave = async () => {
    if (!formData.place) return showToast("เลือกร้านค้าก่อนนะ!", "error");
    if (finalDistance <= 0) return showToast("กรุณาระบุระยะทาง (>0 กม.)", "error");

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("trips")
        .insert({
          trip_date: formData.date,
          user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
          employee_name: employeeName,
          employee_position: employeePosition || null,
          place: formData.place,
          province: formData.prov || null,
          district: formData.dist || null,
          time_in: formData.timeIn || null,
          time_out: formData.timeOut || null,
          distance: finalDistance,
          cost: finalCost,
          vehicle,
          mode: trackingMode,
          job: formData.job || null,
          job_type: formData.jobTypes.join(", ") || null,
          images: formData.images,
          sales_items: cleanSalesItems(formData.salesItems),
          sales_total: totalSales,

          status: "รออนุมัติ",
          lat: destPoint?.[0] ?? startPoint?.[0] ?? null,
          lng: destPoint?.[1] ?? startPoint?.[1] ?? null,
          duration_min: workMinutes,
          route_min: routeMin,
          fuel_price: settings.fuelPrice,
          fuel_efficiency: efficiency,
          rate_per_km: settings.ratePerKm,
        })
        .select()
        .single();

      if (error) throw error;

      onAddTrip({
        id: data.id,
        date: data.trip_date,
        employeeName: data.employee_name,
        place: data.place,
        timeIn: data.time_in || "",
        timeOut: data.time_out || "",
        dist: data.distance,
        cost: data.cost,
        status: data.status,
        durationMin: data.duration_min,
        jobType: data.job_type,
        job: data.job,
      });
      showToast("บันทึกขึ้นฐานข้อมูลเรียบร้อย ✅");
      localStorage.removeItem("tripDraft");

      setFormData((prev) => ({
        ...prev,
        place: "",
        prov: "",
        dist: "",
        job: "",
        jobTypes: [],
        salesItems: [],
        timeIn: "",
        timeOut: "",

        images: [],
      }));
      setDistance(0);
      setRouteMin(null);
      setManualDistance("");
      setManualCost("");
      setDestPoint(null);
      if (routeLayerRef.current && mapInstance) mapInstance.removeLayer(routeLayerRef.current);
      if (destMarkerRef.current && mapInstance) mapInstance.removeLayer(destMarkerRef.current);
    } catch (e: any) {
      showToast(`บันทึกล้มเหลว: ${e?.message || "unknown"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const draft = localStorage.getItem("tripDraft");
    if (draft) {
      try {
        setFormData((prev) => ({ ...prev, ...JSON.parse(draft), date: utcDateString() }));
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* MODE TOGGLE */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTrackingMode("gps")}
            className={`p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
              trackingMode === "gps"
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Satellite size={16} /> โหมด GPS อัตโนมัติ
          </button>
          <button
            onClick={() => setTrackingMode("manual")}
            className={`p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
              trackingMode === "manual"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Edit3 size={16} /> กรอกระยะทางเอง
          </button>
        </div>
      </div>

      {trackingMode === "gps" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div ref={mapRef} className="w-full h-64 bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* NEARBY STORES */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <Store size={18} className="text-blue-600" />
                ร้านที่ต้องเช็คอินในรัศมี {settings.checkinRadiusKm} กม.
              </h2>
              <button
                onClick={refreshGps}
                className="h-9 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1"
              >
                <Locate size={14} /> รีเฟรช GPS
              </button>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              {gpsStatus === "ready" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  GPS พร้อมใช้งาน (ความแม่นยำ ±{Math.round(accuracy ?? 0)} ม.)
                </>
              ) : gpsStatus === "locating" ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> กำลังเปิด GPS อัตโนมัติ...
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  ยังไม่ได้รับตำแหน่ง — กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์
                </>
              )}
            </p>

            {scanningNearby && (
              <p className="text-[11px] text-blue-600 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> กำลังค้นหาร้านใกล้คุณ...
              </p>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {nearby.slice(0, 30).map(({ c, km }, i) => (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => selectCustomer(c)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    formData.place === c.name
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    อ.{c.district} จ.{c.province} · ห่าง ~{km.toFixed(2)} กม.
                  </p>
                </button>
              ))}
              {!scanningNearby && nearby.length === 0 && (
                <p className="text-[11px] text-slate-400 py-2">
                  ยังไม่พบร้านในรัศมี {settings.checkinRadiusKm} กม. — เลือกร้านจากช่องค้นหาด้านล่างได้เลย
                </p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <MapPin size={18} className="text-blue-600" /> สรุปการเดินทาง
              </h2>
              <VehiclePicker vehicle={vehicle} setVehicle={setVehicle} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric label="ระยะทางจริง" value={`${finalDistance.toFixed(2)} km`} tone="blue" />
              <Metric label="เวลาเดินทาง" value={formatMinutes(routeMin)} tone="amber" />
              <Metric label="ค่าเดินทาง" value={`฿${finalCost.toFixed(2)}`} tone="green" />
            </div>
            <p className="text-[11px] text-slate-500">
              สูตรสากล: (ระยะทาง ÷ {efficiency} กม./ลิตร) × ฿{settings.fuelPrice}/ลิตร ={" "}
              {litres.toFixed(2)} ลิตร
              {settings.ratePerKm > 0 && ` · ใช้เรทเหมา ฿${settings.ratePerKm}/กม.`}
            </p>
          </div>
        </>
      )}

      {trackingMode === "manual" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Edit3 size={18} className="text-indigo-600" /> กรอกระยะทาง/ค่าเดินทางเอง
            </h2>
            <VehiclePicker vehicle={vehicle} setVehicle={setVehicle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1 text-slate-600 dark:text-slate-300">
                ระยะทาง (km)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={manualDistance}
                onChange={(e) => setManualDistance(e.target.value)}
                placeholder="เช่น 25.5"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1 text-slate-600 dark:text-slate-300">
                ค่าเดินทาง (฿) — ว่าง = คำนวณอัตโนมัติ
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
                placeholder={`คำนวณ: ฿${autoCost.toFixed(2)}`}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
              />
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-xl p-3 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-300">รวมที่จะบันทึก</p>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {finalDistance.toFixed(2)} km · ฿{finalCost.toFixed(2)}
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {settings.ratePerKm > 0 ? `฿${settings.ratePerKm}/km` : `${efficiency} km/L`}
            </span>
          </div>
        </div>
      )}

      {/* FORM */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">บันทึกข้อมูลการปฏิบัติงาน</h2>
          <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
            Auto-Saved
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">👤 พนักงาน</label>
              <input
                readOnly
                value={employeeName}
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-slate-100 dark:bg-slate-700/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">🏷 ตำแหน่ง</label>
              <input
                readOnly
                value={employeePosition || "ยังไม่ระบุ (แอดมินตั้งค่าได้)"}
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-slate-100 dark:bg-slate-700/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1">
              <Globe2 size={14} /> วันที่ (อัตโนมัติตามเวลาสากล UTC)
            </label>
            <input
              type="date"
              name="date"
              readOnly
              value={formData.date}
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-slate-100 dark:bg-slate-700/50"
            />
          </div>

          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-medium block mb-1">
              สถานที่ / ร้านค้า{" "}
              {isLoadingCustomers ? (
                <span className="text-xs text-blue-600">(กำลังเชื่อมข้อมูลรายชื่อร้าน...)</span>
              ) : (
                <span className="text-xs text-green-600">✅ เชื่อมแล้ว {customers.length} ร้าน</span>
              )}
            </label>
            <input
              type="text"
              name="place"
              value={formData.place}
              onChange={(e) => {
                handleChange(e);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="พิมพ์ชื่อร้านเพื่อค้นหา..."
              autoComplete="off"
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showSuggestions && displaySuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 left-0 right-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                {displaySuggestions.slice(0, 50).map((c, idx) => (
                  <button
                    type="button"
                    key={`${c.id}-${idx}`}
                    onClick={() => void selectCustomer(c)}
                    className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-0"
                  >
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500 flex gap-2">
                      <span>อ.{c.district || "ไม่ระบุ"}</span>
                      <span>จ.{c.province || "ไม่ระบุ"}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">จังหวัด</label>
              <input
                type="text"
                name="prov"
                value={formData.prov}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">อำเภอ</label>
              <input
                type="text"
                name="dist"
                value={formData.dist}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">เวลาเข้า (Check-in)</label>
              <button
                onClick={() => handleTimeStamp("timeIn")}
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Clock size={16} /> กดเช็คอิน
              </button>
              <p className="text-center text-sm font-mono mt-1">{formData.timeIn || "--:--"}</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">เวลาออก (Check-out)</label>
              <button
                onClick={() => handleTimeStamp("timeOut")}
                className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Clock size={16} /> กดเช็คเอาท์
              </button>
              <p className="text-center text-sm font-mono mt-1">{formData.timeOut || "--:--"}</p>
            </div>
          </div>

          {workMinutes !== null && (
            <p className="text-xs text-center font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 rounded-xl py-2">
              ⏱ ระยะเวลาปฏิบัติงานจริง: {formatMinutes(workMinutes)}
            </p>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">
              ประเภทงาน (เลือกได้หลายอย่าง)
            </label>
            {formData.jobTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.jobTypes.map((j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold"
                  >
                    {j}
                    <button
                      type="button"
                      onClick={() => toggleJobType(j)}
                      aria-label={`ลบ ${j}`}
                      className="rounded-full bg-white/20 p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {JOB_PRESETS.map((j) => {
                const active = formData.jobTypes.includes(j);
                return (
                  <button
                    key={j}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggleJobType(j)}
                    className={`min-h-11 px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center gap-2 border transition ${
                      active
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300"
                        : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded grid place-items-center border shrink-0 ${
                        active ? "bg-blue-600 border-blue-600 text-white" : "border-slate-400"
                      }`}
                    >
                      {active && <CheckCircle size={12} />}
                    </span>
                    {j}
                  </button>
                );
              })}
            </div>
          </div>


          {/* ===== DYNAMIC SALES ITEMS ===== */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold flex items-center gap-1.5">
                <ShoppingCart size={16} className="text-emerald-600" /> สินค้าที่ขายได้
              </label>
              <button
                type="button"
                onClick={addSalesItem}
                className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus size={14} /> เพิ่มรายการ
              </button>
            </div>

            {formData.salesItems.length === 0 && (
              <p className="text-[11px] text-slate-500">ยังไม่มีรายการ — กด "เพิ่มรายการ" เพื่อบันทึกสินค้าที่ขาย</p>
            )}

            {formData.salesItems.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-2.5 space-y-2 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 w-5">{idx + 1}.</span>
                  <input
                    value={item.name}
                    onChange={(e) => updateSalesItem(item.id, { name: e.target.value })}
                    placeholder="ชื่อสินค้า"
                    className="flex-1 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeSalesItem(item.id)}
                    aria-label="ลบรายการสินค้า"
                    className="h-11 w-11 grid place-items-center rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] font-bold text-slate-500">
                    จำนวน
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={item.qty}
                      onChange={(e) =>
                        updateSalesItem(item.id, { qty: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 w-full h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
                    />
                  </label>
                  <label className="text-[10px] font-bold text-slate-500">
                    ราคา/หน่วย (฿)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateSalesItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 w-full h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none"
                    />
                  </label>
                  <label className="text-[10px] font-bold text-slate-500">
                    รวม
                    <p className="mt-1 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center">
                      {thb(lineTotal(item))}
                    </p>
                  </label>
                </div>
              </div>
            ))}

            {formData.salesItems.length > 0 && (
              <p className="text-right text-sm font-extrabold">
                ยอดขายรวม: <span className="text-emerald-600">{thb(totalSales)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">รายละเอียดงานเพิ่มเติม</label>

            <textarea
              name="job"
              value={formData.job}
              onChange={handleChange}
              rows={3}
              placeholder="อธิบายงานที่ทำ เช่น เปลี่ยนอุปกรณ์ 2 จุด ..."
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              หลักฐาน / บิลน้ำมัน / รูปถ่ายหน้างาน
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="border-2 border-dashed dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition active:scale-[0.98]">
                {/* Native camera — works on legacy iOS/Android, no WebRTC */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Camera className="mx-auto text-blue-500" size={28} />
                <p className="text-xs mt-2 font-bold">ถ่ายรูปด้วยกล้อง</p>
              </label>
              <label className="border-2 border-dashed dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition active:scale-[0.98]">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <FileText className="mx-auto text-slate-400" size={28} />
                <p className="text-xs mt-2 font-bold">เลือกจากคลังภาพ</p>
              </label>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 text-center">
              {processingPhoto ? "กำลังย่อขนาดรูป..." : "รูปจะถูกย่อขนาดอัตโนมัติเพื่อประหยัดเน็ต"}
            </p>

            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {formData.images.map((imgSrc, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={imgSrc} alt={`upload-${index}`} className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md"
                      aria-label="remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
          >
            <Save size={18} /> {saving ? "กำลังบันทึก..." : "บันทึกและส่งเบิก"}
            {formData.images.length > 0 && ` (พร้อม ${formData.images.length} รูป)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function VehiclePicker({
  vehicle,
  setVehicle,
}: {
  vehicle: "car" | "pickup" | "motorcycle";
  setVehicle: (v: "car" | "pickup" | "motorcycle") => void;
}) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
      <button
        onClick={() => setVehicle("motorcycle")}
        className={`p-2 rounded ${vehicle === "motorcycle" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
        aria-label="motorcycle"
      >
        <Bike size={18} />
      </button>
      <button
        onClick={() => setVehicle("car")}
        className={`p-2 rounded ${vehicle === "car" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
        aria-label="car"
      >
        <Car size={18} />
      </button>
      <button
        onClick={() => setVehicle("pickup")}
        className={`p-2 rounded ${vehicle === "pickup" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
        aria-label="pickup"
      >
        <Truck size={18} />
      </button>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    green: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };
  return (
    <div className={`p-3 rounded-xl ${tones[tone] ?? tones["blue"]}`}>
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}

/* ================================================================== */
/* DASHBOARD / REPORT                                                 */
/* ================================================================== */

function DashboardView({
  trips,
  employeeName,
  showToast,
  settings,
}: {
  trips: Trip[];
  employeeName: string;
  showToast: (m: string, t?: string) => void;
  settings: AppSettings;
}) {
  const sendLine = useServerFn(sendLineMessage);
  const [sending, setSending] = useState(false);
  const todayStr = utcDateString();
  const todayTrips = trips.filter((t) => t.date === todayStr);

  const sum = (list: Trip[], key: "dist" | "cost") =>
    list.reduce((s, t) => s + (parseFloat(String(t[key])) || 0), 0);

  const todayDist = sum(todayTrips, "dist");
  const todayCost = sum(todayTrips, "cost");
  const todayMinutes = todayTrips.reduce((s, t) => s + (t.durationMin || 0), 0);
  const totalDist = sum(trips, "dist");
  const totalCost = sum(trips, "cost");
  const litresToday =
    settings.fuelEfficiency > 0 ? todayDist / settings.fuelEfficiency : 0;

  const buildMessage = () => {
    const todayTh = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    let text = `📋 สรุปงานประจำวัน: ${todayTh}\n`;
    text += `👤 พนักงาน: ${employeeName || "ไม่ระบุชื่อ"}\n`;
    text += `🏪 เช็คอินทั้งหมด: ${todayTrips.length} ร้าน\n`;
    text += `🚗 ระยะทางรวม: ${todayDist.toFixed(1)} กม.\n`;
    text += `⛽ น้ำมันโดยประมาณ: ${litresToday.toFixed(2)} ลิตร (฿${settings.fuelPrice}/ลิตร)\n`;
    text += `💰 ค่าเดินทางรวม: ฿${todayCost.toFixed(2)}\n`;
    text += `⏱ เวลาปฏิบัติงานรวม: ${formatMinutes(todayMinutes)}\n\n`;
    text += `📍 รายละเอียดงาน:\n`;
    [...todayTrips].reverse().forEach((t, i) => {
      text += `${i + 1}. ${t.place} (${t.timeIn || "-"} - ${t.timeOut || "-"})`;
      if (t.jobType) text += ` [${t.jobType}]`;
      text += ` ${Number(t.dist).toFixed(1)}กม./฿${Number(t.cost).toFixed(0)}\n`;
      if (t.job) text += `   ↳ ${t.job}\n`;
    });
    return text;
  };

  const handleSendLineNotify = async () => {
    if (todayTrips.length === 0) return showToast("วันนี้ยังไม่ได้ลงงานเลย", "error");
    if (!settings.lineToken) return showToast("ยังไม่ได้ตั้งค่า LINE Access Token", "error");
    setSending(true);
    try {
      await sendLine({
        data: {
          accessToken: settings.lineToken,
          channelSecret: settings.lineSecret,
          message: buildMessage(),
        },
      });
      showToast("ส่งแจ้งเตือนเข้า LINE สำเร็จ ✅");
    } catch (e: any) {
      showToast(`ส่งไม่สำเร็จ: ${e?.message || "unknown"}`, "error");
    } finally {
      setSending(false);
    }
  };

  const handleShareLine = () => {
    if (todayTrips.length === 0) return showToast("วันนี้ยังไม่ได้ลงงานเลย", "error");
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(buildMessage())}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">รายงานสรุปการทำงาน</h2>

      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-4 shadow-lg space-y-3">
        <h3 className="font-bold">🗓 สรุปวันนี้ ({todayStr})</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">เช็คอิน</p>
            <p className="text-2xl font-bold">{todayTrips.length} ร้าน</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">ระยะทางรวม</p>
            <p className="text-2xl font-bold">{todayDist.toFixed(1)} กม.</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">ค่าน้ำมัน/ค่าเดินทาง</p>
            <p className="text-2xl font-bold">฿{todayCost.toFixed(0)}</p>
            <p className="text-[10px] opacity-80">≈ {litresToday.toFixed(2)} ลิตร</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">เวลาปฏิบัติงาน</p>
            <p className="text-2xl font-bold">{formatMinutes(todayMinutes)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSendLineNotify}
            disabled={sending}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
          >
            <Send size={16} /> {sending ? "กำลังส่ง..." : "แจ้งเตือน LINE"}
          </button>
          <button
            onClick={handleShareLine}
            className="bg-white/15 hover:bg-white/25 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition border border-white/20"
          >
            <ExternalLink size={16} /> แชร์เอง
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
          <p className="text-xs text-gray-500">ระยะทางสะสม</p>
          <p className="text-xl font-bold text-blue-600">{totalDist.toFixed(1)} กม.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
          <p className="text-xs text-gray-500">ยอดเบิกสะสม</p>
          <p className="text-xl font-bold text-green-600">฿{totalCost.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
        <h3 className="font-bold mb-3">รายละเอียดงานล่าสุด</h3>
        <div className="space-y-2">
          {trips.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-sm">ยังไม่มีประวัติการเดินทาง</p>
          ) : (
            trips.slice(0, 50).map((trip) => (
              <div key={trip.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">{trip.place}</p>
                    <p className="text-[11px] text-gray-500">
                      {trip.date} · {trip.timeIn || "--:--"} - {trip.timeOut || "--:--"} ·{" "}
                      {formatMinutes(trip.durationMin ?? null)}
                    </p>
                    {trip.job && <p className="text-[11px] text-gray-500 mt-0.5">{trip.job}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">
                      {Number(trip.dist).toFixed(1)} กม. · ฿{Number(trip.cost).toFixed(0)}
                    </p>
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {trip.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* SETTINGS                                                           */
/* ================================================================== */

function SettingsView({
  settings,
  onSave,
  showToast,
  isAdmin,
}: {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  showToast: (m: string, t?: string) => void;
  isAdmin: boolean;
}) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [pttLoading, setPttLoading] = useState(false);
  const [ptt, setPtt] = useState<{ date: string; prices: FuelPrice[] } | null>(null);
  const sendLine = useServerFn(sendLineMessage);

  const loadPttPrices = async () => {
    setPttLoading(true);
    try {
      const data = await fetchPttFuelPrices();
      setPtt({ date: data.date, prices: data.prices });
      showToast(`ราคาน้ำมัน ปตท. วันที่ ${data.date} ✅`);
    } catch (e: any) {
      showToast(e?.message || "ดึงราคาน้ำมันไม่สำเร็จ", "error");
    } finally {
      setPttLoading(false);
    }
  };

  useEffect(() => setForm(settings), [settings]);

  const preview = (() => {
    try {
      return calculateFuelCost({
        distanceKm: 10,
        fuelEfficiency: form.fuelEfficiency,
        fuelPrice: form.fuelPrice,
        ratePerKm: form.ratePerKm,
      });
    } catch {
      return null;
    }
  })();

  const handleTest = async () => {
    if (!form.lineToken) return showToast("กรอก Channel Access Token ก่อน", "error");
    setTesting(true);
    try {
      await sendLine({
        data: {
          accessToken: form.lineToken,
          channelSecret: form.lineSecret,
          message: "🔔 EJH Check In: ทดสอบการแจ้งเตือนสำเร็จ",
        },
      });
      showToast("ส่งทดสอบสำเร็จ ✅");
    } catch (e: any) {
      showToast(`ทดสอบไม่ผ่าน: ${e?.message || "unknown"}`, "error");
    } finally {
      setTesting(false);
    }
  };

  const disabled = !isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-blue-600" size={22} />
        <h2 className="text-xl font-bold">ตั้งค่าระบบ</h2>
      </div>

      {!isAdmin && (
        <p className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-xl p-3">
          การตั้งค่าเหล่านี้กำหนดโดยผู้ดูแลระบบ (ดูได้อย่างเดียว)
        </p>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 space-y-4 border border-slate-200/60 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 grid place-items-center">
            <KeyRound className="text-emerald-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold">การแจ้งเตือนผ่าน LINE</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ใช้ Channel Access Token + Channel Secret (Messaging API)
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            Channel access token <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.lineToken}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, lineToken: e.target.value })}
            rows={3}
            placeholder="วาง Channel Access Token (long-lived)"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs disabled:opacity-70"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Channel secret</label>
          <input
            type="text"
            value={form.lineSecret}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, lineSecret: e.target.value })}
            placeholder="วาง Channel Secret"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs disabled:opacity-70"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            LINE token สำหรับส่งเข้ากลุ่ม (LINE Notify)
          </label>
          <textarea
            value={form.lineNotifyToken}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, lineNotifyToken: e.target.value })}
            rows={2}
            placeholder="วาง LINE Notify token ของกลุ่ม (เว้นว่าง = ใช้ Channel Access Token)"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs disabled:opacity-70"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            ใช้ในหน้า "ย้อนหลัง" เพื่อส่งสรุปยอดขาย/ค่าน้ำมันเข้ากลุ่ม LINE
          </p>
        </div>


        <button
          onClick={handleTest}
          disabled={testing}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition active:scale-[0.98]"
        >
          <Send size={16} /> {testing ? "กำลังส่ง..." : "ทดสอบส่งแจ้งเตือน LINE"}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 space-y-4 border border-slate-200/60 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 grid place-items-center">
            <Fuel className="text-orange-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold">ค่าน้ำมัน / การคำนวณ</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              สูตรสากล: (ระยะทาง ÷ อัตราสิ้นเปลือง) × ราคาน้ำมัน
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="ราคาน้ำมัน (฿/ลิตร)"
            value={form.fuelPrice}
            disabled={disabled}
            onChange={(v) => setForm({ ...form, fuelPrice: v })}
          />
          <NumberField
            label="อัตราสิ้นเปลือง (กม./ลิตร)"
            value={form.fuelEfficiency}
            disabled={disabled}
            onChange={(v) => setForm({ ...form, fuelEfficiency: v })}
          />
          <NumberField
            label="เรทเหมาต่อกิโลเมตร (0 = ปิด)"
            value={form.ratePerKm}
            disabled={disabled}
            onChange={(v) => setForm({ ...form, ratePerKm: v })}
          />
          <NumberField
            label="รัศมีเช็คอิน (กม.)"
            value={form.checkinRadiusKm}
            disabled={disabled}
            onChange={(v) => setForm({ ...form, checkinRadiusKm: v })}
          />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold">ราคาน้ำมันวันนี้ (ปตท.)</p>
            <button
              type="button"
              onClick={loadPttPrices}
              disabled={pttLoading}
              className="h-9 px-3 rounded-xl bg-orange-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1"
            >
              {pttLoading ? <Loader2 size={14} className="animate-spin" /> : <Fuel size={14} />}
              ดึงราคาอัตโนมัติ
            </button>
          </div>
          {ptt ? (
            <>
              <p className="text-[11px] text-slate-500">
                ประกาศวันที่ {ptt.date} · แตะเพื่อใช้ราคานี้
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ptt.prices.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => setForm({ ...form, fuelPrice: p.price })}
                    className={`min-h-11 px-3 py-2 rounded-xl text-left text-xs font-bold border transition disabled:opacity-60 ${
                      form.fuelPrice === p.price
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                        : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                    }`}
                  >
                    <span className="block truncate">{p.name}</span>
                    <span className="text-sm">฿{p.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">
              ระบบดึงข้อมูลผ่านเซิร์ฟเวอร์ของเรา (มีแคช 30 นาที) จึงไม่ติดปัญหา CORS
            </p>
          )}
        </div>

        {preview && (
          <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-xl p-3 text-xs space-y-1">
            <p className="font-semibold text-orange-700 dark:text-orange-300">
              ตัวอย่าง: เดินทาง 10 กม.
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              ใช้น้ำมัน {preview.litresUsed} ลิตร · ค่าใช้จ่าย ฿{preview.fuelCost} (
              {preview.method === "rate" ? "เรทเหมา" : "สูตรน้ำมัน"} ≈ ฿
              {preview.effectiveCostPerKm}/กม.)
            </p>
          </div>
        )}
      </div>

      {isAdmin && (
        <button
          onClick={() => onSave(form)}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
        >
          <Save size={18} /> บันทึกการตั้งค่าทั้งหมด
        </button>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-lg font-bold disabled:opacity-70"
      />
    </div>
  );
}
