// Colores de la marca (Configuración › Colores): el dueño elige dos colores y de ahí salen todos los tonos.
//  - "accent" (Principal): botones, enlaces, pestañas activas.
//  - "dark"   (Oscuro): menú lateral, barra de arriba y portadas.
// Si el color elegido es tan claro que las letras blancas encima no se leerían, se oscurece lo justo.
// Lo usan el servidor (escribe las variables en <head>) y la pantalla de Configuración (vista previa).
// "print": documentos impresos en blanco y negro (como siempre, ahorra tóner) o a color (banda con el Oscuro, detalles con el Principal).

export type PrintMode = "bw" | "color";
export type BrandColors = { accent: string; dark: string; print?: PrintMode };
export const isPrintMode = (v: unknown): v is PrintMode => v === "bw" || v === "color";

export const BRAND_DEFAULT: BrandColors = { accent: "#0e7c86", dark: "#1e2a3a" };

export const BRAND_PRESETS: { key: string; label: string; accent: string; dark: string }[] = [
  { key: "original", label: "Original", accent: "#0e7c86", dark: "#1e2a3a" },
  { key: "azul", label: "Azul", accent: "#2563eb", dark: "#1e293b" },
  { key: "verde", label: "Verde", accent: "#15803d", dark: "#14281d" },
  { key: "morado", label: "Morado", accent: "#7c3aed", dark: "#2a1f44" },
  { key: "vino", label: "Vino", accent: "#b91c1c", dark: "#2b1517" },
  { key: "gris", label: "Gris", accent: "#475569", dark: "#1f2937" },
];

// Tonos originales, tal como estaban en globals.css (para que "Original" quede idéntico)
const ACCENT_ORIGINAL = {
  "--accent": "#0e7c86", "--accent-rgb": "14, 124, 134", "--accent-light": "#14a3ad", "--accent-dim": "#0b6b74",
  "--accent-bright": "#1ab8c4", "--accent-bright-rgb": "26, 184, 196", "--accent-ink": "#0a5c64",
  "--accent-bg": "#e6f4f5", "--accent-bg-hover": "#d5edef", "--accent-bg-soft": "#e6fafb", "--accent-border-soft": "#99e5ea",
  "--accent-on-dark": "#5eead4", "--accent-on-dark-rgb": "94, 234, 212", "--accent-on-dark-soft": "#5fd4dc",
  "--accent-on-dark-soft-rgb": "95, 212, 220", "--accent-on-dark-alt": "#67e8f9", "--accent-label-on-dark": "#0e7c86",
};
const DARK_ORIGINAL = { "--brand-dark": "#1e2a3a", "--brand-dark-deep": "#172030" };

/** Contraste mínimo con letras blancas: botones (Principal) y menú (Oscuro, lleva textos blancos tenues) */
export const MIN_CONTRAST = { accent: 4.5, dark: 9 };

export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = ([r, g, b]: RGB) => "#" + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("");

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Contraste de un color con letras blancas (1 a 21) */
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** Oscurece el color lo justo para que las letras blancas encima se lean */
function readable(hex: string, min: number): { hex: string; adjusted: boolean } {
  const c = hex.toLowerCase();
  if (contrastWithWhite(c) >= min) return { hex: c, adjusted: false };
  const [h, s, l] = toHsl(toRgb(c));
  for (let ll = l; ll >= 0; ll -= 0.005) {
    const x = fromHsl(h, s, ll);
    if (contrastWithWhite(x) >= min) return { hex: x, adjusted: true };
  }
  return { hex: "#000000", adjusted: true };
}

/** Colores que se usan de verdad (ya ajustados) y si hubo que oscurecerlos */
export function normalizeBrand(c: Partial<BrandColors> | null | undefined) {
  const a = readable(isHexColor(c?.accent) ? c.accent : BRAND_DEFAULT.accent, MIN_CONTRAST.accent);
  const d = readable(isHexColor(c?.dark) ? c.dark : BRAND_DEFAULT.dark, MIN_CONTRAST.dark);
  return { accent: a.hex, dark: d.hex, accentAdjusted: a.adjusted, darkAdjusted: d.adjusted };
}

