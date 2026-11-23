import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { getMonitorConfig, monitorStatus, saveMonitorConfig, testMonitor } from "@/backend/monitor";

// Vigilancia externa (Healthchecks.io) — solo Super Admin
async function guard(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  return null;
}

export async function GET(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const [config, status] = await Promise.all([getMonitorConfig(), monitorStatus()]);
  return NextResponse.json({ config, status });
}

export async function PUT(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json({ config: await saveMonitorConfig(body || {}) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Datos inválidos" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  return NextResponse.json(await testMonitor());
}
