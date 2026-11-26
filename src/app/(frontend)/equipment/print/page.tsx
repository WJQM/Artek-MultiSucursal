"use client";
import { Banknote, Laptop, Monitor, Printer, X, Zap } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { RX_CSS, rxPageCss, RxHero, rxBs, rxNum, type RxCompany } from "@/frontend/components/ReportSheet";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface Equipment { id: string; code: string; name: string; type: string; brand: string | null; model: string | null; processor: string | null; ram: string | null; storage: string | null; storage2: string | null; screenSize: string | null; graphicsCard: string | null; os: string | null; cabinet: string | null; powerSupply: string | null; accessories: string | null; condition: string; price: number; notes: string | null; image: string | null; createdAt: string; }

function getDisplayName(eq: Equipment): string {
  return [eq.type === "laptop" ? "Laptop" : "PC Escritorio", eq.brand, eq.model].filter(Boolean).join(" ");
}

const condLabel: Record<string, { label: string; color: string; bg: string }> = {
  disponible: { label: "Disponible", color: "#047857", bg: "#f0fdf4" },
  vendido: { label: "Vendido", color: "#1d4ed8", bg: "#dbeafe" },
  en_reparacion: { label: "En reparación", color: "#b45309", bg: "#fffbeb" },
};

export default function EquipmentPrintPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterCond, setFilterCond] = useState("all");
  const [search, setSearch] = useState("");
  const [branchName, setBranchName] = useState("");
  const [settings, setSettings] = useState<RxCompany>({ companyName: "", logo: null, phone: null, address: null });

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
    apiFetch("/api/equipment").then(r => r.json()).then(d => { if (Array.isArray(d)) setItems(d); setLoading(false); }).catch(() => setLoading(false));
    try {
      const user = ((() => { try { return JSON.parse(sessionStorage.getItem("user") || "{}"); } catch { return {}; } })());
      if (user.branchName) setBranchName(user.branchName); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
      else if (user.role === "superadmin") {
        apiFetch("/api/branches").then(r => r.json()).then((branches: { id: string; name: string }[]) => {
          const abId = sessionStorage.getItem("activeBranchId");
          const ab = branches.find(b => b.id === abId);
          if (ab) setBranchName(ab.name);
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const filtered = items.filter(i => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterCond !== "all" && i.condition !== filterCond) return false;
    if (search && !getDisplayName(i).toLowerCase().includes(search.toLowerCase()) && !(i.processor || "").toLowerCase().includes(search.toLowerCase()) && !(i.code || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalValue = filtered.reduce((s, i) => s + i.price, 0);
  const laptops = filtered.filter(i => i.type === "laptop").length;
  const desks = filtered.filter(i => i.type === "desktop").length;
  const available = filtered.filter(i => i.condition === "disponible").length;
  const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const time = new Date().toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const filters = [filterType === "laptop" ? "Laptops" : filterType === "desktop" ? "Escritorio" : "", filterCond !== "all" ? condLabel[filterCond]?.label : "", search ? `“${search}”` : ""].filter(Boolean).join(" · ");

  if (loading) return <DocSkeleton />;

  return (
    <div className="rx">
      <style>{RX_CSS + rxPageCss(true)}</style>

      {/* BARRA DE ACCIONES (no se imprime) */}
      <div className="rx-bar ls-bar">
        <span><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> Catálogo de equipos</span>
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por EQ-#, nombre, CPU..." aria-label="Buscar equipo" style={{ width: 220 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Tipo">
            <option value="all">Todos</option>
            <option value="laptop">Laptops</option>
            <option value="desktop">Escritorio</option>
          </select>
          <select value={filterCond} onChange={e => setFilterCond(e.target.value)} aria-label="Estado">
            <option value="all">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="vendido">Vendido</option>
            <option value="en_reparacion">En reparación</option>
          </select>
          <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir</button>
          <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="rx-page wide">
        <RxHero s={settings} branch={branchName} icon={<Laptop size={18} strokeWidth={STROKE} aria-hidden="true" />} label="Catálogo de equipos" title={`${rxNum(filtered.length)} equipo${filtered.length !== 1 ? "s" : ""}`}
          sub={`${today}, ${time}${filters ? ` · ${filters}` : ""}`} />

        <div className="rx-kpis">
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--accent)" }}><span><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> Equipos</span><b>{rxNum(filtered.length)}</b><small>{rxNum(available)} disponibles</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--info)" }}><span><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> Laptops</span><b>{rxNum(laptops)}</b><small>portátiles</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "#0891b2" }}><span><Monitor size={14} strokeWidth={STROKE} aria-hidden="true" /> Escritorio</span><b>{rxNum(desks)}</b><small>PC de escritorio</small></div>
          <div className="rx-kpi money" style={{ ["--c" as string]: "var(--warn-bright)" }}><span><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Valor total</span><b>{rxBs(totalValue)}</b><small>promedio {rxBs(filtered.length ? totalValue / filtered.length : 0)}</small></div>
        </div>

        {/* CELULAR: una tarjeta por equipo (no se imprime) */}
        <div className="ls-cards no-print">
          {filtered.map(item => {
            const cond = condLabel[item.condition] || condLabel.disponible;
            const disks = [item.storage, item.storage2].filter(Boolean).join(" + ");
            const specs = [item.processor, item.ram && `RAM ${item.ram}`, disks, item.graphicsCard].filter(Boolean).join(" · ");
            return (
              <div key={item.id} className="ls-card">
                <div className="top"><b>{getDisplayName(item)}</b><span className="price">{rxBs(item.price)}</span></div>
                <div className="ls-chips">
                  <span className="code">{item.code || "—"}</span>
                  <span style={{ background: cond.bg, color: cond.color }}>{cond.label}</span>
                  {item.os && <span>{item.os}</span>}
                </div>
                {specs && <small>{specs}</small>}
              </div>
            );
          })}
          {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>No hay equipos con ese filtro.</p>}
        </div>

        {/* TABLA (computadora e impresión) */}
        <div className="ls-table">
          <div className="rx-sect"><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> Detalle de equipos <em>{rxNum(filtered.length)}</em></div>
          <div className="rx-tw">
            <table className="rx-t">
              <thead>
                <tr><th className="c" style={{ width: 34 }}>#</th><th style={{ width: 70 }}>Código</th><th>Equipo</th><th>CPU · RAM · Disco</th><th>Gráficos</th><th>Pantalla / Gabinete</th><th className="n" style={{ width: 90 }}>Precio</th><th className="c" style={{ width: 100 }}>Estado</th></tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const cond = condLabel[item.condition] || condLabel.disponible;
                  const disks = [item.storage, item.storage2].filter(Boolean).join(" + ");
                  const extra = item.type === "laptop" ? item.screenSize : item.cabinet;
                  return (
                    <tr key={item.id}>
                      <td className="c muted">{idx + 1}</td>
                      <td className="rx-code">{item.code || "—"}</td>
                      <td>
                        <b>{getDisplayName(item)}</b>
                        {item.os && <div className="muted" style={{ fontSize: 10 }}><Monitor size={14} strokeWidth={STROKE} aria-hidden="true" /> {item.os}</div>}
                        {item.accessories && <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{item.accessories.length > 40 ? item.accessories.slice(0, 40) + "…" : item.accessories}</div>}
                      </td>
                      <td>{[item.processor, item.ram && `${item.ram} RAM`, disks].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="muted">{item.graphicsCard || "—"}</td>
                      <td className="muted">
                        {extra ? <>{item.type === "laptop" ? null : null} {extra}</> : "—"}
                        {item.powerSupply && <div style={{ fontSize: 10 }}><Zap size={14} strokeWidth={STROKE} aria-hidden="true" /> {item.powerSupply}</div>}
                      </td>
                      <td className="n" style={{ fontWeight: 700 }}>{rxBs(item.price)}</td>
                      <td className="c"><span className="rx-pill" style={{ background: cond.bg, color: cond.color }}>{cond.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={6}>Valor total de los {rxNum(filtered.length)} equipos</td><td className="n">{rxBs(totalValue)}</td><td /></tr></tfoot>
            </table>
          </div>
        </div>

        <div className="rx-foot">
          <span>{settings.companyName}{branchName ? ` · ${branchName}` : ""}</span>
          <span>Catálogo de equipos · {today}, {time}</span>
        </div>
      </div>
    </div>
  );
}
