"use client";
import { ClipboardList, Lock, Printer, RefreshCw, TriangleAlert, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, getStoredAuth } from "@/frontend/lib/api";
import { RX_CSS, rxPageCss, RxHero, rxStatus, rxNum, rxBs, type RxCompany } from "@/frontend/components/ReportSheet";
import { EXTRACTO_MAX, extractoApiParams, extractoHojas, type ExtractoFiltros } from "@/shared/extracto";

// Extracto general para imprimir, con dirección propia (antes se escribía en una pestaña "about:blank").
// Primero cuenta los equipos: si son demasiados no los descarga, así el navegador no se queda sin memoria.

interface Row { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; clientName: string | null; clientPhone: string | null; createdAt: string; estimatedCost?: number }
type Estado =
  | { kind: "cargando" } | { kind: "sesion" } | { kind: "permiso" } | { kind: "red" }
  | { kind: "muchos"; total: number } | { kind: "listo"; rows: Row[] };

const fmtCorta = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtFiltro = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
const devName = (r: Row) => [r.device, r.brand, r.model].filter(Boolean).join(" ");

// useSearchParams necesita Suspense para que el build no falle (la hoja se arma en el navegador)
export default function ExtractoImprimirPage() {
  return <Suspense fallback={null}><ExtractoHoja /></Suspense>;
}

