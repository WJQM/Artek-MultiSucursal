"use client";
import { MessageCircle, User } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";

interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedByName: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#b45309" },
  diagnosed: { label: "Diagnosticado", color: "#0e7490" },
  waiting_parts: { label: "Esperando Repuestos", color: "#c2410c" },
  in_progress: { label: "En Progreso", color: "#2563eb" },
  completed: { label: "Completado", color: "#047857" },
  delivered: { label: "Entregado", color: "#5a6a80" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-BO", { hourCycle: "h23", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `hace ${days}d`;
  if (hours > 0) return `hace ${hours}h`;
  if (mins > 0) return `hace ${mins}min`;
  return "hace un momento";
}

export function StatusTimeline({ repairId }: { repairId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    apiFetch(`/api/repairs/${repairId}/history`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setHistory(data.history || []); })
      .catch(() => setError("No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  }, [repairId]);

  if (loading) {
    return (
      <div aria-label="Cargando historial" style={{ padding: "10px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="skeleton" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}><div className="skeleton" style={{ height: 10, width: `${60 - i * 12}%`, marginBottom: 5 }} /><div className="skeleton" style={{ height: 9, width: "30%" }} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: "12px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>{error}</div>;
  }
  if (history.length === 0) {
    return <div style={{ padding: "12px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Sin cambios registrados todavía</div>;
  }

  return (
    <div>
      <div style={{ position: "relative", paddingLeft: 18 }}>
        {/* Línea vertical */}
        <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
        {history.map((h, idx) => {
          const toMeta = STATUS_META[h.toStatus] || { label: h.toStatus, color: "#5a6a80", icon: "•" };
          const fromMeta = h.fromStatus ? (STATUS_META[h.fromStatus] || { label: h.fromStatus, color: "#5a6a80", icon: "•" }) : null;
          const isLast = idx === history.length - 1;
          return (
            <div key={h.id} style={{ position: "relative", paddingBottom: isLast ? 0 : 12 }}>
              {/* Punto en la línea */}
              <div style={{ position: "absolute", left: -18, top: 2, width: 12, height: 12, borderRadius: "50%", background: toMeta.color, border: "2px solid var(--bg-card)", boxShadow: `0 0 0 2px ${toMeta.color}30` }} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {fromMeta ? (
                    <>
                      <span style={{ color: fromMeta.color, opacity: 0.7 }}>{fromMeta.label}</span>
                      <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>→</span>
                      <span style={{ color: toMeta.color, fontWeight: 700 }}>{toMeta.label}</span>
                    </>
                  ) : (
                    <span style={{ color: toMeta.color, fontWeight: 700 }}>{toMeta.label}</span>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {h.changedByName && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <User size={14} strokeWidth={STROKE} aria-hidden="true" /> <strong style={{ color: "var(--text-secondary)" }}>{h.changedByName}</strong>
                  </span>
                )}
                <span>{fmtDate(h.createdAt)}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 11, opacity: 0.7 }}>· {relativeTime(h.createdAt)}</span>
              </div>
              {h.notes && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> {h.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
