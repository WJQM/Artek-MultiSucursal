"use client";
import { Backpack, CalendarDays, Camera, CircleCheck, Disc3, FilePlus2, Gamepad2, ImagePlus, Search, Smartphone, Stethoscope, Store, User, UserCog, Wrench, X } from "@/frontend/components/icons";
import { AccessoryIcon, DeviceIcon, STROKE, ServiceIcon, StatusDot } from "@/frontend/components/UiIcons";
import WarrantyNotice, { type WarrantyHit } from "@/frontend/components/WarrantyNotice";
import { sileo } from "@/frontend/lib/toast";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImeiField, imeiState } from "@/frontend/components/ImeiField";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { FormSection, Field, oxLabelStyle, oxFieldStyle } from "@/frontend/components/FormKit";
import { DEVICE_TYPES, ACCESSORIES_LIST, ACCESSORIES_HINTS, PRIORITIES, TECH_COLORS, initials } from "@/frontend/lib/order-ui";
import { PageSkeleton } from "@/frontend/components/Skeletons";


interface ServiceItem { id: string; name: string; price: number; icon: string; }
interface SoftwareItem { id: string; name: string; category: string | null; image: string | null; }
interface VideogameItem { id: string; name: string; platform: string | null; genre: string | null; image: string | null; }

// Cliente que ya vino antes (de /api/clients), para completar nombre y celular
interface ClientSuggestion { name: string; phone: string; phoneKey: string; totalRepairs: number; totalSpent: number }

