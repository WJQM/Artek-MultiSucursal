// Íconos que se pueden elegir para tipos de equipo y accesorios
import {
  type AppIcon, Backpack, BatteryFull, Box, Cable, Camera, CircuitBoard, Cpu, Disc3, FileText, Gamepad2, HardDrive, Joystick, KeyRound,
  Keyboard, Laptop, MemoryStick, Monitor, Nut, Plug, Plus, Printer, Radio, Server, Shield, ShoppingBag, Smartphone, Tablet, Tag, Watch, Wrench, Zap,
} from "@/frontend/components/icons";
import type { IconKey } from "@/shared/recepcion";

export const ICONOS_RECEPCION: Record<IconKey, { I: AppIcon; label: string }> = {
  celular: { I: Smartphone, label: "Celular" }, laptop: { I: Laptop, label: "Laptop" }, pc: { I: Monitor, label: "PC o monitor" },
  consola: { I: Gamepad2, label: "Consola o mando" }, joystick: { I: Joystick, label: "Joystick" }, tablet: { I: Tablet, label: "Tablet" },
  impresora: { I: Printer, label: "Impresora" }, reloj: { I: Watch, label: "Reloj" }, camara: { I: Camera, label: "Cámara" },
  servidor: { I: Server, label: "Servidor" }, radio: { I: Radio, label: "Radio o router" }, placa: { I: CircuitBoard, label: "Placa" },
  cargador: { I: Plug, label: "Cargador" }, bateria: { I: BatteryFull, label: "Batería" }, funda: { I: Shield, label: "Funda" },
  chip: { I: Cpu, label: "Chip" }, disco: { I: HardDrive, label: "Disco" }, ram: { I: MemoryStick, label: "Memoria" },
  cable: { I: Cable, label: "Cable" }, pantalla: { I: Monitor, label: "Pantalla" }, teclado: { I: Keyboard, label: "Teclado" },
  tornillos: { I: Wrench, label: "Herramienta" }, maletin: { I: Backpack, label: "Mochila" }, bolsa: { I: ShoppingBag, label: "Bolsa" },
  caja: { I: Box, label: "Caja" }, llave: { I: KeyRound, label: "Llave" }, tuerca: { I: Nut, label: "Tuerca" },
  cd: { I: Disc3, label: "Disco CD" }, etiqueta: { I: Tag, label: "Etiqueta" }, documento: { I: FileText, label: "Documento" },
  rayo: { I: Zap, label: "Energía" }, otros: { I: Plus, label: "Otros" },
};

export const iconoRecepcion = (key: string | undefined): AppIcon | null => (key && key in ICONOS_RECEPCION ? ICONOS_RECEPCION[key as IconKey].I : null);
