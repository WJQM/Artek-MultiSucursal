// Límites del extracto general impreso. Más equipos que esto ya no caben en una impresión
// (el navegador se queda sin memoria al preparar la vista previa): se pide un rango o el Excel.
export const EXTRACTO_MAX = 2000;
/** Filas por hoja carta horizontal (aproximado, solo para avisar cuántas hojas saldrán). */
export const EXTRACTO_FILAS_POR_HOJA = 30;
export const extractoHojas = (equipos: number) => Math.max(1, Math.ceil(equipos / EXTRACTO_FILAS_POR_HOJA));

/** Filtros del extracto que viajan en la dirección de la hoja (/extracto/imprimir?…). */
export interface ExtractoFiltros { q?: string; estado?: "open" | "delivered" | ""; desde?: string; hasta?: string; sucursal?: string }

export function extractoQuery(f: ExtractoFiltros) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.estado) p.set("estado", f.estado);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.sucursal) p.set("sucursal", f.sucursal);
  return p;
}

/** Los mismos filtros, en el formato de /api/repairs. */
export function extractoApiParams(f: ExtractoFiltros) {
  const p = new URLSearchParams({ sort: "old" });
  if (f.q) p.set("search", f.q);
  if (f.estado) p.set("status", f.estado);
  if (f.desde) p.set("from", f.desde);
  if (f.hasta) p.set("to", f.hasta);
  return p;
}
