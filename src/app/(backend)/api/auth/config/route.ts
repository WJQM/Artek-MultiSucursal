import { NextResponse } from "next/server";
import { turnstileSiteKey, isTurnstileEnabled } from "@/backend/turnstile";

// Configuración pública que necesitan las pantallas de acceso (sin secretos)
export async function GET() {
  return NextResponse.json({
    turnstileSiteKey: isTurnstileEnabled() ? turnstileSiteKey() : null,
    whatsappEnabled: !!process.env.WASENDER_API_KEY || process.env.NODE_ENV !== "production",
  });
}
