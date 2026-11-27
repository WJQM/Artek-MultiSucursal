"use client";
import { ArrowRightLeft, Ban, Camera, CircleCheck, Hourglass, IdCard, KeyRound, LogOut, Pencil, ShieldCheck, Smartphone, Star, Store, Trash2, User, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { sileo } from "@/frontend/lib/toast";
import { Pagination, usePaged } from "@/frontend/components/Pagination";
import { PasswordInput } from "@/frontend/components/PasswordInput";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton, PageSkeleton } from "@/frontend/components/Skeletons";

interface User { id: string; name: string; email: string; role: string; status: string; phone: string | null; phoneVerified?: boolean; totpEnabled?: boolean; mustChangePassword?: boolean; image: string | null; branchId: string | null; branch: { id: string; name: string } | null; createdAt: string; }
interface Branch { id: string; name: string; }

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Super Admin", color: "#b45309" },
  admin: { label: "Administrador", color: "#0e7c86" },
  tech: { label: "Técnico", color: "#047857" },
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [, setActiveBranchState] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("admin");
  const [formPhone, setFormPhone] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formImagePreview, setFormImagePreview] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  // Transfer
  const [showTransfer, setShowTransfer] = useState<User | null>(null);
  const [transferBranchId, setTransferBranchId] = useState("");


  async function loadData() { try { const res = await apiFetch("/api/users"); if (res.ok) setUsers(await res.json()); } catch {} setLoading(false); }
  useEffect(() => {
    const userData = sessionStorage.getItem("user"); const token = sessionStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (parsed.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(parsed); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    loadData();
    apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranchState(ab); else if (b.length > 0) { setActiveBranchState(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
  }, [router]);
  // Se actualiza sola cuando otra PC cambia estos datos
  useLiveRefresh(["User", "Branch"], () => loadData());

  const resetForm = () => { setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("admin"); setFormPhone(""); setFormBranchId(""); setFormImage(""); setFormImagePreview(""); setEditId(null); };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploadingImg(true);
    const fd = new FormData(); fd.append("file", file);
    try { const res = await apiFetch("/api/upload", { method: "POST", body: fd }); const d = await res.json(); if (d.url) { setFormImage(d.url); setFormImagePreview(URL.createObjectURL(file)); } } catch {}
    setUploadingImg(false);
  };

  const handleSubmit = async () => {
    if (!formName || !formEmail || (!editId && !formPassword)) return;
    if ((formRole === "admin" || formRole === "tech") && !formBranchId) { sileo.error({ title: "Selecciona una sucursal" }); return; }
    const body: { name: string; email: string; role: string; phone: string | null; branchId: string | null; image: string | null; password?: string } = { name: formName, email: formEmail, role: formRole, phone: formPhone || null, branchId: formRole === "superadmin" ? null : formBranchId, image: formImage || null };
    if (formPassword) body.password = formPassword;
    try {
      const res = editId ? await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: editId, ...body }) }) : await apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
      if (res.ok) { sileo.success({ title: editId ? "Usuario actualizado" : "Usuario creado" }); setShowForm(false); resetForm(); loadData(); } else { const d = await res.json(); sileo.error({ title: `${d.error}` }); }
    } catch { sileo.error({ title: "Error de conexión" }); }
  };

  const startEdit = (u: User) => { setEditId(u.id); setFormName(u.name); setFormEmail(u.email); setFormPassword(""); setFormRole(u.role); setFormPhone(u.phone || ""); setFormBranchId(u.branchId || ""); setFormImage(u.image || ""); setFormImagePreview(u.image || ""); setShowForm(true); };
  const handleDelete = async (u: User) => { if (!await askConfirm(`¿Eliminar a ${u.name}?`)) return; try { const res = await apiFetch("/api/users", { method: "DELETE", body: JSON.stringify({ id: u.id }) }); if (res.ok) { sileo.success({ title: "Eliminado" }); loadData(); } else { const d = await res.json(); sileo.error({ title: `${d.error}` }); } } catch {} };
  const handleApprove = async (u: User) => { try { const res = await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: u.id, status: "active" }) }); if (res.ok) { sileo.success({ title: `${u.name} aprobado` }); loadData(); } } catch {} };
  const handleReject = async (u: User) => { if (!await askConfirm(`¿Rechazar a ${u.name}?`)) return; try { await apiFetch("/api/users", { method: "DELETE", body: JSON.stringify({ id: u.id }) }); sileo.error({ title: "Rechazado" }); loadData(); } catch {} };
  const handleSuspend = async (u: User) => { const s = u.status === "suspended" ? "active" : "suspended"; try { const res = await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: u.id, status: s }) }); if (res.ok) { sileo.success({ title: s === "active" ? "Reactivado" : "Suspendido" }); loadData(); } } catch {} };
  // Seguridad: contraseña temporal, restablecer app autenticadora, cerrar sesiones
  const [tempPw, setTempPw] = useState<{ name: string; password: string; sent: boolean } | null>(null);
  const securityAction = async (u: User, action: "temp_password" | "reset_2fa" | "logout_all") => {
    const msgs = {
      temp_password: `¿Generar una contraseña temporal para ${u.name}? Se cerrarán sus sesiones y deberá elegir una nueva al entrar.`,
      reset_2fa: `¿Quitar la app autenticadora y los códigos de respaldo de ${u.name}? (por ejemplo, si perdió el celular). Volverá a usar el PIN por WhatsApp.`,
      logout_all: `¿Cerrar todas las sesiones abiertas de ${u.name}?`,
    };
    if (!await askConfirm(msgs[action])) return;
    const sendWhatsApp = action === "temp_password" && !!u.phone && await askConfirm(`¿Enviarle la contraseña temporal por WhatsApp al ${u.phone}?`);
    try {
      const res = await apiFetch("/api/users/security", { method: "POST", body: JSON.stringify({ id: u.id, action, sendWhatsApp }) });
      const d = await res.json();
      if (!res.ok) { sileo.error({ title: d.error || "Error" }); return; }
      if (action === "temp_password") setTempPw({ name: u.name, password: d.tempPassword, sent: d.sentWhatsApp });
      else sileo.success({ title: action === "reset_2fa" ? "Doble verificación restablecida" : "Sesiones cerradas" });
      loadData();
    } catch { sileo.error({ title: "Error de conexión" }); }
  };

  const handleTransfer = async () => { if (!showTransfer || !transferBranchId) return; try { const res = await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: showTransfer.id, branchId: transferBranchId }) }); if (res.ok) { sileo.info({ title: `Transferido` }); setShowTransfer(null); loadData(); } } catch {} };

  const filtered = users.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  const pendingUsers = filtered.filter(u => u.status === "pending");
  const activeUsers = filtered.filter(u => u.status !== "pending");
  const paged = usePaged(activeUsers, 10, `${filterRole}|${searchQuery}`);

  const UserCard = ({ u, isPending }: { u: User; isPending?: boolean }) => {
    const r = ROLE_LABELS[u.role] || { label: u.role, color: "#888" };
    const isSuspended = u.status === "suspended";
    return (
      <div className="user-card" style={{ background: "var(--bg-card)", borderRadius: 12, border: isPending ? "2px solid rgba(245,158,11,0.3)" : isSuspended ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border)", display: "flex", overflow: "hidden", opacity: isSuspended ? 0.6 : 1 }}>
        {/* Photo */}
        <div className="user-photo" style={{ width: 96, minWidth: 96, padding: "16px 0 0", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          <div className="user-avatar" style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2.5px solid ${r.color}`, boxShadow: "0 2px 8px rgba(26,29,46,0.10)", background: `${r.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {u.image
              ? <img loading="lazy" decoding="async" src={u.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%", display: "block" }} />
              : <span style={{ fontSize: 22, fontWeight: 700, color: r.color, letterSpacing: -1 }}>{u.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>
            }
          </div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          {/* Row 1: name + actions */}
          <div className="user-row1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
            </div>
            {isPending ? (
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <button onClick={() => handleApprove(u)} style={{ padding: "6px 12px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, color: "var(--ok)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Aprobar</button>
                <button onClick={() => handleReject(u)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--danger-bright)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
              </div>
            ) : (
              <div className="user-actions" style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => startEdit(u)} title="Editar" style={btnStyle("var(--accent)")}><Pencil size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">Editar</span></button>
                {u.role !== "superadmin" && <button onClick={() => { setShowTransfer(u); setTransferBranchId(""); }} title="Transferir" style={btnStyle("#10b981")}><ArrowRightLeft size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">Transferir</span></button>}
                {u.role !== "superadmin" && <button onClick={() => handleSuspend(u)} title={isSuspended ? "Reactivar" : "Suspender"} style={btnStyle(isSuspended ? "#10b981" : "#f59e0b")}>{isSuspended ? <CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Ban size={18} strokeWidth={STROKE} aria-hidden="true" />}<span className="ua-lbl">{isSuspended ? "Reactivar" : "Suspender"}</span></button>}
                {u.id !== user?.id && <button onClick={() => securityAction(u, "temp_password")} title="Contraseña temporal" style={btnStyle("#2563eb")}><KeyRound size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">Clave</span></button>}
                {u.totpEnabled && u.id !== user?.id && <button onClick={() => securityAction(u, "reset_2fa")} title="Restablecer app autenticadora" style={btnStyle("#0f766e")}><ShieldCheck size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">App</span></button>}
                {u.id !== user?.id && <button onClick={() => securityAction(u, "logout_all")} title="Cerrar todas sus sesiones" style={btnStyle("#5a6a80")}><LogOut size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">Sesiones</span></button>}
                <button onClick={() => handleDelete(u)} title="Eliminar" style={btnStyle("#dc2626")}><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="ua-lbl">Eliminar</span></button>
              </div>
            )}
          </div>
          {/* Row 2: badges */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.color, padding: "2px 8px", borderRadius: 6, background: `${r.color}12`, border: `1px solid ${r.color}22`, whiteSpace: "nowrap" }}>{r.label}</span>
            {u.branch && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", padding: "2px 8px", borderRadius: 6, background: "var(--bg-tertiary)", border: "1px solid var(--border)", whiteSpace: "nowrap" }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {u.branch.name}</span>}
            {isSuspended && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger-bright)", padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.08)", whiteSpace: "nowrap" }}><Ban size={14} strokeWidth={STROKE} aria-hidden="true" /> Suspendido</span>}
            {u.phone && <span title="Celular verificado por WhatsApp" style={{ fontSize: 11, fontWeight: 700, color: u.phoneVerified ? "var(--ok)" : "var(--warn)", padding: "2px 8px", borderRadius: 6, background: u.phoneVerified ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.1)", whiteSpace: "nowrap" }}>{u.phoneVerified ? "✓ Celular verificado" : "Celular sin verificar"}</span>}
            {u.totpEnabled && <span style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", padding: "2px 8px", borderRadius: 6, background: "rgba(15,118,110,0.08)", whiteSpace: "nowrap" }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> App autenticadora</span>}
            {u.mustChangePassword && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", padding: "2px 8px", borderRadius: 6, background: "rgba(99,102,241,0.08)", whiteSpace: "nowrap" }}><KeyRound size={14} strokeWidth={STROKE} aria-hidden="true" /> Contraseña temporal</span>}
          </div>
          {/* Row 3: phone */}
          {u.phone && <div style={{ fontSize: 11, color: "var(--text-muted)" }}><Smartphone size={14} strokeWidth={STROKE} aria-hidden="true" /> {u.phone}</div>}
        </div>
      </div>
    );
  };

  if (!user) return <PageSkeleton />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`
        .sidebar-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted);transition: .15s; transition-property: var(--tr-ui);text-align:left}
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover{background:rgba(99,102,241,.06);color:var(--text-secondary)} }
        .sidebar-btn.active{background:rgba(99,102,241,.12);color:var(--accent)}
        .sidebar-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .form-input{width:100%;padding:10px 14px;background:#ffffff;border:1px solid var(--border);border-radius:10px;color:#1e2a3a;font-size:13px;outline:none}
        .form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-bright-rgb), 0.12);background:#ffffff}
        @media(max-width:768px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{margin-left:0!important;padding-top:72px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          .users-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      <AppSidebar user={user} />

      {/* MAIN */}
      <main className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Gestión de usuarios</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              {users.length} usuarios{pendingUsers.length > 0 && <span style={{ color: "var(--warn)", fontWeight: 700 }}> • {pendingUsers.length} pendiente{pendingUsers.length > 1 ? "s" : ""}</span>}
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>＋ Nuevo Usuario</button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input aria-label="Buscar usuario" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
          {["all", "superadmin", "admin", "tech"].map(r => (
            <button key={r} onClick={() => setFilterRole(r)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid", borderColor: filterRole === r ? "var(--accent)" : "var(--border)", background: filterRole === r ? "rgba(var(--accent-bright-rgb), 0.07)" : "var(--bg-card)", color: filterRole === r ? "var(--accent-dim)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {r === "all" ? "Todos" : ROLE_LABELS[r]?.label || r}
            </button>
          ))}
        </div>

        {/* Pending Section */}
        {pendingUsers.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}><Hourglass size={18} strokeWidth={STROKE} aria-hidden="true" /></span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--warn)" }}>Solicitudes Pendientes</h2>
              <span style={{ padding: "2px 10px", borderRadius: 12, background: "rgba(245,158,11,0.15)", color: "var(--warn)", fontSize: 12, fontWeight: 700 }}>{pendingUsers.length}</span>
            </div>
            <div className="users-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
              {(pendingUsers || []).map(u => <UserCard key={u.id} u={u} isPending />)}
            </div>
          </div>
        )}

        {/* Active Users */}
        {loading ? (
          <ListSkeleton />
        ) : (
          <><div className="users-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
            {paged.items.map(u => <UserCard key={u.id} u={u} />)}
          </div>
          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></>
        )}
      </main>

      {/* Form Modal */}
      {showForm && (
        <FormModal icon={editId ? <Pencil size={24} strokeWidth={STROKE} aria-hidden="true" /> : <User size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={() => { setShowForm(false); resetForm(); }}
          title={editId ? "Editar usuario" : "Nuevo usuario"}
          subtitle={formName || "Personas que entran al sistema"}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
            <SaveButton onClick={handleSubmit}>{editId ? "Guardar cambios" : "Crear usuario"}</SaveButton>
          </>}>
          <FormSection icon={<IdCard size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Datos">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--accent-bg)", border: "1.5px dashed #9fd3d8", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                {formImagePreview ? <img src={formImagePreview} alt="Foto del usuario" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 26 }} aria-hidden="true"><User size={26} strokeWidth={STROKE} aria-hidden="true" /></span>}
              </div>
              <label className="ox-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "auto", height: 42, padding: "0 16px", marginTop: 0, cursor: "pointer" }}>
                <Camera size={14} strokeWidth={STROKE} aria-hidden="true" /> {uploadingImg ? "Subiendo…" : formImagePreview ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} style={{ display: "none" }} />
              </label>
              {formImagePreview && <button type="button" className="ox-ghost" onClick={() => { setFormImage(""); setFormImagePreview(""); }} style={{ width: "auto", height: 42, padding: "0 14px", marginTop: 0, color: "var(--danger)" }}>Quitar</button>}
            </div>
            <div className="ox-row">
              <Field label="Nombre" required><input className="ox-input" value={formName} onChange={e => setFormName(e.target.value)} /></Field>
              <Field label="Celular" hint={formRole === "tech" ? "Opcional" : "Recibe el código de ingreso"}><input className="ox-input" value={formPhone} onChange={e => setFormPhone(e.target.value)} inputMode="tel" /></Field>
              <Field label="Correo" required><input className="ox-input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></Field>
              <Field label={editId ? "Nueva contraseña" : "Contraseña"} hint={editId ? "Déjalo vacío para mantener la actual" : undefined}>
                <PasswordInput className="ox-input" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
              </Field>
            </div>
          </FormSection>
          <FormSection icon={<ShieldCheck size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Rol y sucursal">
            <div className="ox-chips" role="group" aria-label="Rol">
              <button type="button" className="ox-chip" aria-pressed={formRole === "superadmin"} onClick={() => setFormRole("superadmin")}><span className="e" aria-hidden="true"><Star size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Super admin</button>
              <button type="button" className="ox-chip" aria-pressed={formRole === "admin"} onClick={() => setFormRole("admin")}><span className="e" aria-hidden="true"><User size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Administrador</button>
              <button type="button" className="ox-chip" aria-pressed={formRole === "tech"} onClick={() => setFormRole("tech")}><span className="e" aria-hidden="true"><Wrench size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Técnico</button>
            </div>
            {(formRole === "admin" || formRole === "tech") && (<>
              <span className="ox-label" style={{ marginTop: 14 }}>Sucursal <span className="req">*</span></span>
              <div className="ox-chips" role="group" aria-label="Sucursal">
                {branches.map(b => <button key={b.id} type="button" className="ox-chip" aria-pressed={formBranchId === b.id} onClick={() => setFormBranchId(b.id)}><span className="e" aria-hidden="true"><Store size={14} strokeWidth={STROKE} aria-hidden="true" /></span>{b.name}</button>)}
              </div>
            </>)}
          </FormSection>
        </FormModal>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <FormModal icon={<ArrowRightLeft size={18} strokeWidth={STROKE} aria-hidden="true" />} onClose={() => setShowTransfer(null)} title="Transferir usuario" subtitle={`${showTransfer.name} · ahora en ${showTransfer.branch?.name || "ninguna sucursal"}`}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => setShowTransfer(null)}>Cancelar</button>
            <SaveButton onClick={handleTransfer} disabled={!transferBranchId}><ArrowRightLeft size={14} strokeWidth={STROKE} aria-hidden="true" /> Transferir</SaveButton>
          </>}>
          <FormSection icon={<Store size={18} strokeWidth={STROKE} aria-hidden="true" />} title="¿A qué sucursal pasa?">
            <div className="ox-chips" role="group" aria-label="Nueva sucursal">
              {branches.filter(b => b.id !== showTransfer.branchId).map(b => <button key={b.id} type="button" className="ox-chip" aria-pressed={transferBranchId === b.id} onClick={() => setTransferBranchId(b.id)}><span className="e" aria-hidden="true"><Store size={14} strokeWidth={STROKE} aria-hidden="true" /></span>{b.name}</button>)}
            </div>
          </FormSection>
        </FormModal>
      )}

      {/* Toast */}
      {tempPw && (
        <div role="dialog" aria-modal="true" aria-label="Contraseña temporal" data-esc style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}><KeyRound size={32} strokeWidth={STROKE} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Contraseña temporal de {tempPw.name}</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{tempPw.sent ? "También se la enviamos por WhatsApp. " : ""}Solo se muestra una vez. Al entrar deberá elegir una nueva.</p>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, letterSpacing: 2, background: "#f5f7fc", padding: 12, borderRadius: 10, marginBottom: 14, userSelect: "all" }}>{tempPw.password}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => navigator.clipboard?.writeText(tempPw.password).then(() => sileo.success({ title: "Copiada" })).catch(() => {})} style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Copiar</button>
              <button onClick={() => setTempPw(null)} style={{ padding: "10px 16px", border: "1.5px solid var(--border-soft)", borderRadius: 10, background: "#fff", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (color: string): React.CSSProperties => ({
  width: 26, height: 26, borderRadius: 6, background: `${color}12`, border: `1px solid ${color}22`,
  color, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
});
