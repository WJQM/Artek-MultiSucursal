"use client";
import { Activity, Bot, Cloud, Mail, QrCode, Radio, Send, Smartphone, Star, TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Configuración › Tareas automáticas: copia en la nube (Cloudflare R2) y vigilancia (Healthchecks.io).
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { fmtSize } from "@/frontend/components/AutomationPanel";
import { invalidatePaymentQr } from "@/frontend/components/PaymentPicker";

interface CloudCfg { enabled: boolean; account: string; bucket: string; accessKeyId: string; keepDays: number; photos: boolean; hasSecret: boolean; ready: boolean }
interface CloudLast { at: string; ok: boolean; error?: string; dbFile?: string; dbSize?: number; photosUploaded?: number; photosTotal?: number; deleted?: number }
interface CloudList { files: { name: string; size: number; at: string }[]; photos: number; photosSize: number; totalSize: number }
interface MonCfg { backupUrl: string; aliveUrl: string }
interface MonStatus { lastAlive?: string; lastAliveOk?: boolean; lastBackupPing?: string; lastBackupPingOk?: boolean }

const card = { padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 } as const;
const label = { fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 } as const;
const small = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" } as const;
const input = { width: "100%", padding: "11px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 0 } as const;
const btnP = { padding: "10px 16px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" } as const;
const btnG = { padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" } as const;
const okBox = { display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, fontSize: 12.5, color: "#047857", fontWeight: 700, marginBottom: 14, flexWrap: "wrap" } as const;
const badBox = { padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#b91c1c", marginBottom: 14, lineHeight: 1.5 } as const;
const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginBottom: 12 } as const;

function ago(iso?: string) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return d.toDateString() === new Date().toDateString() ? `hoy ${time}` : `${d.toLocaleDateString("es-BO", { day: "numeric", month: "short" })} ${time}`;
}

function Guide({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <details style={{ marginTop: 14, fontSize: 12, color: "var(--text-secondary)" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, color: "var(--accent-dim)" }}>{title}</summary>
      <ol style={{ margin: "10px 0 0 18px", lineHeight: 1.7 }}>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </details>
  );
}

export default function CloudMonitorPanel() {
  return (<><PaymentQrCard /><MailCard /><TelegramCard /><AiCard /><ImeiCard /><GoogleReviewsCard /><CloudCard /><MonitorCard /></>);
}

export function CloudCard() {
  const [cfg, setCfg] = useState<CloudCfg | null>(null);
  const [last, setLast] = useState<CloudLast | null>(null);
  const [list, setList] = useState<CloudList | { error: string } | null>(null);
  const [form, setForm] = useState({ account: "", bucket: "", accessKeyId: "", secretAccessKey: "", keepDays: 30, photos: true });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (withList = true) => {
    const r = await apiFetch(`/api/automation/cloud${withList ? "?list=1" : ""}`);
    if (!r.ok) return;
    const d = await r.json();
    setCfg(d.config); setLast(d.last); if (withList) setList(d.list);
    setForm((f) => ({ ...f, account: d.config.account, bucket: d.config.bucket, accessKeyId: d.config.accessKeyId, keepDays: d.config.keepDays, photos: d.config.photos, secretAccessKey: "" }));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!cfg) return <div style={{ ...card, color: "var(--text-muted)", fontSize: 13 }}>Cargando copia en la nube…</div>;

  const save = async (extra: Partial<CloudCfg> = {}) => {
    setBusy("save");
    try {
      const r = await apiFetch("/api/automation/cloud", { method: "PUT", body: JSON.stringify({ ...form, ...extra }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return false; }
      setCfg(d.config); setForm((f) => ({ ...f, secretAccessKey: "" }));
      sileo.success({ title: "Guardado" });
      return true;
    } finally { setBusy(null); }
  };
  const test = async () => {
    if (!(await save())) return;
    setBusy("test");
    try {
      const d = await (await apiFetch("/api/automation/cloud", { method: "POST", body: JSON.stringify({ action: "test" }) })).json();
      if (d.ok) { sileo.success({ title: "Conexión correcta", description: "Se pudo escribir y borrar en el bucket" }); load(); }
      else sileo.error({ title: "No se pudo conectar", description: d.error });
    } finally { setBusy(null); }
  };
  const uploadNow = async () => {
    setBusy("upload");
    try {
      const r = await apiFetch("/api/automation/cloud", { method: "POST", body: JSON.stringify({ action: "upload" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) sileo.error({ title: d.error || "No se pudo subir" });
      else if (d.ok) sileo.success({ title: "Subido a la nube", description: `${d.dbFile}${d.photosUploaded ? ` · ${d.photosUploaded} fotos nuevas` : ""}` });
      else sileo.error({ title: "No se pudo subir", description: d.error });
      load();
    } finally { setBusy(null); }
  };
  const toggle = async (v: boolean) => {
    if (v && !cfg.ready) { sileo.warning({ title: "Primero completa los datos y prueba la conexión" }); return; }
    setCfg({ ...cfg, enabled: v });
    await save({ enabled: v });
  };

  const files = list && "files" in list ? list.files : [];
  return (
    <div style={card}>
      <label style={label}><Cloud size={14} strokeWidth={STROKE} aria-hidden="true" /> Copia en la nube</label>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Después de cada respaldo se sube una copia a <b>Cloudflare R2</b>. Si el servidor se daña o se pierde, tus datos siguen a salvo.
        </div>
        <button type="button" role="switch" aria-checked={cfg.enabled} aria-label="Activar copia en la nube" onClick={() => toggle(!cfg.enabled)}
          style={{ width: 50, height: 28, borderRadius: 999, border: "none", background: cfg.enabled ? "var(--ok-bright)" : "var(--border-strong)", position: "relative", cursor: "pointer", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 3, left: cfg.enabled ? 25 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
        </button>
      </div>

      {last && last.ok && cfg.enabled && <div style={okBox}>✓ Última subida {ago(last.at)}{last.dbSize ? ` · ${fmtSize(last.dbSize)}` : ""}{last.photosUploaded ? ` · ${last.photosUploaded} fotos nuevas` : ""}</div>}
      {last && !last.ok && <div style={badBox}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> <b>La última subida falló</b> ({ago(last.at)}). {last.error}</div>}

      <div style={grid2}>
        <label style={{ display: "block" }}><span style={small}>Account ID de Cloudflare</span><input style={input} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="32 letras y números" autoComplete="off" /></label>
        <label style={{ display: "block" }}><span style={small}>Nombre del bucket</span><input style={input} value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} autoComplete="off" /></label>
        <label style={{ display: "block" }}><span style={small}>Access Key ID</span><input style={input} value={form.accessKeyId} onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })} autoComplete="off" /></label>
        <label style={{ display: "block" }}><span style={small}>Secret Access Key</span><input style={input} type="password" value={form.secretAccessKey} onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })} placeholder={cfg.hasSecret ? "•••••••• guardada" : "Pega la clave secreta"} autoComplete="new-password" /></label>
        <div><span style={small}>Guardar en la nube</span>
          <select aria-label="Tiempo a guardar en la nube" style={input} value={form.keepDays} onChange={(e) => setForm({ ...form, keepDays: Number(e.target.value) })}>{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Últimos {d} días{d === 30 ? " (recomendado)" : ""}</option>)}</select></div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, cursor: "pointer", alignSelf: "end", paddingBottom: 10 }}>
          <input type="checkbox" checked={form.photos} onChange={(e) => setForm({ ...form, photos: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span>Subir también las fotos<small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>Cada foto se sube una sola vez</small></span>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={!!busy} onClick={() => save()} style={btnP}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
        <button disabled={!!busy} onClick={test} style={btnG}>{busy === "test" ? "Probando…" : "Probar conexión"}</button>
        {cfg.ready && <button disabled={!!busy} onClick={uploadNow} style={btnG}>{busy === "upload" ? "Subiendo… (puede tardar)" : "Subir ahora"}</button>}
      </div>

      {cfg.ready && list && (
        <div style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "var(--bg-tertiary)", fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <b>Copias en la nube</b>
            {"files" in list && <span style={{ color: "var(--text-secondary)" }}>{list.photos} fotos ({fmtSize(list.photosSize)}) · total {fmtSize(list.totalSize)}</span>}
          </div>
          {"error" in list ? <div style={{ padding: 14, fontSize: 12, color: "var(--danger)" }}>{list.error}</div>
            : files.length === 0 ? <div style={{ padding: 14, fontSize: 12, color: "var(--text-muted)" }}>Todavía no hay copias. Usa “Subir ahora”.</div>
            : files.slice(0, 6).map((f) => (
              <div key={f.name} style={{ display: "flex", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--border)", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 160, fontFamily: "monospace", fontSize: 12 }}>{f.name}</span>
                <span style={{ width: 70, color: "var(--text-secondary)" }}>{fmtSize(f.size)}</span>
                <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 11.5 }}>✓ {ago(f.at)}</span>
              </div>
            ))}
          {files.length > 6 && <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-muted)" }}>… y {files.length - 6} más</div>}
        </div>
      )}

      <Guide title="¿Cómo lo configuro? (5 minutos)" steps={[
        <>Crea una cuenta gratis en <b>dash.cloudflare.com</b> y entra a <b>R2 Object Storage</b> (te puede pedir registrar una tarjeta; el plan gratis incluye 10 GB).</>,
        <>Toca <b>Create bucket</b> y ponle un nombre, por ejemplo <code>repairtrack-respaldos</code>.</>,
        <>En R2 ve a <b>Manage R2 API Tokens → Create API token</b>, permiso <b>Object Read &amp; Write</b>, solo para ese bucket.</>,
        <>Copia aquí el <b>Access Key ID</b>, el <b>Secret Access Key</b> y el <b>Account ID</b> (aparece en la misma página de R2).</>,
        <>Toca <b>Probar conexión</b>, luego <b>Subir ahora</b>, y activa el interruptor de arriba.</>,
      ]} />
    </div>
  );
}

export function MonitorCard() {
  const [cfg, setCfg] = useState<MonCfg | null>(null);
  const [st, setSt] = useState<MonStatus>({});
  const [form, setForm] = useState<MonCfg>({ backupUrl: "", aliveUrl: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/automation/monitor");
    if (!r.ok) return;
    const d = await r.json();
    setCfg(d.config); setSt(d.status || {}); setForm(d.config);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!cfg) return null;

  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/automation/monitor", { method: "PUT", body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return false; }
      setCfg(d.config); sileo.success({ title: "Guardado" }); return true;
    } finally { setBusy(false); }
  };
  const test = async () => {
    if (!(await save())) return;
    setBusy(true);
    try {
      const d = await (await apiFetch("/api/automation/monitor", { method: "POST" })).json();
      const parts = [d.backup === null ? null : d.backup ? "respaldo ✓" : "respaldo ✕", d.alive === null ? null : d.alive ? "encendido ✓" : "encendido ✕"].filter(Boolean);
      if (!parts.length) sileo.warning({ title: "Pega al menos un enlace" });
      else if (d.backup !== false && d.alive !== false) sileo.success({ title: "Señal enviada", description: `${parts.join(" · ")}. Revisa que aparezca en Healthchecks.io` });
      else sileo.error({ title: "Algún enlace no respondió", description: parts.join(" · ") });
      load();
    } finally { setBusy(false); }
  };

  const active = !!(cfg.backupUrl || cfg.aliveUrl);
  return (
    <div style={card}>
      <label style={label}><Activity size={14} strokeWidth={STROKE} aria-hidden="true" /> Vigilancia del sistema</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Un servicio externo vigila que todo funcione. Si el respaldo de la noche no llega, o el servidor se apaga, <b>Healthchecks.io</b> te avisa por correo, Telegram o WhatsApp, aunque el sistema no pueda avisar por sí mismo.
      </p>
      {active && (st.lastAlive || st.lastBackupPing) && (
        <div style={okBox}>
          {st.lastAlive && <span>{st.lastAliveOk ? "✓" : "✕"} “Estoy encendido” {ago(st.lastAlive)}</span>}
          {st.lastBackupPing && <span>· {st.lastBackupPingOk ? "✓" : "✕"} respaldo avisado {ago(st.lastBackupPing)}</span>}
        </div>
      )}
      <div style={{ marginBottom: 12 }}><span style={small}>Enlace del respaldo diario</span><input aria-label="Enlace del respaldo diario" style={input} value={form.backupUrl} onChange={(e) => setForm({ ...form, backupUrl: e.target.value })} inputMode="url" autoComplete="off" /></div>
      <div style={{ marginBottom: 12 }}><span style={small}>Enlace de “sistema encendido” (cada 5 minutos)</span><input aria-label="Enlace del aviso de servidor activo" style={input} value={form.aliveUrl} onChange={(e) => setForm({ ...form, aliveUrl: e.target.value })} inputMode="url" autoComplete="off" /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={save} style={btnP}>Guardar</button>
        <button disabled={busy} onClick={test} style={btnG}><Radio size={14} strokeWidth={STROKE} aria-hidden="true" /> Enviar señal de prueba</button>
      </div>
      <Guide title="¿Cómo lo configuro? (5 minutos)" steps={[
        <>Crea una cuenta gratis en <b>healthchecks.io</b>.</>,
        <>Crea un check llamado <b>Respaldo diario</b>: Period <b>1 día</b>, Grace <b>2 horas</b>. Copia su enlace (https://hc-ping.com/…) en el primer campo.</>,
        <>Crea otro llamado <b>Sistema encendido</b>: Period <b>5 minutos</b>, Grace <b>10 minutos</b>. Copia su enlace en el segundo campo.</>,
        <>En <b>Integrations</b> elige cómo quieres recibir los avisos (correo, Telegram, WhatsApp…).</>,
        <>Guarda y toca <b>Enviar señal de prueba</b>: los dos checks deben ponerse en verde.</>,
        <>Opcional: en <b>uptimerobot.com</b> (gratis) agrega un monitor HTTP(s) con la dirección de tu sistema para saber también si la página deja de abrir para los clientes.</>,
      ]} />
    </div>
  );
}

interface MailCfg { provider: "gmail" | "brevo" | "resend" | "smtp"; host: string; port: number; secure: boolean; user: string; fromEmail: string; fromName: string; alertEmail: string; hasPass: boolean; ready: boolean }
interface MailLast { at: string; ok: boolean; to?: string; error?: string }

const PROVIDERS: { key: MailCfg["provider"]; label: string }[] = [
  { key: "gmail", label: "Gmail" }, { key: "brevo", label: "Brevo" }, { key: "resend", label: "Resend" }, { key: "smtp", label: "Otro (SMTP)" },
];

export function MailCard() {
  const [cfg, setCfg] = useState<MailCfg | null>(null);
  const [last, setLast] = useState<MailLast | null>(null);
  const [form, setForm] = useState({ provider: "gmail" as MailCfg["provider"], host: "", port: 587, secure: false, user: "", pass: "", fromEmail: "", fromName: "", alertEmail: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/mail");
    if (!r.ok) return;
    const d = await r.json();
    setCfg(d.config); setLast(d.last);
    const c: MailCfg = d.config;
    setForm({ provider: c.provider, host: c.host, port: c.port, secure: c.secure, user: c.user, pass: "", fromEmail: c.fromEmail, fromName: c.fromName, alertEmail: c.alertEmail });
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!cfg) return null;

  const save = async () => {
    setBusy("save");
    try {
      const r = await apiFetch("/api/mail", { method: "PUT", body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return false; }
      setCfg(d.config); setForm((f) => ({ ...f, pass: "" })); sileo.success({ title: "Guardado" }); return true;
    } finally { setBusy(null); }
  };
  const test = async () => {
    if (!(await save())) return;
    setBusy("test");
    try {
      const d = await (await apiFetch("/api/mail", { method: "POST", body: "{}" })).json();
      if (d.ok) sileo.success({ title: "Correo de prueba enviado", description: `Revisa la bandeja de ${d.to} (y Spam)` });
      else sileo.error({ title: "No se pudo enviar", description: d.error });
      load();
    } finally { setBusy(null); }
  };

  const p = form.provider;
  const userLabel = p === "gmail" ? "Gmail del taller" : p === "resend" ? "Usuario (escribe: resend)" : p === "brevo" ? "Usuario SMTP (login de Brevo)" : "Usuario";
  const passLabel = p === "gmail" ? "Contraseña de aplicación" : p === "resend" ? "API Key de Resend" : p === "brevo" ? "Clave SMTP de Brevo" : "Contraseña";
  return (
    <div style={card}>
      <label style={label}><Mail size={14} strokeWidth={STROKE} aria-hidden="true" /> Correo del sistema</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Para enviar el <b>comprobante</b>, la <b>cotización</b> o la <b>nota de venta</b> al cliente, el <b>código para recuperar la contraseña</b> (además de WhatsApp) y las <b>alertas del sistema</b>.
      </p>
      {cfg.ready && last?.ok && <div style={okBox}>✓ Funcionando · último envío {ago(last.at)}{last.to ? ` a ${last.to}` : ""}</div>}
      {last && !last.ok && <div style={badBox}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> <b>El último envío falló</b> ({ago(last.at)}). {last.error}</div>}

      <span style={small}>Servicio</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PROVIDERS.map((x) => (
          <button key={x.key} type="button" onClick={() => setForm({ ...form, provider: x.key })}
            style={{ padding: "7px 13px", borderRadius: 999, border: "1px solid var(--border)", background: p === x.key ? "var(--text-primary)" : "var(--bg-card)", color: p === x.key ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{x.label}</button>
        ))}
      </div>
      {p === "smtp" && (
        <div style={grid2}>
          <label style={{ display: "block" }}><span style={small}>Servidor SMTP</span><input style={input} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ display: "block", flex: 1 }}><span style={small}>Puerto</span><input style={input} inputMode="numeric" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, alignSelf: "end", paddingBottom: 12 }}><input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} /> SSL (465)</label>
          </div>
        </div>
      )}
      <div style={grid2}>
        <label style={{ display: "block" }}><span style={small}>{userLabel}</span><input style={input} value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} autoComplete="off" /></label>
        <label style={{ display: "block" }}><span style={small}>{passLabel}</span><input style={input} type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder={cfg.hasPass ? "•••••••• guardada" : ""} autoComplete="new-password" /></label>
        {p !== "gmail" && <label style={{ display: "block" }}><span style={small}>Correo que envía</span><input style={input} type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} /></label>}
        <label style={{ display: "block" }}><span style={small}>Nombre que ve el cliente</span><input style={input} value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} /></label>
        <label style={{ display: "block" }}><span style={small}>Correo para alertas del sistema</span><input style={input} type="email" value={form.alertEmail} onChange={(e) => setForm({ ...form, alertEmail: e.target.value })} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={!!busy} onClick={save} style={btnP}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
        <button disabled={!!busy} onClick={test} style={btnG}>{busy === "test" ? "Enviando…" : "Enviarme un correo de prueba"}</button>
      </div>
      <Guide title={p === "gmail" ? "¿Cómo saco la contraseña de aplicación de Gmail? (2 minutos)" : "¿Cómo lo configuro?"} steps={p === "gmail" ? [
        <>Usa un Gmail del taller (mejor uno solo para esto). Entra a <b>myaccount.google.com</b> con esa cuenta.</>,
        <>En <b>Seguridad</b> activa la <b>Verificación en dos pasos</b> (Google lo exige).</>,
        <>Busca <b>“Contraseñas de aplicaciones”</b>, escribe un nombre (ej. RepairTrackQR) y toca <b>Crear</b>.</>,
        <>Copia la clave de 16 letras que aparece y pégala aquí. Escribe el Gmail completo en el otro campo.</>,
        <>Guarda y toca <b>Enviarme un correo de prueba</b>. Gmail permite unos 500 correos por día.</>,
      ] : p === "resend" ? [
        <>Crea una cuenta en <b>resend.com</b> y agrega tu dominio (ej. degree-project.com) en <b>Domains</b>; copia los registros DNS que te muestra en tu proveedor del dominio.</>,
        <>En <b>API Keys</b> crea una clave con permiso de envío y pégala aquí. El usuario es la palabra <b>resend</b>.</>,
        <>En “Correo que envía” usa una dirección de tu dominio, ej. <b>taller@degree-project.com</b>.</>,
      ] : p === "brevo" ? [
        <>Crea una cuenta en <b>brevo.com</b> (300 correos por día gratis).</>,
        <>En <b>Senders, domains</b> agrega y verifica el correo que va a enviar.</>,
        <>En <b>SMTP &amp; API → SMTP</b> copia el <b>login</b> y genera una <b>clave SMTP</b>; pégalos aquí.</>,
      ] : [
        <>Pide a tu proveedor de correo los datos SMTP: servidor, puerto (465 con SSL o 587), usuario y contraseña.</>,
      ]} />
    </div>
  );
}

