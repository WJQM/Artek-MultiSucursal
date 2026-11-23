// Acceso del cliente a los datos completos de su orden en el portal / seguimiento público.
// El cliente demuestra que es el dueño con los últimos 4 dígitos de su celular y recibe un pase
// firmado (válido 12 h) solo para ESA orden. Nunca sirve como sesión del sistema.
import jwt from "jsonwebtoken";
import { createHmac, timingSafeEqual } from "crypto";
import { getJwtSecret } from "./jwt-secret";

const AUD = "rt-track";
const TTL = "12h";

export function signTrackToken(repairId: string): string {
  return jwt.sign({ sub: repairId }, getJwtSecret(), { audience: AUD, expiresIn: TTL, algorithm: "HS256" });
}

export function trackTokenRepairId(token: string | null | undefined): string | null {
  if (!token || token.length > 1000) return null;
  try {
    const p = jwt.verify(token, getJwtSecret(), { audience: AUD, algorithms: ["HS256"] }) as jwt.JwtPayload;
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

/** Pase enviado por el navegador del cliente (cabecera x-track-token) */
export function readTrackToken(request: Request): string | null {
  return request.headers.get("x-track-token");
}

/** Compara los últimos 4 dígitos del celular registrado */
export function phoneMatches(registered: string | null | undefined, digits: unknown): boolean {
  const reg = String(registered || "").replace(/\D/g, "");
  const d = String(digits ?? "").replace(/\D/g, "");
  return reg.length >= 4 && d.length === 4 && reg.slice(-4) === d;
}

// ── Enlace personal del cliente (WhatsApp) ──────────────────────────────────
// En vez de pedir los 4 dígitos, el mensaje de WhatsApp lleva un enlace con una firma corta
// ligada a ESA orden: /track/OT-5?k=<vence>.<firma>. Vale LINK_DAYS días; al abrirlo el
// navegador lo cambia por el pase normal de 12 h (ver /api/track/[code]/link).

const LINK_DAYS = 120;

function linkSignature(repairId: string, exp: string): string {
  return createHmac("sha256", getJwtSecret()).update(`rt-link:${repairId}:${exp}`).digest("base64url").slice(0, 22);
}

export function signClientLink(repairId: string, days = LINK_DAYS): string {
  const exp = Math.floor(Date.now() / 1000 + days * 86_400).toString(36);
  return `${exp}.${linkSignature(repairId, exp)}`;
}

export function verifyClientLink(repairId: string, k: unknown): boolean {
  if (typeof k !== "string" || k.length > 64) return false;
  const [exp, sig] = k.split(".");
  if (!exp || !sig) return false;
  const expSec = parseInt(exp, 36);
  if (!Number.isFinite(expSec) || expSec * 1000 < Date.now()) return false;
  const expected = Buffer.from(linkSignature(repairId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** URL pública del seguimiento con el enlace personal ya verificado */
export function clientTrackUrl(origin: string, repair: { id: string; code: string }): string {
  return `${origin.replace(/\/+$/, "")}/track/${encodeURIComponent(repair.code)}?k=${signClientLink(repair.id)}`;
}
