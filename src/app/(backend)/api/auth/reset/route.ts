import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { validatePassword } from "@/backend/secure";
import { verifyCode, normalizePhone, notifySecurity } from "@/backend/otp";
import { signChallenge, verifyChallenge, setPassword, consumeBackupCode, companyName, verifyTotpOnce } from "@/backend/session";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Recuperación de contraseña.
 *  Paso 2: { email, code }                        → { resetToken, needSecondFactor }
 *  Paso 3: { resetToken, newPassword, totpCode | backupCode }  → { ok }
 * Si la cuenta tiene app autenticadora, también se pide ese código (recuperar la
 * contraseña no debe saltarse la doble verificación).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`reset:${ip}`, 15, 60 * 60_000);
  if (!rl.ok) return bad("Demasiados intentos. Intenta en una hora.", 429);

  try {
    const body = await request.json();

    // Paso 2: validar PIN
    if (!body.resetToken) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const user = email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
      if (!user) return bad("El código venció. Pide uno nuevo.");
      const v = await verifyCode(user.id, "reset", body.code);
      if (!v.ok) return bad(v.error);
      return NextResponse.json({
        resetToken: signChallenge({ uid: user.id, stage: "reset", tv: user.tokenVersion, phone: v.phone }),
        needSecondFactor: user.totpEnabled,
      });
    }

    // Paso 3: nueva contraseña
    const ch = verifyChallenge(body.resetToken);
    if (!ch || ch.stage !== "reset") return bad("El enlace de recuperación venció. Empieza de nuevo.", 401);
    const user = await prisma.user.findUnique({ where: { id: ch.uid } });
    if (!user || user.tokenVersion !== ch.tv) return bad("El enlace de recuperación ya no es válido. Empieza de nuevo.", 401);

    const err = validatePassword(body.newPassword);
    if (err) return bad(err);

    if (user.totpEnabled) {
      let ok = false;
      if (body.totpCode && user.totpSecret) {
        ok = await verifyTotpOnce(user.id, user.totpSecret, body.totpCode);
      } else if (body.backupCode) {
        ok = await consumeBackupCode(user.id, user.backupCodes, body.backupCode);
      }
      if (!ok) return bad("Código de la app autenticadora o de respaldo incorrecto");
    }

    await setPassword(user.id, body.newPassword, { mustChange: false });
    // Si el PIN llegó por WhatsApp a ese celular, queda verificado (si llegó solo por correo, no)
    if (ch.phone) await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true, phone: ch.phone } });
    notifySecurity(normalizePhone(ch.phone || user.phone), "Tu contraseña fue restablecida y se cerraron todas tus sesiones.", await companyName());

    return NextResponse.json({ ok: true, status: user.status });
  } catch (e) {
    console.error("[Reset] Error:", e);
    return bad("Error al restablecer la contraseña", 500);
  }
}
