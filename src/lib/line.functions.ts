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

/**
 * /api/notify-report equivalent (TanStack server function — this stack has no Express server).
 * ส่งรายงานผ่าน LINE Messaging API Push Message
 *  - targetType === "group"    → push ไปยัง groupId (ต้องเชิญ OA เข้ากลุ่ม และเปิด "Allow bot to join group chats")
 *  - targetType === "personal" → push ไปยัง userId (ผู้ใช้ต้องเป็นเพื่อนกับ OA)
 */
export const notifyReport = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      targetType: "group" | "personal";
      targetId: string;
      message: string;
    }) => {
      if (!input?.accessToken?.trim()) throw new Error("ยังไม่ได้ตั้งค่า Channel access token");
      if (input?.targetType !== "group" && input?.targetType !== "personal")
        throw new Error("targetType ต้องเป็น 'group' หรือ 'personal'");
      if (!input?.targetId?.trim())
        throw new Error(
          input.targetType === "group"
            ? "ยังไม่ได้ตั้งค่า Group ID"
            : "ยังไม่ได้ตั้งค่า User ID",
        );
      if (!input?.message?.trim()) throw new Error("ข้อความว่างเปล่า");
      if (input.message.length > 4900) throw new Error("ข้อความยาวเกิน 4,900 ตัวอักษร");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { accessToken, targetType, targetId, message } = data;

    // groupId ต้องขึ้นต้นด้วย "C" (หรือ "R" สำหรับ multi-person room), userId ขึ้นต้นด้วย "U"
    if (targetType === "group" && !/^[CR]/.test(targetId))
      throw new Error("Group ID ต้องขึ้นต้นด้วย C (หรือ R) — ดูได้จาก webhook event source.groupId");
    if (targetType === "personal" && !/^U/.test(targetId))
      throw new Error("User ID ต้องขึ้นต้นด้วย U — ดูได้จาก webhook event source.userId");

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // กัน push ซ้ำเมื่อ retry
        "X-Line-Retry-Key":
          typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "",
      },
      body: JSON.stringify({
        to: targetId, // ← groupId เมื่อ group, userId เมื่อ personal
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 403)
        throw new Error(
          "LINE 403: บัญชี OA ไม่มีสิทธิ์ส่ง push (ตรวจสอบว่า OA อยู่ในกลุ่ม/เป็นเพื่อน และแผนรองรับ push message)",
        );
      if (res.status === 400)
        throw new Error(`LINE 400: ปลายทางไม่ถูกต้อง (${detail.slice(0, 180)})`);
      throw new Error(`LINE Push ${res.status}: ${detail.slice(0, 200)}`);
    }
    return { ok: true, targetType };
  });
