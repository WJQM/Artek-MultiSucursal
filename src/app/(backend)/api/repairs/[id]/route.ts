import type { Prisma, Repair } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { isPayMethod } from "@/backend/payments";
import { pushRepair, managerIds, later } from "@/backend/push";
import { NextResponse } from "next/server";
import { getUserFromToken, canAccessBranch, forbidden, notFound } from "@/backend/auth";
import { companyInfo } from "@/backend/company";
import { branchLatLng, directionsUrl } from "@/shared/geo";
import { checkStageLog, createStageLog, notifyManagers, touchRepair } from "@/backend/repair-log";
import { publicBaseUrl } from "@/backend/public-url";
import { clientTrackUrl } from "@/backend/track-access";
import { deliveryReceipt } from "@/backend/receipt";
import { cleanImei, imeiKind, recentCheck } from "@/backend/imei";
import { actorOf, alertAfter, applyRepairParts, StockError, type Moved } from "@/backend/stock-moves";
import { sendWhatsAppSafe, buildRepairCompletedMessage, buildDiagnosticMessage, buildInProgressMessage, buildWaitingPartsMessage } from "@/backend/whatsapp";

const VALID_STATUSES = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];
const VALID_PRIORITIES = ["baja", "media", "alta", "urgente"];
const TEXT_MAX = { device: 120, issue: 2000, notes: 5000, short: 120 } as const;

/** Texto recortado (o null si viene vacío o no es texto). */
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Fotos de la orden: JSON con URLs propias (/uploads/...) o una sola URL (órdenes antiguas). Descarta URLs externas. */
function imageList(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const own = (u: unknown): u is string => typeof u === "string" && /^\/uploads\/[\w.-]+$/.test(u);
  let parsed: unknown = null;
  try { parsed = JSON.parse(v); } catch {}
  if (!Array.isArray(parsed)) return own(v.trim()) ? v.trim() : null;
  const list = parsed.filter(own).slice(0, 20);
  return list.length ? JSON.stringify(list) : null;
}

// Registra la fecha real de entrega (y la limpia si la OT vuelve a otro estado)
function applyDeliveredAt(updateData: Prisma.RepairUncheckedUpdateInput, prevStatus: string, newStatus: string | undefined) {
  if (!newStatus || newStatus === prevStatus) return;
  if (newStatus === "delivered") updateData.deliveredAt = new Date();
  else if (prevStatus === "delivered") updateData.deliveredAt = null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando Repuestos",
  in_progress: "En Progreso", completed: "Completado", delivered: "Entregado",
};

// Envía WhatsApp al cliente según el nuevo estado. No bloqueante. Devuelve si se envió (null = no corresponde).
async function notifyClientByStatus(repair: Repair, newStatus: string, origin: string, note?: { text: string; author: string } | null): Promise<boolean | null> {
  if (!repair.clientPhone) return null;
  try {
    const company = await companyInfo(origin);
    // Enlace personal: el cliente ve su orden sin escribir los 4 dígitos
    const base = company.portalUrl.replace(/\/portal$/, "");
    const trackUrl = clientTrackUrl(base, repair);
    const repairInfo = { code: repair.code, device: repair.device, brand: repair.brand, model: repair.model, clientName: repair.clientName, estimatedCost: Number(repair.estimatedCost || 0) };
    let msg = "";
    switch (newStatus) {
      case "diagnosed": msg = buildDiagnosticMessage(repairInfo, company, trackUrl); break;
      case "in_progress": msg = buildInProgressMessage(repairInfo, company, trackUrl); break;
      case "waiting_parts": msg = buildWaitingPartsMessage(repairInfo, company, trackUrl); break;
      case "completed": {
        const branch = repair.branchId ? await prisma.branch.findUnique({ where: { id: repair.branchId }, select: { name: true, address: true, latitude: true, longitude: true } }) : null;
        const point = branchLatLng(branch);
        const pickup = branch && (branch.address || point) ? { name: branch.name, address: branch.address, mapUrl: point ? directionsUrl(point) : null } : null;
        msg = buildRepairCompletedMessage(repairInfo, company, trackUrl, pickup);
        break;
      }
      case "delivered": {
        // Comprobante digital: total, garantía y enlace personal al CE (/delivery/view/OT-X)
        msg = (await deliveryReceipt(repair, origin)).message;
        break;
      }
    }
    // Lo que el técnico registró en la bitácora (si es visible para el cliente) va en el mismo mensaje
    if (msg && note?.text && note.text !== "(solo fotos)") {
      const t = note.text.length > 400 ? note.text.slice(0, 397) + "…" : note.text;
      msg += `\n\n📝 *Nota del técnico (${note.author}):*\n${t}`;
    }
    if (msg) {
      const sent = await sendWhatsAppSafe(repair.clientPhone, msg);
      console.log(`[WhatsApp] ${repair.code} → ${newStatus} → ${repair.clientPhone}: ${sent ? "ENVIADO ✅" : "FALLÓ ❌"}`);
      return sent;
    }
    return null;
  } catch (err) {
    console.error("[WhatsApp] Error en notifyClientByStatus:", err);
    return false;
  }
}


