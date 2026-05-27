import { createServerFn } from "@tanstack/react-start";

export const sendLineMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; targetId: string; message: string }) => {
      if (!input?.accessToken || typeof input.accessToken !== "string")
        throw new Error("Access token ไม่ถูกต้อง");
      if (!input?.message || typeof input.message !== "string")
        throw new Error("ข้อความว่างเปล่า");
      return input;
    }
  )
  .handler(async ({ data }) => {
    const { accessToken, targetId, message } = data;

    // ถ้ามี targetId ใช้ push (Messaging API) ถ้าไม่ใช้ broadcast
    const endpoint = targetId
      ? "https://api.line.me/v2/bot/message/push"
      : "https://api.line.me/v2/bot/message/broadcast";

    const body = targetId
      ? { to: targetId, messages: [{ type: "text", text: message }] }
      : { messages: [{ type: "text", text: message }] };

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
