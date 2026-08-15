import { createServerFn } from "@tanstack/react-start";

export const sendLineMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; channelSecret?: string; message: string }) => {
      if (!input?.accessToken || typeof input.accessToken !== "string")
        throw new Error("Channel access token ไม่ถูกต้อง");
      if (!input?.message || typeof input.message !== "string")
        throw new Error("ข้อความว่างเปล่า");
      return input;
    }
  )
  .handler(async ({ data }) => {
    const { accessToken, message } = data;
    // ใช้ broadcast เพื่อส่งถึงผู้ติดตาม OA ทุกคน (ไม่ต้องมี targetId)
    const endpoint = "https://api.line.me/v2/bot/message/broadcast";
    const body = { messages: [{ type: "text", text: message }] };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`LINE API ${res.status}: ${errText.slice(0, 200)}`);
    }
    return { ok: true };
  });

/**
 * ส่งสรุปเข้ากลุ่ม LINE
 * - โหมด "notify": LINE Notify API (Bearer token ของกลุ่มที่ผูกไว้), body เป็น x-www-form-urlencoded
 * - โหมด "push": Messaging API push ไปยัง groupId (ใช้เมื่อ LINE Notify ปิดให้บริการ)
 */
export const sendLineGroupSummary = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; message: string; groupId?: string }) => {
      if (!input?.token || typeof input.token !== "string")
        throw new Error("กรุณากรอก LINE token");
      if (!input?.message || typeof input.message !== "string" || !input.message.trim())
        throw new Error("ข้อความว่างเปล่า");
      if (input.message.length > 4900) throw new Error("ข้อความยาวเกิน 4,900 ตัวอักษร");
      return input;
    }
  )
  .handler(async ({ data }) => {
    const { token, message, groupId } = data;

    if (groupId) {
      // Messaging API → push เข้ากลุ่มโดยตรง
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: message }] }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`LINE Push ${res.status}: ${t.slice(0, 200)}`);
      }
      return { ok: true, channel: "push" as const };
    }

    // LINE Notify → ต้องเป็น application/x-www-form-urlencoded
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams({ message }).toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`LINE Notify ${res.status}: ${t.slice(0, 200)}`);
    }
    return { ok: true, channel: "notify" as const };
  });
