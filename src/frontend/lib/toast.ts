// Avisos del sistema ("Guardado", "WhatsApp enviado"…). Todas las pantallas llaman a
// sileo.success/error/warning/info({ title, description? }); se muestran como tarjetas
// pequeñas debajo de la campana (computadora) o debajo del encabezado (celular).
// Componente: src/frontend/components/Toaster.tsx

export type ToastKind = "success" | "error" | "warning" | "info";
export interface ToastOpts { title?: string; description?: string; duration?: number }
export interface ToastItem { id: number; kind: ToastKind; title: string; description?: string; duration: number; leaving?: boolean }

const DURATION = 3500;
const MAX = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const toastStore = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => items,
  empty: [] as ToastItem[],
};

function show(kind: ToastKind, input: ToastOpts | string = {}) {
  const opts: ToastOpts = typeof input === "string" ? { title: input } : input;
  const id = nextId++;
  const t: ToastItem = { id, kind, title: opts.title || "", description: opts.description, duration: opts.duration ?? (kind === "error" ? 5000 : DURATION) };
  items = [t, ...items].slice(0, MAX);
  emit();
  return id;
}

export function dismissToast(id?: number) {
  if (id === undefined) { items = []; emit(); return; }
  if (!items.some((t) => t.id === id)) return;
  // Primero la animación de salida, luego se quita
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => { items = items.filter((t) => t.id !== id); emit(); }, 220);
}

export const sileo = {
  success: (opts: ToastOpts | string) => show("success", opts),
  error: (opts: ToastOpts | string) => show("error", opts),
  warning: (opts: ToastOpts | string) => show("warning", opts),
  info: (opts: ToastOpts | string) => show("info", opts),
  /** Muestra "cargando…" y lo reemplaza por el resultado */
  promise<T>(p: Promise<T>, msgs: { loading: ToastOpts; success: ToastOpts | ((v: T) => ToastOpts); error: ToastOpts | ((e: unknown) => ToastOpts) }) {
    const id = show("info", { ...msgs.loading, duration: 60_000 });
    p.then((v) => { dismissToast(id); show("success", typeof msgs.success === "function" ? msgs.success(v) : msgs.success); })
      .catch((e) => { dismissToast(id); show("error", typeof msgs.error === "function" ? msgs.error(e) : msgs.error); });
    return p;
  },
  dismiss: (id?: number) => dismissToast(id),
  clear: () => dismissToast(),
};
