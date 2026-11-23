// Respaldo automático: ejecuta scripts/backup-diario.sh (pg_dump + imágenes) y guarda el resultado.
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { getAutomationConfig, notifyManagersAll, readKV, writeKV } from "./automation";
import { sendWhatsAppSafe } from "./whatsapp";

export interface BackupRun {
  at: string;          // ISO
  ok: boolean;
  trigger: "auto" | "manual";
  file?: string;       // nombre del .dump
  size?: number;       // bytes del .dump
  uploadsSize?: number;
  error?: string;
  retried?: boolean;
  /** Resultado de la copia en la nube (si está activada) */
  cloud?: { ok: boolean; error?: string };
}

const LOG_KEY = "backup:log";
const g = globalThis as unknown as { __backupRunning?: boolean };

/** Carpeta del sistema (PM2 arranca en la carpeta del proyecto). */
export function appDir(): string {
  return process.env.APP_DIR || process.cwd();
}

/** Misma carpeta que usa el script: BACKUP_DIR, o /root/backups si la app corre como root. */
export function backupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  return isRoot ? "/root/backups" : path.join(os.homedir(), "repairtrack-backups");
}

export function isBackupRunning() { return !!g.__backupRunning; }

export async function backupLog(): Promise<BackupRun[]> {
  return readKV<BackupRun[]>(LOG_KEY, []);
}

async function pushLog(run: BackupRun) {
  const log = await backupLog();
  log.unshift(run);
  await writeKV(LOG_KEY, log.slice(0, 30));
}

export interface BackupFile { name: string; size: number; at: string; uploads?: { name: string; size: number } }

/** Respaldos que hay en la carpeta (base de datos + su archivo de imágenes del mismo momento). */
export function listBackupFiles(): BackupFile[] {
  const dir = backupDir();
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out: BackupFile[] = [];
  for (const n of names) {
    const m = /^db_(\d{4}-\d{2}-\d{2}_\d{4})\.dump$/.exec(n);
    if (!m) continue;
    try {
      const st = fs.statSync(path.join(dir, n));
      const up = `uploads_${m[1]}.tar.gz`;
      let uploads: BackupFile["uploads"];
      try { uploads = { name: up, size: fs.statSync(path.join(dir, up)).size }; } catch {}
      out.push({ name: n, size: st.size, at: st.mtime.toISOString(), uploads });
    } catch {}
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Nombre de archivo de respaldo válido (evita leer otros archivos del servidor). */
export function safeBackupPath(name: string): string | null {
  if (!/^(db_\d{4}-\d{2}-\d{2}_\d{4}\.dump|uploads_\d{4}-\d{2}-\d{2}_\d{4}\.tar\.gz)$/.test(name)) return null;
  const p = path.join(backupDir(), name);
  return fs.existsSync(p) ? p : null;
}

function execScript(keepDays: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const script = path.join(appDir(), "scripts", "backup-diario.sh");
    if (!fs.existsSync(script)) { resolve({ code: 127, out: `No existe ${script}` }); return; }
    // -mtime +N borra los de más de N+1 días: con keep-1 quedan los últimos `keep` días
    const env = { ...process.env, APP_DIR: appDir(), BACKUP_DIR: backupDir(), RETENTION_DAYS: String(Math.max(0, keepDays - 1)) };
    const child = spawn("bash", [script], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { out += d.toString(); });
    const timer = setTimeout(() => { child.kill("SIGKILL"); out += "\nTiempo agotado (15 min)"; }, 15 * 60_000);
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: 1, out: out + "\n" + e.message }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }); });
  });
}

function parseResult(out: string) {
  const db = /Base de datos: (\S+)/.exec(out)?.[1];
  const up = /Imágenes: (\S+)/.exec(out)?.[1];
  const size = (p?: string) => { try { return p ? fs.statSync(p).size : undefined; } catch { return undefined; } };
  return { file: db ? path.basename(db) : undefined, size: size(db), uploadsSize: size(up) };
}

const lastLine = (s: string) => s.trim().split("\n").filter(Boolean).slice(-2).join(" · ").slice(0, 300) || "Error desconocido";

/**
 * Hace un respaldo. Si falla, reintenta una vez a los 30 s; si vuelve a fallar avisa
 * en la campana a los administradores y por WhatsApp al dueño.
 */
export async function runBackup(trigger: "auto" | "manual"): Promise<BackupRun> {
  if (g.__backupRunning) return { at: new Date().toISOString(), ok: false, trigger, error: "Ya hay un respaldo en curso" };
  g.__backupRunning = true;
  try {
    const cfg = await getAutomationConfig();
    let res = await execScript(cfg.backupKeep);
    let retried = false;
    if (res.code !== 0) {
      retried = true;
      await new Promise((r) => setTimeout(r, 30_000));
      res = await execScript(cfg.backupKeep);
    }
    const run: BackupRun = res.code === 0
      ? { at: new Date().toISOString(), ok: true, trigger, retried, ...parseResult(res.out) }
      : { at: new Date().toISOString(), ok: false, trigger, retried, error: lastLine(res.out) };
    // Copia en la nube (si está activada)
    if (run.ok && run.file) {
      const { getCloudConfig, uploadToCloud } = await import("./cloud");
      if ((await getCloudConfig()).enabled) {
        const st = await uploadToCloud(path.join(backupDir(), run.file));
        run.cloud = st.ok ? { ok: true } : { ok: false, error: st.error };
        if (!st.ok) {
          await notifyManagersAll("backup_failed", "⚠️ No se pudo subir el respaldo a la nube", `El respaldo se hizo en el servidor, pero la copia en la nube falló: ${st.error}`, null).catch(() => {});
          await (await import("./mail")).sendAlertMail("No se pudo subir el respaldo a la nube", `El respaldo se hizo en el servidor, pero la copia en la nube falló.\n\nDetalle: ${st.error}\n\nRevisa Configuración › Tareas automáticas › Copia en la nube.`);
          if (cfg.ownerPhone) await sendWhatsAppSafe(cfg.ownerPhone, `⚠️ *El respaldo se hizo, pero no se pudo subir a la nube.*\n\nDetalle: ${st.error}\n\nRevisa Configuración › Tareas automáticas › Copia en la nube.`);
        }
      }
    }
    await pushLog(run);
    // Vigilancia externa: "listo" o "falló"
    const { pingBackup } = await import("./monitor");
    await pingBackup(run.ok && run.cloud?.ok !== false, run.ok ? `OK ${run.file || ""} ${run.cloud ? (run.cloud.ok ? "· nube OK" : `· nube FALLÓ: ${run.cloud.error}`) : ""}` : `FALLÓ: ${run.error}`).catch(() => {});
    if (!run.ok) {
      console.error("[Respaldo] Falló:", res.out);
      await notifyManagersAll("backup_failed", "⚠️ Falló el respaldo de la base de datos", `Se intentó 2 veces. Detalle: ${run.error}`, null).catch(() => {});
      await (await import("./mail")).sendAlertMail("Falló el respaldo automático", `Se intentó 2 veces y no se pudo respaldar la base de datos.\n\nDetalle: ${run.error}\n\nRevisa Configuración › Tareas automáticas.`);
      if (cfg.ownerPhone) await sendWhatsAppSafe(cfg.ownerPhone, `⚠️ *Falló el respaldo automático* del sistema.\n\nDetalle: ${run.error}\n\nRevisa Configuración › Respaldos o pide ayuda técnica.`);
    } else {
      console.log(`[Respaldo] OK ${run.file} (${run.size} bytes)`);
    }
    return run;
  } finally {
    g.__backupRunning = false;
  }
}
