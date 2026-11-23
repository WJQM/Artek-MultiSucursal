import { EventEmitter } from "events";

/**
 * Avisos en tiempo real (servidor). Cuando se guarda algo en la base de datos se avisa
 * qué tipo de dato cambió ("Branch", "Repair"…) a las pantallas abiertas por /api/live.
 * Vive en memoria: sirve porque la app corre en un solo proceso (PM2 instances: 1).
 */
const g = globalThis as unknown as { __liveBus?: EventEmitter; __livePending?: Set<string>; __liveTimer?: ReturnType<typeof setTimeout> | null };

export const liveBus: EventEmitter = g.__liveBus ?? (g.__liveBus = (() => { const e = new EventEmitter(); e.setMaxListeners(0); return e; })());

/** Datos que no le interesan a ninguna pantalla (visitas, códigos de verificación…). */
const IGNORED = new Set(["PageView", "VerificationCode", "TrustedDevice", "KeyValue", "ChatRead"]);

/** Agrupa los cambios de ~200 ms en un solo aviso por tipo (una venta toca varias tablas a la vez). */
export function notifyChange(model: string | undefined) {
  if (!model || IGNORED.has(model)) return;
  const pending = g.__livePending ?? (g.__livePending = new Set());
  pending.add(model);
  if (g.__liveTimer) return;
  g.__liveTimer = setTimeout(() => {
    g.__liveTimer = null;
    const topics = [...pending];
    pending.clear();
    for (const t of topics) liveBus.emit("change", t);
  }, 200);
}
