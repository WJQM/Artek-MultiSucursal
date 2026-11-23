import { prisma } from "@/backend/prisma";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, invalidateUserCache } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { validatePassword, encrypt, decrypt } from "@/backend/secure";
import { generateTotpSecret, otpauthUri } from "@/backend/totp";
import { sendCode, verifyCode, normalizePhone, maskPhone, notifySecurity } from "@/backend/otp";
import {
  setPassword, revokeAllSessions, sessionResponse, generateBackupCodes, backupCodeCount, requires2fa, companyName, TRUST_COOKIE, verifyTotpOnce,
} from "@/backend/session";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function load(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { branch: { select: { name: true } } } });
}

function summary(u: NonNullable<Awaited<ReturnType<typeof load>>>, trustedDevices: number) {
  return {
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone ? maskPhone(u.phone) : null,
    phoneVerified: u.phoneVerified,
    twoFactorRequired: u.role === "admin" || u.role === "superadmin",
    twoFactorEnabled: requires2fa(u),
    totpEnabled: u.totpEnabled,
    backupCodesLeft: backupCodeCount(u.backupCodes),
    trustedDevices,
    passwordChangedAt: u.passwordChangedAt,
  };
}

// GET /api/account — estado de seguridad de mi cuenta
export async function GET(request: Request) {
  const me = await getUserFromToken(request);
  if (!me) return unauthorized();
  const u = await load(me.id);
  if (!u) return unauthorized();
  const trusted = await prisma.trustedDevice.count({ where: { userId: u.id, expiresAt: { gt: new Date() } } });
  return NextResponse.json(summary(u, trusted));
}

// POST /api/account { action, ... }
export async function POST(request: Request) {
  const me = await getUserFromToken(request);
  if (!me) return unauthorized();
  const u = await load(me.id);
  if (!u) return unauthorized();

  const rl = rateLimit(`account:${u.id}`, 30, 15 * 60_000);
  if (!rl.ok) return bad("Demasiados intentos. Espera unos minutos.", 429);

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const company = await companyName();
  const checkPassword = async () => typeof body.currentPassword === "string" && bcrypt.compare(body.currentPassword, u.password);

  try {
    switch (action) {
      // ---- Contraseña ----
      case "change_password": {
        if (!(await checkPassword())) return bad("La contraseña actual es incorrecta");
        const err = validatePassword(body.newPassword);
        if (err) return bad(err);
        if (body.newPassword === body.currentPassword) return bad("La nueva contraseña debe ser distinta");
        const updated = await setPassword(u.id, body.newPassword);
        notifySecurity(normalizePhone(u.phone), "Tu contraseña fue cambiada y se cerraron tus otras sesiones.", company);
        // Nueva sesión para este dispositivo (las demás quedan cerradas)
        return sessionResponse(updated, { ok: true, message: "Contraseña actualizada. Se cerraron las demás sesiones." });
      }

      // ---- Celular ----
      case "phone_send": {
        const phone = normalizePhone(body.phone);
        if (!phone) return bad("Número de celular inválido (ej: 71234567)");
        const r = await sendCode(u.id, "phone", phone, company);
        return r.ok ? NextResponse.json({ ok: true, maskedPhone: maskPhone(phone) }) : bad(r.error, 429);
      }
      case "phone_verify": {
        const v = await verifyCode(u.id, "phone", body.code);
        if (!v.ok) return bad(v.error);
        const old = normalizePhone(u.phone);
        await prisma.user.update({ where: { id: u.id }, data: { phone: v.phone, phoneVerified: true } });
        if (old && old !== v.phone) notifySecurity(old, `El celular de tu cuenta fue cambiado a ${maskPhone(v.phone)}.`, company);
        return NextResponse.json({ ok: true });
      }

      // ---- PIN al iniciar sesión (opcional para técnicos) ----
      case "set_2fa": {
        if (u.role !== "tech") return bad("Para administradores la doble verificación es obligatoria");
        const enable = !!body.enabled;
        if (enable && !(u.phoneVerified && normalizePhone(u.phone)) && !u.totpEnabled) {
          return bad("Primero verifica tu celular o configura la app autenticadora");
        }
        await prisma.user.update({ where: { id: u.id }, data: { twoFactorEnabled: enable } });
        return NextResponse.json({ ok: true });
      }

      // ---- App autenticadora ----
      case "totp_begin": {
        if (u.totpEnabled) return bad("La app autenticadora ya está activada");
        const secret = generateTotpSecret();
        await prisma.user.update({ where: { id: u.id }, data: { totpSecret: encrypt(secret) } });
        const uri = otpauthUri(secret, u.email, company);
        const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 }); // generado aquí: el secreto no sale del servidor
        return NextResponse.json({ ok: true, qr, secret });
      }
      case "totp_confirm": {
        if (!u.totpSecret || !decrypt(u.totpSecret)) return bad("Empieza la configuración de nuevo");
        if (!(await verifyTotpOnce(u.id, u.totpSecret, body.code))) return bad("Código incorrecto. Revisa que la hora del celular esté bien.");
        await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
        const codes = await generateBackupCodes(u.id);
        notifySecurity(normalizePhone(u.phone), "Se activó la app autenticadora en tu cuenta.", company);
        return NextResponse.json({ ok: true, backupCodes: codes });
      }
      case "totp_disable": {
        if (!u.totpEnabled || !u.totpSecret) return bad("La app autenticadora no está activada");
        if (!(await checkPassword())) return bad("La contraseña actual es incorrecta");
        if (!(await verifyTotpOnce(u.id, u.totpSecret, body.code))) return bad("Código de la app incorrecto");
        if (requires2fa(u) && !(u.phoneVerified && normalizePhone(u.phone))) {
          return bad("Verifica tu celular antes de desactivar la app (necesitas al menos un método)");
        }
        await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecret: null, backupCodes: null } });
        notifySecurity(normalizePhone(u.phone), "Se desactivó la app autenticadora en tu cuenta.", company);
        return NextResponse.json({ ok: true });
      }
      case "backup_regenerate": {
        if (!(await checkPassword())) return bad("La contraseña actual es incorrecta");
        const codes = await generateBackupCodes(u.id);
        return NextResponse.json({ ok: true, backupCodes: codes });
      }

      // ---- Sesiones ----
      case "logout_others": {
        const updated = await revokeAllSessions(u.id);
        const res = sessionResponse(updated, { ok: true, message: "Se cerró la sesión en todos los demás dispositivos." });
        res.cookies.set(TRUST_COOKIE, "", { path: "/api/auth", maxAge: 0 });
        return res;
      }

      default:
        return bad("Acción inválida");
    }
  } catch (e) {
    console.error("[Account] Error:", e);
    invalidateUserCache(u.id);
    return bad("Error al procesar la solicitud", 500);
  }
}
