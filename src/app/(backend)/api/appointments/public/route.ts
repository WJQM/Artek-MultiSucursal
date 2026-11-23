import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { publicBaseUrl } from "@/backend/public-url";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { availableSlots, cleanPhone, confirmationMessage, fmtWhen, getApptConfig, manageUrl, nextCode, publicOrigin, resolveSlot } from "@/backend/appointments";
import { withUniqueRetry } from "@/backend/unique-retry";

/** Portal: sucursales que aceptan citas (sin branchId) o turnos libres de una sucursal (?branchId=) */
export async function GET(request: Request) {
  const branchId = new URL(request.url).searchParams.get("branchId");
  const cfg = await getApptConfig();
  const enabledIds = Object.entries(cfg.branches).filter(([, v]) => v.enabled).map(([k]) => k);
  if (!branchId) {
    const branches = enabledIds.length ? await prisma.branch.findMany({ where: { id: { in: enabledIds }, active: true }, select: { id: true, name: true, address: true }, orderBy: { createdAt: "asc" } }) : [];
    return NextResponse.json({ enabled: branches.length > 0, branches });
  }
  if (!enabledIds.includes(branchId)) return NextResponse.json({ days: [] });
  return NextResponse.json({ days: await availableSlots(branchId) });
}

/** Reservar { branchId, date, time, clientName, clientPhone, device, issue, captchaToken } */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`appt:${ip}`, 6, 60 * 60_000).ok) return NextResponse.json({ error: "Demasiadas reservas seguidas. Intenta más tarde o llámanos." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  if (!(await verifyTurnstile(b.captchaToken, ip))) return NextResponse.json({ error: CAPTCHA_ERROR }, { status: 400 });

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
  const clientName = str(b.clientName, 80), device = str(b.device, 80), issue = str(b.issue, 300);
  const phone = cleanPhone(b.clientPhone);
  if (clientName.length < 2) return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Escribe un celular válido (8 dígitos)" }, { status: 400 });
  if (device.length < 2) return NextResponse.json({ error: "¿Qué equipo traerás? (ej. Celular Samsung A52)" }, { status: 400 });
  const branchId = str(b.branchId, 60);
  const cfg = await getApptConfig();
  if (!cfg.branches[branchId]?.enabled) return NextResponse.json({ error: "Esta sucursal no recibe citas en línea" }, { status: 400 });

  // Las reservas del portal se hacen de a una (candado de la base): dos personas no pueden tomar
  // el mismo turno ni pasar el límite de citas pendientes enviando a la vez.
  const booked = await withUniqueRetry(() => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('appointments:portal'))`;

    // Máximo 2 citas pendientes por celular
    const pending = await tx.appointment.count({ where: { clientPhone: phone, status: { in: ["new", "confirmed"] }, date: { gte: new Date() } } });
    if (pending >= 2) return { error: "Ya tienes citas pendientes con este celular. Cancela una para reservar otra.", status: 400 } as const;

    const date = await resolveSlot(branchId, str(b.date, 10), str(b.time, 5));
    if (!date) return { error: "Ese horario ya no está disponible. Elige otro.", status: 409, code: "SLOT_TAKEN" } as const;

    return tx.appointment.create({
      data: { code: await nextCode(branchId), branchId, date, clientName, clientPhone: phone, device, issue: issue || null, source: "portal" },
    });
  }));
  if ("error" in booked) return NextResponse.json({ error: booked.error, code: "code" in booked ? booked.code : undefined }, { status: booked.status });
  const appt = booked;
  const { date } = appt;

  const origin = await publicOrigin(publicBaseUrl(request));
  const whatsapp = await sendWhatsAppSafe(phone, await confirmationMessage(appt, origin));
  // Aviso al personal (campana + celular + Telegram)
  (async () => {
    const { managerIds, sendPush } = await import("@/backend/push");
    const ids = await managerIds(branchId);
    const title = `📅 Nueva cita · ${appt.code}`;
    const message = `${clientName} · ${fmtWhen(date)} · ${device}${issue ? ` — ${issue}` : ""}`;
    await prisma.notification.createMany({ data: ids.map((userId) => ({ type: "appointment", title, message, userId, branchId })) });
    await sendPush(ids, "appointments", { title, body: message, url: "/citas", tag: `cita-${appt.id}` });
  })().catch((e) => console.error("[Citas]", e));

  return NextResponse.json({ ok: true, code: appt.code, when: fmtWhen(date), whatsapp, manage: manageUrl(origin, appt.id).replace(/^https?:\/\/[^/]+/, "") });
}
