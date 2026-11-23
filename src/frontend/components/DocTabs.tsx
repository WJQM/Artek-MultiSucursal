"use client";
// Pestañas de los documentos completos (CE, COT, NV) — solo se ven en el celular.
// Cada bloque del documento lleva data-tab="id" y el contenedor .doc-full lleva data-tab con la pestaña activa;
// el CSS (globals.css, bloque "DOCUMENTO EN PESTAÑAS") oculta lo demás. En computadora y al imprimir se ve todo.
import { useRef } from "react";

export interface DocTab { id: string; label: string }

export function DocTabs({ tabs, active, onChange, color }: { tabs: DocTab[]; active: string; onChange: (id: string) => void; color: string }) {
  return (
    <div className="doc-tabs no-print" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === active}
          onClick={() => { onChange(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{ color: t.id === active ? color : "var(--text-muted)", borderBottomColor: t.id === active ? color : "transparent" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Deslizar a la izquierda/derecha cambia de pestaña. */
export function useSwipeTabs(tabs: DocTab[], active: string, onChange: (id: string) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current; start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const i = tabs.findIndex((x) => x.id === active);
      const next = tabs[i + (dx < 0 ? 1 : -1)];
      if (next) { onChange(next.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
    },
  };
}
