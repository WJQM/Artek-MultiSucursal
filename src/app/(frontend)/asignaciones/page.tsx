"use client";
import WaFallback from "@/frontend/components/WaFallback";
import { waLink } from "@/frontend/components/ReceiptShare";
import { sileo } from "@/frontend/lib/toast";
import { Pagination } from "@/frontend/components/Pagination";
import { publicBase } from "@/frontend/lib/public-base";
import { apiFetch } from "@/frontend/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { useFlashChanges, celebrate } from "@/frontend/lib/motion";
import { CountUp } from "@/frontend/components/CountUp";
import { AssignmentDetail } from "@/frontend/components/AssignmentDetail";
import { ClipboardList, Hourglass, QrCode, Search } from "@/frontend/components/icons";
import { StatusDot, STROKE } from "@/frontend/components/UiIcons";
import { AssignmentHead, AssignmentRow } from "@/frontend/components/AssignmentRow";
import { AdvanceDialog, needsAdvanceDialog } from "@/frontend/components/AdvanceDialog";
import { openChat } from "@/frontend/components/ChatBubble";
import { PageSkeleton } from "@/frontend/components/Skeletons";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; priority: string; estimatedCost: number; notes: string | null; image: string | null; accessories: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null; qrCode: string; createdAt: string; updatedAt: string; technicianId: string | null; branchId: string; technician?: { id: string; name: string } | null; }
interface ServiceItem { id: string; name: string; price: number; icon: string; }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#b45309", bg: "rgba(245,158,11,0.08)" },
  diagnosed: { label: "Diagnosticado", color: "#0e7490", bg: "rgba(14,116,144,0.08)" },
  waiting_parts: { label: "Esperando Repuestos", color: "#c2410c", bg: "rgba(249,115,22,0.08)" },
  in_progress: { label: "En Progreso", color: "#2563eb", bg: "rgba(59,130,246,0.08)" },
  completed: { label: "Completado", color: "#047857", bg: "rgba(16,185,129,0.08)" },
  delivered: { label: "Entregado", color: "#5a6a80", bg: "rgba(107,114,128,0.08)" },
};
const STEPS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed"];

