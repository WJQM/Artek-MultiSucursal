// Manifiesto de la app del PORTAL (clientes): abre en /portal.
import { buildManifest } from "@/backend/pwa-manifest";

export const dynamic = "force-dynamic";

export function GET() {
  return buildManifest("portal");
}
