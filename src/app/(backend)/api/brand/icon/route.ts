// Ícono de la app (pestaña del navegador, app instalada en el celular).
// Si la empresa subió un logo en Configuración se usa ese, centrado en un cuadrado blanco;
// si no, el ícono por defecto de /public. Todos los tamaños salen con esquinas redondeadas y
// transparentes, como los íconos de Windows 11 y del celular, menos el de iPhone (180).
import { readFile } from "fs/promises";
import path from "path";
import { getSettings } from "@/backend/company";
import { uploadPath } from "@/backend/uploads";

export const dynamic = "force-dynamic";

const SIZES = [32, 180, 192, 512];
const cache = new Map<string, Buffer>();

async function logoBytes(logo: string): Promise<Buffer | null> {
  const m = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(logo);
  if (m) return Buffer.from(m[1], "base64");
  if (logo.startsWith("/uploads/")) {
    const p = uploadPath(logo);
    return p ? readFile(p).catch(() => null) : null;
  }
  return null;
}

async function defaultIcon(size: number): Promise<Buffer> {
  // Logo del sistema (public/logo.svg); en 32 px, la versión simplificada
  const file = size > 192 ? "icon-512.png" : size <= 32 ? "icon-32.png" : "icon-192.png";
  return readFile(path.join(process.cwd(), "public", file));
}

/** Recorta el ícono con esquinas redondeadas (22 % del lado); las esquinas quedan transparentes */
async function rounded(icon: Buffer, size: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const r = Math.round(size * 0.22);
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`;
  return sharp(icon).resize(size, size).ensureAlpha().composite([{ input: Buffer.from(mask), blend: "dest-in" }]).png().toBuffer();
}

/** Igual que rounded(), guardado en memoria; si falla se devuelve el ícono cuadrado */
async function roundedCached(icon: Buffer, size: number, t: number): Promise<Buffer> {
  const key = `round:${t}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const out = await rounded(icon, size);
    cache.set(key, out);
    return out;
  } catch (e) {
    console.error("[brand/icon] No se pudieron redondear las esquinas:", e);
    return icon;
  }
}

/** Llave pequeña en la esquina: marca el ícono de la app del sistema (personal) */
async function withBadge(icon: Buffer, size: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const d = Math.round(size * 0.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="19" fill="#149aa5" stroke="#fff" stroke-width="2.5"/>
    <g transform="translate(9 9) scale(0.92)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </g></svg>`;
  const off = Math.round(size * 0.94) - d; // dentro del margen para que Android no lo recorte
  return sharp(icon).resize(size, size).composite([{ input: Buffer.from(svg), left: off, top: off }]).png().toBuffer();
}

function png(body: Buffer) {
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
  });
}

export async function GET(request: Request) {
  const req = Number(new URL(request.url).searchParams.get("size")) || 192;
  const size = SIZES.includes(req) ? req : 192;
  const badge = new URL(request.url).searchParams.get("badge") === "1" && size >= 180;
  const s = await getSettings();
  const base = await baseIcon(s, size);
  // 180 es el de iPhone: iOS ya lo redondea y pinta de negro las esquinas transparentes
  const out = size === 180 ? base : await roundedCached(base, size, s?.updatedAt?.getTime?.() ?? 0);
  if (!badge) return png(out);
  const key = `badge:r:${s?.updatedAt?.getTime?.() ?? 0}:${size}`;
  const hit = cache.get(key);
  if (hit) return png(hit);
  try {
    const b = await withBadge(out, size);
    cache.set(key, b);
    return png(b);
  } catch (e) {
    console.error("[brand/icon] No se pudo agregar la llave:", e);
    return png(out);
  }
}

async function baseIcon(s: Awaited<ReturnType<typeof getSettings>>, size: number): Promise<Buffer> {
  if (!s?.logo) return defaultIcon(size);

  const key = `${s.updatedAt?.getTime?.() ?? 0}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const src = await logoBytes(s.logo);
    if (!src) return defaultIcon(size);
    const sharp = (await import("sharp")).default;
    const inner = Math.round(size * 0.8); // margen para que Android no recorte el logo
    const logo = await sharp(src).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    const out = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
    if (cache.size > 20) cache.clear();
    cache.set(key, out);
    return out;
  } catch (e) {
    console.error("[brand/icon] No se pudo procesar el logo:", e);
    return defaultIcon(size);
  }
}
