"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { ListSkeleton } from "@/frontend/components/Skeletons";

interface Row { id: string; name: string; finished: number; active: number; avgTurnaroundH: number | null; avgDiagnosisH: number | null; warranty: number; warrantyRate: number; rating: number | null; ratingCount: number; income: number; partsCost: number; profit: number; deliveredCount: number }
interface Data { rows: Row[]; stages: { status: string; avgH: number | null; samples: number }[] }

const PERIODS = [{ k: "month", l: "Este mes" }, { k: "30", l: "30 días" }, { k: "90", l: "3 meses" }, { k: "365", l: "1 año" }];
const STAGE_LABEL: Record<string, string> = { pending: "Pendiente → Diagnóstico", diagnosed: "Diagnosticado → siguiente paso", waiting_parts: "Esperando repuestos", in_progress: "En progreso → Completado" };
const dur = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round((h / 24) * 10) / 10} días`);
const bs = (n: number) => `Bs. ${n.toLocaleString("es-BO")}`;

export default function RendimientoPage() {
  const router = useRouter();
  // Usuario de la sesión (sin desajuste entre servidor y navegador)
  const rawUser = useSyncExternalStore(noop, () => sessionStorage.getItem("user") || "", () => null);
  const user = useMemo<{ role: string } | null>(() => { try { return rawUser ? JSON.parse(rawUser) : null; } catch { return null; } }, [rawUser]);
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (rawUser === null) return; // todavía en el servidor
    if (!user) router.push("/");
    else if (user.role === "tech") router.push("/asignaciones");
  }, [router, user, rawUser]);
  const load = useCallback(() => {
    apiFetch(`/api/technicians/performance?period=${period}`).then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok) { setData(d); setError(""); } else setError(d.error || "No se pudo cargar"); }).catch(() => setError("Sin conexión"));
  }, [period]);
  useEffect(() => { if (user) load(); }, [user, load]);
  if (!user || user.role === "tech") return null;

  const rows = data?.rows || [];
  const maxStage = Math.max(1, ...(data?.stages || []).map((s) => s.avgH || 0));
  const avgTurn = rows.filter((r) => r.avgTurnaroundH !== null && r.id).map((r) => r.avgTurnaroundH!);
  const teamTurn = avgTurn.length ? avgTurn.reduce((a, b) => a + b, 0) / avgTurn.length : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        @media(max-width:600px){ .main-content{padding:64px 14px 40px!important} }
        .rd-table{display:block} .rd-cards{display:none}
        @media(max-width:860px){ .rd-table{display:none} .rd-cards{display:flex} }
        .rd-table th{font-size: 11px;color:#5a6a80;text-transform:uppercase;letter-spacing:.4px;text-align:right;padding:8px 10px;border-bottom:1.5px solid #cbd5e1;white-space:nowrap}
        .rd-table th:first-child,.rd-table td:first-child{text-align:left}
        .rd-table td{padding:10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;white-space:nowrap}
      `}</style>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Rendimiento por técnico</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4, marginBottom: 14 }}>Órdenes terminadas, cuánto tardan, reingresos por garantía, calificación de los clientes y lo que generaron. {user.role === "superadmin" ? "Sucursal activa." : ""}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {PERIODS.map((p) => <button key={p.k} onClick={() => { if (p.k !== period) { setData(null); setPeriod(p.k); } }} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${period === p.k ? "var(--accent-dim)" : "var(--border-strong)"}`, background: period === p.k ? "var(--accent-bg-soft)" : "#fff", color: period === p.k ? "var(--accent)" : "var(--text-secondary)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{p.l}</button>)}
          </div>
          {error && <div style={{ padding: 14, borderRadius: 12, background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>}
          {!data && !error && <ListSkeleton />}
          {data && !rows.length && <div style={{ padding: 30, textAlign: "center", background: "#fff", borderRadius: 14, border: "1px solid var(--border)", color: "var(--text-muted)" }}>Sin órdenes terminadas en este período.</div>}

          {rows.length > 0 && (
            <>
              <div className="rd-table" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflowX: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th>Técnico</th><th>Terminadas</th><th>En curso</th><th>Ingreso → listo</th><th>Hasta diagnóstico</th><th>Garantía</th><th>Calificación</th><th>Cobrado</th><th>Ganancia</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id || "none"}>
                        <td><b>{r.name}</b></td>
                        <td><b>{r.finished}</b></td>
                        <td>{r.active}</td>
                        <td style={{ color: teamTurn && r.avgTurnaroundH && r.avgTurnaroundH > teamTurn * 1.5 ? "var(--danger-bright)" : undefined }}>{dur(r.avgTurnaroundH)}</td>
                        <td>{dur(r.avgDiagnosisH)}</td>
                        <td style={{ color: r.warrantyRate > 8 ? "var(--danger-bright)" : "var(--ok)" }}>{r.warranty} ({r.warrantyRate}%)</td>
                        <td>{r.rating !== null ? `★ ${r.rating} (${r.ratingCount})` : "—"}</td>
                        <td>{bs(r.income)}</td>
                        <td style={{ color: "var(--ok)", fontWeight: 700 }}>{bs(r.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rd-cards" style={{ flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {rows.map((r) => (
                  <div key={r.id || "none"} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ fontSize: 15 }}>{r.name}</b><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.finished} terminadas · {r.active} en curso</span></div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <Kpi l="Ingreso → listo" v={dur(r.avgTurnaroundH)} bad={!!(teamTurn && r.avgTurnaroundH && r.avgTurnaroundH > teamTurn * 1.5)} />
                      <Kpi l="Garantía" v={`${r.warrantyRate}%`} bad={r.warrantyRate > 8} good={r.warrantyRate <= 8} />
                      <Kpi l="Clientes" v={r.rating !== null ? `${r.rating}` : "—"} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5 }}><span>Cobrado {bs(r.income)}</span><b style={{ color: "var(--ok)" }}>Ganancia {bs(r.profit)}</b></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px", background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 10 }}>Dónde se demoran las órdenes (promedio)</div>
                  {data!.stages.map((s) => (
                    <div key={s.status} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{STAGE_LABEL[s.status]}</span><b>{dur(s.avgH)}</b></div>
                      <div style={{ height: 8, borderRadius: 9, background: "var(--border-soft)", overflow: "hidden", marginTop: 4 }}><div style={{ height: "100%", width: `${((s.avgH || 0) / maxStage) * 100}%`, background: s.status === "waiting_parts" ? "#f97316" : "var(--accent-dim)" }} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: "1 1 320px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 6 }}>Cómo se calcula</div>
                  <b>Terminadas</b>: órdenes que pasaron a Completado en el período. <b>Tiempos</b>: con el historial de estados de cada orden. <b>Garantía</b>: reingresos por garantía de órdenes de ese técnico (en rojo si pasa del 8%). <b>Calificación</b>: reseñas de los clientes. <b>Cobrado y ganancia</b>: órdenes entregadas en el período; ganancia = cobrado − costo de los repuestos (con precio de compra cargado).
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ l, v, bad, good }: { l: string; v: string; bad?: boolean; good?: boolean }) {
  return <div style={{ flex: "1 1 90px", background: "var(--bg-tertiary)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{l}</div><div style={{ fontSize: 16, fontWeight: 700, color: bad ? "var(--danger-bright)" : good ? "var(--ok)" : "var(--text-primary)" }}>{v}</div></div>;
}
