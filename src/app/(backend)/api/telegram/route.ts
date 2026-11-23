import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { publicTelegramConfig, saveTelegramToken } from "@/backend/telegram";

// Bot de Telegram del taller (solo Super Admin)
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  return NextResponse.json(await publicTelegramConfig());
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  const { token } = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await saveTelegramToken(String(token ?? "")));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