function ExtractoHoja() {
  const sp = useSearchParams();
  const estadoParam = sp.get("estado");
  const filtros: ExtractoFiltros = {
    q: sp.get("q") || "", desde: sp.get("desde") || "", hasta: sp.get("hasta") || "", sucursal: sp.get("sucursal") || "",
    estado: estadoParam === "open" || estadoParam === "delivered" ? estadoParam : "",
  };
  const clave = sp.toString();
  const [estado, setEstado] = useState<Estado>({ kind: "cargando" });
  const [company, setCompany] = useState<RxCompany>({ companyName: "" });
  const [branchName, setBranchName] = useState("");

  const [intento, setIntento] = useState(0); // "Reintentar" suma 1 y se consulta de nuevo

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setCompany(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    const fijar = (e: Estado) => { if (vivo) setEstado(e); };
    const { token, user } = getStoredAuth();
    if (!token || !user) { fijar({ kind: "sesion" }); return; }
    if (user.role !== "admin" && user.role !== "superadmin") { fijar({ kind: "permiso" }); return; }
    const opts = filtros.sucursal ? { headers: { "x-branch-id": filtros.sucursal } } : {};
    if (filtros.sucursal) {
      apiFetch("/api/branches").then(r => r.ok ? r.json() : []).then((b: { id: string; name: string }[]) => { if (vivo && Array.isArray(b)) setBranchName(b.find(x => x.id === filtros.sucursal)?.name || ""); }).catch(() => {});
    } else if (user.branchName) setBranchName(user.branchName); // eslint-disable-line react-hooks/set-state-in-effect -- dato de la sesión del navegador
    fijar({ kind: "cargando" });
    const params = extractoApiParams(filtros);
    (async () => {
      try {
        // 1) Contar (una sola fila): si son demasiados, no se descarga la lista
        const c = await apiFetch(`/api/repairs?${params}&count=1`, opts);
        if (c.status === 401) return fijar({ kind: "sesion" });
        if (c.status === 403) return fijar({ kind: "permiso" });
        if (!c.ok) return fijar({ kind: "red" });
        const total = Number((await c.json()).total) || 0;
        if (total > EXTRACTO_MAX) return fijar({ kind: "muchos", total });
        // 2) La lista completa (solo los campos que se imprimen)
        const r = await apiFetch(`/api/repairs?${params}&slim=1`, opts);
        if (r.status === 401) return fijar({ kind: "sesion" });
        if (!r.ok) return fijar({ kind: "red" });
        const rows = await r.json();
        fijar({ kind: "listo", rows: Array.isArray(rows) ? rows : [] });
      } catch { fijar({ kind: "red" }); }
    })();
    return () => { vivo = false; };
  }, [clave, intento]); // eslint-disable-line react-hooks/exhaustive-deps -- los filtros salen de la dirección (clave)

  const now = new Date();
  const today = now.toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const rango = filtros.desde || filtros.hasta ? `${filtros.desde ? fmtFiltro(filtros.desde) : "inicio"} – ${filtros.hasta ? fmtFiltro(filtros.hasta) : "hoy"}` : "Todas las fechas";
  const detalle = [filtros.estado === "open" ? "Solo en taller" : filtros.estado === "delivered" ? "Solo entregados" : "", filtros.q ? `Búsqueda: “${filtros.q}”` : ""].filter(Boolean).join(" · ");
  const listo = estado.kind === "listo";
  // Nombre del archivo al usar "Guardar como PDF"
  useEffect(() => { document.title = `Extracto general · ${rango}`; }, [rango]);

  return (
    <div className="rx">
      <style>{RX_CSS + rxPageCss(true)}</style>
      <div className="rx-bar">
        <span><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Extracto general de equipos</span>
        <div>
          {listo && <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir</button>}
          <button onClick={closePage}><X size={14} strokeWidth={STROKE} aria-hidden="true" /> Cerrar</button>
        </div>
      </div>
      <div className="rx-page wide">
        {estado.kind === "cargando" && <Aviso titulo="Cargando extracto…" texto="Contando los equipos con estos filtros." />}
        {estado.kind === "sesion" && <Aviso icon={<Lock size={22} strokeWidth={STROKE} aria-hidden="true" />} titulo="Inicia sesión para ver el extracto" texto="Esta pestaña no tiene tu sesión (pasa al abrir el enlace copiado o si tu sesión venció). Ábrelo desde Extracto › Imprimir extracto, o vuelve a entrar." accion={<Link href="/extracto" className="go">Ir al extracto</Link>} />}
        {estado.kind === "permiso" && <Aviso icon={<Lock size={22} strokeWidth={STROKE} aria-hidden="true" />} titulo="Sin permiso" texto="El extracto general es solo para administradores." />}
        {estado.kind === "red" && <Aviso icon={<TriangleAlert size={22} strokeWidth={STROKE} aria-hidden="true" />} titulo="No se pudo cargar" texto="Revisa tu internet e intenta de nuevo." accion={<button className="go" onClick={() => setIntento(n => n + 1)}><RefreshCw size={14} strokeWidth={STROKE} aria-hidden="true" /> Reintentar</button>} />}
        {estado.kind === "muchos" && <Aviso icon={<TriangleAlert size={22} strokeWidth={STROKE} aria-hidden="true" />} titulo="Demasiados equipos para imprimir"
          texto={`Con estos filtros son ${rxNum(estado.total)} equipos (unas ${rxNum(extractoHojas(estado.total))} hojas). El máximo es ${rxNum(EXTRACTO_MAX)}. Vuelve al extracto y elige un rango de fechas más corto, o descarga el Excel.`}
          accion={<Link href="/extracto" className="go">Volver al extracto</Link>} />}
        {estado.kind === "listo" && (() => {
          const rows = estado.rows;
          const inShop = rows.filter(r => r.status !== "delivered").length;
          const cobrado = rows.filter(r => r.status === "delivered").reduce((t, r) => t + (r.estimatedCost || 0), 0);
          return <>
            <RxHero s={company} branch={branchName} label="Extracto general" title={rango} sub={[detalle, `Generado el ${today}, ${time}`].filter(Boolean).join(" · ")} />
            <div className="rx-kpis">
              <div className="rx-kpi"><span>Equipos</span><b>{rxNum(rows.length)}</b><small>con los filtros elegidos</small></div>
              <div className="rx-kpi"><span>En taller</span><b>{rxNum(inShop)}</b><small>sin entregar</small></div>
              <div className="rx-kpi"><span>Entregados</span><b>{rxNum(rows.length - inShop)}</b><small>ya devueltos</small></div>
              <div className="rx-kpi money"><span>Cobrado</span><b>{rxBs(cobrado)}</b><small>de los entregados</small></div>
            </div>
            <div>
              <div className="rx-sect">Listado general de equipos <em>{rxNum(rows.length)}</em></div>
              {rows.length === 0 ? <p className="rx-empty">No hay equipos con estos filtros</p> : (
                <div className="rx-tw as-cards"><table className="rx-t">
                  <thead><tr><th className="c">#</th><th>OT</th><th>Equipo</th><th>Cliente</th><th>Celular</th><th>Problema</th><th>Estado</th><th>Fecha</th><th className="n">Monto</th></tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="c muted">{i + 1}</td>
                      <td className="rx-code">{r.code}</td>
                      <td><b>{devName(r)}</b></td>
                      <td>{r.clientName || "—"}</td>
                      <td className="muted">{r.clientPhone || "—"}</td>
                      <td className="muted">{r.issue}</td>
                      <td><span className="rx-pill" style={{ color: rxStatus(r.status).fg }}>{rxStatus(r.status).label}</span></td>
                      <td>{fmtCorta(r.createdAt)}</td>
                      <td className="n">{rxBs(r.estimatedCost || 0)}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr><td colSpan={8}>Total</td><td className="n money">{rxBs(rows.reduce((t, r) => t + (r.estimatedCost || 0), 0))}</td></tr></tfoot>
                </table></div>
              )}
            </div>
            <div className="rx-foot"><span>{company.companyName}{branchName ? ` · ${branchName}` : ""}</span><span>Extracto general · {today}, {time}</span></div>
          </>;
        })()}
      </div>
    </div>
  );
}

function Aviso({ icon, titulo, texto, accion }: { icon?: ReactNode; titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div role={icon ? "alert" : "status"} className="no-print" style={{ maxWidth: 460, margin: "60px auto", textAlign: "center", border: "1px solid #000", borderRadius: 6, padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {icon}
      <b style={{ fontSize: 17 }}>{titulo}</b>
      <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{texto}</p>
      {accion && <div className="ex-accion" style={{ marginTop: 8 }}>{accion}</div>}
      <style>{`.ex-accion .go{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 18px;border-radius:8px;border:0;background:#000;color:#fff !important;font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none}`}</style>
    </div>
  );
}
