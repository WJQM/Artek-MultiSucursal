"use client";
import { ArrowDown, ArrowDownUp, ArrowUp, Banknote, Briefcase, ChartColumn, HandCoins, Lightbulb, Lock, Pin, Plus, Scale, Trash2, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { AppIcon } from "@/frontend/components/icons";
import DaySummary from "@/frontend/components/DaySummary";
import { CashClosing } from "@/frontend/components/CashClosing";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { FormModal, FormSection, Field } from "@/frontend/components/FormKit";
import { SaveButton } from "@/frontend/components/Motion";
import { Pagination, usePaged } from "@/frontend/components/Pagination";
import { askConfirm } from "@/frontend/lib/dialog";
import { StatsSkeleton } from "@/frontend/components/Skeletons";

interface Movement {
  id: string; type: string; category: string; amount: number; description: string; notes: string | null;
  createdByName: string | null; createdAt: string;
}

const CAT_ICON: Record<string, AppIcon> = { repuestos: Wrench, servicios: Lightbulb, pagos: Briefcase, ventas: Banknote, otros_ing: Plus, ajuste: Scale, otros: Pin };
/** Ícono de línea de la categoría del movimiento. */
function CatIcon({ value, size = 18 }: { value: string; size?: number }) {
  const I = CAT_ICON[value] || Pin;
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}
const CATEGORIES: { value: string; label: string; type: "income" | "expense" | "both" }[] = [
  { value: "repuestos", label: "Compra de repuestos", type: "expense" },
  { value: "servicios", label: "Pago de servicios", type: "expense" },
  { value: "pagos", label: "Pagos / Sueldos", type: "expense" },
  { value: "ventas", label: "Venta directa", type: "income" },
  { value: "otros_ing", label: "Otros ingresos", type: "income" },
  { value: "ajuste", label: "Ajuste de caja", type: "both" },
  { value: "otros", label: "Otros", type: "both" },
];

export default function CashPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [, setActiveBranch] = useState<string>("");

  type Totals = { income: number; expense: number; balance: number };
  const [data, setData] = useState<{ movements: Movement[]; summary?: { totalIncome: number; totalExpense: number; balance: number }; today?: Totals; month?: Totals } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [formCat, setFormCat] = useState("repuestos");
  const [formAmount, setFormAmount] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");


  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch("/api/cash");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(userData); } catch { return null; } })(); setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    if (u.role === "tech") { router.push("/asignaciones"); return; }  
    if (u.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(u.branchId || ""); }
    load();
  }, [router]);
  // Se actualiza sola (sin pantalla de carga) cuando otra PC cambia estos datos
  useLiveRefresh(["CashMovement"], () => load(true));

  const submitMovement = async () => {
    if (saving) return;
    if (!formAmount || Number(formAmount) <= 0) { sileo.error("Monto inválido"); return; }
    if (!formDesc.trim()) { sileo.error("Descripción requerida"); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, category: formCat, amount: Number(formAmount), description: formDesc.trim(), notes: formNotes.trim() || null }),
      });
      if (res.ok) {
        sileo.success("Movimiento registrado");
        setShowForm(false); setFormAmount(""); setFormDesc(""); setFormNotes("");
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        sileo.error(err.error || "Error al guardar");
      }
    } catch { sileo.error("Error de red"); }
    setSaving(false);
  };

  const deleteMovement = async (id: string) => {
    if (!await askConfirm("¿Eliminar este movimiento?")) return;
    try {
      const res = await apiFetch(`/api/cash?id=${id}`, { method: "DELETE" });
      if (res.ok) { sileo.success("Eliminado"); load(); } else { sileo.error("Error al eliminar"); }
    } catch { sileo.error("Error de red"); }
  };

  const fmtBs = (n: number) => `Bs. ${(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filteredMov: Movement[] = data?.movements?.filter((m: Movement) => filterType === "all" || m.type === filterType) || [];
  // 20 movimientos por página (antes se mostraban los 500 de una vez)
  const paged = usePaged(filteredMov, 20, filterType);

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        /* Celular: botones debajo del título y totales de 2 en 2 (Filtro actual a todo el ancho) */
        @media(max-width:640px){
          .cash-head{flex-direction:column;align-items:stretch!important}
          .cash-actions{display:grid!important;grid-template-columns:1fr 1fr}
          .cash-actions button{height:44px;padding:0 10px!important}
          .cash-actions .cash-new{grid-column:1 / -1;order:-1}
          .main-content .cards-3{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .cards-3 > div{padding:12px!important}
          .cards-3 > div:last-child{grid-column:1 / -1}
          .cards-3 .cash-io{flex-direction:column;gap:4px!important}
          .cards-3 > div > div:last-child > div:last-child{font-size:16px!important;overflow-wrap:anywhere}
        }
      `}</style>

      <AppSidebar user={user} />
      {showSummary && <DaySummary onClose={() => setShowSummary(false)} />}
      {showClosing && <CashClosing onClose={() => setShowClosing(false)} />}

      {/* MAIN */}
      <div className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div className="cash-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Caja chica</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Registro de ingresos y egresos de la sucursal</p>
          </div>
          <div className="cash-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => setShowClosing(true)} style={{ padding: "10px 16px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Lock size={14} strokeWidth={STROKE} aria-hidden="true" /> Cierre de caja</button>
            <button onClick={() => setShowSummary(true)} style={{ padding: "10px 16px", background: "var(--brand-dark)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><ChartColumn size={14} strokeWidth={STROKE} aria-hidden="true" /> Resumen del día</button>
            <button className="cash-new" onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "var(--ok)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Plus size={14} strokeWidth={STROKE} aria-hidden="true" /> Nuevo movimiento</button>
          </div>
        </div>

        {loading ? (
          <StatsSkeleton />
        ) : (
          <>
            {/* Resúmenes */}
            <div className="cards-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Hoy", data: data?.today, color: "#0e7c86" },
                { label: "Este mes", data: data?.month, color: "#1d4ed8" },
                { label: "Filtro actual", data: { income: data?.summary?.totalIncome || 0, expense: data?.summary?.totalExpense || 0, balance: data?.summary?.balance || 0 }, color: "#047857" },
              ].map(c => (
                <div key={c.label} style={{ padding: 18, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{c.label}</span>
                  </div>
                  <div className="cash-io" style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 11 }}>
                    <div><div style={{ color: "var(--ok)", fontWeight: 600 }}>↑ Ingresos</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>{fmtBs(c.data?.income || 0)}</div></div>
                    <div><div style={{ color: "var(--danger-bright)", fontWeight: 600 }}>↓ Egresos</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger-bright)" }}>{fmtBs(c.data?.expense || 0)}</div></div>
                  </div>
                  <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Saldo</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: (c.data?.balance || 0) >= 0 ? c.color : "var(--danger-bright)" }}>{fmtBs(c.data?.balance || 0)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[
                { k: "all" as const, l: "Todos", c: "#0e7c86" },
                { k: "income" as const, l: "Ingresos", c: "#10b981" },
                { k: "expense" as const, l: "Egresos", c: "#dc2626" },
              ].map(f => (
                <button key={f.k} onClick={() => setFilterType(f.k)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: filterType === f.k ? `${f.c}15` : "var(--bg-card)", border: `1px solid ${filterType === f.k ? f.c + "40" : "var(--border)"}`, color: filterType === f.k ? f.c : "var(--text-muted)" }}>{f.l}</button>
              ))}
            </div>

            {/* Lista */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              {filteredMov.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No hay movimientos registrados</div>
              ) : (
                paged.items.map((m: Movement) => {
                  const cat = CATEGORIES.find(c => c.value === m.category);
                  const isIncome = m.type === "income";
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: isIncome ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)", color: isIncome ? "var(--ok-bright)" : "var(--danger-bright)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat ? <CatIcon value={cat.value} /> : isIncome ? <ArrowUp size={18} strokeWidth={STROKE} aria-hidden="true" /> : <ArrowDown size={18} strokeWidth={STROKE} aria-hidden="true" />}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.description}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          <span style={{ color: isIncome ? "var(--ok-bright)" : "var(--danger-bright)", fontWeight: 700 }}>{cat?.label || m.category}</span>
                          {m.createdByName && <span> · {m.createdByName}</span>}
                          <span> · {new Date(m.createdAt).toLocaleDateString("es-BO", { hourCycle: "h23", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {m.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>{m.notes}</div>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: isIncome ? "var(--ok-bright)" : "var(--danger-bright)", flexShrink: 0 }}>{isIncome ? "+" : "-"} {fmtBs(m.amount)}</div>
                      <button onClick={() => deleteMovement(m.id)} aria-label="Eliminar movimiento" style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "rgba(239,68,68,0.06)", color: "var(--danger-bright)", cursor: "pointer", fontSize: 14 }} title="Eliminar"><Trash2 size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                    </div>
                  );
                })
              )}
            </div>
            <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} />
          </>
        )}
      </div>

      {/* MODAL NUEVO MOVIMIENTO */}
      {showForm && (
        <FormModal icon={formType === "income" ? <Banknote size={24} strokeWidth={STROKE} aria-hidden="true" /> : <HandCoins size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={() => setShowForm(false)}
          title="Nuevo movimiento de caja"
          subtitle={formType === "income" ? "Dinero que entra" : "Dinero que sale"}
          footer={<>
            <button type="button" className="ox-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <SaveButton onClick={submitMovement} disabled={saving}>{saving ? "Guardando…" : formType === "income" ? "Guardar ingreso" : "Guardar egreso"}</SaveButton>
          </>}>
          <FormSection icon={<ArrowDownUp size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Tipo">
            <div className="ox-chips" role="group" aria-label="Tipo">
              <button type="button" className="ox-chip" aria-pressed={formType === "income"} onClick={() => { setFormType("income"); setFormCat("ventas"); }} style={formType === "income" ? { borderColor: "#047857", background: "#f0fdf4", color: "#047857" } : undefined}><span className="e" aria-hidden="true"><ArrowUp size={18} strokeWidth={STROKE} /></span>Ingreso</button>
              <button type="button" className="ox-chip" aria-pressed={formType === "expense"} onClick={() => { setFormType("expense"); setFormCat("repuestos"); }} style={formType === "expense" ? { borderColor: "#b91c1c", background: "#fef2f2", color: "#b91c1c" } : undefined}><span className="e" aria-hidden="true"><ArrowDown size={18} strokeWidth={STROKE} /></span>Egreso</button>
            </div>
            <span className="ox-label" style={{ marginTop: 14 }}>Categoría</span>
            <div className="ox-chips" role="group" aria-label="Categoría">
              {CATEGORIES.filter(c => c.type === formType || c.type === "both").map(c => <button key={c.value} type="button" className="ox-chip" aria-pressed={formCat === c.value} onClick={() => setFormCat(c.value)}><span className="e" aria-hidden="true"><CatIcon value={c.value} /></span>{c.label}</button>)}
            </div>
          </FormSection>
          <FormSection icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Monto y detalle">
            <Field label="Monto (Bs.)" required><input className="ox-input tabular" type="number" step="0.01" min="0" inputMode="decimal" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} style={{ fontSize: 22, fontWeight: 700, height: 56 }} /></Field>
            <Field label="Descripción" style={{ marginTop: 12 }}><input className="ox-input" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} /></Field>
            <Field label="Notas" hint="Opcional" style={{ marginTop: 12 }}><textarea className="ox-input" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} /></Field>
          </FormSection>
        </FormModal>
      )}
    </div>
  );
}
