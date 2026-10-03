import { supabase } from "@/integrations/supabase/client";

export type PhotoTrip = {
  id: string;
  date: string;
  employeeName: string;
  place: string;
  district?: string | null;
  images?: string[] | null;
};

export async function prepareLinePhotos(rows: PhotoTrip[]) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const photos: { title: string; subtitle?: string; url: string }[] = [];

  for (const row of rows.slice(0, 40)) {
    try {
      const image = Array.isArray(row.images)
        ? row.images.find((value) => typeof value === "string" && value)
        : null;
      if (!image) continue;

      let url: string | null = null;
      if (/^https:\/\//.test(image)) {
        url = image;
      } else if (image.startsWith("data:image/") && uid) {
        const blob = await (await fetch(image)).blob();
        const path = `${uid}/${row.id}-0.jpg`;
        const upload = await supabase.storage
          .from("trip-photos")
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (upload.error && !/exist|duplicate/i.test(upload.error.message)) continue;
        const signed = await supabase.storage
          .from("trip-photos")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        url = signed.data?.signedUrl ?? null;
      }

      if (!url) continue;
      photos.push({
        title: row.place,
        subtitle: [row.date, row.employeeName, row.district].filter(Boolean).join(" · "),
        url,
      });
    } catch {
      // รูปหนึ่งมีปัญหาต้องไม่ทำให้รายงานทั้งชุดส่งไม่ได้
    }
  }
  return photos;
}

export async function prepareShareFiles(rows: PhotoTrip[], limit = 10) {
  const files: File[] = [];
  for (const row of rows) {
    const image = Array.isArray(row.images)
      ? row.images.find((value) => typeof value === "string" && value)
      : null;
    if (!image) continue;
    try {
      const blob = await (await fetch(image)).blob();
      if (!blob.type.startsWith("image/")) continue;
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      files.push(new File([blob], `checkin-${row.date}-${files.length + 1}.${extension}`, { type: blob.type }));
      if (files.length >= limit) break;
    } catch {
      // ข้ามรูปที่อ่านไม่ได้ และยังแชร์ข้อความต่อได้
    }
  }
  return files;
}