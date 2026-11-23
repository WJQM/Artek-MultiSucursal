// Horario de atención de cada sucursal: lunes a viernes, sábado y domingo (cerrado = null).
// Se guarda como JSON en Branch.hours y se muestra en el seguimiento del cliente ("Abierto ahora").
import { APP_TZ } from "@/shared/dates";

export interface HoursSlot { from: string; to: string }
export interface BranchHours { week: HoursSlot | null; sat: HoursSlot | null; sun: HoursSlot | null }
export type HoursDay = keyof BranchHours;

export const HOURS_DAYS: { key: HoursDay; label: string; short: string }[] = [
  { key: "week", label: "Lunes a viernes", short: "Lun a Vie" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

export const DEFAULT_HOURS: BranchHours = { week: { from: "08:30", to: "19:00" }, sat: { from: "09:00", to: "13:00" }, sun: null };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

function cleanSlot(v: unknown): HoursSlot | null | "invalid" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return "invalid";
  const { from, to } = v as Record<string, unknown>;
  if (typeof from !== "string" || typeof to !== "string" || !TIME.test(from) || !TIME.test(to) || toMin(from) >= toMin(to)) return "invalid";
  return { from, to };
}

/** Valida lo que llega del formulario. null = sin horario; "invalid" = datos mal formados. */
export function sanitizeHours(v: unknown): BranchHours | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "object") return "invalid";
  const o = v as Record<string, unknown>;
  const out: Partial<BranchHours> = {};
  for (const d of HOURS_DAYS) {
    const s = cleanSlot(o[d.key]);
    if (s === "invalid") return "invalid";
    out[d.key] = s;
  }
  return out as BranchHours;
}

export function parseHours(raw: string | null | undefined): BranchHours | null {
  if (!raw) return null;
  try { const h = sanitizeHours(JSON.parse(raw)); return h === "invalid" ? null : h; } catch { return null; }
}

const fmt = (t: string) => t.replace(/^0(\d)/, "$1");

/** "Lun a Vie · 8:30 – 19:00", "Sáb · 9:00 – 13:00", "Dom · Cerrado" */
export function hoursLines(h: BranchHours): string[] {
  return HOURS_DAYS.map((d) => `${d.short} · ${h[d.key] ? `${fmt(h[d.key]!.from)} – ${fmt(h[d.key]!.to)}` : "Cerrado"}`);
}

/** ¿Está abierto en este momento? Usa la hora del taller (APP_TZ), no la del celular del cliente. */
export function openNow(h: BranchHours, now: Date = new Date()): { open: boolean; until?: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = get("weekday");
  const day: HoursDay = wd === "Sat" ? "sat" : wd === "Sun" ? "sun" : "week";
  const slot = h[day];
  if (!slot) return { open: false };
  const m = Number(get("hour")) * 60 + Number(get("minute"));
  return m >= toMin(slot.from) && m < toMin(slot.to) ? { open: true, until: fmt(slot.to) } : { open: false };
}
