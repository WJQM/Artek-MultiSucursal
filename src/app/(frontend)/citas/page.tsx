"use client";
import { CalendarDays, Inbox, MessageCircle, Phone, Settings, Smartphone, Square, SquareCheck, User } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { sileo } from "@/frontend/lib/toast";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";

interface Appt {
  id: string; code: string; date: string; when: string; time: string; clientName: string; clientPhone: string; device: string; issue: string | null;
  status: "new" | "confirmed" | "cancelled" | "done" | "noshow"; cancelledBy: string | null; repairId: string | null; repairCode: string | null; source: string; remindedAt: string | null;
}
interface Schedule { enabled: boolean; days: Record<string, string>; slotMin: number; perSlot: number; daysAhead: number; minHours: number; dayNames: string[] }

const STATUS: Record<Appt["status"], { label: string; bg: string; fg: string }> = {
  new: { label: "Nueva", bg: "#fffbeb", fg: "#b45309" },
  confirmed: { label: "Confirmada", bg: "#f0fdf4", fg: "#047857" },
  cancelled: { label: "Cancelada", bg: "#fef2f2", fg: "#b91c1c" },
  done: { label: "Atendida", bg: "#e0f2fe", fg: "#0369a1" },
  noshow: { label: "No vino", bg: "#f1f5f9", fg: "#5a6a80" },
};
const RANGES = [
  { key: "today", label: "Hoy", offset: 0, days: 1 },
  { key: "tomorrow", label: "Mañana", offset: 1, days: 1 },
  { key: "week", label: "Próximos 7 días", offset: 0, days: 7 },
  { key: "past", label: "Últimos 7 días", offset: -7, days: 7 },
] as const;

