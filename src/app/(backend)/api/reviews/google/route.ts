import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { getGoogleConfig, monthClicks, saveGoogleConfig } from "@/backend/google-reviews";
import { startOfMonth } from "@/shared/dates";

// Reseñas en Google (solo Super Admin)
async function payload() {
  const [cfg, branches, clicks, reviews] = await Promise.all([
    getGoogleConfig(),
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    monthClicks(),
    prisma.review.groupBy({ by: ["branchId"], where: { createdAt: { gte: startOfMonth() } }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const stats = new Map(reviews.map((r) => [r.branchId, { avg: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null, count: r._count._all }]));
  return { ...cfg, branches: branches.map((b) => ({ ...b, link: cfg.links[b.id] || "", clicks: clicks[b.id] || 0, avg: stats.get(b.id)?.avg ?? null, reviews: stats.get(b.id)?.count ?? 0 })) };
}

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  return NextResponse.json(await payload());
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  try {
    await saveGoogleConfig(await request.json().catch(() => ({})));
    return NextResponse.json(await payload());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
