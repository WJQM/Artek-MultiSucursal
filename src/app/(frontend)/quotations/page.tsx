"use client";
import { Banknote, ClipboardList, Disc3, Gamepad2, Joystick, Laptop, Mail, MessageCircle, Package, PenLine, Pencil, Printer, QrCode, Receipt, Search, ShoppingCart, Trash2, User, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { AppIcon } from "@/frontend/components/icons";
import { sileo } from "@/frontend/lib/toast";
import EmailSend from "@/frontend/components/EmailSend";
import QuotationWhatsApp from "@/frontend/components/QuotationWhatsApp";
import PaymentPicker from "@/frontend/components/PaymentPicker";
import { apiFetch, setActiveBranchId } from "@/frontend/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";

interface User { id: string; name: string; email: string; role: string; }
interface InventoryItemData { id: string; name: string; category: string | null; quantity: number; price: number; minStock: number; image: string | null; }
interface EquipmentData { id: string; name: string; type: string; brand: string | null; model: string | null; processor: string | null; ram: string | null; storage: string | null; price: number; condition: string; image: string | null; }
interface ConsoleData { id: string; name: string; brand: string | null; model: string | null; storage: string | null; state: string | null; price: number; condition: string; }
interface ServiceData { id: string; name: string; price: number; icon: string; }
interface PricedCatalogData { id: string; name: string; price: number | null; category?: string | null; platform?: string | null; }
type LineKind = "inventory" | "equipment" | "console" | "service" | "software" | "videogame" | "custom";
interface QuotationItem { inventoryId: string; name: string; price: number; qty: number; stock: number; isEquipment?: boolean; kind?: LineKind; }

// Documentos antiguos no tienen "kind": se deduce de isEquipment
const lineKind = (i: QuotationItem): LineKind => i.kind ?? (i.isEquipment ? "equipment" : "inventory");
const lineKey = (i: QuotationItem) => `${lineKind(i)}:${i.inventoryId}`;
const isUniqueLine = (i: QuotationItem) => { const k = lineKind(i); return k === "equipment" || k === "console"; };

const LINE_ICON: Record<LineKind, AppIcon> = { inventory: Package, equipment: Laptop, console: Joystick, service: Wrench, software: Disc3, videogame: Gamepad2, custom: PenLine };
/** Ícono de línea del tipo de artículo (repuesto, equipo, consola…). */
function LineIcon({ kind, size = 14 }: { kind: LineKind; size?: number }) {
  const I = LINE_ICON[kind];
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}
const LINE_META: Record<LineKind, { tag: string; color: string; tint: string }> = {
  inventory: { tag: "", color: "#b45309", tint: "rgba(245,158,11,0.10)" },
  equipment: { tag: "Equipo", color: "#2563eb", tint: "rgba(59,130,246,0.10)" },
  console: { tag: "Consola", color: "#ea580c", tint: "rgba(249,115,22,0.10)" },
  service: { tag: "Servicio", color: "#0f766e", tint: "rgba(20,184,166,0.10)" },
  software: { tag: "Programa", color: "#0369a1", tint: "rgba(3,105,161,0.10)" },
  videogame: { tag: "Videojuego", color: "#dc2626", tint: "rgba(239,68,68,0.10)" },
  custom: { tag: "Otro", color: "#475569", tint: "rgba(100,116,139,0.10)" },
};

/** Recuadro plegable para elegir artículos de una sección del catálogo */
function PickerBox({ icon, title, open, onToggle, count, children }: { icon: React.ReactNode; title: string; tint?: string; open: boolean; onToggle: () => void; count: number; children: React.ReactNode }) {
  return (
    <section className="ox-sec">
      <button type="button" className="ox-fold-h" onClick={onToggle} aria-expanded={open}>
        <span className="ox-e" aria-hidden="true">{icon}</span>{title}
        {count > 0 && <span className="cnt">{count}</span>}
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      {open && <div className="ox-fold-b">{children}</div>}
    </section>
  );
}

function PickerSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="ox-search">
      <span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Borrar búsqueda" style={{ border: 0, background: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>}
    </div>
  );
}

// Líneas con precio editable en la cotización (servicios, instalaciones y conceptos libres).
// Artículos, equipos y consolas mantienen el precio del catálogo.
const PRECIO_EDITABLE: string[] = ["service", "software", "videogame", "custom"];

function PriceInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [txt, setTxt] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    const actual = txt.trim() === "" ? 0 : parseFloat(txt.replace(",", "."));
    if (actual !== value) setTxt(String(value));
  }
  return (
    <input className="ox-input tabular" inputMode="decimal" aria-label={label} value={txt}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^\d*[.,]?\d{0,2}$/.test(t)) return;
        setTxt(t);
        const n = parseFloat(t.replace(",", "."));
        onChange(Number.isFinite(n) ? n : 0);
      }}
      style={{ width: 76, padding: "4px 8px", fontSize: 13, height: "auto" }} />
  );
}

function PickerCard({ selected, mark, onClick, title, sub, low, price }: { selected: boolean; mark: string; onClick: () => void; title: string; sub?: string; low?: boolean; price: number }) {
  return (
    <button type="button" className="ox-item" aria-pressed={selected} onClick={onClick}>
      <span className="q" aria-hidden="true">{selected ? (mark || "✓") : "＋"}</span>
      <b>{title}{sub && <small className={low ? "low" : undefined}>{sub}</small>}</b>
      <span className="p tabular">Bs. {price}</span>
    </button>
  );
}
interface Quotation { id: string; code: string; type: "quotation" | "sale"; clientName: string; clientPhone: string; items: QuotationItem[]; total: number; notes: string; createdAt: string; paidWith?: "cash" | "qr" | null; }

