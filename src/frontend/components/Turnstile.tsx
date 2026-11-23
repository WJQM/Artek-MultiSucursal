"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

let configPromise: Promise<{ turnstileSiteKey: string | null }> | null = null;
function loadConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/auth/config").then((r) => r.json()).catch(() => ({ turnstileSiteKey: null }));
  }
  return configPromise;
}

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("turnstile")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Captcha de Cloudflare Turnstile (casi siempre invisible).
 * Si no hay claves configuradas en el servidor, no muestra nada y entrega "" (el servidor lo omite).
 * Cambia `resetKey` después de cada envío: el token de Turnstile sirve una sola vez.
 */
export function Turnstile({ onToken, resetKey = 0, onEnabled }: { onToken: (token: string) => void; resetKey?: number; onEnabled?: (enabled: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onToken("");
    loadConfig().then(async (cfg) => {
      if (cancelled) return;
      onEnabled?.(!!cfg.turnstileSiteKey);
      if (!cfg.turnstileSiteKey) { onToken(""); return; }
      try {
        await loadScript();
        if (cancelled || !box.current || !window.turnstile) return;
        if (widgetId.current) window.turnstile.remove(widgetId.current);
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: cfg.turnstileSiteKey,
          language: "es",
          appearance: "interaction-only",
          callback: (t: string) => { setError(false); onToken(t); },
          "expired-callback": () => onToken(""),
          "error-callback": () => { setError(true); onToken(""); },
        });
      } catch { setError(true); }
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) { try { window.turnstile.remove(widgetId.current); } catch {} widgetId.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <div>
      <div ref={box} style={{ display: "flex", justifyContent: "center" }} />
      {error && <p style={{ fontSize: 11, color: "var(--danger-bright)", textAlign: "center", marginTop: 6 }}>No se pudo cargar la verificación anti-robots. Revisa tu conexión y recarga la página.</p>}
    </div>
  );
}
