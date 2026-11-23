"use client";
import { Banknote, ChartColumn, CircleCheck, ClipboardList, Copy, Printer, Receipt, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { RX_CSS, rxPageCss, RxHero, rxStatus, rxBs, rxNum, type RxCompany } from "@/frontend/components/ReportSheet";

interface Report {
  branchName: string;
  period: { label: string };
  summary: {
    totalRepairs: number; deliveredCount: number; salesCount: number; quotationsCount: number;
    repairIncome: number; salesIncome: number; totalIncome: number; byStatus: Record<string, number>;
  };
  byTechnician: { id: string; name: string; count: number; income: number }[];
  repairs: { code: string; createdAt: string; clientName: string | null; device: string | null; technicianName: string | null; status: string; estimatedCost: number }[];
  delivered?: { code: string; deliveredAt: string; clientName: string | null; device: string | null; technicianName: string | null; estimatedCost: number }[];
  quotations: { code: string; createdAt: string; type: string; clientName: string | null; total: number }[];
}

// Orden de los estados en la barra (del inicio al final del trabajo)
const STATUS_ORDER = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];

export default function MonthlyReportPage() {
  const params = useParams<{ year: string; month: string }>();
  const search = useSearchParams();
  const branchId = search.get("branchId");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<RxCompany>({ companyName: "" });

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setCompany(d); }).catch(() => {});

    const url = `/api/reports/monthly?year=${params.year}&month=${params.month}${branchId ? `&branchId=${branchId}` : ""}`;
    apiFetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [params, branchId]);

  useEffect(() => {
    // Auto-imprimir al cargar
    if (data) setTimeout(() => window.print(), 500);
  }, [data]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" });

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Cargando reporte...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--danger-bright)" }}>Error al cargar el reporte</div>;

  const s = data.summary;
  // "octubre de 2026" → "Octubre de 2026"
  const monthLabel = data.period.label.charAt(0).toUpperCase() + data.period.label.slice(1);
  const delivered = data.delivered || [];
  const generated = new Date().toLocaleString("es-BO", { hourCycle: "h23", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\./g, "");
  const repairPct = s.totalIncome > 0 ? Math.round((s.repairIncome / s.totalIncome) * 100) : 0;
  const statusEntries = STATUS_ORDER.filter(k => s.byStatus[k]).map(k => [k, s.byStatus[k]] as const)
    .concat(Object.entries(s.byStatus).filter(([k, v]) => !STATUS_ORDER.includes(k) && v));
  const statusTotal = statusEntries.reduce((a, [, v]) => a + v, 0);
  const maxTech = Math.max(1, ...data.byTechnician.map(t => t.income));
  const repairsTotal = data.repairs.reduce((a, r) => a + (r.estimatedCost || 0), 0);
  const deliveredTotal = delivered.reduce((a, r) => a + (r.estimatedCost || 0), 0);
  const salesTotal = data.quotations.filter(q => q.type === "sale").reduce((a, q) => a + (q.total || 0), 0);

  return (
    <div className="rx">
      <style>{RX_CSS + rxPageCss(false)}</style>

      <div className="rx-bar">
        <span><ChartColumn size={14} strokeWidth={STROKE} aria-hidden="true" /> Reporte mensual — se imprimirá automáticamente</span>
        <div>
          <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir / Guardar PDF</button>
          <button onClick={closePage}><X size={14} strokeWidth={STROKE} aria-hidden="true" /> Cerrar</button>
        </div>
      </div>

      <div className="rx-page">
        <RxHero s={company} branch={data.branchName} icon={<ChartColumn size={18} strokeWidth={STROKE} aria-hidden="true" />} label="Reporte mensual"
          title={monthLabel}
          sub={`Generado el ${generated}`} />

        <div className="rx-kpis">
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--accent)" }}><span>OTs creadas</span><b>{rxNum(s.totalRepairs)}</b><small>recibidas en el mes</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--ok)" }}><span><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> OTs entregadas</span><b>{rxNum(s.deliveredCount)}</b><small>{rxBs(s.repairIncome)} cobrados</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--info)" }}><span><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Ventas</span><b>{rxNum(s.salesCount)}</b><small>{rxBs(s.salesIncome)} en notas de venta</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--warn-bright)" }}><span><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Cotizaciones</span><b>{rxNum(s.quotationsCount)}</b><small>emitidas en el mes</small></div>
        </div>

        <div className="rx-income">
          <span><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Ingresos totales del mes</span>
          <b>{rxBs(s.totalIncome, true)}</b>
          <div>
            <div className="rx-split">
              {s.totalIncome > 0 && <><i style={{ width: `${repairPct}%`, background: "var(--accent-on-dark)" }} /><i style={{ width: `${100 - repairPct}%`, background: "var(--warn-bright)" }} /></>}
            </div>
            <div className="rx-legend">
              <span><i style={{ background: "var(--accent-on-dark)" }} />Reparaciones entregadas {rxBs(s.repairIncome, true)}{s.totalIncome > 0 ? ` (${repairPct} %)` : ""}</span>
              <span><i style={{ background: "var(--warn-bright)" }} />Ventas {rxBs(s.salesIncome, true)}{s.totalIncome > 0 ? ` (${100 - repairPct} %)` : ""}</span>
            </div>
          </div>
        </div>

        {statusTotal > 0 && (
          <div>
            <div className="rx-sect"><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Órdenes por estado <em>{rxNum(statusTotal)} {statusTotal === 1 ? "orden" : "órdenes"}</em></div>
            <div className="rx-stack">
              {statusEntries.map(([k, v]) => <i key={k} style={{ width: `${(v / statusTotal) * 100}%`, background: rxStatus(k).bar }} />)}
            </div>
            <div className="rx-chips">
              {statusEntries.map(([k, v]) => <span key={k} className="rx-chip"><i style={{ background: rxStatus(k).bar }} />{rxStatus(k).label} <b style={{ marginLeft: 4 }}>{rxNum(v)}</b></span>)}
            </div>
          </div>
        )}

        {data.byTechnician.length > 0 && (
          <div>
            <div className="rx-sect">Técnicos <em>órdenes entregadas</em></div>
            {data.byTechnician.map((t, i) => (
              <div key={t.id} className="rx-tech">
                <span>{`#${i + 1}`}</span>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</b>
                <span className="rx-meter"><i style={{ width: `${(t.income / maxTech) * 100}%` }} /></span>
                <span className="n">{rxNum(t.count)} · {rxBs(t.income, true)}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="rx-sect"><Copy size={14} strokeWidth={STROKE} aria-hidden="true" /> Órdenes recibidas en el mes <em>{rxNum(data.repairs.length)}</em></div>
          {data.repairs.length === 0 ? <p className="rx-empty">No hay órdenes en este período</p> : (
            <div className="rx-tw as-cards">
              <table className="rx-t">
                <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Equipo</th><th>Técnico</th><th>Estado</th><th className="n">Costo</th></tr></thead>
                <tbody>
                  {data.repairs.map((r, i) => {
                    const st = rxStatus(r.status);
                    return (
                      <tr key={`${r.code}-${i}`}>
                        <td className="rx-code">{r.code}</td>
                        <td>{fmtDate(r.createdAt)}</td>
                        <td>{r.clientName || "—"}</td>
                        <td>{r.device || "—"}</td>
                        <td className="muted">{r.technicianName || "Sin asignar"}</td>
                        <td><span className="rx-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                        <td className="n" style={{ fontWeight: r.status === "delivered" ? 800 : 500, color: r.status === "delivered" ? "var(--ok)" : undefined }}>{rxBs(r.estimatedCost, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr><td colSpan={6}>Total estimado de las {rxNum(data.repairs.length)} órdenes</td><td className="n">{rxBs(repairsTotal, true)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="rx-sect"><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Órdenes entregadas en el mes <em>ingresos</em></div>
          {delivered.length === 0 ? <p className="rx-empty">No se entregaron órdenes en este período</p> : (
            <div className="rx-tw as-cards">
              <table className="rx-t">
                <thead><tr><th>Código</th><th>Entrega</th><th>Cliente</th><th>Equipo</th><th>Técnico</th><th className="n">Cobrado</th></tr></thead>
                <tbody>
                  {delivered.map((r, i) => (
                    <tr key={`${r.code}-${i}`}>
                      <td className="rx-code">{r.code}</td>
                      <td>{fmtDate(r.deliveredAt)}</td>
                      <td>{r.clientName || "—"}</td>
                      <td>{r.device || "—"}</td>
                      <td className="muted">{r.technicianName || "—"}</td>
                      <td className="n" style={{ fontWeight: 700, color: "var(--ok)" }}>{rxBs(r.estimatedCost, true)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={5}>Total cobrado por reparaciones</td><td className="n">{rxBs(deliveredTotal, true)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>

        {data.quotations.length > 0 && (
          <div>
            <div className="rx-sect"><Receipt size={14} strokeWidth={STROKE} aria-hidden="true" /> Cotizaciones y notas de venta <em>{rxNum(data.quotations.length)}</em></div>
            <div className="rx-tw as-cards">
              <table className="rx-t">
                <thead><tr><th>Código</th><th>Fecha</th><th>Tipo</th><th>Cliente</th><th className="n">Total</th></tr></thead>
                <tbody>
                  {data.quotations.map((q, i) => {
                    const sale = q.type === "sale";
                    return (
                      <tr key={`${q.code}-${i}`}>
                        <td className="rx-code">{q.code}</td>
                        <td>{fmtDate(q.createdAt)}</td>
                        <td><span className="rx-pill" style={{ background: sale ? "var(--info-bg)" : "var(--warn-bg)", color: sale ? "var(--info)" : "var(--warn)" }}>{sale ? "Nota de venta" : "Cotización"}</span></td>
                        <td>{q.clientName || "—"}</td>
                        <td className="n" style={{ fontWeight: 700, color: sale ? "var(--info)" : undefined }}>{rxBs(q.total, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr><td colSpan={4}>Total vendido (notas de venta)</td><td className="n">{rxBs(salesTotal, true)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="rx-foot">
          <span>{company.companyName}{data.branchName ? ` · ${data.branchName}` : ""}</span>
          <span>Reporte mensual · {monthLabel}</span>
        </div>
      </div>
    </div>
  );
}
