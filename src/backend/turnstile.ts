// Cloudflare Turnstile (captcha anti-bots). Si las claves no están en el .env, se omite.

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY || null;
}

export function isTurnstileEnabled(): boolean {
  return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

let warned = false;

export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  if (!isTurnstileEnabled()) {
    if (!warned && process.env.NODE_ENV === "production") {
      console.warn("[Turnstile] TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY no configuradas: captcha desactivado");
      warned = true;
    }
    return true;
  }
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error("[Turnstile] Error verificando:", e);
    return false;
  }
}

export const CAPTCHA_ERROR = "Verificación anti-robots fallida. Recarga la página e inténtalo de nuevo.";
