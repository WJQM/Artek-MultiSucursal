"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { sileo } from "@/frontend/lib/toast";

const noop = () => () => {};
const SHEETS = [
  { k: "resumen", l: "Resumen (ingresos, costos y ganancia)" },
  { k: "ordenes", l: "Órdenes de reparación" },
  { k: "ventas", l: "Ventas y cotizaciones" },
  { k: "caja", l: "Movimientos de caja" },
  { k: "cierres", l: "Cierres de caja" },
  { k: "inventario", l: "Inventario (stock, costo y valor)" },
  { k: "movimientos", l: "Movimientos de stock" },
  { k: "clientes", l: "Clientes" },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PRESETS = (() => {
  const n = new Date();
  const m0 = new Date(n.getFullYear(), n.getMonth(), 1), mEnd = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  const p0 = new Date(n.getFullYear(), n.getMonth() - 1, 1), pEnd = new Date(n.getFullYear(), n.getMonth(), 0);
  return [
    { l: "Este mes", f: iso(m0), t: iso(mEnd) },
    { l: "Mes pasado", f: iso(p0), t: iso(pEnd) },
    { l: "Este año", f: `${n.getFullYear()}-01-01`, t: `${n.getFullYear()}-12-31` },
    { l: "Año pasado", f: `${n.getFullYear() - 1}-01-01`, t: `${n.getFullYear() - 1}-12-31` },
  ];
})();

export default function ExportarPage() {
  const router = useRouter();
  const rawUser = useSyncExternalStore(noop, () => sessionStorage.getItem("user") || "", () => null);
  const user = useMemo<{ role: string } | null>(() => { try { return rawUser ? JSON.parse(rawUser) : null; } catch { return null; } }, [rawUser]);
  const [from, setFrom] = useState(PRESETS[0].f);
  const [to, setTo] = useState(PRESETS[0].t);
  const [sel, setSel] = useState<string[]>(SHEETS.map((s) => s.k));
  const [allBranches, setAllBranches] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rawUser === null) return;
    if (!user) router.push("/");
    else if (user.role === "tech") router.push("/asignaciones");
  }, [router, user, rawUser]);
  if (!user || user.role === "tech") return null;

  const download = async () => {
    if (!sel.length) { sileo.error({ title: "Elige al menos una hoja" }); return; }
    setBusy(true);
    try {
      const r = await apiFetch(`/api/export/excel?from=${from}&to=${to}&sheets=${sel.join(",")}`, allBranches ? { headers: { "x-branch-id": "" } } : {});
      if (!r.ok) { const d = await r.json().catch(() => ({})); sileo.error({ title: d.error || "No se pudo generar" }); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "RepairTrack.xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      sileo.success({ title: "Excel descargado", description: name });
    } catch { sileo.error({ title: "Sin conexión" }); } finally { setBusy(false); }
  };

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
      `}</style>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Exportar a Excel</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Un archivo con una hoja por tema, listo para tu contador o para tus propios análisis. Los totales son fórmulas: si filtras una columna, se recalculan.</p>
          </div>
          <div style={card}>
            <div style={lbl}>Período</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 140px", fontSize: 11.5, color: "var(--text-muted)" }}>Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={inp} /></label>
              <label style={{ flex: "1 1 140px", fontSize: 11.5, color: "var(--text-muted)" }}>Hasta (incluido)<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={inp} /></label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {PRESETS.map((p) => <button key={p.l} onClick={() => { setFrom(p.f); setTo(p.t); }} style={chip(from === p.f && to === p.t)}>{p.l}</button>)}
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={lbl}>Qué incluir (una hoja por cada uno)</div>
              <button onClick={() => setSel(sel.length === SHEETS.length ? [] : SHEETS.map((s) => s.k))} style={{ border: "none", background: "none", color: "var(--accent-dim)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{sel.length === SHEETS.length ? "Quitar todas" : "Marcar todas"}</button>
            </div>
            {SHEETS.map((s) => (
              <label key={s.k} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", fontSize: 13.5, cursor: "pointer", borderBottom: "1px solid var(--bg-hover)" }}>
                <input type="checkbox" checked={sel.includes(s.k)} onChange={(e) => setSel(e.target.checked ? [...sel, s.k] : sel.filter((x) => x !== s.k))} /> {s.l}
              </label>
            ))}
            {user.role === "superadmin" && (
              <label style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} /> Todas las sucursales (si no, solo la sucursal activa)
              </label>
            )}
          </div>
          <button disabled={busy} onClick={download} style={{ padding: 14, borderRadius: 12, border: "none", background: "var(--ok)", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: busy ? "wait" : "pointer" }}>{busy ? "Generando…" : "Descargar Excel"}</button>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 8 };
const inp: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff", color: "#1e2a3a", fontFamily: "inherit" };
const chip = (on: boolean): React.CSSProperties => ({ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${on ? "var(--accent-dim)" : "#cbd5e1"}`, background: on ? "var(--accent-bg-soft)" : "#fff", color: on ? "var(--accent)" : "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