/** Fecha local AAAA-MM-DD sumando días */
const ymd = (offset: number) => { const d = new Date(Date.now() + offset * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const wa = (p: string) => { let d = p.replace(/\D/g, ""); if (d.length === 8) d = "591" + d; return `https://wa.me/${d}`; };

export default function CitasPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("week");
  const [items, setItems] = useState<Appt[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [cfg, setCfg] = useState<Schedule | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("user");
    const u = (() => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } })();
    if (!u) { router.push("/"); return; }
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(() => {
    const r = RANGES.find((x) => x.key === range)!;
    apiFetch(`/api/appointments?from=${ymd(r.offset)}&days=${r.days}`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo cargar"); setItems([]); return; }
      setError(""); setItems(d.items);
    }).catch(() => setError("Sin conexión"));
  }, [range]);
  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { if (user) apiFetch("/api/appointments/config").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCfg(d)).catch(() => {}); }, [user]);
  useLiveRefresh(["Appointment"], () => load());

  const setStatus = async (a: Appt, status: Appt["status"], msg: string) => {
    if (status === "cancelled" && !await askConfirm(`¿Cancelar la cita de ${a.clientName}? Se le avisará por WhatsApp.`)) return;
    setBusy(a.id);
    try {
      const r = await apiFetch("/api/appointments", { method: "PATCH", body: JSON.stringify({ id: a.id, status }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo" }); return; }
      sileo.success({ title: msg, description: d.whatsapp === false ? "No se pudo avisar por WhatsApp" : undefined });
      load();
    } finally { setBusy(null); }
  };

  if (!user) return null;
  const groups = new Map<string, Appt[]>();
  for (const a of items || []) { const k = a.when.replace(/, \d{2}:\d{2}$/, ""); groups.set(k, [...(groups.get(k) || []), a]); }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        @media(max-width:600px){ .main-content{padding:64px 14px 40px!important} }
      `}</style>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Citas</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Reservas de clientes desde el portal. Confirma, y cuando el cliente llegue pulsa <b>Llegó: crear orden</b>.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCfg((v) => !v)} style={btnG}><Settings size={14} strokeWidth={STROKE} aria-hidden="true" /> Horario</button>
              <button onClick={() => setShowNew(true)} style={btnP}>＋ Anotar cita</button>
            </div>
          </div>

          {cfg && !cfg.enabled && !showCfg && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--warn-bg)", border: "1px solid var(--warn-line)", color: "#78350f", fontSize: 13, marginBottom: 14 }}>
              Las reservas en línea están <b>apagadas</b> en esta sucursal. <button onClick={() => setShowCfg(true)} style={{ border: "none", background: "none", color: "var(--warn)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Activar y elegir horario</button>
            </div>
          )}
          {showCfg && cfg && <ScheduleEditor cfg={cfg} onSaved={(c) => { setCfg(c); setShowCfg(false); }} />}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${range === r.key ? "var(--accent-dim)" : "var(--border-strong)"}`, background: range === r.key ? "var(--accent-bg-soft)" : "#fff", color: range === r.key ? "var(--accent)" : "var(--text-secondary)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{r.label}</button>
            ))}
          </div>

          {error && <div style={{ padding: 14, borderRadius: 12, background: "var(--danger-bg)", border: "1px solid var(--danger-line)", color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          {items && !items.length && !error && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "#fff", borderRadius: 14, border: "1px solid var(--border)" }}><Inbox size={14} strokeWidth={STROKE} aria-hidden="true" /> Sin citas en este período.</div>}

          {[...groups.entries()].map(([day, list]) => (
            <div key={day} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, margin: "4px 2px 8px" }}>{day}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {list.map((a) => {
                  const st = STATUS[a.status];
                  const active = a.status === "new" || a.status === "confirmed";
                  return (
                    <div key={a.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, opacity: active || a.status === "done" ? 1 : 0.65 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{a.time} · {a.clientName}</div>
                          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 3 }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> {a.device}{a.issue ? ` — ${a.issue}` : ""}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                            {a.code} · <a href={wa(a.clientPhone)} target="_blank" rel="noreferrer" style={{ color: "var(--ok)", fontWeight: 700 }}><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> {a.clientPhone.replace(/^591/, "")}</a>
                            {a.source === "staff" ? " · anotada por el personal" : ""}{a.remindedAt ? " · recordatorio enviado" : ""}{a.cancelledBy === "client" ? " · la canceló el cliente" : ""}
                          </div>
                        </div>
                        <span style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg, whiteSpace: "nowrap" }}>{a.status === "done" && a.repairCode ? a.repairCode : st.label}</span>
                      </div>
                      {active && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          <button disabled={busy === a.id} onClick={() => router.push(`/new-order?cita=${encodeURIComponent(a.id)}`)} style={{ ...btnP, flex: "2 1 180px" }}>Llegó: crear orden</button>
                          {a.status === "new" && <button disabled={busy === a.id} onClick={() => setStatus(a, "confirmed", "Cita confirmada")} style={{ ...btnG, flex: "1 1 100px", color: "var(--ok)", borderColor: "var(--ok-line)" }}>✓ Confirmar</button>}
                          <button disabled={busy === a.id} onClick={() => setStatus(a, "noshow", "Marcada: no vino")} style={{ ...btnG, flex: "1 1 90px" }}>No vino</button>
                          <button disabled={busy === a.id} onClick={() => setStatus(a, "cancelled", "Cita cancelada")} style={{ ...btnG, flex: "1 1 90px", color: "var(--danger)", borderColor: "var(--danger-line)" }}>Cancelar</button>
                        </div>
                      )}
                      {a.status === "noshow" && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button onClick={() => router.push(`/new-order?cita=${encodeURIComponent(a.id)}`)} style={{ ...btnG, fontSize: 12 }}>Llegó tarde: crear orden</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showNew && <NewAppt onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function ScheduleEditor({ cfg, onSaved }: { cfg: Schedule; onSaved: (c: Schedule) => void }) {
  const [c, setC] = useState(cfg);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/appointments/config", { method: "PUT", body: JSON.stringify(c) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      sileo.success({ title: d.enabled ? "Horario guardado · reservas activas" : "Horario guardado · reservas apagadas" });
      onSaved(d);
    } finally { setBusy(false); }
  };
  const sel = (key: keyof Schedule, opts: number[], fmt: (n: number) => string) => (
    <select value={c[key] as number} onChange={(e) => setC({ ...c, [key]: Number(e.target.value) })} style={inp}>
      {opts.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
    </select>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 10 }}>Horario de citas de esta sucursal</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} /> Recibir reservas desde el portal
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 82, fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{c.dayNames[d]}</span>
            <input aria-label={`Horario del ${c.dayNames[d]}`} value={c.days[String(d)] || ""} onChange={(e) => setC({ ...c, days: { ...c.days, [String(d)]: e.target.value } })} placeholder="Cerrado" style={{ ...inp, flex: 1 }} />
          </div>
        ))}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ej.: <code>09:00-12:00, 15:00-18:00</code>. Vacío = cerrado ese día.</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={lbl}>Cada{sel("slotMin", [15, 20, 30, 45, 60], (n) => `${n} min`)}</label>
        <label style={lbl}>Citas por turno{sel("perSlot", [1, 2, 3, 4, 5, 6, 8, 10], String)}</label>
        <label style={lbl}>Reservar hasta{sel("daysAhead", [3, 7, 14, 21, 30, 60], (n) => `${n} días`)}</label>
        <label style={lbl}>Anticipación mínima{sel("minHours", [0, 1, 2, 4, 12, 24, 48], (n) => (n ? `${n} h` : "ninguna"))}</label>
      </div>
      <button disabled={busy} onClick={save} style={btnP}>{busy ? "Guardando…" : "Guardar horario"}</button>
    </div>
  );
}

