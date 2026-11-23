// Manifiesto de la app del SISTEMA (personal). La del portal está en /manifest-portal.json.
import { buildManifest } from "@/backend/pwa-manifest";

export const dynamic = "force-dynamic";

export function GET() {
  return buildManifest("sistema");
}
