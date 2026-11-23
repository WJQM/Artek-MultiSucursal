"use client";
// Barra superior de computadora/laptop en todas las páginas internas: buscador (Ctrl+K), reloj y campana.
// El Panel principal tiene la suya propia. En celular/tablet (≤1024px) se usa la barra oscura del menú.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlobalSearch } from "@/frontend/components/GlobalSearch";
import { NotificationBell } from "@/frontend/components/NotificationBell";

const OWN_HEADER = ["/dashboard"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Aviso tocado en la campana: abre la orden en Mis Asignaciones (técnico) o en el Panel (administradores). */
export function openOrderFromBell(code: string, pathname: string, push: (url: string) => void) {
  if (pathname.startsWith("/asignaciones")) { window.dispatchEvent(new CustomEvent("rt:focus-order", { detail: code })); return; }
  let role = "";
  try { role = JSON.parse(sessionStorage.getItem("user") || "{}").role || ""; } catch { /* sin sesión */ }
  push(`${role === "tech" ? "/asignaciones" : "/dashboard"}?focus=${encodeURIComponent(code)}`);
}

export function AppTopbar({ city }: { city?: string | null }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  if (OWN_HEADER.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  const date = now ? now.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <header className="app-topbar">
      <GlobalSearch inline />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <div className="topbar-date" suppressHydrationWarning>
          <span className="tabular" aria-label="Hora actual">{now ? <>{pad(now.getHours())}<span className="rt-colon">:</span>{pad(now.getMinutes())}</> : ""}</span>
          <div>
            <div style={{ textTransform: "capitalize" }}>{date}</div>
            {city && <div className="sub">{city}</div>}
          </div>
        </div>
        <NotificationBell onOpenCode={(code) => openOrderFromBell(code, pathname, router.push)} />
      </div>
    </header>
  );
}