export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    if (user.role === "tech") {
      const repair = await prisma.repair.findUnique({ where: { id } });
      if (!repair || repair.technicianId !== user.id) {
        return NextResponse.json({ error: "No tienes permiso para modificar esta orden" }, { status: 403 });
      }
      // Avanzar pide registrar en la bitácora (diagnóstico, repuesto que falta, informe final)
      const stage = body.status ? checkStageLog(repair.status, body.status, body.log) : { req: null, text: "", images: [] as string[] };
      if ("error" in stage) return NextResponse.json({ error: stage.error, code: "LOG_REQUIRED", logType: stage.req?.type }, { status: 400 });
      const updateData: Prisma.RepairUncheckedUpdateInput = {};
      if (body.status !== undefined) updateData.status = body.status;
      if (body.notes !== undefined) updateData.notes = text(body.notes, TEXT_MAX.notes);
      if (body.paidWith !== undefined) updateData.paidWith = isPayMethod(body.paidWith) ? body.paidWith : null;
      applyDeliveredAt(updateData, repair.status, body.status);

      // Guardar estado anterior para historial
      const prevStatus = repair.status;
      const updated = await prisma.repair.update({ where: { id }, data: updateData });

      if (body.status && body.status !== prevStatus) {
        const entry = stage.req ? await createStageLog(user, repair, body.status, { text: stage.text, images: stage.images, visibleToClient: body.log?.visibleToClient === true, onBehalf: false }) : null;
        if (entry) {
          await notifyManagers(entry, updated).catch(() => {});
          if (entry.visibleToClient) await touchRepair(id);
        }
        // Registrar en historial (con lo escrito en la bitácora)
        try {
          await prisma.statusHistory.create({
            data: {
              repairId: id,
              fromStatus: prevStatus,
              toStatus: body.status,
              changedBy: user.id,
              changedByName: user.email?.split("@")[0] || "Técnico",
              notes: entry ? entry.text.slice(0, 200) : null,
            },
          });
        } catch (e) { console.error("[StatusHistory] Error:", e); }

        await prisma.notification.create({
          data: {
            type: "status_change",
            title: "Estado actualizado por técnico",
            message: `${updated.code} (${updated.device}) cambió a "${STATUS_LABELS[body.status] || body.status}"`,
            userId: updated.userId,
            branchId: updated.branchId,
          },
        });
        const origin = publicBaseUrl(request);
        const whatsappSent = await notifyClientByStatus(updated, body.status, origin, entry?.visibleToClient ? { text: entry.text, author: entry.authorName } : null);
        if (body.status === "completed" && prevStatus !== "completed") later(managerIds(updated.branchId, user.id).then((ids) => pushRepair(ids, "ready", updated.code, `✅ ${updated.code} lista para entregar`, `${updated.device}${updated.clientName ? ` de ${updated.clientName}` : ""}`)));
        return NextResponse.json({ ...updated, whatsappSent });
      }

      return NextResponse.json(updated);
    }

    // Admin / superadmin: solo órdenes de su sucursal (superadmin todas)
    const prevRepair = await prisma.repair.findUnique({ where: { id }, select: { id: true, code: true, status: true, technicianId: true, branchId: true, imei: true, parts: true, notes: true } });
    if (!prevRepair) return notFound("Orden no encontrada");
    if (!canAccessBranch(user, prevRepair.branchId)) return forbidden("No tienes permiso para modificar esta orden");
    // Avanzar pide registrar en la bitácora también al administrador (puede hacerlo a nombre del técnico)
    const stage = body.status ? checkStageLog(prevRepair.status, body.status, body.log) : { req: null, text: "", images: [] as string[] };
    if ("error" in stage) return NextResponse.json({ error: stage.error, code: "LOG_REQUIRED", logType: stage.req?.type }, { status: 400 });

    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    }
    if (body.estimatedCost !== undefined && (isNaN(Number(body.estimatedCost)) || Number(body.estimatedCost) < 0)) {
      return NextResponse.json({ error: "Costo inválido" }, { status: 400 });
    }
    // El técnico asignado debe pertenecer a la misma sucursal de la orden
    if (body.technicianId && body.technicianId !== prevRepair.technicianId) {
      const tech = await prisma.user.findUnique({ where: { id: String(body.technicianId) }, select: { branchId: true, status: true } });
      if (!tech || tech.status !== "active" || tech.branchId !== prevRepair.branchId) {
        return NextResponse.json({ error: "El técnico no pertenece a esta sucursal o no está activo" }, { status: 400 });
      }
    }
    for (const k of ["device", "issue"] as const) {
      if (body[k] !== undefined && !text(body[k], TEXT_MAX[k])) return NextResponse.json({ error: `El campo ${k === "device" ? "equipo" : "problema"} es obligatorio` }, { status: 400 });
    }
    const updateData: Prisma.RepairUncheckedUpdateInput = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = text(body.notes, TEXT_MAX.notes);
    // Equipo y problema son obligatorios: si llegan vacíos se deja el valor anterior (antes la base rechazaba el guardado)
    if (body.device !== undefined) updateData.device = text(body.device, TEXT_MAX.device) ?? undefined;
    if (body.brand !== undefined) updateData.brand = text(body.brand, TEXT_MAX.short);
    if (body.model !== undefined) updateData.model = text(body.model, TEXT_MAX.short);
    if (body.issue !== undefined) updateData.issue = text(body.issue, TEXT_MAX.issue) ?? undefined;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.estimatedCost !== undefined) updateData.estimatedCost = Number(body.estimatedCost);
    if (body.clientName !== undefined) updateData.clientName = text(body.clientName, TEXT_MAX.short);
    if (body.clientPhone !== undefined) updateData.clientPhone = text(body.clientPhone, 30);
    if (body.clientEmail !== undefined) updateData.clientEmail = text(body.clientEmail, 254);
    if (body.image !== undefined) updateData.image = imageList(body.image);
    if (body.accessories !== undefined) updateData.accessories = text(body.accessories, TEXT_MAX.notes);
    if (body.imei !== undefined) {
      const imei = cleanImei(body.imei);
      if (imei && (imeiKind(imei) === "imei-bad" || imeiKind(imei) === "invalid")) return NextResponse.json({ error: "El IMEI no es válido: revisa los 15 dígitos" }, { status: 400 });
      updateData.imei = imei || null;
      // Si cambió el IMEI: se quita la consulta anterior y se guarda la reciente de ese IMEI (si hay)
      if ((imei || null) !== (prevRepair.imei || null)) {
        const recent = imei ? await recentCheck(imei) : null;
        updateData.imeiCheck = recent ? JSON.stringify(recent) : null;
        updateData.imeiCheckedAt = recent ? new Date(recent.at) : null;
      }
    }
    if (body.technicianId !== undefined) updateData.technicianId = body.technicianId || null;
    if (body.paidWith !== undefined) updateData.paidWith = isPayMethod(body.paidWith) ? body.paidWith : null;
    applyDeliveredAt(updateData, prevRepair.status, body.status);

    // Repuestos usados { itemId, qty }[]: el stock se ajusta aquí por la diferencia, junto con la orden
    let moved: Moved[] = [];
    let repair;
    try {
      const actor = Array.isArray(body.parts) ? await actorOf(user) : null;
      repair = await prisma.$transaction(async (tx) => {
        if (actor) {
          // Se relee la orden BLOQUEADA: dos guardados a la vez no descuentan dos veces los mismos repuestos
          const [locked] = await tx.$queryRaw<{ parts: string | null; notes: string | null }[]>`SELECT "parts", "notes" FROM "Repair" WHERE "id" = ${id} FOR UPDATE`;
          const r = await applyRepairParts(tx, { ...prevRepair, parts: locked?.parts ?? null, notes: locked?.notes ?? null }, body.parts, actor);
          updateData.parts = JSON.stringify(r.parts);
          updateData.partsCost = r.partsCost;
          moved = r.moved;
        }
        return tx.repair.update({ where: { id }, data: updateData });
      });
    } catch (e) {
      if (e instanceof StockError) return NextResponse.json({ error: e.message, code: "STOCK" }, { status: 409 });
      throw e;
    }
    alertAfter(moved);

    let entry: Awaited<ReturnType<typeof createStageLog>> = null;
    let whatsappSent: boolean | null = null;
    if (body.status && body.status !== prevRepair?.status) {
      entry = stage.req ? await createStageLog(user, { ...prevRepair, technicianId: repair.technicianId }, body.status, { text: stage.text, images: stage.images, visibleToClient: body.log?.visibleToClient === true, onBehalf: body.log?.onBehalf === true }) : null;
      if (entry?.visibleToClient) await touchRepair(id);
      // Registrar en historial (con lo escrito en la bitácora)
      try {
        await prisma.statusHistory.create({
          data: {
            repairId: id,
            fromStatus: prevRepair?.status || null,
            toStatus: body.status,
            changedBy: user.id,
            changedByName: user.email?.split("@")[0] || "Admin",
            notes: entry ? entry.text.slice(0, 200) : null,
          },
        });
      } catch (e) { console.error("[StatusHistory] Error:", e); }

      await prisma.notification.create({
        data: {
          type: "status_change",
          title: "Estado actualizado",
          message: `${repair.code} (${repair.device}) cambió a "${STATUS_LABELS[body.status] || body.status}"`,
          userId: user.id,
          branchId: repair.branchId,
        },
      });
      const origin = publicBaseUrl(request);
      whatsappSent = await notifyClientByStatus(repair, body.status, origin, entry?.visibleToClient ? { text: entry.text, author: entry.authorName } : null);
    } else {
      await prisma.notification.create({
        data: {
          type: "status_change",
          title: "Orden editada",
          message: `${repair.code} (${repair.device}) fue modificada`,
          userId: user.id,
          branchId: repair.branchId,
        },
      });
    }

    if (body.technicianId && body.technicianId !== prevRepair?.technicianId) {
      await prisma.notification.create({
        data: {
          type: "new_repair",
          title: "Nueva asignación",
          message: `Se te asignó ${repair.code} - ${repair.device}`,
          userId: body.technicianId,
          branchId: repair.branchId,
        },
      });
      if (body.technicianId !== user.id) later(pushRepair([body.technicianId], "assigned", repair.code, `🔧 Te asignaron ${repair.code}`, `${repair.device}${repair.clientName ? ` de ${repair.clientName}` : ""}`));
    }
    if (body.status === "completed" && prevRepair.status !== "completed") later(managerIds(repair.branchId, user.id).then((ids) => pushRepair(ids, "ready", repair.code, `✅ ${repair.code} lista para entregar`, `${repair.device}${repair.clientName ? ` de ${repair.clientName}` : ""}`)));

    return NextResponse.json({ ...repair, whatsappSent });
  } catch (error) {
    console.error("PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (user.role === "tech") {
    return NextResponse.json({ error: "Solo el administrador puede eliminar órdenes" }, { status: 403 });
  }

  try {
    const { id } = await context.params;

    const existing = await prisma.repair.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return notFound("Orden no encontrada");
    if (!canAccessBranch(user, existing.branchId)) return forbidden("No tienes permiso para eliminar esta orden");

    // Borrar dependencias primero (antes fallaba si la OT tenía mensajes)
    const [, , , repair] = await prisma.$transaction([
      prisma.message.deleteMany({ where: { repairId: id } }),
      prisma.statusHistory.deleteMany({ where: { repairId: id } }),
      prisma.review.deleteMany({ where: { repairId: id } }),
      prisma.repair.delete({ where: { id } }),
    ]);

    await prisma.notification.create({
      data: {
        type: "status_change",
        title: "Orden eliminada",
        message: `${repair.code} (${repair.device}) fue eliminada`,
        userId: user.id,
        branchId: repair.branchId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
