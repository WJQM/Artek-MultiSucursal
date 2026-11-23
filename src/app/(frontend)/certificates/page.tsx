"use client";
import { ClipboardList, Eye, Printer, SquarePen, Trash2, User } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { Pagination, usePaged } from "@/frontend/components/Pagination";
import { apiFetch, getActiveBranchId, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { SaveButton } from "@/frontend/components/Motion";
import { useLiveRefresh } from "@/frontend/lib/live";
import { CertificateSheet, certLicenses } from "@/frontend/components/CertificateSheet";
import { qrSrc } from "@/frontend/components/DocKit";
import { askConfirm } from "@/frontend/lib/dialog";
import { PageSkeleton } from "@/frontend/components/Skeletons";

const WINDOWS_EDITIONS = [
  "Windows 11 Pro","Windows 11 Home","Windows 11 Enterprise","Windows 11 Education","Windows 11 Pro for Workstations",
  "Windows 10 Pro","Windows 10 Home","Windows 10 Enterprise","Windows 10 Enterprise LTSC","Windows 10 Education","Windows 10 Pro for Workstations",
  "Windows 8.1 Pro","Windows 8.1","Windows 8.1 Enterprise","Windows 8 Pro","Windows 8","Windows 8 Enterprise",
  "Windows 7 Ultimate","Windows 7 Professional","Windows 7 Home Premium","Windows 7 Home Basic","Windows 7 Enterprise","Windows 7 Starter",
];

const OFFICE_EDITIONS = [
  "Microsoft Office LTSC Professional Plus 2024","Microsoft Office LTSC Standard 2024",
  "Microsoft Office Professional Plus 2021","Microsoft Office Standard 2021","Microsoft Office Home & Business 2021","Microsoft Office Home & Student 2021",
  "Microsoft Office LTSC Professional Plus 2021","Microsoft Office LTSC Standard 2021",
  "Microsoft Office Professional Plus 2019","Microsoft Office Standard 2019","Microsoft Office Home & Business 2019","Microsoft Office Home & Student 2019",
  "Microsoft Office Professional Plus 2016","Microsoft Office Standard 2016","Microsoft Office Home & Business 2016","Microsoft Office Home & Student 2016",
  "Microsoft Office Professional Plus 2013","Microsoft Office Standard 2013","Microsoft Office Home & Business 2013","Microsoft Office Home & Student 2013",
  "Microsoft Office Professional Plus 2010","Microsoft Office Standard 2010","Microsoft Office Home & Business 2010","Microsoft Office Home & Student 2010",
  "Microsoft 365 Apps for Enterprise","Microsoft 365 Apps for Business","Microsoft 365 Personal","Microsoft 365 Family",
];

// Certificado tal como lo devuelve /api/certificates
interface CertEntry {
  id: string; code: string; clientName: string; computerName: string | null; windowsEdition: string | null; windowsSerial: string | null;
  officeEdition: string | null; officeSerial: string | null; date: string; technician: string; notes: string | null; createdAt: string;
  user?: { id: string; name: string } | null;
}

const defaultForm = {
  clientName: "", computerName: "", windowsEdition: "Windows 11 Pro", windowsSerial: "",
  officeEdition: "Microsoft Office LTSC Professional Plus 2024", officeSerial: "",
  date: new Date().toLocaleDateString("en-CA"), technician: "", notes: "",
};

export default function CertificatesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; website: string | null; phone: string | null; address: string | null }>({ companyName: "", slogan: "", logo: null, website: null, phone: null, address: null });
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(false);
  const [previewCode, setPreviewCode] = useState<string>("");
  const [history, setHistory] = useState<CertEntry[]>([]);
  const paged = usePaged(history, 10, "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"form" | "history">("form");
  const certRef = useRef<HTMLDivElement>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const formatSerial = (val: string) => { const c = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase(); return (c.match(/.{1,5}/g) || []).join("-"); };
  const handleSerialChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: formatSerial(e.target.value) }));

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName || "RepairTrackQR", slogan: d.slogan || "Servicio Técnico", logo: d.logo || null, website: d.website || null, phone: d.phone || null, address: d.address || null }); }).catch(() => {});
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (!parsed || (parsed.role !== "admin" && parsed.role !== "superadmin")) { router.push(parsed?.role === "tech" ? "/asignaciones" : "/"); return; }
    setUser(parsed);
    setForm(f => ({ ...f, technician: parsed.name || "" }));
    if (parsed.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length > 0) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    }
    loadCertificates();
  }, [router]);

  const loadCertificates = async () => {
    try {
      const res = await apiFetch("/api/certificates");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        // Handle ?view=CL-X&branchId=xxx from scanner/search
        const params = new URLSearchParams(window.location.search);
        const viewCode = params.get("view");
        if (viewCode) {
          const viewBranch = params.get("branchId");
          // Try to find in current branch list first
          let found: CertEntry | undefined = data.find((c: CertEntry) => c.code === viewCode);
          // If not found and branchId provided, fetch directly from that branch
          if (!found && viewBranch) {
            try {
              const r2 = await apiFetch(`/api/certificates?code=${viewCode}&branchId=${viewBranch}`);
              if (r2.ok) found = await r2.json();
            } catch {}
          }
          if (found) {
            setForm({ clientName: found.clientName, computerName: found.computerName || "", windowsEdition: found.windowsEdition || "Windows 11 Pro", windowsSerial: found.windowsSerial || "", officeEdition: found.officeEdition || "Microsoft Office LTSC Professional Plus 2024", officeSerial: found.officeSerial || "", date: found.date, technician: found.technician, notes: found.notes || "" });
            setPreviewCode(found.code);
            setPreview(true);
          }
          window.history.replaceState({}, "", "/certificates");
        }
      }
    } catch {} finally { setLoading(false); }
  };
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Certificate"], () => loadCertificates());

  const handleGenerate = async () => {
    if (!form.clientName.trim()) { sileo.error("El nombre del cliente es obligatorio"); return; }
    if (!form.windowsSerial && !form.officeSerial) { sileo.error("Ingresa al menos una clave de producto"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await apiFetch("/api/certificates", { method: "PATCH", body: JSON.stringify({ id: editingId, ...form }) });
        if (res.ok) { const u = await res.json(); sileo.success(`Certificado ${u.code} actualizado`); setPreviewCode(u.code); setPreview(true); setEditingId(null); loadCertificates(); }
        else { const d = await res.json(); sileo.error(d.error || "Error al actualizar"); }
      } else {
        const res = await apiFetch("/api/certificates", { method: "POST", body: JSON.stringify(form) });
        if (res.ok) { const c = await res.json(); sileo.success(`Certificado ${c.code} guardado en DB`); setPreviewCode(c.code); setPreview(true); loadCertificates(); }
        else { const d = await res.json(); sileo.error(d.error || "Error al crear"); }
      }
    } catch { sileo.error("Error de conexión"); } finally { setSaving(false); }
  };

  const loadFromHistory = (entry: CertEntry) => {
    setForm({ clientName: entry.clientName, computerName: entry.computerName || "", windowsEdition: entry.windowsEdition || "Windows 11 Pro", windowsSerial: entry.windowsSerial || "", officeEdition: entry.officeEdition || "Microsoft Office LTSC Professional Plus 2024", officeSerial: entry.officeSerial || "", date: entry.date, technician: entry.technician, notes: entry.notes || "" });
    setEditingId(entry.id); setTab("form"); sileo.success(`${entry.code} cargado para edición`);
  };

  const viewCertificate = (entry: CertEntry) => {
    setForm({ clientName: entry.clientName, computerName: entry.computerName || "", windowsEdition: entry.windowsEdition || "Windows 11 Pro", windowsSerial: entry.windowsSerial || "", officeEdition: entry.officeEdition || "Microsoft Office LTSC Professional Plus 2024", officeSerial: entry.officeSerial || "", date: entry.date, technician: entry.technician, notes: entry.notes || "" });
    setPreviewCode(entry.code); setPreview(true);
  };

  const deleteFromHistory = async (id: string, code: string) => {
    if (!await askConfirm(`¿Eliminar el certificado ${code}?`)) return;
    try { const res = await apiFetch(`/api/certificates?id=${id}`, { method: "DELETE" }); if (res.ok) { sileo.success("Certificado eliminado"); loadCertificates(); } else { sileo.error("Error al eliminar"); } } catch { sileo.error("Error de conexión"); }
  };

  const handlePrint = () => {
    const branchId = getActiveBranchId();
    window.open(`/certificate-view/${previewCode}${branchId ? `?branchId=${branchId}` : ""}`, "_blank");
  };

  const canGenerate = form.clientName.trim() && (form.windowsSerial || form.officeSerial);

  if (loading) return <PageSkeleton />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex" }}>
      <style>{`
        .sidebar-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted);transition: .15s; transition-property: var(--tr-ui);text-align:left}
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover{background:rgba(var(--accent-bright-rgb), 0.05);color:var(--text-secondary)} }
        .sidebar-btn.active{background:rgba(var(--accent-bright-rgb), 0.07);color:var(--accent)}
        .sidebar-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .cert-input{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:#ffffff;color:#1e2a3a;outline:none;transition:border-color .2s,box-shadow .2s}
        .cert-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-bright-rgb), 0.07)}
        .cert-input::placeholder{color:var(--text-muted)}
        .cert-select{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:#ffffff;color:var(--text-primary);outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23818cf8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
        .cert-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-bright-rgb), 0.07)}
        .cert-select option{background:#1a1a2e;color:#e2e8f0}
        @media(max-width:1024px){.sidebar-desktop{transform:translateX(-100%)!important}.sidebar-desktop.open{transform:translateX(0)!important}.main-content{margin-left:0!important;padding-top:56px!important}.sidebar-overlay{display:block!important}}
      `}</style>

      <AppSidebar user={user} />

      {/* Main content */}
      <main className="main-content" style={{ marginLeft: 210, flex: 1, padding: "20px 24px", minHeight: "100vh" }}>
        {!preview ? (
          <>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Certificados de autenticidad</h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Genera certificados con código CL auto-incremental por sucursal · Guardados en base de datos</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setTab("form"); setEditingId(null); setForm({ ...defaultForm, technician: user?.name || "" }); }} style={{ padding: "8px 18px", borderRadius: 10, border: tab === "form" ? "none" : "1px solid var(--border)", background: tab === "form" ? "linear-gradient(135deg,var(--accent),var(--accent-dim))" : "transparent", color: tab === "form" ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Nuevo</button>
                <button onClick={() => setTab("history")} style={{ padding: "8px 18px", borderRadius: 10, border: tab === "history" ? "none" : "1px solid var(--border)", background: tab === "history" ? "linear-gradient(135deg,var(--accent),var(--accent-dim))" : "transparent", color: tab === "history" ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Historial ({history.length})</button>
              </div>
            </div>
            </div>

            {tab === "form" ? (
              <div style={{ maxWidth: 700, margin: "0 auto" }}>
                {editingId && (
                  <div style={{ marginBottom: 14, padding: "10px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--warn)", fontWeight: 600 }}>Editando certificado existente</span>
                    <button onClick={() => { setEditingId(null); setForm({ ...defaultForm, technician: user?.name || "" }); }} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Cancelar</button>
                  </div>
                )}

                {/* Client Info */}
                <div className="ox-card" style={{ marginBottom: 16 }}>
                  <h2><span className="ox-e" aria-hidden="true"><User size={18} strokeWidth={STROKE} aria-hidden="true" /></span>Cliente y equipo</h2>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label htmlFor="f-certificates-1" className="ox-label" style={{ marginBottom: 6 }}>Nombre del Cliente *</label><input id="f-certificates-1" className="ox-input" value={form.clientName} onChange={set("clientName")} placeholder="Juan Pérez" /></div>
                    <div><label htmlFor="f-certificates-2" className="ox-label" style={{ marginBottom: 6 }}>Nombre del Equipo</label><input id="f-certificates-2" className="ox-input" value={form.computerName} onChange={set("computerName")} placeholder="PC-OFICINA-01" /></div>
                    <div><label htmlFor="f-certificates-3" className="ox-label" style={{ marginBottom: 6 }}>Fecha</label><input id="f-certificates-3" type="date" className="ox-input" value={form.date} onChange={set("date")} /></div>
                    <div><label htmlFor="f-certificates-4" className="ox-label" style={{ marginBottom: 6 }}>Técnico Responsable</label><input id="f-certificates-4" className="ox-input" value={form.technician} onChange={set("technician")} placeholder="Nombre del técnico" /></div>
                  </div>
                </div>

                {/* Windows */}
                <div className="ox-card" style={{ marginBottom: 16 }}>
                  <h2>
                    <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><rect x="2" y="2" width="11" height="11" rx="1.5" fill="#0078D4"/><rect x="15" y="2" width="11" height="11" rx="1.5" fill="#0078D4"/><rect x="2" y="15" width="11" height="11" rx="1.5" fill="#0078D4"/><rect x="15" y="15" width="11" height="11" rx="1.5" fill="#0078D4"/></svg>
                    Licencia de Windows
                  </h2>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label htmlFor="f-certificates-5" className="ox-label" style={{ marginBottom: 6 }}>Edición</label><select id="f-certificates-5" className="ox-input" value={form.windowsEdition} onChange={set("windowsEdition")}>{(WINDOWS_EDITIONS || []).map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                    <div><label htmlFor="f-certificates-6" className="ox-label" style={{ marginBottom: 6 }}>Clave de Producto</label><input id="f-certificates-6" className="ox-input" style={{ fontFamily: "'Courier New', monospace", letterSpacing: 1.5 }} value={form.windowsSerial} onChange={handleSerialChange("windowsSerial")} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} /></div>
                  </div>
                </div>

                {/* Office */}
                <div className="ox-card" style={{ marginBottom: 16 }}>
                  <h2>
                    <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><rect x="3" y="3" width="22" height="22" rx="4" fill="#D83B01"/><text x="14" y="19" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="serif">O</text></svg>
                    Licencia de Microsoft Office
                  </h2>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label htmlFor="f-certificates-7" className="ox-label" style={{ marginBottom: 6 }}>Edición</label><select id="f-certificates-7" className="ox-input" value={form.officeEdition} onChange={set("officeEdition")}>{(OFFICE_EDITIONS || []).map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                    <div><label htmlFor="f-certificates-8" className="ox-label" style={{ marginBottom: 6 }}>Clave de Producto</label><input id="f-certificates-8" className="ox-input" style={{ fontFamily: "'Courier New', monospace", letterSpacing: 1.5 }} value={form.officeSerial} onChange={handleSerialChange("officeSerial")} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} /></div>
                  </div>
                </div>

                {/* Notes */}
                <div className="ox-card" style={{ marginBottom: 20 }}>
                  <label htmlFor="f-certificates-9" className="ox-label" style={{ marginBottom: 6 }}>Notas Adicionales</label>
                  <textarea id="f-certificates-9" className="ox-input" style={{ minHeight: 60, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Observaciones opcionales..." />
                </div>

                <SaveButton disabled={!canGenerate || saving} onClick={handleGenerate}>
                  {editingId ? "Actualizar certificado" : "Generar certificado (CL)"}
                </SaveButton>
                {!canGenerate && <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Ingresa el nombre del cliente y al menos una clave de producto</p>}
              </div>
            ) : (
              <div style={{ maxWidth: 700, margin: "0 auto" }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><div style={{ fontSize: 40, marginBottom: 12 }}><ClipboardList size={40} strokeWidth={1.5} aria-hidden="true" /></div><p style={{ fontSize: 13 }}>No hay certificados en la base de datos</p></div>
                ) : paged.items.map(h => (
                  <div key={h.id} style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-sm)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(var(--accent-bright-rgb), 0.08)" }}>{h.code}</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{h.clientName}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {h.computerName && `${h.computerName} · `}{h.technician && `Téc: ${h.technician} · `}{new Date(h.createdAt).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" })}{h.user?.name && ` · ${h.user.name}`}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        {h.windowsSerial && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(0,120,212,0.1)", color: "#0078D4", fontWeight: 600 }}>{h.windowsEdition}</span>}
                        {h.officeSerial && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(216,59,1,0.1)", color: "#D83B01", fontWeight: 600 }}>{h.officeEdition}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => viewCertificate(h)} title="Ver/Imprimir" style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)", color: "var(--ok)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Eye size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                      <button onClick={() => loadFromHistory(h)} title="Editar" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", background: "rgba(var(--accent-bright-rgb), 0.05)", color: "var(--accent-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><SquarePen size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                      <button onClick={() => deleteFromHistory(h.id, h.code)} title="Eliminar" style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "var(--danger-bright)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    </div>
                  </div>
                ))}
                <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setPreview(false)} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Volver</button>
              <button onClick={handlePrint} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir</button>
              <button onClick={() => { setForm({ ...defaultForm, technician: user?.name || "" }); setEditingId(null); setPreview(false); }} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)", color: "var(--ok)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>＋ Nuevo</button>
            </div>
            {previewCode && <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.06)", padding: "6px 20px", borderRadius: 10, border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", letterSpacing: 1.5 }}>{previewCode}</span></div>}
            <div ref={certRef}>
              <CertificateSheet s={settings}
                qr={previewCode && typeof window !== "undefined" ? qrSrc(`${window.location.origin}/certificate-view/${previewCode}${activeBranch ? `?branchId=${activeBranch}` : ""}`, 220) : undefined}
                c={{
                  code: previewCode || null, clientName: form.clientName, computerName: form.computerName, date: form.date,
                  technician: form.technician, notes: form.notes, licenses: certLicenses(form),
                  branchName: branches.find(b => b.id === activeBranch)?.name || user?.branchName || null,
                }} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
