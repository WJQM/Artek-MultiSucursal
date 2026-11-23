import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { joinWaitlist, ResvError } from "@/backend/reservations";

/** Lista de espera { kind, itemId, clientName, clientPhone, captchaToken }: aviso por WhatsApp si se libera. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`resv-w:${ip}`, 10, 60 * 60_000).ok) return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  if (!(await verifyTurnstile(b.captchaToken, ip))) return NextResponse.json({ error: CAPTCHA_ERROR }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await joinWaitlist(b)) });
  } catch (e) {
    if (e instanceof ResvError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
