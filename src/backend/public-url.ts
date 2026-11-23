// Dirección pública del sistema (la que se manda al cliente por WhatsApp).
// Prioridad: APP_URL del .env → cabeceras del proxy (Nginx) → dirección de la petición.
export function publicBaseUrl(request?: Request): string {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (request) {
    const h = request.headers;
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = (h.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
    if (host) return `${proto}://${host.split(",")[0].trim()}`;
    return new URL(request.url).origin;
  }
  return "";
}
