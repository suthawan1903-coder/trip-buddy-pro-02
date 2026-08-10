import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type PromptEvent = Event & { prompt: () => Promise<void> };

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("ejh-install-dismissed") === "1") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem("ejh-install-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="rounded-xl bg-secondary p-2 text-secondary-foreground">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-card-foreground">
          ติดตั้งแอพลงหน้าจอมือถือ
        </p>
        {deferred ? (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground">
              เปิดใช้งานได้เร็วขึ้น เหมือนแอพจริง
            </p>
            <button
              onClick={async () => {
                try {
                  await deferred.prompt();
                } finally {
                  close();
                }
              }}
              className="mt-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              ติดตั้งเลย
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            กดปุ่ม “แชร์” แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
          </p>
        )}
      </div>
      <button
        onClick={close}
        aria-label="ปิด"
        className="rounded-lg p-1 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
