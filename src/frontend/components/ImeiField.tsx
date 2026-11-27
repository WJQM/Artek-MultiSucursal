"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";

/**
 * IMEI del celular.
 * - Gratis: revisa que el IMEI sea válido y avisa si ese equipo ya vino antes al taller.
 * - Opcional (pagado, si está configurado): "Consultar robo/bloqueo" → reporte de robo (lista negra), bloqueo de operador, iCloud.
 */

export interface ImeiCheck {
  at: string; service?: string; model?: string; carrier?: string;
  blacklist: "clean" | "blacklisted" | "unknown";
  simLock: "locked" | "unlocked" | "unknown";
  findMy: "on" | "off" | "unknown";
  details: [string, string][];
  cost?: number;
}
interface HistoryItem { id: string; code: string; device: string; issue: string; status: string; createdAt: string; branch: string; clientName: string | null }
interface Result { kind: "imei" | "imei-bad" | "serial" | "invalid"; paidAvailable: boolean; history: HistoryItem[]; others: number; check?: ImeiCheck | null }

const clean = (s: string) => s.replace(/[\s.-]/g, "").toUpperCase();
function luhn(imei: string) {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) { let d = +imei[i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
}
/** Estado del texto escrito, sin ir al servidor */
export function imeiState(raw: string): "empty" | "typing" | "ok" | "bad" | "serial" {
  const s = clean(raw);
  if (!s) return "empty";
  if (/^\d+$/.test(s)) return s.length < 15 ? "typing" : s.length === 15 && luhn(s) ? "ok" : "bad";
  return /^[A-Z0-9]{6,30}$/.test(s) ? "serial" : "bad";
}
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
const STATUS: Record<string, string> = { pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando repuestos", in_progress: "En progreso", completed: "Completado", delivered: "Entregado" };

/** Campo para el formulario (nueva orden / editar). */
export function ImeiField({ value, onChange, repairId, labelStyle, fieldStyle }: { value: string; onChange: (v: string) => void; repairId?: string; labelStyle?: React.CSSProperties; fieldStyle?: React.CSSProperties }) {
  const st = imeiState(value);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const last = useRef("");

  // Historial gratis cuando el número está completo
  useEffect(() => {
    const s = clean(value);
    if (st !== "ok" && st !== "serial") { setRes(null); last.current = ""; return; }
    if (s === last.current) return;
    const t = setTimeout(() => {
      last.current = s;
      apiFetch("/api/imei/check", { method: "POST", body: JSON.stringify({ imei: s, repairId }) })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setRes(d)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [value, st, repairId]);

  const paid = async () => {
    setBusy(true); setError("");
    try {
      const r = await apiFetch("/api/imei/check", { method: "POST", body: JSON.stringify({ imei: clean(value), paid: true, repairId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo consultar"); return; }
      setRes(d);
    } catch { setError("Sin conexión"); } finally { setBusy(false); }
  };

  const hint = st === "ok" ? { t: "✓ IMEI válido", c: "#047857" } : st === "bad" ? { t: "✗ IMEI no válido: revisa los 15 dígitos", c: "#b91c1c" } : st === "typing" ? { t: `${clean(value).length}/15 dígitos`, c: "#5a6a80" } : st === "serial" ? { t: "N° de serie", c: "#5a6a80" } : { t: "Marca *#06# en el celular para verlo", c: "#5a6a80" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor="f-imeifield-1" style={labelStyle}>IMEI / N° de serie <span style={{ fontWeight: 500, textTransform: "none" }}>(opcional)</span></label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input id="f-imeifield-1" value={value} onChange={(e) => onChange(e.target.value.slice(0, 40))} inputMode="text" autoComplete="off"
          style={{ ...fieldStyle, flex: "1 1 200px", fontFamily: "ui-monospace, monospace", letterSpacing: 0.5, borderColor: st === "bad" ? "var(--danger-bright)" : st === "ok" ? "var(--ok-bright)" : (fieldStyle?.borderColor as string | undefined) }} />
        {st === "ok" && res?.paidAvailable && !res.check && (
          <button type="button" onClick={paid} disabled={busy} style={btn}>{busy ? "Consultando…" : "Consultar robo/bloqueo"}</button>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: hint.c }}>{hint.t}</span>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-line)", borderRadius: 8, padding: "7px 10px" }}>{error}</div>}
      {res && <ImeiHistory res={res} />}
      {res?.check && <ImeiCheckCard check={res.check} />}
    </div>
  );
}

function ImeiHistory({ res }: { res: Result }) {
  if (!res.history.length && !res.others) return null;
  return (
    <div style={{ fontSize: 12, background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 10, padding: "8px 10px", color: "#78350f", lineHeight: 1.45 }}>
      <b>Este equipo ya vino antes al taller</b>
      {res.history.slice(0, 4).map((h) => (
        <div key={h.id}>• {h.code} · {fmtDate(h.createdAt)} · {STATUS[h.status] || h.status}{h.branch ? ` · ${h.branch}` : ""}{h.clientName ? ` · ${h.clientName}` : ""}{h.issue ? ` — ${h.issue.slice(0, 50)}` : ""}</div>
      ))}
      {res.others > 0 && <div>• y {res.others} vez/veces en otra sucursal</div>}
    </div>
  );
}

const chip = (ok: boolean | null, text: string) => (
  <span style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: ok === null ? "var(--bg-hover)" : ok ? "var(--ok-bg)" : "var(--danger-bg)", color: ok === null ? "var(--text-muted)" : ok ? "var(--ok)" : "var(--danger)", border: `1px solid ${ok === null ? "var(--border-soft)" : ok ? "var(--ok-line)" : "var(--danger-line)"}` }}>{text}</span>
);

/** Resultado de la consulta pagada. */
export function ImeiCheckCard({ check }: { check: ImeiCheck }) {
  const [open, setOpen] = useState(false);
  const bl = check.blacklist === "blacklisted";
  return (
    <div style={{ border: `1.5px solid ${bl ? "var(--danger-line)" : "var(--border-strong)"}`, background: bl ? "var(--danger-bg)" : "var(--bg-tertiary)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {bl && <div style={{ fontSize: 13, fontWeight: 800, color: "var(--danger)" }}>Este IMEI figura como REPORTADO (robo o pérdida). Revisa antes de recibir el equipo.</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {chip(check.blacklist === "unknown" ? null : !bl, check.blacklist === "clean" ? "✓ Sin reporte de robo" : bl ? "✗ Reportado" : "Reporte: sin dato")}
        {check.simLock !== "unknown" && chip(check.simLock === "unlocked", check.simLock === "unlocked" ? "✓ Libre" : `Bloqueado a operador${check.carrier ? ` (${check.carrier})` : ""}`)}
        {check.findMy !== "unknown" && chip(check.findMy === "off", check.findMy === "off" ? "✓ iCloud/Find My apagado" : "iCloud/Find My ACTIVO")}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
        {check.model && <b>{check.model} · </b>}Consultado el {fmtDate(check.at)}{check.service ? ` · ${check.service}` : ""}
        {check.details.length > 0 && <button type="button" onClick={() => setOpen((o) => !o)} style={{ marginLeft: 6, border: "none", background: "none", color: "var(--accent-dim)", fontWeight: 700, fontSize: 11.5, cursor: "pointer", padding: 0 }}>{open ? "Ocultar detalle" : "Ver detalle"}</button>}
      </div>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: "3px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
          {check.details.map(([k, v]) => <Fragment key={k}><span style={{ color: "var(--text-muted)", overflowWrap: "anywhere" }}>{k}</span><span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{v}</span></Fragment>)}
        </div>
      )}
    </div>
  );
}

/** En el detalle de la orden: IMEI, resultado guardado y botón de consulta. */
export function ImeiInfo({ repair }: { repair: { id: string; imei?: string | null; imeiCheck?: string | null } }) {
  const [check, setCheck] = useState<ImeiCheck | null>(() => { try { return repair.imeiCheck ? JSON.parse(repair.imeiCheck) : null; } catch { return null; } });
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imei = repair.imei || "";
  useEffect(() => {
    if (!imei) return;
    apiFetch("/api/imei/check", { method: "POST", body: JSON.stringify({ imei, repairId: repair.id }) }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setRes(d)).catch(() => {});
  }, [imei, repair.id]);
  if (!imei) return null;
  const paid = async () => {
    setBusy(true); setError("");
    try {
      const r = await apiFetch("/api/imei/check", { method: "POST", body: JSON.stringify({ imei, paid: true, repairId: repair.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo consultar"); return; }
      setRes(d); if (d.check) setCheck(d.check);
    } catch { setError("Sin conexión"); } finally { setBusy(false); }
  };
  return (
    <div style={{ padding: "10px 12px", background: "#ffffff", borderRadius: 8, border: "1px solid var(--border-soft)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>{/^\d{15}$/.test(imei) ? "IMEI" : "N° de serie"}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, fontFamily: "ui-monospace, monospace" }}>{imei}</div>
        </div>
        {!check && res?.paidAvailable && res.kind === "imei" && <button type="button" onClick={paid} disabled={busy} style={btn}>{busy ? "Consultando…" : "Consultar robo/bloqueo"}</button>}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
      {res && <ImeiHistory res={res} />}
      {check && <ImeiCheckCard check={check} />}
    </div>
  );
}

const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #0ea5e955", background: "#0ea5e910", color: "#0369a1", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };
