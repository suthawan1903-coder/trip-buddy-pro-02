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

/**
 * Downscale so old phones (and our payload size) survive 12MP photos.
 * Falls back to the raw data URL if canvas is unavailable.
 */
export async function compressImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.72,
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
): Promise<CapturedImage[]> {
  const out: CapturedImage[] = [];
  for (const file of Array.from(files)) {
    if (file.type && file.type.indexOf("image") !== 0) continue;
    try {
      out.push(await compressImageFile(file, maxSide, quality));
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}
