import { type AppIcon, AppWindow, BadgeCheck, BatteryFull, CircuitBoard, Cpu, Gamepad2, HardDrive, Joystick, Laptop, Layers, Monitor, Package, Palette, RefreshCw, Server, Store, Tag, Zap } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { ProductSpec } from "@/frontend/components/ProductPrint";
import type { ReactNode } from "react";

// Datos de la ficha de venta de un equipo (EQ) o una consola (CN). Los usan la ficha individual
// (/equipment/print/[id], /consoles/print/[id]) y las fichas por lote (/qr-batch/fichas), así se ven iguales.

export interface FichaData {
  icon: ReactNode; docLabel: string; kind: string; kindColor: string; cond: { label: string; color: string };
  code: string; name: string; price: number; image: string | null; url: string; specs: ProductSpec[];
  accessories: string | null; notes: string | null; branch?: string;
}

export interface EquipmentLike {
  id: string; code: string; type: string; brand: string | null; model: string | null;
  processor: string | null; ram: string | null; storage: string | null; storage2: string | null;
  screenSize: string | null; graphicsCard: string | null; os: string | null; cabinet: string | null;
  powerSupply: string | null; motherboard: string | null; accessories: string | null;
  condition: string; price: number; notes: string | null; image: string | null; branch?: { id: string; name: string } | null;
}

export interface ConsoleLike {
  id: string; code: string; name: string; category: string | null; state: string | null;
  brand: string | null; model: string | null; color: string | null; storage: string | null; generation: string | null;
  accessories: string | null; condition: string; price: number; notes: string | null; image: string | null;
  branch?: { id: string; name: string } | null;
}

export function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const arr = JSON.parse(img); if (Array.isArray(arr)) return arr.filter(Boolean); } catch {}
  return img.trim() ? [img] : [];
}

const ic = (I: AppIcon) => <I size={18} strokeWidth={STROKE} aria-hidden="true" />;

const EQ_COND: Record<string, { label: string; color: string }> = {
  disponible: { label: "Disponible", color: "#10b981" },
  vendido: { label: "Vendido", color: "#0e7c86" },
  en_reparacion: { label: "En reparación", color: "#f59e0b" },
};
const CN_COND: Record<string, { label: string; color: string }> = {
  disponible: { label: "Disponible", color: "#10b981" },
  vendida: { label: "Vendida", color: "#0e7c86" },
  reservada: { label: "Reservada", color: "#f59e0b" },
};

export function equipmentName(eq: Pick<EquipmentLike, "type" | "brand" | "model" | "cabinet">): string {
  if (eq.type === "desktop") {
    const cab = (eq.cabinet || "").trim();
    return cab ? `PC Escritorio ${cab}` : "PC Escritorio";
  }
  return ["Laptop", eq.brand, eq.model].filter(Boolean).join(" ") || "Laptop";
}

export function consoleName(cn: Pick<ConsoleLike, "brand" | "name" | "model">): string {
  return [cn.brand, cn.name, cn.model].filter(Boolean).join(" ").trim() || cn.name;
}

export function equipmentFicha(eq: EquipmentLike, baseUrl: string): FichaData {
  const specs: ProductSpec[] = [];
  if (eq.processor) specs.push({ icon: ic(Cpu), label: "Procesador", value: eq.processor });
  if (eq.ram) specs.push({ icon: ic(Zap), label: "Memoria RAM", value: eq.ram });
  if (eq.storage) specs.push({ icon: ic(HardDrive), label: "Disco principal", value: eq.storage });
  if (eq.storage2) specs.push({ icon: ic(HardDrive), label: "Disco secundario", value: eq.storage2 });
  if (eq.screenSize) specs.push({ icon: ic(Monitor), label: "Pantalla", value: eq.screenSize });
  if (eq.graphicsCard) specs.push({ icon: ic(Gamepad2), label: "Gráficos", value: eq.graphicsCard });
  if (eq.os) specs.push({ icon: ic(AppWindow), label: "Sistema", value: eq.os });
  if (eq.cabinet) specs.push({ icon: ic(Server), label: "Gabinete", value: eq.cabinet });
  if (eq.motherboard) specs.push({ icon: ic(CircuitBoard), label: "Placa madre", value: eq.motherboard });
  if (eq.powerSupply) specs.push({ icon: ic(BatteryFull), label: "Fuente de poder", value: eq.powerSupply });
  if (eq.brand && eq.type === "desktop") specs.unshift({ icon: ic(Tag), label: "Marca", value: eq.brand });
  return {
    icon: eq.type === "laptop" ? ic(Laptop) : ic(Monitor), docLabel: "En venta",
    kind: eq.type === "laptop" ? "Laptop" : "PC de escritorio", kindColor: "#0e7490",
    cond: EQ_COND[eq.condition] || EQ_COND.disponible, code: eq.code || "EQ-?", name: equipmentName(eq), price: eq.price,
    image: parseImages(eq.image)[0] || null, url: baseUrl ? `${baseUrl}/portal?eq=${eq.id}` : "", specs,
    accessories: eq.accessories, notes: eq.notes, branch: eq.branch?.name,
  };
}

export function consoleFicha(cn: ConsoleLike, baseUrl: string): FichaData {
  const specs: ProductSpec[] = [];
  if (cn.brand) specs.push({ icon: ic(Store), label: "Marca", value: cn.brand });
  if (cn.model) specs.push({ icon: ic(Package), label: "Modelo", value: cn.model });
  if (cn.category) specs.push({ icon: ic(Tag), label: "Categoría", value: cn.category });
  if (cn.state) specs.push({ icon: cn.state === "Nueva" ? ic(BadgeCheck) : ic(RefreshCw), label: "Estado", value: cn.state });
  if (cn.color) specs.push({ icon: ic(Palette), label: "Color", value: cn.color });
  if (cn.storage) specs.push({ icon: ic(HardDrive), label: "Almacenamiento", value: cn.storage });
  if (cn.generation) specs.push({ icon: ic(Layers), label: "Generación", value: cn.generation });
  return {
    icon: ic(Joystick), docLabel: "En venta", kind: "Consola", kindColor: "#c2410c",
    cond: CN_COND[cn.condition] || CN_COND.disponible, code: cn.code || "CN-?", name: consoleName(cn), price: cn.price,
    image: parseImages(cn.image)[0] || null, url: baseUrl ? `${baseUrl}/portal?cn=${cn.id}` : "", specs,
    accessories: cn.accessories, notes: cn.notes, branch: cn.branch?.name,
  };
}
