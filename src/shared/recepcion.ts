// Catálogo de recepción: tipos de equipo y accesorios que se editan en Configuración → Recepción de equipos.
// Se guarda en KeyValue (recepcion:catalogo); si no hay nada guardado se usan estos valores por defecto.

export interface TipoEquipo { name: string; icon: string; imei: boolean }
export interface AccesorioCfg { name: string; icon: string; detail: boolean }
export interface CatalogoRecepcion { devices: TipoEquipo[]; accessories: AccesorioCfg[] }

export const ICON_KEYS = [
  "celular", "laptop", "pc", "consola", "joystick", "tablet", "impresora", "reloj", "camara", "servidor", "radio", "placa",
  "cargador", "bateria", "funda", "chip", "disco", "ram", "cable", "pantalla", "teclado", "tornillos", "maletin", "bolsa",
  "caja", "llave", "tuerca", "cd", "etiqueta", "documento", "rayo", "otros",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];
const esIcono = (v: unknown): v is IconKey => typeof v === "string" && (ICON_KEYS as readonly string[]).includes(v);

export const OTROS = "Otros";
export const MAX_ITEMS = 30;
export const MAX_NAME = 30;

const TODOS_LOS_TIPOS: TipoEquipo[] = [
  { name: "Celular", icon: "celular", imei: true }, { name: "Laptop", icon: "laptop", imei: false }, { name: "PC", icon: "pc", imei: false },
  { name: "Consola", icon: "consola", imei: false }, { name: "Tablet", icon: "tablet", imei: true }, { name: "Impresora", icon: "impresora", imei: false },
];

export const CATALOGO_DEFAULT: CatalogoRecepcion = {
  devices: TODOS_LOS_TIPOS,
  accessories: [
    { name: "Cargador", icon: "cargador", detail: true }, { name: "Batería", icon: "bateria", detail: true },
    { name: "Funda", icon: "funda", detail: false }, { name: "Chip / SIM", icon: "chip", detail: false },
    { name: "Disco Duro", icon: "disco", detail: true }, { name: "Memoria RAM", icon: "ram", detail: true },
    { name: "Cable de Poder", icon: "cable", detail: true }, { name: "Pantalla", icon: "pantalla", detail: true },
    { name: "Tornillos", icon: "tornillos", detail: true }, { name: "Maletín/Bolsa", icon: "maletin", detail: true },
    { name: OTROS, icon: "otros", detail: true },
  ],
};

const limpiar = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_NAME) : "");

function unicos<T extends { name: string }>(items: T[]): T[] {
  const vistos = new Set<string>();
  return items.filter((it) => { const k = it.name.toLowerCase(); if (!it.name || vistos.has(k)) return false; vistos.add(k); return true; });
}

// Limpia lo que llega del navegador: nombres recortados y sin repetir, íconos válidos, "Otros" siempre al final
// Celulares y tablets traen IMEI; el resto, N° de serie. Se usa para tipos escritos a mano o catálogos sin la marca
export const pareceConImei = (device: string) => /celular|tel[eé]fono|smartphone|iphone|m[oó]vil|tablet|ipad/i.test(device);

// "imei" si el tipo de equipo usa IMEI (configurable en Recepción de equipos), si no "serie"
export function modoIdentificador(c: CatalogoRecepcion, device: string): "imei" | "serie" {
  const d = device.trim().toLowerCase();
  const t = c.devices.find((x) => x.name.toLowerCase() === d);
  return (t ? t.imei : pareceConImei(device)) ? "imei" : "serie";
}

export function normalizeCatalogo(raw: unknown): CatalogoRecepcion {
  const r = (raw && typeof raw === "object" ? raw : {}) as { devices?: unknown; accessories?: unknown };
  const devices = Array.isArray(r.devices)
    ? unicos(r.devices.map((d) => ({ name: limpiar(d?.name), icon: esIcono(d?.icon) ? d.icon : "pc", imei: typeof d?.imei === "boolean" ? d.imei : pareceConImei(limpiar(d?.name)) }))).slice(0, MAX_ITEMS)
    : CATALOGO_DEFAULT.devices;
  const otrosCfg = CATALOGO_DEFAULT.accessories.find((a) => a.name === OTROS)!;
  const acc = Array.isArray(r.accessories)
    ? unicos(r.accessories.map((a) => ({ name: limpiar(a?.name), icon: esIcono(a?.icon) ? a.icon : "otros", detail: !!a?.detail })))
    : CATALOGO_DEFAULT.accessories;
  const otros = acc.find((a) => a.name.toLowerCase() === OTROS.toLowerCase());
  const accessories = [...acc.filter((a) => a.name.toLowerCase() !== OTROS.toLowerCase()).slice(0, MAX_ITEMS - 1), { ...otrosCfg, detail: otros ? otros.detail : true }];
  return { devices: devices.length ? devices : CATALOGO_DEFAULT.devices, accessories };
}
