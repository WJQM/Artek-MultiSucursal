"use client";
import { Camera, Disc3, FileText, Gamepad2, HardDrive, Pencil, Search, Tag, Trash2, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { PageHeader } from "@/frontend/components/PageHeader";
import { sileo } from "@/frontend/lib/toast";
import { Pagination, usePaged, useCatalogGrid, byName } from "@/frontend/components/Pagination";
import { CatalogSkeleton } from "@/frontend/components/CatalogSkeleton";
import { PortalToggle, HiddenBadge, togglePortalVisibility } from "@/frontend/components/PortalToggle";
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

interface SoftwareItem { showInPortal?: boolean; price?: number | null;
  id: string;
  name: string;
  category: string | null;
  size: string | null;
  description: string | null;
  language: string | null;
  rating: string | null;
  minRequirements: string | null;
  recRequirements: string | null;
  image: string | null;
  active: boolean;
}

const INITIAL_CATEGORIES = ["Programas", "Sistemas Operativos", "Drivers", "Utilidades", "Office", "Diseño", "Antivirus"];
const RATINGS = ["", "PEGI 3", "PEGI 7", "PEGI 12", "PEGI 16", "PEGI 18", "ESRB E", "ESRB E10+", "ESRB T", "ESRB M", "ESRB AO"];

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr; } catch {}
  return img.trim() ? [img] : [];
}