export function PaymentQrCard() {
  const [qr, setQr] = useState<{ image: string; bank: string; holder: string; onDocuments: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch("/api/payments").then((r) => (r.ok ? r.json() : null)).then((d) => d && setQr(d)).catch(() => {}); }, []);
  if (!qr) return null;

  const save = async (patch: Partial<typeof qr>, msg = "Guardado") => {
    const next = { ...qr, ...patch };
    setQr(next); setBusy(true);
    try {
      const r = await apiFetch("/api/payments", { method: "PUT", body: JSON.stringify(next) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      setQr(d); invalidatePaymentQr(); sileo.success({ title: msg });
    } finally { setBusy(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) { sileo.error({ title: d.error || "No se pudo subir la imagen" }); return; }
      await save({ image: d.url }, "QR del taller guardado");
    } finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <label style={label}><QrCode size={14} strokeWidth={STROKE} aria-hidden="true" /> Cobro con QR</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Sube el <b>QR de cobro de tu cuenta</b> (el que generas en la app de tu banco, sin monto fijo). Al entregar un equipo o en una nota de venta se muestra con el monto para que el cliente lo escanee, y la <b>Caja</b> y el <b>Resumen del día</b> separan efectivo y QR.
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <label style={{ width: 132, height: 132, borderRadius: 12, border: "1.5px dashed var(--border-strong)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "wait" : "pointer", overflow: "hidden", flexShrink: 0, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} />
          { }
          {qr.image ? <img src={qr.image} alt="QR del taller" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : <span>＋ Subir<br />imagen del QR</span>}
        </label>
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "block" }}><span style={small}>Banco</span><input style={input} defaultValue={qr.bank} onBlur={(e) => e.target.value.trim() !== qr.bank && save({ bank: e.target.value.trim() })} /></label>
          <label style={{ display: "block" }}><span style={small}>Titular de la cuenta</span><input style={input} defaultValue={qr.holder} onBlur={(e) => e.target.value.trim() !== qr.holder && save({ holder: e.target.value.trim() })} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, cursor: "pointer" }}>
            <input type="checkbox" checked={qr.onDocuments} onChange={(e) => save({ onDocuments: e.target.checked })} style={{ width: 17, height: 17, marginTop: 1 }} />
            <span>Mostrar también en la cotización y la nota de venta<small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>Para que el cliente pueda pagar desde el documento</small></span>
          </label>
          {qr.image && <button type="button" disabled={busy} onClick={() => save({ image: "" }, "QR quitado")} style={{ ...btnG, alignSelf: "flex-start", padding: "7px 12px", fontSize: 12 }}>Quitar QR</button>}
        </div>
      </div>
      <Guide title="¿De dónde saco el QR?" steps={[
        <>Abre la app de tu banco y busca <b>“Cobrar con QR”</b> o <b>“Generar QR”</b>.</>,
        <>Genera un QR <b>sin monto</b> (o “monto abierto”) y, si te pide, que <b>no venza</b> o con la mayor vigencia posible.</>,
        <>Guarda la imagen o sácale captura, recórtala y súbela aquí.</>,
        <>Haz una prueba: entrega un equipo, elige <b>QR</b>, toca <b>Mostrar al cliente</b> y págalo con otro celular.</>,
      ]} />
    </div>
  );
}