export default function QuotationsPage() {
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [mailFor, setMailFor] = useState<string | null>(null);
  const [waFor, setWaFor] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItemData[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentData[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"quotation" | "sale">("quotation");
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<QuotationItem[]>([]);
  const [searchInventory, setSearchInventory] = useState("");
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [searchEquipment, setSearchEquipment] = useState("");
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [consoleList, setConsoleList] = useState<ConsoleData[]>([]);
  const [searchConsole, setSearchConsole] = useState("");
  const [showConsolePicker, setShowConsolePicker] = useState(false);
  const [serviceList, setServiceList] = useState<ServiceData[]>([]);
  const [searchService, setSearchService] = useState("");
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [softwareList, setSoftwareList] = useState<PricedCatalogData[]>([]);
  const [videogameList, setVideogameList] = useState<PricedCatalogData[]>([]);
  const [searchSoftware, setSearchSoftware] = useState("");
  const [searchVideogame, setSearchVideogame] = useState("");
  const [showSoftwarePicker, setShowSoftwarePicker] = useState(false);
  const [showVideogamePicker, setShowVideogamePicker] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);

  const [filterType, setFilterType] = useState<"all" | "quotation" | "sale">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [qPage, setQPage] = useState(1);
  const Q_PAGE_SIZE = 10;

  const filteredInventory = inventoryList.filter(item =>
    item.quantity > 0 && (searchInventory === "" || item.name.toLowerCase().includes(searchInventory.toLowerCase()) || (item.category || "").toLowerCase().includes(searchInventory.toLowerCase()))
  );

  const filteredEquipment = equipmentList.filter(item =>
    item.condition === "disponible" && (searchEquipment === "" || item.name.toLowerCase().includes(searchEquipment.toLowerCase()) || (item.brand || "").toLowerCase().includes(searchEquipment.toLowerCase()) || (item.model || "").toLowerCase().includes(searchEquipment.toLowerCase()))
  );

  const matches = (q: string, ...fields: (string | null | undefined)[]) => q === "" || fields.some(f => (f || "").toLowerCase().includes(q.toLowerCase()));
  const filteredConsoles = consoleList.filter(c => c.condition === "disponible" && matches(searchConsole, c.name, c.brand, c.model));
  const filteredServices = serviceList.filter(sv => matches(searchService, sv.name));
  // Programas y videojuegos: todos (la cotización cobra su instalación)
  const filteredSoftware = softwareList.filter(x => matches(searchSoftware, x.name, x.category));
  const filteredVideogames = videogameList.filter(x => matches(searchVideogame, x.name, x.platform));
  // Programas y juegos no tienen precio propio: se cobra la instalación con el precio del servicio
  // "Instalación de programas" / "Instalación de juegos" (Catálogo → Servicios), editable en cada línea.
  const servicioInstalacion = (kind: "software" | "videogame") =>
    serviceList.find(sv => /instalaci[oó]n/i.test(sv.name) && (kind === "videogame" ? /juego/i : /programa|software/i).test(sv.name)) || null;
  const precioInstalacion = (kind: "software" | "videogame") => servicioInstalacion(kind)?.price ?? 0;

  // El servidor filtra y pagina (antes llegaban todas las cotizaciones y ventas de la sucursal)
  const [qTotal, setQTotal] = useState(0);
  const [qStats, setQStats] = useState({ quotation: 0, sale: 0 });
  const [qSearch, setQSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setQSearch(searchQuery.trim()), 300); return () => clearTimeout(t); }, [searchQuery]);
  const filteredQuotations = quotations;
  const qTotalPages = Math.ceil(qTotal / Q_PAGE_SIZE);
  const paginatedQuotations = quotations;
  const goQPage = (p: number) => { setQPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const total = selectedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const addItem = (inv: InventoryItemData) => {
    const existing = selectedItems.find(i => i.inventoryId === inv.id && lineKind(i) === "inventory");
    if (existing) {
      if (existing.qty < inv.quantity) {
        setSelectedItems(prev => prev.map(i => i.inventoryId === inv.id && lineKind(i) === "inventory" ? { ...i, qty: i.qty + 1 } : i));
      } else { sileo.warning({ title: "Stock insuficiente" }); }
      return;
    }
    setSelectedItems(prev => [...prev, { inventoryId: inv.id, name: inv.name, price: inv.price, qty: 1, stock: inv.quantity, kind: "inventory" }]);
  };

  const updatePrice = (key: string, price: number) =>
    setSelectedItems(prev => prev.map(i => lineKey(i) === key ? { ...i, price: Math.max(0, Math.round(price * 100) / 100) } : i));
  const updateQty = (key: string, newQty: number) => {
    const item = selectedItems.find(i => lineKey(i) === key);
    if (!item) return;
    if (newQty <= 0) { removeItem(key); return; }
    if (lineKind(item) === "inventory") {
      const inv = inventoryList.find(i => i.id === item.inventoryId);
      // En una venta ya guardada, lo que ya estaba descontado también cuenta como disponible
      const already = editingQuotation?.type === "sale" ? (editingQuotation.items.find(o => lineKey(o) === key)?.qty || 0) : 0;
      const maxStock = (inv?.quantity ?? item.stock) + already;
      if (newQty > maxStock) { sileo.warning({ title: "Stock insuficiente" }); return; }
    }
    setSelectedItems(prev => prev.map(i => lineKey(i) === key ? { ...i, qty: newQty } : i));
  };

  const removeItem = (key: string) => {
    setSelectedItems(prev => prev.filter(i => lineKey(i) !== key));
  };

  const addConsole = (c: ConsoleData) => {
    if (selectedItems.find(i => i.inventoryId === c.id && lineKind(i) === "console")) { removeItem(`console:${c.id}`); return; }
    setSelectedItems(prev => [...prev, { inventoryId: c.id, name: c.name, price: c.price, qty: 1, stock: 1, kind: "console" }]);
  };

  const addService = (sv: ServiceData) => {
    // Con el estado más reciente: dos toques rápidos suman cantidad en vez de duplicar la línea
    setSelectedItems(prev => prev.some(i => i.inventoryId === sv.id && lineKind(i) === "service")
      ? prev.map(i => i.inventoryId === sv.id && lineKind(i) === "service" ? { ...i, qty: i.qty + 1 } : i)
      : [...prev, { inventoryId: sv.id, name: sv.name, price: sv.price, qty: 1, stock: 0, kind: "service" }]);
  };

  // Programas / videojuegos: se cobran por instalación, así que llevan cantidad
  const addCatalogLine = (kind: "software" | "videogame", x: PricedCatalogData) => {
    const name = kind === "videogame" && x.platform ? `${x.name} (${x.platform})` : x.name;
    setSelectedItems(prev => prev.some(i => i.inventoryId === x.id && lineKind(i) === kind)
      ? prev.map(i => i.inventoryId === x.id && lineKind(i) === kind ? { ...i, qty: i.qty + 1 } : i)
      : [...prev, { inventoryId: x.id, name: `Instalación: ${name}`, price: precioInstalacion(kind), qty: 1, stock: 0, kind }]);
  };

  const addCustom = () => {
    const name = customName.trim();
    const price = parseFloat(customPrice.replace(",", "."));
    if (!name) { sileo.warning({ title: "Escribe la descripción" }); return; }
    if (!Number.isFinite(price) || price < 0) { sileo.warning({ title: "Ingresa un precio válido" }); return; }
    setSelectedItems(prev => [...prev, { inventoryId: `c${Date.now().toString(36)}`, name, price: Math.round(price * 100) / 100, qty: 1, stock: 0, kind: "custom" }]);
    setCustomName(""); setCustomPrice("");
  };

  const addEquipment = (eq: EquipmentData) => {
    const existing = selectedItems.find(i => i.inventoryId === eq.id && i.isEquipment);
    if (existing) { sileo.warning({ title: "Equipo ya agregado" }); return; }
    setSelectedItems(prev => [...prev, { inventoryId: eq.id, name: eq.name, price: eq.price, qty: 1, stock: 1, isEquipment: true, kind: "equipment" }]);
  };



  const openCreateModal = (type: "quotation" | "sale") => {
    setModalType(type); setEditingQuotation(null); setShowModal(true);
    setClientName(""); setClientPhone(""); setNotes("");
    setSelectedItems([]); setSearchInventory(""); setShowInventoryPicker(false); setSearchEquipment(""); setShowEquipmentPicker(false); setSearchConsole(""); setShowConsolePicker(false); setSearchService(""); setShowServicePicker(false); setShowSoftwarePicker(false); setShowVideogamePicker(false); setSearchSoftware(""); setSearchVideogame(""); setShowCustomPicker(false); setCustomName(""); setCustomPrice("");
  };

  const openEditModal = (q: Quotation) => {
    setEditingQuotation(q); setModalType(q.type); setShowModal(true);
    setClientName(q.clientName); setClientPhone(q.clientPhone); setNotes(q.notes);
    setSelectedItems(q.items.map(item => ({ ...item })));
    setSearchInventory(""); setShowInventoryPicker(false); setSearchEquipment(""); setShowEquipmentPicker(false); setSearchConsole(""); setShowConsolePicker(false); setSearchService(""); setShowServicePicker(false); setShowSoftwarePicker(false); setShowVideogamePicker(false); setSearchSoftware(""); setSearchVideogame(""); setShowCustomPicker(false); setCustomName(""); setCustomPrice("");
    setViewQuotation(null);
  };

  const reloadInventory = async () => {
    try { const res = await apiFetch("/api/inventory"); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setInventoryList(data); } } catch {}
  };

  const loadQuotations = async () => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const p = new URLSearchParams({ page: String(qPage), limit: String(Q_PAGE_SIZE) });
      if (filterType !== "all") p.set("type", filterType);
      if (qSearch) p.set("search", qSearch);
      const res = await apiFetch(`/api/quotations?${p}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.quotations)) {
          if (data.quotations.length === 0 && data.total > 0 && qPage > 1) { setQPage(data.totalPages); return; }
          setQuotations(data.quotations); setQTotal(data.total || 0); if (data.stats) setQStats(data.stats);
        }
      }
    } catch {}
    setLoading(false);
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Quotation"], () => loadQuotations());
  useEffect(() => { if (!user) return; const t = setTimeout(() => { void loadQuotations(); }, 0); return () => clearTimeout(t); }, [user, qPage, filterType, qSearch, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado
  
  // El stock y los equipos/consolas vendidos los actualiza el servidor al guardar (en una sola operación)
  const afterStockChange = async () => { await Promise.all([reloadInventory(), reloadEquipment(), reloadConsoles()]); };
  const stockError = async (res: Response) => { const d = await res.json().catch(() => ({})); sileo.warning({ title: d.error || "No se pudo guardar" }); };

  const saveQuotation = async () => {
    if (selectedItems.length === 0) { sileo.warning({ title: "Agrega al menos un artículo" }); return; }
    if (!clientName.trim()) { sileo.warning({ title: "Ingresa el nombre del cliente" }); return; }
    const token = sessionStorage.getItem("token"); if (!token) return;

    if (editingQuotation) {
      try {
        const res = await apiFetch("/api/quotations", { method: "PATCH", body: JSON.stringify({ id: editingQuotation.id, type: modalType, clientName: clientName.trim(), clientPhone: clientPhone.trim(), items: selectedItems, total, notes: notes.trim(), code: editingQuotation.code }) });
        if (res.ok) { await afterStockChange(); await loadQuotations(); setShowModal(false); sileo.success({ title: "Documento actualizado" }); }
        else await stockError(res);
      } catch {}
    } else {
      try {
        const res = await apiFetch("/api/quotations", { method: "POST", body: JSON.stringify({ type: modalType, clientName: clientName.trim(), clientPhone: clientPhone.trim(), items: selectedItems, total, notes: notes.trim() }) });
        if (res.ok) { if (modalType === "sale") await afterStockChange(); await loadQuotations(); setShowModal(false); sileo.success({ title: modalType === "quotation" ? "Cotización creada" : "Nota de venta registrada" }); }
        else await stockError(res);
      } catch {}
    }
  };

  const deleteQuotation = async (q: Quotation) => {
    const isSale = q.type === "sale";
    if (!await askConfirm(isSale ? "¿Eliminar esta nota de venta? Los artículos vuelven al stock y los equipos/consolas quedan disponibles otra vez." : "¿Eliminar este documento?")) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const res = await apiFetch(`/api/quotations?id=${q.id}`, { method: "DELETE" });
      if (res.ok) { if (isSale) await afterStockChange(); await loadQuotations(); setViewQuotation(null); sileo.success({ title: "Documento eliminado" }); }
    } catch {}
  };

  const convertToSale = async (quotation: Quotation) => {
    if (!await askConfirm("¿Convertir esta cotización en nota de venta? Se reducirá el stock.")) return;
    try {
      const res = await apiFetch("/api/quotations", { method: "PATCH", body: JSON.stringify({ id: quotation.id, type: "sale", code: quotation.code }) });
      if (res.ok) { await afterStockChange(); await loadQuotations(); setViewQuotation(null); sileo.success({ title: "Cotización convertida a nota de venta" }); }
      else await stockError(res);
    } catch {}
  };

  const reloadConsoles = async () => {
    try { const res = await apiFetch("/api/consoles"); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setConsoleList(data); } } catch {}
  };

  const reloadEquipment = async () => {
    try { const res = await apiFetch("/api/equipment"); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setEquipmentList(data); } } catch {}
  };

  const printDocument = (q: Quotation) => {
    // Doble copia (negocio + cliente) en hoja carta horizontal, como OT y CE
    window.open(`/quotations/copias/${q.code}?branchId=${activeBranch}`, "_blank");
  };

  // ═══ IMPRIMIR SOLO QR ═══
  const printQROnly = (q: Quotation) => {
    const urlType = q.type === "quotation" ? "cot" : "nv";
    const bid = activeBranch ? `?branchId=${activeBranch}` : "";
    window.open(`/print-qr/${urlType}/${q.code}${bid}`, "_blank");
  };

  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const _u = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (!_u || (_u.role !== "admin" && _u.role !== "superadmin")) { router.push(_u?.role === "tech" ? "/asignaciones" : "/"); return; }
    setUser(_u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    // Load branches for superadmin
    if (_u.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(_u.branchId || ""); }

    apiFetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
    apiFetch("/api/equipment").then(res => res.json()).then(data => { if (Array.isArray(data)) setEquipmentList(data); }).catch(() => {});
    apiFetch("/api/consoles").then(res => res.json()).then(data => { if (Array.isArray(data)) setConsoleList(data); }).catch(() => {});
    apiFetch("/api/services").then(res => res.json()).then(data => { if (Array.isArray(data)) setServiceList(data); }).catch(() => {});
    apiFetch("/api/software").then(res => res.json()).then(data => { if (Array.isArray(data)) setSoftwareList(data); }).catch(() => {});
    apiFetch("/api/videogames").then(res => res.json()).then(data => { if (Array.isArray(data)) setVideogameList(data); }).catch(() => {});
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const viewCode = params.get("view");
      if (viewCode) {
        apiFetch(`/api/quotations?code=${viewCode}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setViewQuotation(d); }).catch(() => {});
      }
    });
  }, [router]);
  
  if (!user) return <PageSkeleton />;
  const stats = { totalQuotations: qStats.quotation, totalSales: qStats.sale };

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
{/* ═══ MODAL CREAR / EDITAR ═══ */}
      {showModal && (
        <FormModal wide icon={modalType === "quotation" ? <ClipboardList size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Banknote size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={() => setShowModal(false)}
          title={`${editingQuotation ? "Editar" : "Nueva"} ${modalType === "quotation" ? "cotización" : "nota de venta"}`}
          subtitle={editingQuotation ? `Editando ${editingQuotation.code}` : modalType === "quotation" ? "Presupuesto para el cliente" : "Registra una venta de mostrador"}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <SaveButton onClick={saveQuotation}>{editingQuotation ? "Guardar cambios" : modalType === "quotation" ? "Crear cotización" : "Registrar venta"}{total > 0 && <span className="tabular"> · Bs. {total}</span>}</SaveButton>
          </>}>
          {editingQuotation && (
            <div className="ox-chips" role="group" aria-label="Tipo de documento">
              <button type="button" className="ox-chip" aria-pressed={modalType === "quotation"} onClick={() => setModalType("quotation")}><span className="e" aria-hidden="true"><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Cotización</button>
              <button type="button" className="ox-chip" aria-pressed={modalType === "sale"} onClick={() => setModalType("sale")}><span className="e" aria-hidden="true"><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Nota de venta</button>
            </div>
          )}

          <FormSection icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
            <div className="ox-row">
              <Field label="Nombre" required><input className="ox-input" value={clientName} onChange={(e) => setClientName(e.target.value)} /></Field>
              <Field label="Celular"><input className="ox-input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="tel" /></Field>
            </div>
          </FormSection>

          {/* ═══ PICKER DE ARTÍCULOS Y REPUESTOS ═══ */}
          <PickerBox icon={<Package size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Artículos y repuestos" open={showInventoryPicker} onToggle={() => setShowInventoryPicker(!showInventoryPicker)} count={selectedItems.filter(i => lineKind(i) === "inventory").length}>
            <PickerSearch value={searchInventory} onChange={setSearchInventory} placeholder="Buscar artículo..." />
            <div className="ox-list">
              {filteredInventory.map(item => { const inCart = selectedItems.find(i => i.inventoryId === item.id && lineKind(i) === "inventory"); return (
                <PickerCard key={item.id} selected={!!inCart} mark={String(inCart?.qty || "")} onClick={() => addItem(item)} title={item.name} sub={`${item.quantity <= item.minStock ? "" : ""}Stock: ${item.quantity}`} low={item.quantity <= item.minStock} price={item.price} />
              ); })}
            </div>
            {filteredInventory.length === 0 && <p className="ox-hint">No hay artículos disponibles.</p>}
          </PickerBox>

          {/* ═══ PICKER DE EQUIPOS ═══ */}
          <PickerBox icon={<Laptop size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Equipos" open={showEquipmentPicker} onToggle={() => setShowEquipmentPicker(!showEquipmentPicker)} count={selectedItems.filter(i => i.isEquipment).length}>
            <PickerSearch value={searchEquipment} onChange={setSearchEquipment} placeholder="Buscar equipo, marca, modelo..." />
            <div className="ox-list">
              {filteredEquipment.map(eq => (
                <PickerCard key={eq.id} selected={!!selectedItems.find(i => i.inventoryId === eq.id && i.isEquipment)} mark="✓" onClick={() => addEquipment(eq)} title={eq.name} sub={[eq.processor, eq.ram].filter(Boolean).join(" · ") || undefined} price={eq.price} />
              ))}
            </div>
            {filteredEquipment.length === 0 && <p className="ox-hint">No hay equipos disponibles.</p>}
          </PickerBox>

          {/* ═══ PICKER DE CONSOLAS ═══ */}
          <PickerBox icon={<Joystick size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Consolas" open={showConsolePicker} onToggle={() => setShowConsolePicker(!showConsolePicker)} count={selectedItems.filter(i => lineKind(i) === "console").length}>
            <PickerSearch value={searchConsole} onChange={setSearchConsole} placeholder="Buscar consola, marca, modelo..." />
            <div className="ox-list">
              {filteredConsoles.map(c => (
                <PickerCard key={c.id} selected={!!selectedItems.find(i => i.inventoryId === c.id && lineKind(i) === "console")} mark="✓" onClick={() => addConsole(c)} title={c.name} sub={[c.storage, c.state].filter(Boolean).join(" · ") || undefined} price={c.price} />
              ))}
            </div>
            {filteredConsoles.length === 0 && <p className="ox-hint">No hay consolas disponibles.</p>}
          </PickerBox>

          {/* ═══ PICKER DE SERVICIOS ═══ */}
          <PickerBox icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Servicios" open={showServicePicker} onToggle={() => setShowServicePicker(!showServicePicker)} count={selectedItems.filter(i => lineKind(i) === "service").length}>
            <PickerSearch value={searchService} onChange={setSearchService} placeholder="Buscar servicio..." />
            <div className="ox-list">
              {filteredServices.map(sv => { const inCart = selectedItems.find(i => i.inventoryId === sv.id && lineKind(i) === "service"); return (
                <PickerCard key={sv.id} selected={!!inCart} mark={String(inCart?.qty || "")} onClick={() => addService(sv)} title={sv.name} price={sv.price} />
              ); })}
            </div>
            {filteredServices.length === 0 && <p className="ox-hint">No hay servicios. Créalos en Catálogo → Servicios.</p>}
          </PickerBox>

          {/* ═══ PICKER DE PROGRAMAS ═══ */}
          <PickerBox icon={<Disc3 size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Programas" open={showSoftwarePicker} onToggle={() => setShowSoftwarePicker(!showSoftwarePicker)} count={selectedItems.filter(i => lineKind(i) === "software").length}>
            <PickerSearch value={searchSoftware} onChange={setSearchSoftware} placeholder="Buscar programa..." />
            <div className="ox-list">
              {filteredSoftware.map(x => { const inCart = selectedItems.find(i => i.inventoryId === x.id && lineKind(i) === "software"); return (
                <PickerCard key={x.id} selected={!!inCart} mark={String(inCart?.qty || "")} onClick={() => addCatalogLine("software", x)} title={x.name} sub={x.category || undefined} price={precioInstalacion("software")} />
              ); })}
            </div>
            {filteredSoftware.length === 0 && <p className="ox-hint">No hay programas. Agrégalos en Catálogo → Programas.</p>}
            <p className="ox-hint">{servicioInstalacion("software") ? `Se cobra con «${servicioInstalacion("software")!.name}». Puedes cambiar el precio en cada línea.` : "Crea «Instalación de programas» en Catálogo → Servicios para que el precio salga solo. Mientras, escríbelo en cada línea."}</p>
          </PickerBox>

          {/* ═══ PICKER DE VIDEOJUEGOS ═══ */}
          <PickerBox icon={<Gamepad2 size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Videojuegos" open={showVideogamePicker} onToggle={() => setShowVideogamePicker(!showVideogamePicker)} count={selectedItems.filter(i => lineKind(i) === "videogame").length}>
            <PickerSearch value={searchVideogame} onChange={setSearchVideogame} placeholder="Buscar videojuego o plataforma..." />
            <div className="ox-list">
              {filteredVideogames.map(x => { const inCart = selectedItems.find(i => i.inventoryId === x.id && lineKind(i) === "videogame"); return (
                <PickerCard key={x.id} selected={!!inCart} mark={String(inCart?.qty || "")} onClick={() => addCatalogLine("videogame", x)} title={x.name} sub={x.platform || undefined} price={precioInstalacion("videogame")} />
              ); })}
            </div>
            {filteredVideogames.length === 0 && <p className="ox-hint">No hay videojuegos. Agrégalos en Catálogo → Videojuegos.</p>}
            <p className="ox-hint">{servicioInstalacion("videogame") ? `Se cobra con «${servicioInstalacion("videogame")!.name}». Puedes cambiar el precio en cada línea.` : "Crea «Instalación de juegos» en Catálogo → Servicios para que el precio salga solo. Mientras, escríbelo en cada línea."}</p>
          </PickerBox>

          {/* ═══ CONCEPTO LIBRE ═══ */}
          <PickerBox icon={<PenLine size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Otro concepto" open={showCustomPicker} onToggle={() => setShowCustomPicker(!showCustomPicker)} count={selectedItems.filter(i => lineKind(i) === "custom").length}>
            <p className="ox-hint" style={{ marginBottom: 10 }}>Para lo que no está en el catálogo: mano de obra, envío, un trabajo especial, etc.</p>
            <div className="custom-line" style={{ display: "flex", gap: 8 }}>
              <input className="ox-input" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Descripción" aria-label="Descripción" style={{ flex: 1 }} />
              <input className="ox-input tabular" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Bs." inputMode="decimal" aria-label="Precio" style={{ width: 100 }} />
              <button type="button" className="ox-ghost" onClick={addCustom} style={{ width: "auto", height: 46, marginTop: 0, padding: "0 16px", whiteSpace: "nowrap" }}>＋ Añadir</button>
            </div>
          </PickerBox>

          {selectedItems.length > 0 && (
            <FormSection icon={<ShoppingCart size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Lo que lleva" hint={`${selectedItems.length} ${selectedItems.length === 1 ? "línea" : "líneas"}`}>
              <div className="ox-cart">
                {selectedItems.map(item => { const k = lineKind(item); const m = LINE_META[k]; const key = lineKey(item); const unique = isUniqueLine(item); return (
                  <div key={key} className="sel-row">
                    <div className="sel-name" style={{ fontSize: 14, fontWeight: 700, minWidth: 0 }}><LineIcon kind={k} /> {item.name}{m.tag && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, background: m.tint, color: m.color, fontWeight: 700, marginLeft: 6 }}>{m.tag}</span>}</div>
                    {PRECIO_EDITABLE.includes(k)
                      ? <label className="sel-price tabular" style={{ fontSize: 12.5, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>Bs. <PriceInput value={item.price} onChange={(n) => updatePrice(key, n)} label={`Precio de ${item.name}`} /> {unique ? "" : "c/u"}</label>
                      : <div className="sel-price tabular" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Bs. {item.price} {unique ? "" : "c/u"}</div>}
                    {!unique ? (
                      <div className="sel-step" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button type="button" className="ox-step" onClick={() => updateQty(key, item.qty - 1)} aria-label="Menos">−</button>
                        <span className="tabular" style={{ fontSize: 15, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{item.qty}</span>
                        <button type="button" className="ox-step" onClick={() => updateQty(key, item.qty + 1)} aria-label="Más">+</button>
                      </div>
                    ) : (<span className="sel-step" style={{ fontSize: 12, color: "var(--text-muted)" }}>único</span>)}
                    <div className="sel-sub tabular" style={{ textAlign: "right", minWidth: 70, fontSize: 15, fontWeight: 700 }}>Bs. {item.price * item.qty}</div>
                    <button type="button" className="sel-del ox-del" onClick={() => removeItem(key)} aria-label={`Quitar ${item.name}`}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                  </div>
                ); })}
              </div>
              <div className="ox-total"><span>Total</span><b>Bs. {total.toLocaleString("es-BO")}</b></div>
            </FormSection>
          )}

          <Field label="Notas" hint="Opcional · condiciones, garantía, validez"><textarea className="ox-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </FormModal>
      )}

      {/* ═══ MODAL VER DETALLE ═══ */}
      {viewQuotation && (() => {
        const vq = viewQuotation;
        const isQuot = vq.type === "quotation";
        const docName = isQuot ? "la cotización" : "la nota de venta";
        return (
        <div role="dialog" aria-modal="true" aria-label="Detalle del documento" data-esc className="qd-back" onClick={() => setViewQuotation(null)}>
          <div className="qd" onClick={(e) => e.stopPropagation()}>
            {/* Encabezado: código, tipo y en una línea cliente · celular · fecha */}
            <div className="qd-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="qd-title"><h3>{isQuot ? "Cotización" : "Nota de venta"} {vq.code}</h3><span className={`qd-type ${isQuot ? "quot" : "sale"}`}>{isQuot ? "Cotización" : "Nota de venta"}</span></div>
                <div className="qd-sub">{[vq.clientName, vq.clientPhone, new Date(vq.createdAt).toLocaleString("es-BO", { hourCycle: "h23", dateStyle: "short", timeStyle: "short" })].filter(Boolean).join(" · ")}</div>
              </div>
              <button type="button" className="qd-x" onClick={() => setViewQuotation(null)} aria-label="Cerrar"><X size={16} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div className="qd-body">
              {/* Detalle como tabla: todos los montos del mismo color, alineados a la derecha */}
              <table className="qd-t">
                <thead><tr><th>Concepto</th><th>Cant. × precio</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {vq.items.map((item, idx) => { const k = lineKind(item); const m = LINE_META[k]; const isEq = isUniqueLine(item); return (
                    <tr key={idx}>
                      <td><LineIcon kind={k} size={13} /> {item.name}{m.tag && <span className="qd-tag">{m.tag}</span>}</td>
                      <td className="n q">{isEq ? `Bs. ${item.price}` : `${item.qty} × Bs. ${item.price}`}</td>
                      <td className="n">Bs. {item.price * item.qty}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
              <div className="qd-total"><span>Total</span><b>Bs. {Math.round(vq.total || 0).toLocaleString("es-BO")}</b></div>
              {vq.notes && <div className="qd-notes"><b>Notas</b><p>{vq.notes}</p></div>}
              {viewQuotation.type === "sale" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Cobro {viewQuotation.paidWith ? "" : "· sin indicar"}</div>
                  <PaymentPicker compact amount={viewQuotation.total || 0} reference={viewQuotation.code} value={viewQuotation.paidWith || null} onChange={async (m) => {
                    const prev = viewQuotation.paidWith || null;
                    setViewQuotation({ ...viewQuotation, paidWith: m });
                    const r = await apiFetch("/api/payments", { method: "POST", body: JSON.stringify({ kind: "sale", id: viewQuotation.id, method: m }) });
                    if (r.ok) { sileo.success({ title: m === "qr" ? "Cobrado por QR" : "Cobrado en efectivo" }); setQuotations((qs) => qs.map((x) => (x.id === viewQuotation.id ? { ...x, paidWith: m } : x))); }
                    else { setViewQuotation({ ...viewQuotation, paidWith: prev }); sileo.error({ title: "No se pudo guardar" }); }
                  }} />
                </div>
              )}
            </div>
            {/* Un solo botón principal (convertir a venta); enviar y documentos en botones neutros; eliminar aparte */}
            <div className="qd-actions">
              {isQuot && <button type="button" className="qd-main" onClick={() => convertToSale(vq)}><Banknote size={16} strokeWidth={STROKE} aria-hidden="true" /> Convertir a venta</button>}
              <div className="qd-row">
                <button type="button" className="qd-btn" onClick={() => printDocument(vq)}><Printer size={15} strokeWidth={STROKE} aria-hidden="true" /> Documento</button>
                <button type="button" className="qd-btn" aria-pressed={waFor === vq.id} onClick={() => { setWaFor(waFor === vq.id ? null : vq.id); setMailFor(null); }}><MessageCircle size={15} strokeWidth={STROKE} aria-hidden="true" /> WhatsApp</button>
                {<button type="button" className="qd-btn" aria-pressed={mailFor === vq.id} onClick={() => { setMailFor(mailFor === vq.id ? null : vq.id); setWaFor(null); }}><Mail size={15} strokeWidth={STROKE} aria-hidden="true" /> Correo</button>}
                <button type="button" className="qd-btn" onClick={() => printQROnly(vq)}><QrCode size={15} strokeWidth={STROKE} aria-hidden="true" /> QR</button>
              </div>
              {waFor === vq.id && (
                <div className="qd-panel">
                  <div className="qd-panel-t"><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> Enviar {docName} {vq.code} por WhatsApp</div>
                  <QuotationWhatsApp key={vq.id} id={vq.id} code={vq.code} isQuot={isQuot} defaultPhone={vq.clientPhone} />
                </div>
              )}
              {mailFor === vq.id && (
                <div className="qd-panel">
                  <div className="qd-panel-t"><Mail size={14} strokeWidth={STROKE} aria-hidden="true" /> Enviar {docName} {vq.code} por correo</div>
                  <EmailSend autoFocus send={async (email) => {
                    const r = await apiFetch("/api/quotations/email", { method: "POST", body: JSON.stringify({ id: vq.id, email }) });
                    const d = await r.json().catch(() => ({}));
                    return { ok: !!d.sent, error: d.error };
                  }} />
                </div>
              )}
              <div className="qd-row qd-foot">
                <button type="button" className="qd-btn" onClick={() => openEditModal(vq)}><Pencil size={15} strokeWidth={STROKE} aria-hidden="true" /> Editar</button>
                <button type="button" className="qd-del" onClick={() => deleteQuotation(vq)}><Trash2 size={15} strokeWidth={STROKE} aria-hidden="true" /> Eliminar</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
      
        @media(max-width:768px){
          .custom-line{flex-wrap:wrap}
          .custom-line input:first-child{flex-basis:100%!important}
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .form-grid,.info-grid,.detail-grid{grid-template-columns:1fr!important}
          .filter-wrap{flex-direction:column;align-items:stretch!important}
          .filter-btns{overflow-x:auto;flex-wrap:nowrap!important;padding-bottom:4px}
          .msg-layout{grid-template-columns:1fr!important}
          .hide-mobile{display:none!important}
          .data-grid-5{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      
      <AppSidebar user={user} />


      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}><h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Cotizaciones y notas de venta</h1><p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Crea presupuestos y registra ventas con tu inventario</p></div>

        <div className="form-grid stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
          {[{ label: "Cotizaciones", value: stats.totalQuotations, color: "#b45309", gradient: "" }, { label: "Notas de Venta", value: stats.totalSales, color: "#1d4ed8", gradient: "" }].map((s, i) => (<div key={i} style={{ padding: "20px 18px", background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", position: "relative", overflow: "hidden", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both` }}><div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{s.value}</div></div>))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 340, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}><span style={{ color: "var(--text-muted)", fontSize: 14 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input aria-label="Buscar cotización o venta" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setQPage(1); }} placeholder="Buscar por cliente, ID..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} /></div>
          <div className="filter-btns" style={{ display: "flex", gap: 6 }}>{([{ key: "all", label: "Todas", color: "var(--accent)" }, { key: "quotation", label: "Cotizaciones", color: "#b45309" }, { key: "sale", label: "Ventas", color: "#1d4ed8" }] as const).map((f) => { const isActive = filterType === f.key; const count = f.key === "all" ? qStats.quotation + qStats.sale : qStats[f.key]; return (<button key={f.key} onClick={() => { setFilterType(f.key); setQPage(1); }} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}>{f.label}{count > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: isActive ? `${f.color}20` : "var(--bg-tertiary)", color: isActive ? f.color : "var(--text-muted)" }}>{count}</span>}</button>); })}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={() => openCreateModal("quotation")} style={{ padding: "10px 20px", background: "var(--warn)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Nueva Cotización</button>
            <button onClick={() => openCreateModal("sale")} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Nueva Venta</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ animation: `cardIn 0.4s ease-out ${i * 0.08}s both` }}>
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-text" />
                </div>
                <div style={{ width: 70, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <div className="skeleton" style={{ width: 60, height: 20 }} />
                  <div className="skeleton" style={{ width: 45, height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredQuotations.length === 0 ? (<div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><Receipt size={48} strokeWidth={1.5} aria-hidden="true" /></div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Sin documentos</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Crea tu primera cotización o nota de venta</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(paginatedQuotations || []).map((q, i) => { const isQuot = q.type === "quotation"; const color = isQuot ? "#f59e0b" : "#2563eb"; const bg = isQuot ? "rgba(245,158,11,0.08)" : "rgba(37,99,235,0.08)"; return (
              <div role="button" tabIndex={0} onKeyDown={pressKey} key={q.id} onClick={() => setViewQuotation(q)} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transitionProperty: "var(--tr-ui)", transitionDuration: "0.25s", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }} className="q-row">
                <div className="q-ico" style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{isQuot ? <ClipboardList size={20} strokeWidth={STROKE} aria-hidden="true" /> : <Banknote size={20} strokeWidth={STROKE} aria-hidden="true" />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)", fontWeight: 700, background: "rgba(var(--accent-bright-rgb), 0.05)", padding: "2px 8px", borderRadius: 6 }}>{q.code}</span><span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, color, background: bg }}>{isQuot ? "Cotización" : "Venta"}</span></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}><span>{q.clientName}</span>{q.clientPhone && <span>{q.clientPhone}</span>}<span>{q.items.length} art.</span></div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 16, fontWeight: 700, color }}>Bs. {Math.round(q.total || 0).toLocaleString()}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(q.createdAt).toLocaleDateString("es-BO")}</div></div>
                <span className="q-arrow" style={{ fontSize: 14, color: "var(--text-muted)" }}>▸</span>
              </div>
            ); })}
          </div>
        )}

        {/* Pagination */}
        {qTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={() => goQPage(1)} disabled={qPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: qPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: qPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: qPage === 1 ? "default" : "pointer", opacity: qPage === 1 ? 0.5 : 1 }}>«</button>
            <button onClick={() => goQPage(qPage - 1)} disabled={qPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: qPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: qPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: qPage === 1 ? "default" : "pointer", opacity: qPage === 1 ? 0.5 : 1 }}>‹</button>
            {Array.from({ length: qTotalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === qTotalPages || Math.abs(p - qPage) <= 2)
              .reduce((acc: (number | string)[], p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => typeof p === "string" ? (
                <span key={`d-${i}`} style={{ padding: "8px 6px", fontSize: 12, color: "var(--text-muted)" }}>...</span>
              ) : (
                <button key={p} onClick={() => goQPage(p as number)} style={{ padding: "8px 14px", borderRadius: 8, border: p === qPage ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: p === qPage ? "rgba(var(--accent-bright-rgb), 0.08)" : "var(--bg-card)", color: p === qPage ? "var(--accent-dim)" : "var(--text-secondary)", fontSize: 12, fontWeight: p === qPage ? 800 : 600, cursor: "pointer", minWidth: 38 }}>{p}</button>
              ))}
            <button onClick={() => goQPage(qPage + 1)} disabled={qPage === qTotalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: qPage === qTotalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: qPage === qTotalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: qPage === qTotalPages ? "default" : "pointer", opacity: qPage === qTotalPages ? 0.5 : 1 }}>›</button>
            <button onClick={() => goQPage(qTotalPages)} disabled={qPage === qTotalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: qPage === qTotalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: qPage === qTotalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: qPage === qTotalPages ? "default" : "pointer", opacity: qPage === qTotalPages ? 0.5 : 1 }}>»</button>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Pág {qPage} de {qTotalPages}</span>
          </div>
        )}
      </div>
    </div>
  );
}

