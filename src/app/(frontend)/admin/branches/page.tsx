"use client";
import { Ban, CircleCheck, Clock, Link2, MapPin, MapPinned, Pencil, Smartphone, Store, Trash2, TriangleAlert, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { parseLocation, isShortMapsLink, mapEmbedUrl, branchLatLng, fmtLatLng, directionsUrl } from "@/shared/geo";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { HOURS_DAYS, DEFAULT_HOURS, parseHours, type BranchHours, type HoursDay, type HoursSlot } from "@/shared/hours";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton, PageSkeleton } from "@/frontend/components/Skeletons";

interface Branch { id: string; name: string; address: string | null; phone: string | null; latitude: number | null; longitude: number | null; hours?: string | null; active: boolean; createdAt: string; _count: { users: number; repairs: number }; }

export default function AdminBranchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [, setAllBranches] = useState<{id:string;name:string}[]>([]);
  const [, setActiveBranchState] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formHours, setFormHours] = useState<BranchHours>(DEFAULT_HOURS);
  const setDay = (d: HoursDay, slot: HoursSlot | null) => setFormHours((h) => ({ ...h, [d]: slot }));
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);


  async function loadData() {
    try {
      const res = await apiFetch("/api/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        setAllBranches(data.map((b: Branch) => ({ id: b.id, name: b.name })));
        const ab = sessionStorage.getItem("activeBranchId");
        if (ab) setActiveBranchState(ab);
        else if (data.length > 0) { setActiveBranchState(data[0].id); setActiveBranchId(data[0].id); }
      }
    } catch {} setLoading(false);
  }
  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    loadData();
  }, [router]);
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["Branch", "User", "Repair"], () => loadData());

  const resetForm = () => { setFormName(""); setFormAddress(""); setFormPhone(""); setFormLocation(""); setFormHours(DEFAULT_HOURS); setEditId(null); };

  const handleSubmit = async () => {
    if (!formName || saving) return;
    const body = { name: formName, address: formAddress || null, phone: formPhone || null, location: formLocation.trim(), hours: formHours };
    setSaving(true);
    try {
      const res = editId
        ? await apiFetch("/api/branches", { method: "PATCH", body: JSON.stringify({ id: editId, ...body }) })
        : await apiFetch("/api/branches", { method: "POST", body: JSON.stringify(body) });
      if (res.ok) {
        sileo.success({ title: editId ? "Sucursal actualizada" : "Sucursal creada" });
        setShowForm(false); resetForm(); loadData();
      } else { const d = await res.json(); sileo.error({ title: `${d.error}` }); }
    } catch { sileo.error({ title: "Error de conexión" }); }
    setSaving(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { sileo.error({ title: "Este navegador no permite obtener la ubicación" }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); setLocating(false); if (pos.coords.accuracy > 100) sileo.warning({ title: `Ubicación aproximada (±${Math.round(pos.coords.accuracy)} m): revísala en el mapa` }); },
      (err) => { setLocating(false); sileo.error({ title: err.code === 1 ? "Permiso de ubicación denegado: actívalo en el navegador" : "No se pudo obtener la ubicación" }); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const startEdit = (b: Branch) => { setEditId(b.id); setFormName(b.name); setFormAddress(b.address || ""); setFormPhone(b.phone || ""); const p = branchLatLng(b); setFormLocation(p ? fmtLatLng(p) : ""); setFormHours(parseHours(b.hours) || DEFAULT_HOURS); setShowForm(true); };

  const handleDelete = async (b: Branch) => {
    if (!await askConfirm(`¿Desactivar sucursal "${b.name}"? Los datos se conservarán.`)) return;
    try {
      const res = await apiFetch("/api/branches", { method: "DELETE", body: JSON.stringify({ id: b.id }) });
      if (res.ok) { sileo.success({ title: "Sucursal desactivada" }); loadData(); }
    } catch {}
  };


  if (!user) return <PageSkeleton />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media(max-width:768px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{margin-left:0!important;padding-top:72px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
        }
        .form-input { width: 100%; padding: 10px 14px; background: #ffffff; border: 1px solid var(--border); border-radius: 10px; color:#1e2a3a; font-size: 13px; outline: none; }
        .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-bright-rgb), 0.12); background: #ffffff; }
      `}</style>

      <AppSidebar user={user} />

      {/* MAIN */}
      <main className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Gestión de sucursales</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{branches.length} sucursales activas</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>＋ Nueva Sucursal</button>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {branches.map(b => (
              <div key={b.id} style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", padding: "22px 20px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(var(--accent-bright-rgb), 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><Store size={22} strokeWidth={STROKE} aria-hidden="true" /></div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{b.name}</div>
                      {b.address && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> {b.address}</div>}
                      {(() => { const p = branchLatLng(b); return p
                        ? <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "var(--accent-dim)", padding: "10px 8px", margin: "-6px -8px -10px", textDecoration: "none" }}><MapPinned size={14} strokeWidth={STROKE} aria-hidden="true" /> Ver en el mapa</a>
                        : <div style={{ fontSize: 11, fontWeight: 600, color: "var(--warn)", marginTop: 4 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Sin ubicación en el mapa</div>; })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(b)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.08)", color: "var(--accent-dim)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    <button onClick={() => handleDelete(b)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "var(--danger-bright)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{b._count.users}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Usuarios</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ok)" }}>{b._count.repairs}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Órdenes</div>
                  </div>
                  {b.phone && (
                    <div style={{ flex: 1, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{b.phone}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Form Modal */}
      {showForm && (
        <FormModal icon={editId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <Store size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={() => { setShowForm(false); resetForm(); }}
          title={editId ? "Editar sucursal" : "Nueva sucursal"}
          subtitle={formName || "Cada sucursal tiene sus órdenes, caja e inventario"}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
            <SaveButton onClick={handleSubmit} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear sucursal"}</SaveButton>
          </>}>
          <FormSection icon={<Store size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Datos">
            <Field label="Nombre" required><input className="ox-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Sucursal Centro" /></Field>
            <div className="ox-row" style={{ marginTop: 12 }}>
              <Field label="Dirección" hint="Opcional"><input className="ox-input" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Calle, número, zona" /></Field>
              <Field label="Teléfono" hint="Opcional"><input className="ox-input" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="70012345" inputMode="tel" /></Field>
            </div>
          </FormSection>
          <FormSection icon={<Clock size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Horario de atención" hint="El cliente lo ve en su seguimiento">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {HOURS_DAYS.map((d) => {
                const slot = formHours[d.key];
                return (
                  <div key={d.key} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) auto", gap: 10, alignItems: "center" }}>
                    <button type="button" className="ox-chip" aria-pressed={!!slot} onClick={() => setDay(d.key, slot ? null : (DEFAULT_HOURS[d.key] || { from: "09:00", to: "13:00" }))} style={{ justifyContent: "flex-start" }}>
                      <span className="e" aria-hidden="true">{slot ? <CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Ban size={18} strokeWidth={STROKE} aria-hidden="true" />}</span>{d.label}
                    </button>
                    {slot ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input className="ox-input" type="time" value={slot.from} onChange={(e) => setDay(d.key, { ...slot, from: e.target.value })} aria-label={`${d.label}: abre`} style={{ width: 118 }} />
                        <span style={{ color: "var(--text-muted)" }}>a</span>
                        <input className="ox-input" type="time" value={slot.to} onChange={(e) => setDay(d.key, { ...slot, to: e.target.value })} aria-label={`${d.label}: cierra`} style={{ width: 118 }} />
                      </div>
                    ) : <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>Cerrado</span>}
                  </div>
                );
              })}
            </div>
            <p className="ox-hint" style={{ marginTop: 10 }}>Toca el día para marcarlo abierto o cerrado. Con esto el cliente ve «Abierto ahora» en su seguimiento.</p>
          </FormSection>
          <FormSection icon={<MapPinned size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Ubicación en el mapa" hint="Opcional">
            <div style={{ display: "flex", gap: 8 }}>
              <input className="ox-input" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Enlace de Google Maps o coordenadas" aria-label="Ubicación" />
              {formLocation && <button type="button" className="ox-ghost" onClick={() => setFormLocation("")} aria-label="Quitar ubicación" style={{ width: 46, height: 46, marginTop: 0, flexShrink: 0 }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>}
            </div>
            <button type="button" className="ox-ghost" onClick={useMyLocation} disabled={locating} style={{ marginTop: 10, borderStyle: "dashed", color: "var(--accent-ink)" }}>
              {locating ? "Obteniendo ubicación…" : "Usar mi ubicación actual (si estás en la sucursal)"}
            </button>
            {(() => {
              const t = formLocation.trim();
              const p = parseLocation(t);
              if (p) return (
                <iframe title="Vista previa de la ubicación" src={mapEmbedUrl(p, 17)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  style={{ marginTop: 12, width: "100%", height: 190, border: "1px solid var(--border)", borderRadius: 12 }} />
              );
              if (t && isShortMapsLink(t)) return <div className="ox-note info" style={{ marginTop: 12 }}><Link2 size={14} strokeWidth={STROKE} aria-hidden="true" /> Enlace de Google Maps: la ubicación se leerá al guardar.</div>;
              if (t) return <div className="ox-note warn" style={{ marginTop: 12 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> No reconozco ese formato. Pega el enlace de Google Maps o las coordenadas (ej. -17.3935, -66.1570).</div>;
              return <p className="ox-hint" style={{ marginTop: 10, lineHeight: 1.5 }}>En Google Maps busca tu local → <b>Compartir</b> → <b>Copiar vínculo</b> y pégalo aquí. También sirven las coordenadas (mantén presionado el punto en el mapa).</p>;
            })()}
          </FormSection>
        </FormModal>
      )}

    </div>
  );
}
