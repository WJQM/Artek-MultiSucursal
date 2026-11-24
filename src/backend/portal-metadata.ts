import type { Metadata } from "next";
import { connection } from "next/server";
import { pwaNames, iconUrl } from "@/backend/pwa-manifest";

/** Páginas de clientes (/portal y /track): no se instalan como app. Se quita el manifiesto que
 *  heredarían del layout general; si no, desde aquí se podría instalar la app del Sistema. */
export async function portalMetadata(): Promise<Metadata> {
  await connection();
  const { v } = await pwaNames();
  return {
    manifest: null,
    appleWebApp: null,
    icons: {
      icon: [{ url: iconUrl(32, v, "portal"), sizes: "32x32", type: "image/png" }, { url: iconUrl(192, v, "portal"), sizes: "192x192", type: "image/png" }],
      apple: iconUrl(180, v, "portal"),
    },
  };
}
