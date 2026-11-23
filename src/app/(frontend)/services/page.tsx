"use client";
import { Pencil, Shapes, Trash2, Wrench } from "@/frontend/components/icons";
import { SERVICE_ICONS, ServiceIcon, STROKE } from "@/frontend/components/UiIcons";
import { PageHeader } from "@/frontend/components/PageHeader";
import { sileo } from "@/frontend/lib/toast";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { Pagination, usePaged } from "@/frontend/components/Pagination";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton, PageSkeleton } from "@/frontend/components/Skeletons";

interface Service { id: string; name: string; price: number; icon: string; active: boolean; createdAt: string; }

const ICON_OPTIONS = ["🔧", "🔍", "🧹", "💿", "🌡️", "💾", "🧠", "🖥️", "💧", "⌨️", "🔋", "📂", "🛠️", "⚡", "🖨️", "📡", "🔌", "💻", "📱", "🎮"];

export default function ServicesPage() {
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const paged = usePaged(services, 12, "");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("🔧");

  const loadServices = async () => {
    try { const res = await apiFetch("/api/services"); if (res.ok) setServices(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Service"], () => loadServices());

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    // Load branches for superadmin
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }

    loadServices();
  }, [router]);

  const resetForm = () => { setName(""); setPrice(""); setIcon("🔧"); setEditingId(null); setShowForm(false); };

  const saveService = async () => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    if (!name.trim() || !price.trim()) { sileo.error({ title: "Nombre y precio son requeridos" }); return; }
    try {
      if (editingId) {
        const res = await apiFetch("/api/services", { method: "PATCH", body: JSON.stringify({ id: editingId, name, price, icon }) });
        if (res.ok) { sileo.success({ title: "Servicio actualizado" }); resetForm(); loadServices(); }
      } else {
        const res = await apiFetch("/api/services", { method: "POST", body: JSON.stringify({ name, price, icon }) });
        if (res.ok) { sileo.success({ title: "Servicio creado" }); resetForm(); loadServices(); }
      }
    } catch { sileo.error({ title: "Error de conexión" }); }
  };

  const editService = (svc: Service) => {
    setEditingId(svc.id); setName(svc.name); setPrice(String(svc.price)); setIcon(svc.icon); setShowForm(true);
  };

  const deleteService = async (id: string) => {
    if (!await askConfirm("¿Eliminar este servicio?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const res = await apiFetch("/api/services", { method: "DELETE", body: JSON.stringify({ id }) });
      if (res.ok) { sileo.success({ title: "Servicio eliminado" }); loadServices(); }
    } catch {}
  };


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


      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <PageHeader title="Servicios" subtitle="Aparecen automáticamente al registrar y entregar órdenes"><button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>＋ Nuevo Servicio</button></PageHeader>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 300px))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Servicios", value: services.length, color: "var(--accent)" },

          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Wrench size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? "Editar servicio" : "Nuevo servicio"}
            subtitle="Aparece al crear órdenes y suma al costo"
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveService}>{editingId ? "Guardar cambios" : "Crear servicio"}</SaveButton>
            </>}>
            <FormSection icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Servicio">
              <div className="ox-row">
                <Field label="Nombre del servicio" required><input className="ox-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mantenimiento general" autoFocus /></Field>
                <Field label="Precio (Bs.)" required><input className="ox-input tabular" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" type="number" min="0" inputMode="decimal" /></Field>
              </div>
            </FormSection>
            <FormSection icon={<Shapes size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Ícono" hint="Se ve en la orden y en el recibo">
              <div className="ox-chips" role="group" aria-label="Ícono">
                {ICON_OPTIONS.map(ic => <button key={ic} type="button" className="ox-chip" aria-pressed={icon === ic} aria-label={`Ícono: ${SERVICE_ICONS.find(([k]) => k === ic)?.[2] || ic}`} onClick={() => setIcon(ic)} style={{ minWidth: 48, justifyContent: "center", padding: 0 }}><span className="e" aria-hidden="true"><ServiceIcon icon={ic} size={20} /></span></button>)}
              </div>
              <div className="ox-note info" style={{ marginTop: 12 }}>Así se verá: <b><ServiceIcon icon={icon} size={14} /> {name || "Nombre del servicio"}</b>{price && <span className="tabular"> · Bs. {price}</span>}</div>
            </FormSection>
          </FormModal>
        )}

        {loading ? (
          <ListSkeleton />
        ) : services.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Wrench size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay servicios</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Crea tu primer servicio para el catálogo</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Crear Servicio</button>
          </div>
        ) : (
          <><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {paged.items.map((svc, i) => (
              <div key={svc.id} style={{ padding: 20, background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(var(--accent-rgb), 0.1)", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, display: "flex", flexDirection: "column", gap: 12, transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(var(--accent-rgb), 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ServiceIcon icon={svc.icon} size={22} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svc.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>Bs. {svc.price}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => editService(svc)} style={{ flex: 1, padding: "9px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", borderRadius: 10, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /> Editar</button>
                  <button onClick={() => deleteService(svc.id)} style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, color: "var(--danger-bright)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Eliminar</button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></>
        )}
      </div>
    </div>
  );
}