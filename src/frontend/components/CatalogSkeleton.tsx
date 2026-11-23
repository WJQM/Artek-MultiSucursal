/** 5 · Carga con esqueleto para los catálogos: la forma de las tarjetas con un brillo que pasa */
export function CatalogSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div aria-label="Cargando" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 45%), 1fr))", gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div className="skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
          <div style={{ padding: "10px 12px" }}>
            <div className="skeleton" style={{ height: 13, width: "75%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 11, width: "45%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
