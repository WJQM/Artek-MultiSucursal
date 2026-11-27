"use client";
import { ChartColumn, Download, Lock, MessageCircle, Pause, ShieldCheck, TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Configuración › "Respaldos y nube" (respaldos, nube R2, monitor) y "Avisos y mensajes" (avisos al dueño,
// resumen del día, correo, Telegram). Solo Super Admin.
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { CloudCard, MailCard, MonitorCard, TelegramCard, WhatsAppCard } from "@/frontend/components/CloudMonitorPanel";

interface Config { backupEnabled: boolean; backupHour: number; backupKeep: number; ownerPhone: string; summaryAuto: boolean; summaryHour: number }
interface BFile { name: string; size: number; at: string; uploads?: { name: string; size: number } }
interface BRun { at: string; ok: boolean; trigger: string; file?: string; size?: number; error?: string; retried?: boolean; cloud?: { ok: boolean; error?: string } }
interface Data { config: Config; backups: { dir: string; running: boolean; files: BFile[]; log: BRun[]; production: boolean } }

const card = { padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 } as const;
const label = { fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 } as const;
const small = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" } as const;
const input = { width: "100%", padding: "11px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" } as const;

export function fmtSize(b?: number) {
  if (!b && b !== 0) return "—";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function whenLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (same(d, today)) return { day: "Hoy", time };
  if (same(d, y)) return { day: "Ayer", time };
  const day = d.toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return { day: day.charAt(0).toUpperCase() + day.slice(1), time };
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ width: 50, height: 28, borderRadius: 999, border: "none", background: on ? "var(--ok-bright)" : "var(--border-strong)", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
    </button>
  );
}

export default function AutomationPanel({ parte }: { parte: "respaldos" | "avisos" }) {
  const [data, setData] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/automation");
    if (!r.ok) return;
    const d: Data = await r.json();
    setData(d);
    setCfg((c) => c ?? d.config);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mientras corre un respaldo, se actualiza cada 4 s
  const running = !!data?.backups.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [running, load]);

  if (!data || !cfg) return <div style={{ ...card, color: "var(--text-muted)", fontSize: 13 }}>Cargando respaldos…</div>;

  const save = async (patch: Partial<Config>, msg = "Guardado") => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSaving(true);
    try {
      const r = await apiFetch("/api/automation", { method: "PUT", body: JSON.stringify(next) });
      if (r.ok) { const d = await r.json(); setCfg(d.config); sileo.success({ title: msg }); }
      else sileo.error({ title: "No se pudo guardar" });
    } finally { setSaving(false); }
  };

  const runNow = async () => {
    const r = await apiFetch("/api/automation/backup", { method: "POST" });
    if (r.ok) { sileo.info({ title: "Respaldo iniciado", description: "Tarda unos segundos; la lista se actualiza sola." }); setData({ ...data, backups: { ...data.backups, running: true } }); }
    else { const d = await r.json().catch(() => ({})); sileo.error({ title: d.error || "No se pudo iniciar el respaldo" }); }
  };

  const download = async (name: string) => {
    const r = await apiFetch(`/api/automation/backup?file=${encodeURIComponent(name)}`);
    if (!r.ok) { sileo.error({ title: "No se pudo descargar" }); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const { files, log } = data.backups;
  const last = log[0];
  const lastOk = log.find((l) => l.ok);
  // Fallas recientes que no dejaron archivo (se muestran en la lista junto a los respaldos)
  const failures = log.filter((l) => !l.ok).slice(0, 3);
  const rows = [
    ...files.map((f) => ({ kind: "file" as const, at: f.at, f })),
    ...failures.map((l) => ({ kind: "fail" as const, at: l.at, l })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);

  if (parte === "avisos") return (
    <>
      <OwnerCard cfg={cfg} saving={saving} save={save} />
      <WhatsAppCard />
      <MailCard />
      <TelegramCard />
    </>
  );

  return (
    <>
      {/* RESPALDOS */}
      <div style={card}>
        <label style={label}><ShieldCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Respaldos automáticos</label>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: cfg.backupEnabled ? "var(--ok-bg)" : "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{cfg.backupEnabled ? <ShieldCheck size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Pause size={24} strokeWidth={STROKE} aria-hidden="true" />}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{cfg.backupEnabled ? "Respaldo automático activado" : "Respaldo automático desactivado"}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.5 }}>
              {cfg.backupEnabled ? <>Todos los días a las <b>{hh(cfg.backupHour)}</b> · se guardan los últimos <b>{cfg.backupKeep}</b> días</> : "No se harán copias de seguridad automáticas"}
              {lastOk && <> · último: <b style={{ color: "var(--ok)" }}>{whenLabel(lastOk.at).day.toLowerCase()} {whenLabel(lastOk.at).time} ✓{lastOk.size ? ` (${fmtSize(lastOk.size)})` : ""}</b></>}
            </div>
          </div>
          <Switch on={cfg.backupEnabled} onChange={(v) => save({ backupEnabled: v }, v ? "Respaldo automático activado" : "Respaldo automático desactivado")} />
        </div>

        {last && !last.ok && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-line)", borderRadius: 10, fontSize: 11.5, color: "var(--danger)", lineHeight: 1.5 }}>
            <TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> <b>El último respaldo falló</b> ({whenLabel(last.at).day} {whenLabel(last.at).time}). {last.error}
          </div>
        )}
        {!data.backups.production && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 10, fontSize: 11.5, color: "var(--warn)" }}>
            ℹ️ Estás en modo de prueba: el respaldo automático solo corre en el servidor. “Respaldar ahora” sí funciona.
          </div>
        )}

        <div className="settings-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
          <div>
            <span style={small}>Hora del respaldo</span>
            <select aria-label="Hora del respaldo" value={cfg.backupHour} disabled={saving} onChange={(e) => save({ backupHour: Number(e.target.value) }, "Hora del respaldo guardada")} style={input}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}{h === 3 ? " (recomendado)" : ""}</option>)}
            </select>
          </div>
          <div>
            <span style={small}>Guardar</span>
            <select aria-label="Respaldos a guardar" value={cfg.backupKeep} disabled={saving} onChange={(e) => save({ backupKeep: Number(e.target.value) }, "Guardado")} style={input}>
              {[3, 5, 7, 14, 30].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 18, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-tertiary)", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13, color: "var(--text-primary)" }}>Respaldos guardados</b>
            <button onClick={runNow} disabled={running} style={{ padding: "8px 14px", background: running ? "var(--bg-secondary)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", borderRadius: 9, color: running ? "var(--text-muted)" : "#fff", fontSize: 12, fontWeight: 700, cursor: running ? "wait" : "pointer" }}>
              {running ? "Respaldando…" : "Respaldar ahora"}
            </button>
          </div>
          {rows.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Todavía no hay respaldos. Presiona “Respaldar ahora” para hacer el primero.</div>}
          {rows.map((r) => {
            const w = whenLabel(r.at);
            if (r.kind === "fail") return (
              <div key={`f${r.at}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ minWidth: 130 }}><b>{w.day}</b> · {w.time}</span>
                <span style={{ flex: 1, minWidth: 160 }}><span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 11, fontWeight: 700 }}>Falló{r.l.retried ? " (2 intentos)" : ""}</span></span>
              </div>
            );
            const f = r.f;
            return (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ minWidth: 130 }}><b>{w.day}</b> · {w.time}</span>
                <span style={{ width: 70, color: "var(--text-secondary)" }}>{fmtSize(f.size)}</span>
                <span style={{ flex: 1, minWidth: 90 }}><span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--ok-bg)", color: "var(--ok)", fontSize: 11, fontWeight: 700 }}>✓ Correcto</span></span>
                <button onClick={() => download(f.name)} title="Base de datos" style={{ padding: "6px 10px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Download size={14} strokeWidth={STROKE} aria-hidden="true" /> Datos</button>
                {f.uploads && <button onClick={() => download(f.uploads!.name)} title={`Imágenes (${fmtSize(f.uploads.size)})`} style={{ padding: "6px 10px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Download size={14} strokeWidth={STROKE} aria-hidden="true" /> Fotos</button>}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
          <Lock size={14} strokeWidth={STROKE} aria-hidden="true" /> Se guardan en el servidor ({data.backups.dir}), fuera de la carpeta de la app. Si un respaldo falla, se reintenta y se avisa en la campana{cfg.ownerPhone ? " y por WhatsApp al dueño" : ""}. Para restaurar uno se usa <code>scripts/restore-backup.sh</code> en el servidor.
        </p>
      </div>

      {/* NUBE Y VIGILANCIA */}
      <CloudCard />
      <MonitorCard />
    </>
  );
}

function OwnerCard({ cfg, saving, save }: { cfg: Config; saving: boolean; save: (p: Partial<Config>, msg?: string) => Promise<void> }) {
  const [phone, setPhone] = useState(cfg.ownerPhone);
  return (
    <div style={card}>
      <label style={label}><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> Avisos al dueño por WhatsApp</label>
      <span style={small}>Celular del dueño</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input aria-label="Celular del dueño" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" style={{ ...input, flex: 1 }} />
        <button disabled={saving || phone.trim() === cfg.ownerPhone} onClick={() => save({ ownerPhone: phone.trim() }, "Celular del dueño guardado")}
          style={{ padding: "0 16px", background: phone.trim() === cfg.ownerPhone ? "var(--bg-tertiary)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", borderRadius: 10, color: phone.trim() === cfg.ownerPhone ? "var(--text-muted)" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>Aquí llegan los avisos importantes del sistema, como un respaldo que falló, y el resumen del día.</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22 }}><ChartColumn size={22} strokeWidth={STROKE} aria-hidden="true" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>Resumen del día automático</div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>{cfg.ownerPhone ? <>Llega solo cada noche al celular del dueño{cfg.summaryAuto ? <> a las <b>{hh(cfg.summaryHour)}</b></> : ""}. También se puede enviar a mano desde Caja.</> : "Primero guarda el celular del dueño."}</div>
        </div>
        <Switch on={cfg.summaryAuto && !!cfg.ownerPhone} onChange={(v) => { if (!cfg.ownerPhone) return; save({ summaryAuto: v }, v ? "Resumen automático activado" : "Resumen automático desactivado"); }} />
      </div>
      {cfg.summaryAuto && cfg.ownerPhone && (
        <div style={{ marginTop: 12, maxWidth: 260 }}>
          <span style={small}>Hora de envío</span>
          <select aria-label="Hora de envío del resumen" value={cfg.summaryHour} disabled={saving} onChange={(e) => save({ summaryHour: Number(e.target.value) }, "Hora del resumen guardada")} style={input}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}{h === 20 ? " (recomendado)" : ""}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
