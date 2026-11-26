"use client";
// Ficha de producto del portal (equipos, consolas, programas y videojuegos), una sola para los cuatro.
// Celular: una columna y barra fija abajo con el precio, WhatsApp y Compartir.
// Computadora (más de 820 px): foto a la izquierda y datos de compra a la derecha.
// Se dibuja con createPortal sobre <body> para que ninguna barra de la página la tape.
import { ChevronLeft, ChevronRight, Lightbulb, Search, Share2, ShieldCheck, X } from "@/frontend/components/icons";
import { STROKE, StatusDot } from "@/frontend/components/UiIcons";
import { WhatsAppBuy, type PortalBranch } from "@/frontend/components/PortalWhatsApp";
import { thumb } from "@/shared/thumb";
import { pressKey } from "@/frontend/lib/a11y";
import { sileo } from "@/frontend/lib/toast";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SheetSpec { icon: ReactNode; label: string; value: string }
export interface SheetGroup { title: string; items: SheetSpec[] }
export interface SheetChip { label: ReactNode; color?: string; dot?: boolean }
export interface SheetRelated { id: string; code?: string | null; name: string; price?: number | null; image?: string | null; onOpen: () => void }

export interface PortalSheetProps {
  ariaLabel: string;
  icon: ReactNode;
  fallbackIcon: ReactNode;
  title: string;
  code?: string | null;
  kindLabel: string;
  images: string[];
  imageIdx: number;
  setImageIdx: (i: number) => void;
  onZoom: (img: string) => void;
  summary: (string | null | undefined)[];
  price?: number | null;
  chips: SheetChip[];
  warrantyDays?: number | null;
  shareUrl: string;
  groups: SheetGroup[];
  accessories?: string | null;
  notes?: string | null;
  blocks?: ReactNode;
  actions?: ReactNode;
  wa: { product: string; code?: string | null; price?: number | null; branch?: { id: string; name: string } | null; branches: PortalBranch[]; companyPhone: string | null };
  nav?: { index: number; total: number; onPrev: () => void; onNext: () => void } | null;
  related: SheetRelated[];
  relatedTitle: string;
  onClose: () => void;
  /** Programas y videojuegos: portada vertical, descripción con «Leer más», requisitos lado a lado y portadas relacionadas */
  cover?: boolean;
  subtitle?: string | null;
  description?: string | null;
  reqMin?: string | null;
  reqRec?: string | null;
}

const bs = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

/** "Cable de poder, teclado y mouse" → ["Cable de poder", "teclado", "mouse"] para mostrarlos como etiquetas */
export function splitAccessories(text: string | null | undefined): string[] {
  return (text || "").split(/[,;\n]|\s\+\s|\sy\s/i).map((t) => t.trim()).filter(Boolean);
}

/** Compartir: menú del teléfono si existe; si no, copia el enlace (o lo muestra si no se puede copiar) */
async function share(title: string, url: string) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    sileo.success({ title: "Enlace copiado", description: "Pégalo en WhatsApp o donde quieras" });
  } catch {
    sileo.info({ title: "Copia este enlace", description: url });
  }
}

