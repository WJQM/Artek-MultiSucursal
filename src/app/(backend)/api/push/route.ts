import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { PUSH_CATEGORIES, getPushPrefs, savePushPrefs, sendPush, vapidKeys } from "@/backend/push";

/** Clave pública, preferencias de la persona y cuántos celulares tiene activados. */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [{ publicKey }, prefs, devices] = await Promise.all([
    vapidKeys(),
    getPushPrefs(user.id),
    prisma.pushSubscription.findMany({ where: { userId: user.id }, select: { endpoint: true, device: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const categories = PUSH_CATEGORIES.filter((c) => (c.roles as readonly string[]).includes(user.role)).map(({ key, label, hint }) => ({ key, label, hint }));
  return NextResponse.json({ publicKey, prefs, categories, devices });
}

/**
 * acciones:
 *  subscribe   { subscription: PushSubscriptionJSON, device }
 *  unsubscribe { endpoint }
 *  prefs       { prefs: { assigned: true, ... } }
 *  test        {}
 */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "subscribe") {
    const s = body.subscription || {};
    const endpoint = String(s.endpoint || "");
    const p256dh = String(s.keys?.p256dh || ""), auth = String(s.keys?.auth || "");
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) return NextResponse.json({ error: "Datos del navegador inválidos" }, { status: 400 });
    const device = String(body.device || "").slice(0, 80) || null;
    // El mismo navegador puede pasar a otra cuenta: el aviso va a quien inició sesión ahora
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth, device },
      update: { userId: user.id, p256dh, auth, device, lastUsedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    const endpoint = String(body.endpoint || "");
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, ...(endpoint ? { endpoint } : {}) } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "prefs") {
    const prefs = await savePushPrefs(user.id, body.prefs || {});
    return NextResponse.json({ prefs });
  }

  if (body.action === "test") {
    const rl = rateLimit(`push-test:${user.id}`, 5, 10 * 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Espera unos minutos antes de otra prueba" }, { status: 429 });
    const subs = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
    if (!subs.length) return NextResponse.json({ error: "Primero activa los avisos en este celular" }, { status: 400 });
    const sent = await sendPush([user.id], "system", { title: "🔔 Aviso de prueba", body: "¡Listo! Así te llegarán los avisos de RepairTrackQR.", url: "/mi-cuenta", tag: "prueba" }, { force: true });
    return NextResponse.json({ sent });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
