import type { Metadata, Viewport } from "next";
import "./globals.css";
import { connection } from "next/server";
import { getSettings, DEFAULT_COMPANY_NAME } from "@/backend/company";
import { iconUrl } from "@/backend/pwa-manifest";
import { shareMetadata } from "@/backend/share-metadata";
import { brandThemeColor, getBrandColors } from "@/backend/brand-colors";
import { brandCss } from "@/shared/brand-colors";


export async function generateViewport(): Promise<Viewport> {
  await connection();
  return {
    width: "device-width",
    initialScale: 1,
    // "cover" + env(safe-area-inset-*) en globals.css: con la barra de estado translúcida
    // del iPhone el encabezado quedaba debajo del notch/hora
    viewportFit: "cover",
    // Mismo color que el encabezado (el Oscuro de Configuración › Colores) → la barra de estado del celular se funde con la app
    themeColor: await brandThemeColor(),
  };
}

// Título, nombre de la app instalada e ícono: salen de Admin → Configuración
export async function generateMetadata(): Promise<Metadata> {
  await connection(); // siempre en tiempo real (no congelar el nombre al compilar)
  const s = await getSettings();
  const name = s?.companyName?.trim() || DEFAULT_COMPANY_NAME;
  const v = s?.updatedAt ? s.updatedAt.getTime() : 0;
  return {
    ...(await shareMetadata()),
    title: name,
    description: s?.slogan || "Seguimiento de reparaciones",
    manifest: "/manifest.json",
    applicationName: name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: `${name} Sistema`, // nombre en la pantalla de inicio del iPhone (el portal usa solo el nombre)
    },
    icons: {
      // Pestaña del navegador: logo limpio. Ícono del iPhone: con la llave del sistema.
      icon: [{ url: iconUrl(32, v, "portal"), sizes: "32x32", type: "image/png" }, { url: iconUrl(192, v, "portal"), sizes: "192x192", type: "image/png" }],
      apple: iconUrl(180, v, "sistema"),
    },
  };
}

import ToastProvider from "./providers";
import { PwaSetup } from "@/frontend/components/PwaSetup";
import { GlobalSearchProvider } from "@/frontend/components/GlobalSearchProvider";
import { MotionGlobal } from "@/frontend/components/MotionGlobal";
import Script from "next/script";

const PWA_EARLY_CAPTURE = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pwaDeferred=e;window.dispatchEvent(new Event("pwa-deferred"));});`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Colores de Configuración › Colores: reemplazan los de globals.css (vacío si son los originales)
  const marca = brandCss(await getBrandColors());
  return (
    <html lang="es" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <style id="brand-colors" dangerouslySetInnerHTML={{ __html: marca }} />
        {/* Captura el aviso de "app instalable" aunque llegue antes de que cargue React.
            Con next/script (no <script> a mano en <head>): React 19 no ejecuta ni hidrata bien un <script> escrito en JSX */}
        <Script id="pwa-early-capture" strategy="beforeInteractive">{PWA_EARLY_CAPTURE}</Script>
        <ToastProvider />
        <PwaSetup />
        <GlobalSearchProvider />
        <MotionGlobal />
        {children}
      </body>
    </html>
  );
}
