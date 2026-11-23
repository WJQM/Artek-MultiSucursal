"use client";
import { Package, User } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Panel: equipos listos que el cliente todavía no recogió, con recordatorio por WhatsApp.
import { useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { waLink } from "@/frontend/components/ReceiptShare";
import { Pagination, usePaged } from "@/frontend/components/Pagination";

const PAGE_SIZE = 20;

export interface UncollectedItem {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  clientName: string | null; clientPhone: string | null; estimatedCost: number;
  readyAt: string; days: number; remindedAt: string | null; reminders: number;
}
export interface UncollectedData { items: UncollectedItem[]; abandonDays: number; warnAfter: number }

const DAY = 86_400_000;
function ago(iso: string | null) {
  if (!iso) return "Sin recordatorios";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? "Recordado hoy" : d === 1 ? "Recordado ayer" : `Recordado hace ${d} días`;
}
export function levelOf(days: number, data: Pick<UncollectedData, "warnAfter" | "abandonDays">) {
  if (days >= data.abandonDays) return { color: "#b91c1c", bg: "#fef2f2", label: "plazo vencido" };
  if (days >= data.warnAfter) return { color: "#dc2626", bg: "#fef2f2", label: "por abandonar" };
  if (days > 7) return { color: "#b45309", bg: "#fffbeb", label: "" };
  return { color: "#047857", bg: "#f0fdf4", label: "" };
}

export default function UncollectedPanel({ data, onReload, full = false }: { data: UncollectedData; onReload: () => void; full?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [fallback, setFallback] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(full);
  const { items } = data;
  // En la pestaña "Sin recoger" (full) se muestran de a 20 con paginación
  const paged = usePaged(items, PAGE_SIZE);
  if (!items.length) return null;

  const remind = async (ids: string[]) => {
    setBusy(ids.length > 1 ? "all" : ids[0]);
    try {
      const r = await apiFetch("/api/repairs/uncollected", { method: "POST", body: JSON.stringify({ ids }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo enviar" }); return; }
      const results: { id: string; sent: boolean; message: string; phone: string | null; error?: string }[] = d.results || [];
      const ok = results.filter((x) => x.sent).length;
      const fails = results.filter((x) => !x.sent);
      const fb: Record<string, string> = {};
      for (const f of fails) { const link = f.message ? waLink(f.phone, f.message) : null; if (link) fb[f.id] = link; }
      setFallback((prev) => ({ ...prev, ...fb }));
      if (ok && !fails.length) sileo.success({ title: ok === 1 ? "Recordatorio enviado por WhatsApp" : `${ok} recordatorios enviados` });
      else if (ok) sileo.warning({ title: `${ok} enviados, ${fails.length} no se pudieron`, description: "Usa “Abrir WhatsApp” en los que faltan" });
      else sileo.warning({ title: "No se pudo enviar desde el número del taller", description: "Usa “Abrir WhatsApp” para enviarlo tú" });
      onReload();
    } finally { setBusy(null); }
  };

  const shown = full ? paged.items : showAll ? items : items.slice(0, 5);
  const urgent = items.filter((i) => i.days >= data.warnAfter).length;

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px", background: "#fff", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}><Package size={14} strokeWidth={STROKE} aria-hidden="true" /> Listos, esperando ser recogidos <span style={{ fontSize: 12, color: "#c2410c", background: "#ffedd5", padding: "2px 8px", borderRadius: 999, marginLeft: 4 }}>{items.length}</span></div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Completados que el cliente aún no recogió · tus términos dicen {data.abandonDays} días{urgent ? ` · ${urgent} por abandonar` : ""}</div>
        </div>
        {items.length > 1 && (
          <button type="button" className="ui-btn ui-btn-secondary" disabled={!!busy} onClick={() => remind(items.map((i) => i.id))} style={{ cursor: busy ? "wait" : "pointer", whiteSpace: "normal", maxWidth: "100%", textAlign: "center", lineHeight: 1.25 }}>
            {busy === "all" ? "Enviando…" : `Recordar a todos por WhatsApp (${items.length})`}
          </button>
        )}
      </div>
      {shown.map((i) => {
        const lv = levelOf(i.days, data);
        const pct = Math.min(100, Math.round((i.days / Math.max(1, data.abandonDays)) * 100));
        return (
          <div key={i.id} className="unc-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderTop: "1px solid var(--bg-hover)", flexWrap: "wrap" }}>
            <span className="rp-code">{i.code}</span>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[i.device, i.brand, i.model].filter(Boolean).join(" ")}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}><User size={14} strokeWidth={STROKE} aria-hidden="true" /> {i.clientName || "Sin nombre"}{i.estimatedCost > 0 ? ` · Bs. ${Math.round(i.estimatedCost)}` : ""}</div>
            </div>
            <div className="unc-ago" style={{ width: 140, fontSize: 11.5, color: "var(--text-muted)" }}>{ago(i.remindedAt)}{i.reminders > 1 ? ` (${i.reminders})` : ""}</div>
            <div className="unc-bar" style={{ width: 170 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: lv.color }}><span>{i.days === 1 ? "1 día" : `${i.days} días`}</span><span>{lv.label}</span></div>
              <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 4, marginTop: 5 }}><div style={{ height: 6, width: `${Math.max(3, pct)}%`, background: lv.color, borderRadius: 4 }} /></div>
            </div>
            {fallback[i.id] ? (
              <a href={fallback[i.id]} target="_blank" rel="noopener noreferrer" onClick={() => setFallback((p) => { const n = { ...p }; delete n[i.id]; return n; })} style={{ padding: "7px 12px", background: "var(--ok-bg)", border: "1px dashed var(--ok-line)", borderRadius: 9, color: "var(--ok)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir WhatsApp</a>
            ) : (
              <button type="button" className="ui-btn ui-btn-secondary" disabled={!!busy || !i.clientPhone} title={i.clientPhone ? "" : "Sin celular"} onClick={() => remind([i.id])} style={{ minHeight: 34, fontSize: 13, opacity: i.clientPhone ? 1 : 0.5, cursor: busy ? "wait" : "pointer" }}>
                {busy === i.id ? "Enviando…" : "Recordar"}
              </button>
            )}
          </div>
        );
      })}
      {full && <div style={{ paddingBottom: 16 }}><Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></div>}
      {!full && items.length > 5 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} style={{ width: "100%", padding: 10, border: "none", borderTop: "1px solid var(--bg-hover)", background: "var(--bg-tertiary)", color: "var(--accent-dim)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          {showAll ? "Ver menos" : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}