export function PortalSheet(p: PortalSheetProps) {
  const imgs = p.images;
  const idx = imgs.length ? Math.min(p.imageIdx, imgs.length - 1) : 0;
  const current = imgs[idx] || null;
  const summary = p.summary.filter((s): s is string => !!s && !!s.trim());
  const accessories = splitAccessories(p.accessories);
  const hasPrice = typeof p.price === "number" && p.price > 0;
  const go = (d: number) => p.setImageIdx((idx + d + imgs.length) % imgs.length);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const more = moreFor === p.title;

  const buy = (
    <>
      <WhatsAppBuy {...p.wa} />
      <button type="button" className="ps-share" onClick={() => share(p.title, p.shareUrl)} aria-label="Compartir">
        <Share2 size={16} strokeWidth={STROKE} aria-hidden="true" /> <span>Compartir</span>
      </button>
    </>
  );

  if (typeof document === "undefined") return null;

  const navBtns = p.nav && p.nav.total > 1 && (
    <div className="ps-nav">
      <button type="button" onClick={p.nav.onPrev} aria-label="Anterior"><ChevronLeft size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      <span>{p.nav.index + 1} de {p.nav.total}</span>
      <button type="button" onClick={p.nav.onNext} aria-label="Siguiente"><ChevronRight size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
    </div>
  );

  if (p.cover) {
    const desc = (p.description || "").trim();
    const long = desc.length > 260;
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={p.ariaLabel} data-esc className="ps-back" onClick={p.onClose}>
        <div className="ps ps-cov" onClick={(e) => e.stopPropagation()}>
          <div className="ps-head">
            <span className="ps-head-ic">{p.icon}</span>
            <div className="ps-head-t"><div className="ps-sum" style={{ marginTop: 0 }}>{p.kindLabel}</div></div>
            {navBtns}
            <button type="button" className="ps-close" onClick={p.onClose} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
          </div>
          <div className="ps-scroll">
            <div className="pc-hero">
              {current && <img className="pc-hero-bg" src={thumb(current, 200)} alt="" aria-hidden="true" />}
              <div className="pc-hero-in">
                <button type="button" className="pc-cover" onClick={() => current && p.onZoom(current)} aria-label={current ? "Ampliar portada" : "Sin portada"}>
                  {current ? <img src={thumb(current, 400)} alt={p.title} /> : <span className="pc-none">{p.fallbackIcon}<small>Portada pronto</small></span>}
                </button>
                <div className="pc-hero-t">
                  <h3>{p.title}</h3>
                  {p.subtitle && <div className="pc-sub">{p.subtitle}</div>}
                  <div className="pc-tags">{p.chips.map((c, i) => <span key={i}>{c.label}</span>)}</div>
                </div>
              </div>
            </div>
            {imgs.length > 1 && (
              <div className="ps-thumbs pc-thumbs">
                {imgs.map((img, i) => (
                  <button type="button" key={i} onClick={() => p.setImageIdx(i)} aria-label={`Ver imagen ${i + 1}`} className={i === idx ? "on" : ""}><img src={thumb(img, 200)} loading="lazy" decoding="async" alt="" /></button>
                ))}
              </div>
            )}
            <div className="pc-body">
              <div className="ps-buy ps-desk">{buy}</div>
              {desc && (
                <div className="pc-desc">
                  <p className={long && !more ? "clamp" : ""}>{desc}</p>
                  {long && <button type="button" onClick={() => setMoreFor(more ? null : p.title)}>{more ? "Leer menos" : "Leer más"}</button>}
                </div>
              )}
              {(p.reqMin || p.reqRec) && (
                <>
                  <div className="ps-h">Requisitos</div>
                  <div className="pc-req">
                    {p.reqMin && <div className="ps-block" style={{ marginTop: 0 }}><b>Mínimos</b><p>{p.reqMin}</p></div>}
                    {p.reqRec && <div className="ps-block" style={{ marginTop: 0 }}><b>Recomendados</b><p>{p.reqRec}</p></div>}
                  </div>
                </>
              )}
              {p.related.length > 0 && (
                <>
                  <div className="ps-h">{p.relatedTitle}</div>
                  <div className="pc-rel">
                    {p.related.map((r) => (
                      <button type="button" key={r.id} onClick={r.onOpen}>
                        <span className="pc-rel-img">{r.image ? <img src={thumb(r.image, 200)} loading="lazy" decoding="async" alt="" /> : p.fallbackIcon}</span>
                        <span className="pc-rel-n">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="ps-bar ps-mob">{buy}</div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={p.ariaLabel} data-esc className="ps-back" onClick={p.onClose}>
      <div className="ps" onClick={(e) => e.stopPropagation()}>
        <div className="ps-head">
          <span className="ps-head-ic">{p.icon}</span>
          <div className="ps-head-t">
            <div className="ps-title"><h3>{p.title}</h3>{p.code && <span className="ps-code">{p.code}</span>}</div>
            {summary.length > 0 ? <div className="ps-sum">{summary.join(" · ")}</div> : <div className="ps-sum">{p.kindLabel}</div>}
          </div>
          {p.nav && p.nav.total > 1 && (
            <div className="ps-nav">
              <button type="button" onClick={p.nav.onPrev} aria-label="Anterior"><ChevronLeft size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
              <span>{p.nav.index + 1} de {p.nav.total}</span>
              <button type="button" onClick={p.nav.onNext} aria-label="Siguiente"><ChevronRight size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
            </div>
          )}
          <button type="button" className="ps-close" onClick={p.onClose} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>

        <div className="ps-scroll">
          <div className="ps-main">
            <div className="ps-media">
              <div className="ps-photo">
                {current ? (
                  <>
                    <img className="ps-photo-bg" src={thumb(current, 200)} alt="" aria-hidden="true" />
                    <img role="button" tabIndex={0} onKeyDown={pressKey} key={current} className="ps-photo-img" src={thumb(current, 800)} alt={`${p.title} ${idx + 1}`} onClick={() => p.onZoom(current)} />
                    <span className="ps-zoom"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /> <span className="ps-zoom-t" />{imgs.length > 1 ? ` · ${idx + 1}/${imgs.length}` : ""}</span>
                    {imgs.length > 1 && (
                      <>
                        <button type="button" className="ps-arrow l" onClick={() => go(-1)} aria-label="Foto anterior"><ChevronLeft size={20} strokeWidth={STROKE} aria-hidden="true" /></button>
                        <button type="button" className="ps-arrow r" onClick={() => go(1)} aria-label="Foto siguiente"><ChevronRight size={20} strokeWidth={STROKE} aria-hidden="true" /></button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="ps-nophoto">{p.fallbackIcon}<span>Sin fotos disponibles</span></div>
                )}
              </div>
              {imgs.length > 1 && (
                <div className="ps-thumbs">
                  {imgs.map((img, i) => (
                    <button type="button" key={i} onClick={() => p.setImageIdx(i)} aria-label={`Ver foto ${i + 1}`} className={i === idx ? "on" : ""}>
                      <img src={thumb(img, 200)} loading="lazy" decoding="async" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ps-info">
              <div className="ps-chips">
                {p.chips.map((c, i) => (
                  <span key={i} className="ps-chip" style={c.color ? { color: c.color, borderColor: `${c.color}55`, background: `${c.color}12` } : undefined}>
                    {c.dot && c.color && <StatusDot color={c.color} />} {c.label}
                  </span>
                ))}
              </div>

              {hasPrice && <div className="ps-price">{bs(p.price as number)}</div>}

              {!!p.warrantyDays && p.warrantyDays > 0 && (
                <div className="ps-warranty"><ShieldCheck size={16} strokeWidth={STROKE} aria-hidden="true" /> Garantía de {p.warrantyDays} días</div>
              )}

              {accessories.length > 0 && (
                <div className="ps-acc"><span>Incluye</span>{accessories.map((a, i) => <span key={i} className="ps-chip">{a}</span>)}</div>
              )}

              {p.notes && (
                <div className="ps-note">
                  <Lightbulb size={16} strokeWidth={STROKE} aria-hidden="true" />
                  <div><b>Nota del taller</b><p>{p.notes}</p></div>
                </div>
              )}

              <div className="ps-buy ps-desk">{buy}</div>
              {p.actions}
            </div>
          </div>

          {(p.groups.some((g) => g.items.length) || p.blocks) && (
            <div className="ps-specs">
              {p.groups.some((g) => g.items.length) && <div className="ps-h">Especificaciones</div>}
              <div className="ps-groups">
                {p.groups.filter((g) => g.items.length).map((g) => (
                  <div key={g.title} className="ps-group">
                    <div className="ps-gt">{g.title}</div>
                    <div className="ps-gi">
                      {g.items.map((s) => (
                        <div key={s.label} className="ps-spec"><small>{s.icon} {s.label}</small><b>{s.value}</b></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {p.blocks}
            </div>
          )}

          {p.related.length > 0 && (
            <div className="ps-rel">
              <div className="ps-h">{p.relatedTitle}</div>
              <div className="ps-rel-list">
                {p.related.map((r) => (
                  <button type="button" key={r.id} onClick={r.onOpen} className="ps-rel-item">
                    <span className="ps-rel-img">{r.image ? <img src={thumb(r.image, 200)} loading="lazy" decoding="async" alt="" /> : p.fallbackIcon}</span>
                    <span className="ps-rel-t">
                      <small>{[r.code, typeof r.price === "number" && r.price > 0 ? bs(r.price) : null].filter(Boolean).join(" · ")}</small>
                      <b>{r.name}</b>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ps-bar ps-mob">
          {hasPrice && <div className="ps-bar-price">{bs(p.price as number)}</div>}
          {buy}
        </div>
      </div>
    </div>,
    document.body,
  );
}
