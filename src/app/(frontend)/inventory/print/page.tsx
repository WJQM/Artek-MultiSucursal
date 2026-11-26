"use client";
import { Banknote, ChartColumn, Cog, Package, Printer, Tag, TriangleAlert, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { RX_CSS, rxPageCss, RxHero, rxBs, rxNum, type RxCompany } from "@/frontend/components/ReportSheet";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface InventoryItem { id: string; name: string; category: string | null; quantity: number; price: number; minStock: number; image: string | null; }

export default function InventoryPrintPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [branchName, setBranchName] = useState("");
  const [kindLabel, setKindLabel] = useState<"Inventario" | "Productos" | "Repuestos">("Inventario");
  const [settings, setSettings] = useState<RxCompany>({ companyName: "", logo: null, phone: null, address: null });

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
    // ?kind=part → solo repuestos, ?kind=product → solo productos, sin parámetro → todo el inventario
    const raw = new URLSearchParams(window.location.search).get("kind");
    const kind = raw === "part" || raw === "product" ? raw : null;
    setKindLabel(kind === "part" ? "Repuestos" : kind === "product" ? "Productos" : "Inventario"); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    apiFetch(kind ? `/api/inventory?kind=${kind}` : "/api/inventory").then(r => r.json()).then(d => { if (Array.isArray(d)) setItems(d); setLoading(false); }).catch(() => setLoading(false));
    // Nombre de la sucursal para el encabezado
    try {
      const user = ((() => { try { return JSON.parse(sessionStorage.getItem("user") || "{}"); } catch { return {}; } })());
      if (user.branchName) setBranchName(user.branchName);
      else if (user.role === "superadmin") {
        apiFetch("/api/branches").then(r => r.json()).then((branches: { id: string; name: string }[]) => {
          const abId = sessionStorage.getItem("activeBranchId");
          const ab = branches.find(b => b.id === abId);
          if (ab) setBranchName(ab.name);
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];
  const filtered = items.filter(i => {
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.category || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalItems = filtered.length;
  const totalUnits = filtered.reduce((s, i) => s + i.quantity, 0);
  const totalValue = filtered.reduce((s, i) => s + (i.price * i.quantity), 0);
  const lowStock = filtered.filter(i => i.quantity <= i.minStock).length;
  const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const time = new Date().toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const icon = kindLabel === "Repuestos" ? <Cog size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Package size={18} strokeWidth={STROKE} aria-hidden="true" />;

  if (loading) return <DocSkeleton />;

  return (
    <div className="rx">
      <style>{RX_CSS + rxPageCss(true)}</style>

      {/* BARRA DE ACCIONES (no se imprime) */}
      <div className="rx-bar ls-bar">
        <span>{icon} Extracto de {kindLabel}</span>
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar producto" style={{ width: 180 }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} aria-label="Categoría">
            <option value="all">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir</button>
          <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="rx-page wide">
        <RxHero s={settings} branch={branchName} icon={icon} label={kindLabel} title={today}
          sub={`Generado a las ${time}${filterCat !== "all" ? ` · Categoría: ${filterCat}` : ""}${search ? ` · Búsqueda: “${search}”` : ""}`} />

        <div className="rx-kpis">
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--accent)" }}><span><Package size={14} strokeWidth={STROKE} aria-hidden="true" /> Productos</span><b>{rxNum(totalItems)}</b><small>en la lista</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--ok)" }}><span>Unidades</span><b>{rxNum(totalUnits)}</b><small>en stock</small></div>
          <div className="rx-kpi money" style={{ ["--c" as string]: "var(--warn-bright)" }}><span><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Valor total</span><b>{rxBs(totalValue)}</b><small>precio × stock</small></div>
          <div className="rx-kpi" style={{ ["--c" as string]: "var(--danger-bright)" }}><span><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Stock bajo</span><b>{rxNum(lowStock)}</b><small>en el mínimo o debajo</small></div>
        </div>

        {/* CELULAR: una tarjeta por producto (no se imprime) */}
        <div className="ls-cards no-print">
          {filtered.map(item => {
            const isLow = item.quantity <= item.minStock;
            return (
              <div key={item.id} className="ls-card">
                <div className="top"><b>{item.name}</b><span className="price">{rxBs(item.price)}</span></div>
                <div className="ls-chips">
                  {item.category && <span>{item.category}</span>}
                  <span className={isLow ? "low" : "ok"}>Stock {item.quantity} · mín. {item.minStock}{isLow ? " · BAJO" : ""}</span>
                  <span>Valor {rxBs(item.price * item.quantity)}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>No hay productos con ese filtro.</p>}
        </div>

        {/* TABLA (computadora e impresión) */}
        <div className="ls-table">
          <div className="rx-sect">{icon} Detalle de {kindLabel.toLowerCase()} <em>{rxNum(totalItems)}</em></div>
          <div className="rx-tw">
            <table className="rx-t">
              <thead>
                <tr><th className="c" style={{ width: 40 }}>#</th><th>Producto</th><th style={{ width: 150 }}>Categoría</th><th className="n" style={{ width: 70 }}>Stock</th><th className="n" style={{ width: 70 }}>Mín.</th><th className="n" style={{ width: 100 }}>Precio</th><th className="n" style={{ width: 120 }}>Valor stock</th><th className="c" style={{ width: 80 }}>Estado</th></tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isLow = item.quantity <= item.minStock;
                  return (
                    <tr key={item.id}>
                      <td className="c muted">{idx + 1}</td>
                      <td><b>{item.name}</b></td>
                      <td className="muted">{item.category || "—"}</td>
                      <td className="n" style={{ fontWeight: 700, color: isLow ? "var(--danger-bright)" : "var(--ok)" }}>{rxNum(item.quantity)}</td>
                      <td className="n muted">{rxNum(item.minStock)}</td>
                      <td className="n">{rxBs(item.price)}</td>
                      <td className="n" style={{ fontWeight: 700 }}>{rxBs(item.price * item.quantity)}</td>
                      <td className="c">{isLow && <span className="rx-pill" style={{ color: "#b91c1c" }}>{item.quantity <= 0 ? "Agotado" : "Stock bajo"}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total de {kindLabel.toLowerCase()}</td><td className="n">{rxNum(totalUnits)}</td><td /><td /><td className="n">{rxBs(totalValue)}</td><td /></tr></tfoot>
            </table>
          </div>
        </div>

        {/* RESUMEN POR CATEGORÍA */}
        {categories.length > 0 && (
          <div>
            <div className="rx-sect"><ChartColumn size={14} strokeWidth={STROKE} aria-hidden="true" /> Resumen por categoría <em>{categories.length}</em></div>
            <div className="rx-tw">
              <table className="rx-t">
                <thead><tr><th>Categoría</th><th className="n">Productos</th><th className="n">Unidades</th><th className="n">Valor</th></tr></thead>
                <tbody>
                  {categories.map(cat => {
                    const catItems = filtered.filter(i => i.category === cat);
                    if (catItems.length === 0) return null;
                    const catUnits = catItems.reduce((s, i) => s + i.quantity, 0);
                    const catValue = catItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                    return (
                      <tr key={cat}>
                        <td><b><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> {cat}</b></td>
                        <td className="n">{rxNum(catItems.length)}</td>
                        <td className="n">{rxNum(catUnits)}</td>
                        <td className="n" style={{ fontWeight: 700 }}>{rxBs(catValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rx-foot">
          <span>{settings.companyName}{branchName ? ` · ${branchName}` : ""}</span>
          <span>Extracto de {kindLabel.toLowerCase()} · {today}, {time}</span>
        </div>
      </div>
    </div>
  );
}
