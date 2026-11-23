import type { AppIcon } from "@/frontend/components/icons";
import {
  Brush, Disc3, Droplet, FolderOpen, Hammer, Keyboard, Radio, Thermometer, Zap,
  Backpack, BatteryFull, Cable, CircleCheck, Cpu, Gamepad2, Handshake, HardDrive, Hourglass, Inbox, Laptop, Lock, MemoryStick, MessageCircle,
  Monitor, Package, Plug, Plus, Printer, RefreshCw, Search, Shield, Smartphone, Star, Tablet, Watch, Wrench,
} from "@/frontend/components/icons";

/**
 * Íconos del sistema (Phosphor, dos tonos): un solo estilo y el color del texto que acompañan.
 * Reemplazan a los emojis de estados, equipos y avisos.
 */
export const STROKE = 1.75;

const STATUS_ICON: Record<string, AppIcon> = {
  pending: Hourglass, diagnosed: Search, waiting_parts: Package, in_progress: Wrench, completed: CircleCheck, delivered: Handshake,
};

export function StatusIcon({ status, size = 16, className, color }: { status: string; size?: number; className?: string; color?: string }) {
  const I = STATUS_ICON[status] || Hourglass;
  return <I size={size} strokeWidth={STROKE} className={className} color={color} aria-hidden="true" />;
}

const DEVICE_ICON: Record<string, AppIcon> = { consola: Gamepad2, laptop: Laptop, pc: Monitor, tablet: Tablet, impresora: Printer, reloj: Watch, celular: Smartphone, otro: Wrench };

function deviceKind(device: string | null | undefined): string {
  const d = (device || "").toLowerCase();
  if (/consola|playstation|ps[345]|xbox|nintendo|switch/.test(d)) return "consola";
  if (/laptop|notebook|port[aá]til|macbook/.test(d)) return "laptop";
  if (/pc|computadora|cpu|escritorio|monitor|all.?in.?one/.test(d)) return "pc";
  if (/tablet|ipad/.test(d)) return "tablet";
  if (/impresora/.test(d)) return "impresora";
  if (/reloj|watch/.test(d)) return "reloj";
  if (/celular|tel[eé]fono|smartphone|iphone|m[oó]vil/.test(d)) return "celular";
  return "otro";
}

export function DeviceIcon({ device, size = 16, className }: { device: string | null | undefined; size?: number; className?: string }) {
  const I = DEVICE_ICON[deviceKind(device)];
  return <I size={size} strokeWidth={STROKE} className={className} aria-hidden="true" />;
}

const NOTIF_ICON: Record<string, AppIcon> = { status_change: RefreshCw, new_repair: Inbox, message: MessageCircle, system: Lock, review: Star };

export function NotifIcon({ type, size = 18 }: { type: string; size?: number }) {
  const I = NOTIF_ICON[type] || Inbox;
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}

/** Punto de color del estado (en vez de un emoji) */
export function StatusDot({ color }: { color: string }) {
  return <i className="st-dot" style={{ background: color }} aria-hidden="true" />;
}

/** Código de orden como una pequeña etiqueta impresa: el sello propio del sistema */
export function OrderTag({ code, dark }: { code: string; dark?: boolean }) {
  return <span className={`ot-tape${dark ? " dark" : ""}`}>{code}</span>;
}

const ACCESSORY_ICON: Record<string, AppIcon> = {
  "Cargador": Plug, "Batería": BatteryFull, "Funda": Shield, "Chip / SIM": Cpu, "Disco Duro": HardDrive, "Memoria RAM": MemoryStick,
  "Cable de Poder": Cable, "Pantalla": Monitor, "Tornillos": Wrench, "Maletín/Bolsa": Backpack,
};
/** Accesorio que deja el cliente (Cargador, Batería…); los que no están en la lista usan "+". */
export function AccessoryIcon({ name, size = 16 }: { name: string; size?: number }) {
  const I = ACCESSORY_ICON[name] || Plus;
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}

/** Íconos que se pueden elegir para un servicio. Se guardan con su emoji de siempre (compatibles con lo ya guardado). */
export const SERVICE_ICONS: [string, AppIcon, string][] = [
  ["🔧", Wrench, "llave"], ["🔍", Search, "lupa"], ["🧹", Brush, "limpieza"], ["💿", Disc3, "disco"], ["🌡️", Thermometer, "temperatura"],
  ["💾", HardDrive, "disco duro"], ["🧠", MemoryStick, "memoria"], ["🖥️", Monitor, "pantalla"], ["💧", Droplet, "líquido"], ["⌨️", Keyboard, "teclado"],
  ["🔋", BatteryFull, "batería"], ["📂", FolderOpen, "archivos"], ["🛠️", Hammer, "herramientas"], ["⚡", Zap, "energía"], ["🖨️", Printer, "impresora"],
  ["📡", Radio, "señal"], ["🔌", Plug, "enchufe"], ["💻", Laptop, "laptop"], ["📱", Smartphone, "celular"], ["🎮", Gamepad2, "consola"],
];
const SERVICE_ICON: Record<string, AppIcon> = Object.fromEntries(SERVICE_ICONS.map(([k, v]) => [k.replace("\uFE0F", ""), v]));
/** Ícono de un servicio a partir de lo guardado; si no se reconoce, una llave. */
export function ServiceIcon({ icon, size = 16 }: { icon?: string | null; size?: number }) {
  const key = (icon || "").replace("\uFE0F", "");
  const I = SERVICE_ICON[key] || Wrench;
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}
