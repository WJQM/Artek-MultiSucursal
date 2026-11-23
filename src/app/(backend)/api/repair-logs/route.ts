import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";
import { isLogType, parseImages } from "@/backend/repair-log";

/**
 * Reportes técnicos: todas las entradas de bitácora (administradores).
 * Admin: su sucursal. Super admin: la sucursal activa, o todas si no manda sucursal.
 * Filtros: ?days=30&type=hallazgo&author=<userId>&visible=client|internal&q=OT-12
 */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "superadmin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const branchId = getEffectiveBranchId(request, user);
  const days = Math.max(0, Math.min(3650, Number(sp.get("days") || 30) || 0));
  const type = sp.get("type");
  const author = sp.get("author");
  const visible = sp.get("visible");
  const q = (sp.get("q") || "").trim().toUpperCase().slice(0, 40);

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (days) where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) };
  if (isLogType(type)) where.type = type;
  if (author) where.authorId = author;
  if (visible === "client") where.visibleToClient = true;
  if (visible === "internal") where.visibleToClient = false;
  if (q) where.repair = { code: { contains: q } };

  const [rows, authors, branches] = await Promise.all([
    prisma.repairLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { repair: { select: { code: true, device: true, brand: true, model: true, clientName: true, status: true } } },
    }),
    prisma.repairLog.groupBy({ by: ["authorId", "authorName"], where: branchId ? { branchId } : {}, _count: { _all: true } }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + 1;

  return NextResponse.json({
    allBranches: !branchId,
    total: rows.length,
    byType,
    authors: authors.map((a) => ({ id: a.authorId, name: a.authorName, count: a._count._all })).sort((a, b) => b.count - a.count),
    entries: rows.map((r) => ({
      id: r.id, type: r.type, text: r.text, images: parseImages(r.images), authorName: r.authorName, authorRole: r.authorRole,
      visibleToClient: r.visibleToClient, hidden: r.hidden, createdAt: r.createdAt, stage: r.status, recordedByName: r.recordedByName,
      repairId: r.repairId, code: r.repair.code, device: [r.repair.device, r.repair.brand, r.repair.model].filter(Boolean).join(" "),
      clientName: r.repair.clientName, status: r.repair.status, branchName: branchName.get(r.branchId) || null,
    })),
  });
}
