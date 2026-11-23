import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { requireAdmin, getEffectiveBranchId, canAccessBranch, forbidden, notFound } from "@/backend/auth";
import { fmtWhen } from "@/backend/appointments";
import { StockError } from "@/backend/stock-moves";
import { cancelReservation, expireDue, extendReservation, sellReservation, HOURS_OPTIONS, ResvError } from "@/backend/reservations";

const STATUSES = ["active", "sold", "expired", "cancelled"] as const;

/** Apartados de la sucursal (?status=active|sold|expired|cancelled) con el conteo de cada estado. */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;
  await expireDue();
  const branchId = getEffectiveBranchId(request, user);
  const where = branchId ? { branchId } : {};
  const qs = new URL(request.url).searchParams.get("status");
  const status = (STATUSES as readonly string[]).includes(qs || "") ? qs! : "active";
  const [rows, groups] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...where, status },
      orderBy: status === "active" ? { expiresAt: "asc" } : { endedAt: "desc" },
      take: status === "active" ? 300 : 100,
      include: { branch: { select: { name: true } } },
    }),
    prisma.reservation.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  // Aviso si se vendió en tienda lo que estaba apartado (stock real menor a lo apartado)
  const invIds = [...new Set(rows.filter((r) => r.kind === "inventory" && r.status === "active").map((r) => r.itemId))];
  const stock = new Map((invIds.length ? await prisma.inventoryItem.findMany({ where: { id: { in: invIds } }, select: { id: true, quantity: true } }) : []).map((i) => [i.id, i.quantity]));
  const heldBy = new Map<string, number>();
  for (const r of rows) if (r.kind === "inventory" && r.status === "active") heldBy.set(r.itemId, (heldBy.get(r.itemId) || 0) + r.qty);
  const waiting = await prisma.reservationWait.groupBy({ by: ["itemId"], where: { itemId: { in: rows.map((r) => r.itemId) }, notifiedAt: null }, _count: { _all: true } });
  const waitMap = new Map(waiting.map((w) => [w.itemId, w._count._all]));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, groups.find((g) => g.status === s)?._count._all || 0]));
  return NextResponse.json({
    status, counts, hoursOptions: HOURS_OPTIONS,
    items: rows.map((r) => ({
      id: r.id, code: r.code, kind: r.kind, itemId: r.itemId, itemName: r.itemName, qty: r.qty, price: r.price, total: r.total,
      clientName: r.clientName, clientPhone: r.clientPhone, status: r.status, expiresAt: r.expiresAt, until: fmtWhen(r.expiresAt),
      createdAt: r.createdAt, endedAt: r.endedAt, extended: r.extended, saleId: r.saleId, saleCode: r.saleCode, cancelledBy: r.cancelledBy,
      branch: r.branch.name, waiting: waitMap.get(r.itemId) || 0,
      stockShort: r.kind === "inventory" && r.status === "active" && stock.has(r.itemId) ? (stock.get(r.itemId) || 0) < (heldBy.get(r.itemId) || 0) : false,
    })),
  });
}

/** { id, action: "sell" (paidWith) | "extend" (hours) | "cancel" } */
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;
  const b = await request.json().catch(() => ({}));
  const r = await prisma.reservation.findUnique({ where: { id: String(b.id || "") }, select: { id: true, branchId: true, code: true, clientName: true } });
  if (!r) return notFound("Apartado no encontrado");
  if (!canAccessBranch(user, r.branchId)) return forbidden();
  try {
    if (b.action === "sell") {
      const paidWith = b.paidWith === "qr" ? "qr" : b.paidWith === "cash" ? "cash" : null;
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
      return NextResponse.json({ ok: true, ...(await sellReservation(r.id, { id: user.id, name: dbUser?.name, email: dbUser?.email }, paidWith)) });
    }
    if (b.action === "extend") {
      const hours = HOURS_OPTIONS.includes(Number(b.hours)) ? Number(b.hours) : 24;
      const { reservation, whatsapp } = await extendReservation(r.id, hours);
      return NextResponse.json({ ok: true, until: fmtWhen(reservation.expiresAt), whatsapp });
    }
    if (b.action === "cancel") {
      const done = await cancelReservation(r.id, "staff");
      if (!done) return NextResponse.json({ error: "Este apartado ya no está activo" }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e) {
    if (e instanceof ResvError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof StockError) return NextResponse.json({ error: `${e.message}. Cancela el apartado o ajusta el stock.`, code: "STOCK" }, { status: 409 });
    console.error("[Apartados]", e);
    return NextResponse.json({ error: "No se pudo completar" }, { status: 500 });
  }
}