function parseImages(img: string | null): string[] { if (!img) return []; try { const p = JSON.parse(img); if (Array.isArray(p)) return p.filter((u: unknown): u is string => typeof u === "string" && u.length > 0); } catch {} return img.trim().length > 0 ? [img] : []; }
function parseAcc(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseNotes(n: string | null, svcList: ServiceItem[]): { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string } {
  if (!n) return { notes: "", services: [], software: [], videogames: [], repuestos: [], deliveryNotes: "", discount: "" };
  const parts = n.split(" | "); const sP = parts.find(p => p.startsWith("Servicios: ")); const swP = parts.find(p => p.startsWith("Programas: ") || p.startsWith("Software: ")); const vgP = parts.find(p => p.startsWith("Videojuegos: ")); const rP = parts.find(p => p.startsWith("Repuestos: ")); const dP = parts.find(p => p.startsWith("Entrega: ")); const discP = parts.find(p => p.startsWith("Descuento: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Programas: ") && !p.startsWith("Software: ") && !p.startsWith("Videojuegos: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: ") && !p.startsWith("Descuento: "));
  const services: string[] = []; const software: string[] = []; const videogames: string[] = []; const repuestos: string[] = [];
  if (sP) sP.replace("Servicios: ", "").split(", ").forEach(nm => { if (svcList.find(s => s.name === nm)) services.push(nm); });
  if (swP) swP.replace("Programas: ", "").replace("Software: ", "").split(", ").forEach(nm => { if (nm.trim()) software.push(nm.trim()); });
  if (vgP) vgP.replace("Videojuegos: ", "").split(", ").forEach(nm => { if (nm.trim()) videogames.push(nm.trim()); });
  if (rP) rP.replace("Repuestos: ", "").split(", ").forEach(nm => { if (nm.trim()) repuestos.push(nm.trim()); });
  return { notes: rest.join(" | "), services, software, videogames, repuestos, deliveryNotes: dP ? dP.replace("Entrega: ", "") : "", discount: discP ? discP.replace("Descuento: ", "") : "" };
}

export default function AsignacionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  // Tarjetas que cambiaron (el admin avanzó la orden, etc.) se iluminan un momento
  useFlashChanges(repairs, (r) => r.id, (r) => `${r.status}|${r.updatedAt}`);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [svcList, setSvcList] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState("");
  // Paginación: 10 órdenes por página, igual que el Panel
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Abrir la OT que viene del buscador global (?focus=OT-X): se busca por su código en el servidor
  const [focusCode, setFocusCode] = useState<string | null>(null);
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) { setFocusCode(focus); setSearch(focus); }
  }, []);
  useEffect(() => {
    if (!focusCode) return;
    const target = repairs.find(r => r.code === focusCode);
    if (!target) return;
    setFocusCode(null);
    setExpanded(target.id);
    setTimeout(() => document.querySelector(`[data-repair-id="${target.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
  }, [repairs, focusCode]);
  // Aviso tocado en la campana de la barra superior → abrir esa orden aquí mismo
  useEffect(() => {
    const open = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      const target = repairs.find(x => x.code === code);
      if (!target) { setFocusCode(code); setFilter("all"); setPage(1); setSearch(code); return; }
      setExpanded(target.id);
      setTimeout(() => document.querySelector(`[data-repair-id="${target.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    };
    window.addEventListener("rt:focus-order", open);
    return () => window.removeEventListener("rt:focus-order", open);
  }, [repairs]);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; website: string | null }>({ companyName: "", slogan: "", logo: null, website: null });
  // El servidor filtra y pagina (antes llegaban todas las órdenes asignadas, también las entregadas hace años)
  const [total, setTotal] = useState(0);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [allCount, setAllCount] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const load = async (_token?: string) => {
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (q) p.set("search", q);
      if (filter !== "all") p.set("status", filter);
      const r = await apiFetch(`/api/repairs?${p}`);
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.repairs) && d.repairs.length === 0 && d.total > 0 && page > 1) { setPage(d.totalPages); return; }
      setRepairs(d.repairs || []); setTotal(d.total || 0);
      if (d.stats) { setByStatus(d.stats.byStatus || {}); setAllCount(d.stats.total || 0); }
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (user) void load(); }, [user, page, q, filter]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, slogan: d.slogan, logo: d.logo, website: d.website }); }).catch(() => {});
    const ud = sessionStorage.getItem("user"); const tk = sessionStorage.getItem("token");
    if (!ud || !tk) { router.push("/"); return; }
    const p = (() => { try { return JSON.parse(ud); } catch { return null; } })();
    if (p.role === "admin") { router.push("/dashboard"); return; }
    setUser(p);
    apiFetch("/api/services").then(r => r.json()).then(d => { if (Array.isArray(d)) setSvcList(d); }).catch(() => {});
  }, [router]);
  // Tiempo real (antes: consulta cada 10 s)
  useLiveRefresh(["Repair", "StatusHistory", "Message"], () => { const tk = sessionStorage.getItem("token"); if (tk) load(tk); });

  const [waFallback, setWaFallback] = useState<string | null>(null);
  const sendWhatsApp = async (phone: string | null, message: string) => {
    if (!phone) { sileo.warning({ title: "Sin número de celular" }); return; }
    try {
      const res = await apiFetch("/api/whatsapp", {
        method: "POST",
        body: JSON.stringify({ phone, message }),
      });
      if (res.ok) { sileo.success({ title: "WhatsApp enviado" }); setWaFallback(null); }
      else {
        const d = await res.json().catch(() => ({}));
        sileo.warning({ title: "No se pudo enviar desde el número del taller", description: d.error || "Error al enviar" });
        setWaFallback(waLink(phone, message));
      }
    } catch { sileo.error({ title: "Error de conexión" }); setWaFallback(waLink(phone, message)); }
  };

  // Dominio donde está instalado el sistema (cada empresa tiene el suyo)
  const [pubBase, setPubBase] = useState("");
  useEffect(() => { publicBase().then(setPubBase); }, []);
  const getBaseUrl = () => pubBase || window.location.origin;
  // Enlace personal del cliente (ve su orden sin los 4 dígitos); si falla, el portal
  const personalLink = async (repairId: string) => {
    try { const r = await apiFetch(`/api/repairs/${repairId}/link`); if (r.ok) { const d = await r.json(); if (d.url) return d.url as string; } } catch {}
    return `${getBaseUrl()}/portal`;
  };


  // Avanzar abre "Registrar y avanzar" (bitácora obligatoria en diagnóstico, repuestos e informe final)
  const [advancing, setAdvancing] = useState<{ repair: Repair; to: string } | null>(null);
  const advance = async (id: string, next: string) => {
    const tk = sessionStorage.getItem("token"); if (!tk) return;
    const rep = repairs.find(x => x.id === id);
    if (rep && needsAdvanceDialog(next)) { setAdvancing({ repair: rep, to: next }); return; }
    try { const r = await apiFetch(`/api/repairs/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      if (r.ok) { celebrate(next === "completed" ? "complete" : "advance"); sileo.success({ title: `${STATUS[next]?.label}` }); await load(tk); } else sileo.error({ title: "Error" });
    } catch { sileo.error({ title: "Sin conexión" }); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageList = repairs;
  const goToPage = (p: number) => { setPage(Math.max(1, Math.min(totalPages, p))); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const n = (k: string) => byStatus[k] || 0;
  const st = { total: allCount, pend: n("pending") + n("diagnosed") + n("waiting_parts"), prog: n("in_progress"), done: n("completed") + n("delivered") };

  if (!user) return <PageSkeleton />;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
{advancing && (
  <AdvanceDialog repair={{ id: advancing.repair.id, code: advancing.repair.code, device: [advancing.repair.device, advancing.repair.brand, advancing.repair.model].filter(Boolean).join(" "), clientPhone: advancing.repair.clientPhone }}
    to={advancing.to} isManager={false} onClose={() => setAdvancing(null)}
    onDone={() => { setAdvancing(null); const tk = sessionStorage.getItem("token"); if (tk) load(tk); }} />
)}
{viewImg && <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, cursor: "pointer" }}><img alt="" src={viewImg} style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: 12 }} /></div>}

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeScale{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        .sb{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted);transition:.15s;text-align:left}
        @media (hover: hover) and (pointer: fine) { .sb:hover{background:rgba(99,102,241,.06);color:var(--text-secondary)} }
        .sb.on{background:rgba(99,102,241,.12);color:var(--accent)}
        .sbi{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .sidebar-group-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 10px;border-radius:8px;border:none;font-size: 11px;font-weight:700;cursor:pointer;background:transparent;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;transition:.15s;text-align:left}
        @media (hover: hover) and (pointer: fine) { .sidebar-group-btn:hover{background:rgba(99,102,241,.04);color:var(--text-secondary)} }
        .group-arrow{font-size:11px;transition:transform .2s;color:var(--text-muted)}
        .sidebar-group-btn.open .group-arrow{transform:rotate(180deg)}
        .sidebar-sub-list{overflow:hidden;max-height:0;transition:max-height .25s ease}
        .sidebar-sub-list.open{max-height:200px}
        .sb.sub{padding-left:22px}
        .chip{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:6px;font-size: 11px;font-weight:600}
        .abtn{transition:.15s}
        @media (hover: hover) and (pointer: fine) { .abtn:hover{filter:brightness(1.15);transform:scale(1.02)} }
      
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          [style*="grid-template-columns"]{grid-template-columns:1fr!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .card-compact{flex-direction:column!important}
          .card-img{width:100%!important;min-height:160px!important;max-height:200px!important}
          .card-compact p{max-width:100%!important}
          .msg-layout{grid-template-columns:1fr!important}
          .filter-btns{overflow-x:auto;-webkit-overflow-scrolling:touch}
        }
      `}</style>

      
      {/* MOBILE HEADER */}
      <WaFallback link={waFallback} onClose={() => setWaFallback(null)} />
      <AppSidebar user={user} />

      {/* CONTENIDO (en computadora, arriba va la barra con buscador, reloj y campana: AppTopbar) */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
        {/* Saludo en la franja azul oscuro, igual que el Panel principal */}
        <section className="db-welcome">
          <div>
            <h1>Mis asignaciones</h1>
            <p>
              {st.total === 0 ? "No tienes órdenes asignadas" : `${st.pend} ${st.pend === 1 ? "pendiente" : "pendientes"} · ${st.prog} en progreso · ${st.done} ${st.done === 1 ? "completada" : "completadas"}`}
            </p>
          </div>
          <div className="db-welcome-acts">
            {n("pending") > 0 && (
              <button type="button" className="db-btn-white" onClick={() => { setFilter("pending"); setPage(1); }}>
                <Hourglass size={18} strokeWidth={STROKE} aria-hidden="true" /> Por revisar <span className="db-btn-count">{n("pending")}</span>
              </button>
            )}
            <button type="button" className="db-btn-amber" onClick={() => router.push("/scanner")}><QrCode size={18} strokeWidth={STROKE} aria-hidden="true" /> Escanear QR</button>
          </div>
        </section>
        {/* Tarjetas, buscador, filtros y tabla: los mismos del Panel principal */}
        <div className="db-cards stats-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {[{ l: "Asignadas", v: st.total, c: "var(--text-primary)", bg: "#0e7c861a" }, { l: "Pendientes", v: st.pend, c: STATUS.pending.color, bg: `${STATUS.pending.color}1a` }, { l: "En progreso", v: st.prog, c: STATUS.in_progress.color, bg: `${STATUS.in_progress.color}1a` }, { l: "Completadas", v: st.done, c: STATUS.completed.color, bg: `${STATUS.completed.color}1a` }].map((m) => (
            <div key={m.l} className="db-card">
              <span className="db-card-top"><span className="db-card-l">{m.l}</span></span>
              <span className="db-card-v" style={{ color: m.l === "Completadas" ? m.c : "var(--text-primary)" }}><CountUp value={m.v} /></span>
            </div>
          ))}
        </div>

        <div className="db-toolbar">
          <label className="ui-search">
            <Search size={16} strokeWidth={STROKE} aria-hidden="true" />
            <span className="sr-only">Buscar órdenes</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por código, equipo o cliente" />
          </label>
          <div className="filter-btns db-chips" role="group" aria-label="Filtrar por estado">
            {[{ k: "all", l: "Todas" }, ...Object.entries(STATUS).map(([k, v]) => ({ k, l: v.label }))].map(f => {
              const on = filter === f.k; const cnt = f.k === "all" ? allCount : n(f.k);
              return <button key={f.k} type="button" aria-pressed={on} className={on ? "is-active" : ""} onClick={() => { setFilter(f.k); setPage(1); }}>{f.k !== "all" && <StatusDot color={STATUS[f.k]?.color || "#5a6a80"} />}{f.l}{cnt > 0 && <b>{cnt}</b>}</button>;
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>Reparaciones</h2><span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 10 }}>{total}{total !== allCount ? ` de ${allCount}` : ""}</span></div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-label="Cargando">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ padding: "10px 16px", marginBottom: 0 }}>
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                <div className="skeleton" style={{ width: 52, height: 18, borderRadius: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div className="skeleton skeleton-text" style={{ width: "55%", marginBottom: 0 }} /></div>
                <div className="skeleton" style={{ width: 90, height: 26, borderRadius: 8, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )
        : pageList.length === 0 ? <div style={{ padding: 50, textAlign: "center", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}><div style={{ marginBottom: 12, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}><ClipboardList size={40} strokeWidth={1.5} aria-hidden="true" /></div><h3 style={{ fontSize: 15, fontWeight: 700 }}>Sin asignaciones</h3></div>
        : (
          <div className="ot-list">
            <AssignmentHead />
            {pageList.map((r, i) => {
              const s = STATUS[r.status] || { label: r.status, color: "#666", bg: "rgba(100,100,100,.08)" };
              const isOpen = expanded === r.id;
              const isDone = r.status === "delivered";
              const ci = isDone ? STEPS.length - 1 : STEPS.indexOf(r.status);
              const next = !isDone && ci >= 0 && ci < STEPS.length - 1 ? STEPS[ci + 1] : undefined;
              const imgs = parseImages(r.image);
              const acc = parseAcc(r.accessories);
              const p = parseNotes(r.notes, svcList);

              return (
                <AssignmentRow key={r.id} repair={r} status={s} next={next ? STATUS[next] : undefined} index={i} isOpen={isOpen} images={imgs} nextKey={next}
                  onToggle={() => setExpanded(isOpen ? null : r.id)} onViewImage={setViewImg} onAdvance={() => { if (next) advance(r.id, next); }}>
                  {/* EXPANDIDO: mismo diseño que el detalle del Panel */}
                  {isOpen && (
                    <AssignmentDetail repair={r} status={s} statuses={STATUS} stepKeys={STEPS} next={next} images={imgs} accessories={acc} parsed={p} technicianName={user.name}
                      onViewImage={setViewImg} onAdvance={(to) => advance(r.id, to)} onChat={() => openChat({ repairId: r.id })}
                      onWhatsApp={async () => { const link = await personalLink(r.id); const msg = `Estimado/a${r.clientName ? ` *${r.clientName}*` : ""},\n\nNos comunicamos de *${settings.companyName}* respecto a su equipo *${r.device}${r.brand ? ` ${r.brand}` : ""}* (${r.code}).\n\nPuede ver el estado de su equipo aquí:\n🔗 ${link}${link.endsWith("/portal") ? "" : `\n\n🛍️ Conozca nuestros productos y servicios:\n🔗 ${getBaseUrl()}/portal`}\n\nAtentamente,\n*${settings.companyName}*`; sendWhatsApp(r.clientPhone, msg); }} />
                  )}
                </AssignmentRow>
              );
            })}
          </div>
        )}
        {!loading && <Pagination page={curPage} totalPages={totalPages} onChange={goToPage} />}
      </div>
    </div>
  );
}
