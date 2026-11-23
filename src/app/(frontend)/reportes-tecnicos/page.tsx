"use client";
import { Store } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { ImageLightbox } from "@/frontend/components/ImageLightbox";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { LOG_TYPES, LogIcon, STAGE_LABEL } from "@/frontend/components/RepairLogPanel";
import { pressKey } from "@/frontend/lib/a11y";
import { ListSkeleton } from "@/frontend/components/Skeletons";

interface Entry {
  id: string; type: string; text: string; images: string[]; authorName: string; authorRole: string;
  visibleToClient: boolean; hidden: boolean; createdAt: string;
  repairId: string; code: string; device: string; clientName: string | null; status: string; branchName: string | null;
  stage: string | null; recordedByName: string | null;
}
interface Data { allBranches: boolean; total: number; byType: Record<string, number>; authors: { id: string; name: string; count: number }[]; entries: Entry[] }

const PERIODS = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "3 meses" },
  { days: 0, label: "Todo" },
];

export default function ReportesTecnicosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; role: string; name?: string } | null>(null);
  const [days, setDays] = useState(7);
  const [type, setType] = useState("");
  const [author, setAuthor] = useState("");
  const [visible, setVisible] = useState("");
  const [q, setQ] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const ud = sessionStorage.getItem("user");
    if (!token || !ud) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(ud); } catch { return null; } })();
    if (!u) { router.push("/"); return; }
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (type) params.set("type", type);
    if (author) params.set("author", author);
    if (visible) params.set("visible", visible);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await apiFetch(`/api/repair-logs?${params}`, allBranches ? { headers: { "x-branch-id": "" } } : {});
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { if (!user) return; const t = setTimeout(() => load(), q ? 350 : 0); return () => clearTimeout(t); }, [user, days, type, author, visible, q, allBranches]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(["RepairLog"], () => load(true), { enabled: !!user });

  if (!user) return null;

  const chip = (active: boolean, color = "#0e7c86"): React.CSSProperties => ({
    padding: "7px 13px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    border: `1.5px solid ${active ? color : "#cbd5e1"}`, background: active ? `${color}18` : "#fff", color: active ? color : "var(--text-secondary)",
  });
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-BO", { hourCycle: "h23", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const entries = data?.entries || [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        @media(max-width:640px){ .main-content{padding:64px 12px 40px!important} }
        .rt-row { display:flex; gap:8px; flex-wrap:wrap; }
        @media (hover: hover) and (pointer: fine) { .rt-card:hover { border-color:var(--accent) !important; } }
      `}</style>

      <AppSidebar user={user} />

      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Reportes técnicos</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Hallazgos, avances, problemas e informes finales que registran los técnicos en la bitácora de cada orden.
              {user.role === "superadmin" && (allBranches ? " Mostrando todas las sucursales." : " Mostrando la sucursal activa.")}
            </p>
          </div>

          {/* Filtros */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rt-row">
              {PERIODS.map((p) => <button key={p.days} type="button" onClick={() => setDays(p.days)} style={chip(days === p.days)}>{p.label}</button>)}
              {user.role === "superadmin" && (
                <button type="button" onClick={() => setAllBranches((v) => !v)} style={{ ...chip(allBranches, "#0369a1"), marginLeft: "auto" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {allBranches ? "Todas las sucursales" : "Solo sucursal activa"}</button>
              )}
            </div>
            <div className="rt-row">
              <button type="button" onClick={() => setType("")} style={chip(!type)}>Todos</button>
              {Object.entries(LOG_TYPES).map(([k, t]) => (
                <button key={k} type="button" onClick={() => setType(type === k ? "" : k)} style={chip(type === k, t.color)}>
                  <LogIcon type={k} size={13} /> {t.label}{data?.byType?.[k] ? ` (${data.byType[k]})` : ""}
                </button>
              ))}
            </div>
            <div className="rt-row" style={{ alignItems: "center" }}>
              <select aria-label="Filtrar por técnico" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5, background: "#fff" }}>
                <option value="">Todos los técnicos</option>
                {(data?.authors || []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}
              </select>
              <select aria-label="Filtrar por visibilidad" value={visible} onChange={(e) => setVisible(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5, background: "#fff" }}>
                <option value="">Internas y del cliente</option>
                <option value="client">Solo visibles al cliente</option>
                <option value="internal">Solo internas</option>
              </select>
              <input aria-label="Buscar orden" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar orden (OT-12)" style={{ flex: "1 1 160px", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5 }} />
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            {loading ? "Cargando…" : `${entries.length} registro${entries.length === 1 ? "" : "s"}${entries.length === 300 ? " (se muestran los 300 más recientes)" : ""}`}
          </div>

          {loading && entries.length === 0 && <ListSkeleton />}

          {!loading && entries.length === 0 && (
            <div style={{ background: "#fff", border: "1.5px dashed var(--border-strong)", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No hay registros con estos filtros. Los técnicos escriben en la bitácora desde Mis Asignaciones.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map((e) => {
              const t = LOG_TYPES[e.type] || LOG_TYPES.avance;
              return (
                <div key={e.id} className="rt-card" style={{ background: "#fff", border: "1.5px solid var(--border-soft)", borderRadius: 12, padding: "12px 14px", opacity: e.hidden ? 0.55 : 1, transition: "border-color .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.color, display: "inline-flex", alignItems: "center", gap: 5 }}><LogIcon type={e.type} size={13} />{t.label}</span>
                    <button type="button" onClick={() => router.push(`/dashboard?focus=${encodeURIComponent(e.code)}`)} title="Abrir la orden"
                      style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1px solid rgba(var(--accent-bright-rgb), 0.25)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>{e.code}</button>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{e.device}</span>
                    {e.clientName && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>· {e.clientName}</span>}
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                      {data?.allBranches && e.branchName && <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", background: "rgba(3,105,161,0.08)", padding: "2px 8px", borderRadius: 99 }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {e.branchName}</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: e.visibleToClient ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: e.visibleToClient ? "var(--ok)" : "var(--text-secondary)" }}>{e.visibleToClient ? "Cliente" : "Interno"}</span>
                      {e.hidden && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>Oculta</span>}
                    </span>
                  </div>
                  {e.text && e.text !== "(solo fotos)" && <div style={{ fontSize: 13.5, color: "var(--text-primary)", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5, wordBreak: "break-word" }}>{e.text}</div>}
                  {e.images.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {e.images.map((src) => <img loading="lazy" decoding="async" role="button" tabIndex={0} onKeyDown={pressKey} key={src} src={src} alt="Foto" onClick={() => setViewer(src)} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-soft)", cursor: "zoom-in" }} />)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    {e.authorName} · {fmt(e.createdAt)}{e.stage && STAGE_LABEL[e.stage] ? ` · en ${STAGE_LABEL[e.stage]}` : ""}
                    {e.recordedByName && <> · registrado por {e.recordedByName}</>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ImageLightbox src={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