/** WhatsApp del taller (WasenderApi): cambiar de cuenta pegando otra clave, probar y quitar. */
export function WhatsAppCard() {
  const [st, setSt] = useState<{ configured: boolean; source: "config" | "env" | "none"; last4: string | null } | null>(null);
  const [key, setKey] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch("/api/whatsapp/config").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSt(d)).catch(() => {}); }, []);
  if (!st) return null;
  const save = async (value: string) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/whatsapp/config", { method: "PUT", body: JSON.stringify({ apiKey: value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      setSt(d); setKey("");
      if (d.warning) sileo.warning({ title: d.warning });
      else sileo.success({ title: value ? "Clave guardada y comprobada" : "Clave quitada" });
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/whatsapp/config", { method: "POST", body: JSON.stringify({ phone }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo enviar" }); return; }
      sileo.success({ title: "Mensaje de prueba enviado", description: "Revisa ese WhatsApp" });
    } finally { setBusy(false); }
  };
  return (
    <div style={card}>
      <label style={label}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> WhatsApp del taller (WasenderApi)</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Envía los avisos automáticos a los clientes (orden recibida, lista para recoger, entrega) y los PIN de acceso. La clave se guarda en el servidor y nunca se vuelve a mostrar completa.
      </p>
      {st.configured
        ? <div style={okBox}>✓ Clave activa ··· {st.last4}{st.source === "env" ? " (del archivo .env del servidor)" : ""}</div>
        : <div style={{ ...okBox, background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" }}>Sin clave: los avisos por WhatsApp no se envían</div>}
      <span style={small}>Nueva clave (para cambiar de cuenta)</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input aria-label="Clave de WasenderApi" style={{ ...input, flex: "1 1 260px" }} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
        <button disabled={busy || !key.trim()} onClick={() => save(key)} style={btnP}>{busy ? "Comprobando…" : "Guardar y probar"}</button>
        {st.source === "config" && <button disabled={busy} onClick={() => save("")} style={btnG}>Quitar clave</button>}
      </div>
      <span style={small}>Mensaje de prueba</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input aria-label="Celular para el mensaje de prueba" style={{ ...input, flex: "1 1 200px" }} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular" />
        <button disabled={busy || !phone.trim() || !st.configured} onClick={test} style={btnG}>Enviar prueba</button>
      </div>
      <Guide title="¿Dónde saco la clave?" steps={[
        <>Entra a <b>wasenderapi.com</b> con la cuenta del taller y abre tu <b>sesión</b> (el número de WhatsApp).</>,
        <>Si la sesión dice desconectada, toca <b>Conectar</b> y escanea el QR con el WhatsApp del taller.</>,
        <>Copia la <b>API key</b> de esa sesión y pégala aquí. Cada número tiene su propia clave: para cambiar de número, pega la clave de la otra sesión.</>,
      ]} />
    </div>
  );
}

export function TelegramCard() {
  const [st, setSt] = useState<{ username: string; botName: string; hasToken: boolean; ready: boolean } | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch("/api/telegram").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSt(d)).catch(() => {}); }, []);
  if (!st) return null;
  const save = async (value: string) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/telegram", { method: "PUT", body: JSON.stringify({ token: value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      setSt(d); setToken(""); sileo.success({ title: value ? `Bot conectado: @${d.username}` : "Bot quitado" });
    } finally { setBusy(false); }
  };
  return (
    <div style={card}>
      <label style={label}><Send size={14} strokeWidth={STROKE} aria-hidden="true" /> Telegram del taller</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Un bot gratis del taller. Cada persona lo vincula en <b>Mi cuenta</b> y recibe los avisos también por Telegram. Si el WhatsApp del taller falla, el <b>resumen del día</b> y las alertas llegan por aquí a los Super Admin.
      </p>
      {st.ready && <div style={okBox}>✓ Bot conectado · @{st.username}</div>}
      <span style={small}>Token del bot (de @BotFather)</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input aria-label="Token del bot de Telegram" style={{ ...input, flex: "1 1 260px" }} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={st.hasToken ? "•••••••• guardado (pega otro para cambiarlo)" : ""} autoComplete="off" />
        <button disabled={busy || !token.trim()} onClick={() => save(token)} style={btnP}>{busy ? "Comprobando…" : "Guardar"}</button>
        {st.hasToken && <button disabled={busy} onClick={() => save("")} style={btnG}>Quitar</button>}
      </div>
      <Guide title="¿Cómo creo el bot? (2 minutos)" steps={[
        <>En Telegram busca <b>@BotFather</b> (con la palomita azul) y toca <b>Iniciar</b>.</>,
        <>Escribe <code>/newbot</code>, ponle un nombre (ej. <b>Taller RepairTrack</b>) y un usuario que termine en <b>bot</b> (ej. <code>taller_repair_bot</code>).</>,
        <>BotFather te da un <b>token</b> (números, dos puntos y letras). Cópialo y pégalo aquí.</>,
        <>Luego cada persona va a <b>Mi cuenta → Vincular mi Telegram</b>.</>,
      ]} />
    </div>
  );
}

