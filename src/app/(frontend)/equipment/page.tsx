"use client";
import { Backpack, Banknote, Camera, Cpu, FileText, Laptop, Monitor, Pencil, Printer, Search, Tag, Trash2, X } from "@/frontend/components/icons";
import { STROKE, StatusDot } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { Pagination, usePaged, useCatalogGrid, byName } from "@/frontend/components/Pagination";
import { CatalogSkeleton } from "@/frontend/components/CatalogSkeleton";
import { PortalToggle, HiddenBadge, togglePortalVisibility } from "@/frontend/components/PortalToggle";
import { resumenEquipo } from "@/shared/resumen-equipo";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, FormPhotos, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";

interface Equipment { showInPortal?: boolean; id: string; code: string; name: string; type: string; brand: string | null; model: string | null; processor: string | null; ram: string | null; storage: string | null; storage2: string | null; screenSize: string | null; graphicsCard: string | null; os: string | null; cabinet: string | null; powerSupply: string | null; motherboard: string | null; accessories: string | null; condition: string; price: number; notes: string | null; image: string | null; createdAt: string; }

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr; } catch {}
  return img.trim() ? [img] : [];
}

const CONDITIONS = [
  { value: "disponible", label: "Disponible", color: "#047857" },
  { value: "vendido", label: "Vendido", color: "#0e7c86" },
  { value: "en_reparacion", label: "En reparación", color: "#b45309" },
];

function getDisplayName(eq: Equipment): string {
  if (eq.type === "desktop") {
    const cab = (eq.cabinet || "").trim();
    return cab ? `PC Escritorio ${cab}` : "PC Escritorio";
  }
  return ["Laptop", eq.brand, eq.model].filter(Boolean).join(" ");
}