function NewAppt({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ date: ymd(0), time: "10:00", clientName: "", clientPhone: "", device: "", issue: "", notify: true });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/appointments", { method: "POST", body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      sileo.success({ title: `Cita ${d.code} anotada`, description: f.notify ? (d.whatsapp ? "Se envió la confirmación por WhatsApp" : "No se pudo enviar el WhatsApp") : undefined });
      onSaved();
    } finally { setBusy(false); }
  };
  return (
    <FormModal icon={<Phone size={18} strokeWidth={STROKE} aria-hidden="true" />} onClose={onClose} title="Anotar cita" subtitle="Por teléfono o en persona"
      footer={<>
        <button type="button" className="ox-ghost" onClick={onClose}>Cancelar</button>
        <SaveButton onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar cita"}</SaveButton>
      </>}>
      <FormSection icon={<CalendarDays size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cuándo">
        <div className="ox-row">
          <Field label="Día" required><input className="ox-input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Hora" required><input className="ox-input" type="time" value={f.time} step={300} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
      </FormSection>
      <FormSection icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente y equipo">
        <div className="ox-row">
          <Field label="Nombre" required><input className="ox-input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Nombre del cliente" /></Field>
          <Field label="Celular (WhatsApp)" required><input className="ox-input" value={f.clientPhone} onChange={(e) => setF({ ...f, clientPhone: e.target.value })} placeholder="70012345" inputMode="tel" /></Field>
          <Field label="Equipo"><input className="ox-input" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })} placeholder="Ej. Laptop HP" /></Field>
          <Field label="Problema" hint="Opcional"><input className="ox-input" value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} placeholder="¿Qué le pasa?" /></Field>
        </div>
        <button type="button" className="ox-chip" aria-pressed={f.notify} onClick={() => setF({ ...f, notify: !f.notify })} style={{ marginTop: 12 }}>
          <span className="e" aria-hidden="true">{f.notify ? <SquareCheck size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Square size={18} strokeWidth={STROKE} aria-hidden="true" />}</span>Enviar confirmación por WhatsApp
        </button>
      </FormSection>
    </FormModal>

  );
}

const btnP: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const btnG: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const inp: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 0, background: "#fff", color: "#1e2a3a" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "#5a6a80" };
