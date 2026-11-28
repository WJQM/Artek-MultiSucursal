"use client";
// Configuración → Recepción de equipos: agregar, renombrar, cambiar ícono, ordenar y quitar tipos de equipo y accesorios
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Trash2 } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { createElement, useState } from "react";
import { useRecepcion } from "@/frontend/components/RecepcionProvider";
import { ICONOS_RECEPCION, iconoRecepcion } from "@/frontend/components/RecepcionIconos";
import { ICON_KEYS, MAX_ITEMS, MAX_NAME, OTROS, type CatalogoRecepcion, type IconKey } from "@/shared/recepcion";

interface Row { id: number; name: string; icon: string; detail: boolean }
type Lista = "devices" | "accessories";

let seq = 0;
const toRows = (c: CatalogoRecepcion) => ({
  devices: c.devices.map((d) => ({ id: ++seq, name: d.name, icon: d.icon, detail: false })),
  accessories: c.accessories.map((a) => ({ id: ++seq, ...a })),
});
const firma = (r: { devices: Row[]; accessories: Row[] }) => JSON.stringify([r.devices.map((d) => [d.name.trim(), d.icon]), r.accessories.map((a) => [a.name.trim(), a.icon, a.detail])]);

function Icono({ k, size = 18 }: { k: string; size?: number }) {
  return createElement(iconoRecepcion(k) || ICONOS_RECEPCION.otros.I, { size, strokeWidth: STROKE, "aria-hidden": true });
}

