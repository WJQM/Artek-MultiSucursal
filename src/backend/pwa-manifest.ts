// Las dos apps instalables del sitio:
//  - "sistema": para el personal (login → panel / mis asignaciones). Ícono con una llave pequeña.
//  - "portal":  para los clientes (portal público y seguimiento de su equipo).
// Nombre, slogan e ícono salen de Admin → Configuración.
import { getSettings, DEFAULT_COMPANY_NAME } from "@/backend/company";
import { brandThemeColor } from "@/backend/brand-colors";

export type PwaApp = "sistema" | "portal";

/** Nombre corto para el ícono del celular (Android corta a ~12 letras) */
function shortName(name: string, max: number) {
  return name.length > max ? name.split(/\s+/)[0].slice(0, max) : name;
}

export async function pwaNames() {
  const s = await getSettings();
  const name = s?.companyName?.trim() || DEFAULT_COMPANY_NAME;
  const v = s?.updatedAt ? s.updatedAt.getTime() : 0;
  return { name, slogan: s?.slogan || "", v };
}

export function iconUrl(size: number, v: number, app: PwaApp) {
  return `/api/brand/icon?size=${size}&v=${v}${app === "sistema" ? "&badge=1" : ""}`;
}

export async function buildManifest(app: PwaApp) {
  const { name, slogan, v } = await pwaNames();
  const isSys = app === "sistema";
  const color = await brandThemeColor(); // el Oscuro de Configuración › Colores
  const manifest = {
    id: isSys ? "/" : "/portal",
    name: isSys ? `${name} Sistema` : name,
    // Android corta los nombres largos: "ARTEK Sistema" cabe; si no, solo el nombre (el ícono ya lleva la llave)
    short_name: isSys ? (`${shortName(name, 12)} Sistema`.length <= 14 ? `${shortName(name, 12)} Sistema` : shortName(name, 12)) : shortName(name, 12),
    description: isSys ? "Sistema del taller: órdenes, técnicos y reportes" : (slogan || "Consulta tu equipo y mira nuestro catálogo"),
    start_url: isSys ? "/?source=pwa" : "/portal?source=pwa",
    // El portal también usa "/" para que el seguimiento (/track/…) se abra dentro de la app
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: color,
    theme_color: color,
    lang: "es",
    icons: [
      { src: iconUrl(192, v, app), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl(512, v, app), sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    ...(isSys ? { shortcuts: [{ name: "Panel", short_name: "Panel", url: "/dashboard" }] } : {}),
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" },
  });
}
