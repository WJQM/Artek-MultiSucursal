"use client";
import { Copy, MessageCircle, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Caja → "Resumen del día": tarjeta con ingresos, órdenes y pendientes, lista para enviar por WhatsApp.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { waLink } from "@/frontend/components/ReceiptShare";
import { showCopy } from "@/frontend/lib/dialog";
import { StatsSkeleton } from "@/frontend/components/Skeletons";

interface Summary {
  dateLabel: string; branchName: string | null;
  income: { repairs: number; sales: number; cash: number; total: number; qr?: number; inHand?: number }; expense: number;
  received: number; delivered: number; salesCount: number; quotesCount: number;
  pending: { ready: number; abandoning: number; inProgress: number; waitingParts: number; pending: number; quotesExpiring: number };
}

const bs = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

export default function DaySummary({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ summary: Summary; text: string; ownerPhone: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch("/api/summary").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setData(d); }).catch(() => {});
  }, []);

  const sendOwner = async () => {
    setSending(true); setFailed(false);
    try {
      const r = await apiFetch("/api/summary", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.sent) sileo.success({ title: "Resumen enviado al dueño por WhatsApp" });
      else { setFailed(true); sileo.warning({ title: d.error || "No se pudo enviar desde el número del taller", description: d.error ? undefined : "Usa “Abrir WhatsApp”" }); }
    } finally { setSending(false); }
  };
  const copy = async () => {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.text); sileo.success({ title: "Resumen copiado" }); } catch { showCopy("Copia el resumen:", data.text); }
  };

  const s = data?.summary;
  const tomorrow = s ? [
    s.pending.ready ? `${s.pending.ready} listo${s.pending.ready > 1 ? "s" : ""} sin recoger${s.pending.abandoning ? ` (${s.pending.abandoning} por abandonar)` : ""}` : "",
    s.pending.inProgress ? `${s.pending.inProgress} en trabajo` : "",
    s.pending.waitingParts ? `${s.pending.waitingParts} esperando repuesto` : "",
    s.pending.pending ? `${s.pending.pending} por revisar` : "",
    s.pending.quotesExpiring ? `${s.pending.quotesExpiring} cotización${s.pending.quotesExpiring > 1 ? "es vencen" : " vence"} mañana` : "",
  ].filter(Boolean) : [];
  const wa = data ? (data.ownerPhone ? waLink(data.ownerPhone, data.text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(data.text)}`) : null;

  const tile = (label: string, value: string | number, color: string) => (
    <div style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div aria-label="Resumen del día" data-esc role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,29,46,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="rt-pop" style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 32px)", overflowY: "auto", background: "var(--bg-primary)", borderRadius: 18, boxShadow: "0 20px 60px rgba(26,29,46,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0a0a12", color: "#eee", borderRadius: "18px 18px 0 0" }}>
          <b style={{ fontSize: 14 }}>Resumen del día</b>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", color: "#eee", fontSize: 18, cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
        {!s ? <StatsSkeleton chart={false} /> : (
          <div style={{ padding: 14 }}>
            <div style={{ background: "var(--brand-dark)", color: "#fff", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div><b style={{ fontSize: 17 }}>{s.dateLabel}</b></div>
                {s.branchName && <span style={{ fontSize: 11, opacity: 0.7, textAlign: "right" }}>{s.branchName}</span>}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>Ingresos del día</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--accent)", lineHeight: 1.1 }}>{bs(s.income.total)}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", fontSize: 11.5 }}>
                <span style={{ background: "rgba(255,255,255,.1)", padding: "4px 9px", borderRadius: 999 }}>Reparaciones {bs(s.income.repairs)}</span>
                <span style={{ background: "rgba(255,255,255,.1)", padding: "4px 9px", borderRadius: 999 }}>Ventas {bs(s.income.sales)}</span>
                {s.income.cash > 0 && <span style={{ background: "rgba(255,255,255,.1)", padding: "4px 9px", borderRadius: 999 }}>Caja {bs(s.income.cash)}</span>}
              </div>
              {(s.income.qr || 0) > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 11.5, opacity: .75 }}>En efectivo</div><b style={{ fontSize: 16 }}>{bs(s.income.inHand || 0)}</b></div>
                  <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 11.5, opacity: .75 }}>Por QR (banco)</div><b style={{ fontSize: 16 }}>{bs(s.income.qr || 0)}</b></div>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              {tile("Recibidos", s.received, "#0e7c86")}
              {tile("Entregados", s.delivered, "#047857")}
              {tile("Ventas (NV)", s.salesCount, "#2563eb")}
              {tile("Egresos", bs(s.expense), "#dc2626")}
            </div>
            {tomorrow.length > 0 && (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <b style={{ fontSize: 13 }}>Para mañana</b>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.8, marginTop: 4 }}>{tomorrow.map((t) => <div key={t}>• {t}</div>)}</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {data?.ownerPhone && !failed && (
                <button onClick={sendOwner} disabled={sending} style={{ padding: 12, background: "var(--ok)", border: "none", borderRadius: 11, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: sending ? "wait" : "pointer" }}>{sending ? "Enviando…" : "Enviar al dueño por WhatsApp"}</button>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 11, background: data?.ownerPhone && !failed ? "var(--bg-card)" : "var(--ok-bright)", border: data?.ownerPhone && !failed ? "1px solid var(--border)" : "none", borderRadius: 11, color: data?.ownerPhone && !failed ? "var(--text-secondary)" : "#fff", fontSize: 13, fontWeight: 700, textAlign: "center", textDecoration: "none" }}><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> Abrir WhatsApp</a>}
                <button onClick={copy} style={{ flex: 1, padding: 11, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 11, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Copy size={14} strokeWidth={STROKE} aria-hidden="true" /> Copiar</button>
              </div>
              {!data?.ownerPhone && <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Para que llegue solo cada noche, el Super Admin pone el celular del dueño en Configuración › Tareas automáticas.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
