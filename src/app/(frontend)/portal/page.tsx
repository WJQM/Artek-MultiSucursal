"use client";
import { Box, Camera, CircuitBoard, Clock, Cog, Cpu, Disc3, Gamepad2, Globe, HardDrive, Image as ImageIcon, Joystick, Laptop, MemoryStick, Monitor, Package, Palette, RefreshCw, Ruler, Search, Store, Tag, TriangleAlert, X, Zap } from "@/frontend/components/icons";
import { STROKE, StatusDot } from "@/frontend/components/UiIcons";
import { errMsg, errOf } from "@/shared/errors";
import { useCallback, useEffect, useState, useRef } from "react";
import { detectQR as detectQRShared } from "@/frontend/lib/qr-detect";
import { PortalTracker } from "@/frontend/components/PortalTracker";
import { WhatsAppFab, WhatsAppCta, WhatsAppMini, type PortalBranch } from "@/frontend/components/PortalWhatsApp";
import { PortalHow, PortalReviews, type PublicReviews } from "@/frontend/components/PortalSections";
import { PortalBranches } from "@/frontend/components/PortalBranches";
import { PortalSide } from "@/frontend/components/PortalSide";
import { ReserveButton, WaitlistButton, EMPTY_HOLDS, type Holds } from "@/frontend/components/PortalReserve";
import { thumb } from "@/shared/thumb";
import { pressKey, mouseOnly } from "@/frontend/lib/a11y";
import { coverBackground, type CoverFit } from "@/shared/portal-cover";
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
    const calc = () => { const w = window.innerWidth; setGridCols(w <= 768 ? 2 : w <= 960 ? 3 : w <= 1180 ? 4 : w < 1440 ? 5 : 6); };
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
  const [settings, setSettings] = useState<{ companyName: string; logo: string | null; slogan: string; phone: string | null; city: string | null; warrantyDays: number; portalCover?: string | null; portalCoverFit?: CoverFit }>({ companyName: "", logo: null, slogan: "", phone: null, city: null, warrantyDays: 30 });
  const [contactBranches, setContactBranches] = useState<PortalBranch[]>([]);
  const [publicReviews, setPublicReviews] = useState<PublicReviews | null>(null);

  useEffect(() => { setMounted(true); loadData(); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, logo: d.logo, slogan: d.slogan, phone: d.phone || null, city: d.city || null, warrantyDays: Number(d.warrantyDays) || 30, portalCover: d.portalCover || null, portalCoverFit: d.portalCoverFit === "contain" ? "contain" : "cover" }); }).catch(() => {}); fetch("/api/branches").then(r => r.ok ? r.json() : []).then(b => { if (Array.isArray(b)) setContactBranches(b); }).catch(() => {}); fetch("/api/reviews/public").then(r => r.ok ? r.json() : null).then(d => { if (d && Array.isArray(d.reviews)) setPublicReviews(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado
  useEffect(() => { const interval = setInterval(() => loadData(true), 15000); return () => clearInterval(interval); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  // Deep link: ?eq={id} opens equipment modal automatically once data is loaded
  const [pendingEqId, setPendingEqId] = useState<string | null>(null);
  const [pendingCnId, setPendingCnId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const eqId = params.get("eq");
    if (eqId) setPendingEqId(eqId);
    const cnId = params.get("cn");
    if (cnId) setPendingCnId(cnId);
    // QR de programas y videojuegos (/portal?sw=… / ?vg=…): abrir su pestaña
    if (params.get("sw")) setTab("software");
    else if (params.get("vg")) setTab("videogames");
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
  const filteredSoftware = software.filter(s =>
    (search === "" || s.name.toLowerCase().includes(search.toLowerCase()) || (s.category || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || s.category === categoryFilter) &&
    (branchFilter === "all" || s.branch?.name === branchFilter)
  ).sort((a, b) => byName(a.name, b.name));
  const filteredVideogames = videogames.filter(v =>
    (search === "" ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.platform || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.genre || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || v.platform === categoryFilter) &&
    (branchFilter === "all" || v.branch?.name === branchFilter)
  ).sort((a, b) => byName(a.name, b.name));
  const filteredConsoles = consoles.filter(c =>
    c.condition === "disponible" &&
    (search === "" ||
      getConsoleDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.model || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.category || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || c.category === categoryFilter) &&
    (branchFilter === "all" || c.branch?.name === branchFilter)
  ).sort((a, b) => byName(getConsoleDisplayName(a), getConsoleDisplayName(b)));
  const filteredEquipment = equipment.filter(e =>
    e.condition === "disponible" &&
    (search === "" ||
      getEqDisplayName(e).toLowerCase().includes(search.toLowerCase()) ||
      (e.processor || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.model || "").toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || e.type === categoryFilter) &&
    (branchFilter === "all" || e.branch?.name === branchFilter)
  ).sort((a, b) => byName(getEqDisplayName(a), getEqDisplayName(b)));
  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  // WhatsApp de la barra superior: el del taller, o el de la primera sucursal que tenga
  const totalPagesInv = Math.ceil(filteredInventory.length / PAGE_SIZE);
  const pagedInventory = filteredInventory.slice((pageInv - 1) * PAGE_SIZE, pageInv * PAGE_SIZE);
  // Programas usa una columna más (tarjetas compactas), igual que .sw-grid en el CSS
  const SW_PAGE_SIZE = (gridCols <= 2 ? 2 : gridCols + 1) * 4;
  const totalPagesSw = Math.ceil(filteredSoftware.length / SW_PAGE_SIZE);
  const pagedSoftware = filteredSoftware.slice((pageSw - 1) * SW_PAGE_SIZE, pageSw * SW_PAGE_SIZE);
  const totalPagesVg = Math.ceil(filteredVideogames.length / PAGE_SIZE);
  const pagedVideogames = filteredVideogames.slice((pageVg - 1) * PAGE_SIZE, pageVg * PAGE_SIZE);
  const totalPagesCn = Math.ceil(filteredConsoles.length / PAGE_SIZE);
  const pagedConsoles = filteredConsoles.slice((pageCn - 1) * PAGE_SIZE, pageCn * PAGE_SIZE);
  const totalPagesEq = Math.ceil(filteredEquipment.length / PAGE_SIZE);
  const pagedEquipment = filteredEquipment.slice((pageEq - 1) * PAGE_SIZE, pageEq * PAGE_SIZE);

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
        .portal-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
        .portal-card .pc-img { background: #ffffff; }
        /* Programas: tarjeta compacta (logo cuadrado, título en 2 líneas) */
        .portal-grid.sw-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
        @media(min-width:1440px) { .portal-grid.sw-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); } }
        @media(max-width:1180px) { .portal-grid.sw-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
        @media(max-width:960px) { .portal-grid.sw-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media(max-width:768px) { .portal-grid.sw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
        .sw-card .sw-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sw-card .sw-lang { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media(min-width:1440px) { .portal-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
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
      <header className="pt-nav">
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
      <section className={`pt-hero2${settings.portalCover ? " has-cover" : ""}`} id="seguimiento" style={settings.portalCover ? coverBackground(settings.portalCover, settings.portalCoverFit) : undefined}>
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
              <button key={t.key} className={`tab-btn${tab === t.key ? " active" : ""}`} onClick={() => { setTab(t.key); setSearch(""); setCategoryFilter("all"); setBranchFilter("all"); setPageInv(1); setPageSw(1); setPageVg(1); setPageCn(1); setPageEq(1); }}>
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
              <div className="portal-grid sw-grid">
                {(pagedSoftware || []).map((sw, i) => {
                  const imgs = parseEqImages(sw.image);
                  const firstImg = imgs[0] || null;
                  return (
                    <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" key={sw.id} onClick={() => { setSelectedSw(sw); setCarouselIdx(0); }} className="portal-card sw-card" style={{ background: "#ffffff", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: `fadeUp 0.4s ease-out ${i * 0.05}s both`, cursor: "pointer", position: "relative" }}>
                      {sw.category && <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, padding: "3px 10px", borderRadius: 6, background: "rgba(3,105,161,0.9)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Disc3 size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.category}</div>}
                      {sw.rating && <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.9)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{sw.rating}</div>}
                      {firstImg ? (
                        <div className="pc-img" style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", padding: 10 }}>
                          <img src={thumb(firstImg)} loading="lazy" decoding="async" alt={sw.name} style={{ width: "100%", height: "100%", objectFit: "contain", transition: "transform 0.3s" }}
                            onPointerEnter={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1.05)"))}
                            onPointerLeave={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1)"))}
                          />
                        </div>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(3,105,161,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 44, opacity: 0.3 }}><Disc3 size={44} strokeWidth={1.5} aria-hidden="true" /></span>
                        </div>
                      )}
                      <div className="pc-body" style={{ padding: "10px 12px 12px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          {sw.branch && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", padding: "2px 8px", borderRadius: 99, background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1px solid rgba(var(--accent-bright-rgb), 0.20)" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.branch.name}</span>}
                        </div>
                        <h3 className="sw-title" title={sw.name} style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, color: "var(--text-primary)", lineHeight: 1.3 }}>{sw.name}</h3>
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          {sw.size && <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 6, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent-dim)", fontWeight: 600 }}><HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.size}</span>}
                          {sw.language && <span className="sw-lang" style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 6, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#0e7490", fontWeight: 600 }}><Globe size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.language}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                {(pagedVideogames || []).map((vg, i) => {
                  const imgs = parseEqImages(vg.image);
                  const firstImg = imgs[0] || null;
                  const platColor = getPlatformColor(vg.platform);
                  return (
                    <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" key={vg.id} onClick={() => { setSelectedVg(vg); setCarouselIdx(0); }} className="portal-card" style={{ background: "#ffffff", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: `fadeUp 0.4s ease-out ${i * 0.05}s both`, cursor: "pointer", position: "relative" }}>
                      {vg.platform && <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, padding: "3px 10px", borderRadius: 6, background: `${platColor}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.platform}</div>}
                      {vg.rating && <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.9)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{vg.rating}</div>}
                      {firstImg ? (
                        <div className="pc-img" style={{ width: "100%", aspectRatio: "3/4", overflow: "hidden" }}>
                          <img src={thumb(firstImg)} loading="lazy" decoding="async" alt={vg.name} style={{ width: "100%", height: "100%", objectFit: "contain", transition: "transform 0.3s" }}
                            onPointerEnter={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1.05)"))}
                            onPointerLeave={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1)"))}
                          />
                        </div>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "3/4", background: `${platColor}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 56, opacity: 0.3 }}><Gamepad2 size={56} strokeWidth={1.5} aria-hidden="true" /></span>
                        </div>
                      )}
                      <div className="pc-body" style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          {vg.genre && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.5px" }}>{vg.genre}</span>}
                          {vg.branch && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", padding: "2px 8px", borderRadius: 99, background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1px solid rgba(var(--accent-bright-rgb), 0.20)" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.branch.name}</span>}
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: "var(--text-primary)", lineHeight: 1.3 }}>{vg.name}</h3>
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {vg.size && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent-dim)", fontWeight: 600 }}><HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.size}</span>}
                          {vg.language && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#0e7490", fontWeight: 600 }}><Globe size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.language}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <PortalPager page={pageVg} total={totalPagesVg} onChange={(p) => { setPageVg(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Videogame Detail Modal */}
        {selectedVg && (() => {
          const vg = selectedVg;
          const imgs = parseEqImages(vg.image);
          const platColor = getPlatformColor(vg.platform);
          const currentImg = imgs[carouselIdx] || null;
          return (
            <div role="dialog" aria-modal="true" aria-label="Detalle del videojuego" data-esc onClick={() => setSelectedVg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, overflowY: "auto" }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${platColor}40`, boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeUp 0.3s ease-out" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}><Gamepad2 size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{vg.name}</h3>
                      {vg.platform && <span style={{ fontSize: 11, fontWeight: 700, color: platColor }}>{vg.platform}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedVg(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>

                {imgs.length > 0 ? (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", background: "var(--bg-tertiary)", position: "relative", maxHeight: 420 }}>
                      {currentImg && <img role="button" tabIndex={0} onKeyDown={pressKey} src={thumb(currentImg, 800)} alt={vg.name} style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }} onClick={() => setViewImage(currentImg)} />}
                      {imgs.length > 1 && (
                        <>
                          <button onClick={() => setCarouselIdx(i => (i - 1 + imgs.length) % imgs.length)} style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>‹</button>
                          <button onClick={() => setCarouselIdx(i => (i + 1) % imgs.length)} style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>›</button>
                          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", padding: "3px 10px", borderRadius: 12, background: "rgba(26,29,46,0.45)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{carouselIdx + 1} / {imgs.length}</div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, background: `${platColor}14`, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", maxHeight: 380 }}>
                      <span style={{ fontSize: 64, opacity: 0.3 }}><Gamepad2 size={64} strokeWidth={1.5} aria-hidden="true" /></span>
                    </div>
                  </div>
                )}

                <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {vg.platform && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${platColor}18`, color: platColor, border: `1px solid ${platColor}30` }}><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /> {vg.platform}</span>}
                    {vg.genre && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(71,85,105,0.12)", color: "var(--text-secondary)", border: "1px solid rgba(71,85,105,0.25)" }}>{vg.genre}</span>}
                    {vg.rating && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "var(--danger-bright)", border: "1px solid rgba(239,68,68,0.25)" }}>{vg.rating}</span>}
                    {vg.language && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(6,182,212,0.12)", color: "#0e7490", border: "1px solid rgba(6,182,212,0.25)" }}>{vg.language}</span>}
                    {vg.size && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(var(--accent-bright-rgb), 0.07)", color: "var(--accent-dim)", border: "1px solid rgba(var(--accent-bright-rgb), 0.11)" }}>{vg.size}</span>}
                    {vg.branch && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)" }}>{vg.branch.name}</span>}
                  </div>

                  {vg.description && (
                    <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 4 }}>Descripción</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{vg.description}</div>
                    </div>
                  )}

                  {vg.platform === "PC" && vg.minRequirements && (
                    <div style={{ padding: "14px 16px", background: "var(--warn-bg)", borderRadius: 12, border: "1.5px solid var(--warn-line)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", letterSpacing: "0.5px", marginBottom: 4 }}>Requisitos mínimos</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{vg.minRequirements}</div>
                    </div>
                  )}

                  {vg.platform === "PC" && vg.recRequirements && (
                    <div style={{ padding: "12px 16px", background: "rgba(16,185,129,0.06)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.15)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", letterSpacing: "0.5px", marginBottom: 4 }}>Requisitos recomendados</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{vg.recRequirements}</div>
                    </div>
                  )}

                  <WhatsAppCta what="este videojuego" product={vg.name} code={null} branch={vg.branch} branches={contactBranches} companyPhone={settings.phone} />
                </div>
              </div>
            </div>
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
                {(pagedConsoles || []).map((cn, i) => {
                  const imgs = parseEqImages(cn.image);
                  const firstImg = imgs[0] || null;
                  const catColor = getConsoleCatColor(cn.category);
                  const dName = getConsoleDisplayName(cn);
                  return (
                    <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto" key={cn.id} onClick={() => { setSelectedCn(cn); setCarouselIdx(0); }} className="portal-card" style={{ background: "#ffffff", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: `fadeUp 0.4s ease-out ${i * 0.05}s both`, cursor: "pointer", position: "relative" }}>
                      {cn.category && <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, padding: "3px 10px", borderRadius: 6, background: `${catColor}dd`, color: "#fff", fontSize: 11, fontWeight: 700 }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> {cn.category}</div>}
                      {holds.consoles.includes(cn.id) && <div className="resv-held bl"><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartado</div>}
                      {cn.state && <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, padding: "3px 8px", borderRadius: 6, background: cn.state === "Nueva" ? "rgba(16,185,129,0.85)" : "rgba(245,158,11,0.85)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{cn.state === "Nueva" ? null : null} {cn.state}</div>}
                      {imgs.length > 1 && <div style={{ position: "absolute", ...(cn.state ? { top: 38 } : { top: 10 }), right: 10, zIndex: 2, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}</div>}
                      {firstImg ? (
                        <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src={thumb(firstImg)} loading="lazy" decoding="async" alt={dName} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, transition: "transform 0.3s" }}
                            onPointerEnter={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1.05)"))}
                            onPointerLeave={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1)"))}
                          />
                        </div>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1/1", background: `${catColor}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 56, opacity: 0.3 }}><Joystick size={56} strokeWidth={1.5} aria-hidden="true" /></span>
                        </div>
                      )}
                      <div className="pc-body" style={{ padding: "14px 16px" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 6 }}>{dName}</h3>
                        <div className="pc-price" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Bs. {Math.round(cn.price).toLocaleString()}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {cn.storage && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent-dim)", fontWeight: 600 }}><HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" /> {cn.storage}</span>}
                          {cn.color && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(71,85,105,0.08)", border: "1px solid rgba(71,85,105,0.15)", color: "var(--text-secondary)", fontWeight: 600 }}><Palette size={14} strokeWidth={STROKE} aria-hidden="true" /> {cn.color}</span>}
                          {cn.branch && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", padding: "2px 8px", borderRadius: 99, background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1px solid rgba(var(--accent-bright-rgb), 0.20)" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {cn.branch.name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <PortalPager page={pageCn} total={totalPagesCn} onChange={(p) => { setPageCn(p); scrollToCatalog(); }} />
          </>
        )}

        {/* Console Detail Modal */}
        {selectedCn && (() => {
          const cn = selectedCn;
          const imgs = parseEqImages(cn.image);
          const catColor = getConsoleCatColor(cn.category);
          const currentImg = imgs[carouselIdx] || null;
          const cond = CONSOLE_CONDITIONS[cn.condition] || CONSOLE_CONDITIONS.disponible;
          const dName = getConsoleDisplayName(cn);
          return (
            <div role="dialog" aria-modal="true" aria-label="Detalle de la consola" data-esc onClick={() => setSelectedCn(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, overflowY: "auto" }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${catColor}40`, boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeUp 0.3s ease-out" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}><Joystick size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{dName}</h3>
                      {cn.category && <span style={{ fontSize: 11, fontWeight: 700, color: catColor }}>{cn.category}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedCn(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>

                {imgs.length > 0 ? (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", background: "var(--bg-tertiary)", position: "relative", maxHeight: 420 }}>
                      {currentImg && <img role="button" tabIndex={0} onKeyDown={pressKey} src={thumb(currentImg, 800)} alt={dName} style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }} onClick={() => setViewImage(currentImg)} />}
                      {imgs.length > 1 && (
                        <>
                          <button onClick={() => setCarouselIdx(i => (i - 1 + imgs.length) % imgs.length)} style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>‹</button>
                          <button onClick={() => setCarouselIdx(i => (i + 1) % imgs.length)} style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>›</button>
                          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", padding: "3px 10px", borderRadius: 12, background: "rgba(26,29,46,0.45)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{carouselIdx + 1} / {imgs.length}</div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 14, background: `${catColor}14`, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", maxHeight: 380 }}>
                      <span style={{ fontSize: 64, opacity: 0.3 }}><Joystick size={64} strokeWidth={1.5} aria-hidden="true" /></span>
                    </div>
                  </div>
                )}

                <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {cn.category && <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${catColor}15`, color: catColor, border: `1.5px solid ${catColor}40` }}>{cn.category}</span>}
                    {cn.state && <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: cn.state === "Nueva" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", color: cn.state === "Nueva" ? "var(--ok)" : "#c9952a", border: `1.5px solid ${cn.state === "Nueva" ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}` }}>{cn.state === "Nueva" ? null : null} {cn.state}</span>}
                    <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${cond.color}15`, color: cond.color, border: `1.5px solid ${cond.color}40` }}><StatusDot color={cond.color} /> {cond.label}</span>
                    {cn.branch && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)" }}>{cn.branch.name}</span>}
                  </div>

                  {/* Price */}
                  <div style={{ padding: "18px 20px", background: "rgba(var(--accent-bright-rgb), 0.12)", borderRadius: 12, border: "2px solid rgba(var(--accent-bright-rgb), 0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textAlign: "center" }}>Precio</div>
                      <div style={{ fontSize: 32, fontWeight: 600, color: "var(--accent)", lineHeight: 1, letterSpacing: "-1.5px" }}>Bs. {Math.round(cn.price).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Especificaciones */}
                  {(cn.brand || cn.model || cn.color || cn.storage || cn.generation) && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.6px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--accent)" }}>◆</span> Especificaciones</div>
                      <div className="eq-specs-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {cn.brand && <SpecRow icon={<Tag size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Marca" value={cn.brand} />}
                        {cn.model && <SpecRow icon={<Package size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Modelo" value={cn.model} />}
                        {cn.color && <SpecRow icon={<Palette size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Color" value={cn.color} />}
                        {cn.storage && <SpecRow icon={<HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Almacenamiento" value={cn.storage} />}
                        {cn.generation && <SpecRow icon={<Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Generación" value={cn.generation} />}
                      </div>
                    </div>
                  )}

                  {cn.accessories && (
                    <div style={{ padding: "14px 16px", background: "#ffffff", borderRadius: 12, border: "1.5px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>Accesorios incluidos</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{cn.accessories}</div>
                    </div>
                  )}

                  {cn.notes && (
                    <div style={{ padding: "14px 16px", background: "var(--warn-bg)", borderRadius: 12, border: "1.5px solid var(--warn-line)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c9952a", letterSpacing: "0.5px", marginBottom: 6 }}>Notas</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{cn.notes}</div>
                    </div>
                  )}

                  {cn.condition === "disponible" && cn.branch && holds.branches[cn.branch.id] && (holds.consoles.includes(cn.id)
                    ? <WaitlistButton kind="console" id={cn.id} name={getConsoleDisplayName(cn)} />
                    : <ReserveButton target={{ kind: "console", id: cn.id, name: getConsoleDisplayName(cn), price: cn.price, image: parseEqImages(cn.image)[0] || null, branch: cn.branch, available: 1, hours: holds.branches[cn.branch.id] }} maxQty={1} onChanged={() => loadData(true)} />)}
                  <WhatsAppCta what="esta consola" product={getConsoleDisplayName(cn)} code={cn.code} price={cn.price} branch={cn.branch} branches={contactBranches} companyPhone={settings.phone} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Software Detail Modal */}
        {selectedSw && (() => {
          const sw = selectedSw;
          const imgs = parseEqImages(sw.image);
          const currentImg = imgs[carouselIdx] || null;
          return (
            <div role="dialog" aria-modal="true" aria-label="Detalle del programa" data-esc onClick={() => setSelectedSw(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, overflowY: "auto" }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(3,105,161,0.4)", boxShadow: "0 20px 60px rgba(26,29,46,0.40)", animation: "fadeUp 0.3s ease-out" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}><Disc3 size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{sw.name}</h3>
                      {sw.category && <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>{sw.category}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedSw(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>

                {imgs.length > 0 ? (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", background: "var(--bg-tertiary)", position: "relative", maxHeight: 420 }}>
                      {currentImg && <img role="button" tabIndex={0} onKeyDown={pressKey} src={thumb(currentImg, 800)} alt={sw.name} style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }} onClick={() => setViewImage(currentImg)} />}
                      {imgs.length > 1 && (
                        <>
                          <button onClick={() => setCarouselIdx(i => (i - 1 + imgs.length) % imgs.length)} style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>‹</button>
                          <button onClick={() => setCarouselIdx(i => (i + 1) % imgs.length)} style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>›</button>
                          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", padding: "3px 10px", borderRadius: 12, background: "rgba(26,29,46,0.45)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{carouselIdx + 1} / {imgs.length}</div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px 8px" }}>
                    <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, background: "rgba(3,105,161,0.14)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", maxHeight: 380 }}>
                      <span style={{ fontSize: 64, opacity: 0.3 }}><Disc3 size={64} strokeWidth={1.5} aria-hidden="true" /></span>
                    </div>
                  </div>
                )}

                <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sw.category && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(3,105,161,0.12)", color: "#0369a1", border: "1px solid rgba(3,105,161,0.25)" }}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> {sw.category}</span>}
                    {sw.rating && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "var(--danger-bright)", border: "1px solid rgba(239,68,68,0.25)" }}>{sw.rating}</span>}
                    {sw.language && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(6,182,212,0.12)", color: "#0e7490", border: "1px solid rgba(6,182,212,0.25)" }}>{sw.language}</span>}
                    {sw.size && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(var(--accent-bright-rgb), 0.07)", color: "var(--accent-dim)", border: "1px solid rgba(var(--accent-bright-rgb), 0.11)" }}>{sw.size}</span>}
                    {sw.branch && <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)" }}>{sw.branch.name}</span>}
                  </div>

                  {sw.description && (
                    <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 4 }}>Descripción</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{sw.description}</div>
                    </div>
                  )}

                  {sw.minRequirements && (
                    <div style={{ padding: "14px 16px", background: "var(--warn-bg)", borderRadius: 12, border: "1.5px solid var(--warn-line)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", letterSpacing: "0.5px", marginBottom: 4 }}>Requisitos mínimos</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sw.minRequirements}</div>
                    </div>
                  )}

                  {sw.recRequirements && (
                    <div style={{ padding: "12px 16px", background: "rgba(16,185,129,0.06)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.15)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", letterSpacing: "0.5px", marginBottom: 4 }}>Requisitos recomendados</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sw.recRequirements}</div>
                    </div>
                  )}

                  <WhatsAppCta what="este programa" product={sw.name} code={null} branch={sw.branch} branches={contactBranches} companyPhone={settings.phone} />
                </div>
              </div>
            </div>
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
                {(pagedEquipment || []).map((eq, i) => {
                  const imgs = parseEqImages(eq.image);
                  const firstImg = imgs[0] || null;
                  const dName = getEqDisplayName(eq);
                  const disks = [eq.storage, eq.storage2].filter(Boolean);
                  return (
                    <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto"
                      key={eq.id}
                      className="portal-card"
                      onClick={() => { setSelectedEq(eq); setCarouselIdx(0); }}
                      style={{ background: "#ffffff", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: `fadeUp 0.4s ease-out ${i * 0.05}s both`, cursor: "pointer", position: "relative" }}
                    >
                      {holds.equipment.includes(eq.id) && <div className="resv-held bl"><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartado</div>}
                      {/* Type badge */}
                      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, padding: "3px 10px", borderRadius: 8, background: eq.type === "laptop" ? "rgba(37,99,235,0.85)" : "rgba(6,182,212,0.85)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                        {eq.type === "laptop" ? "Laptop" : "Desktop"}
                      </div>
                      {/* Photo count badge */}
                      {imgs.length > 1 && (
                        <div style={{ position: "absolute", top: 38, right: 10, zIndex: 2, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                          <Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {imgs.length}
                        </div>
                      )}
                      {firstImg ? (
                        <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", position: "relative", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src={thumb(firstImg)} loading="lazy" decoding="async" alt={dName} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, transition: "transform 0.3s" }}
                            onPointerEnter={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1.05)"))}
                            onPointerLeave={mouseOnly((e) => (e.currentTarget.style.transform = "scale(1)"))}
                          />
                        </div>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(6,182,212,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 48, opacity: 0.3 }}>{eq.type === "laptop" ? <Laptop size={48} strokeWidth={1.5} aria-hidden="true" /> : <Monitor size={48} strokeWidth={1.5} aria-hidden="true" />}</span>
                        </div>
                      )}
                      <div className="pc-body" style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
                          {eq.code && <span style={{ fontSize: 11, fontWeight: 600, color: "#0e7490", padding: "2px 8px", borderRadius: 6, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", fontFamily: "monospace", letterSpacing: "0.3px" }}>{eq.code}</span>}
                          {eq.branch && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", padding: "2px 8px", borderRadius: 99, background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1px solid rgba(var(--accent-bright-rgb), 0.20)" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.branch.name}</span>}
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 8 }}>{dName}</h3>

                        {/* Quick specs badges */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                          {eq.processor && <span style={{ padding: "3px 7px", borderRadius: 6, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.07)", fontSize: 11, color: "var(--accent-dim)", fontWeight: 600 }}><Cpu size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.processor}</span>}
                          {eq.ram && <span style={{ padding: "3px 7px", borderRadius: 6, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.12)", fontSize: 11, color: "var(--ok)", fontWeight: 600 }}><MemoryStick size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.ram}</span>}
                          {disks.slice(0, 1).map((d, di) => <span key={di} style={{ padding: "3px 7px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.12)", fontSize: 11, color: "var(--warn)", fontWeight: 600 }}><HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" /> {d}</span>)}
                          {eq.graphicsCard && <span style={{ padding: "3px 7px", borderRadius: 6, background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.12)", fontSize: 11, color: "#be185d", fontWeight: 600 }}><CircuitBoard size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.graphicsCard.length > 18 ? eq.graphicsCard.slice(0, 18) + "…" : eq.graphicsCard}</span>}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                          <span className="pc-price" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Bs. {Math.round(eq.price).toLocaleString()}</span>
                          <span style={{ fontSize: 11, color: "var(--accent-dim)", fontWeight: 600 }}>Ver detalles →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        const imgs = parseEqImages(eq.image);
        const cond = EQ_CONDITIONS[eq.condition] || EQ_CONDITIONS.disponible;
        const dName = getEqDisplayName(eq);
        const currentImg = imgs[carouselIdx] || null;
        const prev = () => setCarouselIdx(i => (imgs.length === 0 ? 0 : (i - 1 + imgs.length) % imgs.length));
        const next = () => setCarouselIdx(i => (imgs.length === 0 ? 0 : (i + 1) % imgs.length));
        return (
          <div role="dialog" aria-modal="true" aria-label="Detalle del equipo"
            onClick={() => setSelectedEq(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.25s ease-out" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="eq-modal"
              style={{ width: "100%", maxWidth: 680, maxHeight: "92vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.18)", boxShadow: "0 24px 60px rgba(26,29,46,0.45)" }}
            >
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }}>{eq.type === "laptop" ? <Laptop size={22} strokeWidth={STROKE} aria-hidden="true" /> : <Monitor size={22} strokeWidth={STROKE} aria-hidden="true" />}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dName}</h3>
                      {eq.code && <span style={{ fontSize: 11, fontWeight: 600, color: "#0e7490", padding: "2px 8px", borderRadius: 6, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", fontFamily: "monospace" }}>{eq.code}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{eq.type === "laptop" ? "Laptop" : "PC de Escritorio"} · Bs. {Math.round(eq.price).toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedEq(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-bright)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
              </div>

              {/* Carousel */}
              {imgs.length > 0 ? (
                <div style={{ padding: "16px 20px 8px" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                    <img role="button" tabIndex={0} onKeyDown={pressKey}
                      key={carouselIdx}
                      src={thumb(currentImg, 800)}
                      alt={`${dName} ${carouselIdx + 1}`}
                      onClick={() => setViewImage(currentImg)}
                      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a10", cursor: "zoom-in", animation: "fadeUp 0.3s ease-out" }}
                    />

                    {/* Counter */}
                    {imgs.length > 1 && (
                      <div style={{ position: "absolute", top: 12, right: 12, padding: "5px 12px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 12 }}>
                        <Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {carouselIdx + 1} / {imgs.length}
                      </div>
                    )}

                    {/* Zoom hint */}
                    <div style={{ position: "absolute", bottom: 12, right: 12, padding: "4px 10px", background: "rgba(26,29,46,0.45)", color: "#1a1d2e", fontSize: 11, fontWeight: 600, borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Search size={14} strokeWidth={STROKE} aria-hidden="true" /> Click para ampliar
                    </div>

                    {/* Arrows */}
                    {imgs.length > 1 && (
                      <>
                        <button
                          onClick={prev}
                          aria-label="Imagen anterior"
                          style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}
                          onPointerEnter={mouseOnly((e) => { e.currentTarget.style.background = "rgba(99,102,241,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; })}
                          onPointerLeave={mouseOnly((e) => { e.currentTarget.style.background = "rgba(17,17,24,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; })}
                        >‹</button>
                        <button
                          onClick={next}
                          aria-label="Imagen siguiente"
                          style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(17,17,24,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "#1a1d2e", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}
                          onPointerEnter={mouseOnly((e) => { e.currentTarget.style.background = "rgba(99,102,241,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; })}
                          onPointerLeave={mouseOnly((e) => { e.currentTarget.style.background = "rgba(17,17,24,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; })}
                        >›</button>
                      </>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {imgs.length > 1 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
                      {(imgs || []).map((img, idx) => (
                        <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Ver foto"
                          key={idx}
                          onClick={() => setCarouselIdx(idx)}
                          style={{ width: 76, height: 56, borderRadius: 8, overflow: "hidden", cursor: "pointer", flexShrink: 0, border: idx === carouselIdx ? "2px solid var(--accent)" : "2px solid transparent", opacity: idx === carouselIdx ? 1 : 0.6, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s", position: "relative" }}
                        >
                          <img src={thumb(img, 200)} loading="lazy" decoding="async" alt={`thumb ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "16px 20px 8px" }}>
                  <div style={{ width: "100%", aspectRatio: "16/10", borderRadius: 14, background: "rgba(6,182,212,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 56, opacity: 0.3, marginBottom: 4 }}>{eq.type === "laptop" ? <Laptop size={56} strokeWidth={1.5} aria-hidden="true" /> : <Monitor size={56} strokeWidth={1.5} aria-hidden="true" />}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin imágenes disponibles</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Body */}
              <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Badges row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: eq.type === "laptop" ? "rgba(37,99,235,0.12)" : "rgba(6,182,212,0.12)", color: eq.type === "laptop" ? "var(--info)" : "#0891b2", border: `1px solid ${eq.type === "laptop" ? "rgba(37,99,235,0.25)" : "rgba(6,182,212,0.25)"}` }}>
                    {eq.type === "laptop" ? "Laptop" : "PC Escritorio"}
                  </span>
                  <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${cond.color}15`, color: cond.color, border: `1.5px solid ${cond.color}40` }}>
                    <StatusDot color={cond.color} /> {cond.label}
                  </span>
                  {eq.branch && (
                    <span style={{ padding: "5px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)" }}>
                      <Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {eq.branch.name}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div style={{ padding: "18px 20px", background: "rgba(var(--accent-bright-rgb), 0.12)", borderRadius: 12, border: "2px solid rgba(var(--accent-bright-rgb), 0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textAlign: "center" }}>Precio</div>
                    <div style={{ fontSize: 32, fontWeight: 600, color: "var(--accent)", lineHeight: 1, letterSpacing: "-1.5px" }}>Bs. {Math.round(eq.price).toLocaleString()}</div>
                  </div>
                  
                </div>

                {/* Specifications */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.6px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--accent)" }}>◆</span> Especificaciones</div>
                  <div className="eq-specs-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {eq.brand && <SpecRow icon={<Tag size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Marca" value={eq.brand} color="#14a3ad" />}
                    {eq.model && <SpecRow icon={<Package size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Modelo" value={eq.model} color="#14a3ad" />}
                    {eq.processor && <SpecRow icon={<Cpu size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Procesador" value={eq.processor} color="#14a3ad" />}
                    {eq.ram && <SpecRow icon={<MemoryStick size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Memoria RAM" value={eq.ram} color="#10b981" />}
                    {eq.storage && <SpecRow icon={<HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Disco Principal" value={eq.storage} color="#f59e0b" />}
                    {eq.storage2 && <SpecRow icon={<HardDrive size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Disco Secundario" value={eq.storage2} color="#f59e0b" />}
                    {eq.graphicsCard && <SpecRow icon={<CircuitBoard size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Tarjeta Gráfica" value={eq.graphicsCard} color="#be185d" />}
                    {eq.screenSize && <SpecRow icon={<Ruler size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Pantalla" value={eq.screenSize} color="#0369a1" />}
                    {eq.os && <SpecRow icon={<Monitor size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Sistema Operativo" value={eq.os} color="#0891b2" />}
                    {eq.cabinet && <SpecRow icon={<Box size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Gabinete" value={eq.cabinet} color="#dc2626" />}
                    {eq.motherboard && <SpecRow icon={<CircuitBoard size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Placa Madre" value={eq.motherboard} color="#14b8a6" />}
                    {eq.powerSupply && <SpecRow icon={<Zap size={14} strokeWidth={STROKE} aria-hidden="true" />} label="Fuente de Poder" value={eq.powerSupply} color="#ea580c" />}
                  </div>
                </div>

                {/* Accessories */}
                {eq.accessories && (
                  <div style={{ padding: "14px 16px", background: "#ffffff", borderRadius: 12, border: "1.5px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>Accesorios incluidos</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{eq.accessories}</div>
                  </div>
                )}

                {/* Notes */}
                {eq.notes && (
                  <div style={{ padding: "14px 16px", background: "var(--warn-bg)", borderRadius: 12, border: "1.5px solid var(--warn-line)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#c9952a", letterSpacing: "0.5px", marginBottom: 6 }}>NOTAS adicionales</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{eq.notes}</div>
                  </div>
                )}

                {/* Contact CTA */}
                {eq.condition === "disponible" && eq.branch && holds.branches[eq.branch.id] && (holds.equipment.includes(eq.id)
                  ? <WaitlistButton kind="equipment" id={eq.id} name={getEqDisplayName(eq)} />
                  : <ReserveButton target={{ kind: "equipment", id: eq.id, name: getEqDisplayName(eq), price: eq.price, image: parseEqImages(eq.image)[0] || null, branch: eq.branch, available: 1, hours: holds.branches[eq.branch.id] }} maxQty={1} onChanged={() => loadData(true)} />)}
                <WhatsAppCta what="este equipo" product={getEqDisplayName(eq)} code={eq.code} price={eq.price} branch={eq.branch} branches={contactBranches} companyPhone={settings.phone} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* WhatsApp flotante (se oculta mientras hay una ficha abierta: la ficha tiene su propio botón) */}
      {!selectedEq && !selectedCn && !selectedSw && !selectedVg && !viewImage && (
        <WhatsAppFab branches={contactBranches} companyPhone={settings.phone} companyName={settings.companyName} />
      )}
    </div>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="spec-card" style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, background: "#ffffff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ display: "flex" }}>{icon}</span> {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{value}</div>
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
