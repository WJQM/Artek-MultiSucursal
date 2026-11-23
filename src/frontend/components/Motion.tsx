"use client";
// Piezas animadas reutilizables (ver lib/motion.ts y la sección "Animaciones" de globals.css).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCountUp } from "@/frontend/lib/motion";

/** 1 · Número que sube desde 0 al aparecer y late cuando cambia. */
export function CountUp({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(value, ref);
  return <span ref={ref} className={className} style={style}>{value}</span>;
}

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** ✓ verde que aparece donde estaba el botón cuando la ventana se cerró al guardar bien. */
function savedCheck(rect: DOMRect) {
  if (typeof document === "undefined" || reduced()) return;
  const el = document.createElement("div");
  el.className = "rt-saved";
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${rect.left + rect.width / 2 - 26}px`;
  el.style.top = `${rect.top + rect.height / 2 - 26}px`;
  el.textContent = "✓";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/**
 * 6 · Botón ámbar de guardar: mientras guarda se encoge y gira; si la ventana se cierra
 * (guardado bien) deja un ✓ verde un momento; si hubo error vuelve a ser botón.
 */
export function SaveButton({ onClick, disabled, children, className = "ox-go" }: {
  onClick: () => unknown; disabled?: boolean; children: ReactNode; className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const lastRect = useRef<DOMRect | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (lastRect.current) savedCheck(lastRect.current); };
  }, []);
  const run = async () => {
    if (busy || disabled) return;
    lastRect.current = ref.current?.getBoundingClientRect() ?? null;
    setBusy(true);
    try { await onClick(); } finally {
      // Se espera a que React aplique el cierre de la ventana: si sigue abierta (error o validación),
      // el botón vuelve a la normalidad; si se cerró, el desmontaje muestra el ✓
      setTimeout(() => { if (alive.current) { setBusy(false); lastRect.current = null; } }, 80);
    }
  };
  return (
    <button ref={ref} type="button" className={`${className}${busy ? " is-busy" : ""}`} onClick={run} disabled={disabled} aria-busy={busy}>
      <span className="lbl">{children}</span>{busy && <i className="rt-spin" aria-hidden="true" />}
    </button>
  );
}
