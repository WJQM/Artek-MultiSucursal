import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { publicBaseUrl } from "@/backend/public-url";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { fmtWhen } from "@/backend/appointments";
import { createReservation, confirmationMessage, holdsSnapshot, manageUrl, notifyStaff, resvOrigin, ResvError } from "@/backend/reservations";

export const dynamic = "force-dynamic";

/** Portal: qué sucursales aceptan apartados y qué está apartado ahora (para mostrar solo lo disponible). */
export async function GET() {
  return NextResponse.json(await holdsSnapshot(), { headers: { "Cache-Control": "no-store" } });
}

/** Apartar { kind, itemId, qty, clientName, clientPhone, captchaToken } */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`resv:${ip}`, 8, 60 * 60_000).ok) return NextResponse.json({ error: "Demasiados apartados seguidos. Intenta más tarde o escríbenos por WhatsApp." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  if (!(await verifyTurnstile(b.captchaToken, ip))) return NextResponse.json({ error: CAPTCHA_ERROR }, { status: 400 });
  try {
    const r = await createReservation(b);
    const origin = await resvOrigin(publicBaseUrl(request));
    const whatsapp = await sendWhatsAppSafe(r.clientPhone, await confirmationMessage(r, origin));
    notifyStaff(r.branchId, `🛒 Nuevo apartado · ${r.code}`, `${r.clientName} apartó ${r.itemName}${r.qty > 1 ? ` × ${r.qty}` : ""} (Bs. ${Math.round(r.total)}). Vence ${fmtWhen(r.expiresAt)}.`, `ap-${r.id}`);
    return NextResponse.json({
      ok: true, id: r.id, code: r.code, itemName: r.itemName, qty: r.qty, total: r.total, expiresAt: r.expiresAt, until: fmtWhen(r.expiresAt), whatsapp,
      manage: manageUrl(origin, r.id).replace(/^https?:\/\/[^/]+/, ""),
    });
  } catch (e) {
    if (e instanceof ResvError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[Apartados] crear:", e);
    return NextResponse.json({ error: "No se pudo apartar. Intenta de nuevo." }, { status: 500 });
  }
}
