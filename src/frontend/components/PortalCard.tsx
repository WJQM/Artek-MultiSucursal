"use client";
// Tarjeta del catálogo del portal: el mismo molde para equipos, consolas, programas y videojuegos.
// Foto con fondo difuminado (o "Foto pronto" en gris neutro), tipo arriba a la izquierda, estado o
// "Apartado" arriba a la derecha, contador de fotos, resumen en una línea y precio siempre abajo.
import { Camera, Clock } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { thumb } from "@/shared/thumb";
import { pressKey } from "@/frontend/lib/a11y";
import type { ReactNode } from "react";

export interface PortalCardProps {
  name: string;
  code?: string | null;
  /** Solo se muestra si hay más de una sucursal (si no, se repetiría en todas las tarjetas) */
  branch?: string | null;
  summary?: (string | null | undefined)[];
  /** Sin precio (programas y videojuegos) dice "Consultar precio" */
  price?: number | null;
  images: string[];
  tag?: string | null;
  badge?: { label: string; tone?: "ok" | "muted" } | null;
  held?: boolean;
  fallbackIcon: ReactNode;
  onOpen: () => void;
}

export function PortalCard(p: PortalCardProps) {
  const img = p.images[0] || null;
  const summary = (p.summary || []).filter((s): s is string => !!s && !!s.trim()).join(" · ");
  const meta = [p.code, p.branch].filter(Boolean).join(" · ");
  const hasPrice = typeof p.price === "number" && p.price > 0;
  return (
    <div role="button" tabIndex={0} onKeyDown={pressKey} aria-label={`Ver ${p.name}`} onClick={p.onOpen} className="pcard">
      <div className="pcard-ph">
        {img ? (
          <>
            <img className="pcard-bg" src={thumb(img, 200)} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            <img className="pcard-img" src={thumb(img)} alt={p.name} loading="lazy" decoding="async" />
          </>
        ) : (
          <span className="pcard-none">{p.fallbackIcon}<small>Foto pronto</small></span>
        )}
        {p.tag && <span className="pcard-tag l">{p.tag}</span>}
        {p.held
          ? <span className="pcard-tag r warn"><Clock size={12} strokeWidth={STROKE} aria-hidden="true" /> Apartado</span>
          : p.badge && <span className={`pcard-tag r ${p.badge.tone || ""}`}>{p.badge.label}</span>}
        {p.images.length > 1 && <span className="pcard-count"><Camera size={12} strokeWidth={STROKE} aria-hidden="true" /> {p.images.length}</span>}
      </div>
      <div className="pcard-b">
        {meta && <div className="pcard-meta">{meta}</div>}
        <h3 className="pcard-n">{p.name}</h3>
        {summary && <div className="pcard-s">{summary}</div>}
        <div className="pcard-p">
          {hasPrice ? <b>Bs. {Math.round(p.price as number).toLocaleString("es-BO")}</b> : <b className="ask">Consultar precio</b>}
          <span>Ver detalles</span>
        </div>
      </div>
    </div>
  );
}
