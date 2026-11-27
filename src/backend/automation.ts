// Tareas automáticas: respaldo diario, resumen del día y aviso de equipos sin recoger.
// La configuración se guarda en KeyValue (no necesita migración).
import { prisma } from "./prisma";

export interface AutomationConfig {
  /** Respaldo automático de la base de datos e imágenes */
  backupEnabled: boolean;
  /** Hora local (0-23) del respaldo */
  backupHour: number;
  /** Días que se guardan los respaldos */
  backupKeep: number;
  /** WhatsApp del dueño: resumen del día y avisos de fallas */
  ownerPhone: string;
  /** Enviar el resumen del día solo, cada noche */
  summaryAuto: boolean;
  /** Hora local (0-23) del resumen automático */
  summaryHour: number;
}

export const DEFAULT_AUTOMATION: AutomationConfig = {
  backupEnabled: true,
  backupHour: 3,
  backupKeep: 7,
  ownerPhone: "",
  summaryAuto: false,
  summaryHour: 20,
};

const KEY = "automation:config";

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

export function sanitizeConfig(raw: Partial<AutomationConfig> | null | undefined, base: AutomationConfig = DEFAULT_AUTOMATION): AutomationConfig {
  const r = raw || {};
  return {
    backupEnabled: typeof r.backupEnabled === "boolean" ? r.backupEnabled : base.backupEnabled,
    backupHour: clampInt(r.backupHour, 0, 23, base.backupHour),
    backupKeep: clampInt(r.backupKeep, 1, 60, base.backupKeep),
    ownerPhone: typeof r.ownerPhone === "string" ? r.ownerPhone.replace(/[^\d+]/g, "").slice(0, 16) : base.ownerPhone,
    summaryAuto: typeof r.summaryAuto === "boolean" ? r.summaryAuto : base.summaryAuto,
    summaryHour: clampInt(r.summaryHour, 0, 23, base.summaryHour),
  };
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const row = await prisma.keyValue.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return { ...DEFAULT_AUTOMATION };
  try { return sanitizeConfig(JSON.parse(row.value)); } catch { return { ...DEFAULT_AUTOMATION }; }
}

export async function saveAutomationConfig(input: Partial<AutomationConfig>): Promise<AutomationConfig> {
  const current = await getAutomationConfig();
  const next = sanitizeConfig({ ...current, ...input }, current);
  await prisma.keyValue.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  return next;
}

// Claves de KeyValue con contraseñas, tokens o vínculos personales: nunca salen en un respaldo JSON
// ni se aceptan al importar uno (un archivo manipulado podría redirigir la copia en la nube o el correo).
const SECRET_KEYS = /^(mail:config|cloud:config|push:vapid|telegram:|ai:config|imei:config|monitor:config|whatsapp:config)/;
export const isSecretKey = (key: string) => SECRET_KEYS.test(key);

/** Lee/escribe un JSON en KeyValue */
export async function readKV<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.keyValue.findUnique({ where: { key } }).catch(() => null);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}
export async function writeKV(key: string, value: unknown) {
  const v = JSON.stringify(value);
  await prisma.keyValue.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

/** Aviso en la campana para administradores (de una sucursal, o todos si branchId es null) y super admins. */
export async function notifyManagersAll(type: string, title: string, message: string, branchId: string | null) {
  const managers = await prisma.user.findMany({
    where: { status: "active", OR: [{ role: "superadmin" }, branchId ? { role: "admin", branchId } : { role: "admin" }] },
    select: { id: true, branchId: true },
  });
  if (!managers.length) return;
  const fallbackBranch = branchId || (await prisma.branch.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id;
  const data = managers
    .map((m) => ({ type, title, message, userId: m.id, branchId: branchId || m.branchId || fallbackBranch || "" }))
    .filter((d) => d.branchId);
  if (data.length) await prisma.notification.createMany({ data });
  const { sendPush } = await import("./push");
  await sendPush(managers.map((m) => m.id), "system", { title, body: message, url: type === "uncollected" ? "/dashboard" : "/admin/settings", tag: type }).catch(() => 0);
}
