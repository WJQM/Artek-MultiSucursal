import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import { requireAuth, getEffectiveBranchId } from "@/backend/auth";
import { NextResponse } from "next/server";
import { todayISO } from "@/shared/dates";
import { isSecretKey } from "@/backend/automation";

const USER_FIELDS = { id: true, name: true, email: true, role: true, status: true, phone: true, image: true, branchId: true, createdAt: true } as const;

// Respaldo JSON descargable. Admin: su sucursal. Super Admin: todo (o la sucursal elegida en x-branch-id).
// Nunca incluye contraseñas ni las claves de servicios guardadas en KeyValue.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role === "tech") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const branchId = getEffectiveBranchId(request, user);
    const branchFilter = branchId ? { branchId } : {};

    const [
      branches, users, repairs, notifications, services, inventoryItems, serialUnits, software, quotations,
      certificates, settings, equipment, consoles, videogames, cashMovements, reviews, statusHistory,
      keyValues, repairLogs, messages,
    ] = await Promise.all([
      user.role === "superadmin"
        ? prisma.branch.findMany({ orderBy: { createdAt: "asc" } })
        : branchId ? prisma.branch.findMany({ where: { id: branchId } }) : [],
      prisma.user.findMany({
        where: user.role === "superadmin" ? {} : { branchId },
        select: USER_FIELDS,
        orderBy: { createdAt: "asc" },
      }),
      prisma.repair.findMany({ where: branchFilter, include: { technician: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.notification.findMany({ where: branchFilter, orderBy: { createdAt: "desc" } }),
      prisma.service.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.inventoryItem.findMany({ where: branchFilter, include: { serials: true }, orderBy: { createdAt: "asc" } }),
      prisma.serialUnit.findMany({ where: branchId ? { item: { branchId } } : {}, orderBy: { createdAt: "asc" } }),
      prisma.software.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.quotation.findMany({ where: branchFilter, orderBy: { createdAt: "desc" } }),
      prisma.certificate.findMany({ where: branchFilter, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.settings.findMany(),
      prisma.equipment.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.console.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.videogame.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.cashMovement.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.review.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      branchId
        ? prisma.repair.findMany({ where: { branchId }, select: { id: true } })
            .then((rs) => prisma.statusHistory.findMany({ where: { repairId: { in: rs.map((r) => r.id) } }, orderBy: { createdAt: "asc" } }))
        : prisma.statusHistory.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.keyValue.findMany({ where: branchId ? { key: { endsWith: `_${branchId}` } } : {} })
        .then((rows) => rows.filter((r) => !isSecretKey(r.key))),
      prisma.repairLog.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
      prisma.message.findMany({ where: branchFilter, orderBy: { createdAt: "asc" } }),
    ]);

    const data = {
      branches, users, repairs, notifications, services, inventoryItems, serialUnits, software, quotations,
      certificates, settings, equipment, consoles, videogames, cashMovements, reviews, statusHistory,
      keyValues, repairLogs, messages,
    };
    const backup = {
      meta: {
        version: "1.1",
        generatedAt: new Date().toISOString(),
        generatedBy: { id: user.id, email: user.email, role: user.role },
        scope: branchId ? "branch" : "full",
        branchId: branchId || null,
      },
      data,
      stats: Object.fromEntries(Object.entries(data).map(([k, rows]) => [k, rows.length])),
    };

    const filename = `repairtrack-backup-${branchId ? "branch" : "full"}-${todayISO()}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (errMsg(error) === "NO_AUTH") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.error("Backup error:", error);
    return NextResponse.json({ error: "Error al generar backup" }, { status: 500 });
  }
}
