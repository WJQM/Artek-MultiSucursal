"use client";
// Detalle de una orden: piezas compartidas entre el Panel (dashboard) y Mis asignaciones (técnico):
// tarjeta con encabezado, etapas con ícono y color de cada estado, y tabla de trabajo y costo.

import type { CSSProperties, ReactNode } from "react";
import { RepairLogPanel } from "@/frontend/components/RepairLogPanel";
import { CircleCheck, MessageCircle, MessageSquare, Wrench } from "@/frontend/components/icons";
import { DeviceIcon, StatusIcon, STROKE } from "@/frontend/components/UiIcons";

interface StatusInfo { label: string; color: string }
interface Parsed { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string }
interface Props {
  repair: { id: string; code?: string; device: string; brand: string | null; model: string | null; issue: string; status: string; estimatedCost: number; updatedAt: string; createdAt?: string; clientName: string | null; clientPhone: string | null; technician?: { name: string } | null };
  status: StatusInfo;
  statuses: Record<string, StatusInfo>;
  stepKeys: string[];
  next?: string;
  images: string[];
  accessories: string[];
  parsed: Parsed;
  technicianName?: string;
  onViewImage: (src: string) => void;
  onAdvance: (to: string) => void;
  onWhatsApp: () => void;
  onChat: () => void;
}

export function OrderCard({ icon, title, right, className = "", children }: { icon: ReactNode; title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`oxc ${className}`}>
      <div className="oxc-h"><span className="ic" aria-hidden="true">{icon}</span>{title}{right != null && <span className="r">{right}</span>}</div>
      <div className="oxc-b">{children}</div>
    </div>
  );
}

export const OrderChips = ({ items }: { items: string[] }) => (
  <div className="oxd-chips">{items.map((name) => <span key={name}>{name}</span>)}</div>
);

