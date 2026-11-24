// La única app instalable del sitio es la del SISTEMA, para el personal (login → panel /
// mis asignaciones); su ícono lleva una llave pequeña. El portal de clientes no se instala:
// se abre en el navegador. "portal" solo se usa para el ícono de la pestaña (sin la llave).
// Nombre e ícono salen de Admin → Configuración.
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
  return { name, v };
}

export function iconUrl(size: number, v: number, app: PwaApp) {
  return `/api/brand/icon?size=${size}&v=${v}${app === "sistema" ? "&badge=1" : ""}`;
}

export async function buildManifest() {
  const { name, v } = await pwaNames();
  const color = await brandThemeColor(); // el Oscuro de Configuración › Colores
  // Android corta los nombres largos: "ARTEK Sistema" cabe; si no, solo el nombre (el ícono ya lleva la llave)
  const short = `${shortName(name, 12)} Sistema`;
  const manifest = {
    id: "/",
    name: `${name} Sistema`,
    short_name: short.length <= 14 ? short : shortName(name, 12),
    description: "Sistema del taller: órdenes, técnicos y reportes",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: color,
    theme_color: color,
    lang: "es",
    icons: [
      { src: iconUrl(192, v, "sistema"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl(512, v, "sistema"), sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [{ name: "Panel", short_name: "Panel", url: "/dashboard" }],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" },
  });
}
