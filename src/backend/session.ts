// Emisión de sesiones y flujo de inicio de sesión por pasos
// (contraseña → [cambiar contraseña] → [doble verificación] → sesión)
import { getSettings, DEFAULT_COMPANY_NAME } from "./company";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getJwtSecret } from "./jwt-secret";
import { readCookie, invalidateUserCache } from "./auth";
import { decrypt, pepperHash, randomToken, safeEqualHex } from "./secure";
import { totpStep } from "./totp";
import { maskPhone, normalizePhone } from "./otp";

export const SESSION_TTL_S = 7 * 24 * 60 * 60;
const CHALLENGE_TTL_S = 15 * 60;
const TRUST_DAYS = 30;
export const TRUST_COOKIE = "rt_td";

export const cookieSecure = () => process.env.NODE_ENV === "production" && process.env.COOKIE_INSECURE !== "1";

type SessionUser = {
  id: string; name: string; email: string; role: string; branchId: string | null; image: string | null;
  tokenVersion: number; branch?: { name: string } | null;
};

/** Respuesta de login exitoso: token + datos + cookie httpOnly (igual formato que antes). */
export function sessionResponse(user: SessionUser, extra: Record<string, unknown> = {}, init?: ResponseInit) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: user.branchId, tv: user.tokenVersion },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: SESSION_TTL_S }
  );
  const res = NextResponse.json({
    token,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      branchId: user.branchId, branchName: user.branch?.name || null, image: user.image || null,
    },
    ...extra,
  }, init);
  res.cookies.set("token", token, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: SESSION_TTL_S });
  return res;
}

// ---------- Desafío (token de un paso intermedio, NO sirve como sesión) ----------
export type Stage = "change_password" | "2fa" | "2fa_setup" | "verify_phone" | "reset";
export type Challenge = { uid: string; stage: Stage; tv: number; phone?: string };

export function signChallenge(c: Challenge): string {
  return jwt.sign(c, getJwtSecret(), { algorithm: "HS256", expiresIn: CHALLENGE_TTL_S, audience: "rt-challenge" });
}

export function verifyChallenge(token: unknown): Challenge | null {
  if (typeof token !== "string") return null;
  try {
    const p = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], audience: "rt-challenge" }) as jwt.JwtPayload & Partial<Challenge>;
    if (!p?.uid || !p?.stage) return null;
    return { uid: p.uid, stage: p.stage, tv: Number(p.tv || 0), phone: p.phone };
  } catch {
    return null;
  }
}

// ---------- Dispositivos de confianza ----------
export async function isTrustedDevice(request: Request, userId: string): Promise<boolean> {
  const raw = readCookie(request, TRUST_COOKIE);
  if (!raw) return false;
  const [uid, tok] = raw.split(".");
  if (uid !== userId || !tok) return false;
  const dev = await prisma.trustedDevice.findUnique({ where: { tokenHash: pepperHash(`td|${tok}`) } });
  if (!dev || dev.userId !== userId || dev.expiresAt < new Date()) return false;
  await prisma.trustedDevice.update({ where: { id: dev.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}

export async function trustThisDevice(res: NextResponse, request: Request, userId: string) {
  const tok = randomToken(32);
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: pepperHash(`td|${tok}`),
      userAgent: request.headers.get("user-agent")?.substring(0, 300) || null,
      expiresAt: new Date(Date.now() + TRUST_DAYS * 86_400_000),
    },
  });
  res.cookies.set(TRUST_COOKIE, `${userId}.${tok}`, {
    httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/api/auth", maxAge: TRUST_DAYS * 86_400,
  });
}

// ---------- Reglas de doble verificación ----------
type UserFor2fa = { role: string; twoFactorEnabled: boolean; totpEnabled: boolean; phone: string | null; backupCodes: string | null };

export function requires2fa(u: UserFor2fa): boolean {
  return u.role === "admin" || u.role === "superadmin" || u.twoFactorEnabled;
}

export function twoFactorMethods(u: UserFor2fa): ("totp" | "whatsapp" | "backup")[] {
  const m: ("totp" | "whatsapp" | "backup")[] = [];
  if (u.totpEnabled) m.push("totp");
  if (normalizePhone(u.phone)) m.push("whatsapp");
  if (backupCodeCount(u.backupCodes) > 0) m.push("backup");
  return m;
}

