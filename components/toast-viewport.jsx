
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, X, AlertCircle } from "lucide-react";

const TYPE_STYLES = {
  success: {
    container: "bg-[#eaf3e6] border border-[#d9e7d2] text-[#356635]",
    icon: <CheckCircle2 className="w-5 h-5 text-[#356635]" />,
    label: "Éxito",
  },
  error: {
    container: "bg-[#ffe9e3] border border-[#ffd3c8] text-[#7a200f]",
    icon: <AlertCircle className="w-5 h-5 text-[#E94E1B]" />,
    label: "Error",
  },
  warning: {
    container: "bg-[#FFF3E6] border border-[#FFE3C4] text-[#7a4a05]",
    icon: <AlertTriangle className="w-5 h-5 text-[#F7931E]" />,
    label: "Aviso",
  },
  info: {
    container: "bg-[#E6F3F6] border border-[#cde6eb] text-[#004E66]",
    icon: <Info className="w-5 h-5 text-[#018B9C]" />,
    label: "Info",
  },
};

let OWNER_ID_SEQ = 0;

export default function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  const [activeOwner, setActiveOwner] = useState(false);
  const ownerIdRef = useRef(++OWNER_ID_SEQ);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ensure singleton listener/renderer to avoid duplicate stacks if rendered in multiple places.
    if (window.__sapfToastOwnerId && window.__sapfToastOwnerId !== ownerIdRef.current) {
      // Another instance already mounted as owner; don't attach handlers or render.
      return;
    }

    window.__sapfToastOwnerId = ownerIdRef.current;
    setActiveOwner(true);
    console.debug("[ToastViewport] mounted as owner", ownerIdRef.current);

    function handleToastEvent(e) {
      try {
        const detail = e?.detail || {};
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const type = ["success", "error", "warning", "info"].includes(detail.type) ? detail.type : "info";
        const duration = Number.isFinite(detail.duration) ? detail.duration : 4000;
        const message = String(detail.message || "").trim();
        const title = String(detail.title || TYPE_STYLES[type].label);
        if (!message) return;

        setToasts((prev) => [...prev, { id, type, title, message, duration }]);
        // Minimal debugging log to validate runtime behavior.
        console.debug("[ToastViewport] event received", { type, title, message, duration });

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      } catch (err) {
        console.warn("[ToastViewport] handleToastEvent error", err?.message || err);
      }
    }

    window.addEventListener("sapf:toast", handleToastEvent);

    return () => {
      if (window.__sapfToastOwnerId === ownerIdRef.current) {
        delete window.__sapfToastOwnerId;
      }
      window.removeEventListener("sapf:toast", handleToastEvent);
    };
  }, []);

  if (!activeOwner) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-3 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            className={`w-full sm:w-auto max-w-[92vw] md:max-w-[28rem] rounded-xl shadow-lg ${s.container} transition-all`}
            role="status"
          >
            <div className="p-4 flex items-start gap-3">
              <div className="flex-shrink-0">{s.icon}</div>
              <div className="flex-1">
                <div className="font-semibold">{t.title}</div>
                <div className="text-sm leading-relaxed">{t.message}</div>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-black/5"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
