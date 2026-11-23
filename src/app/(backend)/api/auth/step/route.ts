import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { invalidateUserCache } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { validatePassword } from "@/backend/secure";
import { sendCode, verifyCode, normalizePhone, maskPhone, notifySecurity } from "@/backend/otp";
import {
  verifyChallenge, signChallenge, nextStage, challengeResponse, sessionResponse, trustThisDevice,
  consumeBackupCode, setPassword, companyName, twoFactorMethods, verifyTotpOnce,
} from "@/backend/session";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Pasos siguientes del inicio de sesión / registro. Body: { challenge, action, ... }
 *   change_password { newPassword }                  (contraseña temporal)
 *   send_pin                                          (reenviar PIN por WhatsApp)
 *   verify { method: totp|whatsapp|backup, code, remember }
 *   setup_phone { phone }  →  verify_setup_phone { code, remember }   (admin sin celular registrado)
 *   verify_phone { code } / resend_register                           (registro nuevo)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ch = verifyChallenge(body.challenge);
    if (!ch) return bad("La sesión de verificación venció. Vuelve a iniciar sesión.", 401);

    const user = await prisma.user.findUnique({ where: { id: ch.uid }, include: { branch: { select: { name: true, active: true } } } });
    if (!user || user.tokenVersion !== ch.tv) return bad("La sesión de verificación ya no es válida. Vuelve a iniciar sesión.", 401);

    const action = String(body.action || "");
    const company = await companyName();

    // Límite de intentos de verificación por usuario (protege PIN y app autenticadora)
    if (["verify", "verify_setup_phone", "verify_phone"].includes(action)) {
      const rl = rateLimit(`step:${user.id}`, 10, 15 * 60_000);
      if (!rl.ok) return bad(`Demasiados intentos. Espera ${Math.ceil(rl.retryAfter / 60)} min.`, 429);
    }

    // ---------- Registro: verificar celular ----------
    if (ch.stage === "verify_phone") {
      const phone = normalizePhone(user.phone);
      if (!phone) return bad("El número registrado no es válido");
      if (action === "resend_register") {
        const r = await sendCode(user.id, "register", phone, company);
        return r.ok ? NextResponse.json({ ok: true, maskedPhone: maskPhone(phone) }) : bad(r.error, 429);
      }
      if (action === "verify_phone") {
        const v = await verifyCode(user.id, "register", body.code);
        if (!v.ok) return bad(v.error);
        await prisma.user.update({ where: { id: user.id }, data: { phone: v.phone, phoneVerified: true } });
        return NextResponse.json({ ok: true, registered: true, status: user.status });
      }
      return bad("Acción inválida");
    }

    // Para los pasos de login la cuenta debe seguir activa
    if (user.status !== "active") return bad("Tu cuenta no está activa", 403);
    if (user.branch && !user.branch.active) return bad("Tu sucursal está desactivada", 403);

    const finish = async (u: typeof user, done: { password?: boolean; twoFactor?: boolean }, remember = false) => {
      const stage = await nextStage(u, request, done);
      if (stage) {
        let extra: Record<string, unknown> = {};
        if (stage === "2fa" && !twoFactorMethods(u).includes("totp")) {
          const phone = normalizePhone(u.phone);
          if (phone) { const r = await sendCode(u.id, "login", phone, company); extra = { pinSent: r.ok, pinError: r.ok ? undefined : r.error }; }
        }
        return challengeResponse(u, stage, extra);
      }
      const res = sessionResponse(u);
      if (remember) await trustThisDevice(res, request, u.id);
      return res;
    };

    // ---------- Contraseña temporal → elegir una nueva ----------
    if (ch.stage === "change_password") {
      if (action !== "change_password") return bad("Acción inválida");
      const err = validatePassword(body.newPassword);
      if (err) return bad(err);
      const updated = await setPassword(user.id, body.newPassword, { mustChange: false });
      notifySecurity(normalizePhone(updated.phone), "Tu contraseña fue cambiada.", company);
      return finish({ ...updated, branch: user.branch }, { password: true });
    }

    // ---------- Doble verificación ----------
    if (ch.stage === "2fa") {
      if (action === "send_pin") {
        const phone = normalizePhone(user.phone);
        if (!phone) return bad("No hay celular registrado");
        const r = await sendCode(user.id, "login", phone, company);
        return r.ok ? NextResponse.json({ ok: true, maskedPhone: maskPhone(phone) }) : bad(r.error, 429);
      }
      if (action !== "verify") return bad("Acción inválida");
      const method = String(body.method || "");
      let ok = false;
      if (method === "totp" && user.totpEnabled && user.totpSecret) {
        ok = await verifyTotpOnce(user.id, user.totpSecret, body.code);
        if (!ok) return bad("Código de la app incorrecto o ya usado");
      } else if (method === "whatsapp") {
        const v = await verifyCode(user.id, "login", body.code);
        if (!v.ok) return bad(v.error);
        ok = true;
        if (!user.phoneVerified && v.phone) await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true, phone: v.phone } });
      } else if (method === "backup") {
        ok = await consumeBackupCode(user.id, user.backupCodes, body.code);
        if (!ok) return bad("Código de respaldo inválido o ya usado");
        notifySecurity(normalizePhone(user.phone), "Se usó un código de respaldo para entrar a tu cuenta.", company);
      } else {
        return bad("Método inválido");
      }
      return finish(user, { password: true, twoFactor: true }, !!body.remember);
    }

    // ---------- Admin sin celular ni app: registrar celular ahora ----------
    if (ch.stage === "2fa_setup") {
      // Solo técnicos con PIN activado: a un admin, quien robara la contraseña podría registrarle su propio celular
      if (user.role !== "tech") return bad("Pide a un Super Admin que registre tu celular en Usuarios", 403);
      if (action === "setup_phone") {
        const phone = normalizePhone(body.phone);
        if (!phone) return bad("Número de celular inválido (ej: 71234567)");
        const r = await sendCode(user.id, "phone", phone, company);
        if (!r.ok) return bad(r.error, 429);
        return NextResponse.json({
          stage: "2fa_setup",
          challenge: signChallenge({ uid: user.id, stage: "2fa_setup", tv: user.tokenVersion, phone }),
          pinSent: true,
          maskedPhone: maskPhone(phone),
        });
      }
      if (action === "verify_setup_phone") {
        if (!ch.phone) return bad("Primero ingresa tu celular");
        const v = await verifyCode(user.id, "phone", body.code);
        if (!v.ok) return bad(v.error);
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { phone: v.phone, phoneVerified: true },
          include: { branch: { select: { name: true, active: true } } },
        });
        invalidateUserCache(user.id);
        return finish(updated, { password: true, twoFactor: true }, !!body.remember);
      }
      return bad("Acción inválida");
    }

    return bad("Paso inválido");
  } catch (error) {
    console.error("[Auth step] Error:", error);
    return NextResponse.json({ error: "Error en la verificación" }, { status: 500 });
  }
}
