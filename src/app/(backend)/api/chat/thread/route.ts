import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { sendPush, later } from "@/backend/push";
import { resolveThread, markRead, cleanImages, parseImages, MAX_TEXT } from "@/backend/chat";

const ROLE: Record<string, string> = { tech: "Técnico", admin: "Administrador", superadmin: "Super Admin" };

/** Mensajes de una conversación (?repairId= o ?branchId=). Al abrirla queda como leída. */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const th = await resolveThread(user, { repairId: sp.get("repairId"), branchId: sp.get("branchId") });
  if ("error" in th) return NextResponse.json({ error: th.error }, { status: th.status });

  const rows = await prisma.message.findMany({
    where: th.kind === "repair" ? { repairId: th.repairId } : { repairId: null, branchId: th.branchId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, text: true, images: true, createdAt: true, userId: true, user: { select: { name: true, role: true } } },
  });
  if (sp.get("markRead") !== "0") await markRead(user.id, th.key);
  // "Visto": hasta cuándo leyó cada una de las otras personas esta conversación
  const readers = await prisma.chatRead.findMany({ where: { threadKey: th.key, userId: { not: user.id } }, select: { userId: true, lastReadAt: true } });
  const names = readers.length ? await prisma.user.findMany({ where: { id: { in: readers.map((r) => r.userId) } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(names.map((u) => [u.id, u.name]));
  return NextResponse.json({
    seen: readers.map((r) => ({ name: nameOf.get(r.userId) || "", at: r.lastReadAt })).filter((r) => r.name),
    thread: th,
    messages: rows.reverse().map((m) => ({
      id: m.id, text: m.text, images: parseImages(m.images), createdAt: m.createdAt,
      userName: m.user.name, userRole: ROLE[m.user.role] || m.user.role, mine: m.userId === user.id,
    })),
  });
}

/** Enviar: { repairId? | branchId?, text, images[] } */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rl = rateLimit(`chat:${user.id}`, 120, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados mensajes seguidos, espera un momento" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const th = await resolveThread(user, { repairId: body.repairId, branchId: body.branchId });
  if ("error" in th) return NextResponse.json({ error: th.error }, { status: th.status });
  const text = String(body.text || "").trim().slice(0, MAX_TEXT);
  const images = cleanImages(body.images);
  if (!text && !images.length) return NextResponse.json({ error: "Escribe un mensaje o agrega una foto" }, { status: 400 });

  const msg = await prisma.message.create({
    data: {
      text: text || "📷 Foto", images: images.length ? JSON.stringify(images) : null, userId: user.id, branchId: th.branchId,
      repairId: th.kind === "repair" ? th.repairId : null,
    },
  });
  await markRead(user.id, th.key, new Date(msg.createdAt.getTime() + 1));
  later(pushChat(user, th, text || "📷 Foto"));
  return NextResponse.json({ id: msg.id }, { status: 201 });
}

/** Aviso al celular de las personas de esa conversación (menos quien escribió). */
async function pushChat(user: { id: string; email?: string | null }, th: Awaited<ReturnType<typeof resolveThread>>, text: string) {
  if ("error" in th) return;
  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const name = sender?.name || user.email?.split("@")[0] || "Alguien";
  const body = text.length > 140 ? text.slice(0, 137) + "…" : text;
  // Orden: su técnico + administradores de la sucursal + super admins. Chat general: todo el personal de la sucursal.
  const who = th.kind === "repair"
    ? [{ role: "superadmin" }, { role: "admin", branchId: th.branchId }, ...(th.technicianId ? [{ id: th.technicianId }] : [])]
    : [{ role: "superadmin" }, { branchId: th.branchId }];
  const people = (await prisma.user.findMany({ where: { status: "active", OR: who }, select: { id: true, role: true } })).filter((u) => u.id !== user.id);
  const title = `💬 ${name} · ${th.kind === "repair" ? th.code : th.branchName}`;
  const chat = encodeURIComponent(th.key);
  await Promise.all(people.map((u) => sendPush([u.id], "chat", { title, body, url: `${u.role === "tech" ? "/asignaciones" : "/dashboard"}?chat=${chat}`, tag: `chat-${th.key}` })));
}