export default function EquipmentPage() {
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields (no name - auto generated)
  const [type, setType] = useState<"laptop" | "desktop">("laptop");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [processor, setProcessor] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [storage2, setStorage2] = useState("");
  const [screenSize, setScreenSize] = useState("");
  const [graphicsCard, setGraphicsCard] = useState("");
  const [os, setOs] = useState("");
  const [cabinet, setCabinet] = useState("");
  const [powerSupply, setPowerSupply] = useState("");
  const [motherboard, setMotherboard] = useState("");
  const [accessories, setAccessories] = useState("");
  const [condition, setCondition] = useState("disponible");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "laptop" | "desktop">("all");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<Equipment | null>(null);

  const loadItems = async () => {
    try { const res = await apiFetch("/api/equipment"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Equipment"], () => loadItems());

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }
    loadItems();

    const savedForm = sessionStorage.getItem("equipmentFormData");
    if (savedForm) {
      try {
        const data = (() => { try { return JSON.parse(savedForm); } catch { return null; } })();
        setEditingId(data.editingId || null); setType(data.type || "laptop");
        setBrand(data.brand || ""); setModel(data.model || ""); setProcessor(data.processor || "");
        setRam(data.ram || ""); setStorage(data.storage || ""); setStorage2(data.storage2 || "");
        setScreenSize(data.screenSize || ""); setGraphicsCard(data.graphicsCard || ""); setOs(data.os || "");
        setCabinet(data.cabinet || ""); setPowerSupply(data.powerSupply || ""); setMotherboard(data.motherboard || ""); setAccessories(data.accessories || "");
        setCondition(data.condition || "disponible"); setPrice(data.price || ""); setNotes(data.notes || "");
        setImageUrls(data.imageUrls || []); setImagePreviews(data.imagePreviews || []);
        setShowForm(true);
      } catch {}
      sessionStorage.removeItem("equipmentFormData");
    }

    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) {
      try {
        const { url, preview } = (() => { try { return JSON.parse(capturedData); } catch { return {}; } })();
        setImageUrls(prev => [...prev, url]); setImagePreviews(prev => [...prev, preview]);
        setShowForm(true);
        setTimeout(() => sileo.success({ title: "Foto capturada" }), 500);
      } catch {}
      sessionStorage.removeItem("capturedImage");
    }
  }, [router]);

  const resetForm = () => {
    setType("laptop"); setBrand(""); setModel(""); setProcessor("");
    setRam(""); setStorage(""); setStorage2(""); setScreenSize(""); setGraphicsCard(""); setOs("");
    setCabinet(""); setPowerSupply(""); setMotherboard(""); setAccessories("");
    setCondition("disponible"); setPrice(""); setNotes("");
    setImageUrls([]); setImagePreviews([]); setEditingId(null); setShowForm(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
      const formData = new FormData(); formData.append("file", file);
      try { const res = await apiFetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setImageUrls(prev => [...prev, data.url]); } } catch {}
    }
    sileo.success({ title: `${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}` });
    setUploading(false); e.target.value = "";
  };

  const handleTakePhoto = () => {
    sessionStorage.setItem("equipmentFormData", JSON.stringify({ editingId, type, brand, model, processor, ram, storage, storage2, screenSize, graphicsCard, os, cabinet, powerSupply, motherboard, accessories, condition, price, notes, imageUrls, imagePreviews }));
    sessionStorage.setItem("cameraReturnUrl", "/equipment");
    window.location.href = "/camera.html";
  };

  const removeImage = (idx: number) => { setImageUrls(prev => prev.filter((_, i) => i !== idx)); setImagePreviews(prev => prev.filter((_, i) => i !== idx)); };

  const saveItem = async () => {
    if (type === "laptop" && !brand.trim() && !model.trim()) { sileo.error({ title: "Ingresa al menos la marca o modelo" }); return; }
    if (type === "desktop" && !cabinet.trim()) { sileo.error({ title: "Ingresa al menos el gabinete" }); return; }
    const imageData = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] || null;
    try {
      if (editingId) {
        const res = await apiFetch("/api/equipment", { method: "PATCH", body: JSON.stringify({ id: editingId, type, brand, model, processor, ram, storage, storage2, screenSize, graphicsCard, os, cabinet, powerSupply, motherboard, accessories, condition, price, notes, image: imageData }) });
        if (res.ok) { sileo.success({ title: "Equipo actualizado" }); resetForm(); loadItems(); }
      } else {
        const res = await apiFetch("/api/equipment", { method: "POST", body: JSON.stringify({ type, brand, model, processor, ram, storage, storage2, screenSize, graphicsCard, os, cabinet, powerSupply, motherboard, accessories, condition, price, notes, image: imageData }) });
        if (res.ok) { sileo.success({ title: "Equipo agregado" }); resetForm(); loadItems(); }
      }
    } catch { sileo.error({ title: "Error de conexión" }); }
  };

  const editItem = (item: Equipment) => {
    setEditingId(item.id); setType(item.type as "laptop" | "desktop");
    setBrand(item.brand || ""); setModel(item.model || ""); setProcessor(item.processor || "");
    setRam(item.ram || ""); setStorage(item.storage || ""); setStorage2(item.storage2 || "");
    setScreenSize(item.screenSize || ""); setGraphicsCard(item.graphicsCard || ""); setOs(item.os || "");
    setCabinet(item.cabinet || ""); setPowerSupply(item.powerSupply || ""); setMotherboard(item.motherboard || ""); setAccessories(item.accessories || "");
    setCondition(item.condition); setPrice(String(item.price)); setNotes(item.notes || "");
    const imgs = parseImages(item.image);
    setImageUrls(imgs); setImagePreviews(imgs);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!await askConfirm("¿Eliminar este equipo?")) return;
    try { const res = await apiFetch("/api/equipment", { method: "DELETE", body: JSON.stringify({ id }) }); if (res.ok) { sileo.success({ title: "Eliminado" }); loadItems(); setViewDetail(null); } } catch {}
  };

  const filteredItems = items.filter(item => {
    const matchSearch = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.brand || "").toLowerCase().includes(searchQuery.toLowerCase()) || (item.model || "").toLowerCase().includes(searchQuery.toLowerCase()) || (item.processor || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === "all" || item.type === filterType;
    const matchCondition = filterCondition === "all" || item.condition === filterCondition;
    return matchSearch && matchType && matchCondition;
  }).sort((a, b) => byName(getDisplayName(a), getDisplayName(b)));
  const { gridProps, pageSize } = useCatalogGrid();
  const paged = usePaged(filteredItems, pageSize, `${searchQuery}|${filterType}|${filterCondition}`);

  const stats = {
    total: items.length,
    laptops: items.filter(i => i.type === "laptop").length,
    desktops: items.filter(i => i.type === "desktop").length,
    disponibles: items.filter(i => i.condition === "disponible").length,
  };

  const getCondition = (c: string) => CONDITIONS.find(x => x.value === c) || CONDITIONS[0];

  // Preview name in form
  const previewName = type === "desktop"
    ? (cabinet.trim() ? `PC Escritorio ${cabinet.trim()}` : "")
    : [brand, model].filter(Boolean).join(" ") ? `Laptop ${[brand, model].filter(Boolean).join(" ")}` : "";

  if (!user) return <PageSkeleton />;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
      {viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Equipo" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)" }} />
            <button onClick={() => setViewImage(null)} style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        .sidebar-group-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 14px;border-radius:10px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition: 0.15s; transition-property: var(--tr-ui);text-align:left;margin-top:4px}
        @media (hover: hover) and (pointer: fine) { .sidebar-group-btn:hover{filter:brightness(1.2)} }
        .group-arrow{font-size: 11px;transition:transform 0.2s}
        .sidebar-group-btn.open .group-arrow{transform:rotate(180deg)}
        .sidebar-sub-list{max-height:0;overflow:hidden;transition:max-height 0.25s ease-out}
        .sidebar-sub-list.open{max-height:300px}
        .sidebar-sub{padding-left:18px!important;font-size:11px!important}
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .eq-grid{grid-template-columns:repeat(auto-fill, minmax(220px, 1fr))!important}
          .filter-row{flex-direction:column!important;align-items:stretch!important}
          .filter-row .filter-left{flex-direction:column!important}
          .filter-row .search-box{max-width:100%!important}
        }
        @media(max-width:640px){
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .eq-grid{grid-template-columns:1fr!important}
          .form-grid{grid-template-columns:1fr!important}
          .filter-btns{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important}
        }
      `}</style>

      <AppSidebar user={user} />

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Equipos para la venta</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Laptops y equipos de escritorio — cada equipo es único, sin stock</p>
        </div>

        {/* Stats */}
        <div className="stats-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Equipos", value: stats.total, color: "#2563eb" },
            { label: "Laptops", value: stats.laptops, color: "#1d4ed8" },
            { label: "Escritorio", value: stats.desktops, color: "#0e7490" },
            { label: "Disponibles", value: stats.disponibles, color: "#047857" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div className="filter-left" style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
            <div className="search-box" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)", flex: 1, maxWidth: 300 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
              <input aria-label="Buscar equipo" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar marca, modelo, procesador..." style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([{ key: "all", label: "Todos" }, { key: "laptop", label: "Laptops" }, { key: "desktop", label: "Escritorio" }] as const).map(f => {
                const isActive = filterType === f.key;
                return (<button key={f.key} onClick={() => setFilterType(f.key)} style={{ padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: isActive ? "rgba(var(--accent-bright-rgb), 0.07)" : "var(--bg-card)", border: isActive ? "1.5px solid rgba(var(--accent-bright-rgb), 0.25)" : "1.5px solid var(--border)", color: isActive ? "var(--accent-dim)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{f.label}</button>);
              })}
            </div>
            <select aria-label="Filtrar por estado" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todos los estados</option>
              {(CONDITIONS || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.open("/equipment/print", "_blank")} style={{ padding: "10px 16px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 12, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Extracto</button>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--info-bright)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>＋ Nuevo Equipo</button>
          </div>
        </div>

        {/* ═══ FORM MODAL ═══ */}
        {showForm && (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Laptop size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? "Editar equipo" : "Nuevo equipo en venta"}
            subtitle={previewName ? `→ ${previewName}` : "Laptops y PCs armadas para vender"}
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveItem} disabled={uploading}>{editingId ? "Guardar cambios" : "Agregar equipo"}</SaveButton>
            </>}>
            <FormSection icon={<Tag size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Tipo y estado">
              <div className="ox-chips" role="group" aria-label="Tipo" style={{ marginBottom: 12 }}>
                <button type="button" className="ox-chip" aria-pressed={type === "laptop"} onClick={() => setType("laptop")}><span className="e" aria-hidden="true"><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Laptop</button>
                <button type="button" className="ox-chip" aria-pressed={type === "desktop"} onClick={() => setType("desktop")}><span className="e" aria-hidden="true"><Monitor size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Escritorio</button>
              </div>
              <div className="ox-chips" role="group" aria-label="Estado">
                {CONDITIONS.map(c => <button key={c.value} type="button" className="ox-chip" aria-pressed={condition === c.value} onClick={() => setCondition(c.value)}><span className="e" aria-hidden="true"><StatusDot color={c.color} /></span>{c.label}</button>)}
              </div>
              {type === "laptop" && (
                <div className="ox-row" style={{ marginTop: 12 }}>
                  <Field label="Marca" required><input className="ox-input" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
                  <Field label="Modelo" required><input className="ox-input" value={model} onChange={(e) => setModel(e.target.value)} /></Field>
                </div>
              )}
            </FormSection>

            <FormSection icon={<Cpu size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Especificaciones">
              <div className="ox-row">
                <Field label="Procesador"><input className="ox-input" value={processor} onChange={(e) => setProcessor(e.target.value)} /></Field>
                <Field label="Memoria RAM"><input className="ox-input" value={ram} onChange={(e) => setRam(e.target.value)} /></Field>
                <Field label="Disco 1"><input className="ox-input" value={storage} onChange={(e) => setStorage(e.target.value)} /></Field>
                <Field label="Disco 2"><input className="ox-input" value={storage2} onChange={(e) => setStorage2(e.target.value)} /></Field>
                <Field label="Tarjeta gráfica"><input className="ox-input" value={graphicsCard} onChange={(e) => setGraphicsCard(e.target.value)} /></Field>
                {type === "laptop" && <Field label="Pantalla"><input className="ox-input" value={screenSize} onChange={(e) => setScreenSize(e.target.value)} placeholder='Ej: 15.6" FHD IPS' /></Field>}
                <Field label="Sistema operativo"><input className="ox-input" value={os} onChange={(e) => setOs(e.target.value)} /></Field>
                {type === "desktop" && <>
                  <Field label="Gabinete" required><input className="ox-input" value={cabinet} onChange={(e) => setCabinet(e.target.value)} /></Field>
                  <Field label="Placa madre"><input className="ox-input" value={motherboard} onChange={(e) => setMotherboard(e.target.value)} /></Field>
                  <Field label="Fuente de poder"><input className="ox-input" value={powerSupply} onChange={(e) => setPowerSupply(e.target.value)} /></Field>
                </>}
              </div>
            </FormSection>

            <FormSection icon={<Camera size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Fotos">
              <FormPhotos previews={imagePreviews} onRemove={removeImage} onCamera={handleTakePhoto} inputRef={fileInputRef} onSelect={handleImageSelect} uploading={uploading} />
            </FormSection>

            <FormSection icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Precio y detalles">
              <div className="ox-row">
                <Field label="Precio (Bs.)"><input className="ox-input tabular" value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" inputMode="decimal" /></Field>
                <Field label="Accesorios que incluye"><input className="ox-input" value={accessories} onChange={(e) => setAccessories(e.target.value)} /></Field>
              </div>
              <Field label="Notas" style={{ marginTop: 12 }}><textarea className="ox-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
            </FormSection>
          </FormModal>
        )}

        {/* ═══ DETAIL MODAL ═══ */}
        {viewDetail && (() => {
          const eq = viewDetail;
          const cond = getCondition(eq.condition);
          const imgs = parseImages(eq.image);
          const dName = getDisplayName(eq);
          return (
            <div role="dialog" aria-modal="true" aria-label="Detalle del equipo" data-esc style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
              <div style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeScale 0.3s ease-out" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>{eq.type === "laptop" ? <Laptop size={15} strokeWidth={STROKE} aria-hidden="true" /> : <Monitor size={15} strokeWidth={STROKE} aria-hidden="true" />} {dName}</h3>
                    {eq.code && <span style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", padding: "3px 10px", borderRadius: 6, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", fontFamily: "monospace", letterSpacing: "0.3px" }}>{eq.code}</span>}
                  </div>
                  <button onClick={() => setViewDetail(null)} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>
                {imgs.length > 0 && (
                  <div style={{ display: "flex", gap: 8, padding: "16px 20px", overflowX: "auto" }}>
                    {(imgs || []).map((img, idx) => (<img loading="lazy" decoding="async" role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" key={idx} src={img} alt="" onClick={() => setViewImage(img)} style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 10, cursor: "pointer", border: "2px solid var(--border)", flexShrink: 0 }} />))}
                  </div>
                )}
                <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: eq.type === "laptop" ? "rgba(37,99,235,0.1)" : "rgba(6,182,212,0.1)", color: eq.type === "laptop" ? "var(--info-bright)" : "#0891b2" }}>{eq.type === "laptop" ? "Laptop" : "Escritorio"}</span>
                    <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${cond.color}15`, color: cond.color }}>{cond.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ok)" }}>Bs. {Math.round(eq.price || 0).toLocaleString()}</div>

                  <div style={{ padding: "12px 14px", background: "var(--bg-tertiary)", borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {eq.processor && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>CPU:</span> <span style={{ fontWeight: 600 }}>{eq.processor}</span></div>}
                    {eq.ram && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>RAM:</span> <span style={{ fontWeight: 600 }}>{eq.ram}</span></div>}
                    {eq.storage && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Disco 1:</span> <span style={{ fontWeight: 600 }}>{eq.storage}</span></div>}
                    {eq.storage2 && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Disco 2:</span> <span style={{ fontWeight: 600 }}>{eq.storage2}</span></div>}
                    {eq.graphicsCard && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>GPU:</span> <span style={{ fontWeight: 600 }}>{eq.graphicsCard}</span></div>}
                    {eq.screenSize && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Pantalla:</span> <span style={{ fontWeight: 600 }}>{eq.screenSize}</span></div>}
                    {eq.os && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>SO:</span> <span style={{ fontWeight: 600 }}>{eq.os}</span></div>}
                    {eq.cabinet && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Gabinete:</span> <span style={{ fontWeight: 600 }}>{eq.cabinet}</span></div>}
                    {eq.motherboard && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Placa madre:</span> <span style={{ fontWeight: 600 }}>{eq.motherboard}</span></div>}
                    {eq.powerSupply && <div style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>Fuente:</span> <span style={{ fontWeight: 600 }}>{eq.powerSupply}</span></div>}
                  </div>
                  {eq.accessories && <div style={{ padding: "10px 14px", background: "rgba(71,85,105,0.05)", borderRadius: 10, border: "1px solid rgba(71,85,105,0.1)", fontSize: 12, color: "var(--text-secondary)" }}><Backpack size={14} strokeWidth={STROKE} aria-hidden="true" /> <strong>Accesorios:</strong> {eq.accessories}</div>}
                  {eq.notes && <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.05)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.1)", fontSize: 12, color: "var(--text-secondary)" }}><FileText size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.notes}</div>}
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Registrado: {new Date(eq.createdAt).toLocaleDateString("es-BO")}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { editItem(eq); setViewDetail(null); }} style={{ flex: "1 1 90px", padding: "10px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 10, color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
                    <button onClick={() => { window.open(`/equipment/print/${eq.id}`, "_blank"); }} style={{ flex: "1 1 110px", padding: "10px", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, color: "#0e7490", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Ficha</button>
                    <button onClick={() => { window.open(`/equipment/print/${eq.id}?mode=sticker`, "_blank"); }} style={{ flex: "1 1 110px", padding: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Solo QR</button>
                    <button onClick={() => deleteItem(eq.id)} style={{ padding: "10px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "var(--danger-bright)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Eliminar</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ EQUIPMENT GRID ═══ */}
        {loading ? (
          <CatalogSkeleton />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Laptop size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay equipos registrados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Agrega tu primer equipo de cómputo</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--info-bright)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar</button>
          </div>
        ) : (
          <><div {...gridProps}>
            {paged.items.map((item, i) => {
              const imgs = parseImages(item.image);
              const firstImg = imgs[0] || null;
              const cond = getCondition(item.condition);
              const dName = getDisplayName(item);
              return (
                <div tabIndex={0} onKeyDown={pressKey} key={item.id} onClick={() => setViewDetail(item)} style={{ display: "flex", flexDirection: "column", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, cursor: "pointer", transitionProperty: "var(--tr-ui)", transitionDuration: "0.25s", position: "relative" }}>
                  <div className="cat-badges">
                    <div className="cat-badges-row">
                      <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${cond.color}20`, color: cond.color }}>{cond.label}</div>
                      <div style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, background: item.type === "laptop" ? "rgba(37,99,235,0.85)" : "rgba(6,182,212,0.85)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.type === "laptop" ? "Laptop" : "Desktop"}</div>
                      {imgs.length > 1 && <div style={{ padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}
                    </div>
                    {item.showInPortal === false && <HiddenBadge inline />}
                  </div>
                  <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className={firstImg ? "cat-img" : "cat-img cat-noimg"} onClick={(e) => { e.stopPropagation(); if (firstImg) setViewImage(firstImg); }} style={{ width: "100%", aspectRatio: "1/1", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                    {firstImg ? (<img loading="lazy" decoding="async" src={firstImg} alt={dName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 48, opacity: 0.15 }}>{item.type === "laptop" ? <Laptop size={48} strokeWidth={1.5} aria-hidden="true" /> : <Monitor size={48} strokeWidth={1.5} aria-hidden="true" />}</span><span className="cat-noimg-txt" style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>Sin imagen</span></div>)}
                    <div className="cat-pricebar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 14px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Bs. {Math.round(item.price || 0).toLocaleString()}</div></div>
                  </div>
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    {item.code && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", padding: "2px 8px", borderRadius: 6, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", fontFamily: "monospace", letterSpacing: "0.3px" }}>{item.code}</span></div>}
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.3 }}>{dName}</h3>
                    
                    {/* Specs badges */}
                    {/* Resumen en dos líneas (el detalle completo está en "Ver" y en la ficha) */}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={resumenEquipo(item)}>{resumenEquipo(item) || "Sin especificaciones"}</div>
                    {(() => { const extra = [item.os, item.type === "laptop" ? item.screenSize : item.cabinet].filter(Boolean).join(" · "); return extra ? <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={extra}>{extra}</div> : null; })()}

                    <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 12 }}>
                      <button onClick={(e) => { e.stopPropagation(); editItem(item); }} style={{ flex: 1, padding: "8px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", borderRadius: 8, color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
                      <PortalToggle visible={item.showInPortal !== false} onToggle={() => togglePortalVisibility(item, "/api/equipment", setItems, apiFetch, sileo)} />
                      <button onClick={(e) => { e.stopPropagation(); window.open(`/equipment/print/${item.id}`, "_blank"); }} title="Ficha técnica" style={{ padding: "8px 10px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 8, color: "#0e7490", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} style={{ padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></>
        )}
      </div>
    </div>
  );
}

