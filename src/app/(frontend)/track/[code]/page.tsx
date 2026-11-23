"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ReviewForm } from "@/frontend/components/ReviewForm";
import { ClientVerify } from "@/frontend/components/ClientVerify";
import { ClientReport, type ClientReportEntry } from "@/frontend/components/ClientReport";
import { TrackStatusIcon, TrackConfetti } from "@/frontend/components/TrackAnim";
import { readPass, trackUrl, trackHeaders, passFromLink } from "@/frontend/lib/track-client";
import { apiFetch } from "@/frontend/lib/api";
import { WhatsAppFab } from "@/frontend/components/PortalWhatsApp";
import { parseHours, hoursLines, openNow } from "@/shared/hours";
import { branchLatLng, mapEmbedUrl, directionsUrl } from "@/shared/geo";
import { qrSrc } from "@/frontend/components/DocKit";
import { askConfirm } from "@/frontend/lib/dialog";
import { mouseOnly } from "@/frontend/lib/a11y";
import { BellRing, Building2, CalendarDays, Gamepad2, Hand, Handshake, Laptop, Lightbulb, Lock, MapPin, Navigation, Package, Phone, Search, SearchX, ShoppingBag, Store, Wallet, Wrench, X } from "@/frontend/components/icons";
import { DeviceIcon, StatusIcon, STROKE } from "@/frontend/components/UiIcons";

interface Repair {
  canTake?: boolean; technicianName?: string | null;
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string | null; status: string; priority: string; estimatedCost: number | null;
  notes: string | null; clientName: string | null; clientPhone: string | null;
  clientEmail: string | null; accessories: string | null; qrCode: string;
  createdAt: string; updatedAt: string; branchId?: string;
  /** Modo protegido: faltan datos del cliente hasta que confirme los últimos 4 dígitos de su celular */
  protected?: boolean; canVerify?: boolean; verified?: boolean;
  /** Informe técnico publicado para el cliente (solo tras verificar) / cuántas novedades hay (modo protegido) */
  report?: ClientReportEntry[]; reportCount?: number;
  branch?: { id: string; name: string; address?: string | null; phone?: string | null; latitude?: number | null; longitude?: number | null; hours?: string | null } | null;
}

// Actualización automática: cada 30 s mientras la página está a la vista
const REFRESH_MS = 30_000;

const STATUS: Record<string, { label: string; color: string; desc: string }> = {
  pending: { label: "Pendiente", color: "#b45309", desc: "Tu equipo fue recibido y está en cola de revisión." },
  diagnosed: { label: "Diagnosticado", color: "#0e7490", desc: "El técnico revisó tu equipo e identificó el problema." },
  waiting_parts: { label: "Esperando Repuestos", color: "#c2410c", desc: "Se solicitaron los repuestos necesarios para la reparación." },
  in_progress: { label: "En Progreso", color: "#2563eb", desc: "Tu equipo está siendo reparado en este momento." },
  completed: { label: "Completado", color: "#047857", desc: "¡La reparación fue completada! Puedes pasar a recoger tu equipo." },
  delivered: { label: "Entregado", color: "#5a6a80", desc: "Tu equipo fue entregado. ¡Gracias por confiar en nosotros!" },
};

// Nombres cortos para la línea de etapas del seguimiento
const STEP_SHORT: Record<string, string> = { pending: "Recibido", diagnosed: "Revisado", waiting_parts: "Repuestos", in_progress: "Reparando", completed: "Listo", delivered: "Entregado" };

