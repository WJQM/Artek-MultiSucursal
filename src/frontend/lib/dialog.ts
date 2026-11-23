/**
 * Confirmaciones y mensajes con el diseño del sistema (reemplazan a confirm/alert/prompt del navegador).
 * `await askConfirm("¿Eliminar este item?")` devuelve true solo si la persona acepta.
 * La ventana se dibuja en DialogHost, montado una sola vez en la raíz.
 */
export interface ConfirmOpts { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
export type DialogItem =
  | { id: number; kind: "confirm"; message: string; title?: string; confirmLabel: string; cancelLabel: string; danger: boolean; resolve: (ok: boolean) => void }
  | { id: number; kind: "notice"; message: string; title?: string; confirmLabel: string; resolve: (ok: boolean) => void }
  | { id: number; kind: "copy"; message: string; text: string; confirmLabel: string; resolve: (ok: boolean) => void };

type NewItem = DialogItem extends infer T ? (T extends DialogItem ? Omit<T, "id" | "resolve"> : never) : never;

let queue: DialogItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: DialogItem[] = [];

export const dialogStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => queue,
  empty: EMPTY,
};

function push(item: NewItem) {
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...item, id: nextId++, resolve } as DialogItem];
    emit();
  });
}

export function closeDialog(id: number, ok: boolean) {
  const item = queue.find((d) => d.id === id);
  if (!item) return;
  queue = queue.filter((d) => d.id !== id);
  emit();
  item.resolve(ok);
}

/** Nombra los botones según la pregunta: "¿Eliminar…?" → Eliminar; "¿Cancelar…?" → Sí, cancelar / Volver */
function labelsFor(message: string) {
  const q = message.slice(message.lastIndexOf("¿") + 1);
  const verb = /^\p{L}+/u.exec(q)?.[0] || "";
  const wantsCancel = /^cancelar$/i.test(verb) || /^seguro\b.*\bcancelar\b/i.test(q);
  if (wantsCancel) return { confirmLabel: "Sí, cancelar", cancelLabel: "Volver", danger: true };
  if (/^seguro$/i.test(verb)) return { confirmLabel: "Sí, continuar", cancelLabel: "Volver", danger: true };
  const danger = /^(eliminar|borrar|rechazar|desactivar|quitar)$/i.test(verb);
  const known = /^(eliminar|borrar|rechazar|desactivar|quitar|transferir|convertir|generar|reabrir|tomar|continuar)$/i.test(verb);
  if (/^(enviarle|avisarle)$/i.test(verb)) return { confirmLabel: "Sí, enviar", cancelLabel: "No enviar", danger: false };
  if (/^cerrar$/i.test(verb)) return { confirmLabel: "Sí, cerrar", cancelLabel: "Volver", danger: false };
  return { confirmLabel: known ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : "Aceptar", cancelLabel: "Cancelar", danger };
}

export function askConfirm(message: string, opts: ConfirmOpts = {}) {
  return push({ kind: "confirm", message, ...labelsFor(message), ...opts });
}

export function showNotice(message: string, title?: string) {
  return push({ kind: "notice", message, title, confirmLabel: "Entendido" }).then(() => undefined);
}

/** Para cuando el navegador no deja copiar: muestra el texto listo para seleccionar */
export function showCopy(message: string, text: string) {
  return push({ kind: "copy", message, text, confirmLabel: "Cerrar" }).then(() => undefined);
}
