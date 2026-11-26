"use client";
import { Box, Camera, CircuitBoard, Clock, Cog, Cpu, Disc3, Gamepad2, HardDrive, Image as ImageIcon, Joystick, Laptop, MemoryStick, Monitor, Package, Palette, RefreshCw, Ruler, Search, Store, Tag, TriangleAlert, X, Zap } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { errMsg, errOf } from "@/shared/errors";
import { useCallback, useEffect, useState, useRef } from "react";
import { detectQR as detectQRShared } from "@/frontend/lib/qr-detect";
import { PortalTracker } from "@/frontend/components/PortalTracker";
import { WhatsAppFab, WhatsAppMini, type PortalBranch } from "@/frontend/components/PortalWhatsApp";
import { PortalHow, PortalReviews, type PublicReviews } from "@/frontend/components/PortalSections";
import { PortalBranches } from "@/frontend/components/PortalBranches";
import { PortalSide } from "@/frontend/components/PortalSide";
import { ReserveButton, WaitlistButton, EMPTY_HOLDS, type Holds } from "@/frontend/components/PortalReserve";
import { PortalSheet, type SheetSpec } from "@/frontend/components/PortalSheet";
import { PortalCard } from "@/frontend/components/PortalCard";
import { cortoCpu, cortoRam, cortoGpu } from "@/shared/resumen-equipo";
import { thumb } from "@/shared/thumb";
import { pressKey, mouseOnly } from "@/frontend/lib/a11y";
import { coverVars, type CoverFit, type PortalNav } from "@/shared/portal-cover";
import type { Html5Qrcode } from "html5-qrcode";
interface InventoryItem { kind?: string;
  id: string; name: string; category: string | null; quantity: number;
  price: number; image: string | null; branch?: { id: string; name: string } | null; createdAt?: string;
}
interface SoftwareItem {
  id: string; name: string; category: string | null; image: string | null;
  minRequirements: string | null; recRequirements: string | null; size: string | null;
  description: string | null; language: string | null; rating: string | null;
  price?: number | null;
  branch?: { id: string; name: string } | null; createdAt?: string;
}
interface VideogameItem {
  id: string; name: string; platform: string | null; genre: string | null;
  description: string | null; size: string | null; minRequirements: string | null;
  recRequirements: string | null; language: string | null; rating: string | null;
  image: string | null; price?: number | null; branch?: { id: string; name: string } | null; createdAt?: string;
}
interface ConsoleItem {
  id: string; code?: string | null; name: string; category: string | null; state: string | null;
  brand: string | null; model: string | null; color: string | null;
  storage: string | null; generation: string | null; accessories: string | null;
  condition: string; price: number; notes: string | null; image: string | null;
  branchId?: string; branch?: { id: string; name: string } | null; createdAt?: string;
}
interface Equipment {
  id: string; code: string; name: string; type: string; brand: string | null; model: string | null;
  processor: string | null; ram: string | null; storage: string | null; storage2: string | null;
  screenSize: string | null; graphicsCard: string | null; os: string | null; cabinet: string | null;
  powerSupply: string | null; motherboard: string | null; accessories: string | null;
  condition: string; price: number; notes: string | null; image: string | null;
  createdAt: string; branchId?: string; branch?: { id: string; name: string } | null;
}

// Resultado que existe en varias sucursales (equipo, consola, certificado, cotización): el cliente elige cuál abrir
interface BranchPick {
  id: string; device?: string | null; branchId?: string; name?: string; price?: number | null; createdAt?: string;
  branch?: { id: string; name: string } | null;
  item?: Equipment | ConsoleItem; // equipo o consola completos, para abrir su ficha
}

function parseEqImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr.filter(Boolean); } catch {}
  return img.trim() ? [img] : [];
}

// Filtros rápidos: tarjeta gráfica dedicada (no integrada) y RAM en GB
const conGpu = (g: string | null) => !!g && !/intel\s*(uhd|iris|hd)|integrad|radeon\s*(graphics|vega)|apple|\bm[123]\b/i.test(g);
const ramGb = (r: string | null) => Number((r || "").match(/(\d+)\s*GB/i)?.[1] || 0);
// Ícono pequeño y fila de especificación (se omite si el dato está vacío)
const icon = (C: typeof Cpu) => <C size={14} strokeWidth={STROKE} aria-hidden="true" />;
const spec = (ic: React.ReactNode, label: string, value: string | null | undefined): SheetSpec[] => (value && value.trim() ? [{ icon: ic, label, value }] : []);

function getEqDisplayName(eq: Equipment): string {
  if (eq.type === "desktop") {
    const cab = (eq.cabinet || "").trim();
    return cab ? `PC Escritorio ${cab}` : "PC Escritorio";
  }
  return ["Laptop", eq.brand, eq.model].filter(Boolean).join(" ") || "Laptop";
}

const EQ_CONDITIONS: Record<string, { label: string; color: string }> = {
  disponible: { label: "Disponible", color: "#047857" },
  vendido: { label: "Vendido", color: "#0e7c86" },
  en_reparacion: { label: "En reparación", color: "#b45309" },
};

