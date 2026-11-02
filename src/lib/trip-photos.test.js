import { afterEach, describe, expect, it, mock } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "employee" } } }) },
  },
}));

const { prepareLinePhotos, prepareShareFiles } = await import("./trip-photos");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const store = { id: "store-1", date: "2026-10-03", employeeName: "Employee", place: "Store branch" };

describe("check-in report photos", () => {
  it("skips stores without photos while preserving photographed store details", async () => {
    const photos = await prepareLinePhotos([
      { ...store, images: [] },
      { ...store, id: "store-2", images: ["https://example.com/checkin.jpg"] },
    ]);
    expect(photos).toEqual([{ title: "Store branch", subtitle: "2026-10-03 · Employee", url: "https://example.com/checkin.jpg" }]);
  });

  it("prepares a photo attachment and skips unreadable images for manual sharing", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      if (String(input).includes("broken")) throw new Error("unavailable");
      return new Response(new Blob(["photo"], { type: "image/jpeg" }));
    }) as typeof fetch;
    const files = await prepareShareFiles([
      { ...store, images: ["https://example.com/broken.jpg"] },
      { ...store, images: ["https://example.com/checkin.jpg"] },
    ]);
    expect(files.length).toBe(1);
    expect(files[0]?.type).toBe("image/jpeg");
    expect(files[0]?.size).toBe(5);
  });
});