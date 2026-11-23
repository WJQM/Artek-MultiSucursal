"use client";
import { CircleCheck, Megaphone, Search, TriangleAlert, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useState } from "react";
import { ImageLightbox } from "@/frontend/components/ImageLightbox";
import { pressKey } from "@/frontend/lib/a11y";

/** Informe técnico que ve el cliente: lo que el técnico publicó para él, con fotos y su nombre (garantía). */
const TYPES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  hallazgo: { label: "Hallazgo", icon: <Search size={14} strokeWidth={STROKE} aria-hidden="true" />, color: "#0e7490" },
  avance: { label: "Avance", icon: <Wrench size={14} strokeWidth={STROKE} aria-hidden="true" />, color: "#2563eb" },
  problema: { label: "Aviso", icon: <TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" />, color: "#b45309" },
  final: { label: "Informe final", icon: <CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" />, color: "#047857" },
  novedad: { label: "Novedad", icon: <Megaphone size={14} strokeWidth={STROKE} aria-hidden="true" />, color: "#0ea5e9" },
};

export interface ClientReportEntry { id: string; type: string; text: string; images: string[]; authorName: string; createdAt: string; status?: string | null }

const STAGE: Record<string, string> = { diagnosed: "Diagnóstico", waiting_parts: "Esperando repuestos", in_progress: "En progreso", completed: "Completado", delivered: "Entregado" };

export function ClientReport({ entries, title = "Informe técnico", compact = false }: { entries: ClientReportEntry[]; title?: string; compact?: boolean }) {
  const [viewer, setViewer] = useState<string | null>(null);
  if (!entries?.length) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-BO", { hourCycle: "h23", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: compact ? "12px 14px" : "16px 18px", marginBottom: 12, border: "1px solid var(--border-soft)", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        {title}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{entries.length} {entries.length === 1 ? "registro" : "registros"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entries.map((e, i) => {
          const t = TYPES[e.type] || TYPES.avance;
          const last = i === entries.length - 1;
          return (
            <div key={e.id} style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${t.color}18`, border: `2px solid ${t.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: t.color }}>{t.icon}</div>
                {!last && <div style={{ flex: 1, width: 2, background: "var(--border-soft)", marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 4 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: t.color }}>{t.label}</span>
                  {e.status && STAGE[e.status] && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-hover)", padding: "1px 7px", borderRadius: 99 }}>{STAGE[e.status]}</span>}
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{fmt(e.createdAt)}</span>
                </div>
                {e.text && e.text !== "(solo fotos)" && <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.5, marginTop: 3, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.text}</div>}
                {e.images?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6, marginTop: 8 }}>
                    {e.images.map((src) => (
                      <img role="button" tabIndex={0} onKeyDown={pressKey} key={src} src={src} alt="Foto de la reparación" onClick={() => setViewer(src)} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-soft)", cursor: "zoom-in" }} />
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Atendido por: <strong style={{ color: "var(--text-secondary)" }}>{e.authorName}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
      <ImageLightbox src={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
