// Vigilancia externa con Healthchecks.io (o cualquier servicio de "pings").
// - backupUrl: se avisa al terminar cada respaldo (…/fail si falló). Si una noche no llega, Healthchecks avisa.
// - aliveUrl: el sistema avisa "estoy encendido" cada 5 minutos. Si deja de llegar, el servidor está caído.
import { readKV, writeKV } from "./automation";

export interface MonitorConfig { backupUrl: string; aliveUrl: string }
export interface MonitorStatus { lastAlive?: string; lastAliveOk?: boolean; lastBackupPing?: string; lastBackupPingOk?: boolean }

const KEY = "monitor:config";
const STATUS_KEY = "monitor:last";

export async function getMonitorConfig(): Promise<MonitorConfig> {
  return { backupUrl: "", aliveUrl: "", ...(await readKV<Partial<MonitorConfig>>(KEY, {})) };
}

const validUrl = (u: string) => u === "" || (/^https:\/\/[^\s/]+\/\S+$/.test(u) && u.length <= 300);

export async function saveMonitorConfig(input: Record<string, unknown>): Promise<MonitorConfig> {
  const cur = await getMonitorConfig();
  const next: MonitorConfig = {
    backupUrl: typeof input.backupUrl === "string" ? input.backupUrl.trim() : cur.backupUrl,
    aliveUrl: typeof input.aliveUrl === "string" ? input.aliveUrl.trim() : cur.aliveUrl,
  };
  if (!validUrl(next.backupUrl) || !validUrl(next.aliveUrl)) throw new Error("Pega el enlace completo que te da Healthchecks.io (empieza con https://)");
  await writeKV(KEY, next);
  return next;
}

export async function monitorStatus(): Promise<MonitorStatus> {
  return readKV<MonitorStatus>(STATUS_KEY, {});
}
async function setStatus(patch: MonitorStatus) {
  await writeKV(STATUS_KEY, { ...(await monitorStatus()), ...patch });
}

/** Envía una señal. Nunca lanza error. */
async function ping(url: string, suffix = "", body?: string): Promise<boolean> {
  if (!url) return false;
  try {
    const r = await fetch(url.replace(/\/+$/, "") + suffix, {
      method: body ? "POST" : "GET",
      body: body ? body.slice(0, 10_000) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Al terminar el respaldo: "listo" o "falló" (con el detalle). */
export async function pingBackup(ok: boolean, detail: string) {
  const { backupUrl } = await getMonitorConfig();
  if (!backupUrl) return;
  const sent = await ping(backupUrl, ok ? "" : "/fail", detail);
  await setStatus({ lastBackupPing: new Date().toISOString(), lastBackupPingOk: sent });
}

/** "Estoy encendido" (lo llama el reloj de tareas cada 5 minutos). */
export async function pingAlive() {
  const { aliveUrl } = await getMonitorConfig();
  if (!aliveUrl) return;
  const sent = await ping(aliveUrl);
  await setStatus({ lastAlive: new Date().toISOString(), lastAliveOk: sent });
}

/** Botón "Enviar señal de prueba": prueba los dos enlaces. */
export async function testMonitor(): Promise<{ backup: boolean | null; alive: boolean | null }> {
  const c = await getMonitorConfig();
  const backup = c.backupUrl ? await ping(c.backupUrl, "", "Señal de prueba desde Configuración") : null;
  const alive = c.aliveUrl ? await ping(c.aliveUrl) : null;
  const now = new Date().toISOString();
  await setStatus({ ...(backup !== null ? { lastBackupPing: now, lastBackupPingOk: backup } : {}), ...(alive !== null ? { lastAlive: now, lastAliveOk: alive } : {}) });
  return { backup, alive };
}
