import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { requireAdmin, getEffectiveBranchId } from "@/backend/auth";
import { addDays } from "@/shared/dates";

// GET /api/reviews/list?days=30|90|365|0&rating=1..5  — reseñas de clientes (solo administradores)
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const url = new URL(request.url);
    const branchId = getEffectiveBranchId(request, user);
    const days = Math.max(0, Math.min(3650, parseInt(url.searchParams.get("days") || "0") || 0));
    const rating = parseInt(url.searchParams.get("rating") || "0") || 0;

    const where: Prisma.ReviewWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (days) where.createdAt = { gte: addDays(new Date(), -days) };

    // Resumen del período (sin filtro de estrellas) y lista (con filtro)
    const [all, items] = await Promise.all([
      prisma.review.findMany({ where, select: { rating: true, comment: true } }),
      prisma.review.findMany({
        where: rating >= 1 && rating <= 5 ? { ...where, rating } : where,
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);

    const dist = [0, 0, 0, 0, 0];
    for (const r of all) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++;
    const count = all.length;
    const average = count ? all.reduce((s, r) => s + r.rating, 0) / count : 0;
    const withComment = all.filter((r) => r.comment && r.comment.trim()).length;

    // Datos de la orden (equipo, técnico, sucursal)
    const repairs = await prisma.repair.findMany({
      where: { id: { in: items.map((i) => i.repairId) } },
      select: {
        id: true, device: true, brand: true, model: true, clientPhone: true, deliveredAt: true, branchId: true,
        technician: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
    const byId = new Map(repairs.map((r) => [r.id, r]));

    return NextResponse.json({
      summary: { count, average: Math.round(average * 10) / 10, distribution: dist, withComment },
      reviews: items.map((i) => {
        const r = byId.get(i.repairId);
        return {
          id: i.id,
          repairCode: i.repairCode,
          rating: i.rating,
          comment: i.comment,
          clientName: i.clientName,
          clientPhone: r?.clientPhone || null,
          createdAt: i.createdAt,
          device: r ? [r.device, r.brand, r.model].filter(Boolean).join(" ") : null,
          technician: r?.technician?.name || null,
          branchId: i.branchId,
          branchName: r?.branch?.name || null,
        };
      }),
    });
  } catch (e) {
    console.error("[Reviews list] Error:", e);
    return NextResponse.json({ error: "Error al cargar reseñas" }, { status: 500 });
  }
}
