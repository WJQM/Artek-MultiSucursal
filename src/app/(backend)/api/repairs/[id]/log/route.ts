import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { publicBaseUrl } from "@/backend/public-url";
import { rateLimit } from "@/backend/rate-limit";
import {
  canReadLog, canWriteLog, isManager, isLogType, cleanImages, parseImages, withinEditWindow,
  notifyManagers, notifyTechnician, notifyClient, touchRepair, MAX_TEXT, EDIT_WINDOW_MIN,
} from "@/backend/repair-log";

const REPAIR_SELECT = { id: true, code: true, device: true, brand: true, model: true, branchId: true, technicianId: true, clientName: true, clientPhone: true, status: true } as const;

/** Bitácora de una orden (personal). Los administradores también ven las entradas ocultadas. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await context.params;
  const repair = await prisma.repair.findUnique({ where: { id }, select: REPAIR_SELECT });
  if (!repair) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (!canReadLog(user, repair)) return NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 });

  const manager = isManager(user);
  const rows = await prisma.repairLog.findMany({
    where: { repairId: id, ...(manager ? {} : { hidden: false }) },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    editWindowMin: EDIT_WINDOW_MIN,
    canWrite: canWriteLog(user, repair),
    isManager: manager,
    hasClientPhone: !!repair.clientPhone,
    repairStatus: repair.status,
    entries: rows.map((r) => ({
      ...r,
      images: parseImages(r.images),
      mine: r.authorId === user.id,
      canEdit: r.authorId === user.id && withinEditWindow(r.createdAt),
    })),
  });
}

/** Nueva entrada: { type, text, images[], visibleToClient, notifyClient } */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rl = rateLimit(`repairlog:${user.id}`, 60, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiadas entradas seguidas, espera un momento" }, { status: 429 });

  const { id } = await context.params;
  const repair = await prisma.repair.findUnique({ where: { id }, select: REPAIR_SELECT });
  if (!repair) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (!canWriteLog(user, repair)) return NextResponse.json({ error: "Solo el técnico asignado o un administrador puede escribir en esta orden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const type = isLogType(body.type) ? body.type : "avance";
  // La bitácora sigue al trabajo: en Pendiente solo comentarios internos; el informe final se escribe al completar
  if (repair.status === "pending" && type !== "comentario") {
    return NextResponse.json({ error: "La orden sigue en Pendiente. Pulsa \"Diagnosticar\" y registra ahí lo que encontraste.", code: "STAGE_PENDING" }, { status: 400 });
  }
  if (type === "final" && !["completed", "delivered"].includes(repair.status)) {
    return NextResponse.json({ error: "El informe final se registra al marcar la orden como Completado.", code: "FINAL_NEEDS_COMPLETE" }, { status: 400 });
  }
  const text = String(body.text || "").trim().slice(0, MAX_TEXT);
  const images = cleanImages(body.images);
  if (!text && images.length === 0) return NextResponse.json({ error: "Escribe algo o agrega una foto" }, { status: 400 });
  const visibleToClient = type !== "comentario" && body.visibleToClient === true;

  const author = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const authorName = author?.name || user.email.split("@")[0];

  const entry = await prisma.repairLog.create({
    data: {
      repairId: id, branchId: repair.branchId, authorId: user.id, authorName, authorRole: user.role,
      type, text: text || "(solo fotos)", images: images.length ? JSON.stringify(images) : null, visibleToClient,
      status: repair.status,
    },
  });

  // Avisos entre técnico y administración (la nota interna funciona como chat de la orden)
  if (user.role === "tech") await notifyManagers(entry, repair).catch((e) => console.error("[Bitácora] aviso:", e));
  else await notifyTechnician(entry, repair).catch((e) => console.error("[Bitácora] aviso técnico:", e));
  let whatsapp: boolean | null = null;
  if (visibleToClient) {
    await touchRepair(id);
    if (body.notifyClient === true) whatsapp = await notifyClient(entry, repair, publicBaseUrl(request)).catch(() => false);
  }
  return NextResponse.json({ ...entry, images, whatsapp }, { status: 201 });
}
