import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";

// GET /api/reviews/public — resumen de calificaciones y algunos comentarios buenos para el portal.
// Público: no devuelve nombres, celulares ni códigos de orden; solo estrellas, comentario, tipo de equipo y fecha.
export async function GET() {
  try {
    const [agg, best] = await Promise.all([
      prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      prisma.review.findMany({
        where: { rating: { gte: 4 }, comment: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { rating: true, comment: true, repairId: true, createdAt: true },
      }),
    ]);
    const good = best.filter((r) => (r.comment || "").trim().length >= 8);
    // 3 o 6 para que las filas del portal queden parejas
    const withText = good.slice(0, good.length >= 6 ? 6 : 3);
    const devices = await prisma.repair.findMany({ where: { id: { in: withText.map((r) => r.repairId) } }, select: { id: true, device: true } });
    const deviceOf = new Map(devices.map((d) => [d.id, d.device]));
    return NextResponse.json({
      count: agg._count._all,
      average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      reviews: withText.map((r) => ({ rating: r.rating, comment: (r.comment || "").trim().slice(0, 280), device: deviceOf.get(r.repairId) || null, createdAt: r.createdAt })),
    });
  } catch {
    return NextResponse.json({ count: 0, average: 0, reviews: [] });
  }
}
