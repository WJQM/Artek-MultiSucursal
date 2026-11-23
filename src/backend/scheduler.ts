// Reloj interno de tareas diarias (respaldo, resumen del día, equipos sin recoger, stock bajo).
// Se arranca una sola vez desde src/instrumentation.ts. Revisa cada minuto qué toca hacer;
// cada tarea corre una vez por día, y si el servidor estaba apagado a esa hora, corre al encender.
import { APP_TZ } from "@/shared/dates";
import { getAutomationConfig, readKV, writeKV } from "./automation";

interface Job {
  name: string;
  /** Hora local a partir de la cual corre hoy; null = hoy no corre */
  hour: () => Promise<number | null>;
  run: () => Promise<unknown>;
}

const g = globalThis as unknown as { __schedulerStarted?: boolean; __schedulerBusy?: Set<string> };

export function localNow(date = new Date()): { day: string; hour: number } {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(date)) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

async function jobs(): Promise<Job[]> {
  const { runBackup } = await import("./backups");
  const { checkUncollected } = await import("./uncollected");
  const { sendDailySummaries } = await import("./daily-summary");
  const { dailyStockDigest } = await import("./stock");
  const { askYesterdayReviews, getGoogleConfig } = await import("./google-reviews");
  const { sendTodayReminders } = await import("./appointments");
  return [
    { name: "backup", hour: async () => { const c = await getAutomationConfig(); return c.backupEnabled ? c.backupHour : null; }, run: () => runBackup("auto") },
    { name: "uncollected", hour: async () => 9, run: () => checkUncollected() },
    { name: "stock", hour: async () => 8, run: () => dailyStockDigest() },
    { name: "appointments", hour: async () => 8, run: () => sendTodayReminders() },
    { name: "reviews", hour: async () => { const c = await getGoogleConfig(); return c.askNextDay ? c.hour : null; }, run: () => askYesterdayReviews() },
    { name: "summary", hour: async () => { const c = await getAutomationConfig(); return c.summaryAuto && c.ownerPhone ? c.summaryHour : null; }, run: () => sendDailySummaries() },
  ];
}

async function tick() {
  // Vigilancia: "estoy encendido" cada 5 minutos
  const gg = g as unknown as { __lastAlive?: number };
  if (!gg.__lastAlive || Date.now() - gg.__lastAlive >= 5 * 60_000 - 5_000) {
    gg.__lastAlive = Date.now();
    import("./monitor").then((m) => m.pingAlive()).catch(() => {});
  }
  // Apartados del portal: vencer los que pasaron su plazo (cada minuto)
  import("./reservations").then((m) => m.expireDue()).catch((e) => console.error("[Tareas] apartados:", e));
  const busy = (g.__schedulerBusy ??= new Set());
  const { day, hour } = localNow();
  for (const job of await jobs()) {
    if (busy.has(job.name)) continue;
    try {
      const h = await job.hour();
      if (h === null || hour < h) continue;
      const key = `job:${job.name}:day`;
      if ((await readKV<string>(key, "")) === day) continue;
      busy.add(job.name);
      await writeKV(key, day); // se marca antes para no repetir si tarda o falla
      job.run().catch((e) => console.error(`[Tareas] ${job.name}:`, e)).finally(() => busy.delete(job.name));
    } catch (e) {
      busy.delete(job.name);
      console.error(`[Tareas] ${job.name}:`, e);
    }
  }
}

export function startScheduler() {
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;
  console.log("[Tareas] Reloj de tareas diarias activo");
  setTimeout(() => { tick().catch(() => {}); }, 20_000);
  setInterval(() => { tick().catch(() => {}); }, 60_000);
}
