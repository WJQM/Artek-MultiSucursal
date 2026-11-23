"use client";
import { CircleCheck, Search } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Equipos listos que el cliente todavía no recogió (antes estaba dentro del Panel).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import UncollectedPanel, { type UncollectedData } from "@/frontend/components/UncollectedPanel";

const noop = () => () => {};
type Filter = "all" | "warn" | "expired";

export default function SinRecogerPage() {
  const router = useRouter();
  const rawUser = useSyncExternalStore(noop, () => sessionStorage.getItem("user") || "", () => null);
  const user = useMemo<{ role: string; name?: string } | null>(() => { try { return rawUser ? JSON.parse(rawUser) : null; } catch { return null; } }, [rawUser]);
  const [data, setData] = useState<UncollectedData | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    apiFetch("/api/repairs/uncollected").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setData(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (rawUser === null) return;
    if (!user) { router.push("/"); return; }
    if (user.role === "tech") { router.push("/asignaciones"); return; }
    load();
  }, [router, user, rawUser, load]);

  const view = useMemo<UncollectedData | null>(() => {
    if (!data) return null;
    const t = q.trim().toLowerCase();
    const items = data.items.filter((i) => {
      if (filter === "warn" && i.days < data.warnAfter) return false;
      if (filter === "expired" && i.days < data.abandonDays) return false;
      if (!t) return true;
      return [i.code, i.device, i.brand, i.model, i.clientName, i.clientPhone].some((v) => v && v.toLowerCase().includes(t));
    });
    return { ...data, items };
  }, [data, q, filter]);

  if (!user || user.role === "tech") return null;
  const warn = data ? data.items.filter((i) => i.days >= data.warnAfter).length : 0;
  const expired = data ? data.items.filter((i) => i.days >= data.abandonDays).length : 0;
  const chips: { k: Filter; l: string; n: number }[] = [
    { k: "all", l: "Todos", n: data?.items.length || 0 },
    { k: "warn", l: "Por abandonar", n: warn },
    { k: "expired", l: "Plazo vencido", n: expired },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        @media(max-width:600px){ .main-content{padding:64px 14px 40px!important} }
      `}</style>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Sin recoger</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Equipos listos que el cliente todavía no recogió. Recuérdale por WhatsApp antes de que venza el plazo.</p>
          </div>
          <label className="ui-search">
            <span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
            <span className="sr-only">Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, equipo, cliente o celular" />
          </label>
          <div className="db-chips filter-btns" role="group" aria-label="Filtrar">
            {chips.map((c) => (
              <button key={c.k} type="button" aria-pressed={filter === c.k} className={filter === c.k ? "is-active" : ""} onClick={() => setFilter(c.k)}>
                {c.l}{c.n > 0 && <b>{c.n}</b>}
              </button>
            ))}
          </div>
          {!view ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
          ) : view.items.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 40 }}><CircleCheck size={40} strokeWidth={1.5} aria-hidden="true" /></div>
              <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13.5 }}>{data && data.items.length ? "Nada con ese filtro" : "No hay equipos esperando ser recogidos"}</p>
            </div>
          ) : (
            <UncollectedPanel key={`${filter}|${q}`} data={view} onReload={load} full />
          )}
        </div>
      </div>
    </div>
  );
}
