import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden, getEffectiveBranchId, canAccessBranch, isAdmin } from "@/backend/auth";
import { publicBaseUrl } from "@/backend/public-url";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { withUniqueRetry } from "@/backend/unique-retry";
import { cancelledMessage, cleanPhone, confirmationMessage, fmtWhen, nextCode, publicOrigin, timeOf } from "@/backend/appointments";
import { zonedMidnight, startOfDay, addDays } from "@/shared/dates";

const STATUSES = ["new", "confirmed", "cancelled", "done", "noshow"];

const view = (a: { id: string; code: string; date: Date; clientName: string; clientPhone: string; device: string; issue: string | null; status: string; cancelledBy: string | null; repairId: string | null; source: string; remindedAt: Date | null; createdAt: Date }, repairCode?: string | null) => ({
  ...a, when: fmtWhen(a.date), time: timeOf(a.date), repairCode: repairCode || null,
});

/** Lista de citas de la sucursal. ?id=… (una) · ?from=AAAA-MM-DD&days=N (por defecto hoy y 7 días) */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const a = await prisma.appointment.findUnique({ where: { id } });
    if (!a || !canAccessBranch(user, a.branchId)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(view(a));
  }
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  const fromS = url.searchParams.get("from");
  const m = fromS && /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromS);
  const from = m ? zonedMidnight(+m[1], +m[2], +m[3]) : startOfDay();
  const days = Math.min(62, Math.max(1, parseInt(url.searchParams.get("days") || "8") || 8));
  const rows = await prisma.appointment.findMany({ where: { branchId, date: { gte: from, lt: addDays(from, days) } }, orderBy: { date: "asc" }, take: 500 });
  const repairIds = rows.map((r) => r.repairId).filter(Boolean) as string[];
  const codes = new Map((repairIds.length ? await prisma.repair.findMany({ where: { id: { in: repairIds } }, select: { id: true, code: true } }) : []).map((r) => [r.id, r.code]));
  const pendingToday = await prisma.appointment.count({ where: { branchId, status: "new", date: { gte: startOfDay() } } });
  return NextResponse.json({ items: rows.map((a) => view(a, a.repairId ? codes.get(a.repairId) : null)), pendingNew: pendingToday });
}

/** Anotar una cita por teléfono { date: AAAA-MM-DD, time: HH:MM, clientName, clientPhone, device, issue } */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(b.date, 10)), t = /^(\d{1,2}):(\d{2})$/.exec(str(b.time, 5));
  if (!d || !t) return NextResponse.json({ error: "Elige día y hora" }, { status: 400 });
  const date = new Date(zonedMidnight(+d[1], +d[2], +d[3]).getTime() + (+t[1] * 60 + +t[2]) * 60_000);
  const phone = cleanPhone(b.clientPhone);
  const clientName = str(b.clientName, 80), device = str(b.device, 80);
  if (clientName.length < 2 || !phone || device.length < 2) return NextResponse.json({ error: "Completa nombre, celular válido y equipo" }, { status: 400 });
  const appt = await withUniqueRetry(async () => prisma.appointment.create({
    data: { code: await nextCode(branchId), branchId, date, clientName, clientPhone: phone, device, issue: str(b.issue, 300) || null, status: "confirmed", source: "staff" },
  }));
  let whatsapp = false;
  if (b.notify !== false) whatsapp = await sendWhatsAppSafe(phone, await confirmationMessage(appt, await publicOrigin(publicBaseUrl(request))));
  return NextResponse.json({ ...view(appt), whatsapp }, { status: 201 });
}

/** Cambiar estado { id, status, notify? } (al cancelar se avisa al cliente por WhatsApp) */
export async function PATCH(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const b = await request.json().catch(() => ({}));
  const a = await prisma.appointment.findUnique({ where: { id: String(b.id || "") } });
  if (!a || !canAccessBranch(user, a.branchId)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  if (a.status === "done" && b.status !== "done") return NextResponse.json({ error: "Esta cita ya tiene orden" }, { status: 400 });
  const upd = await prisma.appointment.update({ where: { id: a.id }, data: { status: b.status, cancelledBy: b.status === "cancelled" ? "staff" : null } });
  let whatsapp: boolean | null = null;
  if (b.status === "cancelled" && a.status !== "cancelled" && b.notify !== false && a.date.getTime() > Date.now()) whatsapp = await sendWhatsAppSafe(a.clientPhone, await cancelledMessage(a));
  return NextResponse.json({ ...view(upd), whatsapp });
}
