// Fechas en la zona horaria del negocio (Bolivia por defecto).
// El servidor corre en UTC; sin esto, "hoy" y "este mes" se cortaban a las 20:00 hora boliviana.

export const APP_TZ = process.env.APP_TIMEZONE || "America/La_Paz";

type Parts = { y: number; m: number; d: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Año/mes/día/día de semana de `date` en la zona del negocio. */
export function zonedParts(date: Date = new Date(), tz = APP_TZ): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, weekday: WEEKDAYS[p.weekday] ?? 0 };
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function offsetMs(date: Date, tz = APP_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(date)) p[x.type] = x.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC que corresponde a las 00:00 del día y/m/d en la zona del negocio. Acepta meses/días fuera de rango (se normalizan). */
export function zonedMidnight(y: number, m: number, d: number, tz = APP_TZ): Date {
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - offsetMs(guess, tz));
}

export function startOfDay(date = new Date()): Date {
  const { y, m, d } = zonedParts(date);
  return zonedMidnight(y, m, d);
}

/** Semana comenzando el lunes */
export function startOfWeek(date = new Date()): Date {
  const { y, m, d, weekday } = zonedParts(date);
  const back = (weekday + 6) % 7;
  return zonedMidnight(y, m, d - back);
}

export function startOfMonth(date = new Date()): Date {
  const { y, m } = zonedParts(date);
  return zonedMidnight(y, m, 1);
}

export function startOfYear(date = new Date()): Date {
  const { y } = zonedParts(date);
  return zonedMidnight(y, 1, 1);
}

/** [inicio, fin) de un mes (month 1-12) en la zona del negocio */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: zonedMidnight(year, month, 1), end: zonedMidnight(year, month + 1, 1) };
}

/** "2026-09-25" → 00:00 de ese día en la zona del negocio (null si no es válida) */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return zonedMidnight(+m[1], +m[2], +m[3]);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Fecha de hoy "YYYY-MM-DD" en la zona del negocio */
export function todayISO(date = new Date()): string {
  const { y, m, d } = zonedParts(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
