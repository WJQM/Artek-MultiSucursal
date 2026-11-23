"use client";
import { useEffect } from "react";

/**
 * 7 · Catálogos (sistema y portal): las tarjetas entran una tras otra cuando aparecen en
 * pantalla al bajar, también al cambiar de página o de pestaña. Se aplica a toda rejilla
 * .catalog-grid / .portal-grid sin tocar cada pantalla. Sin soporte, se ven normal.
 */
const GRID = ".catalog-grid, .portal-grid";

export function MotionGlobal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let batch = 0, timer = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        el.style.animationDelay = `${Math.min(batch++, 10) * 60}ms`;
        el.dataset.reveal = "in";
      }
      clearTimeout(timer);
      timer = window.setTimeout(() => { batch = 0; }, 150);
    }, { rootMargin: "0px 0px -6% 0px" });

    const prepare = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(`:is(${GRID}) > *:not([data-reveal])`).forEach((el) => {
        el.style.animation = "none"; // quita la entrada anterior de la tarjeta; la reemplaza esta
        el.dataset.reveal = "wait";
        io.observe(el);
      });
    };
    prepare(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) prepare((n as Element).parentElement || document); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); clearTimeout(timer); };
  }, []);
  return null;
}
