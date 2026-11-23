import { prisma } from "@/backend/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimit, resetRateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { sessionResponse, nextStage, challengeResponse, twoFactorMethods, companyName } from "@/backend/session";
import { sendCode, normalizePhone } from "@/backend/otp";

const INVALID = "Correo o contraseña incorrectos";

// Hash fijo para comparar cuando el usuario no existe (evita revelar por tiempo de respuesta si el correo existe)
const DUMMY_HASH = "$2b$10$7k.6ydSVxNAwgEo6zcgT5u80de8hoQEt/dgUYnuJXNKNsWYat3EDW";

/**
 * Paso 1 del inicio de sesión: correo + contraseña (+ captcha).
 * Respuestas:
 *  - { token, user }                         → entra directo
 *  - { stage, challenge, methods, … }        → falta un paso (cambiar contraseña / doble verificación)
 */
export async function POST(request: Request) {
  try {
    const { email, password, captchaToken, panel } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const ip = getClientIp(request);
    const emailKey = `login:email:${email.toLowerCase().trim()}`;
    const ipRl = rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
    const emailRl = rateLimit(emailKey, 8, 15 * 60_000);
    if (!ipRl.ok || !emailRl.ok) {
      const wait = Math.ceil(Math.max(ipRl.retryAfter, emailRl.retryAfter) / 60);
      return NextResponse.json({ error: `Demasiados intentos. Intenta de nuevo en ${wait} min.` }, { status: 429 });
    }

    if (!(await verifyTurnstile(captchaToken, ip))) {
      return NextResponse.json({ error: CAPTCHA_ERROR, captcha: true }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      include: { branch: true },
    });

    const validPassword = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !validPassword) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Cada login tiene su público: el principal (/) es para administradores y técnicos;
    // el Super Admin entra solo por /setup. Mensaje genérico para no revelar qué cuentas son Super Admin.
    const fromSetup = panel === "setup";
    if ((user.role === "superadmin") !== fromSetup) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Admin y Super Admin: contraseña + PIN al celular YA registrado (o app autenticadora).
    // No se les permite registrar un celular nuevo al entrar: quien robara la contraseña
    // podría poner el suyo. Si no tienen celular, un Super Admin se lo carga en Usuarios.
    if ((user.role === "superadmin" || user.role === "admin") && !user.totpEnabled && !normalizePhone(user.phone)) {
      return NextResponse.json({
        error: "Esta cuenta no tiene celular registrado para la doble verificación. Pide a un Super Admin que lo agregue en Usuarios.",
      }, { status: 403 });
    }

    if (user.status === "pending") {
      return NextResponse.json({ error: "Tu cuenta está pendiente de aprobación. Contacta al administrador." }, { status: 403 });
    }
    if (user.status === "suspended") {
      return NextResponse.json({ error: "Tu cuenta ha sido suspendida. Contacta al administrador." }, { status: 403 });
    }
    if (user.branch && !user.branch.active) {
      return NextResponse.json({ error: "Tu sucursal está desactivada. Contacta al administrador." }, { status: 403 });
    }

    resetRateLimit(emailKey);

    const stage = await nextStage(user, request);
    if (!stage) return sessionResponse(user);

    // Doble verificación solo por WhatsApp → enviar el PIN de una vez (sin clic extra)
    let pinSent: boolean | undefined;
    let pinError: string | undefined;
    if (stage === "2fa") {
      const methods = twoFactorMethods(user);
      const phone = normalizePhone(user.phone);
      if (!methods.includes("totp") && phone) {
        const r = await sendCode(user.id, "login", phone, await companyName());
        // Si se reintenta al rato, el PIN enviado hace menos de 60 s sigue siendo válido: no es un error
        pinSent = r.ok || !!(!r.ok && r.retryAfter);
        if (!r.ok && !r.retryAfter) pinError = r.error;
      }
    }
    return challengeResponse(user, stage, { pinSent, pinError });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}
