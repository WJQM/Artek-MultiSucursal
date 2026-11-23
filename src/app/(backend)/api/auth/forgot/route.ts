import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { normalizePhone, sendCode } from "@/backend/otp";
import { companyName } from "@/backend/session";

const GENERIC = "Si la cuenta existe, te enviamos un código por WhatsApp y/o a tu correo.";

/**
 * "¿Olvidaste tu contraseña?" — paso 1: enviar PIN por WhatsApp.
 * Responde siempre lo mismo para no revelar qué correos existen.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`forgot:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes. Intenta en una hora." }, { status: 429 });

  try {
    const { email, captchaToken } = await request.json();
    if (!(await verifyTurnstile(captchaToken, ip))) {
      return NextResponse.json({ error: CAPTCHA_ERROR, captcha: true }, { status: 400 });
    }
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Ingresa tu correo" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" }, status: { in: ["active", "pending"] } },
      select: { id: true, phone: true, email: true },
    });
    const phone = normalizePhone(user?.phone);
    if (user && (phone || user.email)) {
      // El resultado no se informa (ni siquiera la espera entre reenvíos) para no revelar si el correo existe
      // y sin esperar el envío, para que el tiempo de respuesta sea el mismo exista o no
      companyName().then((c) => sendCode(user.id, "reset", phone, c, { email: user.email })).catch(() => {});
    }
    return NextResponse.json({ ok: true, message: GENERIC });
  } catch (e) {
    console.error("[Forgot] Error:", e);
    return NextResponse.json({ ok: true, message: GENERIC });
  }
}
