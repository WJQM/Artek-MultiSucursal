/**
 * Ubicación de sucursales: leer coordenadas de lo que pegue el administrador y armar enlaces de mapa.
 * Las funciones puras sirven en el navegador y en el servidor; resolveLocation() (enlaces cortos) solo en el servidor.
 */

export interface LatLng { lat: number; lng: number }

const valid = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
    : null;

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * Acepta coordenadas ("-17.3935, -66.157") o enlaces largos de Google Maps
 * (…/@-17.39,-66.15,17z, ?q=-17.39,-66.15, !3d-17.39!4d-66.15, ll=…, destination=…).
 */
export function parseLocation(input: string | null | undefined): LatLng | null {
  let s = (input || "").trim();
  try { s = decodeURIComponent(s); } catch { /* texto con % sueltos: se usa tal cual */ }
  s = s.replace(/\s+/g, " ");
  if (!s) return null;
  // Coordenadas sueltas
  let m = s.match(new RegExp(`^${NUM}\\s*[,; ]\\s*${NUM}$`));
  if (m) return valid(+m[1], +m[2]);
  // Punto exacto del lugar (más preciso que el centro de la vista @)
  m = s.match(new RegExp(`!3d${NUM}!4d${NUM}`));
  if (m) return valid(+m[1], +m[2]);
  m = s.match(new RegExp(`[?&](?:q|query|ll|destination|center|daddr)=(?:loc:)?${NUM}\\s*,\\s*${NUM}`));
  if (m) return valid(+m[1], +m[2]);
  m = s.match(new RegExp(`@${NUM},${NUM}`));
  if (m) return valid(+m[1], +m[2]);
  return null;
}

/** Enlaces cortos que se pueden abrir para leer las coordenadas (solo Google, para no abrir cualquier dirección). */
export function isShortMapsLink(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" && ["maps.app.goo.gl", "goo.gl"].includes(u.hostname) && (u.hostname !== "goo.gl" || u.pathname.startsWith("/maps"));
  } catch { return false; }
}

const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.[a-z.]{2,6}$|^maps\.app\.goo\.gl$|^goo\.gl$|^consent\.google\.[a-z.]+$/;

/** Solo servidor: sigue las redirecciones de un enlace corto de Google Maps (máx. 4) y lee las coordenadas. */
export async function resolveLocation(input: string): Promise<LatLng | null> {
  const direct = parseLocation(input);
  if (direct || !isShortMapsLink(input)) return direct;
  let url = input.trim();
  for (let i = 0; i < 4; i++) {
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" } });
    } catch { return null; }
    const next = res.headers.get("location");
    if (!next) {
      // Algunas respuestas traen el destino en el HTML
      const html = await res.text().catch(() => "");
      return parseLocation(html.match(/https:\/\/www\.google\.[^"'\s]+\/maps[^"'\s]*/)?.[0] || "");
    }
    const target = new URL(next, url);
    if (!GOOGLE_HOST.test(target.hostname)) return null;
    // La página de consentimiento lleva el destino real en ?continue=
    const cont = target.searchParams.get("continue");
    const found = parseLocation(target.href) || (cont ? parseLocation(cont) : null);
    if (found) return found;
    url = cont || target.href;
  }
  return null;
}

export const fmtLatLng = (p: LatLng) => `${p.lat}, ${p.lng}`;

/** Mapa para insertar en la página (no requiere clave de Google). */
export const mapEmbedUrl = (p: LatLng, zoom = 16) => `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=${zoom}&hl=es&output=embed`;

/** Abre la ruta hasta la sucursal en Google Maps (en el celular abre la app). */
export const directionsUrl = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

export const wazeUrl = (p: LatLng) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;

export function branchLatLng(b: { latitude?: number | null; longitude?: number | null } | null | undefined): LatLng | null {
  return b && b.latitude != null && b.longitude != null ? valid(b.latitude, b.longitude) : null;
}