/** Qué falta después de validar la contraseña (o de completar un paso). null = entrar. */
export async function nextStage(
  user: UserFor2fa & { mustChangePassword: boolean; id: string },
  request: Request,
  done: { password?: boolean; twoFactor?: boolean } = {}
): Promise<Stage | null> {
  if (user.mustChangePassword && !done.password) return "change_password";
  if (requires2fa(user) && !done.twoFactor && !(await isTrustedDevice(request, user.id))) {
    const methods = twoFactorMethods(user);
    if (!methods.includes("totp") && !methods.includes("whatsapp")) return "2fa_setup";
    return "2fa";
  }
  return null;
}

/** Respuesta estándar de "falta un paso" */
export function challengeResponse(user: UserFor2fa & { id: string; tokenVersion: number }, stage: Stage, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    stage,
    challenge: signChallenge({ uid: user.id, stage, tv: user.tokenVersion }),
    methods: stage === "2fa" ? twoFactorMethods(user) : undefined,
    maskedPhone: normalizePhone(user.phone) ? maskPhone(user.phone) : undefined,
    ...extra,
  });
}

// ---------- App autenticadora (cada código sirve una sola vez) ----------
/** Verifica el código y lo "gasta": el mismo código (o uno anterior) ya no se acepta de nuevo. */
export async function verifyTotpOnce(userId: string, encryptedSecret: string, code: unknown): Promise<boolean> {
  const secret = decrypt(encryptedSecret);
  const step = secret ? totpStep(secret, code) : null;
  if (step === null) return false;
  const { count } = await prisma.user.updateMany({
    where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1;
}

// ---------- Códigos de respaldo ----------
export function backupCodeCount(json: string | null): number {
  try { return (JSON.parse(json || "[]") as string[]).length; } catch { return 0; }
}

export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () => {
    const t = randomToken(6).replace(/[^A-Za-z0-9]/g, "").toUpperCase().padEnd(8, "X").slice(0, 8);
    return `${t.slice(0, 4)}-${t.slice(4)}`;
  });
  await prisma.user.update({
    where: { id: userId },
    data: { backupCodes: JSON.stringify(codes.map((c) => pepperHash(`bk|${userId}|${c}`))) },
  });
  return codes;
}

/** Usa (y elimina) un código de respaldo. */
export async function consumeBackupCode(userId: string, stored: string | null, code: unknown): Promise<boolean> {
  const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 8) return false;
  const h = pepperHash(`bk|${userId}|${c.slice(0, 4)}-${c.slice(4)}`);
  let list: string[] = [];
  try { list = JSON.parse(stored || "[]"); } catch {}
  const idx = list.findIndex((x) => safeEqualHex(x, h));
  if (idx < 0) return false;
  list.splice(idx, 1);
  await prisma.user.update({ where: { id: userId }, data: { backupCodes: JSON.stringify(list) } });
  return true;
}

// ---------- Cambio de contraseña (revoca todas las sesiones) ----------
export async function setPassword(userId: string, newPassword: string, opts: { mustChange?: boolean } = {}) {
  const hash = await bcrypt.hash(newPassword, 10);
  const u = await prisma.user.update({
    where: { id: userId },
    data: { password: hash, tokenVersion: { increment: 1 }, mustChangePassword: !!opts.mustChange, passwordChangedAt: new Date() },
    include: { branch: { select: { name: true } } },
  });
  await prisma.trustedDevice.deleteMany({ where: { userId } });
  invalidateUserCache(userId);
  return u;
}

/** Cierra todas las sesiones y olvida los dispositivos de confianza. */
export async function revokeAllSessions(userId: string) {
  const u = await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } }, include: { branch: { select: { name: true } } } });
  await prisma.trustedDevice.deleteMany({ where: { userId } });
  invalidateUserCache(userId);
  return u;
}

export async function companyName(): Promise<string> {
  return (await getSettings())?.companyName || DEFAULT_COMPANY_NAME;
}
