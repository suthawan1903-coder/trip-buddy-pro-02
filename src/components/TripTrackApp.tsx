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
} from "lucide-react";
import { sendLineMessage } from "@/lib/line.functions";
import logoUrl from "@/assets/engcorp-logo.png";

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

export default function TripTrackApp() {
  const [activeTab, setActiveTab] = useState<"form" | "dashboard" | "settings">("form");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [lineToken, setLineToken] = useState("");
  const [lineTarget, setLineTarget] = useState("");

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
      const savedTrips = JSON.parse(localStorage.getItem("completedTrips") || "[]");
      setTrips(savedTrips);
      const savedName = localStorage.getItem("employeeName");
      if (savedName) setEmployeeName(savedName);
      setLineToken(localStorage.getItem("lineToken") || "");
      setLineTarget(localStorage.getItem("lineTarget") || "");
    } catch {}
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
    const updated = [newTrip, ...trips];
    setTrips(updated);
    localStorage.setItem("completedTrips", JSON.stringify(updated));
  };

  const handleNameChange = (n: string) => {
    setEmployeeName(n);
    localStorage.setItem("employeeName", n);
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

      <main className="max-w-2xl mx-auto p-4">
        {activeTab === "form" && (
          <FormView
            showToast={showToast}
            onAddTrip={handleAddTrip}
            employeeName={employeeName}
            onNameChange={handleNameChange}
          />
        )}
        {activeTab === "dashboard" && (
          <DashboardView
            trips={trips}
            employeeName={employeeName}
            showToast={showToast}
            lineToken={lineToken}
            lineTarget={lineTarget}
          />
        )}
        {activeTab === "settings" && (
          <SettingsView
            lineToken={lineToken}
            lineTarget={lineTarget}
            onSave={(tok, target) => {
              setLineToken(tok);
              setLineTarget(target);
              localStorage.setItem("lineToken", tok);
              localStorage.setItem("lineTarget", target);
              showToast("บันทึกการตั้งค่า LINE เรียบร้อย");
            }}
            showToast={showToast}
          />
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
        <NavButton
          icon={<FileText />}
          label="บันทึกงาน"
          isActive={activeTab === "form"}
          onClick={() => setActiveTab("form")}
        />
        <NavButton
          icon={<BarChart3 />}
          label="รายงาน"
          isActive={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
        />
        <NavButton
          icon={<SettingsIcon />}
          label="ตั้งค่า"
          isActive={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        />
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
}: {
  showToast: (m: string, t?: string) => void;
  onAddTrip: (t: Trip) => void;
  employeeName: string;
  onNameChange: (n: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState<number | string>(0);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [destPoint, setDestPoint] = useState<[number, number] | null>(null);
  const [vehicle, setVehicle] = useState<"car" | "pickup" | "motorcycle">("car");
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
        // fallback to mock
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomersFromSheet();
  }, []);

  useEffect(() => {
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
  }, [mapInstance]);

  useEffect(() => {
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
        () => {
          console.warn("GPS Auto-fetch denied");
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance]);

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
    if (!dist || !prov) return;
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
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
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
          if (startPoint) {
            calculateRouteTo(lat, lon, startPoint);
          } else {
            showToast('📍 เจอพิกัดร้านแล้ว! กด "รีเฟรช GPS" เพื่อคำนวณระยะทางได้เลย');
          }
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
              if (destPoint) {
                showToast("จุดเริ่มต้นพร้อม! กำลังลากเส้นทางไปร้านค้า...");
                calculateRouteTo(destPoint[0], destPoint[1], latlng);
              } else {
                showToast("เริ่มจับ GPS! เลือกร้านค้าเพื่อคำนวณเส้นทาง");
                mapInstance.setView(latlng, 15);
              }
            }
          },
          () => showToast("กรุณาเปิด GPS ด้วยนะเพื่อน", "error")
        );
      } else {
        showToast("Browser ไม่รองรับ GPS", "error");
      }
    } else {
      setIsTracking(false);
      showToast("จบการเดินทางเรียบร้อย");
    }
  };

  const currentExpense = (parseFloat(distance.toString()) * vehicleRates[vehicle].rate).toFixed(2);

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

  const handleSave = () => {
    if (!employeeName.trim()) {
      showToast("อย่าลืมกรอกชื่อ-นามสกุล ก่อนเซฟนะเพื่อน!", "error");
      return;
    }
    if (!formData.place) {
      showToast("เลือกร้านค้าก่อนนะเพื่อน!", "error");
      return;
    }
    const newTrip: Trip = {
      id: "T-" + Math.floor(1000 + Math.random() * 9000),
      date: formData.date,
      employeeName,
      place: formData.place,
      timeIn: formData.timeIn,
      timeOut: formData.timeOut,
      dist: distance,
      cost: currentExpense,
      status: "รออนุมัติ",
    };
    onAddTrip(newTrip);
    showToast("บันทึกข้อมูลเรียบร้อย (อัปเดตในหน้ารายงานแล้ว!)");
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
    setIsTracking(false);
    setStartPoint(null);
    setDestPoint(null);
    if (routeLayerRef.current && mapInstance) mapInstance.removeLayer(routeLayerRef.current);
    if (destMarkerRef.current && mapInstance) mapInstance.removeLayer(destMarkerRef.current);
    if (startMarkerRef.current && mapInstance) mapInstance.removeLayer(startMarkerRef.current);
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
      {/* MAP & TRACKING */}
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
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{distance} km</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl">
            <p className="text-xs text-gray-600 dark:text-gray-300">ค่าเดินทาง (โดยประมาณ)</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">฿{currentExpense}</p>
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
            {showSuggestions && displaySuggestions.length === 0 && formData.place.length > 0 && (
              <div className="absolute z-20 mt-1 left-0 right-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl p-3 text-sm text-gray-500">
                ไม่พบข้อมูลในระบบ (สามารถพิมพ์ชื่อร้านใหม่เพื่อบันทึกได้เลย)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">จังหวัด (Auto)</label>
              <input
                type="text"
                value={formData.prov}
                readOnly
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">อำเภอ (Auto)</label>
              <input
                type="text"
                value={formData.dist}
                readOnly
                className="w-full p-3 rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300"
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
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Camera className="mx-auto text-gray-400" size={32} />
              <p className="text-sm mt-2 font-medium">แตะเพื่อถ่ายรูป หรือเลือกไฟล์</p>
              <p className="text-xs text-gray-500">อัปโหลดได้หลายรูป (JPG, PNG)</p>
            </label>
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {formData.images.map((imgSrc, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={imgSrc}
                      alt={`upload-${index}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
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
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
          >
            <Save size={18} /> บันทึกและส่งเบิก{" "}
            {formData.images.length > 0 && `(พร้อม ${formData.images.length} รูป)`}
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
  lineToken,
  lineTarget,
}: {
  trips: Trip[];
  employeeName: string;
  showToast: (m: string, t?: string) => void;
  lineToken: string;
  lineTarget: string;
}) {
  const sendLine = useServerFn(sendLineMessage);
  const [sending, setSending] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTrips = trips.filter((t) => t.date === todayStr);
  const todayDist = todayTrips.reduce((s, t) => s + parseFloat((t.dist as any) || 0), 0).toFixed(1);
  const todayCost = todayTrips
    .reduce((s, t) => s + parseFloat((t.cost as any) || 0), 0)
    .toLocaleString();
  const totalDist = trips.reduce((s, t) => s + parseFloat((t.dist as any) || 0), 0).toFixed(1);
  const totalCost = trips
    .reduce((s, t) => s + parseFloat((t.cost as any) || 0), 0)
    .toLocaleString();

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
    const sortedTrips = [...todayTrips].reverse();
    sortedTrips.forEach((t, i) => {
      const tIn = t.timeIn || "-";
      const tOut = t.timeOut || "-";
      text += `${i + 1}. ${t.place} (${tIn} ถึง ${tOut})\n`;
    });
    return text;
  };

  const handleSendLineNotify = async () => {
    if (todayTrips.length === 0) {
      showToast("วันนี้ยังไม่ได้ลงงานเลยเพื่อน จะส่งอะไรล่ะ 555", "error");
      return;
    }
    if (!lineToken) {
      showToast("ยังไม่ได้ตั้งค่า LINE Access Token (ไปแท็บตั้งค่า)", "error");
      return;
    }
    setSending(true);
    try {
      await sendLine({
        data: { accessToken: lineToken, targetId: lineTarget, message: buildMessage() },
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
        <button
          onClick={handleShareLine}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
        >
          <Send size={18} /> ส่งสรุปยอดเข้า LINE
        </button>
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
          <button className="text-xs text-blue-600 hover:underline">Export Excel</button>
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
                    {trip.date} •{" "}
                    {trip.timeIn ? `${trip.timeIn} - ${trip.timeOut || "?"}` : "ไม่ได้ลงเวลา"}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-bold text-sm">{trip.dist} km</p>
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
