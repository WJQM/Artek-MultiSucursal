import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { publicBaseUrl } from "@/backend/public-url";
import { getLink, processUpdates, publicTelegramConfig, rememberOrigin, sendTelegram, startLink, unlink } from "@/backend/telegram";

// Telegram de cada persona (Mi cuenta)
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const [bot, link] = await Promise.all([publicTelegramConfig(), getLink(user.id)]);
  return NextResponse.json({ bot: { ready: bot.ready, username: bot.username }, link: link ? { name: link.name, at: link.at } : null });
}

/** action: start → enlace t.me · check → lee los "Iniciar" pendientes · unlink · test */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const rl = rateLimit(`tg:${user.id}`, 60, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados intentos, espera un momento" }, { status: 429 });
  const { action } = await request.json().catch(() => ({}));

  if (action === "start") {
    await rememberOrigin(publicBaseUrl(request));
    const r = await startLink(user.id);
    return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json(r);
  }
  if (action === "check") {
    await processUpdates();
    const link = await getLink(user.id);
    return NextResponse.json({ linked: !!link, link: link ? { name: link.name, at: link.at } : null });
  }
  if (action === "unlink") {
    const link = await getLink(user.id);
    if (link) await sendTelegram(link.chatId, { body: "Desvinculaste este Telegram. Ya no recibirás avisos aquí." });
    await unlink(user.id);
    return NextResponse.json({ ok: true });
  }
  if (action === "test") {
    const link = await getLink(user.id);
    if (!link) return NextResponse.json({ error: "Primero vincula tu Telegram" }, { status: 400 });
    const r = await sendTelegram(link.chatId, { title: "🔔 Aviso de prueba", body: "¡Listo! Así te llegarán los avisos del sistema por Telegram.", url: "/mi-cuenta" });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
