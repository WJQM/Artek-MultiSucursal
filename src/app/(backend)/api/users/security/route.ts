import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { randomPassword } from "@/backend/secure";
import { normalizePhone, notifySecurity } from "@/backend/otp";
import { setPassword, revokeAllSessions, companyName } from "@/backend/session";
import { sendWhatsAppSafe } from "@/backend/whatsapp";

/**
 * Herramientas de seguridad del Super Admin sobre otros usuarios. Body: { id, action }
 *   temp_password  → genera una contraseña temporal (se pide cambiarla al entrar) y cierra sus sesiones
 *   reset_2fa      → quita la app autenticadora y los códigos de respaldo (si perdió el celular)
 *   logout_all     → cierra todas sus sesiones
 */
export async function POST(request: Request) {
  const me = await getUserFromToken(request);
  if (!me || me.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { id, action, sendWhatsApp } = await request.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const company = await companyName();
    const phone = normalizePhone(target.phone);

    if (action === "temp_password") {
      if (target.id === me.id) return NextResponse.json({ error: "Usa 'Mi cuenta' para cambiar tu propia contraseña" }, { status: 400 });
      const temp = randomPassword(11);
      await setPassword(target.id, temp, { mustChange: true });
      let sent = false;
      if (sendWhatsApp && phone) {
        sent = await sendWhatsAppSafe(phone, `🔑 *${company}*\nTu contraseña temporal es: *${temp}*\n\nAl entrar se te pedirá elegir una nueva.`);
      }
      return NextResponse.json({ ok: true, tempPassword: temp, sentWhatsApp: sent });
    }

    if (action === "reset_2fa") {
      await prisma.user.update({ where: { id: target.id }, data: { totpEnabled: false, totpSecret: null, backupCodes: null } });
      await revokeAllSessions(target.id);
      notifySecurity(phone, "El administrador restableció la doble verificación de tu cuenta.", company);
      return NextResponse.json({ ok: true });
    }

    if (action === "logout_all") {
      await revokeAllSessions(target.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e) {
    console.error("[Users security] Error:", e);
    return NextResponse.json({ error: "Error al procesar" }, { status: 500 });
  }
}
