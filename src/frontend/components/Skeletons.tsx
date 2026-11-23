// Esqueletos de carga: cajas grises con la forma del contenido que viene, en vez de "Cargando...".
// Usan la animación .skeleton de globals.css (se queda quieta con "reducir movimiento").
// Estilos propios en globals.css bajo "Esqueletos de carga".

function Bar({ w, h, r = 7, dark = false }: { w: number | string; h: number; r?: number; dark?: boolean }) {
  return <div className={dark ? "skeleton-dark" : "skeleton"} style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />;
}

function Busy({ label, children, className, style }: { label: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div role="status" aria-busy="true" className={className} style={style}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Tarjetas de montos y un gráfico (Estadísticas, Caja chica). */
export function StatsSkeleton({ cards = 3, chart = true }: { cards?: number; chart?: boolean }) {
  return (
    <Busy label="Cargando datos…" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="sk-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="sk-card"><Bar w="45%" h={11} /><div style={{ height: 12 }} /><Bar w="70%" h={22} /></div>
        ))}
      </div>
      {chart && (
        <div className="sk-card" style={{ height: 180, display: "flex", alignItems: "flex-end", gap: 12 }}>
          {[40, 70, 55, 90, 65, 100].map((h, i) => <div key={i} className="skeleton" style={{ flex: 1, height: `${h}%`, borderRadius: 6 }} />)}
        </div>
      )}
    </Busy>
  );
}

/** Filas con foto, nombre y botón (Usuarios, Servicios, Sucursales, Certificados…). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Busy label="Cargando lista…" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <Bar w={40} h={40} r={10} />
          <div style={{ flex: 1, minWidth: 0 }}><Bar w="45%" h={13} /><div style={{ height: 7 }} /><Bar w="30%" h={10} /></div>
          <Bar w={70} h={26} r={8} />
        </div>
      ))}
    </Busy>
  );
}

/** Pantalla interna completa mientras se lee la sesión: menú lateral (o barra superior en celular) y la forma de la página. */
export function PageSkeleton() {
  return (
    <Busy label="Cargando…" className="sk-page">
      <div className="sk-side">
        <Bar w="70%" h={14} r={5} dark />
        <div style={{ height: 8 }} />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}><Bar w={16} h={16} r={4} dark /><Bar w={`${50 + (i % 3) * 12}%`} h={11} r={4} dark /></div>
        ))}
      </div>
      <div className="sk-top" />
      <div className="sk-main">
        <Bar w="32%" h={24} /><Bar w="22%" h={12} />
        <div style={{ height: 4 }} />
        <StatsSkeleton chart={false} />
        <ListSkeleton rows={3} />
      </div>
    </Busy>
  );
}

/** Hoja para imprimir (comprobante, cotización, fichas). */
export function DocSkeleton() {
  return (
    <Busy label="Cargando documento…" className="sk-doc-wrap">
      <div className="sk-doc">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><Bar w="40%" h={22} /><Bar w="22%" h={22} /></div>
        <Bar w="55%" h={12} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 6 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}><Bar w="60%" h={10} /><div style={{ height: 7 }} /><Bar w="85%" h={14} /></div>)}
        </div>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><Bar w="55%" h={12} /><Bar w="15%" h={12} /></div>)}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}><Bar w="30%" h={28} r={8} /></div>
      </div>
    </Busy>
  );
}