export default function RecepcionPanel() {
  const { catalogo, setCatalogo } = useRecepcion();
  const [rows, setRows] = useState(() => toRows(catalogo));
  const [base, setBase] = useState(() => firma(toRows(catalogo)));
  const [picker, setPicker] = useState<number | null>(null);
  const [borrar, setBorrar] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const cambiado = firma(rows) !== base;

  const upd = (l: Lista, id: number, p: Partial<Row>) => setRows((r) => ({ ...r, [l]: r[l].map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const mover = (l: Lista, i: number, d: -1 | 1) => setRows((r) => { const a = [...r[l]]; [a[i], a[i + d]] = [a[i + d], a[i]]; return { ...r, [l]: a }; });
  const quitar = (l: Lista, id: number) => { setRows((r) => ({ ...r, [l]: r[l].filter((x) => x.id !== id) })); setBorrar(null); };
  const agregar = (l: Lista) => setRows((r) => {
    const nuevo = { id: ++seq, name: "", icon: l === "devices" ? "pc" : "caja", detail: false };
    if (l === "devices") return { ...r, devices: [...r.devices, nuevo] };
    const otros = r.accessories.filter((a) => a.name === OTROS);
    return { ...r, accessories: [...r.accessories.filter((a) => a.name !== OTROS), nuevo, ...otros] };
  });

  const validar = (): string | null => {
    for (const [l, titulo] of [["devices", "Tipos de equipo"], ["accessories", "Accesorios"]] as [Lista, string][]) {
      const nombres = rows[l].map((x) => x.name.trim().toLowerCase());
      if (nombres.some((n) => !n)) return `${titulo}: hay una fila sin nombre.`;
      const rep = nombres.find((n, i) => nombres.indexOf(n) !== i);
      if (rep) return `${titulo}: "${rows[l].find((x) => x.name.trim().toLowerCase() === rep)?.name.trim()}" está repetido.`;
    }
    if (!rows.devices.length) return "Deja al menos un tipo de equipo.";
    return null;
  };
  const error = cambiado ? validar() : null;

  const guardar = async () => {
    if (error) return;
    setSaving(true);
    try {
      const body = { devices: rows.devices.map(({ name, icon }) => ({ name: name.trim(), icon })), accessories: rows.accessories.map(({ name, icon, detail }) => ({ name: name.trim(), icon, detail })) };
      const res = await apiFetch("/api/recepcion", { method: "PUT", body: JSON.stringify(body) });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { sileo.error({ title: d?.error || "No se pudo guardar" }); return; }
      setCatalogo(d); const r = toRows(d); setRows(r); setBase(firma(r)); setPicker(null);
      sileo.success({ title: "Recepción guardada" });
    } catch { sileo.error({ title: "No se pudo guardar" }); } finally { setSaving(false); }
  };

  const lista = (l: Lista, titulo: string, ayuda: string) => {
    const items = rows[l];
    const movibles = l === "accessories" ? items.filter((x) => x.name !== OTROS).length : items.length;
    return (
      <div className="rcp-card">
        <div className="rcp-head">
          <div><h3>{titulo}</h3><p>{ayuda}</p></div>
          <button type="button" className="rcp-add" onClick={() => agregar(l)} disabled={items.length >= MAX_ITEMS}><Plus size={15} strokeWidth={STROKE} aria-hidden="true" /> Agregar</button>
        </div>
        <ul className="rcp-list">
          {items.map((x, i) => {
            const fijo = l === "accessories" && x.name === OTROS;
            return (
              <li key={x.id} className={fijo ? "fijo" : undefined}>
                <div className="rcp-row">
                  <span className="rcp-move">
                    {fijo ? <Lock size={14} strokeWidth={STROKE} aria-label="Fijo al final" /> : <>
                      <button type="button" aria-label={`Subir ${x.name || "fila"}`} disabled={i === 0} onClick={() => mover(l, i, -1)}><ArrowUp size={13} strokeWidth={STROKE} aria-hidden="true" /></button>
                      <button type="button" aria-label={`Bajar ${x.name || "fila"}`} disabled={i >= movibles - 1} onClick={() => mover(l, i, 1)}><ArrowDown size={13} strokeWidth={STROKE} aria-hidden="true" /></button>
                    </>}
                  </span>
                  <button type="button" className="rcp-ico" aria-label={`Cambiar ícono de ${x.name || "la fila"}`} aria-expanded={picker === x.id} onClick={() => setPicker(picker === x.id ? null : x.id)}><Icono k={x.icon} /></button>
                  {fijo ? <span className="rcp-fixed">{OTROS} <small>siempre al final</small></span>
                    : <input className="rcp-name" value={x.name} maxLength={MAX_NAME} aria-label="Nombre" autoFocus={!x.name} onChange={(e) => upd(l, x.id, { name: e.target.value })} />}
                  {l === "accessories" && <label className="rcp-det"><input type="checkbox" checked={x.detail} onChange={(e) => upd(l, x.id, { detail: e.target.checked })} /> Pedir detalle</label>}
                  {!fijo && (borrar === x.id
                    ? <button type="button" className="rcp-del sure" onClick={() => quitar(l, x.id)} onBlur={() => setBorrar(null)} autoFocus>¿Quitar?</button>
                    : <button type="button" className="rcp-del" aria-label={`Quitar ${x.name || "fila"}`} onClick={() => setBorrar(x.id)}><Trash2 size={15} strokeWidth={STROKE} aria-hidden="true" /></button>)}
                </div>
                {picker === x.id && (
                  <div className="rcp-picker" role="radiogroup" aria-label="Ícono">
                    {ICON_KEYS.map((k: IconKey) => (
                      <button key={k} type="button" role="radio" aria-checked={x.icon === k} title={ICONOS_RECEPCION[k].label} aria-label={ICONOS_RECEPCION[k].label} onClick={() => { upd(l, x.id, { icon: k }); setPicker(null); }}><Icono k={k} /></button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <>
      {lista("devices", "Tipos de equipo", "Los botones de \"Equipo\" al recibir una orden.")}
      {lista("accessories", "Accesorios", "Lo que el cliente deja con el equipo. \"Pedir detalle\" abre un campo para anotar modelo, color, etc.")}
      <p className="rcp-note">Las órdenes ya creadas no cambian: guardan el tipo y los accesorios como texto.</p>
      {error && <p className="rcp-err" role="alert">{error}</p>}
      <div className="rcp-actions">
        <button type="button" className="rcp-undo" onClick={() => { const r = toRows(catalogo); setRows(r); setPicker(null); }} disabled={!cambiado || saving}><RotateCcw size={15} strokeWidth={STROKE} aria-hidden="true" /> Deshacer cambios</button>
        <button type="button" className="rcp-save" onClick={guardar} disabled={!cambiado || !!error || saving}>{saving ? "Guardando…" : cambiado ? "Guardar recepción" : "Recepción guardada"}</button>
      </div>
    </>
  );
}
