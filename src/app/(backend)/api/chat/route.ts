import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { visibleMessagesWhere, repairKey, branchKey } from "@/backend/chat";

/**
 * Lista de conversaciones del chat interno con el último mensaje y los no leídos.
 * Incluye siempre el chat general de la sucursal del usuario (o de todas, para el super admin).
 */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const since = new Date(Date.now() - 120 * 86_400_000);
  const [messages, reads, branches] = await Promise.all([
    prisma.message.findMany({
      where: { ...visibleMessagesWhere(user), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: {
        id: true, text: true, images: true, createdAt: true, repairId: true, branchId: true, userId: true,
        user: { select: { name: true } },
        repair: { select: { code: true, device: true, brand: true, model: true, status: true, technician: { select: { name: true } } } },
      },
    }),
    prisma.chatRead.findMany({ where: { userId: user.id } }),
    prisma.branch.findMany({ where: { active: true, ...(user.role === "superadmin" ? {} : { id: user.branchId ?? "__none__" }) }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const readAt = new Map(reads.map((r) => [r.threadKey, r.lastReadAt.getTime()]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  type Row = {
    key: string; kind: "repair" | "branch"; repairId: string | null; branchId: string; branchName: string | null;
    title: string; subtitle: string; status: string | null; unread: number;
    last: { text: string; userName: string; mine: boolean; createdAt: Date; hasImages: boolean } | null;
  };
  const threads = new Map<string, Row>();
  for (const b of branches) {
    const key = branchKey(b.id);
    threads.set(key, { key, kind: "branch", repairId: null, branchId: b.id, branchName: b.name, title: "💬 General", subtitle: b.name, status: null, unread: 0, last: null });
  }
  for (const m of messages) {
    const key = m.repairId ? repairKey(m.repairId) : branchKey(m.branchId);
    let t = threads.get(key);
    if (!t) {
      if (!m.repairId) continue; // general de una sucursal inactiva
      t = {
        key, kind: "repair", repairId: m.repairId, branchId: m.branchId, branchName: branchName.get(m.branchId) || null,
        title: m.repair?.code || "Orden", subtitle: [m.repair?.device, m.repair?.brand, m.repair?.model].filter(Boolean).join(" ") + (m.repair?.technician?.name ? ` · ${m.repair.technician.name}` : ""),
        status: m.repair?.status || null, unread: 0, last: null,
      };
      threads.set(key, t);
    }
    if (!t.last) t.last = { text: m.text, userName: m.user.name, mine: m.userId === user.id, createdAt: m.createdAt, hasImages: !!m.images };
    if (m.userId !== user.id && m.createdAt.getTime() > (readAt.get(key) ?? 0)) t.unread++;
  }

  const list = [...threads.values()].sort((a, b) => {
    // Los generales arriba; luego por último mensaje
    if (a.kind !== b.kind) return a.kind === "branch" ? -1 : 1;
    return (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0);
  });
  return NextResponse.json({ threads: list, totalUnread: list.reduce((n, t) => n + t.unread, 0), multiBranch: user.role === "superadmin" && branches.length > 1 });
}