const PLATFORM_COLORS: Record<string, string> = {
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
const getPlatformColor = (p: string | null) => (p && PLATFORM_COLORS[p]) || "#0e7c86";

const CONSOLE_CAT_COLORS: Record<string, string> = {
  "Nintendo": "#ef4444",
  "Sony": "#3b82f6",
  "Microsoft": "#10b981",
  "Sega": "#8b5cf6",
  "Retro": "#f59e0b",
  "Atari": "#ec4899",
};
const getConsoleCatColor = (c: string | null) => (c && CONSOLE_CAT_COLORS[c]) || "#0e7c86";

function getConsoleDisplayName(cn: { name: string; brand: string | null; model: string | null }): string {
  return [cn.brand, cn.name, cn.model].filter(Boolean).join(" ").trim() || cn.name;
}

const CONSOLE_CONDITIONS: Record<string, { label: string; color: string }> = {
  disponible: { label: "Disponible", color: "#047857" },
  vendida: { label: "Vendida", color: "#0e7c86" },
  reservada: { label: "Reservada", color: "#b45309" },
};

export default function PortalPage() {
  const [tab, setTab] = useState<"inventory" | "parts" | "software" | "videogames" | "consoles" | "equipment">("inventory");
  // Reservas en línea (si alguna sucursal las activó)
  const [bookingOn, setBookingOn] = useState(false);
  useEffect(() => { fetch("/api/appointments/public").then(r => r.ok ? r.json() : null).then(d => setBookingOn(!!d?.enabled)).catch(() => {}); }, []);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [software, setSoftware] = useState<SoftwareItem[]>([]);
  const [videogames, setVideogames] = useState<VideogameItem[]>([]);
  const [consoles, setConsoles] = useState<ConsoleItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // Sin conexión con el servidor: se muestran los esqueletos de carga y se reintenta solo cada 15 s
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedSw, setSelectedSw] = useState<SoftwareItem | null>(null);
  const [selectedVg, setSelectedVg] = useState<VideogameItem | null>(null);
  const [selectedCn, setSelectedCn] = useState<ConsoleItem | null>(null);
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  // Apartados: qué sucursales aceptan y cuánto está apartado ahora (se refresca cada 30 s)
  const [holds, setHolds] = useState<Holds>(EMPTY_HOLDS);
  const loadHolds = useCallback(() => { fetch("/api/reservations/public", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setHolds(d); }).catch(() => {}); }, []);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") loadHolds(); };
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [loadHolds]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  // Orden del catálogo y filtros rápidos (equipos: tarjeta gráfica, 16 GB, SSD; consolas: nuevas o usadas)
  const [orden, setOrden] = useState<"nombre" | "menor" | "mayor" | "recientes">("nombre");
  const [rapidos, setRapidos] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [mounted, setMounted] = useState(false);
  const [pageInv, setPageInv] = useState(1);
  const [pageSw, setPageSw] = useState(1);
  const [pageVg, setPageVg] = useState(1);
  const [pageCn, setPageCn] = useState(1);
  const [pageEq, setPageEq] = useState(1);
  // Columnas de la rejilla del catálogo (igual que el CSS de .portal-grid) y 4 filas por página (no llena toda la pantalla)
  const [gridCols, setGridCols] = useState(5);
  useEffect(() => {
    const calc = () => { const w = window.innerWidth; setGridCols(w <= 768 ? 2 : w <= 960 ? 3 : w <= 1180 ? 4 : 5); };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  const PAGE_SIZE = gridCols * 4;
  // Si cambia el tamaño de página (girar el celular, achicar la ventana) se vuelve a la página 1
  useEffect(() => { setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }, [gridCols]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerDivId = "portal-qr-reader";
  const [settings, setSettings] = useState<{ companyName: string; logo: string | null; slogan: string; phone: string | null; city: string | null; warrantyDays: number; portalCover?: string | null; portalCoverFit?: CoverFit; portalCoverMobile?: string | null; portalNav?: PortalNav }>({ companyName: "", logo: null, slogan: "", phone: null, city: null, warrantyDays: 30 });
  const [contactBranches, setContactBranches] = useState<PortalBranch[]>([]);
  const [publicReviews, setPublicReviews] = useState<PublicReviews | null>(null);

  useEffect(() => { setMounted(true); loadData(); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, logo: d.logo, slogan: d.slogan, phone: d.phone || null, city: d.city || null, warrantyDays: Number(d.warrantyDays) || 30, portalCover: d.portalCover || null, portalCoverFit: d.portalCoverFit === "contain" ? "contain" : "cover", portalCoverMobile: d.portalCoverMobile || null, portalNav: d.portalNav === "dark" ? "dark" : "light" }); }).catch(() => {}); fetch("/api/branches").then(r => r.ok ? r.json() : []).then(b => { if (Array.isArray(b)) setContactBranches(b); }).catch(() => {}); fetch("/api/reviews/public").then(r => r.ok ? r.json() : null).then(d => { if (d && Array.isArray(d.reviews)) setPublicReviews(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado
  useEffect(() => { const interval = setInterval(() => loadData(true), 15000); return () => clearInterval(interval); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  // Deep link: ?eq={id} opens equipment modal automatically once data is loaded
  const [pendingEqId, setPendingEqId] = useState<string | null>(null);
  const [pendingCnId, setPendingCnId] = useState<string | null>(null);
  const [pendingSwId, setPendingSwId] = useState<string | null>(null);
  const [pendingVgId, setPendingVgId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const eqId = params.get("eq");
    if (eqId) setPendingEqId(eqId);
    const cnId = params.get("cn");
    if (cnId) setPendingCnId(cnId);
    // QR o enlaces compartidos de programas y videojuegos (/portal?sw=… / ?vg=…): abrir su pestaña y su ficha
    const swId = params.get("sw");
    const vgId = params.get("vg");
    if (swId) { setTab("software"); setPendingSwId(swId); }
    else if (vgId) { setTab("videogames"); setPendingVgId(vgId); }
  }, []);
  useEffect(() => {
    if (!pendingEqId || equipment.length === 0) return;
    const upper = pendingEqId.toUpperCase();
    const found = equipment.find(e =>
      e.id === pendingEqId ||
      (e.code && e.code.toUpperCase() === upper)
    );
    if (found) {
      setTab("equipment");
      setSelectedEq(found);
      setCarouselIdx(0);
      setPendingEqId(null);
    }
  }, [pendingEqId, equipment]);
  useEffect(() => {
    if (!pendingCnId || consoles.length === 0) return;
    const upper = pendingCnId.toUpperCase();
    const found = consoles.find(c =>
      c.id === pendingCnId ||
      (c.code && c.code.toUpperCase() === upper)
    );
    if (found) {
      setTab("consoles");
      setSelectedCn(found);
      setCarouselIdx(0);
      setPendingCnId(null);
    }
  }, [pendingCnId, consoles]);
  useEffect(() => {
    if (!pendingSwId || software.length === 0) return;
    const found = software.find(x => x.id === pendingSwId);
    if (found) { setSelectedSw(found); setCarouselIdx(0); }
    setPendingSwId(null);
  }, [pendingSwId, software]);
  useEffect(() => {
    if (!pendingVgId || videogames.length === 0) return;
    const found = videogames.find(x => x.id === pendingVgId);
    if (found) { setSelectedVg(found); setCarouselIdx(0); }
    setPendingVgId(null);
  }, [pendingVgId, videogames]);

  // Keyboard navigation for equipment carousel
  useEffect(() => {
    if (!selectedEq) return;
    const imgs = parseEqImages(selectedEq.image);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If zoom viewer is open, close it first (don't close the equipment modal)
        if (viewImage) { setViewImage(null); return; }
        setSelectedEq(null);
        return;
      }
      if (viewImage) return; // arrows do nothing while zoom viewer is open
      if (imgs.length <= 1) return;
      if (e.key === "ArrowLeft") setCarouselIdx(i => (i - 1 + imgs.length) % imgs.length);
      if (e.key === "ArrowRight") setCarouselIdx(i => (i + 1) % imgs.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEq, viewImage]);

  // Bloquear scroll del body cuando un modal está abierto
  useEffect(() => {
    const anyModalOpen = !!(selectedSw || selectedVg || selectedCn || selectedEq || viewImage);
    if (anyModalOpen) {
      // Calcular el ancho de la barra de scroll para compensar y evitar saltos
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const prevOverflow = document.body.style.overflow;
      const prevPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
      };
    }
  }, [selectedSw, selectedVg, selectedCn, selectedEq, viewImage]);

  const handleQrResult = (decodedText: string) => {
    const detected = detectQR(decodedText);
    navigateTo(detected);
  };

  // Mismo reconocimiento de QR que el escáner del personal (src/frontend/lib/qr-detect.ts)
  function detectQR(text: string): { type: string; code: string } {
    const d = detectQRShared(text);
    if (d.type === "equipment" && /^EQ-/i.test(d.code)) return { type: "equipment-short", code: d.code };
    if (d.type === "console" && /^CN-/i.test(d.code)) return { type: "console-short", code: d.code };
    return { type: d.type, code: d.code };
  }

  const [navigating, setNavigating] = useState(false);
  const [navError, setNavError] = useState("");

  const [branchPickerData, setBranchPickerData] = useState<{repairs: BranchPick[], type: string, code: string} | null>(null);

  const openEquipmentById = (eqId: string): boolean => {
    // Match by full id OR by code (e.g. "EQ-1", case insensitive)
    const found = equipment.find(e => e.id === eqId);
    if (found) {
      setTab("equipment");
      setSelectedEq(found);
      setCarouselIdx(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return true;
    }
    return false;
  };

  const navigateTo = async (detected: { type: string; code: string }) => {
    setNavigating(true); setNavError("");

    // Programas / videojuegos / productos: se abre la pestaña del catálogo aquí mismo
    if (detected.type === "software" || detected.type === "videogame" || detected.type === "portal") {
      setTab(detected.type === "software" ? "software" : detected.type === "videogame" ? "videogames" : "inventory");
      setNavigating(false);
      setTimeout(() => document.querySelector(".portal-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      return;
    }
    if (detected.type === "url") { window.location.href = detected.code; return; }

    // Equipment QR (full id from URL)
    if (detected.type === "equipment") {
      if (openEquipmentById(detected.code)) { setNavigating(false); return; }
      // If not in the current list yet, try to reload and retry
      try {
        const eqRes = await fetch("/api/equipment");
        if (eqRes.ok) {
          const items = await eqRes.json();
          setEquipment(items);
          const found = items.find((e: Equipment) => e.id === detected.code);
          if (found) { setTab("equipment"); setSelectedEq(found); setCarouselIdx(0); setNavigating(false); return; }
        }
      } catch {}
      setNavError(`No se encontró el equipo escaneado`); setNavigating(false); return;
    }

    // Códigos cortos EQ-N / CN-N: cada sucursal numera por su cuenta, así que
    // el mismo código puede existir en varias; si pasa, se pregunta cuál ver
    if (detected.type === "equipment-short" || detected.type === "console-short") {
      const isEq = detected.type === "equipment-short";
      const upper = detected.code.toUpperCase();
      try {
        const res = await fetch(isEq ? "/api/equipment" : "/api/consoles");
        if (res.ok) {
          const items: (Equipment | ConsoleItem)[] = await res.json();
          if (isEq) setEquipment(items as Equipment[]); else setConsoles(items as ConsoleItem[]);
          const matches = items.filter(x => x.code && x.code.toUpperCase() === upper);
          if (matches.length > 1) {
            setBranchPickerData({ repairs: matches.map(m => ({ ...m, device: m.name, branchId: m.branch?.id || m.branchId, item: m })), type: isEq ? "equipment" : "console", code: upper });
            setNavigating(false); return;
          }
          if (matches.length === 1) {
            if (isEq) { setTab("equipment"); setSelectedEq(matches[0] as Equipment); } else { setTab("consoles"); setSelectedCn(matches[0] as ConsoleItem); }
            setCarouselIdx(0); setNavigating(false); return;
          }
        }
      } catch {}
      setNavError(`No se encontró ${isEq ? "el equipo" : "la consola"}: ${detected.code}`); setNavigating(false); return;
    }

    // Console QR (full id from URL)
    if (detected.type === "console") {
      let found = consoles.find(c => c.id === detected.code);
      if (found) {
        setTab("consoles"); setSelectedCn(found); setCarouselIdx(0); setNavigating(false);
        window.scrollTo({ top: 0, behavior: "smooth" }); return;
      }
      try {
        const cnRes = await fetch("/api/consoles");
        if (cnRes.ok) {
          const items: ConsoleItem[] = await cnRes.json();
          setConsoles(items);
          found = items.find(c => c.id === detected.code);
          if (found) { setTab("consoles"); setSelectedCn(found); setCarouselIdx(0); setNavigating(false); return; }
        }
      } catch {}
      setNavError(`No se encontró la consola escaneada`); setNavigating(false); return;
    }

    // CL - Certificado de Licencia
    if (detected.type === "certificate") {
      try {
        const res = await fetch(`/api/certificates?code=${detected.code}`);
        if (!res.ok) { setNavError(`No se encontró el certificado: ${detected.code}`); setNavigating(false); return; }
        const data = await res.json();
        if (data.multiple) {
          setBranchPickerData({ repairs: data.certificates.map((c: BranchPick & { clientName: string }) => ({ ...c, device: c.clientName, branchId: c.branch?.id || c.branchId })), type: "certificate", code: detected.code });
          setNavigating(false); return;
        }
        setNavigating(false);
        window.location.href = `/certificate-view/${detected.code}?branchId=${data.branchId || data.branch?.id}`;
        return;
      } catch { setNavError("Error al buscar el certificado"); setNavigating(false); return; }
    }

    if (detected.type === "quotation" || detected.type === "sale") {
      try {
        const res = await fetch(`/api/quotations?code=${detected.code}`);
        if (!res.ok) { setNavError(`No se encontró el documento: ${detected.code}`); setNavigating(false); return; }
        const data = await res.json();
        if (data.multiple) {
          setBranchPickerData({ repairs: data.quotations.map((q: BranchPick & { clientName: string | null; code: string }) => ({ ...q, device: q.clientName || q.code })), type: detected.type, code: detected.code });
          setNavigating(false); return;
        }
        setNavigating(false);
        window.location.href = `/quotations/print/${detected.code}?branchId=${data.branchId}`;
        return;
      } catch { setNavError("Error al buscar el documento"); setNavigating(false); return; }
    }
    if (detected.type === "delivery") {
      try {
        const res = await fetch(`/api/track/${detected.code}?public=1`);
        if (!res.ok) { setNavError(`No se encontró la orden: ${detected.code}`); setNavigating(false); return; }
        const data = await res.json();
        if (data.multiple) { setBranchPickerData({ repairs: data.repairs, type: "delivery", code: detected.code }); setNavigating(false); return; }
        setNavigating(false);
        window.location.href = `/delivery/view/${detected.code}?branchId=${data.branchId}`;
        return;
      } catch { setNavError("Error al buscar la orden"); setNavigating(false); return; }
    }
    // track / code
    try {
      const res = await fetch(`/api/track/${detected.code}?public=1`);
      if (!res.ok) { setNavError(`No se encontró la orden: ${detected.code}`); setNavigating(false); return; }
      const data = await res.json();
      if (data.multiple) { setBranchPickerData({ repairs: data.repairs, type: "track", code: detected.code }); setNavigating(false); return; }
      setNavigating(false);
      window.location.href = `/track/${detected.code}?from=portal&branchId=${data.branchId}`;
    } catch { setNavError("Error al buscar la orden"); setNavigating(false); return; }
  };

  const handleBranchSelect = (repair: BranchPick) => {
    const branchId = repair.branchId;
    if (branchPickerData?.type === "equipment" || branchPickerData?.type === "console") {
      const item = repair.item;
      if (!item) return;
      if (branchPickerData.type === "equipment") { setTab("equipment"); setSelectedEq(item as Equipment); } else { setTab("consoles"); setSelectedCn(item as ConsoleItem); }
      setCarouselIdx(0); setBranchPickerData(null); return;
    }
    if (branchPickerData?.type === "certificate") {
      window.open(`/certificate-view/${branchPickerData.code}?branchId=${branchId}`, "_blank");
    } else if (branchPickerData?.type === "delivery") {
      window.open(`/delivery/view/${branchPickerData.code}?branchId=${branchId}`, "_blank");
    } else if (branchPickerData?.type === "quotation" || branchPickerData?.type === "sale") {
      window.open(`/quotations/print/${branchPickerData.code}?branchId=${branchId}`, "_blank");
    } else {
      window.location.href = `/track/${branchPickerData?.code}?from=portal&branchId=${branchId}`;
    }
    setBranchPickerData(null);
  };

  const startScanner = async () => {
    setShowScanner(true);
    setScannerError("");
    setScannerReady(false);
    // Release any existing media streams first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {}
    setTimeout(async () => {
      const tryStart = async (facingMode: string) => {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(scannerDivId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => { stopScanner(); handleQrResult(decodedText); },
          () => {}
        );
        setScannerReady(true);
      };
      try {
        await tryStart("environment");
      } catch (err) {
        // Fallback: try front camera
        if (errOf(err).name === "NotReadableError" || errOf(err).name === "OverconstrainedError") {
          try {
            await tryStart("user");
            return;
          } catch {}
        }
        setScannerError(
          errOf(err).name === "NotReadableError" || errMsg(err)?.includes("video source")
            ? "La cámara está en uso por otra aplicación (Teams, Zoom, otro tab). Ciérrala e intenta de nuevo, o sube una foto del QR."
            : errOf(err).name === "NotAllowedError"
            ? "Permiso de cámara denegado. Habilítalo en la barra de dirección del navegador o sube una foto del QR."
            : "No se pudo iniciar la cámara. Puedes subir una foto del QR en su lugar."
        );
      }
    }, 400);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("portal-qr-file-temp");
      const result = await scanner.scanFile(file, true);
      handleQrResult(result);
    } catch {
      setScannerError("No se pudo leer el QR de la imagen. Intenta con otra foto más clara.");
    }
    e.target.value = "";
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch {}
    setShowScanner(false);
    setScannerReady(false);
    setScannerError("");
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      loadHolds();
      const [invRes, swRes, vgRes, cnRes, eqRes] = await Promise.all([fetch("/api/inventory"), fetch("/api/software"), fetch("/api/videogames"), fetch("/api/consoles"), fetch("/api/equipment")]);
      setLoadFailed(![invRes, swRes, vgRes, cnRes, eqRes].some(r => r.ok));
      if (invRes.ok) setInventory(await invRes.json());
      if (swRes.ok) setSoftware(await swRes.json());
      if (vgRes.ok) setVideogames(await vgRes.json());
      if (cnRes.ok) setConsoles(await cnRes.json());
      if (eqRes.ok) setEquipment(await eqRes.json());
    } catch { setLoadFailed(true); }
    if (!silent) setLoading(false);
  };

  // Productos y Repuestos salen del mismo inventario, separados por tipo
  // Pestañas del portal: solo se muestran las que tienen algo (si todo está vacío queda "Productos")
  type PortalTab = typeof tab;
  const portalTabs: { key: PortalTab; icon: React.ReactNode; label: string; count: number }[] = [
    { key: "inventory", icon: <Package size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Productos", count: inventory.filter(i => i.kind !== "part").length },
    { key: "parts", icon: <Cog size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Repuestos", count: inventory.filter(i => i.kind === "part").length },
    { key: "software", icon: <Disc3 size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Programas", count: software.length },
    { key: "videogames", icon: <Gamepad2 size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Videojuegos", count: videogames.length },
    { key: "consoles", icon: <Joystick size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Consolas", count: consoles.filter(c => c.condition === "disponible").length },
    { key: "equipment", icon: <Laptop size={18} strokeWidth={STROKE} aria-hidden="true" />, label: "Equipos", count: equipment.filter(e => e.condition === "disponible").length },
  ];
  const firstTabWithItems = portalTabs.find(t => t.count > 0)?.key ?? "inventory";
  // Cargando, o sin conexión y todavía sin nada que mostrar: esqueletos en vez de listas vacías
  const sinDatos = loadFailed && inventory.length + software.length + videogames.length + consoles.length + equipment.length === 0;
  const cargando = loading || sinDatos;
  const currentTabEmpty = !cargando && (portalTabs.find(t => t.key === tab)?.count ?? 0) === 0;
  // Si la pestaña abierta quedó vacía (o se ocultó), pasar a la primera que tenga contenido
  useEffect(() => {
    if (currentTabEmpty && tab !== firstTabWithItems && !selectedEq && !selectedCn) setTab(firstTabWithItems);
  }, [currentTabEmpty, tab, firstTabWithItems, selectedEq, selectedCn]);

  const isInvTab = tab === "inventory" || tab === "parts";
  const invSource = inventory.filter(i => (tab === "parts") === (i.kind === "part"));
  const invCategories = ["all", ...Array.from(new Set(invSource.map(i => i.category).filter(Boolean))) as string[]];
  const swCategories = ["all", ...Array.from(new Set(software.map(s => s.category).filter(Boolean))) as string[]];
  const vgCategories = ["all", ...Array.from(new Set(videogames.map(v => v.platform).filter(Boolean))) as string[]];
  const cnCategories = ["all", ...Array.from(new Set(consoles.map(c => c.category).filter(Boolean))) as string[]];
  const eqCategories = ["all", "laptop", "desktop"];
  const categories = isInvTab ? invCategories : tab === "software" ? swCategories : tab === "videogames" ? vgCategories : tab === "consoles" ? cnCategories : eqCategories;
  const allBranches = ["all", ...Array.from(new Set([...inventory, ...software, ...videogames, ...consoles, ...equipment].map((x) => x.branch?.name).filter(Boolean))) as string[]];

  // Orden alfabético (ignora mayúsculas/acentos; "Office 2" antes que "Office 10")
  const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
  // Los agotados también se muestran (en gris, con "Agotado"), al final de la lista
  const filteredInventory = invSource.filter(i =>
    (search === "" || i.name.toLowerCase().includes(search.toLowerCase()) || (i.category || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || i.category === categoryFilter) &&
    (branchFilter === "all" || i.branch?.name === branchFilter)
  ).sort((a, b) => Number(a.quantity <= 0) - Number(b.quantity <= 0) || byName(a.name, b.name));
  const ordenarPor = (pa?: number | null, pb?: number | null, ca?: string, cb?: string) =>
    orden === "menor" ? (pa || 0) - (pb || 0) : orden === "mayor" ? (pb || 0) - (pa || 0) : orden === "recientes" ? (cb || "").localeCompare(ca || "") : 0;
  const pasaEq = (e: Equipment) =>
    (!rapidos.includes("gpu") || conGpu(e.graphicsCard)) &&
    (!rapidos.includes("ram16") || ramGb(e.ram) >= 16) &&
    (!rapidos.includes("ssd") || /ssd|nvme/i.test(`${e.storage || ""} ${e.storage2 || ""}`));
  const pasaCn = (c: ConsoleItem) => (!rapidos.includes("nueva") || c.state === "Nueva") && (!rapidos.includes("usada") || (!!c.state && c.state !== "Nueva"));
  const filteredSoftware = software.filter(s =>
    (search === "" || s.name.toLowerCase().includes(search.toLowerCase()) || (s.category || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || s.category === categoryFilter) &&
    (branchFilter === "all" || s.branch?.name === branchFilter)
  ).sort((a, b) => ordenarPor(0, 0, a.createdAt, b.createdAt) || byName(a.name, b.name));
  const filteredVideogames = videogames.filter(v =>
    (search === "" ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.platform || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.genre || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || v.platform === categoryFilter) &&
    (branchFilter === "all" || v.branch?.name === branchFilter)
  ).sort((a, b) => ordenarPor(0, 0, a.createdAt, b.createdAt) || byName(a.name, b.name));
  const filteredConsoles = consoles.filter(c =>
    c.condition === "disponible" &&
    (search === "" ||
      getConsoleDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.model || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.category || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || c.category === categoryFilter) &&
    (branchFilter === "all" || c.branch?.name === branchFilter) &&
    pasaCn(c)
  ).sort((a, b) => ordenarPor(a.price, b.price, a.createdAt, b.createdAt) || byName(getConsoleDisplayName(a), getConsoleDisplayName(b)));
  const filteredEquipment = equipment.filter(e =>
    e.condition === "disponible" &&
    (search === "" ||
      getEqDisplayName(e).toLowerCase().includes(search.toLowerCase()) ||
      (e.processor || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.model || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || e.type === categoryFilter) &&
    (branchFilter === "all" || e.branch?.name === branchFilter) &&
    pasaEq(e)
  ).sort((a, b) => ordenarPor(a.price, b.price, a.createdAt, b.createdAt) || byName(getEqDisplayName(a), getEqDisplayName(b)));
  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  // WhatsApp de la barra superior: el del taller, o el de la primera sucursal que tenga
  const totalPagesInv = Math.ceil(filteredInventory.length / PAGE_SIZE);
  const pagedInventory = filteredInventory.slice((pageInv - 1) * PAGE_SIZE, pageInv * PAGE_SIZE);
  // Programas usa el mismo tamaño de página que las demás pestañas
  const SW_PAGE_SIZE = PAGE_SIZE;
  const totalPagesSw = Math.ceil(filteredSoftware.length / SW_PAGE_SIZE);
  const pagedSoftware = filteredSoftware.slice((pageSw - 1) * SW_PAGE_SIZE, pageSw * SW_PAGE_SIZE);
  const totalPagesVg = Math.ceil(filteredVideogames.length / PAGE_SIZE);
  const pagedVideogames = filteredVideogames.slice((pageVg - 1) * PAGE_SIZE, pageVg * PAGE_SIZE);
  const totalPagesCn = Math.ceil(filteredConsoles.length / PAGE_SIZE);
  const pagedConsoles = filteredConsoles.slice((pageCn - 1) * PAGE_SIZE, pageCn * PAGE_SIZE);
  const totalPagesEq = Math.ceil(filteredEquipment.length / PAGE_SIZE);
  const pagedEquipment = filteredEquipment.slice((pageEq - 1) * PAGE_SIZE, pageEq * PAGE_SIZE);
  // Ficha del portal (PortalSheet): enlace para compartir, flechas anterior/siguiente sobre la lista filtrada
  // y "También te puede interesar" (mismo tipo primero, luego el precio más parecido)
  const multiSuc = allBranches.length > 2;
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal` : "/portal";
  const abrir = <T,>(set: (x: T | null) => void) => (x: T) => { set(x); setCarouselIdx(0); };
  const navOf = <T extends { id: string }>(list: T[], cur: T, open: (x: T) => void) => {
    const i = list.findIndex(x => x.id === cur.id);
    if (i < 0 || list.length < 2) return null;
    return { index: i, total: list.length, onPrev: () => open(list[(i - 1 + list.length) % list.length]), onNext: () => open(list[(i + 1) % list.length]) };
  };
  const cercanos = <T extends { id: string; price?: number | null }>(list: T[], cur: T, same: (x: T) => boolean) =>
    list.filter(x => x.id !== cur.id)
      .map(x => ({ x, d: (same(x) ? 0 : 1e9) + Math.abs((x.price || 0) - (cur.price || 0)) }))
      .sort((a, b) => a.d - b.d).slice(0, 3).map(a => a.x);

  const verEnCatalogo = (t: typeof tab, q: string) => { setTab(t); setSearch(q); setCategoryFilter("all"); setBranchFilter("all"); setPageInv(1); scrollToCatalog(); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", position: "relative", overflowX: "clip" }}>
      <PortalTracker />
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .portal-card { transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1); transition-property: var(--tr-ui); cursor: default; border-radius: 14px !important; }
        .portal-card:active { transform: scale(0.98); }
        .portal-card .card-img-wrap { position: relative; overflow: hidden; aspect-ratio: 4/3; background: #f1f5f9; }
        .portal-card .card-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; display: block; }
        @media (hover: hover) and (pointer: fine) { .portal-card:hover { border-color: #94a3b8 !important; box-shadow: 0 2px 8px rgba(15,23,42,0.08); } }
        .tab-btn { padding: 10px 24px; border-radius: 12px; border: 1px solid transparent; font-size: 14px; font-weight: 700; cursor: pointer; transition: 0.2s; transition-property: var(--tr-ui); background: transparent; color: var(--text-muted); }
        @media (hover: hover) and (pointer: fine) { .tab-btn:hover { color: var(--text-secondary); background: var(--bg-hover); } }
        .tab-btn.active { background: #fff; color: var(--text-primary); border-color: var(--border); box-shadow: 0 1px 2px rgba(15,23,42,0.05); }
        .cat-chip { padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border); font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; transition-property: var(--tr-ui); background: transparent; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
        @media (hover: hover) and (pointer: fine) { .cat-chip:hover { border-color: rgba(var(--accent-bright-rgb), 0.14); color: var(--text-secondary); } }
        .cat-chip.active { background: var(--brand-dark); color: #fff; border-color: var(--text-primary); }
        .skeleton { background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px; }
        .portal-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .portal-card .pc-img { background: #ffffff; }
        /* Programas: tarjeta compacta (logo cuadrado, título en 2 líneas) */
        @media(max-width:1180px) { .portal-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media(max-width:960px) { .portal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media(max-width:768px) {
          .portal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .portal-card { border-radius: 12px !important; }
          .portal-card .pc-body { padding: 10px 10px 12px !important; }
          .portal-card h3 { font-size: 13px !important; line-height: 1.25 !important; }
          .portal-card .pc-price { font-size: 15px !important; }
          .portal-card .pc-body span { font-size: 12px !important; }
          .portal-card > div[style*="absolute"] { font-size: 12px !important; padding: 2px 6px !important; top: 6px !important; }
          .portal-card .pc-media > div[style*="absolute"] { font-size: 12px !important; padding: 3px 7px !important; top: 6px !important; right: 6px !important; }
          .portal-header-content { flex-direction: column; text-align: center; }
          .portal-header-content h1 { font-size: 22px !important; }
          .portal-search { width: 100% !important; }
          .tab-btn { padding: 8px 16px; font-size: 13px; }
          .portal-top-bar { flex-direction: column; gap: 12px !important; }
          .cat-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap !important; }
          .portal-track-actions { flex-direction: column !important; }
          .portal-track-actions > * { width: 100% !important; flex: unset !important; }
          .portal-track-actions > div { width: 100% !important; }
          .portal-codes-ref { flex-wrap: wrap; }
          .eq-specs-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
        @media(max-width:480px) {
          .portal-header-content h1 { font-size: 19px !important; }
          .tab-btn { padding: 8px 12px; font-size: 12px; }
          .tab-btn span { display: none; }
        }
      `}</style>


      {/* Image viewer modal */}
      {viewImage && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" data-esc onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={viewImage} alt="Producto" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(26,29,46,0.40)", display: "block" }} />
            <button onClick={() => setViewImage(null)} style={{ position: "absolute", top: -12, right: -12, width: 32, height: 32, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
          </div>
        </div>
      )}



      {/* Barra superior: marca, secciones y WhatsApp siempre a mano */}
      <header className={`pt-nav${settings.portalNav === "dark" ? " is-dark" : ""}`}>
        <div className="pt-wrap">
          <a className="pt-brand" href="/portal">
            {settings.logo
              ? <img src={settings.logo} alt="" className="pt-brand-logo" />
              : <span className="pt-brand-mark" aria-hidden="true">{(settings.companyName || "T").trim().charAt(0).toUpperCase()}</span>}
            <span>{settings.companyName}</span>
          </a>
          <nav className="pt-links" aria-label="Secciones">
            <a href="#seguimiento">Seguimiento</a>
            <a href="#catalogo">Catálogo</a>
            {contactBranches.length > 0 && <a href="#sucursales" onClick={(e) => { const lado = document.getElementById("sucursales-lado"); if (lado && lado.offsetParent) { e.preventDefault(); lado.scrollIntoView({ behavior: "smooth", block: "start" }); } }}>Sucursales</a>}
            {bookingOn && <a href="/reservar">Reservar cita</a>}
          </nav>
        </div>
      </header>

      {/* Franja de la marca con el buscador de órdenes como protagonista */}
      <main>
      {/* Fondo: la foto de portada de Configuración (oscurecida para leer el texto) o el azul oscuro */}
      <section className={`pt-hero2${settings.portalCover ? " has-cover" : ""}`} id="seguimiento" style={settings.portalCover ? coverVars(settings.portalCover, settings.portalCoverFit, settings.portalCoverMobile) : undefined}>
        <div className="pt-wrap pt-hero2-grid">
          <div>
                        <h1>Reparamos tu equipo y tú ves el avance en línea.</h1>
            <p className="pt-lead">{settings.slogan || "Diagnóstico claro, repuestos de calidad y aviso por WhatsApp cuando tu equipo está listo."}</p>
            <ul className="pt-trust">
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>Garantía de {settings.warrantyDays} días</li>
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Seguimiento en tiempo real</li>
              {contactBranches.length > 1 && <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>{contactBranches.length} sucursales</li>}
              {publicReviews && publicReviews.count >= 3 && publicReviews.average >= 4 && <li><span aria-hidden="true" style={{ color: "var(--warn-bright)", fontSize: 18 }}>★</span>{publicReviews.average.toFixed(1)} de {publicReviews.count} reseñas</li>}
            </ul>
            <form className="pt-trackbox" onSubmit={(e) => { e.preventDefault(); const el = document.getElementById("trackInput") as HTMLInputElement; if (el?.value.trim()) handleQrResult(el.value.trim()); }}>
              <label htmlFor="trackInput">¿Cómo va tu equipo? Escribe el código de tu comprobante</label>
              <div className="pt-trackrow">
                <input id="trackInput" autoComplete="off" autoCapitalize="characters" />
                <button type="submit" className="pt-btn-dark" disabled={navigating}>{navigating ? "Buscando…" : "Ver estado"}</button>
              </div>
              <button type="button" className="pt-btn-scan" onClick={startScanner}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></svg>
                Escanear el QR del comprobante
              </button>
              {navError && <p className="pt-error" role="alert"><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> {navError}</p>}
              <p className="pt-hint">También sirve para cotizaciones (<b>COT</b>), notas de venta (<b>NV</b>), entregas (<b>CE</b>), licencias (<b>CL</b>), equipos (<b>EQ</b>) y consolas (<b>CN</b>).</p>
            </form>
          </div>

        </div>
      </section>

      {/* Main content */}
      <div className="pt-main" style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {/* En pantallas anchas el catálogo va a la izquierda y la columna con sucursal, reseñas y pasos a la derecha */}
        <div className="pt-cat">

        <div className="pt-section-head">
          <h2>Catálogo</h2>
          <p>Precios en bolivianos. Consulta disponibilidad por WhatsApp.</p>
        </div>

        {/* QR Scanner Modal */}
        {showScanner && (
          <div role="dialog" aria-modal="true" aria-label="Escanear código QR" data-esc style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 400, background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", overflow: "hidden", animation: "fadeUp 0.3s ease-out" }}>
              <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}><Camera size={20} strokeWidth={STROKE} aria-hidden="true" /></span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Escanear QR</h3>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Apunta al código QR de tu orden</p>
                  </div>
                </div>
                <button onClick={stopScanner} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ position: "relative" }}>
                  <div id={scannerDivId} style={{ width: "100%", borderRadius: 12, overflow: "hidden", display: scannerError ? "none" : "block" }} />
                  {/* Línea láser mientras busca el código */}
                  {scannerReady && !scannerError && <div className="rt-laser" aria-hidden="true" />}
                </div>
                <div id="portal-qr-file-temp" style={{ display: "none" }} />
                {!scannerReady && !scannerError && (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}><Camera size={32} strokeWidth={STROKE} aria-hidden="true" /></div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Iniciando cámara...</p>
                  </div>
                )}
                {scannerError && (
                  <div style={{ padding: "24px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}><TriangleAlert size={40} strokeWidth={1.5} aria-hidden="true" /></div>
                    <p style={{ fontSize: 13, color: "var(--warn)", lineHeight: 1.6, marginBottom: 20 }}>{scannerError}</p>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "14px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <ImageIcon size={14} strokeWidth={STROKE} aria-hidden="true" /> Subir foto del QR
                      </button>
                      <button onClick={() => { stopScanner(); setTimeout(startScanner, 300); }} style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <RefreshCw size={14} strokeWidth={STROKE} aria-hidden="true" /> Reintentar cámara
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!scannerError && (
                <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <ImageIcon size={14} strokeWidth={STROKE} aria-hidden="true" /> Subir foto
                  </button>
                  <button onClick={stopScanner} style={{ flex: 1, padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs + Search */}
        <div id="catalogo" className="portal-top-bar" style={{ scrollMarginTop: 16,  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {portalTabs.filter(t => t.count > 0 || (t.key === "inventory" && !portalTabs.some(x => x.count > 0))).map(t => (
              <button key={t.key} className={`tab-btn${tab === t.key ? " active" : ""}`} onClick={() => { setTab(t.key); setSearch(""); setCategoryFilter("all"); setRapidos([]); setOrden("nombre"); setBranchFilter("all"); setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }}>
                {t.icon} {t.label} <span className="ui-count" style={{ marginLeft: 6 }}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="portal-search" style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffffff", borderRadius: 12, padding: "0 14px", border: "1.5px solid var(--border)", width: 300, boxShadow: "0 1px 4px rgba(30,42,58,0.05)" }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }}
              aria-label="Buscar en el catálogo"
              placeholder={tab === "parts" ? "Buscar repuesto..." : tab === "inventory" ? "Buscar producto..." : tab === "software" ? "Buscar programa..." : tab === "videogames" ? "Buscar videojuego, plataforma, género..." : tab === "consoles" ? "Buscar consola, marca, modelo..." : "Buscar equipo, marca, modelo, CPU..."}
              style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
            />
            {search && <span role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Limpiar búsqueda" onClick={() => setSearch("")} style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></span>}
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 2 && (
          <div className="cat-scroll" style={{ display: "flex", gap: 8, marginBottom: 10, paddingBottom: 4 }}>
            {(categories || []).map(cat => (
              <button key={cat} className={`cat-chip${categoryFilter === cat ? " active" : ""}`} onClick={() => { setCategoryFilter(cat); setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }}>
                {cat === "all" ? "Todos" : cat === "laptop" ? "Laptops" : cat === "desktop" ? "Escritorio" : cat}
              </button>
            ))}
          </div>
        )}

        {/* Branch filters */}
        {(tab === "equipment" || tab === "consoles" || tab === "software" || tab === "videogames") && (
          <div className="cat-scroll" style={{ display: "flex", gap: 8, marginBottom: 14, paddingBottom: 4, alignItems: "center" }}>
            {(tab === "equipment" ? [["gpu", "Con tarjeta gráfica"], ["ram16", "16 GB o más"], ["ssd", "Con SSD"]] : tab === "consoles" ? [["nueva", "Nuevas"], ["usada", "Usadas"]] : []).map(([k, l]) => (
              <button key={k} className={`cat-chip${rapidos.includes(k) ? " active" : ""}`} aria-pressed={rapidos.includes(k)}
                onClick={() => { setRapidos(r => r.includes(k) ? r.filter(x => x !== k) : [...r.filter(x => !((k === "nueva" && x === "usada") || (k === "usada" && x === "nueva"))), k]); setPageCn(1); setPageEq(1); }}>{l}</button>
            ))}
            <select aria-label="Ordenar" className="cat-sort" value={orden} onChange={e => { setOrden(e.target.value as typeof orden); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }}>
              <option value="nombre">Nombre (A-Z)</option>
              {(tab === "equipment" || tab === "consoles") && <option value="menor">Menor precio</option>}
              {(tab === "equipment" || tab === "consoles") && <option value="mayor">Mayor precio</option>}
              <option value="recientes">Más recientes</option>
            </select>
          </div>
        )}

        {allBranches.length > 2 && (
          <div className="cat-scroll" style={{ display: "flex", gap: 8, marginBottom: 20, paddingBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", padding: "6px 0", whiteSpace: "nowrap" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
            {(allBranches || []).map(b => (
              <button key={b} className={`cat-chip${branchFilter === b ? " active" : ""}`} onClick={() => { setBranchFilter(b); setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }} style={branchFilter === b ? { borderColor: "var(--accent-light)", background: "rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent-dim)" } : {}}>
                {b === "all" ? "Todas" : b}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {cargando && (
          <div className="portal-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 280 }} />
            ))}
          </div>
        )}

        {/* Inventory Grid */}
        {!cargando && isInvTab && (
          <>
            {filteredInventory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><Package size={48} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>{"No se encontraron resultados"}</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{search ? "Intenta con otro término de búsqueda" : tab === "parts" ? "No hay repuestos disponibles en este momento" : "No hay productos disponibles en este momento"}</p>
              </div>
            ) : (
              <div className="portal-grid">
                {(pagedInventory || []).map((item, i) => {
                  // Lo apartado por otros clientes no se ofrece: el portal muestra solo lo disponible
                  const held = holds.inv[item.id] || 0;
                  const avail = Math.max(0, item.quantity - held);
                  const fullyHeld = item.quantity > 0 && avail <= 0;
                  const resvHours = item.branch ? holds.branches[item.branch.id] : undefined;
                  return (
                  <div key={item.id} className={`portal-card pc-inv${item.quantity <= 0 ? " pc-soldout" : ""}`} style={{ background: "#ffffff", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: `fadeUp 0.4s ease-out ${i * 0.05}s both` }}>
                    {item.image ? (
                      <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" className="pc-media" onClick={() => setViewImage(item.image)} style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", cursor: "pointer", position: "relative", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={thumb(item.image)} loading="lazy" decoding="async" alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, transition: "transform 0.3s" }}
                          onPointerEnter={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1.05)"))}
                          onPointerLeave={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1)"))}
                        />
                        {item.quantity <= 0 ? <div className="pc-sold-badge" aria-label="Agotado">Agotado</div> : fullyHeld && <div className="resv-held"><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartado</div>}
                      </div>
                    ) : (
                      <div className="pc-media" style={{ width: "100%", aspectRatio: "1/1", background: "#eef2fa", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <span style={{ fontSize: 48, opacity: 0.3 }}><Package size={48} strokeWidth={1.5} aria-hidden="true" /></span>
                        {item.quantity <= 0 ? <div className="pc-sold-badge" aria-label="Agotado">Agotado</div> : fullyHeld && <div className="resv-held"><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartado</div>}
                      </div>
                    )}
                    <div className="pc-body" style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        {item.category && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 3 }}>{item.category}</span>}
                        {item.branch && contactBranches.length > 1 && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}><Store size={13} strokeWidth={STROKE} aria-hidden="true" /> {item.branch.name}</span>}
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</h3>
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span className="pc-price" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Bs. {Math.round(item.price || 0).toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: item.quantity <= 0 ? "var(--text-muted)" : fullyHeld ? "#c2410c" : avail <= 5 ? "#b45309" : "var(--ok)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {item.quantity <= 0 ? "Sin stock" : fullyHeld ? "Apartado" : avail <= 5 ? `Últimas ${avail}` : `${avail} en stock`}
                        </span>
                      </div>
                      {resvHours && avail > 0 && <ReserveButton target={{ kind: "inventory", id: item.id, name: item.name, price: item.price, image: item.image, branch: item.branch, available: avail, hours: resvHours }} maxQty={holds.maxQty} onChanged={() => loadData(true)} />}
                      {fullyHeld && <WaitlistButton kind="inventory" id={item.id} name={item.name} />}
                      <WhatsAppMini product={item.name} price={item.price} branch={item.branch} branches={contactBranches} companyPhone={settings.phone} soldOut={item.quantity <= 0} />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            <PortalPager page={pageInv} total={totalPagesInv} onChange={(p) => { setPageInv(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Software Grid */}
        {!cargando && tab === "software" && (
          <>
            {filteredSoftware.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>No se encontraron programas</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{search ? "Intenta con otro término de búsqueda" : "No hay programas disponibles en este momento"}</p>
              </div>
            ) : (
              <div className="portal-grid">
                {pagedSoftware.map(sw => (
                  <PortalCard key={sw.id} name={sw.name} branch={multiSuc ? sw.branch?.name : null}
                    summary={[sw.language, sw.size]} images={parseEqImages(sw.image)}
                    tag={sw.category} badge={sw.rating ? { label: sw.rating, tone: "muted" } : null}
                    fallbackIcon={<Disc3 size={40} strokeWidth={1.5} aria-hidden="true" />}
                    onOpen={() => { setSelectedSw(sw); setCarouselIdx(0); }} />
                ))}
              </div>
            )}
            <PortalPager page={pageSw} total={totalPagesSw} onChange={(p) => { setPageSw(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Videogames Grid */}
        {!cargando && tab === "videogames" && (
          <>
            {filteredVideogames.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><Gamepad2 size={48} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>No se encontraron videojuegos</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{search ? "Intenta con otro término de búsqueda" : "No hay videojuegos disponibles en este momento"}</p>
              </div>
            ) : (
              <div className="portal-grid">
                {pagedVideogames.map(vg => (
                  <PortalCard key={vg.id} name={vg.name} branch={multiSuc ? vg.branch?.name : null}
                    summary={[vg.genre, vg.language, vg.size]} images={parseEqImages(vg.image)}
                    tag={vg.platform} badge={vg.rating ? { label: vg.rating, tone: "muted" } : null}
                    fallbackIcon={<Gamepad2 size={40} strokeWidth={1.5} aria-hidden="true" />}
                    onOpen={() => { setSelectedVg(vg); setCarouselIdx(0); }} />
                ))}
              </div>
            )}
            <PortalPager page={pageVg} total={totalPagesVg} onChange={(p) => { setPageVg(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Videogame Detail Modal */}
        {selectedVg && (() => {
          const vg = selectedVg;
          const open = abrir(setSelectedVg);
          const platColor = getPlatformColor(vg.platform);
          return (
            <PortalSheet ariaLabel="Detalle del videojuego"
              icon={<Gamepad2 size={22} strokeWidth={STROKE} aria-hidden="true" />}
              fallbackIcon={<Gamepad2 size={56} strokeWidth={1.5} aria-hidden="true" />}
              title={vg.name} kindLabel="Videojuego"
              images={parseEqImages(vg.image)} imageIdx={carouselIdx} setImageIdx={setCarouselIdx} onZoom={setViewImage}
              summary={[vg.platform, vg.genre, vg.language, vg.size]}
              chips={[...(vg.platform ? [{ label: vg.platform, color: platColor }] : []), ...(vg.rating ? [{ label: vg.rating }] : []), ...(vg.branch ? [{ label: <><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.branch.name}</> }] : [])]}
              shareUrl={`${portalUrl}?vg=${vg.id}`}
              groups={[]}
              blocks={<>
                {vg.description && <div className="ps-block"><b>Descripción</b><p>{vg.description}</p></div>}
                {vg.platform === "PC" && vg.minRequirements && <div className="ps-block"><b>Requisitos mínimos</b><p>{vg.minRequirements}</p></div>}
                {vg.platform === "PC" && vg.recRequirements && <div className="ps-block"><b>Requisitos recomendados</b><p>{vg.recRequirements}</p></div>}
              </>}
              wa={{ product: vg.name, branch: vg.branch, branches: contactBranches, companyPhone: settings.phone }}
              nav={navOf(filteredVideogames, vg, open)}
              related={cercanos(videogames, vg, x => x.platform === vg.platform).map(x => ({ id: x.id, name: x.name, code: x.platform, image: parseEqImages(x.image)[0] || null, onOpen: () => open(x) }))}
              relatedTitle="Otros videojuegos"
              onClose={() => setSelectedVg(null)} />
          );
        })()}

        {/* Consoles Grid */}
        {!cargando && tab === "consoles" && (
          <>
            {filteredConsoles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><Joystick size={48} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>No se encontraron consolas</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{search ? "Intenta con otro término de búsqueda" : "No hay consolas disponibles en este momento"}</p>
              </div>
            ) : (
              <div className="portal-grid">
                {pagedConsoles.map(cn => (
                  <PortalCard key={cn.id} name={getConsoleDisplayName(cn)} code={cn.code} branch={multiSuc ? cn.branch?.name : null}
                    summary={[cn.storage, cn.color, cn.generation]} price={cn.price} images={parseEqImages(cn.image)}
                    tag={cn.category} badge={cn.state ? { label: cn.state, tone: cn.state === "Nueva" ? "ok" : "muted" } : null}
                    held={holds.consoles.includes(cn.id)}
                    fallbackIcon={<Joystick size={40} strokeWidth={1.5} aria-hidden="true" />}
                    onOpen={() => { setSelectedCn(cn); setCarouselIdx(0); }} />
                ))}
              </div>
            )}
            <PortalPager page={pageCn} total={totalPagesCn} onChange={(p) => { setPageCn(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Console Detail Modal */}
        {selectedCn && (() => {
          const cn = selectedCn;
          const open = abrir(setSelectedCn);
          const catColor = getConsoleCatColor(cn.category);
          const cond = CONSOLE_CONDITIONS[cn.condition] || CONSOLE_CONDITIONS.disponible;
          const name = getConsoleDisplayName(cn);
          return (
            <PortalSheet ariaLabel="Detalle de la consola"
              icon={<Joystick size={22} strokeWidth={STROKE} aria-hidden="true" />}
              fallbackIcon={<Joystick size={56} strokeWidth={1.5} aria-hidden="true" />}
              title={name} code={cn.code} kindLabel="Consola"
              images={parseEqImages(cn.image)} imageIdx={carouselIdx} setImageIdx={setCarouselIdx} onZoom={setViewImage}
              summary={[cn.storage, cn.generation, cn.state, cn.color]}
              price={cn.price}
              chips={[...(cn.category ? [{ label: cn.category, color: catColor }] : []), ...(cn.state ? [{ label: cn.state }] : []), { label: cond.label, color: cond.color, dot: true }, ...(cn.branch ? [{ label: <><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {cn.branch.name}</> }] : [])]}
              warrantyDays={settings.warrantyDays}
              shareUrl={`${portalUrl}?cn=${cn.id}`}
              groups={[{ title: "Detalles", items: [...spec(icon(Tag), "Marca", cn.brand), ...spec(icon(Package), "Modelo", cn.model), ...spec(icon(Palette), "Color", cn.color), ...spec(icon(HardDrive), "Almacenamiento", cn.storage), ...spec(icon(Gamepad2), "Generación", cn.generation)] }]}
              accessories={cn.accessories} notes={cn.notes}
              actions={cn.condition === "disponible" && cn.branch && holds.branches[cn.branch.id] ? (holds.consoles.includes(cn.id)
                ? <WaitlistButton kind="console" id={cn.id} name={name} />
                : <ReserveButton target={{ kind: "console", id: cn.id, name, price: cn.price, image: parseEqImages(cn.image)[0] || null, branch: cn.branch, available: 1, hours: holds.branches[cn.branch.id] }} maxQty={1} onChanged={() => loadData(true)} />) : null}
              wa={{ product: name, code: cn.code, price: cn.price, branch: cn.branch, branches: contactBranches, companyPhone: settings.phone }}
              nav={navOf(filteredConsoles, cn, open)}
              related={cercanos(consoles.filter(x => x.condition === "disponible"), cn, x => x.category === cn.category).map(x => ({ id: x.id, code: x.code, name: getConsoleDisplayName(x), price: x.price, image: parseEqImages(x.image)[0] || null, onOpen: () => open(x) }))}
              relatedTitle="También te puede interesar"
              onClose={() => setSelectedCn(null)} />
          );
        })()}

        {/* Software Detail Modal */}
        {selectedSw && (() => {
          const sw = selectedSw;
          const open = abrir(setSelectedSw);
          return (
            <PortalSheet ariaLabel="Detalle del programa"
              icon={<Disc3 size={22} strokeWidth={STROKE} aria-hidden="true" />}
              fallbackIcon={<Disc3 size={56} strokeWidth={1.5} aria-hidden="true" />}
              title={sw.name} kindLabel="Programa"
              images={parseEqImages(sw.image)} imageIdx={carouselIdx} setImageIdx={setCarouselIdx} onZoom={setViewImage}
              summary={[sw.category, sw.language, sw.size]}
              chips={[...(sw.category ? [{ label: sw.category, color: "#0369a1" }] : []), ...(sw.rating ? [{ label: sw.rating }] : []), ...(sw.branch ? [{ label: <><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.branch.name}</> }] : [])]}
              shareUrl={`${portalUrl}?sw=${sw.id}`}
              groups={[]}
              blocks={<>
                {sw.description && <div className="ps-block"><b>Descripción</b><p>{sw.description}</p></div>}
                {sw.minRequirements && <div className="ps-block"><b>Requisitos mínimos</b><p>{sw.minRequirements}</p></div>}
                {sw.recRequirements && <div className="ps-block"><b>Requisitos recomendados</b><p>{sw.recRequirements}</p></div>}
              </>}
              wa={{ product: sw.name, branch: sw.branch, branches: contactBranches, companyPhone: settings.phone }}
              nav={navOf(filteredSoftware, sw, open)}
              related={cercanos(software, sw, x => x.category === sw.category).map(x => ({ id: x.id, name: x.name, code: x.category, image: parseEqImages(x.image)[0] || null, onOpen: () => open(x) }))}
              relatedTitle="Otros programas"
              onClose={() => setSelectedSw(null)} />
          );
        })()}

        {/* Equipment Grid */}
        {!cargando && tab === "equipment" && (
          <>
            {filteredEquipment.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><Laptop size={48} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>No se encontraron equipos</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{search ? "Intenta con otro término de búsqueda" : "No hay equipos disponibles en este momento"}</p>
              </div>
            ) : (
              <div className="portal-grid">
                {pagedEquipment.map(eq => (
                  <PortalCard key={eq.id} name={getEqDisplayName(eq)} code={eq.code} branch={multiSuc ? eq.branch?.name : null}
                    summary={[eq.processor && cortoCpu(eq.processor), eq.ram && cortoRam(eq.ram), eq.graphicsCard && cortoGpu(eq.graphicsCard), eq.storage]}
                    price={eq.price} images={parseEqImages(eq.image)}
                    tag={eq.type === "laptop" ? "Laptop" : "Escritorio"} held={holds.equipment.includes(eq.id)}
                    fallbackIcon={eq.type === "laptop" ? <Laptop size={40} strokeWidth={1.5} aria-hidden="true" /> : <Monitor size={40} strokeWidth={1.5} aria-hidden="true" />}
                    onOpen={() => { setSelectedEq(eq); setCarouselIdx(0); }} />
                ))}
              </div>
            )}
            <PortalPager page={pageEq} total={totalPagesEq} onChange={(p) => { setPageEq(p); scrollToCatalog(); }} />
          </>
        )}

        </div>
        <PortalSide branches={contactBranches} companyName={settings.companyName} reviews={publicReviews} warrantyDays={settings.warrantyDays} />
      </div>

      {/* Con la columna lateral visible (pantallas anchas) estas secciones no se repiten abajo */}
      <div className="pt-bottom">
        <PortalHow warrantyDays={settings.warrantyDays} />
        <PortalReviews data={publicReviews} />
        <PortalBranches branches={contactBranches} companyName={settings.companyName} />
      </div>

      </main>

      <footer className="pt-footer">
        <div className="pt-wrap">
          <span><b>{settings.companyName}</b>{settings.slogan ? ` · ${settings.slogan}` : ""}</span>
          <span>Garantía de {settings.warrantyDays} días · Consultas de precios y disponibilidad por WhatsApp</span>
        </div>
      </footer>

      {/* Branch Picker Modal */}
      {branchPickerData && (
        <div data-esc role="dialog" aria-modal="true" aria-label="Seleccionar sucursal" style={{ position: "fixed", inset: 0, background: "rgba(30,42,58,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setBranchPickerData(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: "100%", background: "#ffffff", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(30,42,58,0.18)", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><Store size={48} strokeWidth={1.5} aria-hidden="true" /></div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Selecciona la Sucursal</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>{branchPickerData.type === "track" || branchPickerData.type === "delivery" ? "La orden" : branchPickerData.type === "equipment" ? "El equipo" : branchPickerData.type === "console" ? "La consola" : "El documento"} <strong style={{ color: "var(--accent)" }}>{branchPickerData.code}</strong> existe en varias sucursales. {branchPickerData.type === "track" || branchPickerData.type === "delivery" ? "¿En cuál dejaste tu equipo?" : "¿Cuál quieres ver?"}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {branchPickerData.repairs.map((r) => (
                <button key={r.id} onClick={() => handleBranchSelect(r)} style={{ padding: "14px 18px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
                  onPointerEnter={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-bright-rgb), 0.06)"; })}
                  onPointerLeave={mouseOnly((e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; })}>
                  <span><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.branch?.name || "Sucursal"}</span>
                  {/* Sin datos del cliente: cualquiera puede escribir un código en el portal */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{branchPickerData.type === "track" || branchPickerData.type === "delivery" ? r.device : branchPickerData.type === "equipment" || branchPickerData.type === "console" ? `${r.name} · Bs. ${r.price}` : (r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-BO") : "")}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setBranchPickerData(null)} style={{ marginTop: 16, padding: "10px 22px", background: "#ffffff", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Equipment Detail Modal with Carousel */}
      {selectedEq && (() => {
        const eq = selectedEq;
        const open = abrir(setSelectedEq);
        const cond = EQ_CONDITIONS[eq.condition] || EQ_CONDITIONS.disponible;
        const name = getEqDisplayName(eq);
        const laptop = eq.type === "laptop";
        return (
          <PortalSheet ariaLabel="Detalle del equipo"
            icon={laptop ? <Laptop size={22} strokeWidth={STROKE} aria-hidden="true" /> : <Monitor size={22} strokeWidth={STROKE} aria-hidden="true" />}
            fallbackIcon={laptop ? <Laptop size={56} strokeWidth={1.5} aria-hidden="true" /> : <Monitor size={56} strokeWidth={1.5} aria-hidden="true" />}
            title={name} code={eq.code} kindLabel={laptop ? "Laptop" : "PC de escritorio"}
            images={parseEqImages(eq.image)} imageIdx={carouselIdx} setImageIdx={setCarouselIdx} onZoom={setViewImage}
            summary={[eq.processor && cortoCpu(eq.processor), eq.ram && cortoRam(eq.ram), eq.graphicsCard && cortoGpu(eq.graphicsCard), eq.storage]}
            price={eq.price}
            chips={[{ label: laptop ? "Laptop" : "PC escritorio" }, { label: cond.label, color: cond.color, dot: true }, ...(eq.branch ? [{ label: <><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.branch.name}</> }] : [])]}
            warrantyDays={settings.warrantyDays}
            shareUrl={`${portalUrl}?eq=${eq.id}`}
            groups={[
              { title: "Rendimiento", items: [...spec(icon(Cpu), "Procesador", eq.processor), ...spec(icon(MemoryStick), "Memoria RAM", eq.ram), ...spec(icon(CircuitBoard), "Tarjeta gráfica", eq.graphicsCard)] },
              { title: "Almacenamiento", items: [...spec(icon(HardDrive), "Disco principal", eq.storage), ...spec(icon(HardDrive), "Disco secundario", eq.storage2)] },
              { title: "Otros", items: [...spec(icon(Tag), "Marca", eq.brand), ...spec(icon(Package), "Modelo", eq.model), ...spec(icon(Ruler), "Pantalla", eq.screenSize), ...spec(icon(Monitor), "Sistema operativo", eq.os), ...spec(icon(Box), "Gabinete", eq.cabinet), ...spec(icon(CircuitBoard), "Placa madre", eq.motherboard), ...spec(icon(Zap), "Fuente de poder", eq.powerSupply)] },
            ]}
            accessories={eq.accessories} notes={eq.notes}
            actions={eq.condition === "disponible" && eq.branch && holds.branches[eq.branch.id] ? (holds.equipment.includes(eq.id)
              ? <WaitlistButton kind="equipment" id={eq.id} name={name} />
              : <ReserveButton target={{ kind: "equipment", id: eq.id, name, price: eq.price, image: parseEqImages(eq.image)[0] || null, branch: eq.branch, available: 1, hours: holds.branches[eq.branch.id] }} maxQty={1} onChanged={() => loadData(true)} />) : null}
            wa={{ product: name, code: eq.code, price: eq.price, branch: eq.branch, branches: contactBranches, companyPhone: settings.phone }}
            nav={navOf(filteredEquipment, eq, open)}
            related={cercanos(equipment.filter(x => x.condition === "disponible"), eq, x => x.type === eq.type).map(x => ({ id: x.id, code: x.code, name: getEqDisplayName(x), price: x.price, image: parseEqImages(x.image)[0] || null, onOpen: () => open(x) }))}
            relatedTitle="También te puede interesar"
            onClose={() => setSelectedEq(null)} />
        );
      })()}

      {/* WhatsApp flotante (se oculta mientras hay una ficha abierta: la ficha tiene su propio botón) */}
      {!selectedEq && !selectedCn && !selectedSw && !selectedVg && !viewImage && (
        <WhatsAppFab branches={contactBranches} companyPhone={settings.phone} companyName={settings.companyName} />
      )}
    </div>
  );
}

/** Paginador del catálogo, igual al del Dashboard: « ‹ 1 … 4 5 6 … 20 › » y "Pág X de Y". */
function PortalPager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const nav = (disabled: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: disabled ? "var(--bg-tertiary)" : "var(--bg-card)", color: disabled ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 });
  const items = Array.from({ length: total }, (_, i) => i + 1)
    .filter(p => p === 1 || p === total || Math.abs(p - page) <= 2)
    .reduce((acc: (number | string)[], p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
      acc.push(p); return acc;
    }, []);
  return (
    <nav aria-label="Páginas del catálogo" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 24, flexWrap: "wrap" }}>
      <button onClick={() => onChange(1)} disabled={page === 1} aria-label="Primera página" className="rt-pg" style={nav(page === 1)}>«</button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior" className="rt-pg" style={nav(page === 1)}>‹</button>
      {items.map((p, i) => typeof p === "string" ? (
        <span key={`dots-${i}`} style={{ padding: "8px 6px", fontSize: 12, color: "var(--text-muted)" }}>...</span>
      ) : (
        <button key={p} className="rt-pg" onClick={() => onChange(p)} aria-current={p === page ? "page" : undefined} style={{ padding: "8px 14px", borderRadius: 8, border: p === page ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: p === page ? "rgba(var(--accent-bright-rgb), 0.08)" : "var(--bg-card)", color: p === page ? "var(--accent-dim)" : "var(--text-secondary)", fontSize: 12, fontWeight: p === page ? 800 : 600, cursor: "pointer", minWidth: 38, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}>{p}</button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === total} aria-label="Página siguiente" className="rt-pg" style={nav(page === total)}>›</button>
      <button onClick={() => onChange(total)} disabled={page === total} aria-label="Última página" className="rt-pg" style={nav(page === total)}>»</button>
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Pág {page} de {total}</span>
    </nav>
  );
}
