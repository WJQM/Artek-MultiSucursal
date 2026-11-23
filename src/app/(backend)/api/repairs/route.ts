import { prisma } from "@/backend/prisma";
import type { Prisma } from "@prisma/client";
import { parseLocalDate, addDays } from "@/shared/dates";
import { pushRepair, managerIds, later } from "@/backend/push";
import { NextResponse } from "next/server";
import { withUniqueRetry } from "@/backend/unique-retry";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";
import { companyInfo } from "@/backend/company";
import { publicBaseUrl } from "@/backend/public-url";
import { sendWhatsAppSafe, buildRepairCreatedMessage } from "@/backend/whatsapp";
import { clientTrackUrl } from "@/backend/track-access";
import { cleanImei, imeiKind, recentCheck } from "@/backend/imei";

async function generateCode(branchId: string): Promise<string> {
  const result = await prisma.$queryRaw<{max_num: number}[]>`
    SELECT COALESCE(MAX(CAST(REPLACE(code, 'OT-', '') AS INTEGER)), 0) as max_num
    FROM "Repair"
    WHERE "branchId" = ${branchId} AND code ~ '^OT-[0-9]+$'
  `;
  return `OT-${(result[0]?.max_num || 0) + 1}`;
}

/** El técnico no ve precios de compra ni ganancia */
function hideCost<T extends { parts?: string | null; partsCost?: number }>(r: T): T {
  let parts = r.parts;
  try { if (parts) parts = JSON.stringify((JSON.parse(parts) as Record<string, unknown>[]).map(({ cost: _c, ...p }) => { void _c; return p; })); } catch { /* deja igual */ }
  return { ...r, parts, partsCost: 0 };
}

