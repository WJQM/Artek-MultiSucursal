"use client";

import type { ReactNode } from "react";
import { RepairLogPanel } from "@/frontend/components/RepairLogPanel";
import { Backpack, CircleCheck, ClipboardList, ListChecks, MessageCircle, MessageSquare, User } from "@/frontend/components/icons";
import { DeviceIcon, StatusIcon, STROKE } from "@/frontend/components/UiIcons";

interface StatusInfo { label: string; color: string }
interface Parsed { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string }
interface Props {
  repair: { id: string; device: string; brand: string | null; model: string | null; issue: string; status: string; estimatedCost: number; updatedAt: string; clientName: string | null; clientPhone: string | null; technician?: { name: string } | null };
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

function Card({ icon, title, right, className = "", children }: { icon: ReactNode; title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`oxc ${className}`}>
      <div className="oxc-h"><span className="ic" aria-hidden="true">{icon}</span>{title}{right != null && <span className="r">{right}</span>}</div>
      <div className="oxc-b">{children}</div>
    </div>
  );
}

const Chips = ({ items, icon }: { items: string[]; icon?: (name: string) => string | undefined }) => (
  <div className="oxd-chips">{items.map((name) => <span key={name}>{icon?.(name)} {name}</span>)}</div>
);

/** Detalle de una orden en Mis asignaciones: el mismo diseño del Panel, con las acciones del técnico. */
export function AssignmentDetail({ repair: r, status, statuses, stepKeys, next, images, accessories, parsed: p, technicianName, onViewImage, onAdvance, onWhatsApp, onChat }: Props) {
  const isDelivered = r.status === "delivered";
  const steps = [...stepKeys, "delivered"];
  const curStep = isDelivered ? steps.length - 1 : stepKeys.indexOf(r.status);
  const updated = new Date(r.updatedAt).toLocaleDateString("es-BO", { hourCycle: "h23", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\./g, "");

  return (
    <div className="oxd" onClick={(e) => e.stopPropagation()}>
      {images.length > 0 && (
        <div className="oxd-photos">
          {images.map((img, idx) => (
            <button key={idx} type="button" onClick={() => onViewImage(img)} aria-label={`Ver foto ${idx + 1}`}>
              { }
              <img loading="lazy" decoding="async" src={img} alt="" /><em>{idx + 1}/{images.length}</em>
            </button>
          ))}
        </div>
      )}

      {/* Izquierda: Cliente | Equipo y Detalles (se estira hasta la altura del Seguimiento). Derecha: Seguimiento */}
      <div className="oxd-top">
        <div className="oxd-left">
          <div className="oxd-two">
            <Card icon={<User size={15} strokeWidth={STROKE} />} title="Cliente" className="spread">
              <div className="oxd-kv"><span>Nombre</span><b>{r.clientName || "—"}</b></div>
              <div className="oxd-kv"><span>Celular</span><b>{r.clientPhone || "—"}</b></div>
              <div className="oxd-kv"><span>Técnico asignado</span><b>{r.technician?.name || technicianName || "—"}</b></div>
            </Card>
            <Card icon={<DeviceIcon device={r.device} size={15} />} title="Equipo">
              <div className="oxd-kv"><span>Dispositivo</span><b>{r.device || "—"}</b></div>
              <div className="oxd-kv2">
                <div className="oxd-kv"><span>Marca</span><b>{r.brand || "—"}</b></div>
                <div className="oxd-kv"><span>Modelo</span><b>{r.model || "—"}</b></div>
              </div>
              <div className="oxd-cost"><span>Costo estimado</span><b>Bs. {Math.round(r.estimatedCost || 0).toLocaleString("es-BO")}</b></div>
            </Card>
          </div>
          <Card icon={<ClipboardList size={15} strokeWidth={STROKE} />} title="Detalles" className="grow">
            <div className="oxd-boxes">
              {r.issue && <div className="oxd-box warn"><span>Problema</span>{r.issue}</div>}
              <div className="oxd-box"><span>Observaciones</span>{p.notes || "Ninguna observación"}</div>
              {p.services.length > 0 && <div className="oxd-box"><span>Servicios</span><Chips items={p.services} /></div>}
              {p.repuestos.length > 0 && <div className="oxd-box"><span>Repuestos</span><Chips items={p.repuestos} /></div>}
              {p.software.length > 0 && <div className="oxd-box"><span>Programas</span><Chips items={p.software} /></div>}
              {p.videogames.length > 0 && <div className="oxd-box"><span>Videojuegos</span><Chips items={p.videogames} /></div>}
              {p.deliveryNotes && <div className="oxd-box"><span>Notas de entrega</span>{p.deliveryNotes}</div>}
              {Number(p.discount) > 0 && <div className="oxd-box bad"><span>Descuento</span>- Bs. {p.discount}</div>}
            </div>
          </Card>
        </div>

        <Card icon={<ListChecks size={15} strokeWidth={STROKE} />} title="Seguimiento" right={updated} className="track">
          <div className="oxd-donut" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              {steps.map((key, idx) => {
                const gap = 5, seg = (360 - gap * steps.length) / steps.length, radius = 42, circ = 2 * Math.PI * radius;
                const len = (seg / 360) * circ, off = -((idx * (seg + gap)) / 360) * circ;
                const done = isDelivered || idx <= curStep, cur = !isDelivered && idx === curStep;
                return <circle key={key} cx={50} cy={50} r={radius} fill="none" stroke={done ? (statuses[key] || status).color : "#e8ebf2"} strokeWidth={cur ? 8 : 5} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={off} strokeLinecap="round" />;
              })}
            </svg>
            <div><i style={{ color: status.color }}><StatusIcon status={r.status} size={26} /></i><b style={{ color: status.color }}>{status.label}</b><small>etapa {curStep + 1} de {steps.length}</small></div>
          </div>
          <ol className="oxd-steps">
            {steps.map((key, idx) => {
              const done = isDelivered || idx < curStep, cur = !isDelivered && idx === curStep;
              return <li key={key} className={done ? "d" : cur ? "c" : ""}><i>{done ? "✓" : idx + 1}</i>{(statuses[key] || status).label}{cur && <small>actual</small>}</li>;
            })}
          </ol>
        </Card>
      </div>

      <div className={`oxd-bottom${accessories.length ? "" : " solo"}`}>
        {accessories.length > 0 && <Card icon={<Backpack size={15} strokeWidth={STROKE} />} title="Accesorios" right={accessories.length} className="acc"><Chips items={accessories} icon={() => "✓"} /></Card>}
        <div className="oxd-log"><RepairLogPanel repairId={r.id} compact={accessories.length > 0} /></div>
      </div>

      <div className="oxd-actions" translate="no">
        {next && <button type="button" className="go" onClick={() => onAdvance(next)}><StatusIcon status={next} /> Pasar a {statuses[next].label}</button>}
        {r.status === "completed" && <span className="oxd-wait"><CircleCheck size={16} strokeWidth={STROKE} aria-hidden="true" /> Esperando entrega</span>}
        <button type="button" className="wa" onClick={onWhatsApp}><MessageCircle size={16} strokeWidth={STROKE} aria-hidden="true" /> WhatsApp</button>
        <button type="button" onClick={onChat}><MessageSquare size={16} strokeWidth={STROKE} aria-hidden="true" /> Chat</button>
      </div>
    </div>
  );
}
