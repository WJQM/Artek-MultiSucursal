"use client";
import { Bell } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Mi cuenta → "Avisos en este celular" (Web Push). Se activa una vez por navegador.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";

interface Info {
  publicKey: string;
  prefs: Record<string, boolean>;
  categories: { key: string; label: string; hint: string }[];
  devices: { endpoint: string; device: string | null; createdAt: string }[];
}
type Support = "checking" | "ok" | "ios-install" | "unsupported";

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "20px 20px", marginBottom: 16, boxShadow: "0 2px 10px rgba(30,42,58,0.05)" };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#1e2a3a", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const p: React.CSSProperties = { fontSize: 12, color: "#5a6a80", marginBottom: 14, lineHeight: 1.5 };
const btn: React.CSSProperties = { padding: "10px 16px", border: "none", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const ghost: React.CSSProperties = { padding: "10px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Dispositivo";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} · ${os}`;
}

export default function PushSettings() {
  const [support, setSupport] = useState<Support>("checking");
  const [info, setInfo] = useState<Info | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await apiFetch("/api/push");
    if (r.ok) setInfo(await r.json());
  };

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua);
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!ok) { setSupport(ios && !standalone ? "ios-install" : "unsupported"); return; }
    setSupport("ok");
    setPerm(Notification.permission);
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => setEndpoint(s?.endpoint || null)).catch(() => {});
    load();
  }, []);

  const here = !!endpoint && !!info?.devices.some((d) => d.endpoint === endpoint);
  const others = (info?.devices || []).filter((d) => d.endpoint !== endpoint);

  const activate = async () => {
    if (!info) return;
    setBusy(true);
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res !== "granted") { sileo.warning({ title: "No se dieron permisos", description: "Sin permiso del navegador no pueden llegar avisos" }); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(info.publicKey) });
      const r = await apiFetch("/api/push", { method: "POST", body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON(), device: deviceName() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); sileo.error({ title: d.error || "No se pudo activar" }); return; }
      setEndpoint(sub.endpoint);
      await load();
      sileo.success({ title: "Avisos activados en este celular" });
    } catch (e) {
      console.error(e);
      sileo.error({ title: "No se pudo activar", description: "Revisa que el navegador permita notificaciones para este sitio" });
    } finally { setBusy(false); }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => {});
      await apiFetch("/api/push", { method: "POST", body: JSON.stringify({ action: "unsubscribe", endpoint: sub?.endpoint || endpoint }) });
      setEndpoint(null);
      await load();
      sileo.success({ title: "Avisos desactivados en este celular" });
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/push", { method: "POST", body: JSON.stringify({ action: "test" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) sileo.error({ title: d.error || "No se pudo enviar" });
      else if (d.sent) sileo.success({ title: "Aviso enviado", description: "Debería llegarte en unos segundos" });
      else sileo.warning({ title: "No se pudo entregar", description: "Desactiva y vuelve a activar los avisos" });
    } finally { setBusy(false); }
  };

  const toggle = async (key: string) => {
    if (!info) return;
    const next = { ...info.prefs, [key]: !info.prefs[key] };
    setInfo({ ...info, prefs: next });
    const r = await apiFetch("/api/push", { method: "POST", body: JSON.stringify({ action: "prefs", prefs: { [key]: next[key] } }) });
    if (!r.ok) { setInfo({ ...info }); sileo.error({ title: "No se pudo guardar" }); }
  };

  return (
    <div style={card}>
      <div style={h2}><Bell size={14} strokeWidth={STROKE} aria-hidden="true" /> Avisos en este celular</div>
      <p style={p}>Te llegan aunque tengas el sistema cerrado, como un mensaje. Se activan una vez en cada celular o computadora.</p>

      {support === "checking" && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Revisando…</div>}

      {support === "ios-install" && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 14, fontSize: 12.5, color: "#9a3412", lineHeight: 1.6 }}>
          <b>En iPhone</b> los avisos solo funcionan con el sistema instalado en la pantalla de inicio (iOS 16.4 o más nuevo):
          <ol style={{ margin: "6px 0 0 18px" }}>
            <li>Toca <b>Compartir</b> en Safari</li>
            <li>Elige <b>“Agregar a inicio”</b></li>
            <li>Abre el sistema desde el ícono nuevo y vuelve aquí a <b>Mi cuenta</b></li>
          </ol>
        </div>
      )}

      {support === "unsupported" && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Este navegador no permite avisos. Usa Chrome, Edge o Firefox (en iPhone, instala el sistema en la pantalla de inicio).</div>
      )}

      {support === "ok" && info && (<>
        {perm === "denied" ? (
          <div style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.25)", borderRadius: 12, padding: 12, fontSize: 12.5, color: "#9f1239", lineHeight: 1.55 }}>
            Las notificaciones están <b>bloqueadas</b> para este sitio. Toca el candado junto a la dirección → <b>Permisos</b> → <b>Notificaciones: Permitir</b>, y recarga la página.
          </div>
        ) : here ? (<>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.35)", color: "var(--ok)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            ✓ Activados en este celular · {deviceName()}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={test} style={ghost}>Enviar aviso de prueba</button>
            <button disabled={busy} onClick={deactivate} style={ghost}>Desactivar</button>
          </div>
        </>) : (
          <button disabled={busy} onClick={activate} style={btn}>{busy ? "Activando…" : "Activar avisos en este celular"}</button>
        )}

        {others.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
            También activados en: {others.map((d) => d.device || "otro dispositivo").join(", ")}
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: "1px solid var(--bg-hover)", paddingTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>¿Qué avisos quieres recibir?</div>
          {info.categories.map((c) => {
            const on = !!info.prefs[c.key];
            return (
              <label key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--bg-primary)", cursor: "pointer" }}>
                <span style={{ fontSize: 13 }}>{c.label}{c.hint && <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11.5 }}>{c.hint}</small>}</span>
                <input type="checkbox" checked={on} onChange={() => toggle(c.key)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                <span aria-hidden="true" style={{ width: 40, height: 23, borderRadius: 99, background: on ? "var(--accent)" : "var(--border-strong)", position: "relative", flexShrink: 0, transition: "background-color 150ms ease" }}>
                  <span style={{ position: "absolute", top: 3, left: 3, width: 17, height: 17, borderRadius: "50%", background: "#fff", transform: on ? "translateX(17px)" : "none", transition: "transform 180ms cubic-bezier(0.23,1,0.32,1)", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                </span>
              </label>
            );
          })}
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Las preferencias valen para todos tus celulares. La campana del sistema sigue mostrando todo.</div>
        </div>
      </>)}
    </div>
  );
}
