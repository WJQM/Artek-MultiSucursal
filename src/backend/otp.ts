// PIN de un solo uso enviado por WhatsApp (login, registro, recuperación, cambio de celular).
import { prisma } from "./prisma";
import { sendWhatsAppSafe, whatsappConfigured } from "./whatsapp";
import { pepperHash, randomDigits, safeEqualHex } from "./secure";
import { rateLimit } from "./rate-limit";

export type OtpPurpose = "login" | "register" | "reset" | "phone";

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  login: "para iniciar sesión",
  register: "para verificar tu celular",
  reset: "para restablecer tu contraseña",
  phone: "para confirmar tu nuevo celular",
};

export { normalizePhone, maskPhone } from "./phone";

function hashCode(codeId: string, code: string) {
  return pepperHash(`otp|${codeId}|${code}`);
}

async function deliver(phone: string, message: string): Promise<boolean> {
  // En desarrollo: sin WhatsApp configurado, o con OTP_CONSOLE=1, el PIN se muestra en la terminal
  const configured = await whatsappConfigured();
  const toConsole = process.env.NODE_ENV !== "production" && (process.env.OTP_CONSOLE === "1" || !configured);
  if (toConsole || !configured) {
    if (process.env.NODE_ENV !== "production") {
      // Desarrollo sin WhatsApp configurado: el PIN aparece en la consola del servidor
      console.log(`[OTP-DEV] ${phone} :: ${message}`);
      return true;
    }
    console.error("[OTP] WhatsApp sin clave de WasenderApi: no se puede enviar el PIN");
    return false;
  }
  return sendWhatsAppSafe(phone, message);
}

export type SendResult = { ok: true } | { ok: false; error: string; retryAfter?: number };

/** Genera, guarda (hasheado) y envía un PIN de 6 dígitos. */
export async function sendCode(userId: string, purpose: OtpPurpose, phone: string | null, companyName = "RepairTrack", opts: { email?: string | null } = {}): Promise<SendResult> {
  const cooldown = rateLimit(`otp:cool:${userId}:${purpose}`, 1, RESEND_COOLDOWN_S * 1000);
  if (!cooldown.ok) return { ok: false, error: `Espera ${cooldown.retryAfter} s para pedir otro código`, retryAfter: cooldown.retryAfter };
  const hourly = rateLimit(`otp:hour:${phone || userId}`, 6, 60 * 60_000);
  if (!hourly.ok) return { ok: false, error: "Demasiados códigos enviados a este número. Intenta en una hora." };
  if (!phone && !opts.email) return { ok: false, error: "No hay a dónde enviar el código" };

  // Invalida códigos anteriores del mismo propósito
  await prisma.verificationCode.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = randomDigits(6);
  const rec = await prisma.verificationCode.create({
    data: { userId, purpose, phone: phone || "", codeHash: "pending", expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  await prisma.verificationCode.update({ where: { id: rec.id }, data: { codeHash: hashCode(rec.id, code) } });

  const msg = `🔐 *${companyName}*\nTu código ${PURPOSE_TEXT[purpose]} es: *${code}*\n\nVence en 10 minutos. No lo compartas con nadie; nuestro personal nunca te lo pedirá.`;
  // WhatsApp (si hay celular) y, para recuperar la contraseña, también correo (si está configurado)
  const byWa = phone ? await deliver(phone, msg) : false;
  let byMail = false;
  if (opts.email) {
    const { mailReady, sendMail, mailLayout } = await import("./mail");
    if (await mailReady()) {
      const html = await mailLayout({ title: `Tu código ${PURPOSE_TEXT[purpose]}`, intro: `<div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;margin:18px 0;color:#1e2a3a">${code}</div>Vence en 10 minutos. No lo compartas con nadie; nuestro personal nunca te lo pedirá.<br><br>Si no pediste este código, ignora este correo.`, footerNote: "Correo automático de seguridad." });
      byMail = (await sendMail(opts.email, `${code} es tu código ${PURPOSE_TEXT[purpose]}`, html)).ok;
    }
  }
  // Solo si llegó por WhatsApp el celular queda como verificado al usarlo
  if (!byWa && phone) await prisma.verificationCode.update({ where: { id: rec.id }, data: { phone: "" } });
  const sent = byWa || byMail;
  if (!sent) {
    await prisma.verificationCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: opts.email ? "No se pudo enviar el código. Intenta más tarde." : "No se pudo enviar el WhatsApp. Verifica el número o intenta más tarde." };
  }
  return { ok: true };
}

export type VerifyResult = { ok: true; phone: string } | { ok: false; error: string };

/** Verifica el último PIN vigente. Máximo 5 intentos por código. */
export async function verifyCode(userId: string, purpose: OtpPurpose, code: unknown): Promise<VerifyResult> {
  const clean = String(code ?? "").replace(/\D/g, "");
  const rec = await prisma.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.expiresAt < new Date()) return { ok: false, error: "El código venció. Pide uno nuevo." };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Demasiados intentos. Pide un código nuevo." };

  const good = clean.length === 6 && safeEqualHex(hashCode(rec.id, clean), rec.codeHash);
  if (!good) {
    const attempts = rec.attempts + 1;
    await prisma.verificationCode.update({
      where: { id: rec.id },
      data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
    });
    const left = MAX_ATTEMPTS - attempts;
    return { ok: false, error: left > 0 ? `Código incorrecto. Te quedan ${left} intento(s).` : "Demasiados intentos. Pide un código nuevo." };
  }
  await prisma.verificationCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
  return { ok: true, phone: rec.phone };
}

/** Aviso de seguridad por WhatsApp (no bloqueante) */
export async function notifySecurity(phone: string | null | undefined, text: string, companyName = "RepairTrack") {
  if (!phone) return;
  try { await deliver(phone, `🛡️ *${companyName}*\n${text}\n\nSi no fuiste tú, contacta al administrador de inmediato.`); } catch {}
}
