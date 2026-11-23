import { NextResponse } from "next/server";
import { cookieSecure } from "@/backend/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("token", "", { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
