"use client";
import { Award, Banknote, Camera, ClipboardList, FileText, Joystick, Laptop, Receipt, Search, Square, Store, TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";

import { detectQR, type QRType } from "@/frontend/lib/qr-detect";
import type { Html5Qrcode } from "html5-qrcode";

// Documento encontrado en varias sucursales: se muestra la lista para elegir
interface PickItem { id: string; branchId?: string; branch?: { id: string; name: string } | null; code?: string | null; clientName?: string | null; device?: string | null; name?: string }
// Equipo o consola tal como llega de /api/equipment o /api/consoles
interface CatalogHit { id: string; code?: string | null; name: string; branchId: string; branch?: { id: string; name: string } | null }
import { mouseOnly } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";

export default function ScannerPage() {
  const router = useRouter();
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [branchPicker, setBranchPicker] = useState<{ items: PickItem[]; type: QRType; code: string } | null>(null);
  // Abrir el documento en esta misma pestaña: una pestaña nueva abierta desde la cámara
  // la bloquea el navegador (sobre todo en celular) y parecía que "no pasaba nada"
  const go = (url: string) => { window.location.href = url; };
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const _u = (() => { try { return JSON.parse(userData); } catch { return null; } })(); setUser(_u);
    // Load branches for superadmin
    if (_u.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(_u.branchId || ""); }

    return () => { stopScanner(); };
  }, [router]);

  const startScanner = async () => {
    setError(""); setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const detected = detectQR(decodedText);
          stopScanner();
          setScanCount(prev => prev + 1);
          navigateTo(detected);
        }, () => {});
    } catch (err) {
      setScanning(false);
      if (err?.toString().includes("NotAllowedError")) setError("Permiso de cámara denegado. Permite el acceso en tu navegador.");
      else if (err?.toString().includes("NotFoundError")) setError("No se encontró una cámara. Usa la búsqueda manual.");
      else setError("Error al iniciar la cámara. Intenta con la búsqueda manual.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScanning(false);
  };

  const navigateTo = async (detected: { type: QRType; code: string; branchId?: string }) => {
    setLoading(true); setError(""); setBranchPicker(null);

    const isSuperAdmin = user?.role === "superadmin";
    // Admin/tech: always scope to their branch. Superadmin: search all (no branchId)
    const userBranch = !isSuperAdmin ? (user?.branchId || "") : "";
    // If detected has a branchId from QR URL, use that. Otherwise use role-based.
    const searchBranch = detected.branchId || userBranch;

    // Programas, videojuegos, productos del portal y otros enlaces del sistema
    if (detected.type === "software" || detected.type === "videogame" || detected.type === "portal" || detected.type === "url") {
      setLoading(false);
      const bq = detected.branchId ? `branchId=${detected.branchId}` : "";
      if (detected.type === "software") go(`/portal?sw=${encodeURIComponent(detected.code)}${bq ? `&${bq}` : ""}`);
      else if (detected.type === "videogame") go(`/portal?vg=${encodeURIComponent(detected.code)}${bq ? `&${bq}` : ""}`);
      else if (detected.type === "portal") go(`/portal${bq ? `?${bq}` : ""}`);
      else go(detected.code);
      return;
    }

    // EQ - Equipos (abre la ficha técnica / portal)
    if (detected.type === "equipment") {
      try {
        const res = await apiFetch(`/api/equipment`, isSuperAdmin ? { headers: { "x-branch-id": "" } } : {}); // superadmin: todas las sucursales
        if (!res.ok) { setError(`Error al buscar equipos`); setLoading(false); return; }
        const items: CatalogHit[] = await res.json();
        const upper = detected.code.toUpperCase();
        // Match by id OR by code
        let matches = items.filter(e => e.id === detected.code || (e.code && e.code.toUpperCase() === upper));
        // For admin/tech, only their branch
        if (!isSuperAdmin && searchBranch) {
          matches = matches.filter(e => e.branchId === searchBranch);
        }
        if (matches.length === 0) { setError(`No se encontró ningún equipo con el código: ${detected.code}`); setLoading(false); return; }
        // Multiple matches (superadmin + same code in different branches)
        if (matches.length > 1 && isSuperAdmin) {
          setBranchPicker({ items: matches.map((m) => ({ ...m, branch: m.branch || { id: m.branchId, name: "Sucursal" }, device: m.name })), type: "equipment", code: detected.code });
          setLoading(false); return;
        }
        setLoading(false);
        go(`/equipment/print/${matches[0].id}`);
        return;
      } catch { setError("Error al buscar el equipo"); setLoading(false); return; }
    }

    // CN - Consolas (abre la ficha del portal)
    if (detected.type === "console") {
      try {
        const res = await apiFetch(`/api/consoles`, isSuperAdmin ? { headers: { "x-branch-id": "" } } : {}); // superadmin: todas las sucursales
        if (!res.ok) { setError(`Error al buscar consolas`); setLoading(false); return; }
        const items: CatalogHit[] = await res.json();
        const upper = detected.code.toUpperCase();
        let matches = items.filter(c => c.id === detected.code || (c.code && c.code.toUpperCase() === upper));
        if (!isSuperAdmin && searchBranch) {
          matches = matches.filter(c => c.branchId === searchBranch);
        }
        if (matches.length === 0) { setError(`No se encontró ninguna consola con el código: ${detected.code}`); setLoading(false); return; }
        if (matches.length > 1 && isSuperAdmin) {
          setBranchPicker({ items: matches.map((m) => ({ ...m, branch: m.branch || { id: m.branchId, name: "Sucursal" }, device: m.name })), type: "console", code: detected.code });
          setLoading(false); return;
        }
        setLoading(false);
        go(`/consoles/print/${matches[0].id}`);
        return;
      } catch { setError("Error al buscar la consola"); setLoading(false); return; }
    }

    // CL - Certificados de Licencia
    if (detected.type === "certificate") {
      try {
        const bq = searchBranch ? `&branchId=${searchBranch}` : "";
        const res = await apiFetch(`/api/certificates?code=${detected.code}${bq}`);
        if (!res.ok) { setError(`No se encontró el certificado: ${detected.code}`); setLoading(false); return; }
        const data = await res.json();
        if (data.multiple && isSuperAdmin) {
          setBranchPicker({ items: data.certificates, type: "certificate", code: detected.code });
          setLoading(false); return;
        }
        setLoading(false);
        const bid = data.branchId || data.branch?.id || "";
        go(`/certificate-view/${detected.code}${bid ? `?branchId=${bid}` : ""}`);
        return;
      } catch { setError("Error al buscar el certificado"); setLoading(false); return; }
    }

    // COT y NV
    if (detected.type === "quotation" || detected.type === "sale") {
      try {
        const bq = searchBranch ? `&branchId=${searchBranch}` : "";
        const res = await apiFetch(`/api/quotations?code=${detected.code}${bq}`);
        if (!res.ok) { setError(`No se encontró el documento: ${detected.code}`); setLoading(false); return; }
        const data = await res.json();
        if (data.multiple && isSuperAdmin) {
          setBranchPicker({ items: data.quotations.map((q: PickItem & { branchId: string }) => ({ ...q, branch: q.branch || { id: q.branchId, name: "Sucursal" } })), type: detected.type, code: detected.code });
          setLoading(false); return;
        }
        setLoading(false);
        const bid = data.branchId || data.branch?.id || searchBranch;
        go(`/quotations/print/${detected.code}${bid ? `?branchId=${bid}` : ""}`);
        return;
      } catch { setError("Error al buscar el documento"); setLoading(false); return; }
    }

    // OT y CE
    try {
      const bq = searchBranch ? `?branchId=${searchBranch}` : "";
      const res = await apiFetch(`/api/track/${detected.code}${bq}`);
      if (!res.ok) { setError(`No se encontró ninguna orden con el código: ${detected.code}`); setLoading(false); return; }
      const data = await res.json();
      if (data.multiple && isSuperAdmin) {
        setBranchPicker({ items: data.repairs, type: detected.type, code: detected.code });
        setLoading(false); return;
      }
      const bid = data.branchId || data.branch?.id || searchBranch;
      setLoading(false);
      switch (detected.type) {
        case "delivery": go(`/delivery/view/${detected.code}${bid ? `?branchId=${bid}` : ""}`); break; // documento completo (la doble copia es solo para imprimir)
        case "track": router.push(`/track/${detected.code}?from=scanner${bid ? `&branchId=${bid}` : ""}`); break;
      }
    } catch { setError("Error al buscar la orden"); setLoading(false); return; }
  };

  const handleBranchPick = (item: PickItem) => {
    if (!branchPicker) return;
    const bid = item.branchId || item.branch?.id || "";
    switch (branchPicker.type) {
      case "equipment": window.open(`/equipment/print/${item.id}`, "_blank"); break;
      case "console": window.open(`/consoles/print/${item.id}`, "_blank"); break;
      case "certificate": window.open(`/certificate-view/${branchPicker.code}?branchId=${bid}`, "_blank"); break;
      case "quotation":
      case "sale": window.open(`/quotations/print/${branchPicker.code}?branchId=${bid}`, "_blank"); break;
      case "delivery": window.open(`/delivery/view/${branchPicker.code}?branchId=${bid}`, "_blank"); break;
      case "track": router.push(`/track/${branchPicker.code}?from=scanner&branchId=${bid}`); break;
    }
    setBranchPicker(null);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    navigateTo(detectQR(manualCode.trim()));
  };

  if (!user) return <PageSkeleton />;

  const DOC_TYPES = [
    { prefix: "OT-#", label: "Orden de Trabajo", desc: "Abre la página de seguimiento del equipo", color: "#0e7c86", bg: "rgba(26,184,196,0.06)", borderColor: "rgba(26,184,196,0.06)", icon: <ClipboardList size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "CE-#", label: "Comprobante de Entrega", desc: "Abre el comprobante de entrega al cliente", color: "#047857", bg: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.1)", icon: <FileText size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "COT-#", label: "Cotización", desc: "Abre el detalle de la cotización", color: "#b45309", bg: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.1)", icon: <Receipt size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "NV-#", label: "Nota de Venta", desc: "Abre el detalle de la nota de venta", color: "#1d4ed8", bg: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.1)", icon: <Banknote size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "CL-#", label: "Certificado de Licencia", desc: "Abre el certificado de autenticidad de licencias", color: "#be185d", bg: "rgba(236,72,153,0.1)", borderColor: "rgba(236,72,153,0.1)", icon: <Award size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "EQ-#", label: "Equipo en Venta", desc: "Abre la ficha técnica del equipo para imprimir", color: "#0e7490", bg: "rgba(6,182,212,0.1)", borderColor: "rgba(6,182,212,0.1)", icon: <Laptop size={18} strokeWidth={STROKE} aria-hidden="true" /> },
    { prefix: "CN-#", label: "Consola", desc: "Abre la ficha técnica de la consola para imprimir", color: "#c2410c", bg: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.1)", icon: <Joystick size={18} strokeWidth={STROKE} aria-hidden="true" /> },
  ];

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 210, paddingTop: 0 }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: calc(100% - 3px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        #${scannerContainerId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 12px; }
        #${scannerContainerId} img[alt="Info icon"] { display: none !important; }
        #${scannerContainerId} { position: relative; overflow: hidden; border-radius: 12px; }
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


      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Escáner QR</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Escanea un código QR o busca manualmente por código de documento</p>
        </div>

        <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* ═══ CÁMARA ═══ */}
          <div style={{ padding: 28, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", animation: "fadeIn 0.4s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(var(--accent-bright-rgb), 0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Cámara</h3>
              {scanCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "var(--ok)", fontWeight: 700 }}>{scanCount} escaneos</span>}
            </div>
            <div style={{ width: "100%", aspectRatio: "1", maxWidth: 280, margin: "0 auto 22px", borderRadius: 12, background: "#000", border: "2px solid var(--border)", position: "relative", overflow: "hidden" }}>
              <div id={scannerContainerId} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, display: scanning ? "block" : "none" }} />
              {!scanning && (<div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--bg-primary)" }}>{[{ top: 16, left: 16 }, { top: 16, right: 16 }, { bottom: 16, left: 16 }, { bottom: 16, right: 16 }].map((pos, i) => (<div key={i} style={{ position: "absolute", width: 28, height: 28, ...pos, borderTop: "top" in pos ? "3px solid var(--accent)" : "none", borderBottom: "bottom" in pos ? "3px solid var(--accent)" : "none", borderLeft: "left" in pos ? "3px solid var(--accent)" : "none", borderRight: "right" in pos ? "3px solid var(--accent)" : "none", borderRadius: 4, opacity: 0.6 } as React.CSSProperties} />))}<div style={{ fontSize: 36, opacity: 0.3 }}><Camera size={36} strokeWidth={STROKE} aria-hidden="true" /></div><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Listo para escanear</p></div>)}
              {scanning && (<div style={{ position: "absolute", left: "10%", right: "10%", height: 3, borderRadius: 2, background: "linear-gradient(90deg, transparent, var(--accent), transparent)", boxShadow: "0 0 15px var(--accent)", animation: "scanLine 2s ease-in-out infinite", top: 0, zIndex: 10 }} />)}
            </div>
            {!scanning ? (<button onClick={startScanner} style={{ width: "100%", padding: 14, background: "var(--accent)", border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> Iniciar Escáner</button>) : (<button onClick={stopScanner} style={{ width: "100%", padding: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, color: "var(--danger-bright)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}><Square size={14} strokeWidth={STROKE} aria-hidden="true" /> Detener</button>)}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>Apunta la cámara al código QR. Se detecta automáticamente el tipo de documento.</p>
          </div>

          {/* ═══ BÚSQUEDA MANUAL ═══ */}
          <div className="scanner-card" style={{ padding: 28, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", animation: "fadeIn 0.4s ease-out 0.1s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Búsqueda Manual</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.6 }}>Ingresa el código según el documento que necesitas consultar.</p>
            <form onSubmit={handleManualSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)", padding: "0 14px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 8 }}><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span>
                <input aria-label="Código del documento" value={manualCode} onChange={(e) => setManualCode(e.target.value)} style={{ flex: 1, minWidth: 0, width: "100%", border: "none", background: "none", padding: "13px 0", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "monospace", fontWeight: 600 }} />
              </div>
              <button type="submit" disabled={loading} style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "13px 22px", background: "var(--ok)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>{loading ? "..." : "Buscar"}</button>
            </form>

            {error && (<div style={{ padding: 16, background: "rgba(239,68,68,0.06)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.12)", marginBottom: 16, animation: "fadeScale 0.3s ease-out" }}><p style={{ fontSize: 13, color: "var(--danger-bright)", display: "flex", alignItems: "center", gap: 6 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> {error}</p></div>)}

            {/* Branch picker for superadmin when code exists in multiple branches */}
            {branchPicker && (
              <div style={{ padding: 20, background: "rgba(var(--accent-bright-rgb), 0.05)", borderRadius: 12, border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", marginBottom: 16, animation: "fadeScale 0.3s ease-out" }}>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", padding: "4px 14px", borderRadius: 8 }}>{branchPicker.code}</span>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>Este código existe en varias sucursales. ¿Cuál deseas ver?</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {branchPicker.items.map((item, i) => (
                    <button key={item.id || i} onClick={() => handleBranchPick(item)} style={{ padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}
                      onPointerOver={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--accent-light)"; })}
                      onPointerOut={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--border)"; })}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {item.branch?.name || "Sucursal"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.clientName || item.device || item.code || ""}</div>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--accent-dim)", fontWeight: 600 }}>Abrir →</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setBranchPicker(null)} style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              </div>
            )}

            {loading && (<div style={{ padding: 20, textAlign: "center" }}><div style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 0.8s ease-in-out infinite" }} /><p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Verificando documento...</p></div>)}

            {!error && !loading && (
              <div>
                <div style={{ padding: "16px 18px", background: "var(--bg-tertiary)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", marginBottom: 14 }}><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Códigos de Documentos</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(DOC_TYPES || []).map((doc) => (
                      <div key={doc.prefix} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: `1px solid ${doc.borderColor}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: doc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, color: doc.color }}>{doc.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px 8px", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: doc.color, background: `${doc.color}12`, padding: "2px 10px", borderRadius: 6 }}>{doc.prefix}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{doc.label}</span>
                          </div>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{doc.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "12px 16px", background: "rgba(var(--accent-bright-rgb), 0.04)", borderRadius: 12, border: "1px solid rgba(var(--accent-bright-rgb), 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)" }}>Ejemplos de códigos</span></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { code: "OT-1", label: "Seguimiento", color: "#0e7c86" },
                      { code: "CE-1", label: "Entrega", color: "#047857" },
                      { code: "CL-1", label: "Licencia", color: "#be185d" },
                    ].map((ex) => (
                      <span key={ex.code} style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: `${ex.color}12`, color: ex.color, border: `1px solid ${ex.color}20` }}>{ex.code} → {ex.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}