import { useEffect, useState } from "react";
import { ImageOff, X } from "lucide-react";

/** รูปเช็คอินแบบย่อ + placeholder เมื่อไม่มีรูป */
export function TripThumbnails({
  images,
  onOpen,
  label,
}: {
  images: string[];
  onOpen: (images: string[], index: number) => void;
  label?: string;
}) {
  if (!images || images.length === 0) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 grid place-items-center">
        <ImageOff size={18} />
      </div>
    );
  }
  return (
    <div className="flex gap-1.5 shrink-0">
      {images.slice(0, 3).map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(images, i)}
          className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
        >
          <img
            src={src}
            alt={`รูปเช็คอิน${label ? ` ${label}` : ""} ${i + 1}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {i === 2 && images.length > 3 && (
            <span className="absolute inset-0 bg-black/55 text-white text-[11px] font-bold grid place-items-center">
              +{images.length - 2}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Popup ดูรูปขนาดใหญ่ */
export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index, images]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (images.length === 0) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/85 p-4 grid place-items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white grid place-items-center"
      >
        <X size={20} />
      </button>
      <div className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[i]}
          alt={`รูปเช็คอินขนาดใหญ่ ${i + 1}`}
          className="max-w-full max-h-[75vh] rounded-2xl object-contain"
        />
        {images.length > 1 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {images.map((src, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setI(k)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${
                  k === i ? "border-white" : "border-transparent opacity-60"
                }`}
              >
                <img src={src} alt={`ย่อ ${k + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** hook จัดการสถานะ lightbox */
export function useLightbox() {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null);
  return {
    open: (images: string[], index: number) => setState({ images, index }),
    node: state ? (
      <ImageLightbox images={state.images} index={state.index} onClose={() => setState(null)} />
    ) : null,
  };
}