export default function SoftwarePage() {
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [items, setItems] = useState<SoftwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [rating, setRating] = useState("");
  const [price, setPrice] = useState("");
  const [minRequirements, setMinRequirements] = useState("");
  const [recRequirements, setRecRequirements] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    try { const res = await apiFetch("/api/software"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Software"], () => loadItems());

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    // Load branches for superadmin
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }

    loadItems();
    apiFetch("/api/software/categories")
      .then(r => r.json())
      .then(d => {
        if (d.categories?.length) {
          setCategories(d.categories);
        } else {
          const saved = sessionStorage.getItem("softwareCategories");
          if (saved) try {
            const cats = JSON.parse(saved);
            if (Array.isArray(cats) && cats.length > 0) {
              setCategories(cats);
              apiFetch("/api/software/categories", {
                method: "POST",
                body: JSON.stringify({ categories: cats }),
              }).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {
        const saved = sessionStorage.getItem("softwareCategories");
        if (saved) try { setCategories(JSON.parse(saved)); } catch {}
      });

    const savedForm = sessionStorage.getItem("softwareFormData");
    if (savedForm) {
      try {
        const data = (() => { try { return JSON.parse(savedForm); } catch { return null; } })();
        setEditingId(data.editingId || null); setName(data.name || ""); setCategory(data.category || "");
        setSize(data.size || "");
        setDescription(data.description || ""); setLanguage(data.language || ""); setRating(data.rating || ""); setPrice(data.price ?? "");
        setMinRequirements(data.minRequirements || ""); setRecRequirements(data.recRequirements || "");
        setImageUrls(data.imageUrls || []); setImagePreviews(data.imagePreviews || []);
        setShowForm(true);
      } catch {}
      sessionStorage.removeItem("softwareFormData");
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

  const saveCategories = (cats: string[]) => {
    setCategories(cats);
    sessionStorage.setItem("softwareCategories", JSON.stringify(cats));
    apiFetch("/api/software/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: cats }) }).catch(() => {});
  };
  const addCategory = () => { const t = newCategoryName.trim(); if (!t) return; if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; } saveCategories([...categories, t]); setNewCategoryName(""); sileo.success({ title: `"${t}" creada` }); };
  const deleteCategory = async (idx: number) => { const cat = categories[idx]; if (!await askConfirm(`¿Eliminar "${cat}"?`)) return; saveCategories(categories.filter((_, i) => i !== idx)); if (filterCategory === cat) setFilterCategory("all"); sileo.success({ title: `"${cat}" eliminada` }); };
  const saveEditCategory = (idx: number) => { const t = editingCatName.trim(); if (!t || t === categories[idx]) { setEditingCatIdx(null); return; } if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; } const old = categories[idx]; const u = [...categories]; u[idx] = t; saveCategories(u); if (filterCategory === old) setFilterCategory(t); setEditingCatIdx(null); sileo.success({ title: `Renombrada` }); };

  const resetForm = () => {
    setName(""); setCategory(""); setSize("");
    setDescription(""); setLanguage(""); setRating(""); setPrice("");
    setMinRequirements(""); setRecRequirements("");
    setImageUrls([]); setImagePreviews([]);
    setEditingId(null); setShowForm(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      try { const res = await apiFetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setImageUrls(prev => [...prev, data.url]); } } catch {}
    }
    sileo.success({ title: `${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}` });
    setUploading(false);
    e.target.value = "";
  };

  const handleTakePhoto = () => {
    sessionStorage.setItem("softwareFormData", JSON.stringify({
      editingId, name, category, size, description, language, rating, price,
      minRequirements, recRequirements, imageUrls, imagePreviews,
    }));
    sessionStorage.setItem("cameraReturnUrl", "/software");
    window.location.href = "/camera.html";
  };

  const removeImage = (idx: number) => { setImageUrls(prev => prev.filter((_, i) => i !== idx)); setImagePreviews(prev => prev.filter((_, i) => i !== idx)); };

  const saveItem = async () => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    if (!name.trim()) { sileo.error({ title: "Nombre es requerido" }); return; }
    const imageData = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] || null;
    const payload = {
      name: name.trim(),
      category: category || null,
      size: size.trim() || null,
      description: description.trim() || null,
      price: price.toString().trim() === "" ? null : price,
      language: language.trim() || null,
      rating: rating || null,
      minRequirements: minRequirements.trim() || null,
      recRequirements: recRequirements.trim() || null,
      image: imageData,
    };
    try {
      if (editingId) {
        const res = await apiFetch("/api/software", { method: "PATCH", body: JSON.stringify({ id: editingId, ...payload }) });
        if (res.ok) { sileo.success({ title: "Actualizado" }); resetForm(); loadItems(); }
      } else {
        const res = await apiFetch("/api/software", { method: "POST", body: JSON.stringify(payload) });
        if (res.ok) { sileo.success({ title: "Agregado" }); resetForm(); loadItems(); }
      }
    } catch { sileo.error({ title: "Error" }); }
  };

  const editItem = (item: SoftwareItem) => {
    setEditingId(item.id); setName(item.name); setCategory(item.category || "");
    setSize(item.size || "");
    setDescription(item.description || ""); setLanguage(item.language || ""); setRating(item.rating || ""); setPrice(item.price != null ? String(item.price) : "");
    setMinRequirements(item.minRequirements || ""); setRecRequirements(item.recRequirements || "");
    const imgs = parseImages(item.image);
    setImageUrls(imgs); setImagePreviews(imgs);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!await askConfirm("¿Eliminar este item?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try { const res = await apiFetch("/api/software", { method: "DELETE", body: JSON.stringify({ id }) }); if (res.ok) { sileo.success({ title: "Eliminado" }); loadItems(); } } catch {}
  };

  const filteredItems = items.filter(item => {
    const matchSearch = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === "all" || item.category === filterCategory;
    return matchSearch && matchCategory;
  }).sort((a, b) => byName(a.name, b.name));
  const { gridProps, pageSize } = useCatalogGrid();
  const paged = usePaged(filteredItems, pageSize, `${searchQuery}|${filterCategory}`);

  const usedCategories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  const getCategoryColor = (cat: string | null): string => {
    if (!cat) return "#5a6a80";
    const map: Record<string, string> = { "Programas": "#3b82f6", "Sistemas Operativos": "#10b981", "Drivers": "#f59e0b", "Utilidades": "#8b5cf6", "Office": "#0ea5e9", "Diseño": "#ec4899", "Antivirus": "#14b8a6" };
    return map[cat] || "#0e7c86";
  };

  if (!user) return <PageSkeleton />;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
{viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Programa" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)" }} />
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
        <PageHeader title="Programas" subtitle="Programas y licencias para instalar · se muestran en el portal"><button onClick={() => setShowCategoryPanel(!showCategoryPanel)} style={{ padding: "8px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "var(--ok)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Categorías</button>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "8px 14px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>＋ Nuevo</button></PageHeader>
        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Programas", value: items.length, color: "var(--accent)" },
            { label: "Categorías", value: usedCategories.length, color: "#047857" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="cat-tools" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)", flex: 1, maxWidth: 300 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
              <input aria-label="Buscar programa" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar programa..." style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <select aria-label="Filtrar por categoría" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todas las categorías</option>
              {(categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
        </div>

        {showCategoryPanel && (
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", marginBottom: 20, animation: "fadeScale 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ok)" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Gestión de Categorías</h3>
              <button onClick={() => setShowCategoryPanel(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input aria-label="Nueva categoría" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="Nueva categoría..." style={{ flex: 1, padding: "9px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              <button onClick={addCategory} style={{ padding: "9px 16px", background: "var(--ok)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Crear</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(categories || []).map((cat, idx) => (
                <div key={idx} style={{ padding: "5px 8px", borderRadius: 8, background: `${getCategoryColor(cat)}10`, border: `1px solid ${getCategoryColor(cat)}25`, fontSize: 11, fontWeight: 600, color: getCategoryColor(cat), display: "flex", alignItems: "center", gap: 6 }}>
                  {editingCatIdx === idx ? (
                    <input aria-label="Nombre de la categoría" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditCategory(idx); if (e.key === "Escape") setEditingCatIdx(null); }} onBlur={() => saveEditCategory(idx)} autoFocus style={{ width: 100, padding: "2px 6px", background: "var(--bg-tertiary)", border: `1px solid ${getCategoryColor(cat)}`, borderRadius: 4, color: "var(--text-primary)", fontSize: 11, outline: "none" }} />
                  ) : (<>{cat}<span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Editar" onClick={() => { setEditingCatIdx(idx); setEditingCatName(cat); }} style={{ cursor: "pointer", fontSize: 11 }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /></span><span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Eliminar" onClick={() => deleteCategory(idx)} style={{ cursor: "pointer", fontSize: 11, color: "var(--danger-bright)", fontWeight: 700 }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span></>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Disc3 size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? "Editar programa" : "Nuevo programa"}
            subtitle={name || "Programas para instalar en los equipos"}
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveItem} disabled={uploading}>{editingId ? "Guardar cambios" : "Agregar programa"}</SaveButton>
            </>}>
            <FormSection icon={<Disc3 size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Programa">
              <Field label="Nombre" required><input className="ox-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Windows 11 Pro, Adobe Photoshop..." /></Field>
              <span className="ox-label" style={{ marginTop: 12 }}>Categoría</span>
              <div className="ox-chips" role="group" aria-label="Categoría">
                <button type="button" className="ox-chip" aria-pressed={!category} onClick={() => setCategory("")}>Sin categoría</button>
                {[...categories, ...(category && !categories.includes(category) ? [category] : [])].map(cat => <button key={cat} type="button" className="ox-chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</button>)}
              </div>
              <div className="ox-row" style={{ marginTop: 12 }}>
                <Field label="Peso"><input className="ox-input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Ej: 50 GB, 1.2 GB..." /></Field>
                <Field label="Idioma"><input className="ox-input" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Español, Inglés, Multi..." /></Field>
                <Field label="Clasificación">
                  <select className="ox-input" value={rating} onChange={(e) => setRating(e.target.value)}>{RATINGS.map(r => <option key={r} value={r}>{r || "Sin clasificar"}</option>)}</select>
                </Field>
                <Field label="Precio (Bs.)" hint="Opcional · costo de instalación"><input className="ox-input tabular" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej: 50" inputMode="decimal" /></Field>
              </div>
            </FormSection>

            <FormSection icon={<Camera size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Portada y fotos">
              <FormPhotos previews={imagePreviews} onRemove={removeImage} onCamera={handleTakePhoto} inputRef={fileInputRef} onSelect={handleImageSelect} uploading={uploading} />
            </FormSection>

            <FormSection icon={<FileText size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Descripción y requisitos">
              <Field label="Descripción"><textarea className="ox-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción del programa..." rows={3} /></Field>
              <div className="ox-row" style={{ marginTop: 12 }}>
                <Field label="Requisitos mínimos"><textarea className="ox-input" value={minRequirements} onChange={(e) => setMinRequirements(e.target.value)} placeholder="CPU: Intel i3 | RAM: 4GB | GPU: GTX 650..." rows={2} /></Field>
                <Field label="Requisitos recomendados"><textarea className="ox-input" value={recRequirements} onChange={(e) => setRecRequirements(e.target.value)} placeholder="CPU: Intel i5 | RAM: 8GB | GPU: GTX 1060..." rows={2} /></Field>
              </div>
            </FormSection>
          </FormModal>
        )}

        {loading ? (
          <CatalogSkeleton />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay programas agregados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Agrega juegos, programas y sistemas operativos</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar</button>
          </div>
        ) : (
          <><div {...gridProps}>
            {paged.items.map((item, i) => {
              const imgs = parseImages(item.image);
              const firstImg = imgs[0] || null;
              const catColor = getCategoryColor(item.category);
              const isExpanded = expandedId === item.id;
              return (
                <div tabIndex={0} onKeyDown={pressKey} key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, position: "relative", cursor: "pointer" }}>
                  <div className="cat-badges">
                    <div className="cat-badges-row">
                      {item.category && <div style={{ padding: "3px 8px", borderRadius: 6, background: `${catColor}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.category}</div>}
                      {item.size && <div style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" /> {item.size}</div>}
                    </div>
                    {item.showInPortal === false && <HiddenBadge inline />}
                  </div>
                  {imgs.length > 1 && <div style={{ position: "absolute", ...(item.size ? { top: 34 } : { top: 10 }), right: 10, zIndex: 2, padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}

                  <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className={firstImg ? "cat-img" : "cat-img cat-noimg"} onClick={(e) => { if (firstImg) { e.stopPropagation(); setViewImage(firstImg); } }} style={{ width: "100%", aspectRatio: "3/4", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: firstImg ? "pointer" : "default" }}>
                    {firstImg ? (<img loading="lazy" decoding="async" src={firstImg} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 48, opacity: 0.15 }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></span><span className="cat-noimg-txt" style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>Sin imagen</span></div>)}
                  </div>

                  <div style={{ padding: "14px 16px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.3 }}>{item.name}</h3>

                    <div style={{ display: "flex", gap: 6 }}>
                      <PortalToggle visible={item.showInPortal !== false} onToggle={() => togglePortalVisibility(item, "/api/software", setItems, apiFetch, sileo)} />
                      <button onClick={(e) => { e.stopPropagation(); editItem(item); }} style={{ flex: 1, padding: "8px", background: "rgba(var(--accent-rgb), 0.06)", border: "1px solid rgba(var(--accent-rgb), 0.15)", borderRadius: 8, color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
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

