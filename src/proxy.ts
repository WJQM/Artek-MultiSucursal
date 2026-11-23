import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/backend/jwt-secret";

// Páginas internas: requieren sesión
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/asignaciones",
  "/sin-recoger",
  "/services",
  "/inventory",
  "/repuestos",
  "/software",
  "/scanner",
  "/quotations",
  "/extracto",
  "/new-order",
  "/print",
  "/admin",
  "/certificates",
  "/cash",
  "/clients",
  "/stats",
  "/equipment",
  "/consoles",
  "/videogames",
  "/qr-batch",
  "/reports",
  "/mi-cuenta",
  "/reviews",
  "/citas",
  "/apartados",
  "/rendimiento",
  "/exportar",
];

// Excepciones públicas dentro de los prefijos anteriores (se abren desde QR impresos / portal)
const PUBLIC_EXCEPTIONS = [
  "/quotations/print/",
  "/equipment/print/",
  "/consoles/print/",
  "/print-qr/",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function isProtected(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some((p) => pathname.startsWith(p))) return false;
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.redirect(new URL("/", request.url));

  try {
    await jwtVerify(token, new TextEncoder().encode(getJwtSecret()), { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("token");
    return response;
  }
}

export const config = {
  // Todo excepto API, estáticos de Next, uploads e íconos
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|manifest.json|sw.js|icon-).*)"],
};
