"use client";

import { useEffect, useRef } from "react";

/**
 * Pantallas que se actualizan solas.
 *
 *   useLiveRefresh(["Branch"], () => loadData());
 *
 * 1. Tiempo real: una sola conexión (/api/live) por pestaña; cuando alguien guarda un dato de esos
 *    tipos en cualquier PC, la pantalla vuelve a pedir sus datos (~1 segundo).
 * 2. Respaldo: al volver a la pestaña/ventana recarga, y si la conexión en tiempo real está caída
 *    recarga cada 30 s mientras la pantalla está a la vista.
 */

type Sub = { topics: Set<string>; fire: () => void };

const subs = new Set<Sub>();
let source: EventSource | null = null;
let connected = false;
let wasDisconnected = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (source || typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (document.visibilityState === "hidden") return;
  const es = new EventSource("/api/live");
  source = es;
  es.addEventListener("ready", () => {
    // Si se había cortado, pudo perderse algún aviso: todas las pantallas recargan una vez
    if (wasDisconnected) subs.forEach((s) => s.fire());
    connected = true;
    wasDisconnected = false;
  });
  es.addEventListener("change", (e) => {
    let topic = "";
    try { topic = JSON.parse((e as MessageEvent).data).t; } catch { return; }
    subs.forEach((s) => { if (s.topics.has(topic)) s.fire(); });
  });
  es.onerror = () => {
    connected = false;
    wasDisconnected = true;
    // El navegador reintenta solo; si la cerró (ej. sesión vencida) se reintenta en 30 s
    if (es.readyState === EventSource.CLOSED) {
      source = null;
      if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; if (subs.size) connect(); }, 30_000);
    }
  };
}

// Pestañas en segundo plano: se cierra la conexión (el navegador permite pocas por sitio) y se
// reabre al volver; la recarga al volver a la pestaña cubre lo que cambió mientras tanto.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Al volver, "ready" recarga todas las pantallas por si algo cambió mientras tanto
      if (source) { source.close(); source = null; connected = false; wasDisconnected = true; }
    } else if (subs.size) connect();
  });
}

function subscribe(sub: Sub) {
  subs.add(sub);
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  connect();
  return () => {
    subs.delete(sub);
    // Al cambiar de pantalla no se corta: la siguiente la reutiliza
    if (!subs.size && !closeTimer) closeTimer = setTimeout(() => {
      closeTimer = null;
      if (!subs.size && source) { source.close(); source = null; connected = false; }
    }, 5_000);
  };
}

/** true si la conexión en tiempo real está activa en esta pestaña */
export const isLiveConnected = () => connected;

export function useLiveRefresh(topics: string[], reload: () => unknown, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; });
  const key = topics.join(",");

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = Date.now();
    const run = () => {
      timer = null;
      last = Date.now();
      try { void reloadRef.current(); } catch {}
    };
    // Varios avisos seguidos → una sola recarga
    const fire = () => { if (!timer) timer = setTimeout(run, 400); };

    const unsubscribe = subscribe({ topics: new Set(key.split(",")), fire });

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 3_000) fire();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const poll = setInterval(() => {
      if (!connected && document.visibilityState === "visible" && Date.now() - last >= 29_000) fire();
    }, 30_000);

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [key, enabled]);
}