/** Campos livianos para listas (Extracto): sin fotos, notas, repuestos ni datos de IMEI */
const SLIM = {
  id: true, code: true, device: true, brand: true, model: true, issue: true, status: true, priority: true,
  estimatedCost: true, clientName: true, clientPhone: true, clientEmail: true, createdAt: true, updatedAt: true,
} as const;

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const branchId = getEffectiveBranchId(request, user);
  const { searchParams } = new URL(request.url);
  const paginated = searchParams.has("page");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));
  const search = (searchParams.get("search") || "").trim();
  const status = searchParams.get("status") || "";
  const from = parseLocalDate(searchParams.get("from"));
  const to = parseLocalDate(searchParams.get("to"));
  const oldestFirst = searchParams.get("sort") === "old";
  const slim = searchParams.get("slim") === "1";
  // Un cliente exacto (Extracto: ver / imprimir el historial de un cliente)
  const clientName = searchParams.get("clientName");
  const clientPhone = searchParams.get("clientPhone");

  // Filtros base (sucursal / técnico) + estado + fechas; la búsqueda va aparte para poder resumir sin ella
  const base: Prisma.RepairWhereInput = {};
  if (user.role === "tech") { base.technicianId = user.id; if (user.branchId) base.branchId = user.branchId; }
  else if (branchId) { base.branchId = branchId; }
  if (status === "active") base.status = { notIn: ["completed", "delivered"] };
  else if (status === "open") base.status = { not: "delivered" };
  else if (status && status !== "all") base.status = status;
  if (from || to) base.createdAt = { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) };
  if (clientName !== null) {
    const and: Prisma.RepairWhereInput[] = [];
    and.push(clientName ? { clientName: { equals: clientName, mode: "insensitive" } } : { OR: [{ clientName: null }, { clientName: "" }] });
    if (clientPhone !== null) and.push(clientPhone ? { clientPhone } : { OR: [{ clientPhone: null }, { clientPhone: "" }] });
    base.AND = and;
  }

  const where: Prisma.RepairWhereInput = { ...base };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { device: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { clientPhone: { contains: search } },
    ];
  }
  const orderBy: Prisma.RepairOrderByWithRelationInput = { createdAt: oldestFirst ? "asc" : "desc" };
  const include = { technician: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } };
  const clean = <T extends { parts?: string | null; partsCost?: number }>(rows: T[]) => user.role === "tech" ? rows.map(hideCost) : rows;

  // Solo contar (extracto impreso: avisa cuántas hojas saldrán antes de descargar la lista)
  if (searchParams.get("count") === "1") return NextResponse.json({ total: await prisma.repair.count({ where }) });

  // Sin paginar: lista completa (filtrada). Se usa para imprimir y para el historial de un cliente.
  if (!paginated) {
    const repairs = slim
      ? await prisma.repair.findMany({ where, select: SLIM, orderBy })
      : await prisma.repair.findMany({ where, include, orderBy });
    return NextResponse.json(clean(repairs as { parts?: string | null; partsCost?: number }[]));
  }

  // Extracto: totales del rango (clientes únicos, equipos, en taller) sin contar la búsqueda
  if (searchParams.get("summary") === "1") {
    const [list, total, devices, active, clients] = await Promise.all([
      prisma.repair.findMany({ where, select: SLIM, orderBy, skip: (page - 1) * limit, take: limit }),
      prisma.repair.count({ where }),
      prisma.repair.count({ where: base }),
      prisma.repair.count({ where: { AND: [base, { status: { not: "delivered" } }] } }),
      prisma.repair.groupBy({ by: ["clientName", "clientPhone"], where: base }).then(g => new Set(g.map(x => `${(x.clientName || "").toLowerCase()}|${x.clientPhone || ""}`)).size),
    ]);
    return NextResponse.json({ repairs: list, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary: { devices, active, clients } });
  }

  // Paginated: return object with stats (dashboard)
  const [repairs, total] = await Promise.all([
    prisma.repair.findMany({ where, include, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.repair.count({ where }),
  ]);

  const sw: Prisma.RepairWhereInput = {};
  if (user.role === "tech") { sw.technicianId = user.id; if (user.branchId) sw.branchId = user.branchId; }
  else if (branchId) { sw.branchId = branchId; }

  const [totalAll, pending, diagnosed, waitingParts, inProgress, completed, delivered, revenue] = await Promise.all([
    prisma.repair.count({ where: sw }),
    prisma.repair.count({ where: { ...sw, status: "pending" } }),
    prisma.repair.count({ where: { ...sw, status: "diagnosed" } }),
    prisma.repair.count({ where: { ...sw, status: "waiting_parts" } }),
    prisma.repair.count({ where: { ...sw, status: "in_progress" } }),
    prisma.repair.count({ where: { ...sw, status: "completed" } }),
    prisma.repair.count({ where: { ...sw, status: "delivered" } }),
    prisma.repair.aggregate({ where: { ...sw, status: "delivered" }, _sum: { estimatedCost: true } }),
  ]);

  return NextResponse.json({
    repairs: clean(repairs), total, page, limit, totalPages: Math.ceil(total / limit),
    stats: { total: totalAll, pending: pending + diagnosed + waitingParts, inProgress, completed: completed + delivered, revenue: revenue._sum.estimatedCost || 0,
      byStatus: { pending, diagnosed, waiting_parts: waitingParts, in_progress: inProgress, completed, delivered } },
  });
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();

    // Determine branch
    const branchId = getEffectiveBranchId(request, user) || body.branchId;
    if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });

    if (user.role !== "superadmin" && branchId !== user.branchId) {
      return NextResponse.json({ error: "Sucursal no permitida" }, { status: 403 });
    }
    if (body.technicianId) {
      const tech = await prisma.user.findUnique({ where: { id: body.technicianId }, select: { branchId: true } });
      if (!tech || tech.branchId !== branchId) {
        return NextResponse.json({ error: "El técnico no pertenece a esta sucursal" }, { status: 400 });
      }
    }

    // Reingreso por garantía: la OT original debe ser de esta sucursal y estar entregada
    let warrantyOf: string | null = null;
    if (body.warrantyOf) {
      const orig = await prisma.repair.findFirst({ where: { code: String(body.warrantyOf), branchId, status: "delivered" }, select: { code: true } });
      if (!orig) return NextResponse.json({ error: "La orden en garantía no existe o no fue entregada" }, { status: 400 });
      warrantyOf = orig.code;
    }

    // IMEI / número de serie (opcional). Si ya se pagó una consulta para ese IMEI, se guarda en la orden.
    const imei = cleanImei(body.imei);
    if (imei && (imeiKind(imei) === "imei-bad" || imeiKind(imei) === "invalid")) {
      return NextResponse.json({ error: "El IMEI no es válido: revisa los 15 dígitos (marca *#06# en el celular)" }, { status: 400 });
    }
    const imeiCheck = imei ? await recentCheck(imei) : null;

    // Reintenta con el siguiente número si otra persona tomó el mismo código a la vez
    const repair = await withUniqueRetry(async () => {
      const code = await generateCode(branchId);

      return await prisma.repair.create({
        data: {
          code,
          device: body.device || "",
          brand: body.brand || null,
          model: body.model || null,
          issue: body.issue || "",
          priority: ["baja", "media", "alta", "urgente"].includes(body.priority) ? body.priority : "media",
          estimatedCost: Math.max(0, Number(body.estimatedCost) || 0),
          notes: body.notes || null,
          image: body.image || null,
          accessories: body.accessories || null,
          imei: imei || null,
          imeiCheck: imeiCheck ? JSON.stringify(imeiCheck) : null,
          imeiCheckedAt: imeiCheck ? new Date(imeiCheck.at) : null,
          clientName: body.clientName || null,
          clientPhone: body.clientPhone || null,
          clientEmail: body.clientEmail || null,
          qrCode: code,
          userId: user.id,
          branchId,
          technicianId: body.technicianId || null,
          warrantyOf,
        },
      });
    });

    // Historial inicial de estado (pending)
    try {
      await prisma.statusHistory.create({
        data: {
          repairId: repair.id,
          fromStatus: null,
          toStatus: repair.status || "pending",
          changedBy: user.id,
          changedByName: user.email?.split("@")[0] || "Sistema",
          notes: "Orden creada",
        },
      });
    } catch (e) { console.error("[StatusHistory] Error:", e); }

    // Si viene de una cita ("Llegó: crear orden"), la cita queda atendida con su orden
    if (typeof body.appointmentId === "string" && body.appointmentId) {
      await prisma.appointment.updateMany({ where: { id: body.appointmentId, branchId, status: { in: ["new", "confirmed", "noshow"] } }, data: { status: "done", repairId: repair.id } }).catch(() => {});
    }

    await prisma.notification.create({
      data: {
        type: "new_repair",
        title: "Nueva orden creada",
        message: `${repair.code} - ${repair.device} (${body.clientName || "Sin nombre"})`,
        userId: user.id,
        branchId,
      },
    });

    if (body.technicianId) {
      await prisma.notification.create({
        data: {
          type: "new_repair",
          title: "Nueva asignación",
          message: `Se te asignó ${repair.code} - ${repair.device} (${body.clientName || "Sin nombre"})`,
          userId: body.technicianId,
          branchId,
        },
      });
    }
    {
      const who = body.clientName || "Sin nombre";
      if (body.technicianId && body.technicianId !== user.id) later(pushRepair([body.technicianId], "assigned", repair.code, `🔧 Te asignaron ${repair.code}`, `${repair.device} de ${who}`));
      later(managerIds(branchId, user.id).then((ids) => pushRepair(ids.filter((id) => id !== body.technicianId), "new_orders", repair.code, `📥 Nueva orden ${repair.code}`, `${repair.device} de ${who}`)));
    }

    // Envío automático de WhatsApp al cliente (bloqueante pero seguro)
    if (repair.clientPhone) {
      try {
        const origin = publicBaseUrl(request);
        const company = await companyInfo(origin);
        // Enlace personal: el cliente ve su orden sin escribir los 4 dígitos
        const trackUrl = clientTrackUrl(company.portalUrl.replace(/\/portal$/, ""), repair);
        const msg = buildRepairCreatedMessage(
          { code: repair.code, device: repair.device, brand: repair.brand, model: repair.model, clientName: repair.clientName },
          company,
          trackUrl
        );
        const sent = await sendWhatsAppSafe(repair.clientPhone, msg);
        console.log(`[WhatsApp] OT ${repair.code} creada → ${repair.clientPhone}: ${sent ? "ENVIADO ✅" : "FALLÓ ❌"}`);
      } catch (err) {
        console.error("[WhatsApp] Error al enviar notificación de creación:", err);
      }
    } else {
      console.log(`[WhatsApp] OT ${repair.code} creada sin teléfono, no se envía mensaje`);
    }

    return NextResponse.json(repair);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
