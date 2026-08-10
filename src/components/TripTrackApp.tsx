import React, { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Navigation,
  Camera,
  FileText,
  BarChart3,
  Moon,
  Sun,
  Play,
  Square,
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
} from "lucide-react";
import { sendLineMessage } from "@/lib/line.functions";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/engcorp-logo.png";
import InstallPrompt from "@/components/InstallPrompt";

declare global {
  interface Window {
    L: any;
  }
}

const vehicleRates: Record<string, { name: string; rate: number }> = {
  car: { name: "รถยนต์", rate: 4.5 },
  pickup: { name: "รถกระบะ", rate: 5.0 },
  motorcycle: { name: "มอเตอร์ไซค์", rate: 2.0 },
};

const mockCustomers = [
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
};

type AppSettings = {
  lineToken: string;
  lineSecret: string;
  fuelPrice: number; // บาท/ลิตร
  ratePerKm: number; // บาท/กม. (0 = ใช้ default ของรถ)
};

const DEFAULT_SETTINGS: AppSettings = {
  lineToken: "",
  lineSecret: "",
  fuelPrice: 38,
  ratePerKm: 0,
};

export default function TripTrackApp() {
  const [activeTab, setActiveTab] = useState<"form" | "dashboard" | "settings">("form");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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

    try {
      const savedName = localStorage.getItem("employeeName");
      if (savedName) setEmployeeName(savedName);
      const raw = localStorage.getItem("appSettings");
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}

    // Load trips from Supabase
    (async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
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
          }))
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const showToast = (msg: string, type: string = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddTrip = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);
  };

  const handleNameChange = (n: string) => {
    setEmployeeName(n);
    localStorage.setItem("employeeName", n);
  };

  const saveSettings = (s: AppSettings) => {
    setSettings(s);
    localStorage.setItem("appSettings", JSON.stringify(s));
    showToast("บันทึกการตั้งค่าเรียบร้อย");
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
                ระบบบันทึกงาน & GPS
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
            aria-label="toggle dark mode"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
            onNameChange={handleNameChange}
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
          <SettingsView settings={settings} onSave={saveSettings} showToast={showToast} />
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
      className={`flex-1 flex flex-col items-center py-3 gap-1 text-[11px] font-semibold transition rounded-2xl mx-1 my-1 ${
        isActive
          ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
      <span>{label}</span>
    </button>
  );
}

function FormView({
  showToast,
  onAddTrip,
  employeeName,
  onNameChange,
  settings,
}: {
  showToast: (m: string, t?: string) => void;
  onAddTrip: (t: Trip) => void;
  employeeName: string;
  onNameChange: (n: string) => void;
  settings: AppSettings;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState<number | string>(0);
  const [manualDistance, setManualDistance] = useState<string>("");
  const [manualCost, setManualCost] = useState<string>("");
  const [trackingMode, setTrackingMode] = useState<"gps" | "manual">("gps");
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [destPoint, setDestPoint] = useState<[number, number] | null>(null);
  const [vehicle, setVehicle] = useState<"car" | "pickup" | "motorcycle">("car");
  const [saving, setSaving] = useState(false);
  const routeLayerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    prov: "",
    dist: "",
    place: "",
    timeIn: "",
    timeOut: "",
    job: "",
    images: [] as string[],
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customers, setCustomers] = useState(mockCustomers);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Effective rate per km
  const effectiveRate = settings.ratePerKm > 0 ? settings.ratePerKm : vehicleRates[vehicle].rate;

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
        const newCustomers: typeof mockCustomers = [];
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
        // fallback
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomersFromSheet();
  }, []);

  useEffect(() => {
    if (trackingMode !== "gps") return;
    if (!mapRef.current || mapInstance) return;
    let cancelled = false;
    const initMap = async () => {
      let attempts = 0;
      while (!window.L && attempts < 20) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }
      if (cancelled) return;
      if (window.L && mapRef.current && !mapInstance) {
        const map = window.L.map(mapRef.current).setView([17.4138, 102.7872], 13);
        window.L
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap",
          })
          .addTo(map);
        setMapInstance(map);
      }
    };
    initMap();
    return () => {
      cancelled = true;
    };
  }, [mapInstance, trackingMode]);

  useEffect(() => {
    if (trackingMode !== "gps") return;
    if (mapInstance && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setStartPoint(latlng);
          setIsTracking(true);
          showToast("📍 ดึงตำแหน่ง GPS ของคุณอัตโนมัติแล้ว!");
          if (window.L) {
            if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
            startMarkerRef.current = window.L
              .marker(latlng)
              .addTo(mapInstance)
              .bindPopup("จุดเริ่มต้นของคุณ")
              .openPopup();
            mapInstance.setView(latlng, 15);
          }
        },
        () => console.warn("GPS Auto-fetch denied")
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, trackingMode]);

  const calculateRouteTo = async (
    destLat: number,
    destLng: number,
    currentStartPoint: [number, number] | null = startPoint
  ) => {
    if (!currentStartPoint || !mapInstance || !window.L) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${currentStartPoint[1]},${currentStartPoint[0]};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const routeInfo = data.routes[0];
        const distKm = (routeInfo.distance / 1000).toFixed(2);
        setDistance(distKm);
        if (routeLayerRef.current) mapInstance.removeLayer(routeLayerRef.current);
        const latlngs = routeInfo.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        routeLayerRef.current = window.L
          .polyline(latlngs, { color: "#3b82f6", weight: 5, opacity: 0.8 })
          .addTo(mapInstance);
        mapInstance.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
      }
    } catch {
      showToast("คำนวณเส้นทางถนนจริงล้มเหลว", "error");
    }
  };

  const findStoreLocation = async (dist: string, prov: string) => {
    if (!dist || !prov || trackingMode !== "gps") return;
    try {
      showToast(`กำลังหาพิกัด อ.${dist} จ.${prov}...`);
      const query = `อำเภอ${dist}, จังหวัด${prov}, ประเทศไทย`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const destination: [number, number] = [lat, lon];
        setDestPoint(destination);
        if (mapInstance && window.L) {
          if (destMarkerRef.current) mapInstance.removeLayer(destMarkerRef.current);
          const redIcon = new window.L.Icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          });
          destMarkerRef.current = window.L
            .marker(destination, { icon: redIcon })
            .addTo(mapInstance)
            .bindPopup(`📍 ร้านปลายทาง (อ.${dist}, จ.${prov})`)
            .openPopup();
          mapInstance.setView(destination, 13);
          if (startPoint) calculateRouteTo(lat, lon, startPoint);
        }
      } else {
        showToast(`ไม่พบพิกัด อ.${dist} ในระบบแผนที่`, "error");
      }
    } catch {
      showToast("ระบบค้นหาพิกัดมีปัญหา", "error");
    }
  };

  const toggleTracking = () => {
    if (!isTracking) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            setStartPoint(latlng);
            setIsTracking(true);
            if (mapInstance && window.L) {
              if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
              startMarkerRef.current = window.L
                .marker(latlng)
                .addTo(mapInstance)
                .bindPopup("จุดเริ่มต้นของคุณ")
                .openPopup();
              if (destPoint) calculateRouteTo(destPoint[0], destPoint[1], latlng);
              else mapInstance.setView(latlng, 15);
            }
          },
          () => showToast("กรุณาเปิด GPS ด้วยนะเพื่อน", "error")
        );
      } else showToast("Browser ไม่รองรับ GPS", "error");
    } else {
      setIsTracking(false);
      showToast("จบการเดินทางเรียบร้อย");
    }
  };

  // Compute final dist/cost based on mode
  const finalDistance =
    trackingMode === "manual" ? parseFloat(manualDistance || "0") : parseFloat(distance.toString() || "0");
  const finalCost =
    trackingMode === "manual" && manualCost
      ? parseFloat(manualCost)
      : parseFloat((finalDistance * effectiveRate).toFixed(2));

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
    const matchDist = !formData.dist || c.district === formData.dist;
    const matchSearch = c.name.toLowerCase().includes(formData.place.toLowerCase());
    return matchProv && matchDist && matchSearch;
  });

  const saveDraftToLocal = (data: typeof formData) => {
    const draft = { ...data, images: [] };
    localStorage.setItem("tripDraft", JSON.stringify(draft));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    if (name === "prov") newData.dist = "";
    setFormData(newData);
    saveDraftToLocal(newData);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, images: [...prev.images, reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (idx: number) => {
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleTimeStamp = (field: "timeIn" | "timeOut") => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const newData = { ...formData, [field]: timeString };
    setFormData(newData);
    saveDraftToLocal(newData);
    showToast(`บันทึกเวลา${field === "timeIn" ? "เข้า" : "ออก"}สำเร็จ: ${timeString}`);
  };

  const handleSave = async () => {
    if (!employeeName.trim()) {
      showToast("อย่าลืมกรอกชื่อ-นามสกุล ก่อนเซฟนะเพื่อน!", "error");
      return;
    }
    if (!formData.place) {
      showToast("เลือกร้านค้าก่อนนะเพื่อน!", "error");
      return;
    }
    if (finalDistance <= 0) {
      showToast("กรุณาระบุระยะทาง (>0 km)", "error");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("trips")
        .insert({
          trip_date: formData.date,
          employee_name: employeeName,
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
          images: formData.images,
          status: "รออนุมัติ",
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
      });
      showToast("บันทึกขึ้นฐานข้อมูลเรียบร้อย ✅");
      localStorage.removeItem("tripDraft");

      setFormData((prev) => ({
        ...prev,
        place: "",
        prov: "",
        dist: "",
        job: "",
        timeIn: "",
        timeOut: "",
        images: [],
      }));
      setDistance(0);
      setManualDistance("");
      setManualCost("");
      setStartPoint(null);
      setDestPoint(null);
      setIsTracking(false);
      if (routeLayerRef.current && mapInstance) mapInstance.removeLayer(routeLayerRef.current);
      if (destMarkerRef.current && mapInstance) mapInstance.removeLayer(destMarkerRef.current);
      if (startMarkerRef.current && mapInstance) mapInstance.removeLayer(startMarkerRef.current);
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
        setFormData((prev) => ({ ...prev, ...JSON.parse(draft) }));
      } catch {}
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

      {/* MAP & TRACKING (GPS mode only) */}
      {trackingMode === "gps" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div ref={mapRef} className="w-full h-64 bg-gray-200 dark:bg-gray-700" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <MapPin size={18} className="text-blue-600" />
                ระบบจับพิกัดเดินทาง
              </h2>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl">
                <p className="text-xs text-gray-600 dark:text-gray-300">ระยะทางจริง</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {finalDistance.toFixed(2)} km
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  ค่าเดินทาง (฿{effectiveRate}/km)
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ฿{finalCost.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={toggleTracking}
              className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition ${
                isTracking ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isTracking ? (
                <>
                  <Square size={18} /> จบการเดินทาง
                </>
              ) : (
                <>
                  <Play size={18} /> รีเฟรชตำแหน่ง GPS ใหม่
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* MANUAL ENTRY */}
      {trackingMode === "manual" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Edit3 size={18} className="text-indigo-600" /> กรอกระยะทาง/ค่าเดินทางเอง
            </h2>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              <button onClick={() => setVehicle("motorcycle")} className={`p-2 rounded ${vehicle === "motorcycle" ? "bg-white dark:bg-gray-600 shadow" : ""}`}><Bike size={18} /></button>
              <button onClick={() => setVehicle("car")} className={`p-2 rounded ${vehicle === "car" ? "bg-white dark:bg-gray-600 shadow" : ""}`}><Car size={18} /></button>
              <button onClick={() => setVehicle("pickup")} className={`p-2 rounded ${vehicle === "pickup" ? "bg-white dark:bg-gray-600 shadow" : ""}`}><Truck size={18} /></button>
            </div>
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
                placeholder={`คำนวณ: ฿${(parseFloat(manualDistance || "0") * effectiveRate).toFixed(2)}`}
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
            <span className="text-[11px] text-slate-500">เรท ฿{effectiveRate}/km</span>
          </div>
        </div>
      )}

      {/* FORM SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">บันทึกข้อมูลการปฏิบัติงาน</h2>
          <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
            Auto-Saved
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">👤 ชื่อ-นามสกุลพนักงาน</label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="เช่น สมชาย สายซิ่ง (กรอกครั้งเดียวระบบจำเลย!)"
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">วันที่เดินทาง</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-medium block mb-1">
              สถานที่ / ร้านค้า{" "}
              {isLoadingCustomers && (
                <span className="text-xs text-blue-600">(กำลังดูดข้อมูลจาก Sheet...)</span>
              )}
              {!isLoadingCustomers && (
                <span className="text-xs text-green-600">✅ มีข้อมูล {customers.length} ร้าน</span>
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
                    onClick={() => {
                      setFormData((prev) => {
                        const newData = { ...prev, place: c.name, prov: c.province, dist: c.district };
                        saveDraftToLocal(newData);
                        return newData;
                      });
                      setShowSuggestions(false);
                      findStoreLocation(c.district, c.province);
                    }}
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
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60 p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Clock size={16} /> กดเช็คอิน
              </button>
              <p className="text-center text-sm font-mono mt-1">{formData.timeIn || "--:--"}</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">เวลาออก (Check-out)</label>
              <button
                onClick={() => handleTimeStamp("timeOut")}
                className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-800/60 p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Clock size={16} /> กดเช็คเอาท์
              </button>
              <p className="text-center text-sm font-mono mt-1">{formData.timeOut || "--:--"}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">รายละเอียดงานที่ทำ</label>
            <textarea
              name="job"
              value={formData.job}
              onChange={handleChange}
              rows={3}
              placeholder="เช่น ติดตั้ง / ซ่อม / ส่งของ ..."
              className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              หลักฐาน / บิลน้ำมัน / รูปถ่ายหน้างาน
            </label>
            <label className="block border-2 border-dashed dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              <Camera className="mx-auto text-gray-400" size={32} />
              <p className="text-sm mt-2 font-medium">แตะเพื่อถ่ายรูป หรือเลือกไฟล์</p>
              <p className="text-xs text-gray-500">อัปโหลดได้หลายรูป (JPG, PNG)</p>
            </label>
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {formData.images.map((imgSrc, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={imgSrc} alt={`upload-${index}`} className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-90 hover:opacity-100 hover:scale-110 transition shadow-md"
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
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTrips = trips.filter((t) => t.date === todayStr);
  const todayDist = todayTrips.reduce((s, t) => s + parseFloat((t.dist as any) || 0), 0).toFixed(1);
  const todayCost = todayTrips.reduce((s, t) => s + parseFloat((t.cost as any) || 0), 0).toLocaleString();
  const totalDist = trips.reduce((s, t) => s + parseFloat((t.dist as any) || 0), 0).toFixed(1);
  const totalCost = trips.reduce((s, t) => s + parseFloat((t.cost as any) || 0), 0).toLocaleString();

  const buildMessage = () => {
    const todayTh = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    let text = `📋 สรุปงานประจำวัน: ${todayTh}\n`;
    text += `👤 พนักงาน: ${employeeName || "ไม่ระบุชื่อ"}\n`;
    text += `🚗 ระยะทางรวมวันนี้: ${todayDist} km\n`;
    text += `💰 ค่าเดินทางรวมวันนี้: ฿${todayCost}\n\n`;
    text += `📍 สถานที่เข้าพบ (${todayTrips.length} แห่ง):\n`;
    [...todayTrips].reverse().forEach((t, i) => {
      const tIn = t.timeIn || "-";
      const tOut = t.timeOut || "-";
      text += `${i + 1}. ${t.place} (${tIn} ถึง ${tOut})\n`;
    });
    return text;
  };

  const handleSendLineNotify = async () => {
    if (todayTrips.length === 0) {
      showToast("วันนี้ยังไม่ได้ลงงานเลยเพื่อน", "error");
      return;
    }
    if (!settings.lineToken) {
      showToast("ยังไม่ได้ตั้งค่า LINE Access Token (ไปแท็บตั้งค่า)", "error");
      return;
    }
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
    if (todayTrips.length === 0) {
      showToast("วันนี้ยังไม่ได้ลงงานเลย", "error");
      return;
    }
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(buildMessage())}`;
    window.open(lineUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">ภาพรวมการทำงาน</h2>

      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-4 shadow-lg space-y-3">
        <h3 className="font-bold">🗓 สรุปงานวันนี้ ({todayTrips.length} ทริป)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">ระยะทางวันนี้</p>
            <p className="text-2xl font-bold">{todayDist} km</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-80">ค่าใช้จ่ายวันนี้</p>
            <p className="text-2xl font-bold">฿{todayCost}</p>
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
            className="bg-white/15 hover:bg-white/25 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] border border-white/20"
          >
            <ExternalLink size={16} /> แชร์มือ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
          <p className="text-xs text-gray-500">รวมระยะทางสะสม</p>
          <p className="text-xl font-bold text-blue-600">{totalDist} km</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
          <p className="text-xs text-gray-500">รวมยอดเบิกสะสม</p>
          <p className="text-xl font-bold text-green-600">฿{totalCost}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">ประวัติทริปล่าสุด</h3>
        </div>
        <div className="space-y-2">
          {trips.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-sm">ยังไม่มีประวัติการเดินทาง</p>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{trip.place}</p>
                  <p className="text-xs text-gray-500">
                    {trip.date} ·{" "}
                    {trip.timeIn ? `${trip.timeIn} - ${trip.timeOut || "?"}` : "ไม่ได้ลงเวลา"}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-bold text-sm">{trip.dist} km · ฿{trip.cost}</p>
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    {trip.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsView({
  settings,
  onSave,
  showToast,
}: {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  showToast: (m: string, t?: string) => void;
}) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [testing, setTesting] = useState(false);
  const sendLine = useServerFn(sendLineMessage);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleTest = async () => {
    if (!form.lineToken) {
      showToast("กรอก Channel Access Token ก่อน", "error");
      return;
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-blue-600" size={22} />
        <h2 className="text-xl font-bold">ตั้งค่าระบบ</h2>
      </div>

      {/* LINE Settings */}
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
            onChange={(e) => setForm({ ...form, lineToken: e.target.value })}
            rows={3}
            placeholder="วาง Channel Access Token (long-lived) จาก LINE Developers Console"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Channel secret</label>
          <input
            type="text"
            value={form.lineSecret}
            onChange={(e) => setForm({ ...form, lineSecret: e.target.value })}
            placeholder="วาง Channel Secret จาก LINE Developers Console"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            ใช้ในการตรวจสอบ webhook signature (เก็บไว้ใน localStorage)
          </p>
        </div>

        <button
          onClick={handleTest}
          disabled={testing}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition active:scale-[0.98]"
        >
          <Send size={16} /> {testing ? "กำลังส่ง..." : "ทดสอบส่งแจ้งเตือน LINE"}
        </button>

        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-3 text-xs space-y-1">
          <p className="font-bold text-blue-700 dark:text-blue-300">📘 วิธีรับ Token & Secret</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
            <li>
              เข้า{" "}
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noreferrer"
                className="underline text-blue-600"
              >
                LINE Developers Console
              </a>
            </li>
            <li>สร้าง Provider → Channel แบบ Messaging API</li>
            <li>แท็บ "Basic settings" คัดลอก Channel secret</li>
            <li>แท็บ "Messaging API" คัดลอก Channel access token (long-lived)</li>
            <li>เพิ่ม Bot เป็นเพื่อน เพื่อรับ broadcast แจ้งเตือน</li>
          </ol>
        </div>
      </div>

      {/* Cost Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 space-y-4 border border-slate-200/60 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 grid place-items-center">
            <Fuel className="text-orange-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold">ตั้งค่าค่าน้ำมัน / ค่าเดินทาง</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ใช้คำนวณค่าใช้จ่ายในการเดินทาง
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">ราคาน้ำมัน (฿/ลิตร)</label>
            <input
              type="number"
              step="0.01"
              value={form.fuelPrice}
              onChange={(e) => setForm({ ...form, fuelPrice: parseFloat(e.target.value) || 0 })}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-lg font-bold"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              ราคาต่อกิโลเมตร (฿/km)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.ratePerKm}
              onChange={(e) => setForm({ ...form, ratePerKm: parseFloat(e.target.value) || 0 })}
              placeholder="0 = ใช้ตามชนิดรถ"
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-lg font-bold"
            />
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-xl p-3 text-xs space-y-1">
          <p className="font-semibold text-orange-700 dark:text-orange-300">
            🚗 อัตราเริ่มต้นต่อกิโลเมตร (ถ้าตั้ง 0 ในช่องบน)
          </p>
          <ul className="text-slate-700 dark:text-slate-300 space-y-0.5">
            <li>• มอเตอร์ไซค์: ฿{vehicleRates.motorcycle.rate}/km</li>
            <li>• รถยนต์: ฿{vehicleRates.car.rate}/km</li>
            <li>• รถกระบะ: ฿{vehicleRates.pickup.rate}/km</li>
          </ul>
        </div>
      </div>

      <button
        onClick={() => onSave(form)}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
      >
        <Save size={18} /> บันทึกการตั้งค่าทั้งหมด
      </button>
    </div>
  );
}
