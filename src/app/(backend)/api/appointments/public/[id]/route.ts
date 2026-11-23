import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyClientLink } from "@/backend/track-access";
import { fmtWhen } from "@/backend/appointments";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, k: unknown) {
  if (!verifyClientLink(id, k)) return null;
  return prisma.appointment.findUnique({ where: { id }, include: { branch: { select: { name: true, address: true, latitude: true, longitude: true } } } });
}

/** Ver la cita con el enlace personal (?k=) */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const a = await load(id, new URL(request.url).searchParams.get("k"));
  if (!a) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 404 });
  return NextResponse.json({
    code: a.code, when: fmtWhen(a.date), date: a.date, status: a.status, clientName: a.clientName, device: a.device, issue: a.issue,
    branch: { name: a.branch.name, address: a.branch.address, map: a.branch.latitude != null && a.branch.longitude != null ? `https://maps.google.com/?q=${a.branch.latitude},${a.branch.longitude}` : null },
    canCancel: (a.status === "new" || a.status === "confirmed") && a.date.getTime() > Date.now(),
  });
}

/** Cancelar { k } */
export async function POST(request: Request, ctx: Ctx) {
  if (!rateLimit(`appt-c:${getClientIp(request)}`, 20, 60 * 60_000).ok) return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const a = await load(id, body.k);
  if (!a) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 404 });
  if (!(a.status === "new" || a.status === "confirmed") || a.date.getTime() <= Date.now()) return NextResponse.json({ error: "Esta cita ya no se puede cancelar" }, { status: 400 });
  await prisma.appointment.update({ where: { id }, data: { status: "cancelled", cancelledBy: "client" } });
  (async () => {
    const { managerIds, sendPush } = await import("@/backend/push");
    const ids = await managerIds(a.branchId);
    const title = `❌ Cita cancelada · ${a.code}`;
    const message = `${a.clientName} canceló su cita del ${fmtWhen(a.date)}.`;
    await prisma.notification.createMany({ data: ids.map((userId) => ({ type: "appointment", title, message, userId, branchId: a.branchId })) });
    await sendPush(ids, "appointments", { title, body: message, url: "/citas", tag: `cita-${a.id}` });
  })().catch(() => {});
  return NextResponse.json({ ok: true });
}
