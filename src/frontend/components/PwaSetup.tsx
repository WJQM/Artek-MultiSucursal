"use client";
import { Smartphone, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  initPwa, subscribe, getSnapshot, getServerSnapshot, dismiss, promptInstall,
  bannerAlreadyShown, markBannerShown, appOf,
} from "@/frontend/lib/pwa";

// Páginas de impresión o de un solo uso: aquí no se ofrece instalar nada
// (el banner salía también en las hojas impresas). En /portal y /track tampoco: solo se instala el sistema.
const HIDE_ON = [
  "/certificate-view", "/delivery", "/print", "/print-qr",
  "/quotations/print", "/equipment/print", "/consoles/print", "/inventory/print",
  "/qr-batch/print", "/reports", "/setup",
];

const AUTO_HIDE_MS = 20_000;

/**
 * Registra el service worker y muestra el banner "Instalar app".
 * Antes volvía a aparecer en cada cambio de página porque solo se recordaba el "✕"
 * (y en sessionStorage). Ahora:
 *  - se muestra como máximo una vez por sesión y se oculta solo a los 20 s,
 *  - "✕" o rechazar la instalación lo oculta por 14 días,
 *  - después sigue disponible en el menú lateral → "Instalar app".
 */
export function PwaSetup() {
  const pathname = usePathname() || "/";
  const [visible, setVisible] = useState(false);
  const [appName, setAppName] = useState("la app");
  const portal = appOf(pathname) === "portal";

  useEffect(() => { initPwa(); }, []);
  // Nombre de la app (el mismo de su manifiesto: "[Empresa] Sistema")
  useEffect(() => {
    if (!visible) return;
    fetch("/manifest.json").then((r) => r.json()).then((m) => { if (m?.name) setAppName(m.name); }).catch(() => {});
  }, [visible]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const installable = snap[0] === "1";
  const dismissed = snap[1] === "1";
  const ios = snap[2] === "1"; // iPhone: no hay botón, se muestra cómo hacerlo

  const hiddenHere = HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const eligible = (installable || ios) && !dismissed && !hiddenHere && !portal;

  // Mostrar una sola vez por sesión
  useEffect(() => {
    if (!eligible || visible || bannerAlreadyShown()) return;
    markBannerShown();
    setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- muestra el aviso de instalación una vez por sesión
  }, [eligible, visible]);

  // Ocultarlo solo a los 20 s (efecto aparte para que el temporizador no se cancele al mostrarse)
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || !eligible) return null;

  const title = `Instalar ${appName}`;

  return (
    <div className="pwa-banner" role="dialog" aria-label="Instalar aplicación">
      <span style={{ display: "flex", flexShrink: 0 }}><Smartphone size={26} strokeWidth={STROKE} aria-hidden="true" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        {ios && !installable ? (
          <div style={{ fontSize: 11.5, opacity: 0.95, lineHeight: 1.45 }}>
            Toca <b>Compartir</b>{" "}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px" }} aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
            {" "}y luego <b>Agregar a inicio</b>
          </div>
        ) : (
          <div style={{ fontSize: 11, opacity: 0.9 }}>Acceso rápido como app</div>
        )}
      </div>
      {installable && (
        <button
          onClick={async () => { setVisible(false); await promptInstall(); }}
          style={{ padding: "8px 14px", background: "#fff", color: "var(--accent-dim)", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
        >
          Instalar
        </button>
      )}
      <button
        onClick={() => { dismiss(); setVisible(false); }}
        style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        title="No mostrar por 14 días"
        aria-label="Cerrar"
      >
        <X size={16} strokeWidth={STROKE} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Opción del menú lateral: aparece mientras el navegador permita instalar (aunque se haya cerrado el banner). */
export function useCanInstall(): boolean {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return snap[0] === "1";
}
