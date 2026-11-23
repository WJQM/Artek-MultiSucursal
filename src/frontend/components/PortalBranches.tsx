"use client";
import { Clock, MapPin, Navigation, Phone } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { branchLatLng, directionsUrl, mapEmbedUrl, wazeUrl } from "@/shared/geo";
import { parseHours, hoursLines, openNow } from "@/shared/hours";
import { WaIcon, waLink, branchLabel, type PortalBranch } from "./PortalWhatsApp";

/** "Nuestras sucursales" del portal (fondo claro): mapa, dirección, horario (abierto ahora), Cómo llegar y WhatsApp.
 *  Con una sola sucursal, el mapa va grande al lado de los datos. */
export function PortalBranches({ branches, companyName }: { branches: PortalBranch[]; companyName: string }) {
  const list = branches.filter((b) => branchLatLng(b) || b.address);
  if (list.length === 0) return null;

  return (
    <section id="sucursales" className="pt-band pt-band-white pt-band-branches" aria-labelledby="sucursales-title">
      <div className="pt-wrap">
        <div className="pt-band-head">
          <h2 id="sucursales-title">{list.length === 1 ? "Nuestra sucursal" : "Nuestras sucursales"}</h2>
          <p>Visítanos o escríbenos: te indicamos cómo llegar.</p>
        </div>
        <div className={`pt-branches${list.length === 1 ? " one" : ""}`}>
          {list.map((b) => {
            const p = branchLatLng(b);
            const hours = parseHours(b.hours);
            const open = hours ? openNow(hours) : null;
            const wa = waLink(b.phone, `Hola ${companyName}, quisiera hacer una consulta a ${branchLabel(b.name)}.`);
            return (
              <article key={b.id} className="pt-branch">
                {p && <iframe title={`Mapa de ${b.name}`} src={mapEmbedUrl(p)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
                <div className="in">
                  <h3>{b.name}{open && <span className={`pt-open${open.open ? "" : " off"}`}><i className={`rt-live-dot${open.open ? "" : " off"}`} aria-hidden="true" />{open.open ? "Abierto ahora" : "Cerrado ahora"}</span>}</h3>
                  {b.address && <p><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> {b.address}</p>}
                  {b.phone && <p><Phone size={14} strokeWidth={STROKE} aria-hidden="true" /> <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a></p>}
                  {hours && <div className="pt-hours">{hoursLines(hours).map((l) => <div key={l}><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> {l}</div>)}</div>}
                  <div className="pt-branch-btns">
                    {p && <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="go"><Navigation size={14} strokeWidth={STROKE} aria-hidden="true" /> Cómo llegar</a>}
                    {p && <a href={wazeUrl(p)} target="_blank" rel="noopener noreferrer">Waze</a>}
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="wa"><WaIcon size={16} /> WhatsApp</a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
