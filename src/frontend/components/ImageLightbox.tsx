"use client";
import { X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Foto ampliada a pantalla completa. Se dibuja en <body> (portal) para quedar siempre centrada:
 * dentro de una tarjeta con animación (transform) un "position: fixed" se ubica respecto a la
 * tarjeta y no a la pantalla, y la foto aparecía arriba y cortada.
 */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [src, onClose]);

  if (!src || typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out" }}>
      <img src={src} alt="Foto ampliada" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 32px)", objectFit: "contain", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", cursor: "default" }} />
      <button type="button" onClick={onClose} aria-label="Cerrar"
        style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", right: 12, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
    </div>,
    document.body,
  );
}
