import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { rateLimit, resetRateLimit, getClientIp } from "@/backend/rate-limit";
import { signTrackToken, phoneMatches } from "@/backend/track-access";

const NO_MATCH = "Los dígitos no coinciden con el celular registrado en la orden.";

// POST /api/track/OT-5/verify  { repairId, digits: "1234" }
// El cliente confirma que es el dueño de la orden con los últimos 4 dígitos de su celular.
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const ip = getClientIp(request);
  try {
    const { code: rawCode } = await context.params;
    const code = decodeURIComponent(String(rawCode || "")).trim().toUpperCase().substring(0, 40);
    const body = await request.json().catch(() => ({}));
    const repairId = typeof body.repairId === "string" ? body.repairId : "";

    const perIp = rateLimit(`trackverify-ip:${ip}`, 20, 15 * 60_000);
    if (!perIp.ok) return tooMany(perIp.retryAfter);

    const repair = await prisma.repair.findFirst({
      where: repairId ? { id: repairId, code } : { code },
      select: { id: true, clientPhone: true },
    });
    if (!repair) return NextResponse.json({ error: NO_MATCH }, { status: 401 });

    // Máximo 5 intentos por orden cada 15 min, se pida por id o por código (un solo contador real)
    const key = `trackverify:${repair.id}`;
    const perOrder = rateLimit(key, 5, 15 * 60_000);
    if (!perOrder.ok) return tooMany(perOrder.retryAfter);
    if (!phoneMatches(repair.clientPhone, body.digits)) return NextResponse.json({ error: NO_MATCH }, { status: 401 });

    resetRateLimit(key);
    return NextResponse.json({ token: signTrackToken(repair.id) });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}

function tooMany(retryAfter: number) {
  const wait = Math.ceil(retryAfter / 60) || 15;
  return NextResponse.json({ error: `Demasiados intentos. Espera ${wait} min o consulta en tienda.` }, { status: 429 });
}
