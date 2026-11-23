import { prisma } from "./prisma";
import type { TokenUser } from "./auth";
import { canAccessBranch } from "./auth";
import { cleanImages, parseImages, MAX_TEXT } from "./repair-log";

/**
 * Chat interno del personal.
 * - Conversación de una orden ("r:<repairId>"): técnico asignado, administradores de la sucursal y super admin.
 * - Chat general de la sucursal ("b:<branchId>"): todo el personal de esa sucursal y el super admin.
 */
export const repairKey = (id: string) => `r:${id}`;
export const branchKey = (id: string) => `b:${id}`;
export { cleanImages, parseImages, MAX_TEXT };

export type Thread =
  | { kind: "repair"; key: string; repairId: string; branchId: string; code: string; device: string; technicianId: string | null; technicianName: string | null; status: string }
  | { kind: "branch"; key: string; branchId: string; branchName: string };

/** Resuelve una conversación y verifica que el usuario pueda verla. */
export async function resolveThread(user: TokenUser, q: { repairId?: string | null; branchId?: string | null }): Promise<Thread | { error: string; status: number }> {
  if (q.repairId) {
    const r = await prisma.repair.findUnique({
      where: { id: q.repairId },
      select: { id: true, code: true, device: true, brand: true, model: true, branchId: true, technicianId: true, status: true, technician: { select: { name: true } } },
    });
    if (!r) return { error: "Orden no encontrada", status: 404 };
    if (!canAccessBranch(user, r.branchId)) return { error: "Sin acceso a esta orden", status: 403 };
    if (user.role === "tech" && r.technicianId !== user.id) return { error: "Solo puedes chatear en tus órdenes asignadas", status: 403 };
    return {
      kind: "repair", key: repairKey(r.id), repairId: r.id, branchId: r.branchId, code: r.code,
      device: [r.device, r.brand, r.model].filter(Boolean).join(" "), technicianId: r.technicianId, technicianName: r.technician?.name || null, status: r.status,
    };
  }
  const branchId = q.branchId || user.branchId;
  if (!branchId) return { error: "Elige una sucursal", status: 400 };
  if (!canAccessBranch(user, branchId)) return { error: "Sin acceso a esta sucursal", status: 403 };
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } });
  if (!b) return { error: "Sucursal no encontrada", status: 404 };
  return { kind: "branch", key: branchKey(b.id), branchId: b.id, branchName: b.name };
}

/** Mensajes que el usuario puede ver (para la lista de conversaciones y el contador). */
export function visibleMessagesWhere(user: TokenUser) {
  if (user.role === "superadmin") return {};
  if (user.role === "tech") return { branchId: user.branchId ?? "__none__", OR: [{ repairId: null }, { repair: { technicianId: user.id } }] };
  return { branchId: user.branchId ?? "__none__" };
}

export async function markRead(userId: string, threadKey: string, at = new Date()) {
  await prisma.chatRead.upsert({
    where: { userId_threadKey: { userId, threadKey } },
    create: { userId, threadKey, lastReadAt: at },
    update: { lastReadAt: at },
  });
}
