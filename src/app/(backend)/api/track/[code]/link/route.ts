import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { signTrackToken, verifyClientLink } from "@/backend/track-access";

// POST /api/track/OT-5/link  { k }
// Cambia el enlace personal que llegó por WhatsApp por el pase de 12 h (el mismo que se
// obtiene con los 4 dígitos). Si el código existe en varias sucursales, la firma dice cuál es.
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const rl = rateLimit(`tracklink-ip:${getClientIp(request)}`, 30, 15 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados intentos, espera unos minutos" }, { status: 429 });
  try {
    const { code: rawCode } = await context.params;
    const code = decodeURIComponent(String(rawCode || "")).trim().toUpperCase().substring(0, 40);
    const { k } = await request.json().catch(() => ({}));
    const repairs = await prisma.repair.findMany({ where: { code }, select: { id: true, branchId: true } });
    const match = repairs.find((r) => verifyClientLink(r.id, k));
    if (!match) return NextResponse.json({ error: "El enlace venció o no es válido. Ingresa los últimos 4 dígitos de tu celular." }, { status: 401 });
    return NextResponse.json({ token: signTrackToken(match.id), repairId: match.id, branchId: match.branchId });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
