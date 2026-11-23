"use client";
import { Camera, FileText, Gamepad2, Joystick, Monitor, Pencil, Search, Trash2, X } from "@/frontend/components/icons";
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

interface VideogameItem { showInPortal?: boolean; price?: number | null;
  id: string;
  name: string;
  platform: string | null;
  genre: string | null;
  description: string | null;
  size: string | null;
  minRequirements: string | null;
  recRequirements: string | null;
  language: string | null;
  rating: string | null;
  image: string | null;
  active: boolean;
}

const INITIAL_PLATFORMS = ["PC", "Nintendo Switch", "Nintendo Wii", "PSP", "PS Vita"];
const RATINGS = ["", "PEGI 3", "PEGI 7", "PEGI 12", "PEGI 16", "PEGI 18", "ESRB E", "ESRB E10+", "ESRB T", "ESRB M", "ESRB AO"];

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr; } catch {}
  return img.trim() ? [img] : [];
}

export default function VideogamesPage() {
  const router = useRouter();
  const [, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [items, setItems] = useState<VideogameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("");
  const [minRequirements, setMinRequirements] = useState("");
  const [recRequirements, setRecRequirements] = useState("");
  const [language, setLanguage] = useState("");
  const [rating, setRating] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(INITIAL_PLATFORMS);
  const [showPlatformPanel, setShowPlatformPanel] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [editingPlatIdx, setEditingPlatIdx] = useState<number | null>(null);
  const [editingPlatName, setEditingPlatName] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    try { const res = await apiFetch("/api/videogames"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Videogame"], () => loadItems());

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
    apiFetch("/api/videogames/categories")
      .then(r => r.json())
      .then(d => {
        if (d.categories?.length) {
          setPlatforms(d.categories);
        } else {
          const saved = sessionStorage.getItem("videogamePlatforms");
          if (saved) try {
            const cats = JSON.parse(saved);
            if (Array.isArray(cats) && cats.length > 0) {
              setPlatforms(cats);
              apiFetch("/api/videogames/categories", {
                method: "POST",
                body: JSON.stringify({ categories: cats }),
              }).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {
        const saved = sessionStorage.getItem("videogamePlatforms");
        if (saved) try { setPlatforms(JSON.parse(saved)); } catch {}
      });

    const savedForm = sessionStorage.getItem("videogameFormData");
    if (savedForm) {
      try {
        const data = (() => { try { return JSON.parse(savedForm); } catch { return null; } })();
        setEditingId(data.editingId || null);
        setName(data.name || "");
        setPlatform(data.platform || "");
        setGenre(data.genre || "");
        setDescription(data.description || ""); setPrice(data.price ?? "");
        setSize(data.size || "");
        setMinRequirements(data.minRequirements || "");
        setRecRequirements(data.recRequirements || "");
        setLanguage(data.language || "");
        setRating(data.rating || "");
        setImageUrls(data.imageUrls || []);
        setImagePreviews(data.imagePreviews || []);
        setShowForm(true);
      } catch {}
      sessionStorage.removeItem("videogameFormData");
    }

    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) {
      try {
        const { url, preview } = (() => { try { return JSON.parse(capturedData); } catch { return {}; } })();
        setImageUrls(prev => [...prev, url]);
        setImagePreviews(prev => [...prev, preview]);
        setShowForm(true);
        setTimeout(() => sileo.success({ title: "Foto capturada" }), 500);
      } catch {}
      sessionStorage.removeItem("capturedImage");
    }
  }, [router]);

  const savePlatforms = (pls: string[]) => {
    setPlatforms(pls);
    sessionStorage.setItem("videogamePlatforms", JSON.stringify(pls));
    apiFetch("/api/videogames/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: pls }) }).catch(() => {});
  };
  const addPlatform = () => {
    const t = newPlatformName.trim();
    if (!t) return;
    if (platforms.includes(t)) { sileo.error({ title: "Ya existe" }); return; }
    savePlatforms([...platforms, t]); setNewPlatformName(""); sileo.success({ title: `"${t}" creada` });
  };
  const deletePlatform = async (idx: number) => {
    const p = platforms[idx];
    if (!await askConfirm(`¿Eliminar la plataforma "${p}"?`)) return;
    savePlatforms(platforms.filter((_, i) => i !== idx));
    if (filterPlatform === p) setFilterPlatform("all");
    sileo.success({ title: `"${p}" eliminada` });
  };
  const saveEditPlatform = (idx: number) => {
    const t = editingPlatName.trim();
    if (!t || t === platforms[idx]) { setEditingPlatIdx(null); return; }
    if (platforms.includes(t)) { sileo.error({ title: "Ya existe" }); return; }
    const old = platforms[idx]; const u = [...platforms]; u[idx] = t;
    savePlatforms(u);
    if (filterPlatform === old) setFilterPlatform(t);
    setEditingPlatIdx(null);
    sileo.success({ title: "Renombrada" });
  };

  const resetForm = () => {
    setName(""); setPlatform(""); setGenre(""); setDescription(""); setSize(""); setPrice("");
    setMinRequirements(""); setRecRequirements(""); setLanguage(""); setRating("");
    setImageUrls([]); setImagePreviews([]); setEditingId(null); setShowForm(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
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
    sessionStorage.setItem("videogameFormData", JSON.stringify({
      editingId, name, platform, genre, description, size, minRequirements, recRequirements, language, rating, price, imageUrls, imagePreviews,
    }));
    sessionStorage.setItem("cameraReturnUrl", "/videogames");
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
      platform: platform || null,
      genre: genre.trim() || null,
      description: description.trim() || null,
      price: price.toString().trim() === "" ? null : price,
      size: size.trim() || null,
      minRequirements: minRequirements.trim() || null,
      recRequirements: recRequirements.trim() || null,
      language: language.trim() || null,
      rating: rating || null,
      image: imageData,
    };
    try {
      if (editingId) {
        const res = await apiFetch("/api/videogames", { method: "PATCH", body: JSON.stringify({ id: editingId, ...payload }) });
        if (res.ok) { sileo.success({ title: "Actualizado" }); resetForm(); loadItems(); }
      } else {
        const res = await apiFetch("/api/videogames", { method: "POST", body: JSON.stringify(payload) });
        if (res.ok) { sileo.success({ title: "Agregado" }); resetForm(); loadItems(); }
      }
    } catch { sileo.error({ title: "Error" }); }
  };

  const editItem = (item: VideogameItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPlatform(item.platform || "");
    setGenre(item.genre || "");
    setDescription(item.description || ""); setPrice(item.price != null ? String(item.price) : "");
    setSize(item.size || "");
    setMinRequirements(item.minRequirements || "");
    setRecRequirements(item.recRequirements || "");
    setLanguage(item.language || "");
    setRating(item.rating || "");
    const imgs = parseImages(item.image);
    setImageUrls(imgs); setImagePreviews(imgs);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!await askConfirm("¿Eliminar este videojuego?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const res = await apiFetch("/api/videogames", { method: "DELETE", body: JSON.stringify({ id }) });
      if (res.ok) { sileo.success({ title: "Eliminado" }); loadItems(); }
    } catch {}
  };

  const filteredItems = items.filter(item => {
    const matchSearch = searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.genre || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlatform = filterPlatform === "all" || item.platform === filterPlatform;
    return matchSearch && matchPlatform;
  }).sort((a, b) => byName(a.name, b.name));
  const { gridProps, pageSize } = useCatalogGrid();
  const paged = usePaged(filteredItems, pageSize, `${searchQuery}|${filterPlatform}`);

  const usedPlatforms = [...new Set(items.map(i => i.platform).filter(Boolean))] as string[];

  const getPlatformColor = (p: string | null): string => {
    if (!p) return "#5a6a80";
    const map: Record<string, string> = {
      "PC": "#3b82f6",
      "Nintendo Switch": "#ef4444",
      "Nintendo Wii": "#f59e0b",
      "PSP": "#0891b2",
      "PS Vita": "#8b5cf6",
      "PlayStation 4": "#0ea5e9",
      "PlayStation 5": "#2563eb",
      "Xbox 360": "#10b981",
      "Xbox One": "#16a34a",
      "Xbox Series X": "#16a34a",
      "Nintendo 3DS": "#f97316",
      "Nintendo DS": "#ea580c",
    };
    return map[p] || "#0e7c86";
  };

  if (!user) return <PageSkeleton />;

  const PRIMARY = "#dc2626"; // rojo — distintivo de videojuegos (software es lila)

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
      {viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Videojuego" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)" }} />
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
        <PageHeader title="Videojuegos" subtitle="Juegos para instalar o vender · se muestran en el portal"><button onClick={() => setShowPlatformPanel(!showPlatformPanel)} style={{ padding: "8px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, color: "var(--warn)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Joystick size={14} strokeWidth={STROKE} aria-hidden="true" /> Plataformas</button>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "8px 14px", background: `${PRIMARY}`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>＋ Nuevo</button></PageHeader>
        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Videojuegos", value: items.length, color: PRIMARY },
            { label: "Plataformas", value: usedPlatforms.length, color: "#b45309" },
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
              <input aria-label="Buscar videojuego" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar videojuego..." style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <select aria-label="Filtrar por plataforma" value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todas las plataformas</option>
              {(platforms || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          
        </div>

        {showPlatformPanel && (
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid rgba(245,158,11,0.15)", marginBottom: 20, animation: "fadeScale 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--warn)" }}><Joystick size={14} strokeWidth={STROKE} aria-hidden="true" /> Gestión de Plataformas</h3>
              <button onClick={() => setShowPlatformPanel(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input aria-label="Nueva plataforma" value={newPlatformName} onChange={(e) => setNewPlatformName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlatform()} placeholder="Nueva plataforma..." style={{ flex: 1, padding: "9px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              <button onClick={addPlatform} style={{ padding: "9px 16px", background: "var(--warn)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Crear</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(platforms || []).map((p, idx) => (
                <div key={idx} style={{ padding: "5px 10px", borderRadius: 8, background: `${getPlatformColor(p)}18`, border: `1px solid ${getPlatformColor(p)}30`, color: getPlatformColor(p), fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  {editingPlatIdx === idx ? (
                    <input aria-label="Nombre de la plataforma" value={editingPlatName} onChange={(e) => setEditingPlatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditPlatform(idx); if (e.key === "Escape") setEditingPlatIdx(null); }} onBlur={() => saveEditPlatform(idx)} autoFocus style={{ width: 120, padding: "2px 6px", background: "var(--bg-tertiary)", border: `1px solid ${getPlatformColor(p)}`, borderRadius: 4, color: "var(--text-primary)", fontSize: 11, outline: "none" }} />
                  ) : (<>{p}<span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Editar" onClick={() => { setEditingPlatIdx(idx); setEditingPlatName(p); }} style={{ cursor: "pointer", fontSize: 11 }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /></span><span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Eliminar" onClick={() => deletePlatform(idx)} style={{ cursor: "pointer", fontSize: 11, color: "var(--danger-bright)", fontWeight: 700 }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span></>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Gamepad2 size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? "Editar videojuego" : "Nuevo videojuego"}
            subtitle={name || "Juegos para instalar o vender"}
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveItem} disabled={uploading}>{editingId ? "Guardar cambios" : "Agregar videojuego"}</SaveButton>
            </>}>
            <FormSection icon={<Gamepad2 size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Juego">
              <Field label="Nombre" required><input className="ox-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: The Legend of Zelda, GTA V..." /></Field>
              <span className="ox-label" style={{ marginTop: 12 }}>Plataforma</span>
              <div className="ox-chips" role="group" aria-label="Plataforma">
                <button type="button" className="ox-chip" aria-pressed={!platform} onClick={() => setPlatform("")}>Sin plataforma</button>
                {[...platforms, ...(platform && !platforms.includes(platform) ? [platform] : [])].map(p => <button key={p} type="button" className="ox-chip" aria-pressed={platform === p} onClick={() => setPlatform(p)}><span className="e" aria-hidden="true">{p === "PC" ? <Monitor size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Gamepad2 size={18} strokeWidth={STROKE} aria-hidden="true" />}</span>{p}</button>)}
              </div>
              <div className="ox-row" style={{ marginTop: 12 }}>
                <Field label="Género"><input className="ox-input" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Acción, RPG, Deportes..." /></Field>
                <Field label="Peso"><input className="ox-input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="50 GB, 1.2 GB..." /></Field>
                <Field label="Idioma"><input className="ox-input" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Español, Inglés, Multi..." /></Field>
                <Field label="Clasificación">
                  <select className="ox-input" value={rating} onChange={(e) => setRating(e.target.value)}>{RATINGS.map(r => <option key={r} value={r}>{r || "Sin clasificar"}</option>)}</select>
                </Field>
              </div>
            </FormSection>

            <FormSection icon={<Camera size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Portada y fotos">
              <FormPhotos previews={imagePreviews} onRemove={removeImage} onCamera={handleTakePhoto} inputRef={fileInputRef} onSelect={handleImageSelect} uploading={uploading} />
            </FormSection>

            <FormSection icon={<FileText size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Precio y descripción">
              <Field label="Precio (Bs.)" hint="Opcional · por ejemplo, el costo de instalación"><input className="ox-input tabular" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej: 50" inputMode="decimal" /></Field>
              <Field label="Descripción" style={{ marginTop: 12 }}><textarea className="ox-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción del juego..." rows={3} /></Field>
              {platform === "PC" && (
                <div className="ox-row" style={{ marginTop: 12 }}>
                  <Field label="Requisitos mínimos (PC)"><textarea className="ox-input" value={minRequirements} onChange={(e) => setMinRequirements(e.target.value)} placeholder="CPU: Intel i3 | RAM: 4GB | GPU: GTX 650..." rows={2} /></Field>
                  <Field label="Requisitos recomendados (PC)"><textarea className="ox-input" value={recRequirements} onChange={(e) => setRecRequirements(e.target.value)} placeholder="CPU: Intel i5 | RAM: 8GB | GPU: GTX 1060..." rows={2} /></Field>
                </div>
              )}
            </FormSection>
          </FormModal>
        )}

        {loading ? (
          <CatalogSkeleton />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay videojuegos agregados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Agrega videojuegos de PC, Switch, PSP y más consolas</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: `${PRIMARY}`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar primero</button>
          </div>
        ) : (
          <><div {...gridProps}>
            {paged.items.map((item, i) => {
              const imgs = parseImages(item.image);
              const firstImg = imgs[0] || null;
              const platColor = getPlatformColor(item.platform);
              return (
                <div tabIndex={0} onKeyDown={pressKey} key={item.id} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, position: "relative", cursor: "pointer" }}>
                  <div className="cat-badges">
                    <div className="cat-badges-row">
                      {item.platform && <div style={{ padding: "3px 8px", borderRadius: 6, background: `${platColor}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.platform}</div>}
                      {item.rating && <div style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.9)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.rating}</div>}
                    </div>
                    {item.showInPortal === false && <HiddenBadge inline />}
                  </div>
                  {imgs.length > 1 && <div style={{ position: "absolute", ...(item.rating ? { top: 34 } : { top: 10 }), right: 10, zIndex: 2, padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}

                  <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className={firstImg ? "cat-img" : "cat-img cat-noimg"} onClick={(e) => { if (firstImg) { e.stopPropagation(); setViewImage(firstImg); } }} style={{ width: "100%", aspectRatio: "3/4", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: firstImg ? "pointer" : "default" }}>
                    {firstImg ? (<img loading="lazy" decoding="async" src={firstImg} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 48, opacity: 0.15 }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></span><span className="cat-noimg-txt" style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>Sin imagen</span></div>)}
                  </div>

                  <div style={{ padding: "14px 16px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.3 }}>{item.name}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {item.genre && <span className="spec-chip">{item.genre}</span>}
                      {item.size && <span className="spec-chip">{item.size}</span>}
                      {item.language && <span className="spec-chip">{item.language}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <PortalToggle visible={item.showInPortal !== false} onToggle={() => togglePortalVisibility(item, "/api/videogames", setItems, apiFetch, sileo)} />
                      <button onClick={(e) => { e.stopPropagation(); editItem(item); }} style={{ flex: 1, padding: "8px", background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}25`, borderRadius: 8, color: PRIMARY, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
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

