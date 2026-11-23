"use client";

import type { ReactNode } from "react";
import { pressKey } from "@/frontend/lib/a11y";
import { Camera, TriangleAlert } from "@/frontend/components/icons";
import { DeviceIcon, OrderTag, StatusDot, StatusIcon, STROKE } from "@/frontend/components/UiIcons";

interface StatusInfo { label: string; color: string; bg: string }
interface Props {
  repair: { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; estimatedCost: number; updatedAt: string; clientName: string | null; clientPhone: string | null };
  status: StatusInfo;
  next?: StatusInfo;
  index: number;
  isOpen: boolean;
  images: string[];
  nextKey?: string;
  onToggle: () => void;
  onViewImage: (src: string) => void;
  onAdvance: () => void;
  children?: ReactNode;
}

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** Encabezado de la tabla de Mis asignaciones: mismas columnas que el Panel, con la acción del técnico. */
export function AssignmentHead() {
  return (
    <div className="ot-head card-compact" aria-hidden="true">
      <span /><span>Orden</span><span>Cliente</span><span className="ot-col-tech">Siguiente</span><span>Estado</span><span>Últ. cambio</span><span className="r">Monto</span>
    </div>
  );
}

/** Fila de una orden: tabla en computadora y tarjeta corta en celular, igual que en el Panel. */
export function AssignmentRow({ repair: r, status: s, next, nextKey, index, isOpen, images, onToggle, onViewImage, onAdvance, children }: Props) {
  const days = daysSince(r.updatedAt);
  const isStuck = days >= 7 && r.status !== "completed" && r.status !== "delivered";
  const ago = days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
  const name = [r.device, r.brand, r.model].filter(Boolean).join(" ");
  const amount = `Bs. ${Math.round(r.estimatedCost || 0).toLocaleString("es-BO")}`;
  const advance = next && (
    <button type="button" className="ot-next" title={`Pasar a ${next.label}`} onClick={(e) => { e.stopPropagation(); onAdvance(); }}>{nextKey && <StatusIcon status={nextKey} size={14} />} {next.label}</button>
  );
  const photo = images[0];

  return (
    <div data-repair-id={r.id} data-flash-id={r.id} className={`repair-card ot-row${isOpen ? " is-sel" : ""}`} role="button" tabIndex={0} aria-label={`Abrir ${r.code}`} aria-expanded={isOpen}
      onClick={onToggle} onKeyDown={pressKey} style={{ animation: `fadeIn 0.3s ease-out ${Math.min(index, 12) * 0.03}s both` }}>
      {/* Celular: tarjeta corta */}
      <div className="card-phone">
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <OrderTag code={r.code} />
          {isStuck && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger-bright)", background: "rgba(239,68,68,0.12)", padding: "2px 7px", borderRadius: 6 }}><TriangleAlert size={12} strokeWidth={STROKE} aria-hidden="true" /> {days}d</span>}
          <span style={{ flex: 1 }} />
          <span className="rp-status" data-flip style={{ background: s.bg, color: s.color, borderColor: "transparent" }}><StatusDot color={s.color} />{s.label}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          {photo && <button type="button" className="rp-thumb" style={{ width: 52, height: 52 }} aria-label={`Ver foto de ${r.code}`} onClick={(e) => { e.stopPropagation(); onViewImage(photo); }}>
            { }
            <img loading="lazy" decoding="async" src={photo} alt="" />
          </button>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6 }}><DeviceIcon device={r.device} /> {[r.device, r.brand, r.model].filter(Boolean).join(" · ")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", minWidth: 0 }}>{r.clientName || "Sin nombre"}</span>
              <b style={{ color: "var(--text-primary)", fontSize: 14, flexShrink: 0 }}>{amount}</b>
            </div>
          </div>
        </div>
        {advance && <div className="ot-next-phone">{advance}</div>}
      </div>

      {/* Computadora: una fila de la tabla */}
      <div className="card-compact ot-grid">
        <div className="ot-pic">
          {photo ? (
            <button type="button" className="rp-thumb ot-thumb" aria-label={`Ver fotos de ${r.code}`} onClick={(e) => { e.stopPropagation(); onViewImage(photo); }}>
              { }
              <img loading="lazy" decoding="async" src={photo} alt="" />
              {images.length > 1 && <span><Camera size={10} strokeWidth={STROKE} aria-hidden="true" /> {images.length}</span>}
            </button>
          ) : <span className="rp-dev ot-dev" style={{ background: s.bg }} aria-hidden="true"><DeviceIcon device={r.device} size={22} /></span>}
        </div>
        <div className="ot-main">
          <div className="rp-title"><span className="rp-code">{r.code}</span><span className="rp-device">{name}</span></div>
          {r.issue && <div className="rp-issue">{r.issue}</div>}
        </div>
        <div className="ot-cell"><b>{r.clientName || "Sin nombre"}</b>{r.clientPhone && <small>{r.clientPhone}</small>}</div>
        <div className="ot-cell ot-col-tech">{advance || <small>{r.status === "completed" ? "Esperando entrega" : "—"}</small>}</div>
        <div><span className="rp-status" data-flip style={{ background: s.bg, color: s.color, borderColor: "transparent" }}><StatusDot color={s.color} />{s.label}</span></div>
        <div className="ot-cell">{isStuck ? <span className="ot-stuck" title="Sin cambios hace más de 7 días"><TriangleAlert size={13} strokeWidth={STROKE} aria-hidden="true" /> {days} días</span> : <small>{ago}</small>}</div>
        <div className="rp-amount ot-amt">{amount}</div>
      </div>
      {children}
    </div>
  );
}
