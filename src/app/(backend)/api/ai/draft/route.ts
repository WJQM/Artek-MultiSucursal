import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { canWriteLog } from "@/backend/repair-log";
import { aiReady, draftText, priceHint, type DraftStage } from "@/backend/ai";

const STAGES: DraftStage[] = ["diagnosed", "waiting_parts", "in_progress", "completed", "novedad"];

/** ¿Está activa la IA? (para mostrar u ocultar el botón) */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  return NextResponse.json({ ready: await aiReady() });
}

/** { repairId, stage, notes, short?, previous? } → { text, price? } */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!(await aiReady())) return NextResponse.json({ error: "La IA no está activada (Configuración › Tareas automáticas › IA)" }, { status: 400 });
  if (!rateLimit(`ai:${user.id}`, 40, 60 * 60_000).ok) return NextResponse.json({ error: "Muchas consultas a la IA seguidas, espera unos minutos" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const stage = STAGES.includes(body.stage) ? (body.stage as DraftStage) : "novedad";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";
  const previous = typeof body.previous === "string" ? body.previous.slice(0, 2000) : "";
  const repair = await prisma.repair.findUnique({
    where: { id: String(body.repairId || "") },
    select: { id: true, branchId: true, technicianId: true, device: true, brand: true, model: true, issue: true, clientName: true },
  });
  if (!repair) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  if (!canWriteLog(user, repair)) return NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 });

  const [r, price] = await Promise.all([
    draftText({ stage, notes, short: !!body.short, previous, repair }),
    stage === "diagnosed" || stage === "waiting_parts" ? priceHint(repair, notes) : Promise.resolve(null),
  ]);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ text: r.text, price });
}
