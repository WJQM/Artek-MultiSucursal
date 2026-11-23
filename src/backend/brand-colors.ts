// Colores de la marca guardados en KeyValue ("brand.colors"). Caché corta: se leen en cada página.
import { readKV, writeKV } from "./automation";
import { BRAND_DEFAULT, isHexColor, isPrintMode, normalizeBrand, type BrandColors } from "@/shared/brand-colors";

const KEY = "brand.colors";
const TTL_MS = 30_000;
let cache: { at: number; value: BrandColors } | null = null;

/** Colores elegidos en Configuración › Colores (los originales si no hay nada guardado) */
export async function getBrandColors(): Promise<BrandColors> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const raw = await readKV<Partial<BrandColors> | null>(KEY, null).catch(() => null);
  const value: BrandColors = {
    accent: isHexColor(raw?.accent) ? raw.accent.toLowerCase() : BRAND_DEFAULT.accent,
    dark: isHexColor(raw?.dark) ? raw.dark.toLowerCase() : BRAND_DEFAULT.dark,
    print: isPrintMode(raw?.print) ? raw.print : "bw",
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function saveBrandColors(c: BrandColors) {
  const v: BrandColors = { accent: c.accent.toLowerCase(), dark: c.dark.toLowerCase(), print: isPrintMode(c.print) ? c.print : "bw" };
  await writeKV(KEY, v);
  cache = { at: Date.now(), value: v };
}

/** Color de la barra del celular y de la app instalada (el Oscuro, ya ajustado) */
export async function brandThemeColor() {
  return normalizeBrand(await getBrandColors()).dark;
}