interface AiCfg { enabled: boolean; model: string; hasKey: boolean; ready: boolean; models: { id: string; label: string }[]; usage: { calls: number; usd: number } }

export function AiCard() {
  const [st, setSt] = useState<AiCfg | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("");
  useEffect(() => { apiFetch("/api/ai").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSt(d)).catch(() => {}); }, []);
  if (!st) return null;
  const save = async (patch: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/ai", { method: "PUT", body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      setSt(d); setKey(""); sileo.success({ title: okMsg });
      if (typeof patch.apiKey === "string") void test();
    } finally { setBusy(false); }
  };
  async function test() {
    setBusy(true); setSample("");
    try {
      const r = await apiFetch("/api/ai", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No funcionó" }); return; }
      setSample(d.sample || "OK"); sileo.success({ title: "La IA respondió" });
    } finally { setBusy(false); }
  }
  return (
    <div style={card}>
      <label style={label}><Bot size={14} strokeWidth={STROKE} aria-hidden="true" /> IA para diagnósticos</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        El técnico escribe sus notas rápidas y pulsa <b>Redactar con IA</b>: recibe un texto claro para el cliente (diagnóstico, repuesto, informe final o novedad). En el diagnóstico muestra además cuánto se cobró en <b>reparaciones parecidas</b> ya entregadas. Nada se guarda sin que la persona lo revise.
      </p>
      {st.ready && <div style={okBox}>✓ Activada{st.usage.calls ? ` · este mes ${st.usage.calls} textos (≈ US$ ${st.usage.usd.toFixed(2)})` : ""}</div>}
      <div style={grid2}>
        <div>
          <span style={small}>Clave de API (Anthropic)</span>
          <input aria-label="Clave de API (Anthropic)" style={input} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={st.hasKey ? "•••••••• guardada (pega otra para cambiarla)" : ""} autoComplete="off" />
        </div>
        <div>
          <span style={small}>Modelo</span>
          <select aria-label="Modelo" style={input} value={st.model} disabled={busy} onChange={(e) => save({ model: e.target.value }, "Modelo cambiado")}>
            {st.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {key.trim() && <button disabled={busy} onClick={() => save({ apiKey: key, enabled: true }, "Clave guardada y IA activada")} style={btnP}>{busy ? "Guardando…" : "Guardar y activar"}</button>}
        {st.hasKey && !key.trim() && (
          <button disabled={busy} onClick={() => save({ enabled: !st.enabled }, st.enabled ? "IA desactivada" : "IA activada")} style={st.enabled ? btnG : btnP}>{st.enabled ? "Desactivar" : "Activar"}</button>
        )}
        {st.hasKey && <button disabled={busy} onClick={test} style={btnG}>Probar</button>}
        {st.hasKey && <button disabled={busy} onClick={() => save({ removeKey: true, enabled: false }, "Clave quitada")} style={btnG}>Quitar clave</button>}
      </div>
      {sample && <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>“{sample}”</div>}
      <Guide title="¿Cómo consigo la clave? (5 minutos)" steps={[
        <>Entra a <b>console.anthropic.com</b> y crea una cuenta.</>,
        <>En <b>Billing</b> carga saldo (desde US$ 5). Con Haiku cada texto cuesta menos de 1 centavo: US$ 5 alcanzan para miles.</>,
        <>En <b>API Keys</b> pulsa <b>Create Key</b>, copia la clave (empieza con <code>sk-ant-</code>) y pégala aquí.</>,
        <>Opcional: en <b>Limits</b> pon un tope mensual de gasto para estar tranquilo.</>,
      ]} />
    </div>
  );
}

export function ImeiCard() {
  const [st, setSt] = useState<{ url: string; serviceId: string; hasKey: boolean; ready: boolean } | null>(null);
  const [key, setKey] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch("/api/imei").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setSt(d); setServiceId(d.serviceId); setUrl(d.url); } }).catch(() => {}); }, []);
  if (!st) return null;
  const save = async (patch: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/imei", { method: "PUT", body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      setSt(d); setKey(""); setServiceId(d.serviceId); setUrl(d.url); sileo.success({ title: okMsg });
    } finally { setBusy(false); }
  };
  return (
    <div style={card}>
      <label style={label}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> Consulta de IMEI</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        <b>Gratis y siempre activo:</b> al recibir un celular se revisa que el IMEI sea válido y se avisa si ese equipo <b>ya vino antes</b> al taller. <b>Opcional (pagado):</b> con una cuenta en imeicheck.net aparece el botón <b>Consultar robo/bloqueo</b> (reporte de robo o pérdida, bloqueo de operador, iCloud). Se paga por consulta, solo cuando alguien pulsa el botón.
      </p>
      {st.ready && <div style={okBox}>✓ Consulta pagada activa · servicio {st.serviceId}</div>}
      <div style={grid2}>
        <div>
          <span style={small}>Clave de API (token)</span>
          <input aria-label="Clave de API (token)" style={input} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={st.hasKey ? "•••••••• guardada (pega otra para cambiarla)" : "Token de imeicheck.net"} autoComplete="off" />
        </div>
        <div>
          <span style={small}>N° de servicio (Service ID)</span>
          <input aria-label="Nº de servicio (Service ID)" style={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)} />
        </div>
      </div>
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11.5, color: "var(--text-secondary)", cursor: "pointer" }}>Avanzado: otro servicio</summary>
        <span style={{ ...small, marginTop: 8 }}>Dirección de la API</span>
        <input aria-label="Dirección de la API" style={input} value={url} onChange={(e) => setUrl(e.target.value)} />
      </details>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => save({ apiKey: key, serviceId, url }, "Consulta de IMEI guardada")} style={btnP}>{busy ? "Guardando…" : "Guardar"}</button>
        {st.hasKey && <button disabled={busy} onClick={() => save({ removeKey: true }, "Clave quitada")} style={btnG}>Quitar clave</button>}
      </div>
      <Guide title="¿Cómo activo la consulta pagada?" steps={[
        <>Crea una cuenta en <b>imeicheck.net</b> y carga saldo (cada consulta cuesta centavos de dólar según el servicio).</>,
        <>En tu perfil, sección <b>API</b>, copia el <b>token</b> y pégalo aquí.</>,
        <>En la lista de servicios de la API elige uno que diga <b>Blacklist</b> (reporte de robo); para iPhone hay servicios con iCloud y bloqueo de operador. Copia su número (<b>Service ID</b>).</>,
        <>Guarda y prueba con un celular: en Nueva orden escribe el IMEI y pulsa <b>Consultar robo/bloqueo</b>.</>,
      ]} />
    </div>
  );
}

