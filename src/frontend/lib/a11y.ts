import type { KeyboardEvent, PointerEvent } from "react";

/** Efectos de "pasar por encima": funcionan con mouse o lápiz y no se quedan pegados al tocar con el dedo. */
export function mouseOnly<T extends Element>(handler: (e: PointerEvent<T>) => void) {
  return (e: PointerEvent<T>) => { if (e.pointerType !== "touch") handler(e); };
}

/** Enter o Espacio activan un elemento con onClick que no es un botón nativo (tarjetas, fotos, íconos). */
export function pressKey(e: KeyboardEvent<HTMLElement>) {
  if (e.target !== e.currentTarget) return; // un botón dentro de la tarjeta conserva su propia acción
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  e.currentTarget.click();
}
