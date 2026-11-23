import type { Metadata } from "next";
import { connection } from "next/server";
import { pwaNames, iconUrl } from "@/backend/pwa-manifest";

/** Páginas de clientes: se instalan como la app del PORTAL (no la del sistema) */
export async function portalMetadata(): Promise<Metadata> {
  await connection();
  const { name, v } = await pwaNames();
  return {
    manifest: "/manifest-portal.json",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: name },
    icons: {
      icon: [{ url: iconUrl(32, v, "portal"), sizes: "32x32", type: "image/png" }, { url: iconUrl(192, v, "portal"), sizes: "192x192", type: "image/png" }],
      apple: iconUrl(180, v, "portal"),
    },
  };
}
