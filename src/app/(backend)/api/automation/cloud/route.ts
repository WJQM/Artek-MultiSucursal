import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { cloudStatus, getCloudConfig, listCloud, publicCloudConfig, saveCloudConfig, testCloud, uploadToCloud } from "@/backend/cloud";
import { backupDir, listBackupFiles } from "@/backend/backups";

// Copia de los respaldos en la nube (solo Super Admin)
async function guard(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  return null;
}

export async function GET(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const url = new URL(request.url);
  const [config, last] = await Promise.all([publicCloudConfig(), cloudStatus()]);
  const list = url.searchParams.get("list") === "1" && config.ready ? await listCloud() : null;
  return NextResponse.json({ config, last, list });
}

export async function PUT(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json({ config: await saveCloudConfig(body || {}) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Datos inválidos" }, { status: 400 });
  }
}

/** { action: "test" } prueba la conexión · { action: "upload" } sube el respaldo más reciente */
export async function POST(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (body.action === "test") return NextResponse.json(await testCloud());
  if (body.action === "upload") {
    const c = await getCloudConfig();
    if (!c.account || !c.bucket) return NextResponse.json({ error: "Primero configura y guarda la conexión" }, { status: 400 });
    const latest = listBackupFiles()[0];
    if (!latest) return NextResponse.json({ error: "Todavía no hay respaldos en el servidor. Usa “Respaldar ahora” primero." }, { status: 400 });
    const file = path.join(backupDir(), latest.name);
    if (!fs.existsSync(file)) return NextResponse.json({ error: "No se encontró el respaldo" }, { status: 404 });
    return NextResponse.json(await uploadToCloud(file));
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
