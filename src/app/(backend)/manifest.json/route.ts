// Manifiesto de la app del SISTEMA (personal). El portal de clientes no tiene manifiesto: no se instala.
import { buildManifest } from "@/backend/pwa-manifest";

export const dynamic = "force-dynamic";

export function GET() {
  return buildManifest();
}
