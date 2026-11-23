import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { getAutomationConfig, saveAutomationConfig } from "@/backend/automation";
import { backupDir, backupLog, isBackupRunning, listBackupFiles } from "@/backend/backups";

// Configuración de tareas automáticas (solo Super Admin): respaldos y resumen del día
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  const [config, log] = await Promise.all([getAutomationConfig(), backupLog()]);
  return NextResponse.json({
    config,
    backups: { dir: backupDir(), running: isBackupRunning(), files: listBackupFiles(), log: log.slice(0, 15), production: process.env.NODE_ENV === "production" || process.env.TAREAS === "1" },
  });
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  try {
    const body = await request.json();
    const config = await saveAutomationConfig(body || {});
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