interface GRCfg { askNextDay: boolean; hour: number; branches: { id: string; name: string; link: string; clicks: number; avg: number | null; reviews: number }[] }

export function GoogleReviewsCard() {
  const [st, setSt] = useState<GRCfg | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = (d: GRCfg) => { setSt(d); setLinks(Object.fromEntries(d.branches.map((b) => [b.id, b.link]))); };
  useEffect(() => { apiFetch("/api/reviews/google").then((r) => (r.ok ? r.json() : null)).then((d) => d && load(d)).catch(() => {}); }, []);
  if (!st) return null;
  const save = async (patch: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/reviews/google", { method: "PUT", body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      load(d); sileo.success({ title: okMsg });
    } finally { setBusy(false); }
  };
  const anyLink = st.branches.some((b) => b.link);
  return (
    <div style={card}>
      <label style={label}><Star size={14} strokeWidth={STROKE} aria-hidden="true" /> Reseñas en Google</label>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        Después de calificar en su seguimiento, el cliente ve el botón <b>Dejar reseña en Google</b> de su sucursal. Se muestra a <b>todos</b> los clientes, sin importar las estrellas: Google prohíbe pedir reseñas solo a los contentos.
      </p>
      {st.branches.map((b) => (
        <div key={b.id} style={{ marginBottom: 10 }}>
          <span style={small}>{b.name}{b.link ? ` · este mes: ${b.clicks} clic${b.clicks === 1 ? "" : "s"} a Google` : ""}{b.reviews ? ` · ★ ${b.avg} (${b.reviews})` : ""}</span>
          <input aria-label={`Enlace de reseñas de ${b.name}`} style={input} value={links[b.id] || ""} onChange={(e) => setLinks((p) => ({ ...p, [b.id]: e.target.value }))} autoComplete="off" />
        </div>
      ))}
      <button disabled={busy} onClick={() => save({ links }, "Enlaces guardados")} style={{ ...btnP, marginBottom: 14 }}>{busy ? "Guardando…" : "Guardar enlaces"}</button>

      <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer" }}>
          <input type="checkbox" checked={st.askNextDay} disabled={busy} onChange={(e) => save({ askNextDay: e.target.checked }, e.target.checked ? "Se pedirá la calificación por WhatsApp" : "Desactivado")} style={{ marginTop: 2 }} />
          <span>Pedir calificación por WhatsApp al día siguiente de la entrega
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginTop: 3 }}>Una sola vez por orden, solo si el cliente no calificó. {anyLink ? "Incluye el enlace de Google." : "Sin enlace de Google guardado, solo pide la calificación interna."}</span>
          </span>
        </label>
        {st.askNextDay && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
            Hora del mensaje:
            <select aria-label="Hora del mensaje" value={st.hour} disabled={busy} onChange={(e) => save({ hour: Number(e.target.value) }, "Hora guardada")} style={{ ...input, width: "auto", padding: "6px 10px" }}>
              {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </div>
        )}
      </div>
      <Guide title="¿Dónde consigo el enlace de reseñas?" steps={[
        <>En Google busca el nombre de tu taller estando conectado con la cuenta que administra el negocio (o entra a <b>business.google.com</b>).</>,
        <>En el panel del negocio toca <b>Pedir reseñas</b> (o “Obtener más reseñas”).</>,
        <>Copia el enlace (empieza con <code>https://g.page/r/</code>) y pégalo en la sucursal que corresponde.</>,
        <>Si aún no tienes Perfil de Empresa, créalo gratis en <b>business.google.com</b> y verifica la dirección.</>,
      ]} />
    </div>
  );
}
