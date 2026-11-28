"use client";
export const dynamic = 'force-dynamic'
import ReceiptShare, { waLink } from "@/frontend/components/ReceiptShare";
import PaymentPicker, { type PayMethod } from "@/frontend/components/PaymentPicker";
import WaFallback from "@/frontend/components/WaFallback";
import { type UncollectedData } from "@/frontend/components/UncollectedPanel";
import { sileo } from "@/frontend/lib/toast";
import { publicBase } from "@/frontend/lib/public-base";
import { apiFetch, setActiveBranchId } from "@/frontend/lib/api";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlobalSearch } from "@/frontend/components/GlobalSearch";
import { StatusTimeline } from "@/frontend/components/StatusTimeline";
import { RepairLogPanel } from "@/frontend/components/RepairLogPanel";
import { OrderCost, OrderFlow } from "@/frontend/components/AssignmentDetail";
import { AdvanceDialog, needsAdvanceDialog } from "@/frontend/components/AdvanceDialog";
import { openChat } from "@/frontend/components/ChatBubble";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { useFlashChanges, celebrate, slideOut } from "@/frontend/lib/motion";
import { ImeiField, ImeiInfo } from "@/frontend/components/ImeiField";
import { AccLabelsPicker, type AccLabelFmt } from "@/frontend/components/AccLabelsPicker";
import { PartsPicker, countIds, partsPayload } from "@/frontend/components/PartsPicker";
import { FormModal, FormSection, Field, oxLabelStyle, oxFieldStyle, nudgeOnBackdrop } from "@/frontend/components/FormKit";
import { ACCESSORIES_HINTS, PRIORITIES, TECH_COLORS, initials } from "@/frontend/lib/order-ui";
import { useRecepcion } from "@/frontend/components/RecepcionProvider";
import { modoIdentificador } from "@/shared/recepcion";
import { CountUp, SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey, mouseOnly } from "@/frontend/lib/a11y";
import { Award, Backpack, Banknote, Bell, CalendarDays, Camera, CircleCheck, ClipboardList, Disc3, FileText, Flag, Gamepad2, Handshake, History, ImagePlus, MessageCircle, MessageSquare, Pencil, Plus, Printer, QrCode, Receipt, Search, Smartphone, Stethoscope, Trash2, TriangleAlert, User, UserCog, Wrench, X } from "@/frontend/components/icons";
import { AccessoryIcon, DeviceIcon, NotifIcon, OrderTag, STROKE, ServiceIcon, StatusDot, StatusIcon } from "@/frontend/components/UiIcons";
import { PageSkeleton } from "@/frontend/components/Skeletons";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; priority: string; estimatedCost: number; notes: string | null; image: string | null; accessories: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null; qrCode: string; createdAt: string; updatedAt: string; technicianId: string | null; technician?: { id: string; name: string } | null; warrantyOf?: string | null; imei?: string | null; imeiCheck?: string | null; parts?: string | null; partsCost?: number; }
interface Notification { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; }
interface ServiceItem { id: string; name: string; price: number; icon: string; }
interface SoftwareItem { id: string; name: string; category: string | null; }
interface InventoryItemData { id: string; name: string; category: string | null; quantity: number; price: number; cost?: number; minStock: number; image: string | null; }

