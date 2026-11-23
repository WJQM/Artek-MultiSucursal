"use client";
import { Smartphone, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { Pagination } from "@/frontend/components/Pagination";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";

interface Client {
  phoneKey: string; phone: string; name: string; email: string | null;
  totalRepairs: number; totalSpent: number; totalQuotations: number; totalSales: number;
  lastActivity: string; firstActivity: string;
  repairs: { code: string; device: string; status: string; createdAt: string; cost: number }[];
  quotations: { code: string; type: string; total: number; createdAt: string }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#b45309" },
  diagnosed: { label: "Diagnosticado", color: "#0e7490" },
  waiting_parts: { label: "Esperando", color: "#c2410c" },
  in_progress: { label: "En progreso", color: "#2563eb" },
  completed: { label: "Completado", color: "#047857" },
  delivered: { label: "Entregado", color: "#5a6a80" },
};

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(userData); } catch { return null; } })(); setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    if (u.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(u.branchId || ""); }
  }, [router]);

  // El servidor busca y pagina (15 por página); antes se descargaban todos los clientes
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (q) p.set("q", q);
      const res = await apiFetch(`/api/clients?${p}`);
      if (res.ok) { const d = await res.json(); setClients(d.clients || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1); }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { if (user) void load(); }, [user, page, q, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- se recarga solo cuando cambia lo indicado
  // Historial del cliente: se pide al abrirlo
  const openClient = async (c: Client) => {
    setSelected(c);
    try {
      const res = await apiFetch(`/api/clients?phone=${encodeURIComponent(c.phoneKey)}`);
      if (res.ok) { const d = await res.json(); const full = d.clients?.[0]; if (full) setSelected(cur => cur && cur.phoneKey === c.phoneKey ? full : cur); }
    } catch {}
  };
  // Se actualiza sola (sin pantalla de carga) cuando otra PC cambia estos datos
  useLiveRefresh(["Repair", "Quotation"], () => load(true));

  const fmtBs = (n: number) => `Bs. ${(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });

  const goTo = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
      `}</style>

      <AppSidebar user={user} />

      <div className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Clientes frecuentes</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{total} clientes registrados con historial de compras y reparaciones</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input aria-label="Buscar cliente" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o email..." style={{ width: "100%", maxWidth: 400, padding: "10px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13 }} />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>Cargando clientes...</div>
        ) : clients.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>
            {search ? "No hay clientes que coincidan con tu búsqueda" : "Aún no hay clientes registrados. Los clientes aparecen automáticamente al crear OTs o Cotizaciones con número de teléfono."}
          </div>
        ) : (
          <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {clients.map((c) => {
              const isVip = c.totalSpent >= 1000 || c.totalRepairs >= 5;
              return (
                <button key={c.phoneKey} onClick={() => openClient(c)} style={{ textAlign: "left", padding: 16, background: "var(--bg-card)", border: `1px solid ${isVip ? "rgba(245,158,11,0.3)" : "var(--border)"}`, borderRadius: 14, cursor: "pointer", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: isVip ? "linear-gradient(135deg,var(--warn-bright),var(--warn-bright))" : "linear-gradient(135deg,var(--accent),var(--accent-light))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {c.name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {c.name}
                        {isVip && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "var(--warn)", fontWeight: 700 }}>★ VIP</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: "monospace" }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> {c.phone}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                    <div><div style={{ color: "var(--text-muted)" }}>Total gastado</div><div style={{ fontWeight: 700, color: "var(--ok)", fontSize: 13 }}>{fmtBs(c.totalSpent)}</div></div>
                    <div><div style={{ color: "var(--text-muted)" }}>OTs</div><div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>{c.totalRepairs}</div></div>
                    <div><div style={{ color: "var(--text-muted)" }}>Ventas / COT</div><div style={{ fontWeight: 700, color: "var(--info)", fontSize: 12 }}>{c.totalSales} / {c.totalQuotations}</div></div>
                    <div><div style={{ color: "var(--text-muted)" }}>Última visita</div><div style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 11 }}>{fmtDate(c.lastActivity)}</div></div>
                  </div>
                </button>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={goTo} /></>
        )}
      </div>

      {/* MODAL DETALLE */}
      {selected && (
        <div role="dialog" aria-modal="true" aria-label="Detalle del cliente" data-esc onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(26,29,46,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, maxHeight: "85vh", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700 }}>{selected.name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</h3>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> {selected.phone}{selected.email && ` · ${selected.email}`}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div style={{ padding: 22, overflow: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
                <div style={{ padding: 10, background: "rgba(var(--accent-bright-rgb), 0.05)", borderRadius: 8, textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{selected.totalRepairs}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>OTs</div></div>
                <div style={{ padding: 10, background: "rgba(245,158,11,0.08)", borderRadius: 8, textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "var(--warn)" }}>{selected.totalQuotations}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>COT</div></div>
                <div style={{ padding: 10, background: "rgba(37,99,235,0.08)", borderRadius: 8, textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "var(--info)" }}>{selected.totalSales}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ventas</div></div>
                <div style={{ padding: 10, background: "rgba(16,185,129,0.08)", borderRadius: 8, textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>{fmtBs(selected.totalSpent)}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Gastado</div></div>
              </div>
              {selected.repairs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Últimas reparaciones</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selected.repairs.map(r => {
                      const st = STATUS_LABELS[r.status] || { label: r.status, color: "#5a6a80" };
                      return (
                        <div key={r.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-tertiary)", borderRadius: 8 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{r.code}</span>
                          <span style={{ flex: 1, fontSize: 11 }}>{r.device}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${st.color}15`, color: st.color, fontWeight: 700 }}>{st.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)" }}>{fmtBs(r.cost)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {selected.quotations.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Cotizaciones y ventas</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selected.quotations.map(q => (
                      <div key={q.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-tertiary)", borderRadius: 8 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: q.type === "sale" ? "var(--info-bright)" : "var(--warn-bright)" }}>{q.code}</span>
                        <span style={{ flex: 1, fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(q.createdAt)}</span>
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: q.type === "sale" ? "rgba(37,99,235,0.1)" : "rgba(245,158,11,0.1)", color: q.type === "sale" ? "var(--info-bright)" : "var(--warn-bright)", fontWeight: 700 }}>{q.type === "sale" ? "VENTA" : "COT"}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: q.type === "sale" ? "var(--info-bright)" : "var(--text-primary)" }}>{fmtBs(q.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
