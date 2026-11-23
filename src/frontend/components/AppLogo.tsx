// Logo del sistema (propuesta B · "Anillo de estados"): seis tramos = los seis estados de una orden,
// de Pendiente a Entregado; el último apagado = la reparación en curso. Llave al centro.
// Se usa cuando la empresa no subió su propio logo en Configuración.
// El mismo dibujo está en public/logo.svg (y los íconos PNG de la app se generan desde ahí).

const SEGMENTS = ["#7ee7ef", "#4fd9e3", "#14a3ad", "#0e7c86", "#0b6b74"];
const WRENCH = "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z";

export function AppLogo({ size = 32, light = false, tile = light ? "#ffffff" : "#1e2a3a", title }: { size?: number; light?: boolean; tile?: string; title?: string }) {
  // En tamaños muy chicos, un anillo simple (los seis tramos se vuelven ruido)
  const tiny = size < 24;
  const pending = light ? "#dbe3ee" : "#3a4a5e";
  const center = light ? "#1e2a3a" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ display: "block", flexShrink: 0 }}>
      <rect width="100" height="100" rx="22" fill={tile} />
      {tiny ? (
        <circle cx="50" cy="50" r="30" fill="none" stroke="#14a3ad" strokeWidth="16" strokeDasharray="160 40" transform="rotate(-90 50 50)" />
      ) : (
        <>
          <g fill="none" strokeWidth="9" transform="rotate(-90 50 50)">
            {[...SEGMENTS, pending].map((c, i) => (
              <circle key={i} cx="50" cy="50" r="32" stroke={c} strokeDasharray="29.5 171.56" strokeDashoffset={-2 - i * 33.51} />
            ))}
          </g>
          <g transform="translate(34.4 34.4) scale(1.3)" fill="none" stroke={center} strokeWidth={size < 40 ? 3 : 2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d={WRENCH} />
          </g>
        </>
      )}
    </svg>
  );
}
