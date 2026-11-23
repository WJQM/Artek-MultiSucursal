// Limitador de intentos en memoria (suficiente para un solo proceso PM2).
// Si en el futuro corres varias instancias, cámbialo por Redis.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Registra un intento para `key`. Devuelve { ok:false, retryAfter } si se superó el límite.
 */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > max) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function getClientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("x-real-ip") ||
    // Nginx agrega la IP real AL FINAL de X-Forwarded-For; las primeras las puede inventar el cliente
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}
