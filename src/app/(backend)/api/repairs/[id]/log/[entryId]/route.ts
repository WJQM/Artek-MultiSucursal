import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { publicBaseUrl } from "@/backend/public-url";
import {
  canReadLog, isManager, isLogType, cleanImages, withinEditWindow, notifyClient, touchRepair, MAX_TEXT, EDIT_WINDOW_MIN,
} from "@/backend/repair-log";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

async function load(request: Request, context: Ctx) {
  const user = await getUserFromToken(request);
  if (!user) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { id, entryId } = await context.params;
  const entry = await prisma.repairLog.findUnique({
    where: { id: entryId },
    include: { repair: { select: { id: true, code: true, device: true, brand: true, model: true, branchId: true, technicianId: true, clientName: true, clientPhone: true } } },
  });
  if (!entry || entry.repairId !== id) return { error: NextResponse.json({ error: "No encontrada" }, { status: 404 }) };
  if (!canReadLog(user, entry.repair)) return { error: NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 }) };
  return { user, entry };
}

/**
 * Autor (dentro de los primeros minutos): corrige tipo, texto, fotos y visibilidad.
 * Administrador / super admin (siempre): mostrar u ocultar al cliente, ocultar la entrada.
 */
export async function PATCH(request: Request, context: Ctx) {
  const r = await load(request, context);
  if ("error" in r) return r.error;
  const { user, entry } = r;
  const body = await request.json().catch(() => ({}));
  const manager = isManager(user);
  const author = entry.authorId === user.id && withinEditWindow(entry.createdAt);
  const data: Record<string, unknown> = {};

  if (body.text !== undefined || body.type !== undefined || body.images !== undefined) {
    if (!author) return NextResponse.json({ error: `Solo el autor puede corregir su entrada durante los primeros ${EDIT_WINDOW_MIN} minutos` }, { status: 403 });
    if (body.type !== undefined && isLogType(body.type)) data.type = body.type;
    if (body.text !== undefined) data.text = String(body.text).trim().slice(0, MAX_TEXT) || entry.text;
    if (body.images !== undefined) { const imgs = cleanImages(body.images); data.images = imgs.length ? JSON.stringify(imgs) : null; }
  }
  if (body.visibleToClient !== undefined) {
    if (!author && !manager) return NextResponse.json({ error: "No puedes cambiar la visibilidad de esta entrada" }, { status: 403 });
    data.visibleToClient = body.visibleToClient === true && (data.type ?? entry.type) !== "comentario";
  }
  if (body.hidden !== undefined) {
    if (!manager) return NextResponse.json({ error: "Solo un administrador puede ocultar entradas" }, { status: 403 });
    data.hidden = body.hidden === true;
    data.hiddenById = body.hidden === true ? user.id : null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada que cambiar" }, { status: 400 });

  const updated = await prisma.repairLog.update({ where: { id: entry.id }, data });
  const wasPublic = entry.visibleToClient && !entry.hidden;
  const isPublic = updated.visibleToClient && !updated.hidden;
  if (wasPublic || isPublic) await touchRepair(entry.repairId);
  let whatsapp: boolean | null = null;
  if (!wasPublic && isPublic && body.notifyClient === true) whatsapp = await notifyClient(updated, entry.repair, publicBaseUrl(request)).catch(() => false);
  return NextResponse.json({ ...updated, whatsapp });
}

/** El autor puede borrar su entrada solo durante los primeros minutos; después un administrador puede ocultarla. */
export async function DELETE(request: Request, context: Ctx) {
  const r = await load(request, context);
  if ("error" in r) return r.error;
  const { user, entry } = r;
  if (!(entry.authorId === user.id && withinEditWindow(entry.createdAt))) {
    return NextResponse.json({ error: `Solo puedes borrar tus entradas durante los primeros ${EDIT_WINDOW_MIN} minutos. Un administrador puede ocultarla.` }, { status: 403 });
  }
  await prisma.repairLog.delete({ where: { id: entry.id } });
  if (entry.visibleToClient) await touchRepair(entry.repairId);
  return NextResponse.json({ ok: true });
}
