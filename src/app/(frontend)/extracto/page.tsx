"use client";
import { ChartColumn, ClipboardList, Laptop, Printer, Search, User, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { apiFetch, setActiveBranchId } from "@/frontend/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { rxHeroHtml, rxDocument, rxEsc, rxBs, rxStatus, type RxCompany } from "@/frontend/components/ReportSheet";
import { pressKey, mouseOnly } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";
import { ExtractoPrintDialog } from "@/frontend/components/ExtractoPrintDialog";
import { sileo } from "@/frontend/lib/toast";

interface User { id: string; name: string; email: string; role: string; }
interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; priority: string; estimatedCost: number;
  notes: string | null; image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#b45309" },
  diagnosed: { label: "Diagnosticado", color: "#0e7490" },
  waiting_parts: { label: "Esperando Repuestos", color: "#c2410c" },
  in_progress: { label: "En Progreso", color: "#2563eb" },
  completed: { label: "Completado", color: "#047857" },
  delivered: { label: "Entregado", color: "#5a6a80" },
};

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const p = JSON.parse(img); if (Array.isArray(p)) return p.filter((u: unknown): u is string => typeof u === "string" && u.length > 0); } catch {}
  return img.trim().length > 0 ? [img] : [];
}

export default function ExtractoPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [extPage, setExtPage] = useState(1);
  const EXT_PAGE_SIZE = 10;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modal de detalle de cliente
  const [viewClient, setViewClient] = useState<{ name: string; phone: string; email: string; repairs: Repair[] } | null>(null);

  // Modal selector de cliente
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [settings, setSettings] = useState<RxCompany>({ companyName: "", logo: null });

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
    const userData = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    // Load branches for superadmin
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }

  }, [router]);

  // El servidor filtra y pagina: solo llegan las 10 órdenes de la página (antes se descargaban todas)
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ devices: 0, clients: 0, active: 0 });
  const [q, setQ] = useState(""); // búsqueda con una pequeña espera para no consultar en cada tecla
  useEffect(() => { const t = setTimeout(() => setQ(searchQuery.trim()), 300); return () => clearTimeout(t); }, [searchQuery]);

  const filterParams = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ sort: "old", ...extra });
    if (q) p.set("search", q);
    if (filterStatus === "active") p.set("status", "open");
    else if (filterStatus === "delivered") p.set("status", "delivered");
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    return p;
  };
  const loadPage = () => apiFetch(`/api/repairs?${filterParams({ page: String(extPage), limit: String(EXT_PAGE_SIZE), summary: "1" })}`)
    .then(res => res.ok ? res.json() : null)
    .then(d => {
      if (d && Array.isArray(d.repairs)) {
        if (d.repairs.length === 0 && d.total > 0 && extPage > 1) { setExtPage(d.totalPages); return; }
        setRepairs(d.repairs); setTotal(d.total || 0); if (d.summary) setSummary(d.summary);
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  useEffect(() => { if (user) loadPage(); }, [user, extPage, q, filterStatus, dateFrom, dateTo, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  // Se actualiza sola cuando otra PC cambia órdenes
  useLiveRefresh(["Repair"], () => loadPage(), { enabled: !!user });

  const extTotalPages = Math.ceil(total / EXT_PAGE_SIZE);
  const paginatedRepairs = repairs;
  const goExtPage = (p: number) => { setExtPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const totalDevices = summary.devices;
  const totalClients = summary.clients;
  const activeDevices = summary.active;

  // Selector de clientes: lo calcula el servidor (máx. 50, los que tienen más equipos primero)
  const [pickerClients, setPickerClients] = useState<{ name: string; phone: string; rawName: string; rawPhone: string; count: number; active: number }[]>([]);
  useEffect(() => {
    if (!showClientPicker) return;
    const t = setTimeout(() => {
      apiFetch(`/api/repairs/clients?q=${encodeURIComponent(clientSearch.trim())}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setPickerClients(d); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [showClientPicker, clientSearch, activeBranch]);
  const filteredPickerClients = pickerClients;

  const fetchClientRepairs = async (clientName: string, clientPhone?: string): Promise<Repair[]> => {
    const p = new URLSearchParams({ clientName, slim: "1", sort: "old" });
    if (clientPhone !== undefined) p.set("clientPhone", clientPhone);
    try { const r = await apiFetch(`/api/repairs?${p}`); const d = r.ok ? await r.json() : []; return Array.isArray(d) ? d : []; } catch { return []; }
  };
  const byCode = (a: Repair, b: Repair) => (parseInt(a.code.replace(/^OT-/i, ""), 10) || 0) - (parseInt(b.code.replace(/^OT-/i, ""), 10) || 0);

  // Ver detalle de un cliente (match by name + phone)
  const openClientDetail = async (clientName: string, clientPhone?: string) => {
    const clientRepairs = await fetchClientRepairs(clientName, clientPhone);
    if (clientRepairs.length === 0) return;
    setViewClient({
      name: clientRepairs[0].clientName || "Sin nombre",
      phone: clientRepairs.find(r => r.clientPhone)?.clientPhone || "",
      email: clientRepairs.find(r => r.clientEmail)?.clientEmail || "",
      repairs: clientRepairs.sort(byCode),
    });
  };

  // Sucursal activa (para el encabezado de los extractos)
  const branchName = (() => {
    if (activeBranch) { const b = branches.find(x => x.id === activeBranch); if (b) return b.name; }
    try { return (JSON.parse(sessionStorage.getItem("user") || "{}").branchName as string) || ""; } catch { return ""; }
  })();
  const nowLabels = () => {
    const d = new Date();
    return {
      today: d.toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" }),
      time: d.toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" }),
    };
  };
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const pill = (status: string) => { const st = rxStatus(status); return `<span class="rx-pill" style="background:${st.bg};color:${st.fg}">${rxEsc(st.label)}</span>`; };
  const devName = (r: Repair) => [r.device, r.brand, r.model].filter(Boolean).join(" ");

  // ═══ IMPRIMIR EXTRACTO DE UN CLIENTE ═══
  const printClientExtracto = async (clientName: string) => {
    // La ventana se abre antes de consultar: si se abre después, el navegador la bloquea
    const w = window.open("", "_blank");
    if (!w) { sileo.error({ title: "El navegador bloqueó la ventana", description: "Permite las ventanas emergentes de este sitio e intenta de nuevo" }); return; }
    w.document.write("<p style='font-family:sans-serif;padding:40px;color:#666'>Cargando extracto…</p>");
    const clientRepairs = (await fetchClientRepairs(clientName)).sort(byCode);
    if (clientRepairs.length === 0) { w.close(); return; }
    const client = clientRepairs[0];
    const { today, time } = nowLabels();
    const inShop = clientRepairs.filter(r => r.status !== "delivered").length;
    const total = clientRepairs.reduce((a, r) => a + (r.estimatedCost || 0), 0);
    const phone = clientRepairs.find(r => r.clientPhone)?.clientPhone;
    const email = clientRepairs.find(r => r.clientEmail)?.clientEmail;

    const rows = clientRepairs.map((r, idx) => `<tr>
        <td class="c muted">${idx + 1}</td>
        <td class="rx-code">${rxEsc(r.code)}</td>
        <td><b>${rxEsc(devName(r))}</b></td>
        <td class="muted">${rxEsc(r.issue)}</td>
        <td>${pill(r.status)}</td>
        <td>${shortDate(r.createdAt)}</td>
        <td class="n">${rxBs(r.estimatedCost, true)}</td>
      </tr>`).join("");

    const body = rxHeroHtml({ s: settings, branch: branchName, icon: "", label: "Extracto de cliente", title: today, sub: `Generado a las ${time}` })
      + `<div class="rx-client"><span class="rx-av"></span><div><b>${rxEsc(client.clientName || "—")}</b><small>${[phone && `${rxEsc(phone)}`, email && `${rxEsc(email)}`].filter(Boolean).join(" · ") || "Sin datos de contacto"}</small></div>`
      + `<div class="tot"><small>${clientRepairs.length} equipo${clientRepairs.length !== 1 ? "s" : ""} · ${inShop} en taller</small><b style="font-size:20px">${rxBs(total, true)}</b></div></div>`
      + `<div><div class="rx-sect">Equipos del cliente <em>${clientRepairs.length}</em></div>`
      + `<div class="rx-tw as-cards"><table class="rx-t"><thead><tr><th class="c">#</th><th>OT</th><th>Equipo</th><th>Problema</th><th>Estado</th><th>Fecha</th><th class="n">Costo</th></tr></thead>`
      + `<tbody>${rows}</tbody><tfoot><tr><td colspan="6">Total de los ${clientRepairs.length} equipos</td><td class="n">${rxBs(total, true)}</td></tr></tfoot></table></div></div>`
      + `<div class="rx-foot"><span>${rxEsc(settings.companyName)}${branchName ? ` · ${rxEsc(branchName)}` : ""}</span><span>Extracto de ${rxEsc(client.clientName || "cliente")} · ${rxEsc(today)}, ${rxEsc(time)}</span></div>`;

    w.document.open();
    w.document.write(rxDocument({ title: `Extracto — ${client.clientName || "cliente"}`, barTitle: `Extracto — ${client.clientName || "cliente"}`, body }));
    w.document.close();
  };

  // ═══ IMPRIMIR EXTRACTO GENERAL ═══
  // Abre una ventanita que cuenta equipos y hojas; la hoja se abre en /extracto/imprimir (dirección propia)
  const [showPrint, setShowPrint] = useState(false);
  const printExtractoGeneral = () => setShowPrint(true);

  if (!user) return <PageSkeleton />;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
<style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media (hover: hover) and (pointer: fine) { .row-hover:hover { background: rgba(99,102,241,0.03) !important; } }
      
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

      
      <AppSidebar user={user} />

      {/* ═══ MODAL: SELECCIONAR CLIENTE ═══ */}
      {showPrint && <ExtractoPrintDialog onClose={() => setShowPrint(false)} sucursal={user?.role === "superadmin" ? activeBranch : ""}
        actuales={{ q, estado: filterStatus === "active" ? "open" : filterStatus === "delivered" ? "delivered" : "", desde: dateFrom, hasta: dateTo }} />}
      {showClientPicker && (
        <div role="dialog" aria-modal="true" aria-label="Buscar cliente" data-esc onClick={() => { setShowClientPicker(false); setClientSearch(""); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeScale 0.3s ease-out", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}><User size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
                  <div><h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}><User size={14} strokeWidth={STROKE} aria-hidden="true" /> Buscar Cliente</h3><p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Selecciona para ver e imprimir su extracto</p></div>
                </div>
                <button onClick={() => { setShowClientPicker(false); setClientSearch(""); }} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
                <input aria-label="Buscar cliente" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." autoFocus style={{ flex: 1, border: "none", background: "none", padding: "11px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                {clientSearch && <span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Limpiar búsqueda" onClick={() => setClientSearch("")} style={{ cursor: "pointer", fontSize: 11, color: "var(--text-muted)" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span>}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
              {filteredPickerClients.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No se encontraron clientes</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(filteredPickerClients || []).map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer", transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }} onPointerEnter={mouseOnly((e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "rgba(16,185,129,0.06)"; })} onPointerLeave={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; })}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}><User size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.phone && `${c.phone} · `}{c.count} equipo{c.count > 1 ? "s" : ""}{c.active > 0 ? ` · ${c.active} en taller` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); openClientDetail(c.rawName, c.rawPhone); setShowClientPicker(false); setClientSearch(""); }} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Ver</button>
                        <button onClick={(e) => { e.stopPropagation(); printClientExtracto(c.rawName); setShowClientPicker(false); setClientSearch(""); }} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", color: "var(--ok)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: DETALLE DE CLIENTE ═══ */}
      {viewClient && (
        <div role="dialog" aria-modal="true" aria-label="Detalle del cliente" data-esc onClick={() => setViewClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 700, maxHeight: "85vh", background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeScale 0.3s ease-out", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(var(--accent-bright-rgb), 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><User size={22} strokeWidth={STROKE} aria-hidden="true" /></div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{viewClient.name}</h3>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-bright-rgb), 0.05)" }}>{viewClient.repairs.length} equipo{viewClient.repairs.length > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                      {viewClient.phone && <span>{viewClient.phone}</span>}
                      {viewClient.email && <span>{viewClient.email}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewClient(null)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
              </div>
              <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
                {[
                  { label: "Total", value: viewClient.repairs.length, color: "#0e7c86", bg: "rgba(26,184,196,0.05)" },
                  { label: "En taller", value: viewClient.repairs.filter(r => !["completed", "delivered"].includes(r.status)).length, color: "#b45309", bg: "rgba(245,158,11,0.06)" },
                  { label: "Completados", value: viewClient.repairs.filter(r => r.status === "completed").length, color: "#047857", bg: "rgba(16,185,129,0.06)" },
                  { label: "Entregados", value: viewClient.repairs.filter(r => r.status === "delivered").length, color: "#5a6a80", bg: "rgba(107,114,128,0.06)" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: s.bg, border: `1px solid ${s.color}15`, textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {viewClient.repairs.map((r, ri) => {
                  const st = STATUS[r.status] || { label: r.status, color: "#666" };
                  const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
                  const firstImage = parseImages(r.image)[0] || null;
                  const dateStr = new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });
                  return (
                    <div key={r.id} style={{ padding: "14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", animation: `fadeIn 0.25s ease-out ${ri * 0.04}s both` }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        {firstImage ? (
                          <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", border: `2px solid ${st.color}30`, flexShrink: 0 }}><img loading="lazy" decoding="async" src={firstImage} alt={r.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                        ) : (
                          <div style={{ width: 50, height: 50, borderRadius: 10, background: `${st.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `2px solid ${st.color}20`, flexShrink: 0 }}><Laptop size={20} strokeWidth={STROKE} aria-hidden="true" /></div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-bright-rgb), 0.05)", padding: "2px 8px", borderRadius: 6 }}>{r.code}</span>
                            <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}12`, border: `1px solid ${st.color}20` }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> {devName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}><Wrench size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.issue}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{dateStr}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Extracto general de equipos</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Listado completo de todos los equipos ordenados por OT</p>
        </div>

        {/* ═══ ESTADÍSTICAS ═══ */}
        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Clientes", value: totalClients, color: "#0e7c86", gradient: "" },
            { label: "Equipos Total", value: totalDevices, color: "#047857", gradient: "" },
            { label: "En Taller", value: activeDevices, color: "#b45309", gradient: "" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", position: "relative", overflow: "hidden", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both` }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 8 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ═══ FILTROS ═══ */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 340, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
            <input aria-label="Buscar orden" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setExtPage(1); }} placeholder="Buscar por OT, cliente, equipo..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
            {searchQuery && <span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Limpiar búsqueda" onClick={() => { setSearchQuery(""); setExtPage(1); }} style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "all", label: "Todos", color: "#0e7c86" },
              { key: "active", label: "En Taller", color: "#b45309" },
              { key: "delivered", label: "Entregados", color: "#5a6a80" },
            ].map(f => {
              const isActive = filterStatus === f.key;
              return (<button key={f.key} onClick={() => { setFilterStatus(f.key); setExtPage(1); }} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}>{f.label}</button>);
            })}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={() => setShowClientPicker(true)} style={{ padding: "10px 20px", background: "var(--ok)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)", display: "flex", alignItems: "center", gap: 6 }}>Buscar Cliente</button>
            <button onClick={printExtractoGeneral} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)", display: "flex", alignItems: "center", gap: 6 }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir Extracto</button>
          </div>
        </div>

        {/* ═══ RANGO DE FECHAS ═══ */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 12, padding: "8px 16px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Desde</span>
            <input aria-label="Desde" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setExtPage(1); }} style={{ padding: "6px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 12, padding: "8px 16px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Hasta</span>
            <input aria-label="Hasta" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setExtPage(1); }} style={{ padding: "6px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer" }} />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setExtPage(1); }} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>✕ Limpiar fechas</button>
          )}
          {(dateFrom || dateTo) && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {total} resultado{total !== 1 ? "s" : ""} en el rango
            </span>
          )}
        </div>

        {/* ═══ TABLA PLANA POR OT ═══ */}
        {loading ? (
          <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)" }}>
              <div className="skeleton" style={{ height: 12, width: "60%" }} />
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)", animation: `cardIn 0.3s ease-out ${i * 0.06}s both` }}>
                <div className="skeleton" style={{ width: 40, height: 14 }} />
                <div className="skeleton" style={{ width: 50, height: 14 }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ width: 80, height: 14 }} />
                <div className="skeleton" style={{ width: 60, height: 14 }} />
                <div className="skeleton" style={{ width: 70, height: 24, borderRadius: 12 }} />
                <div className="skeleton" style={{ width: 50, height: 14 }} />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><ChartColumn size={48} strokeWidth={1.5} aria-hidden="true" /></div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Sin resultados</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>No se encontraron equipos con los filtros actuales</p></div>
        ) : (
          <>
          {/* Celular: cada orden como tarjeta */}
          <div className="ext-cards">
            {(paginatedRepairs || []).map((r, idx) => {
              const st = STATUS[r.status] || { label: r.status, color: "#666" };
              return (
                <div role="button" tabIndex={0} onKeyDown={pressKey} key={r.id} onClick={() => openClientDetail(r.clientName || "", r.clientPhone || "")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>#{(extPage - 1) * EXT_PAGE_SIZE + idx + 1}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-bright-rgb), 0.08)", padding: "2px 8px", borderRadius: 6 }}>{r.code}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: st.color, background: `${st.color}14`, whiteSpace: "nowrap" }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> {[r.device, r.brand, r.model].filter(Boolean).join(" ")}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 3 }}><User size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.clientName || "—"}{r.clientPhone ? ` · ${r.clientPhone}` : ""}</div>
                  {r.issue && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.issue}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>{new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
                </div>
              );
            })}
          </div>
          <div className="ext-table" style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 50 }}>#</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>OT</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Equipo</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Cliente</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Celular</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Problema</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Estado</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(paginatedRepairs || []).map((r, idx) => {
                  const st = STATUS[r.status] || { label: r.status, color: "#666" };
                  const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
                  return (
                    <tr tabIndex={0} onKeyDown={pressKey} key={r.id} className="row-hover" style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s", cursor: "pointer" }} onClick={() => openClientDetail(r.clientName || "", r.clientPhone || "")}>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{(extPage - 1) * EXT_PAGE_SIZE + idx + 1}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-bright-rgb), 0.05)", padding: "3px 10px", borderRadius: 6 }}>{r.code}</span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>{devName}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>{r.clientName || "—"}</td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-muted)" }}>{r.clientPhone || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Wrench size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.issue}</div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}12`, border: `1px solid ${st.color}20` }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination */}
        {extTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={() => goExtPage(1)} disabled={extPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: extPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: extPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: extPage === 1 ? "default" : "pointer", opacity: extPage === 1 ? 0.5 : 1 }}>«</button>
            <button onClick={() => goExtPage(extPage - 1)} disabled={extPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: extPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: extPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: extPage === 1 ? "default" : "pointer", opacity: extPage === 1 ? 0.5 : 1 }}>‹</button>
            {Array.from({ length: extTotalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === extTotalPages || Math.abs(p - extPage) <= 2)
              .reduce((acc: (number | string)[], p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => typeof p === "string" ? (
                <span key={`d-${i}`} style={{ padding: "8px 6px", fontSize: 12, color: "var(--text-muted)" }}>...</span>
              ) : (
                <button key={p} onClick={() => goExtPage(p as number)} style={{ padding: "8px 14px", borderRadius: 8, border: p === extPage ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: p === extPage ? "rgba(var(--accent-bright-rgb), 0.08)" : "var(--bg-card)", color: p === extPage ? "var(--accent-dim)" : "var(--text-secondary)", fontSize: 12, fontWeight: p === extPage ? 800 : 600, cursor: "pointer", minWidth: 38 }}>{p}</button>
              ))}
            <button onClick={() => goExtPage(extPage + 1)} disabled={extPage === extTotalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: extPage === extTotalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: extPage === extTotalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: extPage === extTotalPages ? "default" : "pointer", opacity: extPage === extTotalPages ? 0.5 : 1 }}>›</button>
            <button onClick={() => goExtPage(extTotalPages)} disabled={extPage === extTotalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: extPage === extTotalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: extPage === extTotalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: extPage === extTotalPages ? "default" : "pointer", opacity: extPage === extTotalPages ? 0.5 : 1 }}>»</button>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Pág {extPage} de {extTotalPages} · {total} registros</span>
          </div>
        )}
      </div>
    </div>
  );
}
