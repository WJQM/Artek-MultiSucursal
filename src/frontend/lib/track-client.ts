"use client";
// Navegador del cliente: pase de acceso a su orden (ver src/backend/track-access.ts)

export const passKey = (code: string) => `rt_track_pass:${code.toUpperCase()}`;

export function readPass(code: string): { id: string; token: string } | null {
  try { const v = sessionStorage.getItem(passKey(code)); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function savePass(code: string, id: string, token: string) {
  try { sessionStorage.setItem(passKey(code), JSON.stringify({ id, token })); } catch {}
}

/** URL de /api/track; desde el portal siempre en modo público (aunque haya sesión del personal) */
export function trackUrl(code: string, branchId: string | null) {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branchId", branchId);
  try { if (new URLSearchParams(window.location.search).get("from") === "portal") qs.set("public", "1"); } catch {}
  const q = qs.toString();
  return `/api/track/${code}${q ? `?${q}` : ""}`;
}

export function trackHeaders(code: string): HeadersInit {
  const p = readPass(code);
  return p?.token ? { "x-track-token": p.token } : {};
}

/** Pide el pase con los últimos 4 dígitos del celular. Devuelve el token o lanza el mensaje de error. */
export async function requestPass(code: string, repairId: string, digits: string): Promise<string> {
  const res = await fetch(`/api/track/${code}/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repairId, digits }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.token) throw new Error(d.error || "No se pudo verificar");
  savePass(code, repairId, d.token);
  return d.token;
}

/**
 * Si la página se abrió desde el enlace personal de WhatsApp (?k=...), lo cambia por el pase
 * y quita la firma de la barra de direcciones. Devuelve la sucursal de la orden (o null).
 */
export async function passFromLink(code: string): Promise<string | null> {
  try {
    const url = new URL(window.location.href);
    const k = url.searchParams.get("k");
    if (!k) return null;
    url.searchParams.delete("k");
    const res = await fetch(`/api/track/${code}/link`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.token) {
      savePass(code, d.repairId, d.token);
      if (d.branchId) url.searchParams.set("branchId", d.branchId);
    }
    window.history.replaceState(null, "", url.toString());
    return res.ok ? d.branchId || null : null;
  } catch { return null; }
}
