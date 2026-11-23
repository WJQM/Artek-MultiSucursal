import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden, isAdmin } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { normalizePhone } from "@/backend/phone";
import { sendWhatsApp } from "@/backend/whatsapp";

/**
 * Envío manual de WhatsApp desde el número del taller.
 * - Administradores: a cualquier celular.
 * - Técnicos: solo al cliente de una orden asignada a ellos.
 */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const rl = rateLimit(`whatsapp:${user.id}`, 60, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Límite de mensajes alcanzado, intenta más tarde" }, { status: 429 });

  const { phone, message } = await request.json().catch(() => ({}));
  const to = normalizePhone(phone);
  if (!to || typeof message !== "string" || !message.trim() || message.length > 4000) {
    return NextResponse.json({ error: "Teléfono y mensaje son requeridos" }, { status: 400 });
  }

  if (!isAdmin(user)) {
    const assigned = await prisma.repair.findMany({
      where: { technicianId: user.id, clientPhone: { not: null } },
      select: { clientPhone: true },
    });
    if (!assigned.some((r) => normalizePhone(r.clientPhone) === to)) {
      return forbidden("Solo puedes escribir a clientes de tus órdenes asignadas");
    }
  }

  const sent = await sendWhatsApp(to, message);
  return sent.ok
    ? NextResponse.json({ success: true, idMessage: sent.msgId })
    : NextResponse.json({ error: sent.error }, { status: 502 });
}
