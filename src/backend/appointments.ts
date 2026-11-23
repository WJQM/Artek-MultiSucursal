// Citas: el cliente reserva día y hora desde el portal; el personal las confirma y, cuando llega, crea la orden.
// Horario por sucursal en KeyValue "appt:config". Recordatorio por WhatsApp el mismo día a las 8:00.
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";
import { normalizePublicUrl } from "@/shared/branding";
import { sendWhatsAppSafe } from "./whatsapp";
import { signClientLink } from "./track-access";
import { zonedMidnight, zonedParts, startOfDay, addDays } from "@/shared/dates";
import { normalizePhone } from "./otp";

export interface BranchSchedule {
  enabled: boolean;
  /** "0" (domingo) … "6" (sábado) → "09:00-12:00, 15:00-18:00" (vacío = cerrado) */
  days: Record<string, string>;
  /** Minutos entre turnos */
  slotMin: number;
  /** Citas por turno */
  perSlot: number;
  /** Hasta cuántos días adelante se puede reservar */
  daysAhead: number;
  /** Con cuántas horas de anticipación como mínimo */
  minHours: number;
}
export interface ApptConfig { branches: Record<string, BranchSchedule> }

export const DEFAULT_SCHEDULE: BranchSchedule = {
  enabled: false,
  days: { "0": "", "1": "09:00-12:00, 15:00-18:00", "2": "09:00-12:00, 15:00-18:00", "3": "09:00-12:00, 15:00-18:00", "4": "09:00-12:00, 15:00-18:00", "5": "09:00-12:00, 15:00-18:00", "6": "09:00-12:00" },
  slotMin: 30, perSlot: 2, daysAhead: 14, minHours: 2,
};
const KEY = "appt:config";
export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export async function getApptConfig(): Promise<ApptConfig> {
  const c = await readKV<Partial<ApptConfig>>(KEY, {});
  return { branches: c.branches || {} };
}
export async function scheduleFor(branchId: string): Promise<BranchSchedule> {
  const c = await getApptConfig();
  return { ...DEFAULT_SCHEDULE, ...(c.branches[branchId] || {}), days: { ...DEFAULT_SCHEDULE.days, ...(c.branches[branchId]?.days || {}) } };
}

/** "09:00-12:00, 15:00-18:00" → [[540, 720], [900, 1080]] (minutos). null si el formato es inválido. */
export function parseRanges(s: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const part of s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(?:-|a|–)\s*(\d{1,2})(?::(\d{2}))?$/.exec(part);
    if (!m) return null;
    const a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    if (a >= b || b > 24 * 60) return null;
    out.push([a, b]);
  }
  return out;
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export async function saveBranchSchedule(branchId: string, input: Partial<BranchSchedule>) {
  const cur = await scheduleFor(branchId);
  const days = { ...cur.days };
  if (input.days && typeof input.days === "object") {
    for (const k of ["0", "1", "2", "3", "4", "5", "6"]) {
      const v = (input.days as Record<string, unknown>)[k];
      if (typeof v !== "string") continue;
      const r = parseRanges(v);
      if (!r) throw new Error(`Horario de ${DAY_NAMES[+k]} inválido. Escribe por ejemplo: 09:00-12:00, 15:00-18:00`);
      days[k] = r.map(([a, b]) => `${hhmm(a)}-${hhmm(b)}`).join(", ");
    }
  }
  const pick = (v: unknown, ok: number[], d: number) => (ok.includes(Number(v)) ? Number(v) : d);
  const next: BranchSchedule = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : cur.enabled,
    days,
    slotMin: pick(input.slotMin, [15, 20, 30, 45, 60], cur.slotMin),
    perSlot: pick(input.perSlot, [1, 2, 3, 4, 5, 6, 8, 10], cur.perSlot),
    daysAhead: pick(input.daysAhead, [3, 7, 14, 21, 30, 60], cur.daysAhead),
    minHours: pick(input.minHours, [0, 1, 2, 4, 12, 24, 48], cur.minHours),
  };
  const c = await getApptConfig();
  c.branches[branchId] = next;
  await writeKV(KEY, c);
  return next;
}

export interface DaySlots { date: string; weekday: number; label: string; slots: { time: string; free: boolean }[] }

