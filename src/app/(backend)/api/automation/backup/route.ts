import fs from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { isBackupRunning, runBackup, safeBackupPath } from "@/backend/backups";

// POST: respaldar ahora (corre en segundo plano). GET ?file=: descargar un respaldo. Solo Super Admin.
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  if (isBackupRunning()) return NextResponse.json({ error: "Ya hay un respaldo en curso" }, { status: 409 });
  runBackup("manual").catch((e) => console.error("[Respaldo] manual:", e));
  return NextResponse.json({ started: true });
}

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  const name = new URL(request.url).searchParams.get("file") || "";
  const p = safeBackupPath(name);
  if (!p) return NextResponse.json({ error: "Respaldo no encontrado" }, { status: 404 });
  const stat = fs.statSync(p);
  const stream = fs.createReadStream(p);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
