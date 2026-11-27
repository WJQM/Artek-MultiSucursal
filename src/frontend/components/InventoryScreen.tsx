"use client";
import { Banknote, Boxes, Camera, Cog, EyeOff, History, Package, Pencil, Printer, Search, ShoppingCart, Tag, Trash2, TrendingUp, TriangleAlert, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { Pagination, usePaged, useCatalogGrid, byName } from "@/frontend/components/Pagination";
import { CatalogSkeleton } from "@/frontend/components/CatalogSkeleton";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { PurchaseList } from "@/frontend/components/PurchaseList";
import { StockHistory } from "@/frontend/components/StockHistory";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, FormPhotos, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";

interface InventoryItem { id: string; name: string; category: string | null; quantity: number; price: number; cost?: number; minStock: number; image: string | null; active: boolean; showInPortal?: boolean; kind?: string; }

const INITIAL_CATEGORIES = ["Repuestos", "Discos / SSD", "Memorias RAM", "Pantallas", "Baterías", "Cargadores", "Cables", "Teclados", "Otros"];

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr; } catch {}
  return img.trim() ? [img] : [];
}

type TypeFilter = "all" | "product" | "part";
const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "product", label: "Productos" },
  { key: "part", label: "Repuestos" },
];

/** Inventario único: productos a la venta y repuestos para reparaciones, con filtro por tipo */
export function InventoryScreen() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showPurchase, setShowPurchase] = useState(false);
  // Desde el aviso de stock bajo (…?compra=1) se abre directo la lista de compra
  useEffect(() => { if (new URLSearchParams(window.location.search).get("compra") === "1") setShowPurchase(true); }, []);
  const isPart = typeFilter === "part";
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [formKind, setFormKind] = useState<"product" | "part">("product");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(""); const [cost, setCost] = useState("");
  const [historyOf, setHistoryOf] = useState<InventoryItem | null>(null);
  const [minStock, setMinStock] = useState("5");
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
  const fileInputRef = useRef<HTMLInputElement>(null);



  // Mostrar / ocultar un producto en el portal público (sigue en el inventario interno)
  const togglePortal = async (item: InventoryItem) => {
    const next = item.showInPortal === false;
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, showInPortal: next } : x)));
    try {
      const res = await apiFetch("/api/inventory", { method: "PATCH", body: JSON.stringify({ id: item.id, showInPortal: next }) });
      if (!res.ok) throw new Error();
      sileo.success({ title: next ? "Ahora se ve en el portal" : "Oculto en el portal" });
    } catch {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, showInPortal: !next } : x)));
      sileo.error({ title: "No se pudo cambiar" });
    }
  };

  const loadItems = async () => {
    try { const res = await apiFetch("/api/inventory"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["InventoryItem", "SerialUnit"], () => loadItems());

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "admin" && parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed);
    // Load branches for superadmin
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsed.branchId || ""); }

    const tipo = new URLSearchParams(window.location.search).get("tipo");
    if (tipo === "part" || tipo === "product") setTypeFilter(tipo);
    loadItems();
    // Load categories from API (persisted in DB)
    apiFetch("/api/inventory/categories")
      .then(r => r.json())
      .then(d => {
        if (d.categories?.length) {
          setCategories(d.categories);
        } else {
          // API empty — check sessionStorage for migration
          const saved = sessionStorage.getItem("inventoryCategories");
          if (saved) {
            try {
              const cats = JSON.parse(saved);
              if (Array.isArray(cats) && cats.length > 0) {
                setCategories(cats);
                // Migrate to DB
                apiFetch("/api/inventory/categories", {
                  method: "POST",
                  body: JSON.stringify({ categories: cats }),
                }).then(r=>r.json()).then(d=>{ console.log("Migrated to DB:", d); }).catch(e=>console.error("Migration error:", e));
              }
            } catch {}
          }
        }
      })
      .catch(() => {
        const saved = sessionStorage.getItem("inventoryCategories");
        if (saved) try { setCategories(JSON.parse(saved)); } catch {}
      });

    // Force sync: after 2s, if categories are loaded, save them to DB
    setTimeout(() => {
      const saved = sessionStorage.getItem("inventoryCategories");
      if (saved) {
        try {
          const cats = JSON.parse(saved);
          if (Array.isArray(cats) && cats.length > 0) {
            console.log("Force syncing categories to DB:", cats.length, "items");
            apiFetch("/api/inventory/categories", {
              method: "POST",
              body: JSON.stringify({ categories: cats }),
            }).then(r=>r.json()).then(d=>{ 
              if (d.ok) console.log("✓ Categories synced to DB. Key:", d.key);
              else console.error("✗ Sync failed:", d);
            }).catch(e=>console.error("✗ Sync error:", e));
          }
        } catch {}
      }
    }, 2000);

    const savedForm = sessionStorage.getItem("inventoryFormData");
    if (savedForm) {
      try {
        const data = (() => { try { return JSON.parse(savedForm); } catch { return null; } })();
        setEditingId(data.editingId || null);
        setName(data.name || "");
        setCategory(data.category || "");
        setQuantity(data.quantity || "");
        setPrice(data.price || ""); setCost(data.cost || "");
        setMinStock(data.minStock || "5");
        setImageUrls(data.imageUrls || []);
        setImagePreviews(data.imagePreviews || []);
        setShowForm(true);
      } catch {}
      sessionStorage.removeItem("inventoryFormData");
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

  const saveCategories = (cats: string[]) => {
    setCategories(cats);
    // Persist to sessionStorage as cache
    sessionStorage.setItem("inventoryCategories", JSON.stringify(cats));
    // Persist to DB
    apiFetch("/api/inventory/categories", {
      method: "POST",
      body: JSON.stringify({ categories: cats }),
    }).then(r => r.json()).then(d => {
      if (!d.ok) console.error("Save categories failed:", d);
    }).catch(e => console.error("Save categories error:", e));
  };
  const addCategory = () => { const t = newCategoryName.trim(); if (!t) return; if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; } saveCategories([...categories, t]); setNewCategoryName(""); sileo.success({ title: `"${t}" creada` }); };
  const deleteCategory = async (idx: number) => { const cat = categories[idx]; if (!await askConfirm(`¿Eliminar "${cat}"?`)) return; saveCategories(categories.filter((_, i) => i !== idx)); if (filterCategory === cat) setFilterCategory("all"); sileo.success({ title: `"${cat}" eliminada` }); };
  const saveEditCategory = (idx: number) => { const t = editingCatName.trim(); if (!t || t === categories[idx]) { setEditingCatIdx(null); return; } if (categories.includes(t)) { sileo.error({ title: "Ya existe" }); return; } const old = categories[idx]; const u = [...categories]; u[idx] = t; saveCategories(u); if (filterCategory === old) setFilterCategory(t); setEditingCatIdx(null); sileo.success({ title: `Renombrada` }); };

  const resetForm = () => { setName(""); setCategory(""); setQuantity(""); setPrice(""); setCost(""); setMinStock("5"); setImageUrls([]); setImagePreviews([]); setEditingId(null); setShowForm(false); setFormKind(isPart ? "part" : "product"); };

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
    sessionStorage.setItem("inventoryFormData", JSON.stringify({ editingId, name, category, quantity, price, cost, minStock, imageUrls, imagePreviews }));
    sessionStorage.setItem("cameraReturnUrl", "/inventory");
    window.location.href = "/camera.html";
  };

  const removeImage = (idx: number) => { setImageUrls(prev => prev.filter((_, i) => i !== idx)); setImagePreviews(prev => prev.filter((_, i) => i !== idx)); };

  const saveItem = async () => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    if (!name.trim()) { sileo.error({ title: "Nombre es requerido" }); return; }
    const imageData = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] || null;
    const qty = parseInt(quantity) || 0;
    try {
      if (editingId) {
        const res = await apiFetch("/api/inventory", { method: "PATCH", body: JSON.stringify({ id: editingId, name, category, quantity: qty, price, cost, minStock, image: imageData, kind: formKind }) });
        if (res.ok) { sileo.success({ title: "Item actualizado" }); resetForm(); loadItems(); }
      } else {
        const res = await apiFetch("/api/inventory", { method: "POST", body: JSON.stringify({ name, category, quantity: qty, price, cost, minStock, image: imageData, kind: formKind }) });
        if (res.ok) { sileo.success({ title: "Item agregado" }); resetForm(); loadItems(); }
      }
    } catch { sileo.error({ title: "Error de conexión" }); }
  };

  const editItem = (item: InventoryItem) => {
    setEditingId(item.id); setName(item.name); setCategory(item.category || ""); setFormKind(item.kind === "part" ? "part" : "product");
    setQuantity(String(item.quantity)); setPrice(String(item.price)); setCost(item.cost ? String(item.cost) : ""); setMinStock(String(item.minStock));
    const imgs = parseImages(item.image);
    setImageUrls(imgs); setImagePreviews(imgs);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!await askConfirm("¿Eliminar este item?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try { const res = await apiFetch("/api/inventory", { method: "DELETE", body: JSON.stringify({ id }) }); if (res.ok) { sileo.success({ title: "Eliminado" }); loadItems(); } } catch {}
  };

  const updateQuantity = async (id: string, delta: number) => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    const item = items.find(i => i.id === id); if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    try { await apiFetch("/api/inventory", { method: "PATCH", body: JSON.stringify({ id, quantity: newQty }) }); loadItems(); } catch {}
  };

  const typeOf = (i: InventoryItem) => (i.kind === "part" ? "part" : "product");
  const typeItems = typeFilter === "all" ? items : items.filter(i => typeOf(i) === typeFilter);
  const typeCounts = { all: items.length, product: items.filter(i => typeOf(i) === "product").length, part: items.filter(i => typeOf(i) === "part").length };
  const changeType = (t: TypeFilter) => {
    setTypeFilter(t);
    const url = new URL(window.location.href);
    if (t === "all") url.searchParams.delete("tipo"); else url.searchParams.set("tipo", t);
    window.history.replaceState(null, "", url.toString());
  };

  const filteredItems = typeItems.filter(item => {
    const matchSearch = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === "all" || item.category === filterCategory;
    return matchSearch && matchCategory;
  }).sort((a, b) => byName(a.name, b.name));
  const { gridProps, pageSize } = useCatalogGrid();
  const paged = usePaged(filteredItems, pageSize, `${typeFilter}|${searchQuery}|${filterCategory}`);

  const lowStock = typeItems.filter(i => i.quantity <= i.minStock).length;
  const usedCategories = [...new Set(typeItems.map(i => i.category).filter(Boolean))] as string[];

  if (!user) return <PageSkeleton />;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
{viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Producto" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)" }} />
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
        @media(max-width:560px){
          .inv-type-tabs{display:flex!important;width:100%;box-sizing:border-box}
          .inv-type-tab{flex:1;justify-content:center;padding:8px 6px!important;font-size:12px!important;gap:5px!important}
        }
      `}</style>

      
      <AppSidebar user={user} />


      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Inventario</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Productos a la venta y repuestos para reparaciones, en un solo stock. En el portal se muestran en pestañas separadas.</p>
        </div>
        <div role="tablist" aria-label="Filtrar por tipo" className="inv-type-tabs" style={{ display: "inline-flex", gap: 4, padding: 4, marginBottom: 18, background: "#ffffff", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 1px 3px rgba(30,42,58,0.05)", maxWidth: "100%" }}>
          {TYPE_TABS.map(t => {
            const on = typeFilter === t.key;
            return (
              <button key={t.key} role="tab" aria-selected={on} onClick={() => changeType(t.key)} className="inv-type-tab"
                style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, background: on ? "var(--text-primary)" : "transparent", color: on ? "#ffffff" : "var(--text-secondary)", transition: "background 0.15s, color 0.15s" }}>
                {t.label}
                <span style={{ minWidth: 22, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: on ? "rgba(255,255,255,0.18)" : "var(--bg-hover)", color: on ? "#ffffff" : "var(--text-secondary)" }}>{typeCounts[t.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: isPart ? "Repuestos" : typeFilter === "product" ? "Productos" : "Items", value: typeItems.length, color: "#2563eb" },
            { label: "Categorías", value: usedCategories.length, color: "#047857" },
            { label: "Stock bajo", value: lowStock, color: "#b45309", alert: lowStock > 0 },
            
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.alert ? s.color : "var(--text-primary)", marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="cat-tools" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)", flex: 1, maxWidth: 300 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
              <input aria-label="Buscar artículo" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={isPart ? "Buscar repuesto..." : "Buscar item..."} style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <select aria-label="Filtrar por categoría" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todas las categorías</option>
              {(categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="cat-actions" style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowPurchase(true)} style={{ padding: "8px 14px", background: lowStock ? "rgba(245,158,11,0.10)" : "rgba(100,116,139,0.06)", border: `1px solid ${lowStock ? "rgba(245,158,11,0.35)" : "rgba(100,116,139,0.15)"}`, borderRadius: 10, color: lowStock ? "var(--warn)" : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ShoppingCart size={14} strokeWidth={STROKE} aria-hidden="true" /> Lista de compra{lowStock ? ` (${lowStock})` : ""}</button>
            <button onClick={() => window.open(typeFilter === "all" ? "/inventory/print" : `/inventory/print?kind=${typeFilter}`, "_blank")} style={{ padding: "8px 14px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 10, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Extracto</button>
            <button onClick={() => setShowCategoryPanel(!showCategoryPanel)} style={{ padding: "8px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "var(--ok)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Categorías</button>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "8px 14px", background: "var(--info-bright)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>＋ Nuevo</button>
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
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Toca el lápiz para editar o la X para eliminar:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(categories || []).map((cat, idx) => (
                <div key={idx} style={{ padding: "5px 8px", borderRadius: 8, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.1)", fontSize: 11, fontWeight: 600, color: "var(--info-bright)", display: "flex", alignItems: "center", gap: 6 }}>
                  {editingCatIdx === idx ? (
                    <input aria-label="Nombre de la categoría" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditCategory(idx); if (e.key === "Escape") setEditingCatIdx(null); }} onBlur={() => saveEditCategory(idx)} autoFocus style={{ width: 100, padding: "2px 6px", background: "var(--bg-tertiary)", border: "1px solid var(--info-bright)", borderRadius: 4, color: "var(--text-primary)", fontSize: 11, outline: "none" }} />
                  ) : (
                    <>{cat}<span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Editar" onClick={() => { setEditingCatIdx(idx); setEditingCatName(cat); }} style={{ cursor: "pointer", fontSize: 11 }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /></span><span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Eliminar" onClick={() => deleteCategory(idx)} style={{ cursor: "pointer", fontSize: 11, color: "var(--danger-bright)", fontWeight: 700 }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></span></>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showForm && (() => {
          const part = formKind === "part";
          const margin = Number(cost) > 0 && Number(price) > 0 ? Math.round((Number(price) - Number(cost)) * 100) / 100 : null;
          return (
          <FormModal icon={editingId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : part ? <Cog size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Package size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={resetForm}
            title={editingId ? (part ? "Editar repuesto" : "Editar producto") : (part ? "Nuevo repuesto" : "Nuevo producto")}
            subtitle={name || (part ? "Piezas que se usan en las reparaciones" : "Productos que se venden en mostrador")}
            footer={<>
              <button type="button" className="ox-ghost" onClick={resetForm}>Cancelar</button>
              <SaveButton onClick={saveItem} disabled={uploading}>{editingId ? "Guardar cambios" : part ? "Agregar repuesto" : "Agregar producto"}</SaveButton>
            </>}>
            <FormSection icon={<Tag size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Qué es">
              <div className="ox-chips" role="group" aria-label="Tipo" style={{ marginBottom: 12 }}>
                <button type="button" className="ox-chip" aria-pressed={!part} onClick={() => setFormKind("product")}><span className="e" aria-hidden="true"><Package size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Producto (se vende)</button>
                <button type="button" className="ox-chip" aria-pressed={part} onClick={() => setFormKind("part")}><span className="e" aria-hidden="true"><Cog size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Repuesto (para reparar)</button>
              </div>
              <Field label="Nombre" required><input className="ox-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <span className="ox-label" style={{ marginTop: 12 }}>Categoría</span>
              <div className="ox-chips" role="group" aria-label="Categoría">
                <button type="button" className="ox-chip" aria-pressed={!category} onClick={() => setCategory("")}>Sin categoría</button>
                {[...categories, ...(category && !categories.includes(category) ? [category] : [])].map(cat => <button key={cat} type="button" className="ox-chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</button>)}
              </div>
            </FormSection>

            <FormSection icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Precios">
              <div className="ox-row">
                <Field label="Precio de venta (Bs.)"><input className="ox-input tabular" value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" inputMode="decimal" /></Field>
                <Field label="Precio de compra (Bs.)" hint="Sirve para calcular la ganancia"><input className="ox-input tabular" value={cost} onChange={(e) => setCost(e.target.value)} type="number" min="0" inputMode="decimal" /></Field>
              </div>
              {margin !== null && (
                <div className={`ox-note ${margin >= 0 ? "ok" : "warn"}`} style={{ marginTop: 12 }}>
                  {margin >= 0 ? <TrendingUp size={18} strokeWidth={STROKE} aria-hidden="true" /> : <TriangleAlert size={18} strokeWidth={STROKE} aria-hidden="true" />} Ganancia por unidad: <b className="tabular">Bs. {margin}</b> ({Math.round((margin / Number(price)) * 100)}%)
                </div>
              )}
            </FormSection>

            <FormSection icon={<Boxes size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Stock">
              <div className="ox-row">
                <Field label="Cantidad en tienda"><input className="ox-input tabular" value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="0" inputMode="numeric" /></Field>
                <Field label="Avisar cuando queden" hint="Stock mínimo"><input className="ox-input tabular" value={minStock} onChange={(e) => setMinStock(e.target.value)} type="number" min="0" inputMode="numeric" /></Field>
              </div>
            </FormSection>

            <FormSection icon={<Camera size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Fotos del producto">
              <FormPhotos previews={imagePreviews} onRemove={removeImage} onCamera={handleTakePhoto} inputRef={fileInputRef} onSelect={handleImageSelect} uploading={uploading} />
            </FormSection>
          </FormModal>
          ); })()}

        {loading ? (
          <CatalogSkeleton />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>{isPart ? <Cog size={48} strokeWidth={1.5} aria-hidden="true" /> : <Package size={48} strokeWidth={1.5} aria-hidden="true" />}</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{searchQuery || filterCategory !== "all" ? "Sin resultados con este filtro" : isPart ? "No hay repuestos todavía" : typeFilter === "product" ? "No hay productos todavía" : "No hay items en el inventario"}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>{isPart ? "Agrega tu primer repuesto (pantallas, baterías, memorias…)" : "Agrega tu primer producto"}</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--info-bright)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar</button>
          </div>
        ) : (
          <><div {...gridProps}>
            {paged.items.map((item, i) => {
              const isLow = item.quantity <= item.minStock;
              const imgs = parseImages(item.image);
              const firstImg = imgs[0] || null;
              return (
                <div key={item.id} style={{ background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${isLow ? "rgba(239,68,68,0.2)" : "var(--border)"}`, overflow: "hidden", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, position: "relative" }}>
                  <div className="cat-badges">
                    <div className="cat-badges-row">
                      {isLow && <div style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.9)", color: "#fff", fontSize: 11, fontWeight: 700 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Stock Bajo</div>}
                      {item.category && <div style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, background: "rgba(59,130,246,0.85)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.category}</div>}
                      {imgs.length > 1 && <div style={{ marginLeft: item.category ? undefined : "auto", padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}
                    </div>
                    {item.showInPortal === false && <div style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(30,42,58,0.88)", color: "#fff", fontSize: 11, fontWeight: 700 }}><EyeOff size={14} strokeWidth={STROKE} aria-hidden="true" /> Oculto en portal</div>}
                  </div>
                  <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className={firstImg ? "cat-img" : "cat-img cat-noimg"} onClick={() => firstImg && setViewImage(firstImg)} style={{ width: "100%", aspectRatio: "1/1", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: firstImg ? "pointer" : "default" }}>
                    {firstImg ? (<img loading="lazy" decoding="async" src={firstImg} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 48, opacity: 0.15 }}><Package size={48} strokeWidth={1.5} aria-hidden="true" /></span><span className="cat-noimg-txt" style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>Sin imagen</span></div>)}
                    <div className="cat-pricebar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 14px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.8))", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Bs. {item.price}</div>{typeFilter === "all" && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: item.kind === "part" ? "var(--warn-bright)" : "#ffffff", color: item.kind === "part" ? "var(--text-primary)" : "var(--text-primary)" }}>{item.kind === "part" ? "Repuesto" : "Producto"}</span>}</div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.3 }}>{item.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "8px 10px", background: "var(--bg-tertiary)", borderRadius: 10 }}>
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: isLow ? "var(--danger-bright)" : "var(--ok-bright)" }}>{item.quantity}</div><div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>En stock</div></div>
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => editItem(item)} style={{ flex: 1, padding: "8px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", borderRadius: 8, color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="cat-lbl"> Editar</span></button>
                      <button onClick={() => togglePortal(item)} aria-pressed={item.showInPortal !== false}
                        title={item.showInPortal !== false ? "Visible en el portal: tocar para ocultarlo" : "Oculto en el portal: tocar para mostrarlo"}
                        aria-label={item.showInPortal !== false ? "Ocultar del portal" : "Mostrar en el portal"}
                        style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 4, background: item.showInPortal !== false ? "rgba(16,185,129,0.08)" : "rgba(100,116,139,0.10)", border: `1px solid ${item.showInPortal !== false ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.3)"}`, borderRadius: 8, color: item.showInPortal !== false ? "var(--ok)" : "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {item.showInPortal !== false
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19" /><path d="M6.61 6.61A17.5 17.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>}
                        <span className="cat-lbl">{item.showInPortal !== false ? "Portal" : "Oculto"}</span>
                      </button>
                      <button onClick={() => setHistoryOf(item)} title="Movimientos de stock" aria-label="Movimientos de stock" style={{ padding: "8px 10px", background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.18)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><History size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                      <button onClick={() => deleteItem(item.id)} style={{ padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></>
        )}
      </div>
      {historyOf && <StockHistory itemId={historyOf.id} onClose={() => setHistoryOf(null)} />}
      {showPurchase && <PurchaseList kind={typeFilter} onClose={() => setShowPurchase(false)} />}
    </div>
  );
}
