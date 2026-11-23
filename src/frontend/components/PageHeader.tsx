// Encabezado común de las páginas internas: emoji + título + descripción a la izquierda y botones a la derecha.
import type { ReactNode } from "react";

export function PageHeader({ icon, title, subtitle, children }: { icon?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>{icon && <span aria-hidden="true">{icon}</span>}{title}</h1>
        {subtitle && <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}
