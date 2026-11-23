"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { toastStore, dismissToast, type ToastItem, type ToastKind } from "@/frontend/lib/toast";

const COLOR: Record<ToastKind, string> = { success: "#10b981", error: "#dc2626", warning: "#f59e0b", info: "#0e7c86" };
const ICON: Record<ToastKind, React.ReactNode> = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  error: <><path d="M12 7v6" /><path d="M12 17h.01" /></>,
  warning: <><path d="M12 8v5" /><path d="M12 16.5h.01" /></>,
  info: <><path d="M12 11v6" /><path d="M12 7.5h.01" /></>,
};
// El ícono ya lo pone la tarjeta: se quita un emoji al inicio del título ("✅ Completado")
const cleanTitle = (t: string) => t.replace(/^\p{Extended_Pictographic}️?\s*/u, "");

function Toast({ t }: { t: ToastItem }) {
  const timer = useRef<number>(0);
  const left = useRef(t.duration);
  const started = useRef(0);
  const start = () => { started.current = Date.now(); timer.current = window.setTimeout(() => dismissToast(t.id), left.current); };
  const pause = () => { clearTimeout(timer.current); left.current = Math.max(800, left.current - (Date.now() - started.current)); };
  useEffect(() => { start(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const c = COLOR[t.kind];
  return (
    <div role={t.kind === "error" ? "alert" : "status"} className={`rt-toast${t.leaving ? " out" : ""}`}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") pause(); }} onPointerLeave={(e) => { if (e.pointerType !== "touch") start(); }}>
      <span className="rt-toast-ic" style={{ color: c, background: `${c}1a` }} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">{ICON[t.kind]}</svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title && <div className="rt-toast-t">{cleanTitle(t.title)}</div>}
        {t.description && <div className="rt-toast-d">{t.description}</div>}
      </div>
      <button type="button" className="rt-toast-x" onClick={() => dismissToast(t.id)} aria-label="Cerrar aviso">✕</button>
    </div>
  );
}

/** Tarjetas de aviso: debajo de la campana en computadora, a todo el ancho bajo el encabezado en celular */
export function Toaster() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => toastStore.empty);
  return (
    <div className="rt-toasts" aria-live="polite">
      <style>{`
        .rt-toasts { position: fixed; top: calc(68px + env(safe-area-inset-top, 0px)); right: 20px; z-index: 3000; width: min(360px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
        .rt-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 11px; padding: 11px 10px 11px 13px; background: #fff; border: 1px solid #dbe2ee; border-radius: 11px; box-shadow: 0 12px 32px rgba(15,23,42,.16), 0 2px 6px rgba(15,23,42,.06); color: #1e2a3a; font-family: inherit; transition: opacity .22s cubic-bezier(.23,1,.32,1), transform .22s cubic-bezier(.23,1,.32,1); }
        @starting-style { .rt-toast { opacity: 0; transform: translateX(24px); } }
        .rt-toast.out { opacity: 0; transform: translateX(24px); }
        .rt-toast-ic { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rt-toast-t { font-size: 13.5px; font-weight: 800; line-height: 1.35; margin-top: 3px; overflow-wrap: anywhere; }
        .rt-toast-d { font-size: 12.5px; color: #5a6a80; line-height: 1.45; margin-top: 2px; overflow-wrap: anywhere; }
        .rt-toast-x { width: 24px; height: 24px; border: none; background: transparent; color: #5a6a80; border-radius: 6px; cursor: pointer; font-size: 11px; flex-shrink: 0; }
        @media (hover: hover) and (pointer: fine) { .rt-toast-x:hover { background: #f1f5f9; color: #475569; filter: none !important; } }
        @media (max-width: 640px) {
          .rt-toasts { top: calc(64px + env(safe-area-inset-top, 0px)); left: 12px; right: 12px; width: auto; }
          @starting-style { .rt-toast { opacity: 0; transform: translateY(-12px); } }
          .rt-toast.out { transform: translateY(-12px); }
        }
        @media print { .rt-toasts { display: none; } }
      `}</style>
      {items.map((t) => <Toast key={t.id} t={t} />)}
    </div>
  );
}
