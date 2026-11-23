"use client";
import { X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { askConfirm } from "@/frontend/lib/dialog";

/**
 * Cierre de caja: cuánto efectivo debería haber, lo que se cuenta (por billete o total) y la diferencia.
 * Lo que se deja en caja es el fondo inicial del día siguiente.
 */

interface Calc { day: string; label: string; openingFloat: number; openingFrom: string | null; cashRepairs: number; cashRepairsCount: number; cashSales: number; cashSalesCount: number; cashIn: number; cashOut: number; qrTotal: number; qrCount: number; expected: number }
interface Closing { id: string; day: string; expected: number; counted: number; difference: number; leftInCash: number; withdrawn: number; qrTotal: number; qrVerified: boolean; notes: string | null; userName: string | null; createdAt: string; denominations: string | null }
interface Data { calc: Calc; closing: Closing | null; history: Closing[]; monthDiff: number; denominations: number[]; canReopen: boolean }

const bs = (n: number) => `Bs. ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const ymd = (offset: number) => { const d = new Date(Date.now() + offset * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function CashClosing({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const [day, setDay] = useState(ymd(0));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [byBill, setByBill] = useState(true);
  const [bills, setBills] = useState<Record<string, string>>({});
  const [total, setTotal] = useState("");
  const [left, setLeft] = useState("");
  const [notes, setNotes] = useState("");
  const [qrOk, setQrOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"close" | "history">("close");

  const load = useCallback(() => {
    setData(null); setError("");
    apiFetch(`/api/cash/closing?day=${day}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo cargar"); return; }
      setData(d);
      setLeft(String(d.calc.openingFloat || ""));
    }).catch(() => setError("Sin conexión"));
  }, [day]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (typeof document === "undefined") return null;
  const counted = byBill
    ? Math.round((data?.denominations || []).reduce((a, v) => a + v * (parseInt(bills[String(v)] || "0") || 0), 0) * 100) / 100
    : Math.round((parseFloat(total) || 0) * 100) / 100;
  const hasCount = byBill ? Object.values(bills).some((v) => parseInt(v) > 0) : total.trim() !== "";
  const diff = data ? Math.round((counted - data.calc.expected) * 100) / 100 : 0;
  const leftN = Math.min(counted, Math.max(0, parseFloat(left) || 0));

  const close = async () => {
    if (!data || !hasCount) { sileo.error({ title: "Cuenta el efectivo primero" }); return; }
    if (diff !== 0 && !notes.trim() && !await askConfirm(`${diff < 0 ? "Faltan" : "Sobran"} ${bs(Math.abs(diff))}. ¿Cerrar sin escribir una nota?`)) return;
    setBusy(true);
    try {
      const r = await apiFetch("/api/cash/closing", { method: "POST", body: JSON.stringify({ day, counted, denominations: byBill ? Object.fromEntries(Object.entries(bills).map(([k, v]) => [k, parseInt(v) || 0])) : undefined, leftInCash: leftN, notes, qrVerified: qrOk }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo cerrar" }); return; }
      sileo.success({ title: "Caja cerrada", description: diff === 0 ? "Cuadra exacto" : `${diff < 0 ? "Faltan" : "Sobran"} ${bs(Math.abs(diff))}` });
      load(); onDone?.();
    } finally { setBusy(false); }
  };
  const reopen = async (c: Closing) => {
    if (!await askConfirm(`¿Reabrir la caja del ${c.day}? Se borra ese cierre para hacerlo de nuevo.`)) return;
    const r = await apiFetch(`/api/cash/closing?id=${c.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { sileo.error({ title: d.error || "No se pudo reabrir" }); return; }
    sileo.success({ title: "Caja reabierta" }); load();
  };

  const c = data?.calc;
  return createPortal(
    <div data-esc role="dialog" aria-modal="true" aria-label="Cierre de caja" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 24px)", overflowY: "auto", background: "var(--bg-primary)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 1, padding: "14px 18px", background: "var(--brand-dark)", color: "#fff", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Cierre de caja</div>
            <div style={{ fontSize: 11.5, opacity: 0.8 }}>{c ? c.label : "Cargando…"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setTab("close")} style={chip(tab === "close")}>Cerrar caja</button>
            <button onClick={() => setTab("history")} style={chip(tab === "history")}>Historial{data?.history.length ? ` (${data.history.length})` : ""}</button>
            {tab === "close" && (
              <select value={day} onChange={(e) => setDay(e.target.value)} style={{ ...inp, width: "auto", marginLeft: "auto", padding: "7px 10px" }} aria-label="Día">
                {Array.from({ length: 8 }, (_, i) => ymd(-i)).map((d, i) => <option key={d} value={d}>{i === 0 ? "Hoy" : i === 1 ? "Ayer" : d.split("-").reverse().join("/")}</option>)}
              </select>
            )}
          </div>
          {error && <div style={{ padding: 12, borderRadius: 10, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 13 }}>{error}</div>}

          {tab === "history" && data && (
            <div style={card}>
              <div style={lbl}>Últimos cierres{data.monthDiff ? ` · diferencia del mes: ${data.monthDiff < 0 ? "faltan" : "sobran"} ${bs(Math.abs(data.monthDiff))}` : ""}</div>
              {!data.history.length && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay cierres.</div>}
              {data.history.map((h) => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--bg-hover)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{h.day.split("-").reverse().join("/")} · contado {bs(h.counted)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.userName || "—"} · debía {bs(h.expected)} · se dejó {bs(h.leftInCash)}{h.notes ? ` · ${h.notes}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: h.difference === 0 ? "var(--ok)" : h.difference < 0 ? "var(--danger-bright)" : "var(--warn)", whiteSpace: "nowrap" }}>{h.difference === 0 ? "✓ Cuadra" : `${h.difference < 0 ? "−" : "+"}${bs(Math.abs(h.difference))}`}</span>
                  {data.canReopen && h.id === data.history[0]?.id && <button onClick={() => reopen(h)} style={{ ...btnO, padding: "5px 8px", fontSize: 11 }}>Reabrir</button>}
                </div>
              ))}
            </div>
          )}

          {tab === "close" && c && data?.closing && (
            <div style={{ ...card, textAlign: "center", background: data.closing.difference === 0 ? "var(--ok-bg)" : data.closing.difference < 0 ? "var(--danger-bg)" : "var(--warn-bg)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>CAJA CERRADA · {data.closing.userName}</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0", color: data.closing.difference === 0 ? "var(--ok)" : data.closing.difference < 0 ? "var(--danger)" : "var(--warn)" }}>
                {data.closing.difference === 0 ? "✓ Cuadra exacto" : `${data.closing.difference < 0 ? "Faltan" : "Sobran"} ${bs(Math.abs(data.closing.difference))}`}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Debía {bs(data.closing.expected)} · Contado {bs(data.closing.counted)}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>Se dejó {bs(data.closing.leftInCash)} · Se retiró {bs(data.closing.withdrawn)}</div>
              {data.closing.notes && <div style={{ fontSize: 12, marginTop: 6, fontStyle: "italic" }}>“{data.closing.notes}”</div>}
            </div>
          )}

          {tab === "close" && c && !data?.closing && (
            <>
              <div style={card}>
                <div style={lbl}>Lo que dice el sistema (efectivo)</div>
                <Row k={`Fondo inicial${c.openingFrom ? ` (cierre del ${c.openingFrom.split("-").reverse().join("/")})` : ""}`} v={bs(c.openingFloat)} />
                <Row k={`Entregas cobradas en efectivo (${c.cashRepairsCount})`} v={bs(c.cashRepairs)} />
                <Row k={`Ventas en efectivo (${c.cashSalesCount})`} v={bs(c.cashSales)} />
                <Row k="Otros ingresos de caja" v={bs(c.cashIn)} />
                <Row k="Gastos de caja" v={`− ${bs(c.cashOut)}`} red />
                <Row k={<b>Debería haber</b>} v={<b>{bs(c.expected)}</b>} />
                {c.qrTotal > 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Por QR ({c.qrCount}): {bs(c.qrTotal)} — va al banco, no a la caja.</div>}
              </div>

              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ ...lbl, marginBottom: 0 }}>Lo que cuentas</div>
                  <button onClick={() => setByBill(!byBill)} style={{ border: "none", background: "none", color: "var(--accent-dim)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{byBill ? "Escribir el total" : "Contar por billete"}</button>
                </div>
                {byBill ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {data!.denominations.map((v) => (
                      <label key={v} style={{ flex: "1 1 175px", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                        <span style={{ width: 58, flexShrink: 0 }}>{v >= 1 ? `Bs ${v}` : `${Math.round(v * 100)} ctv`} ×</span>
                        <input inputMode="numeric" value={bills[String(v)] || ""} onChange={(e) => setBills({ ...bills, [String(v)]: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="0" style={{ ...inp, width: 58, flexShrink: 0, textAlign: "center", padding: "7px" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{(parseInt(bills[String(v)] || "0") || 0) ? bs(v * (parseInt(bills[String(v)]) || 0)) : ""}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input aria-label="Total contado (Bs.)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Total contado (Bs.)" style={inp} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><b>Contado</b><b>{bs(counted)}</b></div>
              </div>

              {hasCount && (
                <div style={{ ...card, textAlign: "center", background: diff === 0 ? "var(--ok-bg)" : diff < 0 ? "var(--danger-bg)" : "var(--warn-bg)", borderColor: diff === 0 ? "var(--ok-line)" : diff < 0 ? "var(--danger-line)" : "var(--warn-line)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: diff === 0 ? "var(--ok)" : diff < 0 ? "var(--danger)" : "var(--warn)" }}>{diff === 0 ? "CUADRA EXACTO" : diff < 0 ? "FALTAN" : "SOBRAN"}</div>
                  {diff !== 0 && <div style={{ fontSize: 26, fontWeight: 700, color: diff < 0 ? "var(--danger)" : "var(--warn)" }}>{bs(Math.abs(diff))}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Debería: {bs(c.expected)} · Contado: {bs(counted)}</div>
                </div>
              )}

              <div style={card}>
                <div style={lbl}>Al cerrar</div>
                <label htmlFor="f-cashclosing-1" style={{ fontSize: 12, color: "var(--text-secondary)" }}>Dejar en caja para mañana (fondo)</label>
                <input id="f-cashclosing-1" inputMode="decimal" value={left} onChange={(e) => setLeft(e.target.value)} placeholder="0" style={{ ...inp, marginTop: 4 }} />
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Se retira: <b>{bs(Math.max(0, counted - leftN))}</b></div>
                <textarea aria-label="Nota del cierre" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={diff !== 0 ? "Nota: ¿por qué no cuadra? (ej. se dio cambio de más)" : "Nota (opcional)"} rows={2} maxLength={300} style={{ ...inp, marginTop: 10, resize: "vertical" }} />
                {c.qrTotal > 0 && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontWeight: 700, marginTop: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={qrOk} onChange={(e) => setQrOk(e.target.checked)} /> Revisé en el banco los pagos por QR ({bs(c.qrTotal)})
                  </label>
                )}
              </div>
              <button disabled={busy || !hasCount} onClick={close} style={{ padding: 13, borderRadius: 12, border: "none", background: hasCount ? "linear-gradient(135deg, var(--accent), var(--accent-dim))" : "var(--border-strong)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: hasCount ? "pointer" : "not-allowed" }}>{busy ? "Cerrando…" : "Cerrar caja"}</button>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Se avisa al dueño por WhatsApp/Telegram. Un día cerrado no se puede editar (el Super Admin puede reabrirlo).</div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ k, v, red }: { k: React.ReactNode; v: React.ReactNode; red?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--bg-hover)", fontSize: 13 }}><span style={{ color: "var(--text-secondary)" }}>{k}</span><span style={{ color: red ? "var(--danger-bright)" : "var(--text-primary)", whiteSpace: "nowrap" }}>{v}</span></div>;
}
const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14 };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 8 };
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", fontFamily: "inherit", background: "#fff", color: "#1e2a3a" };
const btnO: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontWeight: 700, cursor: "pointer" };
const chip = (on: boolean): React.CSSProperties => ({ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${on ? "var(--accent-dim)" : "#cbd5e1"}`, background: on ? "var(--accent-bg-soft)" : "#fff", color: on ? "var(--accent)" : "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