export const shortDate = (d: string, withTime = true) =>
  new Date(d).toLocaleDateString("es-BO", withTime ? { hourCycle: "h23", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).replace(/\./g, "");

/** Etapas en una línea: las hechas con el color de su estado, la actual con anillo, las que faltan en gris */
export function OrderFlow({ status, statuses, stepKeys, updatedAt }: { status: string; statuses: Record<string, StatusInfo>; stepKeys: string[]; updatedAt: string }) {
  const isDelivered = status === "delivered";
  const steps = [...stepKeys, "delivered"];
  const cur = isDelivered ? steps.length - 1 : stepKeys.indexOf(status);
  const label = (statuses[status] || statuses[steps[0]]).label;
  return (
    <ol className="oxd-flow" aria-label={`Etapa ${cur + 1} de ${steps.length}: ${label}`}>
      {steps.map((k, idx) => {
        const done = isDelivered || idx < cur, now = !isDelivered && idx === cur;
        const info = statuses[k] || { label: k, color: "#64748b" };
        return (
          <li key={k} className={done ? "d" : now ? "c" : ""} style={{ "--c": info.color } as CSSProperties}>
            <i><StatusIcon status={k} size={14} /></i>
            {info.label}
            {(now || (isDelivered && idx === steps.length - 1)) && <small>{shortDate(updatedAt)}</small>}
          </li>
        );
      })}
    </ol>
  );
}

/** Servicios, repuestos e instalaciones; con descuento muestra subtotal, descuento y total cobrado.
 *  La orden guarda solo los nombres, por eso los montos aparecen solo al final. */
export function OrderCost({ parsed: p, isDelivered, estimatedCost }: { parsed: Parsed; isDelivered: boolean; estimatedCost: number }) {
  const rows: [string, string][] = [
    ...p.services.map((n): [string, string] => [n, "Servicio"]),
    ...p.repuestos.map((n): [string, string] => [n, "Repuesto"]),
    ...p.software.map((n): [string, string] => [n, "Instalación"]),
    ...p.videogames.map((n): [string, string] => [n, "Instalación"]),
  ];
  const disc = isDelivered ? Number(p.discount) || 0 : 0;
  const total = Math.round(estimatedCost || 0);
  return (
    <table className="oxd-ct">
      <tbody>
        {rows.length === 0 && <tr><td className="oxd-empty" colSpan={2}>Sin servicios ni repuestos registrados</td></tr>}
        {rows.map(([n, k], i) => <tr key={i}><td>{n}</td><td className="k">{k}</td></tr>)}
        {disc > 0 && <tr><td>Subtotal</td><td className="k">Bs. {(total + disc).toLocaleString("es-BO")}</td></tr>}
        {disc > 0 && <tr className="disc"><td>Descuento</td><td className="k">− Bs. {disc.toLocaleString("es-BO")}</td></tr>}
        <tr className="tot"><td>{isDelivered ? "Total cobrado" : "Costo estimado"}</td><td className="k">Bs. {total.toLocaleString("es-BO")}</td></tr>
      </tbody>
    </table>
  );
}

/** Detalle de una orden en Mis asignaciones: el mismo diseño del Panel, con las acciones del técnico. */
export function AssignmentDetail({ repair: r, status, statuses, stepKeys, next, images, accessories, parsed: p, technicianName, onViewImage, onAdvance, onWhatsApp, onChat }: Props) {
  const isDelivered = r.status === "delivered";
  const device = [r.device, r.brand, r.model].filter(Boolean).join(" ");

  return (
    <div className="oxd" onClick={(e) => e.stopPropagation()}>
      {images.length > 0 && (
        <div className="oxd-photos">
          {images.map((img, idx) => (
            <button key={idx} type="button" onClick={() => onViewImage(img)} aria-label={`Ver foto ${idx + 1}`}>
              <img loading="lazy" decoding="async" src={img} alt="" /><em>{idx + 1}/{images.length}</em>
            </button>
          ))}
        </div>
      )}

      <div className="oxd-sum">
        <div className="oxd-sum-main">
          <div className="oxd-sum-t"><b>{r.code ? `${r.code} · ` : ""}{device}</b><span className="oxd-st" style={{ color: status.color, background: `${status.color}14` }}><StatusIcon status={r.status} size={13} /> {status.label}</span></div>
          <div className="oxd-sum-s">{[r.clientName, r.clientPhone, r.createdAt ? `ingresó ${shortDate(r.createdAt, false)}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="oxd-sum-total"><span>{isDelivered ? "Total" : "Costo estimado"}</span><b>Bs. {Math.round(r.estimatedCost || 0).toLocaleString("es-BO")}</b></div>
        <div className="oxd-sum-tech"><span>Técnico</span><b>{r.technician?.name || technicianName || "—"}</b></div>
      </div>

      <OrderFlow status={r.status} statuses={statuses} stepKeys={stepKeys} updatedAt={r.updatedAt} />

      <div className="oxd-grid">
        <OrderCard icon={<DeviceIcon device={r.device} size={15} />} title="Equipo y recepción">
          <dl className="oxd-dl">
            <dt>Equipo</dt><dd>{device || "—"}</dd>
            <dt>Problema</dt><dd>{r.issue || "—"}</dd>
            <dt>Observaciones</dt><dd>{p.notes || "Ninguna"}</dd>
            {p.deliveryNotes && <><dt>Notas de entrega</dt><dd>{p.deliveryNotes}</dd></>}
          </dl>
          {accessories.length > 0 && <><div className="oxd-sub">Accesorios ({accessories.length})</div><OrderChips items={accessories} /></>}
        </OrderCard>
        <OrderCard icon={<Wrench size={15} strokeWidth={STROKE} />} title="Trabajo y costo">
          <OrderCost parsed={p} isDelivered={isDelivered} estimatedCost={r.estimatedCost} />
        </OrderCard>
      </div>

      <div className="oxd-log"><RepairLogPanel repairId={r.id} /></div>

      <div className="oxd-actions" translate="no">
        {next && <button type="button" className="go" onClick={() => onAdvance(next)}><StatusIcon status={next} /> Pasar a {statuses[next].label}</button>}
        {r.status === "completed" && <span className="oxd-wait"><CircleCheck size={16} strokeWidth={STROKE} aria-hidden="true" /> Esperando entrega</span>}
        <button type="button" className="wa" onClick={onWhatsApp}><MessageCircle size={16} strokeWidth={STROKE} aria-hidden="true" /> WhatsApp</button>
        <button type="button" onClick={onChat}><MessageSquare size={16} strokeWidth={STROKE} aria-hidden="true" /> Chat</button>
      </div>
    </div>
  );
}
