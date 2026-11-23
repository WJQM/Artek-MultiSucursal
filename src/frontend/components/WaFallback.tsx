"use client";
import { MessageCircle, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Cuando el WhatsApp no sale desde el número del taller (WasenderApi), se ofrece enviarlo desde el WhatsApp de este equipo.
export default function WaFallback({ link, onClose }: { link: string | null; onClose: () => void }) {
  if (!link) return null;
  return (
    <div className="rt-pop" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 160, width: "min(420px, calc(100vw - 24px))", background: "#fff", border: "1.5px solid var(--ok-line)", borderRadius: 14, boxShadow: "0 12px 40px rgba(26,29,46,0.25)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 22 }}><MessageCircle size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-secondary)" }}><b style={{ color: "var(--ok)" }}>Envíalo desde tu WhatsApp</b><br />El mensaje ya está escrito.</div>
      <a href={link} target="_blank" rel="noopener noreferrer" onClick={onClose} style={{ padding: "9px 12px", background: "var(--ok)", borderRadius: 10, color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Abrir WhatsApp</a>
      <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}><X size={16} strokeWidth={STROKE} aria-hidden="true" /></button>
    </div>
  );
}
