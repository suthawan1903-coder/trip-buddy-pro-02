/**
 * Legacy-friendly image capture helpers.
 *
 * Uses only FileReader + <img> + <canvas>, all supported since iOS 6 /
 * Android 4.4 — no getUserMedia / WebRTC. The camera itself is opened by the
 * native <input type="file" accept="image/*" capture="environment"> control.
 */

export type CapturedImage = {
  /** data URL preview, already downscaled + JPEG compressed */
  dataUrl: string;
  name: string;
  bytes: number;
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ไฟล์นี้ไม่ใช่รูปภาพ"));
    img.src = src;
  });

export type WatermarkOptions = {
  /** [lat, lng] — omitted when GPS is unavailable */
  coords?: [number, number] | null;
  /** extra line (store name, employee, …) */
  note?: string;
  /** ISO/Date to stamp; defaults to now */
  at?: Date;
  maxSide?: number;
  quality?: number;
};

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** dd/mm/yyyy HH:MM (local device time, no Intl dependency for old Android) */
export function stampTime(d = new Date()) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function stampCoords(coords?: [number, number] | null) {
  if (!coords) return "GPS: ไม่พบตำแหน่ง";
  return `GPS: ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
}

/** Native geolocation with legacy-safe options; resolves null instead of throwing. */
export function getWatermarkPosition(timeoutMs = 8000): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let done = false;
    const finish = (v: [number, number] | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

/** Draw the timestamp + GPS band at the bottom of the canvas (vanilla canvas only). */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
) {
  const fontSize = Math.max(12, Math.round(width * 0.032));
  const lineHeight = Math.round(fontSize * 1.35);
  const padding = Math.round(fontSize * 0.6);
  const bandHeight = lineHeight * lines.length + padding * 2;

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, height - bandHeight, width, bandHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, height - bandHeight + padding + i * lineHeight, width - padding * 2);
  });
}

/**
 * Downscale so old phones (and our payload size) survive 12MP photos,
 * then burn the timestamp / GPS coordinates onto the pixels.
 * Falls back to the raw data URL if canvas is unavailable.
 */
export async function compressImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.72,
  watermark?: WatermarkOptions,
): Promise<CapturedImage> {
  const raw = await readAsDataUrl(file);
  try {
    const img = await loadImage(raw);
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || maxSide) * scale));
    const height = Math.max(1, Math.round((img.height || maxSide) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, width, height);

    if (watermark) {
      const lines = [
        `🕑 ${stampTime(watermark.at ?? new Date())}`.replace("🕑 ", ""),
        stampCoords(watermark.coords),
      ];
      if (watermark.note?.trim()) lines.push(watermark.note.trim().slice(0, 60));
      drawWatermark(ctx, width, height, lines);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (!dataUrl.startsWith("data:image")) throw new Error("encode failed");
    return { dataUrl, name: file.name || "photo.jpg", bytes: Math.round((dataUrl.length * 3) / 4) };
  } catch {
    return { dataUrl: raw, name: file.name || "photo.jpg", bytes: file.size };
  }
}

export async function compressImageFiles(
  files: FileList | File[],
  maxSide?: number,
  quality?: number,
  watermark?: WatermarkOptions,
): Promise<CapturedImage[]> {
  const out: CapturedImage[] = [];
  for (const file of Array.from(files)) {
    if (file.type && file.type.indexOf("image") !== 0) continue;
    try {
      out.push(await compressImageFile(file, maxSide, quality, watermark));
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

/** Base64 data URL → Blob (old-browser safe, for multipart uploads). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta ?? "")?.[1] ?? "image/jpeg";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
