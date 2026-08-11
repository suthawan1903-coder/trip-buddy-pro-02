/**
 * Geo helpers: distances, radius filtering, geocoding cache and routing.
 *
 * Routing API integration (OSRM public demo server, no API key needed):
 *  1. Get the user's current position with the Geolocation API.
 *  2. Resolve the destination to coordinates (geocodeDistrict / store coords).
 *  3. Call fetchRoute() -> real driving distance (km) + duration (minutes).
 *  4. Feed distanceKm into calculateFuelCost() from "@/lib/fuel-cost".
 *  5. Draw route.coordinates on the map.
 * Swapping to Google Directions / Mapbox only requires replacing fetchRoute().
 */

export type LatLng = [number, number];

const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (straight line) distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(a: LatLng, b: LatLng, radiusKm: number): boolean {
  return haversineKm(a, b) <= radiusKm;
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  coordinates: LatLng[];
};

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round(route.duration / 60),
      coordinates: (route.geometry?.coordinates ?? []).map(
        (c: number[]) => [c[1], c[0]] as LatLng,
      ),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Geocoding with persistent cache + polite queue (Nominatim: 1 req/s)  */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "geoCacheV1";

function readCache(): Record<string, LatLng | null> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, LatLng | null>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

let queue: Promise<unknown> = Promise.resolve();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(() => wait(1100), () => wait(1100));
  return run as Promise<T>;
}

async function geocodeRaw(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

/** Cached geocode for a Thai place query. */
export async function geocodeCached(key: string, query: string): Promise<LatLng | null> {
  const cache = readCache();
  if (key in cache) return cache[key] ?? null;
  const point = await enqueue(() => geocodeRaw(query));
  const fresh = readCache();
  fresh[key] = point;
  writeCache(fresh);
  return point;
}

export function geocodeDistrict(district: string, province: string) {
  const key = `d|${province}|${district}`;
  const q = district
    ? `อำเภอ${district}, จังหวัด${province}, ประเทศไทย`
    : `จังหวัด${province}, ประเทศไทย`;
  return geocodeCached(key, q);
}

export function geocodeProvince(province: string) {
  return geocodeCached(`p|${province}`, `จังหวัด${province}, ประเทศไทย`);
}

/** Read a cached point without triggering a network call. */
export function peekGeocode(key: string): LatLng | null | undefined {
  const cache = readCache();
  return key in cache ? (cache[key] ?? null) : undefined;
}

/* ------------------------------------------------------------------ */
/* Geolocation (legacy Android / iOS friendly)                         */
/* ------------------------------------------------------------------ */

export type GeoOptions = { highAccuracy?: boolean; timeoutMs?: number };

/**
 * getCurrentPosition with a low-accuracy retry — old Android WebViews and
 * iOS Safari often time out when enableHighAccuracy is forced.
 */
export function getPosition(opts: GeoOptions = {}): Promise<GeolocationPosition> {
  const { highAccuracy = true, timeoutMs = 15000 } = opts;
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับ GPS"));
      return;
    }
    const fallback = () =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 60000,
      });
    navigator.geolocation.getCurrentPosition(resolve, () => fallback(), {
      enableHighAccuracy: highAccuracy,
      timeout: timeoutMs,
      maximumAge: 30000,
    });
  });
}

export function watchPosition(
  onUpdate: (p: LatLng, accuracy: number) => void,
  onError?: (e: GeolocationPositionError) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate([pos.coords.latitude, pos.coords.longitude], pos.coords.accuracy),
    (err) => onError?.(err),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/* ------------------------------------------------------------------ */
/* Time helpers (UTC-based automatic date)                             */
/* ------------------------------------------------------------------ */

/** Automatic date based on universal time (UTC), format YYYY-MM-DD. */
export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function utcTimeString(d: Date = new Date()): string {
  return d.toISOString().slice(11, 16);
}

/** Minutes between two "HH:MM" clock strings (handles past-midnight). */
export function minutesBetween(from: string, to: string): number | null {
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  return b >= a ? b - a : b + 1440 - a;
}

export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "-";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}
