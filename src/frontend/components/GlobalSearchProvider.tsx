"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GlobalSearch } from "@/frontend/components/GlobalSearch";

// Rutas donde NO debe mostrarse el buscador global (portal público, track, login)
const PUBLIC_PATHS = ["/", "/portal", "/track", "/certificate-view", "/delivery", "/quotations/print", "/equipment/print", "/consoles/print", "/inventory/print", "/software/print", "/videogames/print", "/print"];

export function GlobalSearchProvider() {
  const pathname = usePathname();
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    setHasAuth(!!sessionStorage.getItem("token")); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    const h = () => setHasAuth(!!sessionStorage.getItem("token"));
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [pathname]);

  // Esconder en rutas públicas o sin auth
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic || !hasAuth) return null;

  return <GlobalSearch />;
}
