import { prisma } from "./prisma";
import type { TokenUser } from "./auth";
import { canAccessBranch } from "./auth";
import { companyInfo } from "./company";
import { clientTrackUrl } from "./track-access";
import { sendWhatsAppSafe } from "./whatsapp";
import { pushRepair, later } from "./push";

/** Bitácora de la reparación: tipos, permisos y avisos. */
export const LOG_TYPES = {
  hallazgo: { label: "Hallazgo", icon: "🔍", color: "#8b5cf6" },
  avance: { label: "Avance", icon: "🔧", color: "#3b82f6" },
  problema: { label: "Problema / aviso", icon: "⚠️", color: "#f59e0b" },
  final: { label: "Informe final", icon: "✅", color: "#10b981" },
  novedad: { label: "Novedad", icon: "📣", color: "#0ea5e9" },
  comentario: { label: "Nota interna", icon: "💬", color: "#64748b" },
} as const;
export type LogType = keyof typeof LOG_TYPES;
export const isLogType = (t: unknown): t is LogType => typeof t === "string" && t in LOG_TYPES;

/** Minutos en que el autor puede corregir o borrar su entrada; después queda fija como respaldo. */
export const EDIT_WINDOW_MIN = 15;
export const MAX_IMAGES = 6;
export const MAX_TEXT = 2000;

type RepairRef = { id: string; branchId: string; technicianId: string | null };

/** Ver la bitácora: técnico solo sus órdenes asignadas; admin su sucursal; super admin todas. */
export function canReadLog(user: TokenUser, repair: RepairRef): boolean {
  if (!canAccessBranch(user, repair.branchId)) return false;
  if (user.role === "tech") return repair.technicianId === user.id;
  return true;
}
/** Escribir: los mismos que pueden verla. */
export const canWriteLog = canReadLog;
export const isManager = (user: TokenUser) => user.role === "admin" || user.role === "superadmin";

export function withinEditWindow(createdAt: Date): boolean {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MIN * 60_000;
}

/** Solo URLs de imágenes subidas al propio sistema (/uploads/archivo.ext). */
export function cleanImages(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((u): u is string => typeof u === "string" && /^\/uploads\/[\w.-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(u))
    .slice(0, MAX_IMAGES);
}
export function parseImages(v: string | null | undefined): string[] {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; }
}

/** Lo que ve el cliente en su seguimiento: sin datos internos. */
export async function clientReport(repairId: string) {
  const rows = await prisma.repairLog.findMany({
    where: { repairId, visibleToClient: true, hidden: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, text: true, images: true, authorName: true, createdAt: true, status: true },
  });
  return rows.map((r) => ({ ...r, images: parseImages(r.images) }));
}
export async function clientReportCount(repairId: string) {
  return prisma.repairLog.count({ where: { repairId, visibleToClient: true, hidden: false } });
}

/** Avisa a los administradores de la sucursal (y super admins) cuando el técnico registra algo. */
export async function notifyManagers(entry: { type: string; text: string; authorId: string; authorName: string }, repair: { code: string; device: string; branchId: string }) {
  if (!["hallazgo", "problema", "final", "comentario", "novedad"].includes(entry.type)) return;
  const managers = await prisma.user.findMany({
    where: { status: "active", id: { not: entry.authorId }, OR: [{ role: "superadmin" }, { role: "admin", branchId: repair.branchId }] },
    select: { id: true },
  });
  if (!managers.length) return;
  const t = LOG_TYPES[entry.type as LogType];
  const text = entry.text.length > 120 ? entry.text.slice(0, 117) + "…" : entry.text;
  await prisma.notification.createMany({
    data: managers.map((m) => ({
      type: "repair_log",
      title: `${t.icon} ${t.label} en ${repair.code}`,
      message: `${entry.authorName}: ${text}`,
      userId: m.id,
      branchId: repair.branchId,
    })),
  });
  later(pushRepair(managers.map((m) => m.id), "log", repair.code, `${t.icon} ${t.label} en ${repair.code}`, `${entry.authorName}: ${text}`));
}

/** WhatsApp al cliente con la novedad publicada y su enlace personal. */
export async function notifyClient(entry: { type: string; text: string; authorName: string }, repair: { id: string; code: string; device: string; brand: string | null; model: string | null; clientName: string | null; clientPhone: string | null }, origin: string): Promise<boolean> {
  if (!repair.clientPhone) return false;
  const company = await companyInfo(origin);
  const base = company.portalUrl.replace(/\/portal$/, "");
  const url = clientTrackUrl(base, repair);
  const t = LOG_TYPES[entry.type as LogType] || LOG_TYPES.avance;
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  const hello = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const text = entry.text.length > 400 ? entry.text.slice(0, 397) + "…" : entry.text;
  const msg = `${hello}! 👋

Hay una novedad en la reparación de su equipo *${device}* (${repair.code}):

${t.icon} *${t.label}* — ${entry.authorName}
${text}

Vea el detalle y las fotos aquí (enlace personal, no lo comparta):
🔗 ${url}

${company.companyName}`;
  return sendWhatsAppSafe(repair.clientPhone, msg);
}

