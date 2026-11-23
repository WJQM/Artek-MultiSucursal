import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { getJwtSecret } from "./jwt-secret";
import { prisma } from "./prisma";

export interface TokenUser {
  id: string;
  email: string;
  role: string;       // "superadmin" | "admin" | "tech"
  branchId: string | null;
}

export const ROLES = ["superadmin", "admin", "tech"] as const;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function verify(token: string): (TokenUser & { tv: number }) | null {
  try {
    // jwt.verify devuelve string si el token no es un objeto: en ese caso no hay id y se rechaza
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as jwt.JwtPayload & { id?: string; email?: string; role?: string; branchId?: string | null; tv?: number };
    // Los tokens de "desafío" (paso intermedio del login) no son sesiones
    const role = payload?.role;
    if (!payload?.id || payload.aud || !role || !(ROLES as readonly string[]).includes(role)) return null;
    return { id: payload.id, email: payload.email ?? "", role, branchId: payload.branchId ?? null, tv: Number(payload.tv || 0) };
  } catch {
    return null;
  }
}

// ---- Validación contra la base de datos (con caché corta) ----
// Permite revocar sesiones al instante: cambio de contraseña, "cerrar todas las sesiones",
// suspender o eliminar un usuario. También toma el rol/sucursal actuales (no los del token).
type Live = { tokenVersion: number; status: string; role: string; branchId: string | null; email: string; at: number };
const liveCache = new Map<string, Live>();
const CACHE_MS = 10_000;

export function invalidateUserCache(userId: string) {
  liveCache.delete(userId);
}

async function loadLive(userId: string): Promise<Live | null> {
  const hit = liveCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true, status: true, role: true, branchId: true, email: true },
  });
  if (!u) { liveCache.delete(userId); return null; }
  const live = { ...u, at: Date.now() };
  liveCache.set(userId, live);
  if (liveCache.size > 5000) liveCache.clear();
  return live;
}

async function resolve(token: string): Promise<TokenUser | null> {
  const t = verify(token);
  if (!t) return null;
  const live = await loadLive(t.id);
  if (!live || live.status !== "active" || live.tokenVersion !== t.tv) return null;
  return { id: t.id, email: live.email, role: live.role, branchId: live.branchId };
}

/**
 * Obtiene el usuario desde el header Authorization: Bearer <token>.
 * Con { allowCookie: true } (solo en GET) también acepta la cookie httpOnly "token";
 * así las páginas internas que usan fetch() simple, como la impresión de OT,
 * reciben los datos completos. Nunca se acepta la cookie en POST/PATCH/DELETE (CSRF).
 * Verifica en la base que la sesión siga vigente (usuario activo y no revocada).
 */
export async function getUserFromToken(request: Request, opts: { allowCookie?: boolean } = {}): Promise<TokenUser | null> {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const u = await resolve(auth.slice(7).trim());
    if (u) return u;
  }
  const method = request.method?.toUpperCase() || "GET";
  if (opts.allowCookie && (method === "GET" || method === "HEAD")) {
    const cookie = readCookie(request, "token");
    if (cookie) return resolve(cookie);
  }
  return null;
}

export async function requireAuth(request: Request): Promise<TokenUser> {
  const user = await getUserFromToken(request);
  if (!user) throw new Error("NO_AUTH");
  return user;
}

export { readCookie };

export function isAdmin(user: TokenUser | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.role === "superadmin");
}

/** true si el usuario puede ver/modificar registros de esa sucursal */
export function canAccessBranch(user: TokenUser, branchId: string | null | undefined): boolean {
  if (user.role === "superadmin") return true;
  return !!branchId && !!user.branchId && user.branchId === branchId;
}

export function getBranchFilter(user: TokenUser, headerBranchId?: string | null): string | null {
  if (user.role === "superadmin") return headerBranchId || null; // null = todas
  return user.branchId;
}

export function getEffectiveBranchId(request: Request, user: TokenUser): string | null {
  if (user.role === "superadmin") return request.headers.get("x-branch-id") || null;
  return user.branchId;
}

// Respuestas estándar
export const unauthorized = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });
export const forbidden = (msg = "Sin permisos") => NextResponse.json({ error: msg }, { status: 403 });
export const notFound = (msg = "No encontrado") => NextResponse.json({ error: msg }, { status: 404 });

/** Devuelve el usuario si es admin/superadmin, o una respuesta de error lista para retornar. */
export async function requireAdmin(request: Request): Promise<TokenUser | NextResponse> {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  return user;
}

/** Oculta un texto dejando visibles los últimos `visible` caracteres. */
export function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) return value ?? null;
  const s = String(value);
  if (s.length <= visible) return "•".repeat(s.length);
  return s.slice(0, -visible).replace(/[A-Za-z0-9]/g, "•") + s.slice(-visible);
}

/** "Juan Pérez López" → "Juan P." */
export function maskName(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const parts = String(value).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
