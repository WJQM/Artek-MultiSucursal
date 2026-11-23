"use client";
import { CircleCheck, MapPin } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { Turnstile } from "@/frontend/components/Turnstile";

/** Portal público: reservar una cita (sucursal → día → hora → datos). */

interface Branch { id: string; name: string; address: string | null }
interface Day { date: string; weekday: number; label: string; slots: { time: string; free: boolean }[] }
const SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function ReservarPage() {
  const [company, setCompany] = useState<{ companyName?: string; logo?: string | null }>({});
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [branch, setBranch] = useState("");
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [f, setF] = useState({ clientName: "", clientPhone: "", device: "", issue: "" });
  const [captcha, setCaptcha] = useState("");
  const [captchaOn, setCaptchaOn] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; when: string; whatsapp: boolean; manage: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCompany(d)).catch(() => {});
    fetch("/api/appointments/public").then((r) => r.json()).then((d) => {
      setBranches(d.branches || []);
      if (d.branches?.length === 1) setBranch(d.branches[0].id);
    }).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!branch) return;
    setDays(null); setDate(""); setTime("");
    fetch(`/api/appointments/public?branchId=${encodeURIComponent(branch)}`).then((r) => r.json()).then((d) => {
      setDays(d.days || []);
      if (d.days?.length) setDate(d.days[0].date);
    }).catch(() => setDays([]));
  }, [branch]);

  const day = days?.find((d) => d.date === date);
  const submit = async () => {
    setError("");
    if (!time) { setError("Elige una hora"); return; }
    if (f.clientName.trim().length < 2 || f.clientPhone.replace(/\D/g, "").length < 8 || f.device.trim().length < 2) { setError("Completa tu nombre, celular y equipo"); return; }
    if (captchaOn && !captcha) { setError("Completa la verificación anti-robots"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/appointments/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: branch, date, time, ...f, captchaToken: captcha }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "No se pudo reservar");
        setCaptchaKey((k) => k + 1); setCaptcha("");
        if (d.code === "SLOT_TAKEN") { setTime(""); fetch(`/api/appointments/public?branchId=${encodeURIComponent(branch)}`).then((x) => x.json()).then((x) => setDays(x.days || [])).catch(() => {}); }
        return;
      }
      setDone(d);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Sin conexión"); } finally { setBusy(false); }
  };

  const bName = branches?.find((b) => b.id === branch);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "inherit" }}>
      <div style={{ background: "var(--brand-dark)", color: "#fff", padding: "14px 16px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/portal" style={{ color: "#fff", textDecoration: "none", fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "-10px -6px -10px -14px" }} aria-label="Volver al portal">←</a>
          {company.logo && <img src={company.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover" }} />}
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Reservar cita{company.companyName ? ` · ${company.companyName}` : ""}</h1>
        </div>
      </div>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {done ? (
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 44 }}><CircleCheck size={44} strokeWidth={1.5} aria-hidden="true" /></div>
            <div style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}>¡Cita reservada!</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{done.when}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{bName?.name}{bName?.address ? ` · ${bName.address}` : ""}</div>
            <div style={{ fontSize: 13, marginTop: 12 }}>Código: <b>{done.code}</b></div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>{done.whatsapp ? "Te enviamos la confirmación por WhatsApp. El día de la cita te llegará un recordatorio." : "Guarda este código. Si no puedes venir, cancela con el botón de abajo."}</div>
            <a href={done.manage} style={{ ...btnO, display: "block", marginTop: 14, textDecoration: "none" }}>Ver o cancelar mi cita</a>
            <a href="/portal" style={{ ...btnP, display: "block", marginTop: 8, textDecoration: "none" }}>Volver al portal</a>
          </div>
        ) : branches && !branches.length ? (
          <div style={{ ...card, textAlign: "center", color: "var(--text-muted)" }}>Por ahora no hay reservas en línea. Escríbenos por WhatsApp o visítanos.</div>
        ) : (
          <>
            {branches && branches.length > 1 && (
              <div style={card}>
                <div style={lbl}>1 · Sucursal</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {branches.map((b) => (
                    <button key={b.id} onClick={() => setBranch(b.id)} style={chip(branch === b.id)}>
                      <MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> {b.name}{b.address ? <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, opacity: 0.8 }}>{b.address}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {branch && (
              <div style={card}>
                <div style={lbl}>{branches && branches.length > 1 ? "2" : "1"} · Día</div>
                {!days ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Cargando horarios…</div> : !days.length ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay horarios libres en los próximos días.</div> : (
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                    {days.map((d) => (
                      <button key={d.date} onClick={() => { setDate(d.date); setTime(""); }} style={{ ...chip(date === d.date), minWidth: 58, textAlign: "center", flexShrink: 0, opacity: d.slots.some((s) => s.free) ? 1 : 0.4 }}>
                        {SHORT[d.weekday]}<span style={{ display: "block", fontSize: 16 }}>{+d.date.slice(8)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {day && (
              <div style={card}>
                <div style={lbl}>{branches && branches.length > 1 ? "3" : "2"} · Hora · {day.label}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {day.slots.map((s) => (
                    <button key={s.time} disabled={!s.free} onClick={() => setTime(s.time)} style={{ ...chip(time === s.time), minWidth: 66, textAlign: "center", opacity: s.free ? 1 : 0.35, textDecoration: s.free ? "none" : "line-through", cursor: s.free ? "pointer" : "not-allowed" }}>{s.time}</button>
                  ))}
                </div>
                {!day.slots.some((s) => s.free) && <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 8 }}>Ese día ya está lleno. Elige otro.</div>}
              </div>
            )}
            {time && (
              <div style={card}>
                <div style={lbl}>{branches && branches.length > 1 ? "4" : "3"} · Tus datos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input aria-label="Tu nombre" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Tu nombre" autoComplete="name" style={inp} />
                  <input aria-label="Celular (WhatsApp)" value={f.clientPhone} onChange={(e) => setF({ ...f, clientPhone: e.target.value })} placeholder="Celular (WhatsApp)" inputMode="tel" autoComplete="tel" style={inp} />
                  <input aria-label="Equipo" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })} placeholder="Equipo (ej. Celular Samsung A52)" style={inp} />
                  <textarea aria-label="Problema del equipo" value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} placeholder="¿Qué problema tiene? (opcional)" rows={2} maxLength={300} style={{ ...inp, resize: "vertical" }} />
                  <Turnstile onToken={setCaptcha} onEnabled={setCaptchaOn} resetKey={captchaKey} />
                </div>
              </div>
            )}
            {error && <div role="alert" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--danger-bg)", border: "1px solid var(--danger-line)", color: "var(--danger)", fontSize: 13 }}>{error}</div>}
            {time && (
              <button disabled={busy} onClick={submit} style={{ ...btnP, fontSize: 14.5, padding: 14 }}>
                {busy ? "Reservando…" : `Confirmar cita · ${day ? `${SHORT[day.weekday]} ${+day.date.slice(8)}` : ""}, ${time}`}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14 };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 10 };
const inp: React.CSSProperties = { width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", fontFamily: "inherit", background: "#fff", color: "#1e2a3a" };
const btnP: React.CSSProperties = { padding: 12, borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", textAlign: "center" };
const btnO: React.CSSProperties = { padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13.5, cursor: "pointer", textAlign: "center" };
const chip = (on: boolean): React.CSSProperties => ({ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${on ? "var(--accent-dim)" : "#cbd5e1"}`, background: on ? "var(--accent-bg-soft)" : "#fff", color: on ? "var(--accent)" : "#1e2a3a", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left" });