function parseAccessories(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseNotesData(notesField: string | null): { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string } {
  if (!notesField) return { notes: "", services: [], software: [], videogames: [], repuestos: [], deliveryNotes: "", discount: "" };
  const parts = notesField.split(" | ");
  const svcPart = parts.find(p => p.startsWith("Servicios: "));
  const swPart = parts.find(p => p.startsWith("Programas: ") || p.startsWith("Software: "));
  const vgPart = parts.find(p => p.startsWith("Videojuegos: "));
  const rPart = parts.find(p => p.startsWith("Repuestos: "));
  const dPart = parts.find(p => p.startsWith("Entrega: "));
  const discPart = parts.find(p => p.startsWith("Descuento: "));
  const notesParts = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Programas: ") && !p.startsWith("Software: ") && !p.startsWith("Videojuegos: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: ") && !p.startsWith("Descuento: "));
  const services = svcPart ? svcPart.replace("Servicios: ", "").split(", ").filter(Boolean) : [];
  const software = swPart ? swPart.replace("Programas: ", "").replace("Software: ", "").split(", ").filter(Boolean) : [];
  const videogames = vgPart ? vgPart.replace("Videojuegos: ", "").split(", ").filter(Boolean) : [];
  const repuestos = rPart ? rPart.replace("Repuestos: ", "").split(", ").filter(Boolean) : [];
  return { notes: notesParts.join(" | "), services, software, videogames, repuestos, deliveryNotes: dPart ? dPart.replace("Entrega: ", "") : "", discount: discPart ? discPart.replace("Descuento: ", "") : "" };
}

export default function TrackPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fromScanner, setFromScanner] = useState(false);
  const [multipleResults, setMultipleResults] = useState<Repair[]>([]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone?: string | null; address?: string | null; warrantyDays?: number; abandonDays?: number }>({ companyName: "", slogan: "", logo: null });

  useEffect(() => { setMounted(true); setFromScanner(new URLSearchParams(window.location.search).get("from") === "scanner"); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {}); }, []);
  useEffect(() => { if (code) loadRepair(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  // ── Actualización automática ──
  const [lastUpdate, setLastUpdate] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [changed, setChanged] = useState<string | null>(null);
  const repairRef = useRef<Repair | null>(null);
  useEffect(() => { repairRef.current = repair; }, [repair]);

  const refresh = async () => {
    const cur = repairRef.current;
    if (!cur || document.visibilityState !== "visible") return;
    try {
      const branchId = cur.branchId || new URLSearchParams(window.location.search).get("branchId");
      const res = await fetch(trackUrl(code, branchId), { cache: "no-store", headers: trackHeaders(code) });
      if (!res.ok) return; // si falla (sin señal, límite de consultas) se reintenta en el próximo ciclo
      const data = await res.json();
      if (data.multiple || !data.id || data.id !== cur.id) return;
      setLastUpdate(Date.now());
      if (data.updatedAt !== cur.updatedAt || data.status !== cur.status) {
        if (data.status !== cur.status) {
          setChanged(data.status);
          try { navigator.vibrate?.(200); } catch {}
          setTimeout(() => setChanged(null), 10_000);
        }
        setRepair(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (!repair) return;
    if (!lastUpdate) setLastUpdate(Date.now());
    const iv = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setNowTick(Date.now()), 5_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { clearInterval(iv); clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repair?.id]);

  // Tras verificar los 4 dígitos: recargar con el pase del cliente
  const onVerified = async (token: string) => {
    if (!repair) return;
    const branchId = repair.branchId || new URLSearchParams(window.location.search).get("branchId");
    const r2 = await fetch(trackUrl(repair.code, branchId), { cache: "no-store", headers: { "x-track-token": token } });
    if (r2.ok) { const full = await r2.json(); if (!full.multiple) setRepair(full); }
  };

  const agoText = (() => {
    if (!lastUpdate) return "";
    const s = Math.max(0, Math.round(((nowTick || Date.now()) - lastUpdate) / 1000));
    return s < 10 ? "recién" : s < 60 ? `hace ${Math.floor(s / 5) * 5} s` : `hace ${Math.floor(s / 60)} min`;
  })();

  const loadRepair = async () => {
    try {
      await passFromLink(code); // enlace personal de WhatsApp → pase del cliente
      const branchId = new URLSearchParams(window.location.search).get("branchId");
      const res = await fetch(trackUrl(code, branchId), { cache: "no-store", headers: trackHeaders(code) });
      if (res.ok) {
        const data = await res.json();
        if (data.multiple) {
          setMultipleResults(data.repairs);
          setShowBranchPicker(true);
        } else {
          setRepair(data);
        }
      } else setNotFound(true);
    } catch { setNotFound(true); }
    setLoading(false);
  };

  const selectBranch = (r: Repair) => {
    setShowBranchPicker(false);
    setRepair(r);
  };

  const [taking, setTaking] = useState(false);
  const [takeError, setTakeError] = useState("");
  const handleClose = () => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    if (from === "scanner") { window.location.href = "/scanner"; }
    else if (from === "portal") { window.location.href = "/portal"; }
    else { window.close(); if (!window.closed) window.location.href = "/portal"; }
  };

  const takeOrder = async () => {
    if (!repair) return;
    const who = repair.technicianName ? ` (ahora la tiene ${repair.technicianName})` : "";
    if (!await askConfirm(`¿Tomar la orden ${repair.code}${who}? Pasará a tus asignaciones y se avisará al administrador.`)) return;
    setTaking(true); setTakeError("");
    try {
      const res = await apiFetch(`/api/repairs/${repair.id}/take`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setTakeError(d.error || "No se pudo tomar la orden"); setTaking(false); return; }
      window.location.href = `/asignaciones?focus=${repair.code}`;
    } catch { setTakeError("Sin conexión"); setTaking(false); }
  };

  if (showBranchPicker) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#ffffff", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(30,42,58,0.18)", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}><Building2 size={44} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Selecciona la Sucursal</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>La orden <strong style={{ color: "var(--accent)" }}>{code}</strong> existe en varias sucursales. ¿En cuál dejaste tu equipo?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {multipleResults.map((r) => (
              <button key={r.id} onClick={() => selectBranch(r)} style={{ padding: "14px 18px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
                  onPointerEnter={mouseOnly((e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-bright-rgb), 0.06)"; })}
                  onPointerLeave={mouseOnly((e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; })}>
                <span>{r.branch?.name || "Sucursal"}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{r.device}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}><Search size={40} strokeWidth={1.5} aria-hidden="true" /></div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600 }}>Buscando orden...</p>
        </div>
      </div>
    );
  }

  if (notFound || !repair) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={{ textAlign: "center", padding: 48, background: "#ffffff", borderRadius: 16, border: "1px solid var(--border)", maxWidth: 420, animation: "fadeUp 0.5s ease-out", boxShadow: "0 20px 50px rgba(30,42,58,0.14)" }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}><SearchX size={48} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>No encontrada</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>No existe ninguna orden con el código:</p>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--danger-bright)", margin: "12px 0", padding: "10px 20px", background: "rgba(239,68,68,0.08)", borderRadius: 10, display: "inline-block" }}>{code}</div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>Verifica el código e intenta de nuevo</p>
          <button onClick={handleClose} style={{ marginTop: 20, padding: "10px 24px", background: "rgba(var(--accent-bright-rgb), 0.08)", border: "1.5px solid rgba(var(--accent-bright-rgb), 0.35)", borderRadius: 12, color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← {fromScanner ? "Volver al Escáner" : "Cerrar"}</button>
        </div>
      </div>
    );
  }

  const status = STATUS[repair.status] || STATUS.pending;
  const statusKeys = Object.keys(STATUS);
  const currentIndex = Math.max(0, statusKeys.indexOf(repair.status));
  const deviceName = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  const accessories = parseAccessories(repair.accessories);
  const { notes, services, software, videogames, repuestos, deliveryNotes, discount } = parseNotesData(repair.notes);
  const ready = repair.status === "completed";
  const delivered = repair.status === "delivered";
  const branch = repair.branch || null;
  const shopPhone = branch?.phone || settings.phone || null;
  const shopAddress = branch?.address || settings.address || null;
  const hours = parseHours(branch?.hours);
  const open = hours ? openNow(hours) : null;
  const geo = branchLatLng(branch);
  const items: [string, string, string[]][] = [["", "Repuestos", repuestos], ["", "Programas", software], ["", "Videojuegos", videogames]];
  const nextKey = statusKeys[currentIndex + 1];
  const pageUrl = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
  const warrantyDays = settings.warrantyDays ?? 30;

  const fmtDay = (d: string) => new Date(d).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
  // Datos cortos de "Tu equipo": si quedan impares, el último ocupa todo el ancho (sin hueco)
  const facts: [string, string][] = [["Equipo", deviceName]];
  if (repair.clientName) facts.push(["Cliente", repair.clientName]);
  if (repair.clientPhone) facts.push(["Celular", repair.clientPhone]);
  if (repair.technicianName && !repair.canTake) facts.push(["Técnico", repair.technicianName]);
  if (notes) facts.push(["Cómo llegó", notes]);
  const hasExtra = (repair.report?.length ?? 0) > 0 || (repair.protected && (repair.reportCount ?? 0) > 0) || !!deliveryNotes || (delivered && !repair.protected);
  const costDetail = [services.join(", "), Number(discount) > 0 ? `Descuento: Bs. ${discount}` : ""].filter(Boolean).join(" · ");
  const nextFact = delivered
    ? { icon: <Handshake size={20} strokeWidth={STROKE} />, label: "Entregado", value: fmtDay(repair.updatedAt), note: "Gracias por tu confianza" }
    : ready
      ? { icon: <Store size={20} strokeWidth={STROKE} />, label: "Ahora", value: "Pasa a recogerlo", note: `Trae tu comprobante o el código ${repair.code}` }
      : { icon: <StatusIcon status={nextKey || repair.status} size={20} />, label: "Sigue", value: nextKey ? STATUS[nextKey].label : status.label, note: "Esta página se actualiza sola" };

  return (
    <div className="tk2">
      {/* Fuera de los bloques animados: un transform del padre lo sacaría de la esquina */}
      {branch && <WhatsAppFab branches={[{ id: branch.id, name: branch.name, address: branch.address, phone: branch.phone }]} companyPhone={settings.phone || null} companyName={settings.companyName} message={`Hola${settings.companyName ? ` ${settings.companyName}` : ""}, consulto por mi orden ${repair.code} (${deviceName}).`} />}
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Estado primero: franja con el estado y una sola línea de etapas */}
      <div className={`tk2-top${ready ? " is-ready" : ""}`} style={{ opacity: mounted ? 1 : 0, transition: "opacity .4s ease, background .7s ease" }}>
        <TrackConfetti active={ready} code={repair.code} />
        <div className="tk2-in">
          <div className="tk2-nav">
            <button onClick={handleClose} className="tk2-back" aria-label="Volver">←</button>
            { }
            <span className="tk2-logo">{settings.logo ? <img src={settings.logo} alt="" /> : <Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />}</span>
            <b>{settings.companyName}</b>
            {branch?.name && <span className="tk2-branch">{branch.name}</span>}
          </div>
          <div className="tk2-hero">
            <TrackStatusIcon status={repair.status} color={status.color} fallback={<StatusIcon status={repair.status} size={30} />} />
            <div className="tx tk2-swap" key={repair.status}>
              <p className="tk2-code">Tu orden <b>{repair.code}</b></p>
              <h1>{ready ? "¡Listo para recoger!" : status.label}</h1>
              <p className="ds">{status.desc}</p>
            </div>
            <p className="tk2-live">Se actualiza solo · {agoText || "recién"}</p>
          </div>
          <ol className="tk2-steps" aria-label={`Etapa ${currentIndex + 1} de ${statusKeys.length}: ${status.label}`}>
            {statusKeys.map((k, i) => {
              const done = i < currentIndex || (i === currentIndex && k === "delivered");
              const now = i === currentIndex && k !== "delivered";
              return (
                <li key={k} className={`tk2-st${done ? " done" : ""}${now ? " now" : ""}`} style={{ ["--i" as string]: i }} aria-current={now ? "step" : undefined}>
                  <i aria-hidden="true"><StatusIcon status={k} size={18} /></i>
                  <span>{STEP_SHORT[k]}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <main className="tk2-grid" style={{ opacity: mounted ? 1 : 0, animation: mounted ? "slideUp 0.5s 0.1s ease-out both" : "none" }}>
        {changed && STATUS[changed] && (
          <div role="status" className="tk2-alert is-new" key={changed} style={{ borderColor: STATUS[changed].color }}>
            <span className="e"><BellRing size={24} strokeWidth={STROKE} aria-hidden="true" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: STATUS[changed].color }}>{changed === "completed" ? "¡Tu equipo ya está listo!" : `Nuevo estado: ${STATUS[changed].label}`}</b>
              <p>{STATUS[changed].desc}</p>
            </div>
            <button onClick={() => setChanged(null)} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: 16, color: "var(--text-muted)", cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
          </div>
        )}

        {repair.canTake && (
          <div className="tk2-card" style={{ background: "var(--warn-bg)", borderColor: "var(--warn-line)" }}>
            <b style={{ fontSize: 14 }}>{repair.technicianName ? `Asignada a ${repair.technicianName}` : "Orden sin técnico asignado"}</b>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Si tu compañero no está, puedes tomarla para seguir el trabajo o entregarla. Quedará registrado y se avisará al administrador.</p>
            <button onClick={takeOrder} disabled={taking} style={{ width: "100%", height: 46, background: "var(--warn-bright)", border: "none", borderRadius: 12, color: "#422006", fontSize: 14, fontWeight: 800, cursor: taking ? "wait" : "pointer", fontFamily: "inherit" }}>{taking ? "Tomando…" : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Hand size={18} strokeWidth={STROKE} aria-hidden="true" />Tomar esta orden</span>}</button>
            {takeError && <div role="alert" style={{ fontSize: 12.5, color: "var(--danger-bright)", fontWeight: 600 }}>{takeError}</div>}
          </div>
        )}

        {/* Modo protegido: el cliente confirma su identidad para ver el detalle */}
        {repair.protected && (
          <ClientVerify code={repair.code} repairId={repair.id} maskedPhone={repair.clientPhone} canVerify={repair.canVerify}
            purpose={delivered ? "ver el detalle y calificar el servicio" : "ver el problema, el costo y los detalles"} onVerified={onVerified} />
        )}

        {/* Lo principal de un vistazo: costo, fecha y qué sigue */}
        <div className="tk2-facts">
          <div className="tk2-fact">
            <span className="ic" aria-hidden="true"><Wallet size={20} strokeWidth={STROKE} /></span>
            <div><span className="lb">{ready || delivered ? "A pagar" : "Costo estimado"}</span>
              {repair.estimatedCost == null
                ? <><b className="lock"><Lock size={15} strokeWidth={STROKE} aria-hidden="true" /> Protegido</b><small>Visible al confirmar tu celular</small></>
                : <><b className="tabular">Bs. {Math.round(repair.estimatedCost).toLocaleString("es-BO")}</b>{costDetail && <small>{costDetail}</small>}</>}
            </div>
          </div>
          <div className="tk2-fact">
            <span className="ic" aria-hidden="true"><CalendarDays size={20} strokeWidth={STROKE} /></span>
            <div><span className="lb">Recibido</span><b className="tabular">{fmtDay(repair.createdAt)}</b>{warrantyDays > 0 && <small>Garantía de {warrantyDays} días</small>}</div>
          </div>
          <div className="tk2-fact">
            <span className="ic" aria-hidden="true">{nextFact.icon}</span>
            <div><span className="lb">{nextFact.label}</span><b>{nextFact.value}</b><small>{nextFact.note}</small></div>
          </div>
        </div>

        {/* Izquierda y derecha terminan a la misma altura: el mapa y el problema absorben la diferencia */}
        <div className={`tk2-cols${delivered ? " no-more" : ""}`}>
          <section className="tk2-card tk2-dev" aria-labelledby="tk2-dev">
            <h2 id="tk2-dev"><span className="e"><DeviceIcon device={repair.device} size={18} /></span>Tu equipo</h2>
            <div className="tk2-kv">
              {facts.map(([k, v], i) => <div key={k} className={i === facts.length - 1 && facts.length % 2 === 1 ? "w" : undefined}><span>{k}</span><b>{v}</b></div>)}
              {accessories.length > 0 && <div className="w"><span>Accesorios</span><b>{accessories.join(", ")}</b></div>}
              {items.filter(([, , list]) => list.length > 0).map(([, title, list]) => <div key={title} className="w"><span>{title}</span><b>{list.join(", ")}</b></div>)}
            </div>
            <div className="tk2-prob"><span>Problema reportado</span>{repair.issue ? <div className="tk2-issue">{repair.issue}</div> : <p className="tk2-lock"><Lock size={15} strokeWidth={STROKE} aria-hidden="true" /> Visible al confirmar tu celular</p>}</div>
          </section>

          {hasExtra && (
            <div className="tk2-extra">
              {/* Informe técnico: lo que el técnico publicó para el cliente, con fotos */}
              {repair.report && repair.report.length > 0 && <ClientReport entries={repair.report} />}
              {repair.protected && (repair.reportCount ?? 0) > 0 && (
                <div className="tk2-alert">
                  <span className="e"><Lock size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
                  <p style={{ margin: 0 }}>El técnico registró <strong>{repair.reportCount} {repair.reportCount === 1 ? "novedad" : "novedades"}</strong> sobre tu equipo, con fotos. Confirma tu celular arriba para verlas.</p>
                </div>
              )}

              {deliveryNotes && (
                <section className="tk2-card"><h2><span className="e"><Handshake size={18} strokeWidth={STROKE} aria-hidden="true" /></span>Notas de la entrega</h2><p style={{ fontSize: 14, lineHeight: 1.55 }}>{deliveryNotes}</p></section>
              )}

              {/* Reseña */}
              {delivered && !repair.protected && (
                <ReviewForm repairCode={repair.code} repairId={repair.id} clientName={repair.clientName} trackToken={readPass(repair.code)?.token || null} />
              )}
            </div>
          )}

          <div className="tk2-card tk2-shop">
            <h2><span className="e"><Store size={18} strokeWidth={STROKE} aria-hidden="true" /></span>{branch?.name || settings.companyName}</h2>
            {geo && <iframe title="Mapa de la sucursal" src={mapEmbedUrl(geo, 16)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="tk2-map" />}
            {(shopAddress || shopPhone) && <p className="tk2-addr">{shopAddress && <span><MapPin size={15} strokeWidth={STROKE} aria-hidden="true" /> {shopAddress}</span>}{shopPhone && <span><Phone size={15} strokeWidth={STROKE} aria-hidden="true" /> {shopPhone}</span>}</p>}
            {hours && (
              <div className="tk2-hours">
                {hoursLines(hours).map((l) => { const [d, t] = l.split(" · "); return <div key={l}><span>{d}</span><b>{t}</b></div>; })}
              </div>
            )}
            {open && <span className={`tk2-open${open.open ? "" : " off"}`}><i className={`rt-live-dot${open.open ? "" : " off"}`} aria-hidden="true" />{open.open ? `Abierto ahora · hasta ${open.until}` : "Cerrado ahora"}</span>}
            {geo && (
              <div className="tk2-acts">
                {geo && <a className="tk2-btn" href={directionsUrl(geo)} target="_blank" rel="noopener noreferrer"><Navigation size={16} strokeWidth={STROKE} aria-hidden="true" /> Cómo llegar</a>}
              </div>
            )}
          </div>

          <div className="tk2-card tk2-know">
            <h2><span className="e"><Lightbulb size={18} strokeWidth={STROKE} aria-hidden="true" /></span>Bueno saber</h2>
            <div className="tk2-know-in">
              <ul className="tk2-tips">
                <li>Trae tu comprobante o el código <b>{repair.code}</b> al recoger.</li>
                {(settings.abandonDays ?? 0) > 0 && <li>Si no lo recoges en {settings.abandonDays} días, pasa a abandono.</li>}
              </ul>
              {pageUrl && (
                <div className="tk2-qr tk2-desk">
                  { }
                  <img src={qrSrc(pageUrl, 200)} alt="QR para abrir en el celular" width={64} height={64} />
                  <p>Escanea para seguirlo en tu celular.</p>
                </div>
              )}
            </div>
          </div>

          {!delivered && (
            <section className="tk2-card tk2-more">
              <h2><span className="e"><ShoppingBag size={18} strokeWidth={STROKE} aria-hidden="true" /></span>Mientras esperas</h2>
              <div className="tk2-links">
                <a href="/portal#catalogo"><span className="tk2-lk"><Laptop size={16} strokeWidth={STROKE} aria-hidden="true" />Equipos en venta</span><small>Laptops y PCs revisadas</small></a>
                <a href="/portal#catalogo"><span className="tk2-lk"><Gamepad2 size={16} strokeWidth={STROKE} aria-hidden="true" />Consolas y juegos</span><small>Nuevas y usadas</small></a>
                <a href="/portal#catalogo"><span className="tk2-lk"><Package size={16} strokeWidth={STROKE} aria-hidden="true" />Accesorios</span><small>Cargadores, fundas…</small></a>
                <a href="/reservar"><span className="tk2-lk"><CalendarDays size={16} strokeWidth={STROKE} aria-hidden="true" />Reservar cita</span><small>Para otro equipo</small></a>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