const STATUS: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#b45309", icon: "⏳", bg: "rgba(245,158,11,0.08)" },
  diagnosed: { label: "Diagnosticado", color: "#0e7490", icon: "🔍", bg: "rgba(14,116,144,0.08)" },
  waiting_parts: { label: "Esperando Repuestos", color: "#c2410c", icon: "📦", bg: "rgba(249,115,22,0.08)" },
  in_progress: { label: "En Progreso", color: "#2563eb", icon: "🔧", bg: "rgba(59,130,246,0.08)" },
  completed: { label: "Completado", color: "#047857", icon: "✅", bg: "rgba(16,185,129,0.08)" },
  delivered: { label: "Entregado", color: "#5a6a80", icon: "📱", bg: "rgba(107,114,128,0.08)" },
};
/** Emoji del tipo de equipo (para la lista cuando la orden no tiene foto) */
const TRACKING_KEYS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed"];
const ALL_STATUS_KEYS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseAccessoriesFull(json: string | null): { names: string[]; details: Record<string, string> } { if (!json) return { names: [], details: {} }; try { const arr: string[] = JSON.parse(json); const names: string[] = []; const details: Record<string, string> = {}; arr.forEach(raw => { const { name, detail } = parseAccWithDetail(raw); names.push(name); if (detail) details[name] = detail; }); return { names, details }; } catch { return { names: [], details: {} }; } }
function parseAccessoriesDisplay(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseImages(imageField: string | null): string[] { if (!imageField) return []; try { const parsed = JSON.parse(imageField); if (Array.isArray(parsed)) return parsed.filter((u: unknown): u is string => typeof u === "string" && u.length > 0); } catch {} return imageField.trim().length > 0 ? [imageField] : []; }

function parseNotesAll(notesField: string | null, svcList: ServiceItem[]): { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string } {
  if (!notesField) return { notes: "", services: [], software: [], videogames: [], repuestos: [], deliveryNotes: "", discount: "" };
  const parts = notesField.split(" | ");
  const svcPart = parts.find(p => p.startsWith("Servicios: "));
  const swPart = parts.find(p => p.startsWith("Programas: ") || p.startsWith("Software: "));
  const vgPart = parts.find(p => p.startsWith("Videojuegos: "));
  const repPart = parts.find(p => p.startsWith("Repuestos: "));
  const delPart = parts.find(p => p.startsWith("Entrega: "));
  const discPart = parts.find(p => p.startsWith("Descuento: "));
  const notesParts = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Programas: ") && !p.startsWith("Software: ") && !p.startsWith("Videojuegos: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: ") && !p.startsWith("Descuento: "));
  const services: string[] = []; const software: string[] = []; const videogames: string[] = []; const repuestos: string[] = [];
  if (svcPart) { svcPart.replace("Servicios: ", "").split(", ").forEach(name => { if (svcList.find(s => s.name === name)) services.push(name); }); }
  if (swPart) { swPart.replace("Programas: ", "").replace("Software: ", "").split(", ").forEach(name => { if (name.trim()) software.push(name.trim()); }); }
  if (vgPart) { vgPart.replace("Videojuegos: ", "").split(", ").forEach(name => { if (name.trim()) videogames.push(name.trim()); }); }
  if (repPart) { repPart.replace("Repuestos: ", "").split(", ").forEach(name => { if (name.trim()) repuestos.push(name.trim()); }); }
  const deliveryNotes = delPart ? delPart.replace("Entrega: ", "") : "";
  const discount = discPart ? discPart.replace("Descuento: ", "") : "";
  return { notes: notesParts.join(" | "), services, software, videogames, repuestos, deliveryNotes, discount };
}

function buildNotesString(obs: string, services: string[], software: string[], videogames: string[], repuestos: string[], deliveryNotes: string, discount?: string): string {
  const parts: string[] = [];
  if (obs.trim()) parts.push(obs.trim());
  if (services.length > 0) parts.push(`Servicios: ${services.join(", ")}`);
  if (software.length > 0) parts.push(`Programas: ${software.join(", ")}`);
  if (videogames.length > 0) parts.push(`Videojuegos: ${videogames.join(", ")}`);
  if (repuestos.length > 0) parts.push(`Repuestos: ${repuestos.join(", ")}`);
  if (deliveryNotes.trim()) parts.push(`Entrega: ${deliveryNotes.trim()}`);
  if (discount && parseFloat(discount) > 0) parts.push(`Descuento: ${discount}`);
  return parts.join(" | ");
}

/** Repuestos de una orden como lista de ids (repetido = varias unidades). Órdenes viejas: desde "Repuestos:" de las notas. */
function partIdsOf(repair: { parts?: string | null; notes: string | null }, inv: { id: string; name: string }[]): string[] {
  try {
    const arr = repair.parts ? JSON.parse(repair.parts) : null;
    if (Array.isArray(arr)) return arr.flatMap((p: { itemId: string; qty: number }) => Array(Math.max(0, p.qty | 0)).fill(p.itemId));
  } catch { /* notas viejas */ }
  const rep = (repair.notes || "").split(" | ").find(p => p.startsWith("Repuestos: "));
  if (!rep) return [];
  return rep.replace("Repuestos: ", "").split(", ").flatMap(raw => {
    const m = /^(.*?)\s*[×x](\d+)$/.exec(raw.trim());
    const name = (m ? m[1] : raw).trim(); const qty = m ? +m[2] : 1;
    const id = inv.find(i => i.name === name)?.id;
    return id ? Array(qty).fill(id) : [];
  });
}
/** Nombres para las notas (comprobantes): "Pasta térmica ×2" */
function partNames(ids: string[], inv: { id: string; name: string }[]): string[] {
  const c = countIds(ids);
  return Object.keys(c).map(id => { const n = inv.find(i => i.id === id)?.name; return n ? (c[id] > 1 ? `${n} ×${c[id]}` : n) : ""; }).filter(Boolean);
}

// Reloj en formato 24 horas (ej. 17:05:09)
function formatClock(date: Date): { time: string } { const p = (n: number) => String(n).padStart(2, "0"); return { time: `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}` }; }
function formatDate(date: Date): string { return date.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

function DashboardPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  // Tarjetas que cambiaron desde otra computadora se iluminan un momento
  useFlashChanges(repairs, (r) => r.id, (r) => `${r.status}|${r.updatedAt}`);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRepairs, setTotalRepairs] = useState(0);
  const [stats, setStats] = useState<{ total: number; pending: number; inProgress: number; completed: number; revenue: number; byStatus: Record<string, number> }>({ total: 0, pending: 0, inProgress: 0, completed: 0, revenue: 0, byStatus: {} });
  const PAGE_SIZE = 10;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const focusCode = searchParams.get("focus");
  const printCode = searchParams.get("print");
  // Celular o tablet (táctil, sin mouse): ahí no hay impresora, no se ofrece imprimir automáticamente
  const isTouchDevice = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;
  // Recién registrada en "Nueva orden": ofrecer imprimir la recepción de una vez
  useEffect(() => {
    if (!printCode) return;
    if (!isTouchDevice()) setPrintModal({ code: printCode, type: "reception", justDone: true });
    const url = new URL(window.location.href); url.searchParams.delete("print"); window.history.replaceState(null, "", url.toString());
  }, [printCode]);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [viewImages, setViewImages] = useState<string[]>([]);
  const [viewImageIdx, setViewImageIdx] = useState(0);
  const openImageViewer = (images: string[], startIdx: number) => { setViewImages(images); setViewImageIdx(startIdx); setViewImage(images[startIdx]); };
  const nextImage = () => { const next = (viewImageIdx + 1) % viewImages.length; setViewImageIdx(next); setViewImage(viewImages[next]); };
  const prevImage = () => { const prev = (viewImageIdx - 1 + viewImages.length) % viewImages.length; setViewImageIdx(prev); setViewImage(viewImages[prev]); };
  const [printModal, setPrintModal] = useState<{ code: string; type: "reception" | "delivery"; justDone?: boolean; wa?: boolean | null } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ id: string; code: string } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItemData[]>([]);

  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);
  const [editDevice, setEditDevice] = useState(""); const [editBrand, setEditBrand] = useState(""); const [editModel, setEditModel] = useState(""); const [editImei, setEditImei] = useState("");
  const [editIssue, setEditIssue] = useState(""); const [editCost, setEditCost] = useState(""); const [editNotes, setEditNotes] = useState("");
  const [editClientName, setEditClientName] = useState(""); const [editClientPhone, setEditClientPhone] = useState(""); const [editClientEmail, setEditClientEmail] = useState("");
  // Accesorios del catálogo configurable; los de órdenes antiguas que ya no están en la lista siguen mostrándose
  const { catalogo } = useRecepcion();
  const accNames = catalogo.accessories.map((a) => a.name);
  const pideDetalle = (acc: string) => catalogo.accessories.find((a) => a.name === acc)?.detail ?? !!ACCESSORIES_HINTS[acc];
  const [editSelectedAccessories, setEditSelectedAccessories] = useState<string[]>([]); const [editAccessoryDetails, setEditAccessoryDetails] = useState<Record<string, string>>({});
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editSelectedSoftware, setEditSelectedSoftware] = useState<string[]>([]);
  const [editSelectedVideogames, setEditSelectedVideogames] = useState<string[]>([]);
  const [searchEditVideogames, setSearchEditVideogames] = useState("");
  const [editVideogamesList, setEditVideogamesList] = useState<{id:string;name:string;platform:string|null;genre:string|null}[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const [editTechnicianId, setEditTechnicianId] = useState("");
  const [techniciansList, setTechniciansList] = useState<{ id: string; name: string; activeCount?: number }[]>([]);
  const [editPriority, setEditPriority] = useState("media"); const [editTab, setEditTab] = useState<"services" | "software" | "games">("services");
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]); const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]); const [uploading, setUploading] = useState(false);
  const [searchEditServices, setSearchEditServices] = useState(""); const [searchEditSoftware, setSearchEditSoftware] = useState("");
  const [editSelectedInventory, setEditSelectedInventory] = useState<string[]>([]);
  const [editOriginalInventory, setEditOriginalInventory] = useState<string[]>([]);
  const filteredEditServices = servicesList.filter(s => searchEditServices === "" || s.name.toLowerCase().includes(searchEditServices.toLowerCase()));
  const filteredEditSoftware = softwareList.filter(s => searchEditSoftware === "" || s.name.toLowerCase().includes(searchEditSoftware.toLowerCase()) || (s.category || "").toLowerCase().includes(searchEditSoftware.toLowerCase()));
  const filteredEditVideogames = editVideogamesList.filter(v => searchEditVideogames === "" || v.name.toLowerCase().includes(searchEditVideogames.toLowerCase()) || (v.platform || "").toLowerCase().includes(searchEditVideogames.toLowerCase()));

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliverySelectedRepair, setDeliverySelectedRepair] = useState<Repair | null>(null);
  const [deliveryPay, setDeliveryPay] = useState<PayMethod>("cash");
  const [deliveryAccChecked, setDeliveryAccChecked] = useState<Record<string, boolean>>({});
  const [deliveryNotes, setDeliveryNotes] = useState("");
  // Accesorio que no se devuelve: hay que explicar por qué (queda en las notas de la entrega)
  const [deliveryMissingOpen, setDeliveryMissingOpen] = useState(false);
  const [deliveryMissingWhy, setDeliveryMissingWhy] = useState("");
  const [deliverySaving, setDeliverySaving] = useState(false);
  const deliveryTitleRef = useRef<HTMLHeadingElement>(null);

  const [deliverySelectedServices, setDeliverySelectedServices] = useState<string[]>([]);
  const [deliverySelectedSoftware, setDeliverySelectedSoftware] = useState<string[]>([]);
  const [showDeliveryServices, setShowDeliveryServices] = useState(false);
  const [showDeliverySoftware, setShowDeliverySoftware] = useState(false);
  const [searchDeliveryServices, setSearchDeliveryServices] = useState("");
  const [searchDeliverySoftware, setSearchDeliverySoftware] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [deliveryDiscount, setDeliveryDiscount] = useState("");
  const filteredDeliveryServices = servicesList.filter(s => searchDeliveryServices === "" || s.name.toLowerCase().includes(searchDeliveryServices.toLowerCase()));
  const filteredDeliverySoftware = softwareList.filter(s => searchDeliverySoftware === "" || s.name.toLowerCase().includes(searchDeliverySoftware.toLowerCase()) || (s.category || "").toLowerCase().includes(searchDeliverySoftware.toLowerCase()));
  const completedRepairs = repairs.filter(r => r.status === "completed");
  // Equipos listos sin recoger (se actualiza cuando cambia la lista de órdenes)
  const [uncollected, setUncollected] = useState<UncollectedData | null>(null);
  const loadUncollected = () => { apiFetch("/api/repairs/uncollected").then(r => r.ok ? r.json() : null).then(d => { if (d) setUncollected(d); }).catch(() => {}); };
  useEffect(() => { loadUncollected(); }, [repairs, activeBranch]);

  const [deliverySelectedInventory, setDeliverySelectedInventory] = useState<string[]>([]);
  const [deliveryOriginalInventory, setDeliveryOriginalInventory] = useState<string[]>([]);
  const [, setShowDeliveryInventory] = useState(false);
  const [, setSearchDeliveryInventory] = useState("");

  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; website: string | null; city: string | null }>({ companyName: "", slogan: "", logo: null, website: null, city: null });
  const unreadCount = notifications.filter((n) => !n.read).length;
  // La campana se mueve UNA vez cuando llega una notificación nueva (antes el globo rojo parpadeaba sin parar)
  const [bellRing, setBellRing] = useState(0);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const prevUnread = useRef(-1);
  useEffect(() => {
    if (!notifLoaded) return; // la primera carga no cuenta como "nueva"
    if (prevUnread.current >= 0 && unreadCount > prevUnread.current) setBellRing((k) => k + 1);
    prevUnread.current = unreadCount;
  }, [unreadCount, notifLoaded]);
  const toggleEditAcc = (acc: string) => { setEditSelectedAccessories(prev => { if (prev.includes(acc)) { setEditAccessoryDetails(d => { const copy = { ...d }; delete copy[acc]; return copy; }); return prev.filter(a => a !== acc); } return [...prev, acc]; }); };
  const updateEditDetail = (acc: string, detail: string) => { setEditAccessoryDetails(prev => ({ ...prev, [acc]: detail })); };
  const buildEditAccessoriesArray = (): string[] => { return editSelectedAccessories.map(acc => { const detail = editAccessoryDetails[acc]?.trim(); return detail ? `${acc} (${detail})` : acc; }); };
  const toggleEditService = (serviceName: string) => { setEditSelectedServices(prev => { const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName]; recalcEditCost(next, editSelectedInventory); return next; }); };
  const toggleEditSoftware = (name: string) => { setEditSelectedSoftware(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };
  const toggleEditVideogame = (name: string) => { setEditSelectedVideogames(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };
  const recalcEditCost = (services: string[], invIds: string[]) => {
    const svcTotal = services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = invIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setEditCost(String(svcTotal + invTotal));
  };

  const recalculateDeliveryCost = (services: string[], inventoryIds: string[]) => {
    const svcTotal = services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = inventoryIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setDeliveryCost(String(svcTotal + invTotal));
  };
  const toggleDeliveryService = (serviceName: string) => {
    setDeliverySelectedServices(prev => {
      const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName];
      recalculateDeliveryCost(next, deliverySelectedInventory);
      return next;
    });
  };
  const toggleDeliverySoftware = (name: string) => { setDeliverySelectedSoftware(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };

  const openDeliveryModal = () => {
    setShowDeliveryModal(true); setDeliverySelectedRepair(null); setDeliveryAccChecked({}); setDeliveryNotes("");
    setDeliverySelectedServices([]); setDeliverySelectedSoftware([]); setDeliveryCost(""); setDeliveryDiscount("");
    setShowDeliveryServices(false); setShowDeliverySoftware(false); setSearchDeliveryServices(""); setSearchDeliverySoftware("");
    setDeliverySelectedInventory([]); setShowDeliveryInventory(false); setSearchDeliveryInventory("");
    setDeliveryMissingOpen(false); setDeliveryMissingWhy("");
  };

  const selectDeliveryRepair = (repair: Repair | null) => {
    setDeliveryMissingOpen(false); setDeliveryMissingWhy("");
    if (!repair || deliverySelectedRepair?.id === repair.id) {
      setDeliverySelectedRepair(null); setDeliveryAccChecked({}); setDeliverySelectedServices([]);
      setDeliverySelectedSoftware([]); setDeliverySelectedInventory([]); setDeliveryCost(""); setDeliveryDiscount(""); return;
    }
    setDeliverySelectedRepair(repair);
    // Cada accesorio empieza SIN marcar: se marca al devolverlo en la mano del cliente
    const checked: Record<string, boolean> = {};
    parseAccessoriesDisplay(repair.accessories).forEach(a => { checked[parseAccWithDetail(a).name] = false; });
    setDeliveryAccChecked(checked);
    const parsed = parseNotesAll(repair.notes, servicesList);
    setDeliverySelectedServices(parsed.services);
    setDeliverySelectedSoftware(parsed.software);
    const prevParts = partIdsOf(repair, inventoryList);
    setDeliverySelectedInventory(prevParts); setDeliveryOriginalInventory(prevParts);
    setDeliveryCost(String(repair.estimatedCost));
    setDeliveryPay("cash");
  };

  // Montos de la entrega: lo que se ve en pantalla es exactamente lo que se guarda
  const dvSubtotal = deliverySelectedRepair ? Math.max(0, Number(deliveryCost || deliverySelectedRepair.estimatedCost) || 0) : 0;
  const dvDiscount = Math.min(dvSubtotal, Math.max(0, Number(String(deliveryDiscount).replace(",", ".")) || 0));
  const dvTotal = Math.round((dvSubtotal - dvDiscount) * 100) / 100;
  const dvMissing = Object.entries(deliveryAccChecked).filter(([, ok]) => !ok).map(([name]) => name);
  const dvShowMissing = dvMissing.length > 0 && (deliveryMissingOpen || dvMissing.length < Object.keys(deliveryAccChecked).length);
  const dvBlocker = !deliverySelectedRepair ? "Elige la orden que vas a entregar."
    : dvMissing.length && !deliveryMissingWhy.trim()
      ? (dvShowMissing ? `Explica por qué falta: ${dvMissing.join(", ").toLowerCase()}.` : "Marca cada accesorio al devolverlo.")
      : "";

  // Al abrir: foco en el título (lectores de pantalla) y Esc para cerrar
  useEffect(() => {
    if (!showDeliveryModal) return;
    deliveryTitleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowDeliveryModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeliveryModal]);

  const confirmDelivery = async () => {
    if (!deliverySelectedRepair || dvBlocker || deliverySaving) return;
    const token = sessionStorage.getItem("token"); if (!token) return;
    setDeliverySaving(true);
    try {
      const existingParsed = parseNotesAll(deliverySelectedRepair.notes, servicesList);
      const originalObs = existingParsed.notes;
      const invNames = partNames(deliverySelectedInventory, inventoryList);
      const missingNote = dvMissing.length ? `No se devolvió ${dvMissing.join(", ").toLowerCase()}: ${deliveryMissingWhy.trim()}` : "";
      const deliveryText = [missingNote, deliveryNotes.trim()].filter(Boolean).join(". ");
      const finalNotes = buildNotesString(originalObs, deliverySelectedServices, deliverySelectedSoftware, existingParsed.videogames, invNames, deliveryText, dvDiscount ? String(dvDiscount) : "");
      // El stock de los repuestos lo ajusta el servidor (solo la diferencia con lo que la orden ya tenía)
      const res = await apiFetch(`/api/repairs/${deliverySelectedRepair.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "delivered", notes: finalNotes || null, estimatedCost: dvTotal, paidWith: deliveryPay, parts: partsPayload(deliverySelectedInventory) })
      });
      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        setShowDeliveryModal(false);
        celebrate("advance");
        // Comprobante de entrega (CE): enviarlo por WhatsApp / copiar enlace / imprimir (también en celular)
        setPrintModal({ code: deliverySelectedRepair.code, type: "delivery", justDone: true, wa: typeof saved.whatsappSent === "boolean" ? saved.whatsappSent : null });
        sileo.success({ title: `Equipo ${deliverySelectedRepair.code} entregado` });
        await slideOut(document.querySelector(`[data-flash-id="${CSS.escape(deliverySelectedRepair.id)}"]`));
        await loadRepairs(token); loadNotifications(token);
        apiFetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
      } else {
        const d = await res.json().catch(() => ({}));
        sileo.error({ title: d.error || "No se pudo entregar" });
      }
    } catch {
      sileo.error({ title: "Error de conexión: la orden no se entregó" });
    } finally {
      setDeliverySaving(false);
    }
  };

  const loadRepairs = async (token: string, page?: number, search?: string, status?: string) => {
    try {
      const p = page || currentPage;
      const s = search !== undefined ? search : searchQuery;
      const st = status !== undefined ? status : filterStatus;
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (s) params.set("search", s);
      if (st && st !== "all") params.set("status", st);
      const res = await apiFetch(`/api/repairs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRepairs(data.repairs || []);
        setTotalPages(data.totalPages || 1);
        setTotalRepairs(data.total || 0);
        setCurrentPage(data.page || 1);
        if (data.stats) setStats(data.stats);
      }
    } catch {} setLoading(false);
  };
  const loadNotifications = async (_token: string) => { try { const res = await apiFetch("/api/notifications", { }); if (res.ok) { setNotifications(await res.json()); setNotifLoaded(true); } } catch {} };
  const markNotificationRead = async (notifId: string) => { const token = sessionStorage.getItem("token"); if (!token) return; try { await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: notifId }) }); setNotifications(notifications.map((n) => (n.id === notifId ? { ...n, read: true } : n))); } catch {} };
  const markAllRead = async () => { const token = sessionStorage.getItem("token"); if (!token) return; try { await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ markAll: true }) }); setNotifications(notifications.map((n) => ({ ...n, read: true }))); } catch {} };
  const clearAllNotifications = async () => { if (!await askConfirm("¿Eliminar todas las notificaciones?")) return; const token = sessionStorage.getItem("token"); if (!token) return; try { const res = await apiFetch("/api/notifications", { method: "DELETE" }); if (res.ok) { setNotifications([]); setShowNotifications(false); sileo.success({ title: "Notificaciones limpiadas" }); } } catch {} };

  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsedUser = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsedUser.role === "tech") { router.push("/asignaciones"); return; }
    setUser(parsedUser);
    // Load branches for superadmin
    if (parsedUser.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else {
      setActiveBranch(parsedUser.branchId || "");
    }
    loadRepairs(token); loadNotifications(token);
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, slogan: d.slogan, logo: d.logo, website: d.website, city: d.city || null }); }).catch(() => {});
    apiFetch("/api/services").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setServicesList(data); }).catch(() => {});
    apiFetch("/api/software").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setSoftwareList(data); }).catch(() => {});
    apiFetch("/api/videogames").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setEditVideogamesList(data); }).catch(() => {});
    apiFetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setInventoryList(data); }).catch(() => {});
    apiFetch("/api/technicians", { }).then(res => res.json()).then(data => { if (Array.isArray(data)) setTechniciansList(data); }).catch(() => {});
    const savedEdit = sessionStorage.getItem("editFormData");
    if (savedEdit) { try { const data = (() => { try { return JSON.parse(savedEdit); } catch { return null; } })(); setEditingRepair(data.repair); setEditDevice(data.editDevice || ""); setEditBrand(data.editBrand || ""); setEditModel(data.editModel || ""); setEditImei(data.editImei || ""); setEditIssue(data.editIssue || ""); setEditCost(data.editCost || ""); setEditNotes(data.editNotes || ""); setEditClientName(data.editClientName || ""); setEditClientPhone(data.editClientPhone || ""); setEditClientEmail(data.editClientEmail || ""); setEditSelectedAccessories(data.editSelectedAccessories || []); setEditAccessoryDetails(data.editAccessoryDetails || {}); setEditSelectedServices(data.editSelectedServices || []); setEditSelectedSoftware(data.editSelectedSoftware || []); setEditStatus(data.editStatus || ""); setEditImageUrls(data.editImageUrls || []); setEditImagePreviews(data.editImagePreviews || []); } catch {} sessionStorage.removeItem("editFormData"); }
    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) { try { const { url, preview } = (() => { try { return JSON.parse(capturedData); } catch { return {}; } })(); setEditImageUrls(prev => [...prev, url]); setEditImagePreviews(prev => [...prev, preview]); setTimeout(() => sileo.success({ title: "Foto capturada" }), 500); } catch {} sessionStorage.removeItem("capturedImage"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  
  // Auto-expandir OT cuando viene de ?focus=OT-X del buscador global
  useEffect(() => {
    if (!focusCode || repairs.length === 0) return;
    const target = repairs.find(r => r.code === focusCode);
    if (target) {
      setExpandedId(target.id);
      setTimeout(() => {
        const el = document.querySelector(`[data-repair-id="${target.id}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } else {
      // Si no está en la página actual, buscar con searchQuery
      setSearchQuery(focusCode);
    }
  }, [focusCode, repairs]);
  // Tiempo real (antes: consulta cada 15 s)
  useLiveRefresh(["Repair", "Notification", "StatusHistory"], () => { const token = sessionStorage.getItem("token"); if (!token) return; loadNotifications(token); loadRepairs(token); });
  // Debounced search
  useEffect(() => { const token = sessionStorage.getItem("token"); if (!token) return; const t = setTimeout(() => { setCurrentPage(1); loadRepairs(token, 1, searchQuery, filterStatus); }, 400); return () => clearTimeout(t); }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado
  // Filter change
  useEffect(() => { const token = sessionStorage.getItem("token"); if (!token) return; setCurrentPage(1); loadRepairs(token, 1, searchQuery, filterStatus); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado
  const goToPage = (p: number) => { const token = sessionStorage.getItem("token"); if (!token) return; setCurrentPage(p); loadRepairs(token, p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => { function handleClick(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false); } document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }, []);
  useEffect(() => { if (!viewImage) return; const handleKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") nextImage(); else if (e.key === "ArrowLeft") prevImage(); else if (e.key === "Escape") setViewImage(null); }; document.addEventListener("keydown", handleKey); return () => document.removeEventListener("keydown", handleKey); });

  const uploadEditFiles = async (files: FileList) => { setUploading(true); for (let i = 0; i < files.length; i++) { const file = files[i]; const reader = new FileReader(); reader.onload = (ev) => setEditImagePreviews(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); const formData = new FormData(); formData.append("file", file); try { const res = await apiFetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setEditImageUrls(prev => [...prev, data.url]); } } catch {} } sileo.success({ title: `${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}` }); setUploading(false); };
  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; await uploadEditFiles(files); e.target.value = ""; };
  const handleEditTakePhoto = () => { sessionStorage.setItem("editFormData", JSON.stringify({ repair: editingRepair, editDevice, editBrand, editModel, editImei, editIssue, editCost, editNotes, editClientName, editClientPhone, editClientEmail, editSelectedAccessories, editAccessoryDetails, editSelectedServices, editSelectedSoftware, editStatus, editImageUrls, editImagePreviews })); sessionStorage.setItem("cameraReturnUrl", "/dashboard"); window.location.href = "/camera.html"; };
  const removeEditImage = (index: number) => { setEditImageUrls(prev => prev.filter((_, i) => i !== index)); setEditImagePreviews(prev => prev.filter((_, i) => i !== index)); };
  const deleteRepair = async (repairId: string) => { const token = sessionStorage.getItem("token"); try { const res = await apiFetch(`/api/repairs/${repairId}`, { method: "DELETE" }); if (res.ok) { setExpandedId(null); sileo.success({ title: "Orden eliminada" }); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };
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
        setWaFallback(waLink(phone, message)); // abrirlo desde el WhatsApp de este equipo
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

  const updateStatus = async (repairId: string, newStatus: string) => { const token = sessionStorage.getItem("token"); try { const res = await apiFetch(`/api/repairs/${repairId}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) }); if (res.ok) { celebrate(newStatus === "completed" ? "complete" : "advance"); const code = repairs.find((r) => r.id === repairId)?.code; sileo.success({ title: code ? `${code} pasó a ${STATUS[newStatus]?.label}` : `Estado: ${STATUS[newStatus]?.label}` }); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };

  // Avanzar abre "Registrar y avanzar" (el administrador puede registrar a nombre del técnico)
  const [advancing, setAdvancing] = useState<{ repair: Repair; to: string } | null>(null);
  const assignTechnician = async (repairId: string, techId: string) => {
    const token = sessionStorage.getItem("token"); if (!token) return;
    try {
      const res = await apiFetch(`/api/repairs/${repairId}`, { method: "PATCH", body: JSON.stringify({ technicianId: techId || null }) });
      if (res.ok) {
        const techName = techniciansList.find(t => t.id === techId)?.name;
        sileo.success({ title: techId ? `Asignado a ${techName}` : "Técnico removido" });
        await loadRepairs(token); loadNotifications(token);
      }
    } catch {}
  };

  const openEditForm = (repair: Repair) => {
    setEditingRepair(repair); setEditDevice(repair.device); setEditBrand(repair.brand || ""); setEditModel(repair.model || ""); setEditImei(repair.imei || "");
    setEditIssue(repair.issue);
    setEditClientName(repair.clientName || ""); setEditClientPhone(repair.clientPhone || ""); setEditClientEmail(repair.clientEmail || "");
    const { names, details } = parseAccessoriesFull(repair.accessories); setEditSelectedAccessories(names); setEditAccessoryDetails(details);
    const parsed = parseNotesAll(repair.notes, servicesList);
    setEditNotes(parsed.notes); setEditSelectedServices(parsed.services); setEditSelectedSoftware(parsed.software); setEditSelectedVideogames(parsed.videogames);
    const invIds = partIdsOf(repair, inventoryList);
    setEditSelectedInventory(invIds);
    setEditOriginalInventory(invIds);
    const svcTotal = parsed.services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = invIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setEditCost(String(svcTotal + invTotal || repair.estimatedCost));
    setEditStatus(repair.status); setEditPriority(repair.priority || "media"); setEditTab("services"); setEditTechnicianId(repair.technicianId || ""); const imgs = parseImages(repair.image); setEditImageUrls(imgs); setEditImagePreviews(imgs);
    setSearchEditServices(""); setSearchEditSoftware(""); setSearchEditVideogames("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingRepair) return; const token = sessionStorage.getItem("token");
    // Avanzar el estado desde "Editar" también pasa por "Registrar y avanzar": se guardan los demás
    // cambios y luego se abre la ventana para el nuevo estado
    const ORDER = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];
    const stageMove = editStatus !== editingRepair.status && ORDER.indexOf(editStatus) > ORDER.indexOf(editingRepair.status) && needsAdvanceDialog(editStatus);
    const statusToSend = stageMove ? editingRepair.status : editStatus;
    try {
      const imageData = editImageUrls.length > 0 ? JSON.stringify(editImageUrls) : null; const accArray = buildEditAccessoriesArray();
      const invNames = partNames(editSelectedInventory, inventoryList);
      const existingParsed = parseNotesAll(editingRepair.notes, servicesList);
      const finalNotes = buildNotesString(editNotes, editSelectedServices, editSelectedSoftware, editSelectedVideogames, invNames, existingParsed.deliveryNotes, existingParsed.discount);
      // El stock de los repuestos lo ajusta el servidor al guardar (solo la diferencia)
      const res = await apiFetch(`/api/repairs/${editingRepair.id}`, { method: "PATCH", body: JSON.stringify({ parts: partsPayload(editSelectedInventory), device: editDevice, brand: editBrand, model: editModel, imei: editImei, issue: editIssue, estimatedCost: parseFloat(editCost) || 0, notes: finalNotes || null, clientName: editClientName, clientPhone: editClientPhone, clientEmail: editClientEmail, image: imageData, accessories: accArray.length > 0 ? JSON.stringify(accArray) : null, status: statusToSend, priority: editPriority, technicianId: editTechnicianId || null }) });
      if (res.ok) {
        const updated = await res.json().catch(() => null);
        const techName = techniciansList.find(t => t.id === editTechnicianId)?.name;
        setEditingRepair(null); sileo.success({ title: `Orden ${editingRepair.code} actualizada` });
        if (stageMove && updated?.id) setAdvancing({ repair: { ...editingRepair, ...updated, technician: editTechnicianId ? { id: editTechnicianId, name: techName || "" } : null }, to: editStatus });
        if (token) { await loadRepairs(token); loadNotifications(token); }
        apiFetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
      } else {
        const d = await res.json().catch(() => ({}));
        sileo.error({ title: d.error || "No se pudo guardar la orden" });
      }
    } catch {}
  };


  const printQROnly = (code: string, type: "reception" | "delivery") => {
    const urlType = type === "reception" ? "ot" : "ce";
    const bid = activeBranch ? `?branchId=${activeBranch}` : "";
    window.open(`/print-qr/${urlType}/${code}${bid}`, "_blank");
  };
  // Etiquetas S (48×30 mm) con mini QR de seguimiento, una por accesorio (cargador, funda, batería…)
  const printAccLabels = (code: string, off: number[] = [], fmt: AccLabelFmt = "s") => {
    const q = new URLSearchParams(); if (activeBranch) q.set("branchId", activeBranch); if (fmt !== "s") q.set("f", fmt); if (off.length) q.set("off", off.join(","));
    window.open(`/print/${code}/accesorios${q.size ? `?${q}` : ""}`, "_blank");
  };

  const filteredRepairs = repairs;

  if (!user) return <PageSkeleton />;
  const clock = formatClock(now);

// ═══════════════════════════════════════════
// FIN DE LA PARTE 1 — CONTINÚA EN PARTE 2
// ═══════════════════════════════════════════
return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }} suppressHydrationWarning>
{advancing && (
  <AdvanceDialog repair={{ id: advancing.repair.id, code: advancing.repair.code, device: [advancing.repair.device, advancing.repair.brand, advancing.repair.model].filter(Boolean).join(" "), technicianId: advancing.repair.technicianId, technicianName: advancing.repair.technician?.name, clientPhone: advancing.repair.clientPhone }}
    to={advancing.to} isManager onClose={() => setAdvancing(null)}
    onDone={() => { setAdvancing(null); const token = sessionStorage.getItem("token"); if (token) { loadRepairs(token); loadNotifications(token); } }} />
)}
{viewImage && (<div role="dialog" aria-modal="true" aria-label="Foto ampliada" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}><div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}><img src={viewImage} alt="Equipo" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)", display: "block" }} />{viewImages.length > 1 && (<><button onClick={prevImage} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }} onPointerEnter={mouseOnly((e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; })} onPointerLeave={mouseOnly((e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; })}>‹</button><button onClick={nextImage} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }} onPointerEnter={mouseOnly((e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; })} onPointerLeave={mouseOnly((e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; })}>›</button><div style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, alignItems: "center" }}>{viewImages.map((_, idx) => (<div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" key={idx} onClick={() => { setViewImageIdx(idx); setViewImage(viewImages[idx]); }} style={{ width: idx === viewImageIdx ? 20 : 8, height: 8, borderRadius: 4, background: idx === viewImageIdx ? "var(--accent)" : "rgba(255,255,255,0.3)", cursor: "pointer", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }} />))}</div><div style={{ position: "absolute", bottom: -36, right: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{viewImageIdx + 1} / {viewImages.length}</div></>)}<button onClick={() => setViewImage(null)} style={{ position: "absolute", top: -16, right: -16, width: 36, height: 36, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button></div></div>)}

      {/* ═══ MODAL EDITAR ═══ */}
      {editingRepair && (() => {
        const editTabs = [
          ...(servicesList.length > 0 ? [{ key: "services" as const, label: "Servicios", count: editSelectedServices.length }] : []),
          ...(softwareList.length > 0 ? [{ key: "software" as const, label: "Programas", count: editSelectedSoftware.length }] : []),
          ...(editVideogamesList.length > 0 || editSelectedVideogames.length > 0 ? [{ key: "games" as const, label: "Juegos", count: editSelectedVideogames.length }] : []),
        ];
        const tab = editTabs.some(t => t.key === editTab) ? editTab : editTabs[0]?.key;
        return (
        <FormModal wide icon={<Pencil size={24} strokeWidth={STROKE} />} onClose={() => setEditingRepair(null)}
          title={<>Editar orden <span style={{ fontFamily: "ui-monospace, monospace" }}>{editingRepair.code}</span></>}
          subtitle={[editingRepair.clientName, [editDevice, editBrand, editModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => setEditingRepair(null)}>Cancelar</button>
            <SaveButton onClick={() => saveEdit({ preventDefault() {} } as React.FormEvent)} disabled={uploading}>Guardar cambios</SaveButton>
          </>}>
          <form id="edit-order-form" onSubmit={saveEdit} style={{ display: "grid", gap: 14 }}>
            <FormSection icon={<Flag size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Estado" hint="Al avanzar se registra lo que se hizo">
              <div className="ox-chips" role="group" aria-label="Estado">
                {ALL_STATUS_KEYS.map(key => { const s = STATUS[key]; const on = editStatus === key; return (
                  <button key={key} type="button" className="ox-chip" aria-pressed={on} onClick={() => setEditStatus(key)} style={on ? { background: s.bg, borderColor: s.color, color: s.color } : undefined}>
                    <span className="e" aria-hidden="true"><StatusIcon status={key} size={18} /></span>{s.label}
                  </button>
                ); })}
              </div>
            </FormSection>

            <FormSection icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
              <div className="ox-row">
                <Field label="Nombre"><input className="ox-input" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} /></Field>
                <Field label="Celular"><input className="ox-input" value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} inputMode="tel" /></Field>
              </div>
            </FormSection>

            <FormSection icon={<Smartphone size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Equipo">
              <div className="ox-chips" role="group" aria-label="Tipo de equipo" style={{ marginBottom: 12 }}>
                {catalogo.devices.map(d => (
                  <button key={d.name} type="button" className="ox-chip" aria-pressed={editDevice.trim().toLowerCase() === d.name.toLowerCase()} onClick={() => setEditDevice(d.name)}>
                    <span className="e" aria-hidden="true"><DeviceIcon device={d.name} size={18} /></span>{d.name}
                  </button>
                ))}
              </div>
              <div className="ox-row3">
                <Field label="Tipo de equipo"><input className="ox-input" value={editDevice} onChange={(e) => setEditDevice(e.target.value)} /></Field>
                <Field label="Marca"><input className="ox-input" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} /></Field>
                <Field label="Modelo"><input className="ox-input" value={editModel} onChange={(e) => setEditModel(e.target.value)} /></Field>
              </div>
              <div style={{ marginTop: 12 }}><ImeiField value={editImei} onChange={setEditImei} modo={modoIdentificador(catalogo, editDevice)} repairId={editingRepair.id} labelStyle={oxLabelStyle} fieldStyle={oxFieldStyle} /></div>
            </FormSection>

            <FormSection icon={<Stethoscope size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Problema y estado del equipo">
              <div className="ox-row">
                <Field label="¿Qué le pasa?"><textarea className="ox-input" value={editIssue} onChange={(e) => setEditIssue(e.target.value)} rows={3} /></Field>
                <Field label="Cómo llegó (rayones, golpes...)"><textarea className="ox-input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></Field>
              </div>
              <div className="ox-photos" style={{ marginTop: 12 }}>
                {editImagePreviews.map((preview, idx) => (
                  <div key={idx} className="ox-ph">
                    <img src={preview} alt={`Foto ${idx + 1}`} />
                    <button type="button" className="x" onClick={() => removeEditImage(idx)} aria-label={`Quitar foto ${idx + 1}`}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    {uploading && idx === editImagePreviews.length - 1 && <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>Subiendo…</div>}
                  </div>
                ))}
                <button type="button" className="ox-ph-add" onClick={handleEditTakePhoto}><span className="e" aria-hidden="true"><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Cámara</button>
                <button type="button" className="ox-ph-add" onClick={() => editFileInputRef.current?.click()}><span className="e" aria-hidden="true"><ImagePlus size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Subir foto</button>
                <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={handleEditImageSelect} style={{ display: "none" }} />
              </div>
            </FormSection>

            <FormSection icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios que dejó" hint="Toca para marcar">
              <div className="ox-chips" role="group" aria-label="Accesorios" translate="no">
                {[...accNames, ...editSelectedAccessories.filter(a => !accNames.includes(a))].map(acc => (
                  <button key={acc} type="button" className="ox-chip" aria-pressed={editSelectedAccessories.includes(acc)} onClick={() => toggleEditAcc(acc)}>
                    <span className="e" aria-hidden="true"><AccessoryIcon name={acc} size={18} /></span>{acc}
                  </button>
                ))}
              </div>
              {editSelectedAccessories.some(pideDetalle) && (
                <div className="ox-acc-details">
                  {editSelectedAccessories.filter(pideDetalle).map(acc => (
                    <Field key={acc} label={acc}>
                      <input className="ox-input" value={editAccessoryDetails[acc] || ""} onChange={(e) => updateEditDetail(acc, e.target.value)} />
                    </Field>
                  ))}
                </div>
              )}
            </FormSection>

            {tab && (
              <FormSection icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Servicios e instalaciones" hint="Los servicios suman al costo">
                {editTabs.length > 1 && (
                  <div className="ox-tabs" role="group" aria-label="Qué agregar">
                    {editTabs.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setEditTab(t.key)}>{t.label}{t.count > 0 && <b>{t.count}</b>}</button>)}
                  </div>
                )}
                {tab === "services" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchEditServices} onChange={(e) => setSearchEditServices(e.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" /></div>
                  <div className="ox-list">
                    {filteredEditServices.map(svc => (
                      <button key={svc.id} type="button" className="ox-item" aria-pressed={editSelectedServices.includes(svc.name)} onClick={() => toggleEditService(svc.name)}>
                        <span className="e" aria-hidden="true"><ServiceIcon icon={svc.icon} size={18} /></span><b>{svc.name}</b><span className="p tabular">Bs. {svc.price}</span>
                      </button>
                    ))}
                  </div>
                  {filteredEditServices.length === 0 && <p className="ox-hint">No hay servicios con ese nombre.</p>}
                </>)}
                {tab === "software" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchEditSoftware} onChange={(e) => setSearchEditSoftware(e.target.value)} placeholder="Buscar programa" aria-label="Buscar programa" /></div>
                  <div className="ox-list">
                    {filteredEditSoftware.map(sw => (
                      <button key={sw.id} type="button" className="ox-item" aria-pressed={editSelectedSoftware.includes(sw.name)} onClick={() => toggleEditSoftware(sw.name)}>
                        <span className="e" aria-hidden="true"><Disc3 size={14} strokeWidth={STROKE} aria-hidden="true" /></span><b>{sw.name}{sw.category && <small>{sw.category}</small>}</b>
                      </button>
                    ))}
                  </div>
                  {filteredEditSoftware.length === 0 && <p className="ox-hint">No hay programas con ese nombre.</p>}
                </>)}
                {tab === "games" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchEditVideogames} onChange={(e) => setSearchEditVideogames(e.target.value)} placeholder="Buscar videojuego" aria-label="Buscar videojuego" /></div>
                  <div className="ox-list">
                    {filteredEditVideogames.map(vg => (
                      <button key={vg.id} type="button" className="ox-item" aria-pressed={editSelectedVideogames.includes(vg.name)} onClick={() => toggleEditVideogame(vg.name)}>
                        <span className="e" aria-hidden="true"><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /></span><b>{vg.name}{(vg.platform || vg.genre) && <small>{[vg.platform, vg.genre].filter(Boolean).join(" · ")}</small>}</b>
                      </button>
                    ))}
                  </div>
                  {filteredEditVideogames.length === 0 && <p className="ox-hint">No hay videojuegos con ese nombre.</p>}
                </>)}
              </FormSection>
            )}

            {inventoryList.length > 0 && <PartsPicker items={inventoryList} value={editSelectedInventory} original={editOriginalInventory} onChange={(ids) => { setEditSelectedInventory(ids); recalcEditCost(editSelectedServices, ids); }} />}

            <FormSection icon={<UserCog size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Técnico">
              <div className="ox-techs" role="group" aria-label="Técnico">
                {techniciansList.map((t, i) => (
                  <button key={t.id} type="button" className="ox-tech" aria-pressed={editTechnicianId === t.id} onClick={() => setEditTechnicianId(t.id)}>
                    <span className="ox-av" style={{ background: TECH_COLORS[i % TECH_COLORS.length] }}>{initials(t.name)}</span>
                    <span style={{ minWidth: 0 }}><b>{t.name}</b><small>{t.activeCount ?? 0} {t.activeCount === 1 ? "orden activa" : "órdenes activas"}</small></span>
                  </button>
                ))}
                <button type="button" className="ox-tech" aria-pressed={!editTechnicianId} onClick={() => setEditTechnicianId("")}>
                  <span className="ox-av" style={{ background: "var(--text-faint)" }}>—</span>
                  <span><b>Sin asignar</b><small>Se asigna después</small></span>
                </button>
              </div>
            </FormSection>

            <FormSection icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Costo y prioridad">
              <div className="ox-row">
                <Field label="Costo total (Bs.)"><input className="ox-input tabular" value={editCost} onChange={(e) => setEditCost(e.target.value)} type="number" min="0" inputMode="decimal" /></Field>
                <div>
                  <span className="ox-label">Prioridad</span>
                  <div className="ox-prio" role="group" aria-label="Prioridad" style={{ marginTop: 0 }}>
                    {PRIORITIES.map(p => <button key={p.value} type="button" aria-pressed={editPriority === p.value} onClick={() => setEditPriority(p.value)}><StatusDot color={p.color} />{p.label}</button>)}
                  </div>
                </div>
              </div>
            </FormSection>
          </form>
        </FormModal>
        ); })()}

      {/* ═══ ENTREGAR EQUIPO: hoja de entrega y cobro (orden → accesorios → detalle → cobro) ═══ */}
      {showDeliveryModal && (() => {
        const dr = deliverySelectedRepair;
        const fmtBs = (n: number) => `Bs. ${(Math.round(n * 100) / 100).toLocaleString("es-BO")}`;
        const accDetail = (name: string) => (dr ? parseAccessoriesDisplay(dr.accessories).map(parseAccWithDetail).find(a => a.name === name)?.detail || "" : "");
        const accEntries = Object.entries(deliveryAccChecked);
        type Line = { key: string; label: string; kind: string; amount: number };
        const lines: Line[] = [
          ...deliverySelectedServices.map(name => ({ key: `s-${name}`, label: name, kind: "Servicio", amount: servicesList.find(s => s.name === name)?.price || 0 })),
          ...Object.entries(countIds(deliverySelectedInventory)).flatMap(([id, n]) => {
            const it = inventoryList.find(i => i.id === id);
            return it ? [{ key: `p-${id}`, label: n > 1 ? `${it.name} ×${n}` : it.name, kind: "Repuesto", amount: it.price * n }] : [];
          }),
        ];
        // Si el precio de la orden no es la suma exacta de los conceptos, la diferencia se muestra (el recibo siempre cuadra)
        const adjust = Math.round((dvSubtotal - lines.reduce((a, l) => a + l.amount, 0)) * 100) / 100;
        if (dr && adjust !== 0) {
          lines.push(lines.length
            ? { key: "adj", label: adjust > 0 ? "Mano de obra y otros" : "Ajuste de precio", kind: "Según el precio de la orden", amount: adjust }
            : { key: "adj", label: "Reparación", kind: "Precio acordado en la orden", amount: adjust });
        }
        let partsCost = 0, missingCost = 0;
        for (const [id, n] of Object.entries(countIds(deliverySelectedInventory))) { const it = inventoryList.find(i => i.id === id); if (it?.cost) partsCost += it.cost * n; else missingCost++; }
        const profit = dvTotal - partsCost;
        const blocked = !!dvBlocker || deliverySaving;
        const firstImg = dr ? parseImages(dr.image)[0] : null;
        return (
          <div className="dv-overlay" style={{ position: "fixed" }} onClick={nudgeOnBackdrop}>
            <div className="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="dv-title">
              <header className="dv-head">
                <div>
                  <p>Órdenes listas para entregar</p>
                  <h2 id="dv-title" ref={deliveryTitleRef} tabIndex={-1}>{dr ? `Entregar ${dr.code}` : "Entregar equipo"}</h2>
                </div>
                <button type="button" className="dv-btn-quiet" onClick={() => setShowDeliveryModal(false)}>Cerrar</button>
              </header>

              <div className="dv-layout">
                <div>
                  <section className="dv-step" aria-labelledby="dv-s1">
                    <h3 id="dv-s1"><span className="n">1</span>Orden</h3>
                    {!dr ? (<>
                      <p className="dv-hint">Elige la orden del equipo que vas a entregar.</p>
                      <div className="dv-body">
                        {completedRepairs.length === 0 ? <div className="dv-empty">No hay órdenes terminadas para entregar.</div> : completedRepairs.map(r => {
                          const img = parseImages(r.image)[0];
                          return (
                            <button key={r.id} type="button" className="dv-pick" onClick={() => selectDeliveryRepair(r)}>
                              { }
                              {img ? <img loading="lazy" decoding="async" src={img} alt="" className="dv-thumb" /> : <span className="dv-thumb" aria-hidden="true" />}
                              <span className="t">
                                <b>{[r.device, r.brand, r.model].filter(Boolean).join(" ")}</b>
                                <span><span className="dv-code">{r.code}</span>{r.clientName ? ` · ${r.clientName}` : ""}</span>
                              </span>
                              <span className="dv-num" style={{ fontWeight: 600 }}>{fmtBs(r.estimatedCost || 0)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>) : (<>
                      <p className="dv-hint">Compara con el equipo que tienes en la mano.</p>
                      <div className="dv-body dv-order">
                        { }
                        {firstImg ? <img loading="lazy" decoding="async" src={firstImg} alt={`Foto de ${dr.device}`} className="dv-thumb" /> : <span className="dv-thumb" aria-hidden="true" />}
                        <div className="t">
                          <b>{[dr.device, dr.brand, dr.model].filter(Boolean).join(" ")}</b>
                          <ul className="dv-meta">
                            {dr.clientName && <li>Cliente <b>{dr.clientName}</b></li>}
                            {dr.clientPhone && <li>Celular <b className="dv-num">{dr.clientPhone}</b></li>}
                            {dr.imei && <li>IMEI <b className="dv-num">{dr.imei}</b></li>}
                            {dr.technician?.name && <li>Técnico <b>{dr.technician.name}</b></li>}
                          </ul>
                        </div>
                        <button type="button" className="dv-link" onClick={() => selectDeliveryRepair(null)}>Cambiar</button>
                      </div>
                    </>)}
                  </section>

                  {dr && accEntries.length > 0 && (
                    <section className="dv-step" aria-labelledby="dv-s2">
                      <h3 id="dv-s2"><span className="n">2</span>Accesorios a devolver</h3>
                      <p className="dv-hint">Marca cada uno al entregarlo en la mano del cliente.</p>
                      <fieldset className="dv-body" style={{ border: 0, padding: 0, marginTop: 0, marginBottom: 0, marginRight: 0, minWidth: 0 }}>
                        <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Accesorios recibidos con el equipo</legend>
                        {accEntries.map(([name, ok]) => (
                          <label key={name} className="dv-check">
                            <input type="checkbox" checked={ok} onChange={(e) => setDeliveryAccChecked(prev => ({ ...prev, [name]: e.target.checked }))} />
                            <span><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /> {name}</span>
                            {accDetail(name) && <small>{accDetail(name)}</small>}
                          </label>
                        ))}
                        {dvShowMissing ? (
                          <div className="dv-missing">
                            <label htmlFor="dv-missing">Falta {dvMissing.join(", ").toLowerCase()}. ¿Por qué?</label>
                            <textarea id="dv-missing" rows={2} value={deliveryMissingWhy} onChange={(e) => setDeliveryMissingWhy(e.target.value)} />
                          </div>
                        ) : dvMissing.length > 0 && (
                          <button type="button" className="dv-link" onClick={() => setDeliveryMissingOpen(true)}>No se devuelve ningún accesorio</button>
                        )}
                      </fieldset>
                    </section>
                  )}

                  {dr && (
                    <section className="dv-step" aria-labelledby="dv-s3">
                      <h3 id="dv-s3"><span className="n">{accEntries.length > 0 ? 3 : 2}</span>Detalle del cobro</h3>
                      <p className="dv-hint">Así aparece en el comprobante del cliente.</p>
                      <div className="dv-body">
                        <table className="dv-table">
                          <thead><tr><th scope="col">Concepto</th><th scope="col">Monto</th></tr></thead>
                          <tbody className="dv-num">
                            {lines.length ? lines.map(l => (
                              <tr key={l.key}><td>{l.label}<small>{l.kind}</small></td><td>{fmtBs(l.amount)}</td></tr>
                            )) : <tr><td colSpan={2}>Sin conceptos: agrega los servicios o repuestos.</td></tr>}
                          </tbody>
                        </table>
                        {deliverySelectedSoftware.length > 0 && <p className="dv-hint" style={{ margin: "10px 0 0" }}>Programas instalados: {deliverySelectedSoftware.join(", ")}</p>}

                        {servicesList.length > 0 && (
                          <details className="dv-edit" open={showDeliveryServices} onToggle={(e) => setShowDeliveryServices((e.target as HTMLDetailsElement).open)}>
                            <summary>Servicios realizados ({deliverySelectedServices.length})</summary>
                            <input type="search" aria-label="Buscar servicio" value={searchDeliveryServices} onChange={(e) => setSearchDeliveryServices(e.target.value)} placeholder="Buscar servicio" />
                            <div className="list">
                              {filteredDeliveryServices.map(svc => (
                                <label key={svc.id} className="dv-check">
                                  <input type="checkbox" checked={deliverySelectedServices.includes(svc.name)} onChange={() => toggleDeliveryService(svc.name)} />
                                  <span>{svc.name}</span><small className="dv-num">{fmtBs(svc.price)}</small>
                                </label>
                              ))}
                              {filteredDeliveryServices.length === 0 && <p className="dv-hint" style={{ margin: "8px 0" }}>No hay servicios con ese nombre.</p>}
                            </div>
                          </details>
                        )}
                        {softwareList.length > 0 && (
                          <details className="dv-edit" open={showDeliverySoftware} onToggle={(e) => setShowDeliverySoftware((e.target as HTMLDetailsElement).open)}>
                            <summary>Programas instalados ({deliverySelectedSoftware.length})</summary>
                            <input type="search" aria-label="Buscar programa" value={searchDeliverySoftware} onChange={(e) => setSearchDeliverySoftware(e.target.value)} placeholder="Buscar programa" />
                            <div className="list">
                              {filteredDeliverySoftware.map(sw => (
                                <label key={sw.id} className="dv-check">
                                  <input type="checkbox" checked={deliverySelectedSoftware.includes(sw.name)} onChange={() => toggleDeliverySoftware(sw.name)} />
                                  <span>{sw.name}</span>{sw.category && <small>{sw.category}</small>}
                                </label>
                              ))}
                              {filteredDeliverySoftware.length === 0 && <p className="dv-hint" style={{ margin: "8px 0" }}>No hay programas con ese nombre.</p>}
                            </div>
                          </details>
                        )}
                        {inventoryList.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <PartsPicker compact title="Repuestos usados" items={inventoryList} value={deliverySelectedInventory} original={deliveryOriginalInventory} onChange={(ids) => { setDeliverySelectedInventory(ids); recalculateDeliveryCost(deliverySelectedServices, ids); }} />
                          </div>
                        )}

                        <div className="dv-field">
                          <label htmlFor="dv-discount">Descuento (Bs.)</label>
                          <input id="dv-discount" className="dv-num" inputMode="decimal" value={deliveryDiscount} onChange={(e) => setDeliveryDiscount(e.target.value)} aria-describedby="dv-discount-help" style={{ maxWidth: 160 }} />
                          <span className="help" id="dv-discount-help">Queda anotado en la orden.</span>
                        </div>
                        <div className="dv-field">
                          <label htmlFor="dv-notes">Nota de entrega <span>(opcional)</span></label>
                          <textarea id="dv-notes" rows={2} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                <aside className="dv-summary" aria-labelledby="dv-sum">
                  <h3 id="dv-sum">Resumen</h3>
                  {dr ? (<>
                    <div className="dv-row dv-num"><span>Subtotal</span><span>{fmtBs(dvSubtotal)}</span></div>
                    <div className="dv-row dv-num"><span>Descuento</span><span>{dvDiscount ? `− ${fmtBs(dvDiscount)}` : fmtBs(0)}</span></div>
                    <div className="dv-total" aria-live="polite"><span>Total a cobrar</span><span className="amount dv-num">{fmtBs(dvTotal)}</span></div>
                    <div className="dv-pay">
                      <div className="dv-pay-label">Cómo paga</div>
                      <PaymentPicker amount={dvTotal} value={deliveryPay} onChange={setDeliveryPay} reference={dr.code} />
                    </div>
                  </>) : <p className="dv-hint" style={{ margin: 0 }}>Elige una orden para ver el total.</p>}
                  <button type="button" className="dv-confirm" aria-disabled={blocked} aria-describedby="dv-blocker" onClick={confirmDelivery}>
                    {deliverySaving ? "Guardando…" : `Entregar y cobrar ${fmtBs(dvTotal)}`}
                  </button>
                  <p className="dv-blocker" id="dv-blocker" aria-live="polite">{dvBlocker}</p>
                  {dr && <p className="dv-after">Al confirmar, la orden pasa a Entregada{dr.clientPhone ? ", el cliente recibe el comprobante por WhatsApp" : ""} y empieza la garantía.</p>}
                  {dr && dvTotal > 0 && (
                    <details className="dv-owner">
                      <summary>Ganancia de esta orden</summary>
                      <p className="dv-num">{fmtBs(dvTotal)} − repuestos {fmtBs(partsCost)} = <b>{fmtBs(profit)}</b> ({Math.round((profit / dvTotal) * 100)} %)</p>
                      {missingCost > 0 && <p className="dv-warn">{missingCost} repuesto{missingCost > 1 ? "s" : ""} sin precio de compra (Inventario › Editar): la ganancia real es menor.</p>}
                    </details>
                  )}
                </aside>
              </div>

              <div className="dv-bar">
                <div className="t">
                  <small>Total a cobrar</small>
                  <b className="dv-num">{fmtBs(dvTotal)}</b>
                  {dr && dvBlocker && <em>{dvBlocker}</em>}
                </div>
                <button type="button" className="dv-confirm" aria-disabled={blocked} onClick={confirmDelivery}>{deliverySaving ? "Guardando…" : "Entregar"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* WhatsApp que no salió desde el número del taller: se ofrece abrirlo con el mensaje listo */}
      <WaFallback link={waFallback} onClose={() => setWaFallback(null)} />

      {/* ═══ MODAL IMPRIMIR ═══ */}
      {printModal && (
        <div aria-label="Imprimir comprobante" data-esc role="dialog" aria-modal="true" onClick={(e) => {
          // Computadora: un clic afuera NO la cierra (se perdía sin querer); hay que elegir una opción o "Ahora no".
          // Celular/tablet: tocar afuera sí la cierra (ahí no se imprime).
          if (isTouchDevice()) { setPrintModal(null); return; }
          const box = e.currentTarget.firstElementChild as HTMLElement | null;
          if (box) { box.classList.remove("rt-nudge"); void box.offsetWidth; box.classList.add("rt-nudge"); }
        }} style={{ position: "fixed", inset: 0, background: "rgba(26,29,46,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${printModal.type === "reception" ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)"}`, boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeScale 0.2s ease-out", overflow: "hidden" }}>
            {printModal.justDone && (
              <div style={{ padding: "10px 24px", background: printModal.type === "reception" ? "rgba(59,130,246,0.08)" : "rgba(16,185,129,0.08)", borderBottom: `1px solid ${printModal.type === "reception" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)"}`, fontSize: 12.5, fontWeight: 700, color: printModal.type === "reception" ? "var(--info)" : "var(--ok)" }}>
                <CircleCheck size={15} strokeWidth={STROKE} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> {printModal.type === "reception" ? `Orden ${printModal.code} registrada` : `${printModal.code} entregada · comprobante CE-${printModal.code.replace(/^OT-/i, "")}`}
              </div>
            )}
            <div style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{printModal.type === "reception" ? "Imprimir Recepción" : "Comprobante de entrega"}</h3>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Orden: <span style={{ fontFamily: "monospace", color: "var(--text-primary)", fontWeight: 600 }}>{printModal.code}</span></p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {printModal.type === "delivery" && (<>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Enviar al cliente</div>
                <ReceiptShare code={printModal.code} sentOnDelivery={printModal.wa} />
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 6 }}>Imprimir</div>
              </>)}
              <button type="button" onClick={() => { window.open(printModal.type === "reception" ? `/print/${printModal.code}?branchId=${activeBranch}` : `/delivery/${printModal.code}?branchId=${activeBranch}`, "_blank"); setPrintModal(null); }} style={{ width: "100%", textAlign: "left", fontFamily: "inherit", color: "inherit", padding: "16px 20px", borderRadius: 12, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-primary)", display: "flex", alignItems: "center", gap: 14, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }} onPointerEnter={mouseOnly((e) => { const c = printModal.type === "reception" ? "#2563eb" : "#10b981"; e.currentTarget.style.borderColor = c; e.currentTarget.style.background = printModal.type === "reception" ? "rgba(59,130,246,0.06)" : "rgba(16,185,129,0.06)"; })} onPointerLeave={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; })}>
                
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Documento Completo</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{printModal.type === "reception" ? "Orden de trabajo con QR de seguimiento" : "Comprobante de entrega con QR"}</div>
                </div>
              </button>
              <button type="button" onClick={() => { printQROnly(printModal.code, printModal.type); setPrintModal(null); }} style={{ width: "100%", textAlign: "left", fontFamily: "inherit", color: "inherit", padding: "16px 20px", borderRadius: 12, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-primary)", display: "flex", alignItems: "center", gap: 14, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }} onPointerEnter={mouseOnly((e) => { const c = printModal.type === "reception" ? "#2563eb" : "#10b981"; e.currentTarget.style.borderColor = c; e.currentTarget.style.background = printModal.type === "reception" ? "rgba(59,130,246,0.06)" : "rgba(16,185,129,0.06)"; })} onPointerLeave={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; })}>
                
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Solo Código QR</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{printModal.type === "reception" ? "QR azul de seguimiento para el cliente" : "QR verde comprobante de entrega"}</div>
                </div>
              </button>
              {/* Se despliega en el mismo modal: casillas por accesorio y formato S / Bandera / Única */}
              {printModal.type === "reception" && (() => {
                const acc = parseAccessoriesDisplay(repairs.find((r) => r.code === printModal.code)?.accessories ?? null).map((a) => parseAccWithDetail(a).name);
                return acc.length > 0 && <AccLabelsPicker items={acc} onPrint={(off, fmt) => { printAccLabels(printModal.code, off, fmt); setPrintModal(null); }} />;
              })()}
              <button type="button" onClick={() => setPrintModal(null)} style={{ marginTop: 2, padding: "10px", border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", borderRadius: 10 }}>{printModal.justDone ? (printModal.type === "delivery" ? "Listo, cerrar" : "Ahora no, imprimir después") : "Cancelar"}</button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL HISTORIAL DE CAMBIOS ═══ */}
      {historyModal && (
        <div role="dialog" aria-modal="true" aria-label="Historial de la orden" data-esc onClick={() => setHistoryModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(26,29,46,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(129,140,248,0.25)", boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeScale 0.2s ease-out", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(129,140,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}><History size={18} strokeWidth={STROKE} aria-hidden="true" /></div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Historial de cambios</h3>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Orden: <span style={{ fontFamily: "monospace", color: "var(--accent-dim)", fontWeight: 700 }}>{historyModal.code}</span></p>
              </div>
              <button onClick={() => setHistoryModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
            <div style={{ padding: "18px 22px", overflow: "auto", flex: 1 }}>
              <StatusTimeline repairId={historyModal.id} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes rtBellRing { 0%,100% { transform: rotate(0); } 15% { transform: rotate(16deg); } 30% { transform: rotate(-14deg); } 45% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 75% { transform: rotate(3deg); } }
        @media (prefers-reduced-motion: reduce) { * { animation-iteration-count: 1 !important; } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        .repair-card{transition: 0.2s ease; transition-property: var(--tr-ui)}
        @media (hover: hover) and (pointer: fine) { .repair-card:hover{border-color:rgba(var(--accent-bright-rgb), 0.20)!important;transform:translateY(-1px);box-shadow:0 4px 16px rgba(26,29,46,0.08)} }
      
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          [style*="grid-template-columns"]{grid-template-columns:1fr!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .card-compact{flex-direction:row!important}
          .card-img{width:60px!important;min-height:60px!important;max-height:80px!important;border-radius:10px!important;margin:10px!important;overflow:hidden!important}
          .card-compact p{max-width:100%!important;font-size:11px!important}
          .card-info{padding:10px 10px 10px 0!important}
          .card-info span{font-size: 11px!important}
          .card-status{flex-direction:column!important;padding:8px!important;gap:4px!important;align-items:flex-end!important}
          .msg-layout{grid-template-columns:1fr!important}
          .filter-btns{overflow-x:auto;-webkit-overflow-scrolling:touch}
        }
      `}</style>

      
      <AppSidebar user={user} />

      {/* ═══ HEADER ═══ */}
      <header className="desktop-header" style={{ position: "fixed", top: 0, left: 210, right: 0, height: 60, background: "var(--brand-dark)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 24px", zIndex: 40, gap: 12 }}>
        <GlobalSearch inline />
        <div suppressHydrationWarning style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <div className="topbar-date">
            <span className="tabular" aria-label="Hora actual">{clock.time.slice(0, 2)}{clock.time && <span className="rt-colon">:</span>}{clock.time.slice(3, 5)}</span>
            <div>
              <div style={{ textTransform: "capitalize" }}>{formatDate(now)}</div>
              {settings.city && <div className="sub">{settings.city}</div>}
            </div>
          </div>

          {/* Notification Bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button className="topbar-bell" onClick={() => setShowNotifications(!showNotifications)} style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid var(--border)", background: showNotifications ? "rgba(var(--accent-bright-rgb), 0.08)" : "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative", overflow: "visible", transition: "background 0.2s, border-color 0.2s" }}>
              <span key={`ring-${bellRing}`} style={{ display: "inline-block", transformOrigin: "50% 10%", animation: bellRing ? "rtBellRing 0.9s ease-in-out 2" : "none", lineHeight: 0 }}><Bell size={19} strokeWidth={STROKE} aria-hidden="true" /></span>
              {unreadCount > 0 && <span key={`unread-${unreadCount}`} className="rt-pop" style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px", background: "var(--danger-bright)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", border: "2px solid var(--bg-primary)", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>{unreadCount}</span>}
            </button>
            {showNotifications && (<div style={{ position: "absolute", top: 46, right: 0, width: 380, maxHeight: 460, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 12px 48px rgba(26,29,46,0.40)", overflow: "hidden", zIndex: 50, animation: "fadeScale 0.2s ease-out" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700, fontSize: 14 }}>Notificaciones {unreadCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", background: "rgba(239,68,68,0.12)", color: "var(--danger-bright)", borderRadius: 10, fontWeight: 600 }}>{unreadCount}</span>}</span><div style={{ display: "flex", gap: 10 }}>{unreadCount > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>✓ Leídas</button>}{notifications.length > 0 && <button onClick={clearAllNotifications} style={{ background: "none", border: "none", color: "var(--danger-bright)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Limpiar</button>}</div></div><div style={{ maxHeight: 400, overflow: "auto" }}>{notifications.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}><div style={{ marginBottom: 8, opacity: 0.5 }}><Bell size={28} strokeWidth={1.5} aria-hidden="true" /></div><p style={{ fontSize: 13 }}>Sin notificaciones</p></div> : notifications.map((notif, i) => (<div role="button" tabIndex={0} onKeyDown={pressKey} key={notif.id} onClick={() => { markNotificationRead(notif.id); if (notif.type === "review") router.push("/reviews"); }} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", background: notif.read ? "transparent" : "rgba(99,102,241,0.03)", display: "flex", gap: 12, alignItems: "flex-start", animation: `fadeIn 0.2s ease-out ${i * 0.03}s both` }}><span style={{ flexShrink: 0, marginTop: 2, color: "var(--text-muted)" }}><NotifIcon type={notif.type} /></span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: notif.read ? 400 : 600, color: notif.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{notif.title}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{notif.message}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(notif.createdAt).toLocaleString("es-BO", { hourCycle: "h23" })}</div></div>{!notif.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 6 }} />}</div>))}</div></div>)}
          </div>
        </div>
      </header>

      {/* ═══ CONTENIDO PRINCIPAL ═══ */}
      <div className="main-content" style={{ marginLeft: 210, paddingTop: 60 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
          {/* Saludo en la franja azul oscuro, con el resumen del día y las dos acciones principales */}
          <section className="db-welcome">
            <div>
              <h1>Panel{(() => { const b = branches.find((x) => x.id === activeBranch)?.name; return b ? <span className="sub"> · {b}</span> : null; })()}</h1>
              <p>
                {stats.completed > 0 ? `${stats.completed} ${stats.completed === 1 ? "equipo listo" : "equipos listos"} para entregar` : "Ningún equipo esperando entrega"}
                {` · ${stats.pending} ${stats.pending === 1 ? "pendiente" : "pendientes"}`}
              </p>
            </div>
            <div className="db-welcome-acts">
              {completedRepairs.length > 0 && (
                <button type="button" className="db-btn-white" onClick={openDeliveryModal}>
                  <Handshake size={18} strokeWidth={STROKE} aria-hidden="true" /> Entregar equipo <span className="db-btn-count">{completedRepairs.length}</span>
                </button>
              )}
              <button type="button" className="db-btn-amber" onClick={() => router.push("/new-order")}><Plus size={18} strokeWidth={STROKE} aria-hidden="true" /> Nueva orden</button>
            </div>
          </section>
          {
            (() => {
              const stuckCount = repairs.filter(r => {
                if (r.status === "completed" || r.status === "delivered") return false;
                const d = Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                return d >= 7;
              }).length;
              type Metric = { label: string; value: number; color: string; filter?: string; sub?: string; href?: string };
              const metrics: Metric[] = [
                { label: "Órdenes", value: stats.total, color: "#0e7c86", filter: "all" },
                { label: "Pendientes", value: stats.pending, color: STATUS.pending.color, filter: "pending" },
                { label: "En reparación", value: stats.inProgress, color: STATUS.in_progress.color, filter: "in_progress" },
                { label: "Listas para entregar", value: stats.completed, color: STATUS.completed.color, filter: "completed" },
                ...(stuckCount > 0 ? [{ label: "Estancadas (7+ días)", value: stuckCount, color: "#dc2626" }] : []),
                ...(uncollected && uncollected.items.length > 0 ? [{ label: "Sin recoger", href: "/sin-recoger", value: uncollected.items.length, color: "#c2410c", sub: (() => { const n = uncollected.items.filter(i => i.days >= uncollected.warnAfter).length; return n ? `${n} por abandonar` : ""; })() }] : []),
              ];
              return (
                <div className="db-cards" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
                  {metrics.map((m) => {
                    const body = (<>
                      <span className="db-card-top">
                        <span className="db-card-l">{m.label}</span>
                        {m.sub && <span className="db-card-chip" style={{ background: `${m.color}1a`, color: m.color }}>{m.sub}</span>}
                      </span>
                      <span className="db-card-v" style={{ color: m.filter === "completed" || !m.filter ? m.color : "var(--text-primary)" }}>{typeof m.value === "number" ? <CountUp value={m.value} /> : m.value}</span>
                    </>);
                    return m.filter ? (
                      <button key={m.label} type="button" className={`db-card${filterStatus === m.filter ? " is-active" : ""}`} aria-pressed={filterStatus === m.filter} onClick={() => setFilterStatus(m.filter!)}>{body}</button>
                    ) : m.href ? (
                      <button key={m.label} type="button" className="db-card" onClick={() => router.push(m.href!)}>{body}<span className="db-card-more">Ver lista →</span></button>
                    ) : <div key={m.label} className="db-card">{body}</div>;
                  })}
                </div>
              );
            })()
          }


          <nav className="db-quick2" aria-label="Accesos rápidos">
            {[
              { label: "Extracto", desc: "Reportes y movimientos", path: "/extracto", Icon: FileText, color: "#0369a1" },
              { label: "Cotizaciones", desc: "COT y notas de venta", path: "/quotations", Icon: Receipt, color: "#1d4ed8" },
              { label: "Certificados", desc: "Licencias y garantías", path: "/certificates", Icon: Award, color: "#047857" },
              { label: "Escáner QR", desc: "Buscar por código QR", path: "/scanner", Icon: QrCode, color: "#0e7c86" },
              { label: "Reporte del mes", desc: "PDF para imprimir", path: "__export_month__", Icon: CalendarDays, color: "#b45309" },
            ].map((s) => (
              <button
                key={s.path}
                type="button"
                onClick={() => {
                  if (s.path === "__export_month__") {
                    const d = new Date();
                    const ab = activeBranch ? `?branchId=${activeBranch}` : "";
                    window.open(`/reports/monthly/${d.getFullYear()}/${d.getMonth() + 1}${ab}`, "_blank");
                  } else {
                    router.push(s.path);
                  }
                }}
              >
                <span className="db-quick-ic" aria-hidden="true"><s.Icon size={20} strokeWidth={STROKE} /></span>
                <span><b>{s.label}</b><small>{s.desc}</small></span>
              </button>
            ))}
          </nav>

          <div className="db-toolbar">
            <label className="ui-search">
              <Search size={16} strokeWidth={STROKE} aria-hidden="true" />
              <span className="sr-only">Buscar órdenes</span>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por código, equipo o cliente" />
            </label>
            <div className="filter-btns db-chips" role="group" aria-label="Filtrar por estado">
              {[{ key: "all", label: "Todas", icon: "📋" }, ...Object.entries(STATUS).map(([key, val]) => ({ key, label: val.label, icon: val.icon }))].map((f) => {
                const isActive = filterStatus === f.key;
                const count = f.key === "all" ? stats.total : (stats.byStatus[f.key] || 0);
                return (
                  <button key={f.key} type="button" aria-pressed={isActive} className={isActive ? "is-active" : ""} onClick={() => setFilterStatus(f.key)}>
                    {f.key !== "all" && <StatusDot color={STATUS[f.key]?.color || "#5a6a80"} />}{f.label}
                    {count > 0 && <b>{count}</b>}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>Reparaciones</h2><span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 10 }}>{totalRepairs}{totalRepairs !== stats.total ? ` de ${stats.total}` : ""}</span></div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-card" style={{ animation: `cardIn 0.4s ease-out ${i * 0.08}s both` }}>
                  <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-title" />
                    <div className="skeleton skeleton-text" />
                    <div className="skeleton skeleton-text-sm" />
                  </div>
                  <div style={{ width: 80, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div className="skeleton" style={{ width: 70, height: 24, borderRadius: 12 }} />
                    <div className="skeleton" style={{ width: 50, height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRepairs.length === 0 ? (<div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}><div style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}><ClipboardList size={44} strokeWidth={1.5} aria-hidden="true" /></div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay reparaciones</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Crea tu primera orden</p></div>
          ) : (
            <div className="ot-list">
              <div className="ot-head card-compact" aria-hidden="true">
                <span /><span>Orden</span><span>Cliente</span><span className="ot-col-tech">Técnico</span><span>Estado</span><span>Últ. cambio</span><span className="r">Monto</span>
              </div>
              {(filteredRepairs || []).map((repair, i) => {
                const st = STATUS[repair.status] || STATUS.pending;
                const isSel = expandedId === repair.id;
                const repairImages = parseImages(repair.image); const firstImage = repairImages[0] || null;
                // Detectar OT estancada: +7 días sin cambios y status no final
                const daysSinceUpdate = Math.floor((Date.now() - new Date(repair.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                const isStuck = daysSinceUpdate >= 7 && repair.status !== "completed" && repair.status !== "delivered";
                const ago = daysSinceUpdate <= 0 ? "hoy" : daysSinceUpdate === 1 ? "ayer" : `hace ${daysSinceUpdate} días`;
                const deviceName = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
                const open = () => setExpandedId(isSel ? null : repair.id);
                return (
                  <div key={repair.id} data-repair-id={repair.id} data-flash-id={repair.id} className={`repair-card ot-row${isSel ? " is-sel" : ""}`}
                    role="button" tabIndex={0} aria-label={`Abrir ${repair.code}`} onClick={open} onKeyDown={pressKey}
                    style={{ animation: `fadeIn 0.3s ease-out ${Math.min(i, 12) * 0.03}s both` }}>
                    {/* Celular: tarjeta corta */}
                    <div className="card-phone">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <OrderTag code={repair.code} />
                        {repair.warrantyOf && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--warn)", background: "var(--warn-bg)", padding: "2px 7px", borderRadius: 6 }}>Garantía · {repair.warrantyOf}</span>}
                        {isStuck && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger-bright)", background: "rgba(239,68,68,0.12)", padding: "2px 7px", borderRadius: 6 }}><TriangleAlert size={12} strokeWidth={STROKE} aria-hidden="true" /> {daysSinceUpdate}d</span>}
                        <span style={{ flex: 1 }} />
                        <span className="rp-status" data-flip style={{ background: st.bg, color: st.color, borderColor: "transparent" }}><StatusDot color={st.color} />{st.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                        {firstImage && <img loading="lazy" decoding="async" role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" src={firstImage} alt="" onClick={(e) => { e.stopPropagation(); openImageViewer(repairImages, 0); }} style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6 }}><DeviceIcon device={repair.device} /> {[repair.device, repair.brand, repair.model].filter(Boolean).join(" · ")}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 12.5, color: "var(--text-secondary)", minWidth: 0 }}>{repair.clientName || "Sin nombre"}</span>
                            <b style={{ color: "var(--text-primary)", fontSize: 14, flexShrink: 0 }}>Bs. {Math.round(repair.estimatedCost || 0).toLocaleString()}</b>
                          </div>
                          {repair.technician && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>Técnico: {repair.technician.name}</div>}
                        </div>
                      </div>
                    </div>
                    {/* Computadora: una fila de la tabla */}
                    <div className="card-compact ot-grid">
                      <div className="ot-pic">
                        {firstImage ? (
                          <button type="button" className="rp-thumb ot-thumb" aria-label={`Ver fotos de ${repair.code}`} onClick={(e) => { e.stopPropagation(); openImageViewer(repairImages, 0); }}>
                            <img loading="lazy" decoding="async" src={firstImage} alt="" />
                            {repairImages.length > 1 && <span><Camera size={10} strokeWidth={STROKE} aria-hidden="true" /> {repairImages.length}</span>}
                          </button>
                        ) : <span className="rp-dev ot-dev" style={{ background: st.bg }} aria-hidden="true"><DeviceIcon device={repair.device} size={22} /></span>}
                      </div>
                      <div className="ot-main">
                        <div className="rp-title">
                          <span className="rp-code">{repair.code}</span>
                          <span className="rp-device">{deviceName}</span>
                          {repair.warrantyOf && <span className="rp-tag is-warn" title={`Reingreso por garantía de ${repair.warrantyOf}`}>Garantía · {repair.warrantyOf}</span>}
                        </div>
                        {repair.issue && <div className="rp-issue">{repair.issue}</div>}
                      </div>
                      <div className="ot-cell"><b>{repair.clientName || "Sin nombre"}</b>{repair.clientPhone && <small>{repair.clientPhone}</small>}</div>
                      <div className="ot-cell ot-col-tech">{repair.technician ? <b>{repair.technician.name}</b> : <small>Sin técnico</small>}</div>
                      <div><span className="rp-status" style={{ background: st.bg, color: st.color, borderColor: "transparent" }}><StatusDot color={st.color} />{st.label}</span></div>
                      <div className="ot-cell">{isStuck ? <span className="ot-stuck" title="Sin cambios hace más de 7 días"><TriangleAlert size={13} strokeWidth={STROKE} aria-hidden="true" /> {daysSinceUpdate} días</span> : <small>{ago}</small>}</div>
                      <div className="rp-amount ot-amt">Bs. {Math.round(repair.estimatedCost || 0).toLocaleString("es-BO")}</div>
                    </div>
                    {isSel && (() => {
                      const isDelivered = repair.status === "delivered";
                      const currentTrackingIndex = isDelivered ? TRACKING_KEYS.length - 1 : TRACKING_KEYS.indexOf(repair.status);
                      const nextStatus = !isDelivered && currentTrackingIndex >= 0 && currentTrackingIndex < TRACKING_KEYS.length - 1 ? TRACKING_KEYS[currentTrackingIndex + 1] : undefined;
                      const repairAcc = parseAccessoriesDisplay(repair.accessories);
                      const parsedAll = parseNotesAll(repair.notes, servicesList);
                      const repairNotes = parsedAll.notes; const repairDeliveryNotes = parsedAll.deliveryNotes;
                      const sendWa = async () => { const link = await personalLink(repair.id); const msg = `Estimado/a${repair.clientName ? ` *${repair.clientName}*` : ""},\n\nNos comunicamos de *${settings.companyName}* respecto a su equipo *${repair.device}${repair.brand ? ` ${repair.brand || "—"}` : ""}* (${repair.code}).\n\nPuede ver el estado de su equipo aquí:\n🔗 ${link}${link.endsWith("/portal") ? "" : `\n\n🛍️ Conozca nuestros productos y servicios:\n🔗 ${getBaseUrl()}/portal`}\n\nAtentamente,\n*${settings.companyName}*`; sendWhatsApp(repair.clientPhone, msg); };
                      const card = (icon: React.ReactNode, title: string, body: React.ReactNode, right?: React.ReactNode, cls = "") => (
                        <div className={`oxc ${cls}`}><div className="oxc-h"><span className="ic" aria-hidden="true">{icon}</span>{title}{right != null && <span className="r">{right}</span>}</div><div className="oxc-b">{body}</div></div>
                      );
                      const chips = (items: string[], icon?: (n: string) => string | undefined) => <div className="oxd-chips">{items.map((n) => <span key={n}>{icon?.(n)} {n}</span>)}</div>;
                      return (
                        <div className="oxd" onClick={(e) => e.stopPropagation()}>
                          {repairImages.length > 0 && (
                            <div className="oxd-photos">
                              {repairImages.map((img, idx) => (
                                <button key={idx} type="button" onClick={() => openImageViewer(repairImages, idx)} aria-label={`Ver foto ${idx + 1}`}><img loading="lazy" decoding="async" src={img} alt="" /><em>{idx + 1}/{repairImages.length}</em></button>
                              ))}
                            </div>
                          )}

                          {/* Izquierda: Cliente | Equipo y Detalles (se estira hasta la altura del Seguimiento: no queda hueco). Derecha: Seguimiento */}
                          {/* Resumen: lo importante de la orden sin bajar (código, equipo, estado, cliente, total, técnico) */}
                          <div className="oxd-sum">
                            <div className="oxd-sum-main">
                              <div className="oxd-sum-t"><b>{repair.code} · {[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</b><span className="oxd-st" style={{ color: st.color, background: `${st.color}14` }}><StatusIcon status={repair.status} size={13} /> {st.label}</span></div>
                              <div className="oxd-sum-s">{[repair.clientName, repair.clientPhone, `ingresó ${new Date(repair.createdAt).toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(/\./g, "")}`].filter(Boolean).join(" · ")}</div>
                            </div>
                            <div className="oxd-sum-total"><span>{isDelivered ? "Total" : "Costo estimado"}</span><b>Bs. {Math.round(repair.estimatedCost || 0).toLocaleString("es-BO")}</b></div>
                            <label className="oxd-sum-tech"><span>Técnico</span>
                              <select value={repair.technicianId || ""} onChange={(e) => assignTechnician(repair.id, e.target.value)} aria-label="Técnico asignado">
                                <option value="">— Sin asignar —</option>{techniciansList.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                              </select>
                            </label>
                          </div>

                          {/* Etapas en una línea: hechas en oscuro, la actual con el color de su estado */}
                          <OrderFlow status={repair.status} statuses={STATUS} stepKeys={TRACKING_KEYS} updatedAt={repair.updatedAt} />

                          <div className="oxd-grid">
                            {card(<DeviceIcon device={repair.device} size={15} />, "Equipo y recepción", <>
                              <dl className="oxd-dl">
                                <dt>Equipo</dt><dd>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ") || "—"}</dd>
                                <dt>Problema</dt><dd>{repair.issue || "—"}</dd>
                                <dt>Observaciones</dt><dd>{repairNotes || "Ninguna"}</dd>
                                {isDelivered && repairDeliveryNotes && <><dt>Notas de entrega</dt><dd>{repairDeliveryNotes}</dd></>}
                              </dl>
                              <ImeiInfo key={`${repair.id}:${repair.imei || ""}`} repair={repair} />
                              {repairAcc.length > 0 && <><div className="oxd-sub oxd-sub-act">Accesorios ({repairAcc.length}){!isDelivered && <button type="button" onClick={() => printAccLabels(repair.code)} title="Imprimir etiquetas para los accesorios"><Printer size={13} strokeWidth={STROKE} aria-hidden="true" /> Etiquetas</button>}</div>{chips(repairAcc)}</>}
                            </>)}
                            {/* Trabajo y costo: servicios, repuestos e instalaciones; con descuento muestra subtotal, descuento y total */}
                            {card(<Wrench size={15} strokeWidth={STROKE} />, "Trabajo y costo", <OrderCost parsed={parsedAll} isDelivered={isDelivered} estimatedCost={repair.estimatedCost} />)}
                          </div>

                          <div className="oxd-log"><RepairLogPanel repairId={repair.id} /></div>

                          <div className="oxd-actions" translate="no">
                            {nextStatus && <button type="button" className="go" onClick={() => { if (needsAdvanceDialog(nextStatus)) setAdvancing({ repair, to: nextStatus }); else updateStatus(repair.id, nextStatus); }}><StatusIcon status={nextStatus} /> Pasar a {STATUS[nextStatus].label}</button>}
                            <button type="button" className="wa" onClick={sendWa}><MessageCircle size={16} strokeWidth={STROKE} aria-hidden="true" /> WhatsApp</button>
                            <button type="button" onClick={() => openEditForm(repair)}><Pencil size={16} strokeWidth={STROKE} aria-hidden="true" /> Editar</button>
                            {!isDelivered && <button type="button" onClick={() => setPrintModal({ code: repair.code, type: "reception" })}><Printer size={16} strokeWidth={STROKE} aria-hidden="true" /> Recepción</button>}
                            {isDelivered && <button type="button" onClick={() => setPrintModal({ code: repair.code, type: "delivery" })}><Printer size={16} strokeWidth={STROKE} aria-hidden="true" /> Entrega</button>}
                            <button type="button" onClick={() => openChat({ repairId: repair.id })}><MessageSquare size={16} strokeWidth={STROKE} aria-hidden="true" /> Chat</button>
                            <button type="button" onClick={() => setHistoryModal({ id: repair.id, code: repair.code })}><History size={16} strokeWidth={STROKE} aria-hidden="true" /> Historial</button>
                            <button type="button" className="del" onClick={async () => { if (await askConfirm(`¿Eliminar ${repair.code}?`)) deleteRepair(repair.id); }} aria-label={`Eliminar ${repair.code}`}><Trash2 size={16} strokeWidth={STROKE} aria-hidden="true" /> Eliminar</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
              <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: currentPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: currentPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>«</button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: currentPage === 1 ? "var(--bg-tertiary)" : "var(--bg-card)", color: currentPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce((acc: (number | string)[], p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p); return acc;
                }, [])
                .map((p, i) =>
                  typeof p === "string" ? (
                    <span key={`dots-${i}`} style={{ padding: "8px 6px", fontSize: 12, color: "var(--text-muted)" }}>...</span>
                  ) : (
                    <button key={p} className="rt-pg" onClick={() => goToPage(p as number)} style={{ padding: "8px 14px", borderRadius: 8, border: p === currentPage ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: p === currentPage ? "rgba(var(--accent-bright-rgb), 0.08)" : "var(--bg-card)", color: p === currentPage ? "var(--accent-dim)" : "var(--text-secondary)", fontSize: 12, fontWeight: p === currentPage ? 800 : 600, cursor: "pointer", minWidth: 38, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}>{p}</button>
                  )
                )}
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: currentPage === totalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: currentPage === totalPages ? "default" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: currentPage === totalPages ? "var(--bg-tertiary)" : "var(--bg-card)", color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: currentPage === totalPages ? "default" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>»</button>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Pág {currentPage} de {totalPages}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPage />
    </Suspense>
  );
}
