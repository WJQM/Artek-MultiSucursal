import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const branchId = getEffectiveBranchId(request, user);

  const where: Prisma.UserWhereInput = { role: "tech" };
  if (branchId) where.branchId = branchId;

  const technicians = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, branchId: true },
    orderBy: { name: "asc" },
  });

  // Órdenes sin entregar de cada técnico (se muestran al asignar, para repartir el trabajo)
  const active = technicians.length
    ? await prisma.repair.groupBy({
        by: ["technicianId"],
        where: { technicianId: { in: technicians.map((t) => t.id) }, status: { not: "delivered" } },
        _count: { _all: true },
      })
    : [];
  const activeById = new Map(active.map((a) => [a.technicianId, a._count._all]));

  return NextResponse.json(technicians.map((t) => ({ ...t, activeCount: activeById.get(t.id) ?? 0 })));
}
