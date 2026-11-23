import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { afterStockChange } from "@/backend/stock";
import { logMovement } from "@/backend/stock-moves";
import { getUserFromToken } from "@/backend/auth";

// POST /api/transfer — transferir items entre sucursales (solo superadmin)
// Body: { items: [{ type: "inventory"|"equipment"|"console"|"software"|"videogame", id: string }], targetBranchId: string }
export async function POST(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Solo superadmin puede transferir" }, { status: 403 });
    }

    const body = await request.json();
    const { items, targetBranchId } = body;

    if (!targetBranchId || typeof targetBranchId !== "string") {
      return NextResponse.json({ error: "Sucursal destino requerida" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Selecciona al menos un item" }, { status: 400 });
    }

    // Verificar que la sucursal destino existe
    const targetBranch = await prisma.branch.findUnique({ where: { id: targetBranchId }, select: { id: true, name: true } });
    if (!targetBranch) {
      return NextResponse.json({ error: "Sucursal destino no existe" }, { status: 404 });
    }

    const results: { type: string; id: string; name: string; status: "ok" | "error"; error?: string; merged?: boolean; detail?: string }[] = [];

    for (const item of items) {
      try {
        const { type, id } = item;
        switch (type) {
          case "inventory": {
            const record = await prisma.inventoryItem.findUnique({ where: { id }, select: { name: true, branchId: true, quantity: true, price: true, category: true, minStock: true, image: true, cost: true, kind: true } });
            if (!record) { results.push({ type, id, name: "?", status: "error", error: "No encontrado" }); break; }
            if (record.branchId === targetBranchId) { results.push({ type, id, name: record.name, status: "error", error: "Ya está en esa sucursal" }); break; }

            // Cantidad a transferir (parcial o total)
            const qtyToTransfer = Math.min(item.qty && item.qty > 0 ? item.qty : record.quantity, record.quantity);

            // Buscar si en la sucursal destino ya existe un producto con el mismo nombre
            const existing = await prisma.inventoryItem.findFirst({
              where: { branchId: targetBranchId, name: { equals: record.name, mode: "insensitive" } },
            });

            if (existing) {
              // FUSIONAR: sumar stock al existente
              await prisma.inventoryItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + qtyToTransfer },
              });
              await logMovement(existing.id, targetBranchId, existing.quantity, existing.quantity + qtyToTransfer, { reason: "transfer", refCode: "Traspaso" });

              if (qtyToTransfer >= record.quantity) {
                // Transfirió TODO → mover sus números de serie al destino y eliminar item origen
                // (antes el borrado eliminaba en cascada los seriales)
                await prisma.$transaction([
                  prisma.serialUnit.updateMany({ where: { inventoryItemId: id }, data: { inventoryItemId: existing.id } }),
                  prisma.inventoryItem.delete({ where: { id } }),
                ]);
              } else {
                // Transfirió PARCIAL → restar del origen
                await prisma.inventoryItem.update({ where: { id }, data: { quantity: record.quantity - qtyToTransfer } }); void afterStockChange(id, record.quantity); await logMovement(id, record.branchId, record.quantity, record.quantity - qtyToTransfer, { reason: "transfer", refCode: "Traspaso" });
              }

              results.push({ type, id, name: record.name, status: "ok", merged: true, detail: `Fusionado con "${existing.name}" → +${qtyToTransfer} unidades (total destino: ${existing.quantity + qtyToTransfer})` });
            } else {
              if (qtyToTransfer >= record.quantity) {
                // MOVER TODO: simplemente cambiar branchId
                await prisma.inventoryItem.update({ where: { id }, data: { branchId: targetBranchId } });
              } else {
                // MOVER PARCIAL: restar del origen y crear nuevo item en destino
                await prisma.inventoryItem.update({ where: { id }, data: { quantity: record.quantity - qtyToTransfer } }); void afterStockChange(id, record.quantity); await logMovement(id, record.branchId, record.quantity, record.quantity - qtyToTransfer, { reason: "transfer", refCode: "Traspaso" });
                await prisma.inventoryItem.create({
                  data: {
                    name: record.name,
                    category: record.category,
                    quantity: qtyToTransfer,
                    price: record.price,
                    cost: record.cost,
                    kind: record.kind,
                    minStock: record.minStock,
                    image: record.image,
                    branchId: targetBranchId,
                  },
                });
              }
              results.push({ type, id, name: record.name, status: "ok", detail: `${qtyToTransfer} unidad(es) transferida(s)` });
            }
            break;
          }
          case "equipment": {
            const record = await prisma.equipment.findUnique({ where: { id }, select: { name: true, branchId: true } });
            if (!record) { results.push({ type, id, name: "?", status: "error", error: "No encontrado" }); break; }
            if (record.branchId === targetBranchId) { results.push({ type, id, name: record.name, status: "error", error: "Ya está en esa sucursal" }); break; }
            await prisma.equipment.update({ where: { id }, data: { branchId: targetBranchId } });
            results.push({ type, id, name: record.name, status: "ok" });
            break;
          }
          case "console": {
            const record = await prisma.console.findUnique({ where: { id }, select: { name: true, branchId: true } });
            if (!record) { results.push({ type, id, name: "?", status: "error", error: "No encontrado" }); break; }
            if (record.branchId === targetBranchId) { results.push({ type, id, name: record.name, status: "error", error: "Ya está en esa sucursal" }); break; }
            await prisma.console.update({ where: { id }, data: { branchId: targetBranchId } });
            results.push({ type, id, name: record.name, status: "ok" });
            break;
          }
          case "software": {
            const record = await prisma.software.findUnique({ where: { id }, select: { name: true, branchId: true } });
            if (!record) { results.push({ type, id, name: "?", status: "error", error: "No encontrado" }); break; }
            if (record.branchId === targetBranchId) { results.push({ type, id, name: record.name, status: "error", error: "Ya está en esa sucursal" }); break; }
            await prisma.software.update({ where: { id }, data: { branchId: targetBranchId } });
            results.push({ type, id, name: record.name, status: "ok" });
            break;
          }
          case "videogame": {
            const record = await prisma.videogame.findUnique({ where: { id }, select: { name: true, branchId: true } });
            if (!record) { results.push({ type, id, name: "?", status: "error", error: "No encontrado" }); break; }
            if (record.branchId === targetBranchId) { results.push({ type, id, name: record.name, status: "error", error: "Ya está en esa sucursal" }); break; }
            await prisma.videogame.update({ where: { id }, data: { branchId: targetBranchId } });
            results.push({ type, id, name: record.name, status: "ok" });
            break;
          }
          default:
            results.push({ type, id, name: "?", status: "error", error: `Tipo "${type}" no válido` });
        }
      } catch (err) {
        results.push({ type: item.type, id: item.id, name: "?", status: "error", error: errMsg(err) || "Error desconocido" });
      }
    }

    const okCount = results.filter(r => r.status === "ok").length;
    const errCount = results.filter(r => r.status === "error").length;

    return NextResponse.json({
      ok: true,
      targetBranch: targetBranch.name,
      transferred: okCount,
      errors: errCount,
      results,
    });
  } catch (error) {
    console.error("[Transfer] Error:", error);
    return NextResponse.json({ error: "Error al transferir", details: errMsg(error) }, { status: 500 });
  }
}
