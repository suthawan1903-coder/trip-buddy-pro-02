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
