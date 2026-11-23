import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, forbidden, notFound } from "@/backend/auth";
import { managerIds } from "@/backend/push";

// POST /api/repairs/[id]/take — un técnico toma una orden de su sucursal asignada a otro
// (o sin asignar), por ejemplo cuando el compañero no vino. Queda en el historial y se avisa
// a los administradores de la sucursal y al técnico anterior.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role !== "tech") return forbidden("Solo los técnicos pueden tomar órdenes; el administrador las reasigna desde el panel");

  const { id } = await context.params;
  const repair = await prisma.repair.findUnique({
    where: { id },
    select: { id: true, code: true, device: true, status: true, branchId: true, technicianId: true, technician: { select: { name: true } } },
  });
  if (!repair) return notFound("Orden no encontrada");
  if (repair.branchId !== user.branchId) return forbidden("La orden es de otra sucursal");
  if (repair.technicianId === user.id) return NextResponse.json({ error: "Esta orden ya es tuya" }, { status: 400 });
  if (repair.status === "delivered") return NextResponse.json({ error: "La orden ya fue entregada" }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const myName = me?.name || user.email?.split("@")[0] || "Técnico";
  const prevName = repair.technician?.name || null;

  // Solo si nadie la cambió entre la lectura y ahora (dos técnicos tomándola a la vez)
  const { count } = await prisma.repair.updateMany({
    where: { id, technicianId: repair.technicianId, status: { not: "delivered" } },
    data: { technicianId: user.id },
  });
  if (count === 0) return NextResponse.json({ error: "La orden acaba de cambiar. Actualiza la pantalla." }, { status: 409 });

  try {
    await prisma.statusHistory.create({
      data: {
        repairId: id, fromStatus: repair.status, toStatus: repair.status,
        changedBy: user.id, changedByName: myName,
        notes: prevName ? `${myName} tomó la orden (antes: ${prevName})` : `${myName} tomó la orden`,
      },
    });
  } catch (e) { console.error("[take] historial:", e); }

  const message = prevName
    ? `${myName} tomó ${repair.code} (${repair.device}), que estaba asignada a ${prevName}`
    : `${myName} tomó ${repair.code} (${repair.device})`;
  const targets = [...(await managerIds(repair.branchId)), ...(repair.technicianId ? [repair.technicianId] : [])];
  if (targets.length) {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({ type: "status_change", title: "Orden tomada por otro técnico", message, userId, branchId: repair.branchId })),
    });
  }

  return NextResponse.json({ ok: true, code: repair.code });
}
