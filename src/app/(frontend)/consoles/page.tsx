"use client";
import { BadgeCheck, Banknote, Camera, Joystick, Pencil, QrCode, Search, Tag, Trash2, X } from "@/frontend/components/icons";
import { STROKE, StatusDot } from "@/frontend/components/UiIcons";
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

interface ConsoleItem { showInPortal?: boolean;
  id: string;
  code: string;
  name: string;
  category: string | null;
  state: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  storage: string | null;
  generation: string | null;
  accessories: string | null;
  condition: string;
  price: number;
  notes: string | null;
  image: string | null;
  active: boolean;
}

const INITIAL_CATEGORIES = ["Nintendo", "Sony", "Microsoft"];
const STATES = ["", "Nueva", "Usada"];
const CONDITIONS: Record<string, { label: string; color: string }> = {
  disponible: { label: "Disponible", color: "#047857" },
  vendida: { label: "Vendida", color: "#0e7c86" },
  reservada: { label: "Reservada", color: "#b45309" },
};

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr; } catch {}
  return img.trim() ? [img] : [];
}

export default function ConsolesPage() {
  const router = useRouter();
  const [, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [items, setItems] = useState<ConsoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("");
  const [generation, setGeneration] = useState("");
  const [accessories, setAccessories] = useState("");
  const [condition, setCondition] = useState("disponible");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    try { const res = await apiFetch("/api/consoles"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Console"], () => loadItems());

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => {
        if (Array.isArray(b)) {
          setBranches(b);
          const ab = sessionStorage.getItem("activeBranchId");
          if (ab) setActiveBranch(ab);
          else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); }
        }
      }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }

    loadItems();
    apiFetch("/api/consoles/categories")
      .then(r => r.json())
      .then(d => {
        if (d.categories?.length) {
          setCategories(d.categories);
        } else {
          const saved = sessionStorage.getItem("consoleCategories");
          if (saved) try {
            const cats = JSON.parse(saved);
            if (Array.isArray(cats) && cats.length > 0) {
              setCategories(cats);
              apiFetch("/api/consoles/categories", {
                method: "POST",
                body: JSON.stringify({ categories: cats }),
              }).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {
        const saved = sessionStorage.getItem("consoleCategories");
        if (saved) try { setCategories(JSON.parse(saved)); } catch {}
      });

    const savedForm = sessionStorage.getItem("consoleFormData");
    if (savedForm) {
      try {
        const d = (() => { try { return JSON.parse(savedForm); } catch { return null; } })();
        setEditingId(d.editingId || null); setName(d.name || ""); setCategory(d.category || "");
        setState(d.state || ""); setBrand(d.brand || ""); setModel(d.model || "");
        setColor(d.color || ""); setStorage(d.storage || ""); setGeneration(d.generation || "");
        setAccessories(d.accessories || ""); setCondition(d.condition || "disponible");
        setPrice(d.price || ""); setNotes(d.notes || "");
        setImageUrls(d.imageUrls || []); setImagePreviews(d.imagePreviews || []);
        setShowForm(true);
      } catch {}
      sessionStorage.removeItem("consoleFormData");
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
    sessionStorage.setItem("consoleCategories", JSON.stringify(cats));
    apiFetch("/api/consoles/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: cats }) }).catch(() => {});
  };
  const addCategory = () => {
    const t = newCategoryName.trim(); if (!t) return;
    if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; }
    saveCategories([...categories, t]); setNewCategoryName(""); sileo.success({ title: `"${t}" creada` });
  };
  const deleteCategory = async (idx: number) => {
    const c = categories[idx];
    if (!await askConfirm(`¿Eliminar "${c}"?`)) return;
    saveCategories(categories.filter((_, i) => i !== idx));
    if (filterCategory === c) setFilterCategory("all");
    sileo.success({ title: `"${c}" eliminada` });
  };
  const saveEditCategory = (idx: number) => {
    const t = editingCatName.trim();
    if (!t || t === categories[idx]) { setEditingCatIdx(null); return; }
    if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; }
    const old = categories[idx]; const u = [...categories]; u[idx] = t;
    saveCategories(u);
    if (filterCategory === old) setFilterCategory(t);
    setEditingCatIdx(null);
    sileo.success({ title: "Renombrada" });
  };

  const resetForm = () => {
    setName(""); setCategory(""); setState(""); setBrand(""); setModel(""); setColor("");
    setStorage(""); setGeneration(""); setAccessories(""); setCondition("disponible");
    setPrice(""); setNotes(""); setImageUrls([]); setImagePreviews([]);
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
      const formData = new FormData(); formData.append("file", file);
      try {
        const res = await apiFetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) { const data = await res.json(); setImageUrls(prev => [...prev, data.url]); }
      } catch {}
    }
    sileo.success({ title: `${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}` });
    setUploading(false);
    e.target.value = "";
  };

  const handleTakePhoto = () => {
    sessionStorage.setItem("consoleFormData", JSON.stringify({
      editingId, name, category, state, brand, model, color, storage, generation,
      accessories, condition, price, notes, imageUrls, imagePreviews,
    }));
    sessionStorage.setItem("cameraReturnUrl", "/consoles");
    window.location.href = "/camera.html";
  };

  const removeImage = (idx: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const saveItem = async () => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    if (!name.trim()) { sileo.error({ title: "Nombre es requerido" }); return; }
    const imageData = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] || null;
    const payload = {
      name: name.trim(),
      category: category || null,
      state: state || null,
      brand: brand.trim() || null,
      model: model.trim() || null,
      color: color.trim() || null,
      storage: storage.trim() || null,
      generation: generation.trim() || null,
      accessories: accessories.trim() || null,
      condition,
      price: parseFloat(price) || 0,
      notes: notes.trim() || null,
      image: imageData,
    };
    try {
      if (editingId) {
        const res = await apiFetch("/api/consoles", { method: "PATCH", body: JSON.stringify({ id: editingId, ...payload }) });
        if (res.ok) { sileo.success({ title: "Actualizada" }); resetForm(); loadItems(); }
      } else {
        const res = await apiFetch("/api/consoles", { method: "POST", body: JSON.stringify(payload) });
        if (res.ok) { sileo.success({ title: "Agregada" }); resetForm(); loadItems(); }
      }
    } catch { sileo.error({ title: "Error" }); }
  };

  const editItem = (item: ConsoleItem) => {
    setEditingId(item.id);
    setName(item.name); setCategory(item.category || ""); setState(item.state || "");
    setBrand(item.brand || ""); setModel(item.model || ""); setColor(item.color || "");
    setStorage(item.storage || ""); setGeneration(item.generation || "");
    setAccessories(item.accessories || ""); setCondition(item.condition);
    setPrice(String(item.price || "")); setNotes(item.notes || "");
    const imgs = parseImages(item.image);
    setImageUrls(imgs); setImagePreviews(imgs);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!await askConfirm("¿Eliminar esta consola?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const res = await apiFetch("/api/consoles", { method: "DELETE", body: JSON.stringify({ id }) });
      if (res.ok) { sileo.success({ title: "Eliminada" }); loadItems(); }
    } catch {}
  };

  const printQR = (item: ConsoleItem) => {
    const bid = activeBranch ? `?branchId=${activeBranch}` : "";
    window.open(`/consoles/print/${item.id}${bid}`, "_blank");
  };

  const filteredItems = items.filter(item => {
    const matchSearch = searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.model || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === "all" || item.category === filterCategory;
    const matchCondition = filterCondition === "all" || item.condition === filterCondition;
    return matchSearch && matchCategory && matchCondition;
  }).sort((a, b) => byName(a.name, b.name));
  const { gridProps, pageSize } = useCatalogGrid();
  const paged = usePaged(filteredItems, pageSize, `${searchQuery}|${filterCategory}|${filterCondition}`);

  const usedCategories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  const getCategoryColor = (cat: string | null): string => {
    if (!cat) return "#5a6a80";
    const map: Record<string, string> = { "Nintendo": "#ef4444", "Sony": "#3b82f6", "Microsoft": "#10b981", "Sega": "#8b5cf6", "Retro": "#f59e0b", "Atari": "#ec4899" };
    return map[cat] || "#0e7c86";
  };

  if (!user) return <PageSkeleton />;

  const PRIMARY = "#f97316"; // naranja — distintivo de Consolas

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
      {viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Consola" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)" }} />
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
        }
      `}</style>

      <AppSidebar user={user} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <PageHeader title="Consolas" subtitle="Consolas a la venta · se muestran en el portal"><button onClick={() => setShowCategoryPanel(!showCategoryPanel)} style={{ padding: "8px 14px", background: "rgba(var(--accent-rgb), 0.08)", border: "1px solid rgba(var(--accent-rgb), 0.2)", borderRadius: 10, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Categorías</button>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "8px 14px", background: `${PRIMARY}`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>＋ Nueva</button></PageHeader>
        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Consolas", value: items.length, color: PRIMARY },
            { label: "Disponibles", value: items.filter(i => i.condition === "disponible").length, color: "#047857" },
            { label: "Categorías", value: usedCategories.length, color: "var(--accent)" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="cat-tools" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)", flex: 1, maxWidth: 260 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
              <input aria-label="Buscar consola" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar consola..." style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <select aria-label="Filtrar por categoría" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todas las categorías</option>
              {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Filtrar por estado" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Toda condición</option>
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </div>
          
        </div>

        {showCategoryPanel && (
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid rgba(var(--accent-rgb), 0.15)", marginBottom: 20, animation: "fadeScale 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Gestión de Categorías</h3>
              <button onClick={() => setShowCategoryPanel(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input aria-label="Nueva categoría" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="Nueva categoría..." style={{ flex: 1, padding: "9px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              <button onClick={addCategory} style={{ padding: "9px 16px", background: "var(--accent)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Crear</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(categories || []).map((cat, idx) => (
                <div key={idx} style={{ padding: "5px 10px", borderRadius: 8, background: `${getCategoryColor(cat)}18`, border: `1px solid ${getCategoryColor(cat)}30`, color: getCategoryColor(cat), fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  {editingCatIdx === idx ? (
                    <input aria-label="Nombre de la categoría" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditCategory(idx); if (e.key === "Escape") setEditingCatIdx(null); }} onBlur={() => saveEditCategory(idx)} autoFocus style={{ width: 110, padding: "2px 6px", background: "var(--bg-tertiary)", border: `1px solid ${getCategoryColor(cat)}`, borderRadius: 4, color: "var(--text-primary)", fontSize: 11, outline: "none" }} />
                  ) : (<>{cat}<span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Editar" onClick={() => { setEditingCatIdx(idx); setEditingCatName(cat); }} style={{ cursor: "pointer", fontSize: 11 }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /></span><span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Eliminar" onClick={() => deleteCategory(idx)} style={{ cursor: "pointer", fontSize: 11, color: "var(--danger-bright)", fontWeight: 700 }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span></>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Joystick size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? "Editar consola" : "Nueva consola"}
            subtitle={name || "Consolas en venta: Nintendo, Sony, Microsoft..."}
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveItem} disabled={uploading}>{editingId ? "Guardar cambios" : "Agregar consola"}</SaveButton>
            </>}>
            <FormSection icon={<Joystick size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Consola">
              <Field label="Nombre" required><input className="ox-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <span className="ox-label" style={{ marginTop: 12 }}>Categoría</span>
              <div className="ox-chips" role="group" aria-label="Categoría">
                <button type="button" className="ox-chip" aria-pressed={!category} onClick={() => setCategory("")}>Sin categoría</button>
                {[...categories, ...(category && !categories.includes(category) ? [category] : [])].map(c => <button key={c} type="button" className="ox-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
              </div>
              <div className="ox-row" style={{ marginTop: 12 }}>
                <Field label="Marca"><input className="ox-input" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
                <Field label="Modelo"><input className="ox-input" value={model} onChange={(e) => setModel(e.target.value)} /></Field>
                <Field label="Color"><input className="ox-input" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
                <Field label="Almacenamiento"><input className="ox-input" value={storage} onChange={(e) => setStorage(e.target.value)} /></Field>
                <Field label="Generación"><input className="ox-input" value={generation} onChange={(e) => setGeneration(e.target.value)} /></Field>
              </div>
            </FormSection>

            <FormSection icon={<BadgeCheck size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Estado">
              <div className="ox-chips" role="group" aria-label="Nueva o usada" style={{ marginBottom: 10 }}>
                {STATES.map(s => <button key={s || "na"} type="button" className="ox-chip" aria-pressed={state === s} onClick={() => setState(s)}>{s === "Nueva" ? "Nueva" : s === "Usada" ? "Usada" : "Sin especificar"}</button>)}
              </div>
              <div className="ox-chips" role="group" aria-label="Disponibilidad">
                {Object.entries(CONDITIONS).map(([k, c]) => <button key={k} type="button" className="ox-chip" aria-pressed={condition === k} onClick={() => setCondition(k)}><span className="e" aria-hidden="true"><StatusDot color={c.color} /></span>{c.label}</button>)}
              </div>
            </FormSection>

            <FormSection icon={<Camera size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Fotos">
              <FormPhotos previews={imagePreviews} onRemove={removeImage} onCamera={handleTakePhoto} inputRef={fileInputRef} onSelect={handleImageSelect} uploading={uploading} />
            </FormSection>

            <FormSection icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Precio y detalles">
              <Field label="Precio (Bs.)"><input className="ox-input tabular" type="number" step="0.01" min="0" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <div className="ox-row" style={{ marginTop: 12 }}>
                <Field label="Accesorios incluidos"><textarea className="ox-input" value={accessories} onChange={(e) => setAccessories(e.target.value)} rows={2} /></Field>
                <Field label="Notas"><textarea className="ox-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
              </div>
            </FormSection>
          </FormModal>
        )}

        {loading ? (
          <CatalogSkeleton />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Joystick size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay consolas</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Agrega consolas Nintendo, Sony, Microsoft y más</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: `${PRIMARY}`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar primera</button>
          </div>
        ) : (
          <><div {...gridProps}>
            {paged.items.map((item, i) => {
              const imgs = parseImages(item.image);
              const firstImg = imgs[0] || null;
              const catColor = getCategoryColor(item.category);
              const cond = CONDITIONS[item.condition] || CONDITIONS.disponible;
              return (
                <div key={item.id} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, position: "relative" }}>
                  <div className="cat-badges">
                    <div className="cat-badges-row">
                      {item.category && <div style={{ padding: "3px 8px", borderRadius: 6, background: `${catColor}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.category}</div>}
                      <div style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, background: `${cond.color}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}>{cond.label}</div>
                      {imgs.length > 1 && <div style={{ padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}
                    </div>
                    {item.showInPortal === false && <HiddenBadge inline />}
                  </div>

                  <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className={firstImg ? "cat-img" : "cat-img cat-noimg"} onClick={() => firstImg && setViewImage(firstImg)} style={{ width: "100%", aspectRatio: "1/1", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: firstImg ? "pointer" : "default" }}>
                    {firstImg ? (<img loading="lazy" decoding="async" src={firstImg} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<span style={{ fontSize: 48, opacity: 0.15 }}><Joystick size={48} strokeWidth={1.5} aria-hidden="true" /></span>)}
                  </div>

                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>{item.name}</h3>
                      {item.code && <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: PRIMARY, padding: "2px 6px", borderRadius: 5, background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}25`, flexShrink: 0 }}>{item.code}</span>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ok)", marginBottom: 8 }}>Bs. {Math.round(item.price || 0).toLocaleString()}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {item.state && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 5, background: item.state === "Nueva" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", color: item.state === "Nueva" ? "var(--ok-bright)" : "var(--warn-bright)", fontWeight: 700 }}>{item.state}</span>}
                      {item.storage && <span className="spec-chip">{item.storage}</span>}
                      {item.color && <span className="spec-chip">{item.color}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => printQR(item)} style={{ padding: "7px 10px", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, color: "#0e7490", fontSize: 11, fontWeight: 600, cursor: "pointer" }} title="Imprimir QR"><QrCode size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> QR</span></button>
                      <PortalToggle visible={item.showInPortal !== false} onToggle={() => togglePortalVisibility(item, "/api/consoles", setItems, apiFetch, sileo)} />
                      <button onClick={() => editItem(item)} style={{ flex: 1, padding: "7px", background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}25`, borderRadius: 8, color: PRIMARY, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
                      <button onClick={() => deleteItem(item.id)} style={{ padding: "7px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
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

