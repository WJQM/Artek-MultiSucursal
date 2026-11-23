import { prisma } from "@/backend/prisma";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withUniqueRetry } from "@/backend/unique-retry";
import { getUserFromToken, getEffectiveBranchId, canAccessBranch, requireAdmin, maskName, maskTail, forbidden, notFound } from "@/backend/auth";
import { actorOf, alertAfter, applySaleChange, saleCost, saleEffect, StockError, type Moved } from "@/backend/stock-moves";
import { rateLimit, getClientIp } from "@/backend/rate-limit";

function parseItems(raw: string) {
  try { return JSON.parse(raw); } catch { return []; }
}

// Vista pública (QR de cotización impresa): sin teléfono completo ni IDs internos
type QuotationWithBranch = Prisma.QuotationGetPayload<{ include: { branch: { select: { id: true; name: true } } } }>;
function publicQuotation(q: QuotationWithBranch) {
  return {
    id: q.id,
    code: q.code,
    type: q.type,
    clientName: maskName(q.clientName),
    clientPhone: maskTail(q.clientPhone, 3),
    items: parseItems(q.items),
    total: q.total,
    notes: q.notes,
    branchId: q.branchId,
    branch: q.branch,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const qBranchId = searchParams.get("branchId");

  if (code) {
    const viewer = await getUserFromToken(request, { allowCookie: true });
    if (!viewer) {
      const rl = rateLimit(`quot:${getClientIp(request)}`, 60, 10 * 60_000);
      if (!rl.ok) return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
    }
    // El técnico no maneja cotizaciones/ventas: al escanear una ve la versión pública, como el cliente
    const view = (q: QuotationWithBranch) => (viewer && viewer.role !== "tech" && canAccessBranch(viewer, q.branchId) ? { ...q, items: parseItems(q.items) } : publicQuotation(q));
    const cleanCode = code.trim().toUpperCase().substring(0, 40);

    if (qBranchId) {
      const quotation = await prisma.quotation.findFirst({ where: { code: cleanCode, branchId: qBranchId }, include: { branch: { select: { id: true, name: true } } } });
      if (!quotation) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json(view(quotation));
    }
    // Search across all branches
    const quotations = await prisma.quotation.findMany({ where: { code: cleanCode }, include: { branch: { select: { id: true, name: true } } } });
    if (quotations.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (quotations.length === 1) return NextResponse.json(view(quotations[0]));
    return NextResponse.json({ multiple: true, quotations: quotations.map(view) });
  }

  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role === "tech") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const branchId = getEffectiveBranchId(request, user);

  const where: Prisma.QuotationWhereInput = {};
  if (branchId) where.branchId = branchId;
  const withItems = <T extends { items: string }>(q: T) => ({ ...q, items: parseItems(q.items) });

  // Paginado (pantalla Cotizaciones): el servidor filtra y manda solo la página que se ve
  if (searchParams.has("page")) {
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));
    const type = searchParams.get("type");
    const search = (searchParams.get("search") || "").trim().slice(0, 80);
    const list: Prisma.QuotationWhereInput = { ...where };
    if (type === "quotation" || type === "sale") list.type = type;
    if (search) list.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { clientPhone: { contains: search } },
    ];
    const [rows, total, byType] = await Promise.all([
      prisma.quotation.findMany({ where: list, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.quotation.count({ where: list }),
      prisma.quotation.groupBy({ by: ["type"], where, _count: { _all: true } }),
    ]);
    const n = (t: string) => byType.find((x) => x.type === t)?._count._all || 0;
    return NextResponse.json({ quotations: rows.map(withItems), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), stats: { quotation: n("quotation"), sale: n("sale") } });
  }

  const quotations = await prisma.quotation.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(quotations.map(withItems));
}

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });

  try {
    const body = await request.json();
    const { clientName, clientPhone, items, total, notes } = body;
    const type = body.type === "sale" ? "sale" : "quotation";
    if (!clientName || !Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    const actor = await actorOf(user);
    const moved: Moved[] = [];

    // Reintenta con el siguiente número si otra persona tomó el mismo código a la vez
    const quotation = await withUniqueRetry(async () => {
      const prefix = type === "sale" ? "NV" : "COT";
      const sep = prefix + "-";
      const result = await prisma.$queryRaw<{max_num: number}[]>`
        SELECT COALESCE(MAX(CAST(REPLACE(code, ${sep}, '') AS INTEGER)), 0) as max_num
        FROM "Quotation"
        WHERE "branchId" = ${branchId} AND "type" = ${type} AND code ~ ${`^${prefix}-[0-9]+$`}
      `;
      const code = `${prefix}-${(result[0]?.max_num || 0) + 1}`;

      // Venta: el stock se descuenta aquí mismo, en la misma operación (si falta stock no se guarda nada)
      return await prisma.$transaction(async (tx) => {
        const cost = type === "sale" ? await saleCost(tx, items) : { costTotal: 0, costComplete: true };
        const q = await tx.quotation.create({
          data: { code, type: type || "quotation", clientName, clientPhone: clientPhone || "", items: JSON.stringify(items), total: total || 0, notes: notes || "", userId: user.id, branchId, ...cost },
        });
        if (type === "sale") moved.push(...await applySaleChange(tx, branchId, saleEffect("quotation", []), saleEffect("sale", items), { reason: "sale", refCode: code, refId: q.id, ...actor }));
        return q;
      });
    });
    alertAfter(moved);

    return NextResponse.json({ ...quotation, items: ((() => { try { return JSON.parse(quotation.items); } catch { return []; } })()) }, { status: 201 });
  } catch (error) {
    if (error instanceof StockError) return NextResponse.json({ error: error.message, code: "STOCK" }, { status: 409 });
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, clientName, clientPhone, items, total, notes } = body;
    const type = body.type === undefined ? undefined : body.type === "sale" ? "sale" : "quotation";
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const owned = await prisma.quotation.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();

    const updateData: Prisma.QuotationUpdateInput = {};
    if (type) updateData.type = type;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone;
    if (items) updateData.items = JSON.stringify(items);
    if (total !== undefined) updateData.total = total;
    if (notes !== undefined) updateData.notes = notes;

    if (type) {
      const existing = await prisma.quotation.findUnique({ where: { id } });
      if (existing && existing.type !== type) {
        const prefix = type === "sale" ? "NV" : "COT";
        const sep = prefix + "-";
        const result = await prisma.$queryRaw<{max_num: number}[]>`
          SELECT COALESCE(MAX(CAST(REPLACE(code, ${sep}, '') AS INTEGER)), 0) as max_num
          FROM "Quotation"
          WHERE "branchId" = ${existing.branchId} AND "type" = ${type} AND code ~ ${`^${prefix}-[0-9]+$`}
        `;
        updateData.code = `${prefix}-${(result[0]?.max_num || 0) + 1}`;
      }
    }

    // Stock: se ajusta por la diferencia entre la venta como estaba y como queda (o se devuelve todo si deja de ser venta)
    const prev = await prisma.quotation.findUnique({ where: { id } });
    const prevItems = (() => { try { return JSON.parse(prev!.items); } catch { return []; } })();
    const nextType = type || prev!.type;
    const nextItems = items || prevItems;
    const actor = await actorOf(user);
    let moved: Moved[] = [];
    const quotation = await prisma.$transaction(async (tx) => {
      if (nextType === "sale") Object.assign(updateData, await saleCost(tx, nextItems));
      const q = await tx.quotation.update({ where: { id }, data: updateData });
      if (prev!.type === "sale" || nextType === "sale") {
        moved = await applySaleChange(tx, prev!.branchId, saleEffect(prev!.type, prevItems), saleEffect(nextType, nextItems), { reason: prev!.type !== "sale" ? "sale" : nextType === "sale" ? "sale_edit" : "sale_undo", refCode: prev!.type === "sale" && nextType !== "sale" ? prev!.code : q.code, refId: q.id, ...actor });
      }
      return q;
    });
    alertAfter(moved);
    return NextResponse.json({ ...quotation, items: ((() => { try { return JSON.parse(quotation.items); } catch { return []; } })()) });
  } catch (error) {
    if (error instanceof StockError) return NextResponse.json({ error: error.message, code: "STOCK" }, { status: 409 });
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.quotation.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    // Venta eliminada: los artículos vuelven al stock y los equipos/consolas quedan disponibles
    const q = await prisma.quotation.findUnique({ where: { id } });
    const actor = await actorOf(user);
    await prisma.$transaction(async (tx) => {
      if (q?.type === "sale") {
        const its = (() => { try { return JSON.parse(q.items); } catch { return []; } })();
        await applySaleChange(tx, q.branchId, saleEffect("sale", its), saleEffect("quotation", []), { reason: "sale_delete", refCode: q.code, refId: q.id, ...actor });
      }
      await tx.quotation.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