/** Toca la orden para que el seguimiento del cliente note la novedad al refrescar. */
export async function touchRepair(repairId: string) {
  await prisma.repair.update({ where: { id: repairId }, data: { updatedAt: new Date() } }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// Etapas: avanzar el estado de la orden pide registrar en la bitácora
// ─────────────────────────────────────────────────────────────
export const STATUS_ORDER = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];
export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", diagnosed: "Diagnóstico", waiting_parts: "Esperando repuestos",
  in_progress: "En progreso", completed: "Completado", delivered: "Entregado",
};
/** Qué se registra al llegar a cada estado. required = sin texto no se avanza. Fotos siempre opcionales. */
export const STAGE_LOG: Record<string, { type: LogType; required: boolean; ask: string }> = {
  diagnosed: { type: "hallazgo", required: true, ask: "qué encontraste en el equipo" },
  waiting_parts: { type: "problema", required: true, ask: "qué repuesto falta" },
  in_progress: { type: "avance", required: false, ask: "qué vas a hacer (opcional)" },
  completed: { type: "final", required: true, ask: "qué se hizo y recomendaciones (informe final)" },
};
export const isForward = (from: string, to: string) => STATUS_ORDER.indexOf(to) > STATUS_ORDER.indexOf(from);

/** Requisito al pasar de un estado a otro (solo hacia adelante; retroceder es corrección y queda libre). */
export function stageRequirement(from: string, to: string) {
  if (!to || from === to || !isForward(from, to)) return null;
  return STAGE_LOG[to] || null;
}

export interface StageLogInput { text?: unknown; images?: unknown; visibleToClient?: unknown; onBehalf?: unknown }

/** Revisa lo que manda la ventana "Registrar y avanzar". Devuelve error (texto) o los datos limpios. */
export function checkStageLog(from: string, to: string, log: StageLogInput | undefined) {
  const req = stageRequirement(from, to);
  if (!req) return { req: null, text: "", images: [] as string[] };
  const text = String(log?.text || "").trim().slice(0, MAX_TEXT);
  const images = cleanImages(log?.images);
  if (req.required && text.length < 3) {
    return { error: `Para pasar a "${STATUS_LABEL[to]}" escribe en la bitácora ${req.ask}.`, req };
  }
  return { req, text, images };
}

/** Crea la entrada de la etapa (a nombre del técnico si el administrador lo pide). */
export async function createStageLog(
  user: TokenUser,
  repair: { id: string; branchId: string; technicianId: string | null },
  to: string,
  data: { text: string; images: string[]; visibleToClient: boolean; onBehalf: boolean },
) {
  const req = STAGE_LOG[to];
  if (!req || (!data.text && data.images.length === 0)) return null;
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const myName = me?.name || user.email.split("@")[0];
  let authorId = user.id, authorName = myName, authorRole: string = user.role;
  let recordedById: string | null = null, recordedByName: string | null = null;
  if (data.onBehalf && isManager(user) && repair.technicianId && repair.technicianId !== user.id) {
    const tech = await prisma.user.findUnique({ where: { id: repair.technicianId }, select: { name: true } });
    if (tech) { authorId = repair.technicianId; authorName = tech.name; authorRole = "tech"; recordedById = user.id; recordedByName = myName; }
  }
  return prisma.repairLog.create({
    data: {
      repairId: repair.id, branchId: repair.branchId, authorId, authorName, authorRole, recordedById, recordedByName,
      type: req.type, text: data.text || "(solo fotos)", images: data.images.length ? JSON.stringify(data.images) : null,
      visibleToClient: data.visibleToClient, status: to,
    },
  });
}

/** Nota del administrador → aviso al técnico asignado (para que se entere aunque no esté mirando la orden). */
export async function notifyTechnician(entry: { type: string; text: string; authorId: string; authorName: string }, repair: { code: string; branchId: string; technicianId: string | null }) {
  if (!repair.technicianId || repair.technicianId === entry.authorId) return;
  const t = LOG_TYPES[entry.type as LogType] || LOG_TYPES.comentario;
  const text = entry.text.length > 120 ? entry.text.slice(0, 117) + "…" : entry.text;
  await prisma.notification.create({
    data: { type: "repair_log", title: `${t.icon} ${t.label} en ${repair.code}`, message: `${entry.authorName}: ${text}`, userId: repair.technicianId, branchId: repair.branchId },
  });
  later(pushRepair([repair.technicianId], "log", repair.code, `${t.icon} ${t.label} en ${repair.code}`, `${entry.authorName}: ${text}`));
}