/** Turnos disponibles de una sucursal para los próximos días. */
export async function availableSlots(branchId: string): Promise<DaySlots[]> {
  const sc = await scheduleFor(branchId);
  if (!sc.enabled) return [];
  const now = Date.now();
  const first = startOfDay();
  const last = addDays(first, sc.daysAhead + 1);
  const taken = await prisma.appointment.groupBy({
    by: ["date"],
    where: { branchId, date: { gte: first, lt: last }, status: { in: ["new", "confirmed"] } },
    _count: { _all: true },
  });
  const busy = new Map(taken.map((t) => [t.date.getTime(), t._count._all]));
  const out: DaySlots[] = [];
  for (let i = 0; i <= sc.daysAhead; i++) {
    const day = zonedParts(new Date(first.getTime() + i * 86_400_000 + 12 * 3600_000)); // mediodía de ese día
    const midnight = zonedMidnight(day.y, day.m, day.d);
    const ranges = parseRanges(sc.days[String(day.weekday)] || "") || [];
    const slots: { time: string; free: boolean }[] = [];
    for (const [a, b] of ranges) {
      for (let t = a; t + sc.slotMin <= b; t += sc.slotMin) {
        const at = midnight.getTime() + t * 60_000;
        if (at < now + sc.minHours * 3600_000) continue;
        slots.push({ time: hhmm(t), free: (busy.get(at) || 0) < sc.perSlot });
      }
    }
    if (!slots.length) continue;
    const date = `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
    out.push({ date, weekday: day.weekday, label: `${DAY_NAMES[day.weekday]} ${day.d} de ${MONTHS[day.m - 1]}`, slots });
  }
  return out;
}

/** "2026-10-06" + "10:30" → instante de la cita (validando que sea un turno ofrecido y libre). */
export async function resolveSlot(branchId: string, date: string, time: string): Promise<Date | null> {
  const days = await availableSlots(branchId);
  const d = days.find((x) => x.date === date);
  if (!d || !d.slots.some((s) => s.time === time && s.free)) return null;
  const [y, m, dd] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(zonedMidnight(y, m, dd).getTime() + (h * 60 + mi) * 60_000);
}

export function fmtWhen(date: Date): string {
  const p = zonedParts(date);
  const local = new Date(date.getTime() - zonedMidnight(p.y, p.m, p.d).getTime());
  const min = Math.round(local.getTime() / 60_000);
  return `${DAY_NAMES[p.weekday]} ${p.d} de ${MONTHS[p.m - 1]}, ${hhmm(min)}`;
}
export function timeOf(date: Date): string {
  const p = zonedParts(date);
  return hhmm(Math.round((date.getTime() - zonedMidnight(p.y, p.m, p.d).getTime()) / 60_000));
}

export async function nextCode(branchId: string): Promise<string> {
  const rows = await prisma.appointment.findMany({ where: { branchId }, select: { code: true } });
  const max = rows.reduce((a, r) => Math.max(a, parseInt(r.code.replace(/\D/g, "")) || 0), 0);
  return `CITA-${max + 1}`;
}

export async function publicOrigin(fallback = ""): Promise<string> {
  const s = await getSettings();
  return normalizePublicUrl(s?.publicUrl) || process.env.APP_URL?.trim().replace(/\/+$/, "") || fallback || (await readKV<string>("telegram:origin", ""));
}
export const manageUrl = (origin: string, id: string) => `${origin.replace(/\/+$/, "")}/cita/${encodeURIComponent(id)}?k=${signClientLink(id, 120)}`;

interface ApptLike { id: string; code: string; date: Date; clientName: string; device: string; issue: string | null; branchId: string }
async function branchInfo(branchId: string) {
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, address: true, latitude: true, longitude: true } });
  const map = b?.latitude != null && b?.longitude != null ? `https://maps.google.com/?q=${b.latitude},${b.longitude}` : "";
  return { name: b?.name || "", address: b?.address || "", map };
}

export async function confirmationMessage(a: ApptLike, origin: string) {
  const s = await getSettings();
  const b = await branchInfo(a.branchId);
  return `✅ *Cita reservada* · ${s?.companyName || "Taller"}${b.name ? ` – ${b.name}` : ""}
📅 ${fmtWhen(a.date)}
📱 ${a.device}${a.issue ? ` — ${a.issue}` : ""}${b.address ? `\n📍 ${b.address}` : ""}${b.map ? `\n🗺️ ${b.map}` : ""}

Código: *${a.code}*. Si no puede venir, cancele o vea su cita aquí:
${manageUrl(origin, a.id)}`;
}

export async function reminderMessage(a: ApptLike, origin: string) {
  const s = await getSettings();
  const b = await branchInfo(a.branchId);
  return `⏰ Hola *${a.clientName}*, le recordamos su cita de hoy a las *${timeOf(a.date)}* en ${s?.companyName || "el taller"}${b.name ? ` – ${b.name}` : ""}.
📱 ${a.device}${b.address ? `\n📍 ${b.address}` : ""}${b.map ? `\n🗺️ ${b.map}` : ""}

Si tiene el cargador o accesorios, tráigalos. ¿No puede venir? Cancele aquí:
${manageUrl(origin, a.id)}`;
}

export async function cancelledMessage(a: ApptLike) {
  const s = await getSettings();
  return `Hola *${a.clientName}*, su cita *${a.code}* del ${fmtWhen(a.date)} en ${s?.companyName || "el taller"} fue *cancelada*. Si desea, puede reservar otro horario desde nuestro portal. Disculpe las molestias.`;
}

/** Tarea diaria (8:00): recordatorio a las citas de hoy. */
export async function sendTodayReminders(): Promise<number> {
  const origin = await publicOrigin();
  if (!origin) return 0;
  const from = startOfDay();
  const rows = await prisma.appointment.findMany({ where: { date: { gte: from, lt: addDays(from, 1) }, status: { in: ["new", "confirmed"] }, remindedAt: null } });
  let n = 0;
  for (const a of rows) {
    if (a.date.getTime() < Date.now()) continue;
    const ok = await sendWhatsAppSafe(a.clientPhone, await reminderMessage(a, origin));
    if (ok) { n++; await prisma.appointment.update({ where: { id: a.id }, data: { remindedAt: new Date() } }); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return n;
}

export const cleanPhone = (p: unknown) => normalizePhone(p);