export default function NewOrderPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [device, setDevice] = useState(""); const [brand, setBrand] = useState(""); const [model, setModel] = useState(""); const [imei, setImei] = useState("");
  const [issue, setIssue] = useState(""); const [cost, setCost] = useState(""); const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState(""); const [clientPhone, setClientPhone] = useState("");
  const [fromAppt, setFromAppt] = useState<{ id: string; code: string; when: string } | null>(null);
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
  const [warrantyOf, setWarrantyOf] = useState<WarrantyHit | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploading, setUploading] = useState(false); const [saving, setSaving] = useState(false);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]); const [accessoryDetails, setAccessoryDetails] = useState<Record<string, string>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]); const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]); const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [selectedVideogames, setSelectedVideogames] = useState<string[]>([]); const [videogamesList, setVideogamesList] = useState<VideogameItem[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]); const [imagePreviews, setImagePreviews] = useState<string[]>([]);
 const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [technicianId, setTechnicianId] = useState("");
  const [techniciansList, setTechniciansList] = useState<{ id: string; name: string; activeCount?: number }[]>([]);
  const [priority, setPriority] = useState("media");
  const [pickTab, setPickTab] = useState<"services" | "software" | "games">("services");
  const [searchServices, setSearchServices] = useState(""); const [searchSoftware, setSearchSoftware] = useState(""); const [searchVideogames, setSearchVideogames] = useState("");
  const toggleAcc = (acc: string) => { setSelectedAccessories(prev => { if (prev.includes(acc)) { setAccessoryDetails(d => { const copy = { ...d }; delete copy[acc]; return copy; }); return prev.filter(a => a !== acc); } return [...prev, acc]; }); };
  const updateDetail = (acc: string, detail: string) => { setAccessoryDetails(prev => ({ ...prev, [acc]: detail })); };
  const toggleService = (serviceName: string) => { setSelectedServices(prev => { const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName]; const total = next.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0); setCost(String(total)); return next; }); };
  const toggleSoftware = (name: string) => { setSelectedSoftware(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };
  const toggleVideogame = (name: string) => { setSelectedVideogames(prev => prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]); };
  const buildAccessoriesArray = (): string[] => { return selectedAccessories.map(acc => { const detail = accessoryDetails[acc]?.trim(); return detail ? `${acc} (${detail})` : acc; }); };

  const filteredServices = servicesList.filter(s => searchServices === "" || s.name.toLowerCase().includes(searchServices.toLowerCase()));
  const filteredSoftware = softwareList.filter(s => searchSoftware === "" || s.name.toLowerCase().includes(searchSoftware.toLowerCase()) || (s.category || "").toLowerCase().includes(searchSoftware.toLowerCase()));
  const filteredVideogames = videogamesList.filter(v => searchVideogames === "" || v.name.toLowerCase().includes(searchVideogames.toLowerCase()) || (v.platform || "").toLowerCase().includes(searchVideogames.toLowerCase()) || (v.genre || "").toLowerCase().includes(searchVideogames.toLowerCase()));

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsedUser = (() => { try { return JSON.parse(userData); } catch { return null; } })(); setUser(parsedUser); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    // Load branches for superadmin
    if (parsedUser.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); setBranchesLoaded(true); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(parsedUser.branchId || ""); }

    if (parsedUser.role !== "admin" && parsedUser.role !== "superadmin") { router.push("/dashboard"); return; }
    // Viene de una cita ("Llegó: crear orden"): datos ya llenos
    const citaId = new URLSearchParams(window.location.search).get("cita");
    if (citaId) apiFetch(`/api/appointments?id=${encodeURIComponent(citaId)}`).then(r => r.ok ? r.json() : null).then(a => {
      if (!a) return;
      setFromAppt({ id: a.id, code: a.code, when: a.when });
      setDevice(a.device || ""); setIssue(a.issue || ""); setClientName(a.clientName || ""); setClientPhone(String(a.clientPhone || "").replace(/^591/, ""));
    }).catch(() => {});
    apiFetch("/api/services").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setServicesList(data); }).catch(() => {});
    apiFetch("/api/software").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setSoftwareList(data); }).catch(() => {});
    apiFetch("/api/videogames").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setVideogamesList(data); }).catch(() => {});
    apiFetch("/api/technicians", { }).then(res => res.json()).then(data => { if (Array.isArray(data)) setTechniciansList(data); }).catch(() => {});
    const savedForm = sessionStorage.getItem("newOrderForm");
    if (savedForm) { try { const data = (() => { try { return JSON.parse(savedForm); } catch { return null; } })(); setDevice(data.device || ""); setBrand(data.brand || ""); setModel(data.model || ""); setImei(data.imei || ""); setIssue(data.issue || ""); setCost(data.cost || ""); setNotes(data.notes || ""); setClientName(data.clientName || ""); setClientPhone(data.clientPhone || ""); setSelectedAccessories(data.selectedAccessories || []); setAccessoryDetails(data.accessoryDetails || {}); setSelectedServices(data.selectedServices || []); setSelectedSoftware(data.selectedSoftware || []); setSelectedVideogames(data.selectedVideogames || []); setImageUrls(data.imageUrls || []); setImagePreviews(data.imagePreviews || []); } catch {} sessionStorage.removeItem("newOrderForm"); }
    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) { try { const { url, preview } = (() => { try { return JSON.parse(capturedData); } catch { return {}; } })(); setImageUrls(prev => [...prev, url]); setImagePreviews(prev => [...prev, preview]); sileo.success({ title: "Foto capturada" }); } catch {} sessionStorage.removeItem("capturedImage"); }
  }, [router]);

  const saveFormToSession = () => { sessionStorage.setItem("newOrderForm", JSON.stringify({ device, brand, model, imei, issue, cost, notes, clientName, clientPhone, selectedAccessories, accessoryDetails, selectedServices, selectedSoftware, selectedVideogames, imageUrls, imagePreviews })); };

  // Autocomplete de cliente: busca al escribir el teléfono o nombre
  useEffect(() => {
    const q = clientPhone.trim() || clientName.trim();
    if (q.length < 3) { setClientSuggestions([]); return; } // eslint-disable-line react-hooks/set-state-in-effect -- limpia las sugerencias si el texto es corto
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/clients?limit=5&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setClientSuggestions((d.clients || []).slice(0, 5));
        }
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [clientPhone, clientName]);

  const pickSuggestion = (c: ClientSuggestion) => {
    setClientName(c.name); setClientPhone(c.phone);
    setShowSuggestions(false); setClientSuggestions([]);
  };
  const uploadFiles = async (files: FileList) => { setUploading(true); for (let i = 0; i < files.length; i++) { const file = files[i]; const reader = new FileReader(); reader.onload = (ev) => setImagePreviews(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); const formData = new FormData(); formData.append("file", file); try { const res = await apiFetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setImageUrls(prev => [...prev, data.url]); } } catch {} } sileo.success({ title: `${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}` }); setUploading(false); };
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; await uploadFiles(files); e.target.value = ""; };
  const handleTakePhoto = () => { saveFormToSession(); sessionStorage.setItem("cameraReturnUrl", "/new-order"); window.location.href = "/camera.html"; };
  const removeImage = (index: number) => { setImageUrls(prev => prev.filter((_, i) => i !== index)); setImagePreviews(prev => prev.filter((_, i) => i !== index)); };

  const createRepair = async (e: React.FormEvent) => {
    e.preventDefault(); const token = sessionStorage.getItem("token"); if (!token) return;
    if (["bad", "typing"].includes(imeiState(imei))) { sileo.error({ title: "El IMEI no es válido", description: "Revisa los 15 dígitos (marca *#06# en el celular) o déjalo vacío." }); return; }
    setSaving(true);
    try {
      const imageData = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null; const accArray = buildAccessoriesArray();
      const servicesNote = selectedServices.length > 0 ? `Servicios: ${selectedServices.join(", ")}` : "";
      const softwareNote = selectedSoftware.length > 0 ? `Programas: ${selectedSoftware.join(", ")}` : "";
      const videogamesNote = selectedVideogames.length > 0 ? `Videojuegos: ${selectedVideogames.join(", ")}` : "";
      const finalNotes = [notes, servicesNote, softwareNote, videogamesNote].filter(Boolean).join(" | ");
      const res = await apiFetch("/api/repairs", { method: "POST", body: JSON.stringify({ device, brand, model, imei, issue, priority, estimatedCost: parseFloat(cost) || 0, notes: finalNotes || null, clientName, clientPhone, clientEmail: "", image: imageData, accessories: accArray.length > 0 ? JSON.stringify(accArray) : null, technicianId: technicianId || null, warrantyOf: warrantyOf?.code || null, appointmentId: fromAppt?.id || null }) });
      if (res.ok) { const nr = await res.json(); sileo.success({ title: `Orden ${nr.code} creada` }); sessionStorage.removeItem("newOrderForm"); setTimeout(() => router.push(`/dashboard?print=${encodeURIComponent(nr.code)}`), 600); } else { const d = await res.json().catch(() => ({})); sileo.error({ title: d.error === "Se requiere sucursal" ? "Primero crea una sucursal (Administración → Sucursales)" : d.error || "Error al crear la orden" }); }
    } catch { sileo.error({ title: "Error de conexión" }); } setSaving(false);
  };

  if (!user) return <PageSkeleton />;

  const svcTotal = selectedServices.reduce((sum, name) => sum + (servicesList.find(s => s.name === name)?.price || 0), 0);
  const total = parseFloat(cost) || 0;
  const tech = techniciansList.find(t => t.id === technicianId);
  const deviceLabel = [device, brand, model].filter(Boolean).join(" ");
  const branchName = branches.find(b => b.id === activeBranch)?.name || user?.branchName || "";
  const PICK_TABS = [
    { key: "services" as const, label: "Servicios", count: selectedServices.length, show: servicesList.length > 0 },
    { key: "software" as const, label: "Programas", count: selectedSoftware.length, show: softwareList.length > 0 },
    { key: "games" as const, label: "Videojuegos", count: selectedVideogames.length, show: videogamesList.length > 0 },
  ].filter(t => t.show);
  const tab = PICK_TABS.some(t => t.key === pickTab) ? pickTab : PICK_TABS[0]?.key;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", position: "relative", paddingLeft: 200 }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
        }
      `}</style>

      <AppSidebar user={user} />

      <form onSubmit={createRepair} className="ox-page">
        <section className="ox-hero">
          <span className="ox-hero-ic" aria-hidden="true"><FilePlus2 size={26} strokeWidth={STROKE} /></span>
          <div style={{ position: "relative", zIndex: 1 }}>
            <h1>Nueva orden de trabajo</h1>
            <p>Recibe el equipo en 1 minuto: cliente, equipo y problema. Lo demás es opcional.</p>
          </div>
          <div className="ox-hero-meta">
            {branchName && <span><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {branchName}</span>}
            <span><User size={14} strokeWidth={STROKE} aria-hidden="true" /> Recibe: {user?.name?.split(" ")[0]}</span>
          </div>
        </section>

        {user?.role === "superadmin" && branchesLoaded && branches.length === 0 && (
          <div role="alert" className="ox-note warn" style={{ marginTop: 16 }}>
            <Store size={14} strokeWidth={STROKE} aria-hidden="true" /> Todavía no hay sucursales: cada orden pertenece a una.
            <button type="button" className="ox-chip" style={{ marginLeft: "auto" }} onClick={() => router.push("/admin/branches")}>Crear sucursal →</button>
          </div>
        )}
        {fromAppt && <div className="ox-note info" style={{ marginTop: 16 }}><CalendarDays size={14} strokeWidth={STROKE} aria-hidden="true" /> Orden desde la cita {fromAppt.code} · {fromAppt.when}. Revisa los datos y completa la marca.</div>}

        <div className="ox-grid">
          <div className="ox-col">
            {/* CLIENTE */}
            <FormSection card icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
              <div className="ox-row">
                <Field label="Nombre" required>
                  <input className="ox-input" value={clientName} onChange={(e) => { setClientName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} required />
                </Field>
                <Field label="Celular con WhatsApp" required>
                  <input className="ox-input tabular" inputMode="tel" value={clientPhone} onChange={(e) => { setClientPhone(e.target.value); setShowSuggestions(true); if (warrantyOf) setWarrantyOf(null); }} onFocus={() => setShowSuggestions(true)} required />
                </Field>
              </div>
              <WarrantyNotice phone={clientPhone} picked={warrantyOf} onPick={(h) => {
                setWarrantyOf(h);
                if (h) {
                  // Reingreso: mismo equipo, sin costo (se puede cambiar)
                  if (!device.trim()) setDevice(h.device || "");
                  if (!brand.trim()) setBrand(h.brand || "");
                  if (!model.trim()) setModel(h.model || "");
                  setCost("0");
                  setShowSuggestions(false);
                }
              }} />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="ox-note ok" style={{ marginBottom: 8 }}>
                    {clientSuggestions.length === 1 ? "Cliente conocido" : `${clientSuggestions.length} clientes encontrados`} · toca para completar
                    <button type="button" onClick={() => setShowSuggestions(false)} style={{ marginLeft: "auto", border: 0, background: "#fff", borderRadius: 8, padding: "4px 10px", fontWeight: 700, color: "var(--ok)", cursor: "pointer" }}>Ocultar</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {clientSuggestions.map((c) => (
                      <button type="button" key={c.phoneKey} onClick={() => pickSuggestion(c)} className="ox-item">
                        <span className="ox-av" style={{ background: "var(--accent)" }}>{c.name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("") || "?"}</span>
                        <b>{c.name}<small className="tabular"><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> {c.phone}</small></b>
                        <span className="p tabular" style={{ textAlign: "right" }}>{c.totalRepairs} OTs<small>Bs. {(c.totalSpent || 0).toFixed(0)}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </FormSection>

            {/* EQUIPO */}
            <FormSection card icon={<Smartphone size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Equipo">
              <div className="ox-chips" role="group" aria-label="Tipo de equipo" style={{ marginBottom: 14 }}>
                {DEVICE_TYPES.map(d => (
                  <button key={d.label} type="button" className="ox-chip" aria-pressed={device.trim().toLowerCase() === d.label.toLowerCase()} onClick={() => setDevice(d.label)}>
                    <span className="e" aria-hidden="true"><DeviceIcon device={d.label} size={18} /></span>{d.label}
                  </button>
                ))}
              </div>
              <div className="ox-row3">
                <Field label="Tipo de equipo" required>
                  <input className="ox-input" value={device} onChange={(e) => setDevice(e.target.value)} required />
                </Field>
                <Field label="Marca" required>
                  <input className="ox-input" value={brand} onChange={(e) => setBrand(e.target.value)} required />
                </Field>
                <Field label="Modelo">
                  <input className="ox-input" value={model} onChange={(e) => setModel(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: 14 }}><ImeiField value={imei} onChange={setImei} labelStyle={oxLabelStyle} fieldStyle={oxFieldStyle} /></div>
            </FormSection>

            {/* PROBLEMA Y FOTOS */}
            <FormSection card icon={<Stethoscope size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Problema y estado del equipo">
              <Field label="¿Qué le pasa?" required>
                <textarea className="ox-input" value={issue} onChange={(e) => setIssue(e.target.value)} required rows={3} />
              </Field>
              <Field label="Cómo llega (rayones, golpes, piezas sueltas)" style={{ marginTop: 12 }}>
                <textarea className="ox-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </Field>
              <div className="ox-photos" style={{ marginTop: 14 }}>
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="ox-ph">
                    <img src={preview} alt={`Foto ${idx + 1}`} />
                    <button type="button" className="x" onClick={() => removeImage(idx)} aria-label={`Quitar foto ${idx + 1}`}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    {uploading && idx === imagePreviews.length - 1 && <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>Subiendo…</div>}
                  </div>
                ))}
                <button type="button" className="ox-ph-add" onClick={handleTakePhoto}><span className="e" aria-hidden="true"><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Cámara</button>
                <button type="button" className="ox-ph-add" onClick={() => fileInputRef.current?.click()}><span className="e" aria-hidden="true"><ImagePlus size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Subir foto</button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: "none" }} />
              </div>
            </FormSection>

            {/* ACCESORIOS */}
            <FormSection card icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios que deja" hint="Toca para marcar">
              <div className="ox-chips" role="group" aria-label="Accesorios" translate="no">
                {ACCESSORIES_LIST.map(acc => (
                  <button key={acc} type="button" className="ox-chip" aria-pressed={selectedAccessories.includes(acc)} onClick={() => toggleAcc(acc)}>
                    <span className="e" aria-hidden="true"><AccessoryIcon name={acc} size={18} /></span>{acc}
                  </button>
                ))}
              </div>
              {selectedAccessories.some(acc => ACCESSORIES_HINTS[acc]) && (
                <div className="ox-acc-details">
                  {selectedAccessories.filter(acc => ACCESSORIES_HINTS[acc]).map(acc => (
                    <Field key={acc} label={acc}>
                      <input className="ox-input" value={accessoryDetails[acc] || ""} onChange={(e) => updateDetail(acc, e.target.value)} />
                    </Field>
                  ))}
                </div>
              )}
            </FormSection>

            {/* SERVICIOS, PROGRAMAS Y VIDEOJUEGOS */}
            {PICK_TABS.length > 0 && (
              <FormSection card icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Servicios e instalaciones" hint="Opcional · los servicios suman al costo">
                {PICK_TABS.length > 1 && (
                  <div className="ox-tabs" role="group" aria-label="Qué agregar">
                    {PICK_TABS.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setPickTab(t.key)}>{t.label}{t.count > 0 && <b>{t.count}</b>}</button>)}
                  </div>
                )}
                {tab === "services" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchServices} onChange={(e) => setSearchServices(e.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" /></div>
                  <div className="ox-list">
                    {filteredServices.map(svc => (
                      <button key={svc.id || svc.name} type="button" className="ox-item" aria-pressed={selectedServices.includes(svc.name)} onClick={() => toggleService(svc.name)}>
                        <span className="e" aria-hidden="true"><ServiceIcon icon={svc.icon} size={18} /></span><b>{svc.name}</b><span className="p tabular">Bs. {svc.price}</span>
                      </button>
                    ))}
                  </div>
                  {filteredServices.length === 0 && <p className="ox-hint">No hay servicios con ese nombre.</p>}
                </>)}
                {tab === "software" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchSoftware} onChange={(e) => setSearchSoftware(e.target.value)} placeholder="Buscar programa" aria-label="Buscar programa" /></div>
                  <div className="ox-list">
                    {filteredSoftware.map(sw => (
                      <button key={sw.id} type="button" className="ox-item" aria-pressed={selectedSoftware.includes(sw.name)} onClick={() => toggleSoftware(sw.name)}>
                        <span className="e" aria-hidden="true"><Disc3 size={14} strokeWidth={STROKE} aria-hidden="true" /></span><b>{sw.name}{sw.category && <small>{sw.category}</small>}</b>
                      </button>
                    ))}
                  </div>
                  {filteredSoftware.length === 0 && <p className="ox-hint">No hay programas con ese nombre.</p>}
                </>)}
                {tab === "games" && (<>
                  <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={searchVideogames} onChange={(e) => setSearchVideogames(e.target.value)} placeholder="Buscar videojuego" aria-label="Buscar videojuego" /></div>
                  <div className="ox-list">
                    {filteredVideogames.map(vg => (
                      <button key={vg.id} type="button" className="ox-item" aria-pressed={selectedVideogames.includes(vg.name)} onClick={() => toggleVideogame(vg.name)}>
                        <span className="e" aria-hidden="true"><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /></span><b>{vg.name}{(vg.platform || vg.genre) && <small>{[vg.platform, vg.genre].filter(Boolean).join(" · ")}</small>}</b>
                      </button>
                    ))}
                  </div>
                  {filteredVideogames.length === 0 && <p className="ox-hint">No hay videojuegos con ese nombre.</p>}
                </>)}
              </FormSection>
            )}

            {/* TÉCNICO */}
            <FormSection card icon={<UserCog size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Técnico" hint="Opcional">
              {techniciansList.length === 0 ? (
                <p className="ox-hint">No hay técnicos registrados. Crea usuarios con rol técnico para asignar.</p>
              ) : (
                <div className="ox-techs" role="group" aria-label="Técnico">
                  {techniciansList.map((t, i) => (
                    <button key={t.id} type="button" className="ox-tech" aria-pressed={technicianId === t.id} onClick={() => setTechnicianId(technicianId === t.id ? "" : t.id)}>
                      <span className="ox-av" style={{ background: TECH_COLORS[i % TECH_COLORS.length] }}>{initials(t.name)}</span>
                      <span style={{ minWidth: 0 }}><b>{t.name}</b><small>{t.activeCount ?? 0} {t.activeCount === 1 ? "orden activa" : "órdenes activas"}</small></span>
                    </button>
                  ))}
                  <button type="button" className="ox-tech" aria-pressed={!technicianId} onClick={() => setTechnicianId("")}>
                    <span className="ox-av" style={{ background: "var(--text-faint)" }}>—</span>
                    <span><b>Sin asignar</b><small>Se asigna después</small></span>
                  </button>
                </div>
              )}
            </FormSection>
          </div>

          {/* RESUMEN */}
          <aside className="ox-ticket" aria-labelledby="ox-sum">
            <div className="ox-ticket-h"><small>Resumen de la orden</small><b id="ox-sum">OT nueva{branchName ? ` · ${branchName}` : ""}</b></div>
            <div className="ox-ticket-b">
              <div className="ox-kv"><span>Cliente</span><b>{clientName || "—"}</b></div>
              <div className="ox-kv"><span>Equipo</span><b>{deviceLabel || "—"}</b></div>
              <div className="ox-kv"><span>Accesorios</span><b>{selectedAccessories.length ? selectedAccessories.join(", ") : "Ninguno"}</b></div>
              <div className="ox-kv"><span>Técnico</span><b>{tech?.name || "Sin asignar"}</b></div>
              {warrantyOf && <div className="ox-kv"><span>Garantía de</span><b>{warrantyOf.code}</b></div>}
              {(selectedServices.length > 0 || selectedSoftware.length > 0 || selectedVideogames.length > 0) && (
                <div className="ox-lines">
                  {selectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return <div key={name}><span><ServiceIcon icon={svc?.icon} size={14} /> {name}</span><b className="tabular">Bs. {svc?.price || 0}</b></div>; })}
                  {selectedSoftware.map(name => <div key={name}><span><Disc3 size={14} strokeWidth={STROKE} aria-hidden="true" /> {name}</span></div>)}
                  {selectedVideogames.map(name => <div key={name}><span><Gamepad2 size={14} strokeWidth={STROKE} aria-hidden="true" /> {name}</span></div>)}
                </div>
              )}
              <Field label="Costo estimado (Bs.)" hint={selectedServices.length > 0 ? `Sugerido por ${selectedServices.length} servicio${selectedServices.length > 1 ? "s" : ""} (Bs. ${svcTotal}). Puedes cambiarlo.` : undefined} style={{ marginTop: 12 }}>
                <input className="ox-input tabular" value={cost} onChange={(e) => setCost(e.target.value)} type="number" min="0" inputMode="decimal" />
              </Field>
              <div className="ox-prio" role="group" aria-label="Prioridad">
                {PRIORITIES.map(p => <button key={p.value} type="button" aria-pressed={priority === p.value} onClick={() => setPriority(p.value)}><StatusDot color={p.color} />{p.label}</button>)}
              </div>
              <div className="ox-total"><span>Total estimado</span><b>Bs. {total.toLocaleString("es-BO")}</b></div>
              <button type="submit" className={`ox-go${saving ? " is-busy" : ""}`} disabled={uploading || saving} aria-busy={saving}><span className="lbl"><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Registrar orden</span>{saving && <i className="rt-spin" aria-hidden="true" />}</button>
              <button type="button" className="ox-ghost" onClick={() => { sessionStorage.removeItem("newOrderForm"); router.push("/dashboard"); }}>← Cancelar</button>
              <p className="ox-after">Al registrar se abre la impresión y el cliente recibe su seguimiento por WhatsApp.</p>
            </div>
          </aside>
        </div>

        <div className="ox-mbar">
          <div><small>Total estimado</small><b>Bs. {total.toLocaleString("es-BO")}</b></div>
          <button type="submit" className={`ox-go${saving ? " is-busy" : ""}`} disabled={uploading || saving} aria-busy={saving}><span className="lbl"><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Registrar</span>{saving && <i className="rt-spin" aria-hidden="true" />}</button>
        </div>
      </form>
    </div>
  );
}

