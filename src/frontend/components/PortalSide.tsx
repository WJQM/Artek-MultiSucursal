"use client";
import { CircleCheck, Clock, Inbox, MapPin, Navigation, Phone, Search, Star, Store, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { branchLatLng, directionsUrl, mapEmbedUrl } from "@/shared/geo";
import { parseHours, hoursLines, openNow } from "@/shared/hours";
import { WaIcon, waLink, branchLabel, type PortalBranch } from "./PortalWhatsApp";
import type { PublicReviews } from "./PortalSections";

// Columna a la derecha del catálogo en pantallas anchas (≥1700 px): sucursal, reseñas y cómo trabajamos.
// Se queda en su lugar (no acompaña al bajar). En pantallas más chicas no se muestra y esas secciones siguen al final del portal (CSS .pt-side / .pt-bottom).

const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export function PortalSide({ branches, companyName, reviews, warrantyDays }: {
  branches: PortalBranch[]; companyName: string; reviews: PublicReviews | null; warrantyDays: number;
}) {
  const list = branches.filter((b) => branchLatLng(b) || b.address);
  const pasos = [
    { ic: <Inbox size={15} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo recibimos", d: "Comprobante con código QR" },
    { ic: <Search size={15} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo revisamos", d: "Diagnóstico y costo por WhatsApp" },
    { ic: <Wrench size={15} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo reparamos", d: "Sigues cada etapa en línea" },
    { ic: <CircleCheck size={15} strokeWidth={STROKE} aria-hidden="true" />, t: "Lo recoges", d: warrantyDays > 0 ? `Con ${warrantyDays} días de garantía` : "Listo para usar" },
  ];

  return (
    <aside className="pt-side" aria-label="Información del taller" style={{ position: "static" }}>
      {list.length > 0 && (
        <section className="pt-side-box" id="sucursales-lado" aria-labelledby="pt-side-suc">
          <h2 id="pt-side-suc"><Store size={16} strokeWidth={STROKE} aria-hidden="true" /> {list.length === 1 ? list[0].name : "Nuestras sucursales"}</h2>
          {list.map((b) => {
            const p = branchLatLng(b);
            const hours = parseHours(b.hours);
            const open = hours ? openNow(hours) : null;
            const wa = waLink(b.phone, `Hola ${companyName}, quisiera hacer una consulta a ${branchLabel(b.name)}.`);
            return (
              <div key={b.id} className="pt-side-branch">
                {list.length > 1 && <b>{b.name}</b>}
                {p && <iframe title={`Mapa de ${b.name}`} src={mapEmbedUrl(p)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ height: list.length > 1 ? 120 : 150 }} />}
                {open && <span className={`pt-open${open.open ? "" : " off"}`}><i className={`rt-live-dot${open.open ? "" : " off"}`} aria-hidden="true" />{open.open ? "Abierto ahora" : "Cerrado ahora"}</span>}
                {b.address && <p><MapPin size={13} strokeWidth={STROKE} aria-hidden="true" /> {b.address}</p>}
                {b.phone && <p><Phone size={13} strokeWidth={STROKE} aria-hidden="true" /> <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a></p>}
                {hours && hoursLines(hours).map((l) => <p key={l}><Clock size={13} strokeWidth={STROKE} aria-hidden="true" /> {l}</p>)}
                <div className="pt-side-btns">
                  {p && <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="go"><Navigation size={13} strokeWidth={STROKE} aria-hidden="true" /> Cómo llegar</a>}
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="wa"><WaIcon size={14} /> WhatsApp</a>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {reviews && reviews.reviews.length > 0 && (
        <section className="pt-side-box" aria-labelledby="pt-side-rev">
          <h2 id="pt-side-rev"><Star size={16} strokeWidth={STROKE} aria-hidden="true" /> Lo que dicen</h2>
          <p className="pt-side-avg"><b>{reviews.average.toFixed(1)}</b> de {reviews.count.toLocaleString("es-BO")} {reviews.count === 1 ? "reseña" : "reseñas"}</p>
          {reviews.reviews.slice(0, 3).map((r, i) => (
            <figure key={i}>
              <div className="pt-stars" aria-label={`${r.rating} de 5 estrellas`}>{stars(r.rating)}</div>
              <blockquote>“{r.comment}”</blockquote>
              <figcaption>{r.device ? `${r.device} · ` : ""}{new Date(r.createdAt).toLocaleDateString("es-BO", { month: "short", year: "numeric" })}</figcaption>
            </figure>
          ))}
        </section>
      )}

      <section className="pt-side-box" aria-labelledby="pt-side-how">
        <h2 id="pt-side-how"><Wrench size={16} strokeWidth={STROKE} aria-hidden="true" /> Cómo trabajamos</h2>
        <ol className="pt-side-steps">
          {pasos.map((s, i) => <li key={s.t}><span>{i + 1}</span><div><b>{s.t}</b><small>{s.d}</small></div></li>)}
        </ol>
      </section>
    </aside>
  );
}
