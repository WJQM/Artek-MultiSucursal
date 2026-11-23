"use client";
import { ArrowLeft, Bell, ChevronRight, Eye, Globe, HardDrive, ImagePlus, Mail, MapPin, Palette, Pencil, Phone, Plug, RotateCcw, ShieldCheck, Store, Trash2, TriangleAlert, Upload, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { defaultTerms, termsLines, normalizePublicUrl } from "@/shared/branding";
import AutomationPanel from "@/frontend/components/AutomationPanel";
import { AiCard, GoogleReviewsCard, ImeiCard, PaymentQrCard } from "@/frontend/components/CloudMonitorPanel";
import { pressKey } from "@/frontend/lib/a11y";
import { PageSkeleton } from "@/frontend/components/Skeletons";
import BrandColorsPanel from "@/frontend/components/BrandColorsPanel";
import { coverBackground, type CoverFit, type PortalNav } from "@/shared/portal-cover";
import { BRAND_DEFAULT, BRAND_PRESETS, type BrandColors } from "@/shared/brand-colors";

// Configuración por apartados: primero las tarjetas; al tocar una se ve solo ese apartado (?s=… en la dirección)
type Apartado = "empresa" | "colores" | "portal" | "garantia" | "avisos" | "respaldos" | "integraciones";
const APARTADOS: { key: Apartado; icon: React.ReactNode; title: string; desc: string; long: string }[] = [
  { key: "empresa", icon: <Store size={20} strokeWidth={STROKE} />, title: "Empresa", desc: "Nombre, logo, teléfono y dirección", long: "Se muestra en el login, el portal, las impresiones, el seguimiento y los mensajes de WhatsApp." },
  { key: "colores", icon: <Palette size={20} strokeWidth={STROKE} />, title: "Colores", desc: "Color principal y color oscuro", long: "Los colores del sistema y del portal: botones, enlaces, menú y portada. Los documentos impresos siguen en negro." },
  { key: "portal", icon: <Globe size={20} strokeWidth={STROKE} />, title: "Portal de clientes", desc: "Foto de portada y enlace público", long: "Cómo se ve el portal y la dirección que reciben tus clientes en WhatsApp y en los QR." },
  { key: "garantia", icon: <ShieldCheck size={20} strokeWidth={STROKE} />, title: "Garantía y condiciones", desc: "Días de garantía y términos impresos", long: "Días de garantía, días para equipos no reclamados y los términos que salen en la orden impresa." },
  { key: "avisos", icon: <Bell size={20} strokeWidth={STROKE} />, title: "Avisos y mensajes", desc: "Resumen del día, correo y Telegram", long: "Avisos al celular del dueño, resumen del día, correo y Telegram. Se guardan al instante." },
  { key: "respaldos", icon: <HardDrive size={20} strokeWidth={STROKE} />, title: "Respaldos y nube", desc: "Copias diarias, nube y monitor", long: "Copias de seguridad automáticas, copia en la nube y aviso si el sistema se apaga. Se guardan al instante." },
  { key: "integraciones", icon: <Plug size={20} strokeWidth={STROKE} />, title: "Integraciones", desc: "Pagos con QR, IA, IMEI y reseñas", long: "Servicios externos que el sistema puede usar. Se guardan al instante." },
];
const esApartado = (v: string | null): v is Apartado => !!v && APARTADOS.some((a) => a.key === v);

interface Settings { portalCover?: string | null; portalCoverFit?: CoverFit; portalCoverMobile?: string | null; portalNav?: PortalNav; brandColors?: BrandColors; id: string; companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null; website: string | null; city: string | null; warrantyDays: number; abandonDays: number; terms: string | null; publicUrl: string | null; }

export default function AdminSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [, setBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranchState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  // Foto de portada del portal: se sube al elegirla y se guarda con "Guardar"
  const [portalCover, setPortalCover] = useState<string | null>(null);
  const [portalCoverFit, setPortalCoverFit] = useState<CoverFit>("cover");
  const [portalCoverMobile, setPortalCoverMobile] = useState<string | null>(null);
  const [portalNav, setPortalNav] = useState<PortalNav>("light");
  const [coverMobileUploading, setCoverMobileUploading] = useState(false);
  const coverMobileRef = useRef<HTMLInputElement>(null);
  const [brandColors, setBrandColors] = useState<BrandColors>(BRAND_DEFAULT);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("30");
  const [abandonDays, setAbandonDays] = useState("90");
  const [terms, setTerms] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Apartado abierto (null = tarjetas). Va en la dirección para que "Atrás" del navegador vuelva a las tarjetas.
  const [sec, setSec] = useState<Apartado | null>(null);
  useEffect(() => {
    const leer = () => { const v = new URLSearchParams(window.location.search).get("s"); setSec(esApartado(v) ? v : null); };
    leer();
    window.addEventListener("popstate", leer);
    return () => window.removeEventListener("popstate", leer);
  }, []);
  const abrir = (k: Apartado | null) => {
    setSec(k);
    window.history.pushState({}, "", k ? `?s=${k}` : window.location.pathname);
    window.scrollTo({ top: 0 });
  };
  const actual = APARTADOS.find((a) => a.key === sec);
  // Estado de cada tarjeta (lo que falta configurar)
  const [auto, setAuto] = useState<{ ownerPhone: string; backupEnabled: boolean } | null>(null);
  useEffect(() => { apiFetch("/api/automation").then(r => r.ok ? r.json() : null).then(d => { if (d?.config) setAuto(d.config); }).catch(() => {}); }, [sec]);
  const estado = (k: Apartado): { ok: boolean; text: string } | null => {
    if (k === "empresa") return companyName.trim() && (phone.trim() || address.trim()) ? { ok: true, text: "Listo" } : { ok: false, text: "Faltan datos" };
    if (k === "colores") { const p = BRAND_PRESETS.find((x) => x.accent === brandColors.accent && x.dark === brandColors.dark); return { ok: true, text: p ? p.label : "Propios" }; }
    if (k === "portal") return publicUrl.trim() ? { ok: true, text: "Listo" } : { ok: false, text: "Falta enlace" };
    if (k === "garantia") return { ok: true, text: `${Number(warrantyDays) || 0} días` };
    if (k === "avisos") return auto ? (auto.ownerPhone ? { ok: true, text: "Activo" } : { ok: false, text: "Sin celular" }) : null;
    if (k === "respaldos") return auto ? (auto.backupEnabled ? { ok: true, text: "Activo" } : { ok: false, text: "Apagado" }) : null;
    return null;
  };

  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed);

    // Load branches for sidebar
    apiFetch("/api/branches").then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) {
        setBranches(d.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
        const ab = sessionStorage.getItem("activeBranchId");
        if (ab) setActiveBranchState(ab);
        else if (d.length > 0) { setActiveBranchState(d[0].id); setActiveBranchId(d[0].id); }
      }
    });

    // Load settings
    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s: Settings = await res.json();
        setCompanyName(s.companyName);
        setSlogan(s.slogan);
        setLogo(s.logo);
        setPortalCover(s.portalCover || null);
        setPortalCoverFit(s.portalCoverFit === "contain" ? "contain" : "cover");
        setPortalCoverMobile(s.portalCoverMobile || null);
        setPortalNav(s.portalNav === "dark" ? "dark" : "light");
        if (s.brandColors) setBrandColors(s.brandColors);
        setPhone(s.phone || "");
        setEmail(s.email || "");
        setAddress(s.address || "");
        setWebsite(s.website || "");
        setCity(s.city || "");
        setWarrantyDays(String(s.warrantyDays ?? 30));
        setAbandonDays(String(s.abandonDays ?? 90));
        setTerms(s.terms || "");
        setPublicUrl(s.publicUrl || "");
      }
    } catch {} finally { setLoading(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { sileo.error({ title: "La imagen no debe superar 2MB" }); return; }
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const handleCoverMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { sileo.error({ title: "La foto no debe superar 5MB" }); return; }
    setCoverMobileUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) { setPortalCoverMobile(d.url); sileo.success({ title: "Foto cargada", description: "Presiona Guardar para mostrarla en el portal" }); }
      else sileo.error({ title: d.error || "No se pudo subir la foto" });
    } catch { sileo.error({ title: "Sin conexión", description: "Revisa tu internet e intenta de nuevo" }); }
    finally { setCoverMobileUploading(false); }
  };
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { sileo.error({ title: "La foto no debe superar 5MB" }); return; }
    setCoverUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) { setPortalCover(d.url); sileo.success({ title: "Foto cargada", description: "Presiona Guardar para mostrarla en el portal" }); }
      else sileo.error({ title: d.error || "No se pudo subir la foto" });
    } catch { sileo.error({ title: "Sin conexión", description: "Revisa tu internet e intenta de nuevo" }); }
    finally { setCoverUploading(false); }
  };

  const resetDefaults = () => {
    setCompanyName("RepairTrackQR");
    setSlogan("Servicio Técnico Especializado");
    setLogo(null);
    setPortalCover(null);
    setPhone("");
    setEmail("");
    setAddress("");
    setWebsite("");
    setCity("");
    setWarrantyDays("30");
    setAbandonDays("90");
    setTerms("");
    setPublicUrl("");
    sileo.info({ title: "Valores por defecto restaurados — presiona Guardar para aplicar" });
  };

  const handleSave = async () => {
    if (!companyName.trim()) { sileo.error({ title: "El nombre de empresa es obligatorio" }); return; }
    if (publicUrl.trim() && !normalizePublicUrl(publicUrl)) { sileo.error({ title: "Enlace público inválido. Ejemplo: https://taller.midominio.com" }); return; }
    for (const [label, v] of [["garantía", warrantyDays], ["equipos no reclamados", abandonDays]] as const) {
      const n = Number(v);
      if (v.trim() === "" || !Number.isInteger(n) || n < 0 || n > 3650) { sileo.error({ title: `Días de ${label}: ingresa un número entre 0 y 3650` }); return; }
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          companyName: companyName.trim(),
          slogan: slogan.trim(),
          logo,
          portalCover,
          portalCoverFit,
          portalCoverMobile,
          portalNav,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          website: website.trim() || null,
          city: city.trim() || null,
          warrantyDays: Number(warrantyDays),
          abandonDays: Number(abandonDays),
          terms: terms.trim() || null,
          publicUrl: publicUrl.trim() || null,
        }),
      });
      if (res.ok) { sileo.success({ title: "Configuración guardada correctamente" }); }
      else { const d = await res.json(); sileo.error({ title: `${d.error}` }); }
    } catch { sileo.error({ title: "Error al guardar" }); }
    finally { setSaving(false); }
  };


  if (loading) return <PageSkeleton />;

  const inputStyle = { width: "100%", padding: "12px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media(max-width:1024px) {
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          .settings-main{margin-left:0!important;padding-top:70px!important}
          .settings-form-grid{grid-template-columns:1fr!important}
        }
        .cfg-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
        .cfg-card { display: grid; grid-template-columns: 44px 1fr auto 16px; align-items: center; gap: 14px; width: 100%; padding: 16px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; text-align: left; font: inherit; color: var(--text-primary); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        @media (hover: hover) and (pointer: fine) { .cfg-card:hover { border-color: var(--text-faint); box-shadow: 0 4px 12px rgba(15,23,42,.06); } }
        .cfg-ic { width: 44px; height: 44px; border-radius: 12px; background: var(--bg-hover); color: var(--text-secondary); display: grid; place-items: center; }
        .cfg-tx { min-width: 0; }
        .cfg-tx b { display: block; font-size: 15px; font-weight: 700; }
        .cfg-tx small { display: block; font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }
        .cfg-st { font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
        .cfg-st.ok { background: var(--ok-bg); color: var(--ok); }
        .cfg-st.warn { background: var(--warn-bg); color: var(--warn); }
        .cfg-go { color: var(--text-faint); }
        .cfg-back { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        @media (max-width: 520px) { .cfg-card { grid-template-columns: 40px 1fr 16px; } .cfg-st { grid-column: 2; justify-self: start; } .cfg-go { grid-row: 1; grid-column: 3; } }
      `}</style>

      <AppSidebar user={user} />

      {/* CONTENT */}
      <main className="settings-main" style={{ marginLeft: 210, padding: "32px 28px", minHeight: "100vh" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {!sec ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>Configuración</h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Elige qué quieres configurar.</p>
              </div>
              <div className="cfg-cards">
                {APARTADOS.map((ap) => {
                  const st = estado(ap.key);
                  return (
                    <button key={ap.key} type="button" className="cfg-card" onClick={() => abrir(ap.key)}>
                      <span className="cfg-ic" aria-hidden="true">{ap.icon}</span>
                      <span className="cfg-tx"><b>{ap.title}</b><small>{ap.desc}</small></span>
                      {st && <span className={`cfg-st ${st.ok ? "ok" : "warn"}`}>{st.text}</span>}
                      <ChevronRight size={16} strokeWidth={STROKE} aria-hidden="true" className="cfg-go" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <button type="button" onClick={() => abrir(null)} className="cfg-back"><ArrowLeft size={14} strokeWidth={STROKE} aria-hidden="true" /> Configuración</button>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginTop: 10 }}>{actual?.title}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{actual?.long}</p>
            </div>
          )}

          {sec === "empresa" && (<>
          {/* LOGO SECTION */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label htmlFor="f-admin-settings-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 }}>Logo de la Empresa</label>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Cambiar logo" style={{ width: 100, height: 100, borderRadius: 12, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0, cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                {logo ? (
                  <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 28 }}><ImagePlus size={28} strokeWidth={STROKE} aria-hidden="true" /></div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Click para subir</div>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input id="f-admin-settings-1" type="file" ref={fileRef} accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} style={{ padding: "8px 16px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 8, color: "var(--accent-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer", marginBottom: 6, display: "block" }}><Upload size={14} strokeWidth={STROKE} aria-hidden="true" /> Subir imagen</button>
                {logo && <button onClick={() => setLogo(null)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Quitar logo</button>}
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>PNG, JPG o SVG. Máximo 2MB. Se muestra en login, impresiones y documentos.</p>
              </div>
            </div>
          </div>
          </>)}

          {sec === "portal" && (<>
          {/* PORTADA DEL PORTAL */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label htmlFor="f-admin-settings-cover" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 4 }}>Portada del portal</label>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Foto de fondo de la parte de arriba del portal. Si no subes ninguna, queda el fondo oscuro (el de Configuración › Colores).</p>
            <div className="settings-cover-row" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Cambiar foto de portada" onClick={() => coverRef.current?.click()}                 style={{ width: 280, maxWidth: "100%", aspectRatio: "12 / 5", borderRadius: 10, overflow: "hidden", position: "relative", flexShrink: 0, cursor: "pointer", ...(portalCover ? coverBackground(portalCover, portalCoverFit) : { background: "var(--brand-dark)" }), display: "flex", alignItems: "center", padding: "0 16px" }}>
                <span style={{ position: "relative", zIndex: 1, color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.25, maxWidth: "60%" }}>Reparamos tu equipo y tú ves el avance en línea</span>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input id="f-admin-settings-cover" type="file" ref={coverRef} accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleCoverUpload} style={{ display: "none" }} />
                <button onClick={() => coverRef.current?.click()} disabled={coverUploading} style={{ padding: "8px 16px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 8, color: "var(--accent-dim)", fontSize: 11, fontWeight: 600, cursor: coverUploading ? "wait" : "pointer", marginBottom: 6, display: "block" }}><Upload size={14} strokeWidth={STROKE} aria-hidden="true" /> {coverUploading ? "Subiendo…" : portalCover ? "Cambiar foto" : "Subir foto"}</button>
                {portalCover && <button onClick={() => setPortalCover(null)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Quitar</button>}
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Foto horizontal de 1920 × 800 px o más (tu taller, tu vitrina, equipos). JPG, PNG o WEBP, máximo 5MB. Se oscurece a la izquierda para que el texto se lea.</p>
                <div role="group" aria-label="Cómo se ve la foto" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Cómo se ve la foto:</span>
                  {([["cover", "Llenar (recorta)"], ["contain", "Completa (sin recortar)"]] as const).map(([v, txt]) => (
                    <button key={v} type="button" aria-pressed={portalCoverFit === v} onClick={() => setPortalCoverFit(v)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${portalCoverFit === v ? "var(--accent)" : "var(--border)"}`, background: portalCoverFit === v ? "var(--accent)" : "transparent", color: portalCoverFit === v ? "#fff" : "var(--text-secondary)" }}>{txt}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 16 }}>
              <label htmlFor="f-admin-settings-cover-m" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 10 }}>Foto para celular (opcional)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label="Cambiar foto para celular" onClick={() => coverMobileRef.current?.click()}
                  style={{ width: 96, aspectRatio: "4 / 5", borderRadius: 10, overflow: "hidden", flexShrink: 0, cursor: "pointer", border: "1px solid var(--border)", background: (portalCoverMobile || portalCover) ? `linear-gradient(color-mix(in srgb, var(--brand-dark) 55%, transparent), color-mix(in srgb, var(--brand-dark) 55%, transparent)), url("${portalCoverMobile || portalCover}") center / cover no-repeat, var(--brand-dark)` : "var(--brand-dark)" }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input id="f-admin-settings-cover-m" type="file" ref={coverMobileRef} accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleCoverMobileUpload} style={{ display: "none" }} />
                  <button onClick={() => coverMobileRef.current?.click()} disabled={coverMobileUploading} style={{ padding: "8px 16px", background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius: 8, color: "var(--accent-dim)", fontSize: 11, fontWeight: 600, cursor: coverMobileUploading ? "wait" : "pointer", marginRight: 8 }}>{coverMobileUploading ? "Subiendo…" : portalCoverMobile ? "Cambiar foto" : "Subir foto"}</button>
                  {portalCoverMobile && <button onClick={() => setPortalCoverMobile(null)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Quitar</button>}
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Foto vertical de 1080 × 1350 px, con lo importante al centro. Se usa en celulares y tablets; si no subes ninguna, se usa la de computadora.</p>
                </div>
              </div>
            </div>
            <div role="group" aria-label="Barra superior del portal" style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Barra superior del portal:</span>
              {([["light", "Blanca"], ["dark", "Color Oscuro"]] as const).map(([v, txt]) => (
                <button key={v} type="button" aria-pressed={portalNav === v} onClick={() => setPortalNav(v)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${portalNav === v ? "var(--accent)" : "var(--border)"}`, background: portalNav === v ? "var(--accent)" : "transparent", color: portalNav === v ? "#fff" : "var(--text-secondary)" }}>{txt}</button>
              ))}
            </div>
          </div>
          </>)}

          {sec === "empresa" && (<>
          {/* FORM */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 }}>Datos de la Empresa</label>
            <div className="settings-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="f-admin-settings-2" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Nombre de la Empresa *</label>
                <input id="f-admin-settings-2" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: TechFix Bolivia" style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="f-admin-settings-3" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Slogan / Descripción</label>
                <input id="f-admin-settings-3" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Ej: Servicio Técnico Especializado" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-4" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Teléfono</label>
                <input id="f-admin-settings-4" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej: 71234567" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-5" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Email</label>
                <input id="f-admin-settings-5" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej: info@techfix.com" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-6" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Dirección</label>
                <input id="f-admin-settings-6" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Av. Principal #123" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-7" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Sitio Web (para impresiones)</label>
                <input id="f-admin-settings-7" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Ej: www.techfix.com" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-8" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Ciudad (se muestra en el panel)</label>
                <input id="f-admin-settings-8" value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: La Paz, Bolivia" style={inputStyle} />
              </div>
            </div>
          </div>
          </>)}

          {sec === "portal" && (<>
          {/* ENLACE PÚBLICO */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label htmlFor="f-admin-settings-9" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 }}>Enlace público (WhatsApp y códigos QR)</label>
            <input id="f-admin-settings-9" value={publicUrl} onChange={e => setPublicUrl(e.target.value)} placeholder="Ej: https://taller.midominio.com" inputMode="url" autoCapitalize="off" spellCheck={false} style={inputStyle} />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              Dirección con la que tus clientes abren el sistema. Se usa en los mensajes de WhatsApp y en los QR impresos.
              Si lo dejas vacío se usa la dirección desde donde se abre el sistema.
            </p>
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" }}>
              Los clientes recibirán: <strong style={{ color: "var(--ok)" }}>{(normalizePublicUrl(publicUrl) || (typeof window !== "undefined" ? window.location.origin : "")) + "/portal"}</strong>
              {publicUrl.trim() && !normalizePublicUrl(publicUrl) && <div style={{ color: "var(--danger-bright)", marginTop: 4 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Enlace inválido</div>}
              {!normalizePublicUrl(publicUrl) && typeof window !== "undefined" && /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname) && <div style={{ color: "var(--warn)", marginTop: 4 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Esta dirección solo funciona en tu red. Escribe tu dominio público para que el enlace les sirva a los clientes.</div>}
            </div>
          </div>
          </>)}

          {sec === "garantia" && (<>
          {/* CONDICIONES */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 12 }}>Garantía y condiciones</label>
            <div className="settings-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label htmlFor="f-admin-settings-10" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Días de garantía</label>
                <input id="f-admin-settings-10" type="number" min={0} max={3650} inputMode="numeric" value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="f-admin-settings-11" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Días para equipos no reclamados</label>
                <input id="f-admin-settings-11" type="number" min={0} max={3650} inputMode="numeric" value={abandonDays} onChange={e => setAbandonDays(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="f-admin-settings-12" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Términos y condiciones de la orden de trabajo (uno por línea)</label>
                <textarea id="f-admin-settings-12" value={terms} onChange={e => setTerms(e.target.value)} rows={6} maxLength={2000}
                  placeholder={defaultTerms(Number(warrantyDays) || 0, Number(abandonDays) || 0)}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Si lo dejas vacío se usan los términos del ejemplo, con tus días de garantía y abandono.</p>
                  {!terms.trim() && <button type="button" onClick={() => setTerms(defaultTerms(Number(warrantyDays) || 0, Number(abandonDays) || 0))} style={{ padding: "4px 10px", background: "rgba(var(--accent-bright-rgb), 0.06)", border: "1px solid rgba(var(--accent-bright-rgb), 0.2)", borderRadius: 8, color: "var(--accent-dim)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /> Editar a partir del ejemplo</button>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "10px 12px", background: "#f0f0f0", borderRadius: 8, border: "1px solid #ddd", color: "#333" }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Así sale en la orden impresa</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>{termsLines({ terms, warrantyDays: Number(warrantyDays) || 0, abandonDays: Number(abandonDays) || 0 }).map((l, i) => `${i + 1}. ${l}`).join(" ")}</div>
            </div>
          </div>
          </>)}

          {sec === "empresa" && (<>
          {/* PREVIEW */}
          <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", display: "block", marginBottom: 12 }}><Eye size={14} strokeWidth={STROKE} aria-hidden="true" /> Vista Previa</label>
            <div style={{ padding: 20, background: "#fff", borderRadius: 10, color: "#111" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                {logo ? (
                  <img src={logo} alt="Logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}><Wrench size={18} strokeWidth={STROKE} aria-hidden="true" /></div>
                )}
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1a1a2e" }}>{companyName || "Nombre de Empresa"}</h3>
                  <p style={{ fontSize: 11, color: "#888", margin: 0, marginTop: 1 }}>{slogan || "Slogan"}</p>
                </div>
              </div>
              <div style={{ height: 2, background: "linear-gradient(90deg, #1a1a2e, var(--accent), #a5b4fc, transparent)", borderRadius: 1, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: "4px 16px", flexWrap: "wrap", fontSize: 11, color: "#888" }}>
                {phone && <span><Phone size={14} strokeWidth={STROKE} aria-hidden="true" /> {phone}</span>}
                {email && <span><Mail size={14} strokeWidth={STROKE} aria-hidden="true" /> {email}</span>}
                {address && <span><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> {address}</span>}
                {website && <span><Globe size={14} strokeWidth={STROKE} aria-hidden="true" /> {website}</span>}
              </div>
            </div>
          </div>
          </>)}

          {(sec === "empresa" || sec === "portal" || sec === "garantia") && (<>
          {/* SAVE BUTTON */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={resetDefaults} style={{ flex: "0 0 auto", padding: "14px 24px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, color: "var(--warn)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><RotateCcw size={14} strokeWidth={STROKE} aria-hidden="true" /> Default</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "14px", background: saving ? "var(--bg-tertiary)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
          </>)}

          {/* Apartados que se guardan al instante, sin el botón Guardar */}
          {sec === "colores" && <BrandColorsPanel initial={brandColors} onSaved={setBrandColors} cover={portalCover} />}
          {sec === "avisos" && <AutomationPanel parte="avisos" />}
          {sec === "respaldos" && <AutomationPanel parte="respaldos" />}
          {sec === "integraciones" && <><PaymentQrCard /><AiCard /><ImeiCard /><GoogleReviewsCard /></>}
        </div>
      </main>

      {/* TOAST */}
</div>
  );
}