export const isDefaultBrand = (c: Partial<BrandColors> | null | undefined) => {
  const n = normalizeBrand(c);
  return n.accent === BRAND_DEFAULT.accent && n.dark === BRAND_DEFAULT.dark;
};

/** Todas las variables CSS de la marca a partir de los dos colores */
export function brandVars(c: Partial<BrandColors> | null | undefined): Record<string, string> {
  const n = normalizeBrand(c);
  let accent: Record<string, string> = ACCENT_ORIGINAL;
  if (n.accent !== BRAND_DEFAULT.accent) {
    const [h, s, l] = toHsl(toRgb(n.accent));
    const bright = fromHsl(h, s, Math.min(l + 0.15, 0.75));
    const soft = Math.min(s, 0.9);
    accent = {
      "--accent": n.accent, "--accent-rgb": toRgb(n.accent).join(", "),
      "--accent-light": fromHsl(h, s, Math.min(l + 0.09, 0.7)),
      "--accent-dim": fromHsl(h, s, l - 0.045),
      "--accent-bright": bright, "--accent-bright-rgb": toRgb(bright).join(", "),
      "--accent-ink": fromHsl(h, s, l - 0.075),
      "--accent-bg": fromHsl(h, soft * 0.5, 0.93),
      "--accent-bg-hover": fromHsl(h, soft * 0.53, 0.89),
      "--accent-bg-soft": fromHsl(h, soft * 0.7, 0.95),
      "--accent-border-soft": fromHsl(h, soft * 0.65, 0.76),
    };
    const onDark = fromHsl(h, s > 0.25 ? Math.min(Math.max(s, 0.6), 0.85) : s, Math.min(Math.max(l + 0.3, 0.62), 0.78));
    accent["--accent-on-dark"] = onDark;
    accent["--accent-on-dark-rgb"] = toRgb(onDark).join(", ");
    const softDark = fromHsl(h, s > 0.25 ? Math.min(Math.max(s, 0.55), 0.75) : s, Math.min(Math.max(l + 0.28, 0.6), 0.74));
    accent["--accent-on-dark-soft"] = softDark;
    accent["--accent-on-dark-soft-rgb"] = toRgb(softDark).join(", ");
    accent["--accent-on-dark-alt"] = onDark; // etiqueta "Super Admin" e "Instalar app"
    accent["--accent-label-on-dark"] = softDark; // textos del color principal sobre el menú oscuro
  }
  let dark: Record<string, string> = DARK_ORIGINAL;
  if (n.dark !== BRAND_DEFAULT.dark) {
    const [h, s, l] = toHsl(toRgb(n.dark));
    dark = { "--brand-dark": n.dark, "--brand-dark-deep": fromHsl(h, s, l - 0.035) };
  }
  return { ...accent, ...dark };
}

// Documentos a color: reemplazan las variables --doc-* de globals.css (que por defecto dejan todo en negro)
const DOC_COLOR = { "--doc-band": "var(--brand-dark)", "--doc-accent": "var(--accent)", "--doc-code": "var(--accent-on-dark)", "--doc-stripe": "var(--accent)", "--doc-logo-filter": "none", "--doc-label": "var(--accent)" };

/** Hoja de estilo para <head>: vacía si son los colores originales y los documentos en blanco y negro (todo lo trae globals.css) */
export function brandCss(c: Partial<BrandColors> | null | undefined): string {
  const vars = { ...(isDefaultBrand(c) ? {} : brandVars(c)), ...(c?.print === "color" ? DOC_COLOR : {}) };
  const list = Object.entries(vars);
  return list.length ? ":root{" + list.map(([k, v]) => `${k}:${v}`).join(";") + "}" : "";
}
