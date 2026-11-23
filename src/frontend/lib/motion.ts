"use client";

/**
 * Animaciones del sistema (livianas, sin librerías). Todas respetan "reducir movimiento"
 * del sistema operativo: los estilos de globals.css las apagan y aquí se evita el confeti.
 * Trabajan directo sobre el DOM (clases CSS), así no provocan renders extra de React.
 */
import { useEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Vuelve a reproducir una animación CSS aunque ya se haya reproducido antes */
export function replay(el: Element | null | undefined, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  const done = () => { el.classList.remove(cls); el.removeEventListener("animationend", done); };
  el.addEventListener("animationend", done);
}

/**
 * 1 · Resaltado en tiempo real: cuando la lista se recarga y un elemento cambió (o es nuevo),
 * su tarjeta [data-flash-id] se ilumina un momento. La primera carga no resalta nada.
 */
export function useFlashChanges<T>(items: T[], id: (x: T) => string, signature: (x: T) => string) {
  const prev = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const now = new Map(items.map((x) => [id(x), signature(x)]));
    const before = prev.current;
    prev.current = now;
    if (!before || before.size === 0) return;
    const changed = [...now].filter(([k, v]) => before.get(k) !== v).map(([k]) => k);
    if (!changed.length || changed.length > 8) return; // cambio de página/filtro: no resaltar todo
    requestAnimationFrame(() => {
      for (const k of changed) {
        const card = document.querySelector(`[data-flash-id="${CSS.escape(k)}"]`);
        replay(card, "rt-flash");
        replay(card?.querySelector("[data-flip]"), "rt-flip");
      }
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** 2 · Avisos: anima un elemento cuando un contador sube (campana, burbuja del chat) */
export function useBumpOnIncrease(value: number, target: React.RefObject<HTMLElement | null>, cls: string) {
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && value > prev.current) replay(target.current, cls);
    prev.current = value;
  }, [value, target, cls]);
}

/** 3 · Contador animado: sube desde 0 la primera vez y late cuando cambia */
export function useCountUp(value: number, ref: React.RefObject<HTMLElement | null>) {
  const shown = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current ?? 0;
    const first = shown.current === null;
    shown.current = value;
    if (from === value && !first) return;
    if (!first) replay(el, "rt-bump");
    if (reduced() || from === value) { el.textContent = String(value); return; }
    const ms = first ? 900 : 450, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      el.textContent = String(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); el.textContent = String(value); };
  }, [value, ref]);
}

/** 4 · Confirmación al avanzar una orden: check dibujado; al completar, confeti */
export function celebrate(kind: "advance" | "complete" = "advance") {
  if (typeof document === "undefined") return;
  const wrap = document.createElement("div");
  wrap.className = "rt-celebrate";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = `<svg class="rt-check" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M20 33l8 8 16-17"/></svg>`;
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1500);
  if (kind === "complete" && !reduced()) confetti();
}

function confetti() {
  const cv = document.createElement("canvas");
  cv.className = "rt-confetti";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext("2d");
  if (!ctx) { cv.remove(); return; }
  ctx.scale(dpr, dpr);
  const colors = ["#1ab8c4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"];
  let parts = Array.from({ length: 140 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 80, y: h * 0.42, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4,
    s: 5 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, life: 1,
  }));
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += 0.2; p.life -= 0.009;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    parts = parts.filter((p) => p.life > 0 && p.y < h + 30);
    if (parts.length) requestAnimationFrame(tick); else cv.remove();
  };
  requestAnimationFrame(tick);
}

/**
 * 7 · Aparecer al bajar: los hijos [data-reveal] del contenedor entran uno tras otro
 * cuando se hacen visibles. Sin JavaScript (o sin soporte) se ven normal desde el inicio.
 */
export function useReveal(container: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const root = container.current;
    if (!root || reduced() || typeof IntersectionObserver === "undefined") return;
    const items = [...root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal='in'])")];
    if (!items.length) return;
    items.forEach((el) => { el.dataset.reveal = "wait"; });
    let batch = 0, timer = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        el.style.animationDelay = `${Math.min(batch++, 8) * 70}ms`;
        el.dataset.reveal = "in";
      }
      clearTimeout(timer);
      timer = window.setTimeout(() => { batch = 0; }, 120);
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
    return () => { io.disconnect(); clearTimeout(timer); items.forEach((el) => { if (el.dataset.reveal === "wait") el.dataset.reveal = "in"; }); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** 9 · La fila se desliza hacia la derecha antes de salir de la lista (p. ej. orden entregada) */
export function slideOut(el: Element | null | undefined): Promise<void> {
  if (!el || reduced()) return Promise.resolve();
  return new Promise((done) => {
    el.classList.add("rt-out");
    setTimeout(done, 430);
  });
}
