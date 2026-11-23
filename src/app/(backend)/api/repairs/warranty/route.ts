import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, unauthorized } from "@/backend/auth";
import { getSettings } from "@/backend/company";

const DAY = 86_400_000;

// Equipos del cliente (por celular) entregados hace menos de los días de garantía.
// Se usa al registrar una nueva OT para avisar "este cliente tiene un equipo en garantía".
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const digits = (new URL(request.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (digits.length < 7) return NextResponse.json({ items: [], warrantyDays: 0 });
  const last8 = digits.slice(-8);
  const s = await getSettings();
  const days = s?.warrantyDays ?? 30;
  if (days <= 0) return NextResponse.json({ items: [], warrantyDays: 0 });
  const branchId = getEffectiveBranchId(request, user);
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.repair.findMany({
    where: { status: "delivered", deliveredAt: { gte: since }, clientPhone: { contains: last8 }, ...(branchId ? { branchId } : {}) },
    select: { id: true, code: true, device: true, brand: true, model: true, issue: true, estimatedCost: true, deliveredAt: true, clientName: true, clientPhone: true, branchId: true },
    orderBy: { deliveredAt: "desc" },
    take: 5,
  });
  const items = rows
    .filter((r) => (r.clientPhone || "").replace(/\D/g, "").endsWith(last8))
    .map((r) => {
      const until = new Date(r.deliveredAt!.getTime() + days * DAY);
      return { ...r, until: until.toISOString(), daysLeft: Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY)) };
    });
  return NextResponse.json({ items, warrantyDays: days });
}
