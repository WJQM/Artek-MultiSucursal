"use client";
import { CircleCheck, Inbox, Search, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Franjas del portal que llenan todo el ancho: "Cómo trabajamos" y "Lo que dicen nuestros clientes".

export interface PublicReviews { count: number; average: number; reviews: { rating: number; comment: string; device: string | null; createdAt: string }[] }

export function PortalHow({ warrantyDays }: { warrantyDays: number }) {
  const steps = [
    { e: <Inbox size={18} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo recibimos", d: "Te damos un comprobante con código QR." },
    { e: <Search size={18} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo revisamos", d: "Te avisamos el diagnóstico y el costo por WhatsApp." },
    { e: <Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo reparamos", d: "Ves cada etapa en línea, desde tu celular." },
    { e: <CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo recoges", d: warrantyDays > 0 ? `Con ${warrantyDays} días de garantía.` : "Listo para usar." },
  ];
  return (
    <section className="pt-band pt-band-white" aria-labelledby="pt-how">
      <div className="pt-wrap">
        <div className="pt-band-head"><h2 id="pt-how">Cómo trabajamos</h2><p>Así sigue tu equipo desde que lo dejas.</p></div>
        <ol className="pt-how">
          {steps.map((s, i) => <li key={s.t}><span className="n">{i + 1}</span><i aria-hidden="true">{s.e}</i><b>{s.t}</b><small>{s.d}</small></li>)}
        </ol>
      </div>
    </section>
  );
}

const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export function PortalReviews({ data }: { data: PublicReviews | null }) {
  if (!data || data.reviews.length === 0) return null;
  return (
    <section className="pt-band" aria-labelledby="pt-revs">
      <div className="pt-wrap">
        <div className="pt-band-head">
          <h2 id="pt-revs">Lo que dicen nuestros clientes</h2>
          <p><b className="pt-stars">★ {data.average.toFixed(1)}</b> de {data.count} {data.count === 1 ? "reseña" : "reseñas"} de clientes con su equipo entregado</p>
        </div>
        <div className="pt-revs">
          {data.reviews.map((r, i) => (
            <figure key={i}>
              <div className="pt-stars" aria-label={`${r.rating} de 5 estrellas`}>{stars(r.rating)}</div>
              <blockquote>“{r.comment}”</blockquote>
              <figcaption>Cliente verificado{r.device ? ` · ${r.device}` : ""} · {new Date(r.createdAt).toLocaleDateString("es-BO", { month: "short", year: "numeric" })}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
