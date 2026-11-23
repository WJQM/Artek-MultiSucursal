import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyClientLink } from "@/backend/track-access";
import { fmtWhen } from "@/backend/appointments";
import { cancelReservation, expireDue, notifyStaff } from "@/backend/reservations";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, k: unknown) {
  if (!verifyClientLink(id, k)) return null;
  await expireDue();
  return prisma.reservation.findUnique({ where: { id }, include: { branch: { select: { name: true, address: true, latitude: true, longitude: true } } } });
}

/** Ver el apartado con el enlace personal (?k=) */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await load(id, new URL(request.url).searchParams.get("k"));
  if (!r) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 404 });
  return NextResponse.json({
    code: r.code, status: r.status, itemName: r.itemName, qty: r.qty, total: r.total, clientName: r.clientName,
    expiresAt: r.expiresAt, until: fmtWhen(r.expiresAt), saleCode: r.saleCode,
    branch: { name: r.branch.name, address: r.branch.address, map: r.branch.latitude != null && r.branch.longitude != null ? `https://maps.google.com/?q=${r.branch.latitude},${r.branch.longitude}` : null },
  });
}

/** Cancelar { k } */
export async function POST(request: Request, ctx: Ctx) {
  if (!rateLimit(`resv-c:${getClientIp(request)}`, 20, 60 * 60_000).ok) return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const r = await load(id, body.k);
  if (!r) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 404 });
  if (r.status !== "active") return NextResponse.json({ error: "Este apartado ya no se puede cancelar" }, { status: 400 });
  await cancelReservation(id, "client");
  notifyStaff(r.branchId, `❌ Apartado cancelado · ${r.code}`, `${r.clientName} canceló su apartado de ${r.itemName}. Volvió a la venta.`, `ap-${r.id}`);
  return NextResponse.json({ ok: true });
}
