"use client";

import { useEffect, useRef, useState } from "react";
import { ImageLightbox } from "@/frontend/components/ImageLightbox";
import { apiFetch } from "@/frontend/lib/api";
import { useLiveRefresh } from "@/frontend/lib/live";
import { sileo } from "@/frontend/lib/toast";
import { uploadImage } from "@/frontend/lib/upload-image";
import { AiDraft } from "@/frontend/components/AiDraft";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey } from "@/frontend/lib/a11y";
import { Camera, CircleCheck, ClipboardList, Eye, EyeOff, Images, Lock, Megaphone, MessageSquare, Pencil, Search, Trash2, TriangleAlert, Undo2, Wrench, X, type AppIcon } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

/**
 * Bitácora de la reparación (personal). El técnico asignado y los administradores registran
 * hallazgos, avances, problemas e informe final con fotos. Lo marcado "visible para el cliente"
 * aparece en su seguimiento con el nombre del autor.
 */

export const LOG_TYPES: Record<string, { label: string; color: string }> = {
  hallazgo: { label: "Hallazgo", color: "#0e7490" },
  avance: { label: "Avance", color: "#2563eb" },
  problema: { label: "Problema / aviso", color: "#b45309" },
  final: { label: "Informe final", color: "#047857" },
  novedad: { label: "Novedad", color: "#0ea5e9" },
  comentario: { label: "Nota interna", color: "#5a6a80" },
};
const LOG_ICON: Record<string, AppIcon> = { hallazgo: Search, avance: Wrench, problema: TriangleAlert, final: CircleCheck, novedad: Megaphone, comentario: MessageSquare };
export function LogIcon({ type, size = 14 }: { type: string; size?: number }) {
  const I = LOG_ICON[type] || Wrench;
  return <I size={size} strokeWidth={STROKE} aria-hidden="true" />;
}
const ROLE_LABEL: Record<string, string> = { tech: "Técnico", admin: "Administrador", superadmin: "Super Admin" };
/** Etapa de la orden cuando se escribió la entrada */
export const STAGE_LABEL: Record<string, string> = {
  pending: "Pendiente", diagnosed: "Diagnóstico", waiting_parts: "Esperando repuestos",
  in_progress: "En progreso", completed: "Completado", delivered: "Entregado",
};
const MAX_IMAGES = 6;

interface Entry {
  id: string; type: string; text: string; images: string[]; authorName: string; authorRole: string;
  visibleToClient: boolean; hidden: boolean; createdAt: string; mine: boolean; canEdit: boolean;
  status: string | null; recordedByName: string | null;
}
interface LogData { entries: Entry[]; canWrite: boolean; isManager: boolean; hasClientPhone: boolean; editWindowMin: number; repairStatus: string }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoy ${hm}` : `${d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" })} ${hm}`;
}

export function RepairLogPanel({ repairId, compact = false }: { repairId: string; compact?: boolean }) {
  const [data, setData] = useState<LogData | null>(null);
  const [error, setError] = useState("");
  // Formulario plegado: "Nota interna" (personal) o "Novedad al cliente" (se ve en su seguimiento)
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<"interna" | "cliente">("cliente");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const fetchLog = () => apiFetch(`/api/repairs/${repairId}/log`).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => ({})) }));
  const apply = (r: { ok: boolean; body: LogData & { error?: string } }) => {
    if (!r.ok) { setError(r.body.error || "No se pudo cargar la bitácora"); return; }
    setData(r.body); setError("");
  };
  const load = () => fetchLog().then(apply).catch(() => setError("Sin conexión"));
  useEffect(() => { fetchLog().then(apply).catch(() => setError("Sin conexión")); }, [repairId]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(["RepairLog"], load);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) sileo.warning({ title: `Máximo ${MAX_IMAGES} fotos por entrada` });
    setUploading((n) => n + list.length);
    for (const f of list) {
      try { const url = await uploadImage(f); setImages((prev) => [...prev, url].slice(0, MAX_IMAGES)); }
      catch (e) { sileo.error({ title: (e as Error).message }); }
      setUploading((n) => n - 1);
    }
  };

  const submit = async () => {
    if (saving || uploading) return;
    if (!text.trim() && images.length === 0) { sileo.warning({ title: "Escribe algo o agrega una foto" }); return; }
    const toClient = mode === "cliente" && !isPending;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/repairs/${repairId}/log`, {
        method: "POST",
        body: JSON.stringify({ type: toClient ? "novedad" : "comentario", text, images, visibleToClient: toClient, notifyClient: toClient && notify }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); }
      else {
        sileo.success({ title: toClient ? "Publicado para el cliente" : "Nota interna guardada", description: d.whatsapp === true ? "Se avisó al cliente por WhatsApp." : d.whatsapp === false ? "No se pudo enviar el WhatsApp." : undefined });
        setText(""); setImages([]); setNotify(false); setFormOpen(false);
        load();
      }
    } catch { sileo.error({ title: "Sin conexión" }); }
    setSaving(false);
  };

  const patch = async (e: Entry, body: Record<string, unknown>, ok: string) => {
    const res = await apiFetch(`/api/repairs/${repairId}/log/${e.id}`, { method: "PATCH", body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) sileo.error({ title: d.error || "No se pudo actualizar" });
    else { sileo.success({ title: ok, description: d.whatsapp === true ? "Se avisó al cliente por WhatsApp." : undefined }); load(); }
  };
  const remove = async (e: Entry) => {
    if (!await askConfirm("¿Borrar esta entrada?")) return;
    const res = await apiFetch(`/api/repairs/${repairId}/log/${e.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) sileo.error({ title: d.error || "No se pudo borrar" }); else { sileo.success({ title: "Entrada borrada" }); load(); }
  };
  const toggleVisible = async (e: Entry) => {
    if (e.visibleToClient) return patch(e, { visibleToClient: false }, "Ahora es solo interna");
    const sendWa = data?.hasClientPhone ? await askConfirm("La entrada será visible para el cliente en su seguimiento.\n\n¿Avisarle también por WhatsApp?") : false;
    return patch(e, { visibleToClient: true, notifyClient: sendWa }, "Visible para el cliente");
  };

  const entries = data?.entries || [];
  // La bitácora sigue al trabajo: en Pendiente solo comentarios; el informe final se escribe al completar
  const repairStatus = data?.repairStatus || "pending";
  const isPending = repairStatus === "pending";
  const publicCount = entries.filter((e) => e.visibleToClient && !e.hidden).length;

  return (
    <div onClick={(ev) => ev.stopPropagation()} style={{ background: "#ffffff", borderRadius: 12, overflow: "hidden", border: "1.5px solid var(--text-primary)", boxShadow: "var(--shadow-card)", cursor: "default" }}>
      <div style={{ padding: "8px 14px", background: "var(--brand-dark)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--border-soft)", display: "flex" }}><ClipboardList size={15} strokeWidth={STROKE} aria-hidden="true" /></span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Bitácora técnica</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"}{publicCount > 0 && ` · ${publicCount} visible${publicCount > 1 ? "s" : ""} al cliente`}
        </span>
      </div>

      <div style={{ padding: compact ? 10 : 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ fontSize: 12, color: "var(--danger-bright)" }}>{error}</div>}
        {!data && !error && <div aria-label="Cargando" style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[0, 1].map((i) => <div key={i} style={{ display: "flex", gap: 10 }}><div className="skeleton" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 11, width: "40%", marginBottom: 6 }} /><div className="skeleton" style={{ height: 10, width: "80%" }} /></div></div>)}</div>}

        {/* Línea de tiempo */}
        {data && entries.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "6px 0" }}>
            Todavía no hay registros. Se agregan al avanzar la orden (diagnóstico, repuestos, informe final).
          </div>
        )}
        {entries.length > 0 && (
          // En pantallas anchas, dos columnas (ocupa la mitad de alto); en celular, una
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fill, minmax(min(100%, 380px), 1fr))", gap: 10, alignItems: "start" }}>
            {entries.map((e) => {
              const t = LOG_TYPES[e.type] || LOG_TYPES.avance;
              const isEditing = editing?.id === e.id;
              return (
                <div key={e.id} style={{ display: "flex", gap: 10, opacity: e.hidden ? 0.5 : 1 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: `${t.color}18`, border: `2px solid ${t.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.color }}><LogIcon type={e.type} /></div>
                  <div style={{ flex: 1, minWidth: 0, background: "var(--bg-tertiary)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "8px 11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>· {e.authorName}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({ROLE_LABEL[e.authorRole] || e.authorRole}) · {timeAgo(e.createdAt)}{e.status && STAGE_LABEL[e.status] ? ` · en ${STAGE_LABEL[e.status]}` : ""}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: e.visibleToClient ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: e.visibleToClient ? "var(--ok)" : "var(--text-secondary)" }}>
                        {e.visibleToClient ? <><Eye size={12} strokeWidth={STROKE} aria-hidden="true" /> Cliente</> : <><Lock size={12} strokeWidth={STROKE} aria-hidden="true" /> Interno</>}
                      </span>
                      {e.hidden && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>Oculta</span>}
                    </div>
                    {e.recordedByName && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Registrado por {e.recordedByName} a nombre del técnico</div>}
                    {isEditing ? (
                      <div style={{ marginTop: 6 }}>
                        <textarea aria-label="Editar nota" value={editing.text} onChange={(ev) => setEditing({ id: e.id, text: ev.target.value })} rows={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--accent)", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={async () => { await patch(e, { text: editing.text }, "Entrada corregida"); setEditing(null); }} style={smallBtn("var(--accent)", true)}>Guardar</button>
                          <button onClick={() => setEditing(null)} style={smallBtn("#5a6a80")}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      e.text && e.text !== "(solo fotos)" && <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.45, wordBreak: "break-word" }}>{e.text}</div>
                    )}
                    {e.images.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {e.images.map((src) => (
                          <img loading="lazy" decoding="async" role="button" tabIndex={0} onKeyDown={pressKey} key={src} src={src} alt="Foto de la reparación" onClick={() => setViewer(src)} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-soft)", cursor: "zoom-in" }} />
                        ))}
                      </div>
                    )}
                    {(e.canEdit || data?.isManager) && !isEditing && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {e.canEdit && <button onClick={() => setEditing({ id: e.id, text: e.text === "(solo fotos)" ? "" : e.text })} style={smallBtn("var(--accent)")}><Pencil size={13} strokeWidth={STROKE} aria-hidden="true" /> Corregir</button>}
                        {e.type !== "comentario" && (e.canEdit || data?.isManager) && !e.hidden && (
                          <button onClick={() => toggleVisible(e)} style={smallBtn(e.visibleToClient ? "#5a6a80" : "#10b981")}>{e.visibleToClient ? <><Lock size={13} strokeWidth={STROKE} aria-hidden="true" /> Hacer interna</> : <><Eye size={13} strokeWidth={STROKE} aria-hidden="true" /> Mostrar al cliente</>}</button>
                        )}
                        {e.canEdit && <button onClick={() => remove(e)} style={smallBtn("#dc2626")}><Trash2 size={13} strokeWidth={STROKE} aria-hidden="true" /> Borrar</button>}
                        {data?.isManager && !e.canEdit && (
                          <button onClick={() => patch(e, { hidden: !e.hidden }, e.hidden ? "Entrada restaurada" : "Entrada ocultada")} style={smallBtn(e.hidden ? "#10b981" : "#dc2626")}>{e.hidden ? <><Undo2 size={13} strokeWidth={STROKE} aria-hidden="true" /> Restaurar</> : <><EyeOff size={13} strokeWidth={STROKE} aria-hidden="true" /> Ocultar</>}</button>
                        )}
                        {e.canEdit && <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>Puedes corregirla durante {data?.editWindowMin ?? 15} min</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Agregar nota: los hallazgos, avisos e informe final se registran al avanzar el estado */}
        {data?.canWrite && !formOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={isPending} onClick={() => { setFormOpen(true); setMode("cliente"); }} title={isPending ? "Disponible cuando la orden esté en trabajo" : undefined}
              style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px dashed #0ea5e9", background: "rgba(14,165,233,0.06)", color: "#0369a1", fontSize: 12.5, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}>
              <Megaphone size={14} strokeWidth={STROKE} aria-hidden="true" /> Novedad al cliente
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isPending ? "Primero pulsa Diagnosticar." : "Para hablar con el equipo usa el Chat."}</span>
          </div>
        )}
        {data?.canWrite && formOpen && (
          <div style={{ borderTop: entries.length ? "1px dashed var(--border-strong)" : "none", paddingTop: entries.length ? 12 : 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#0369a1" }}><Megaphone size={15} strokeWidth={STROKE} aria-hidden="true" /> Novedad al cliente <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>· se ve en su seguimiento</span></div>
            <textarea aria-label="Nota de la reparación" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} autoFocus
              placeholder={mode === "cliente" ? "Ej.: encontramos también el ventilador dañado; así quedó el equipo después de la limpieza…" : data.isManager ? "Ej.: el cliente llamó, pide revisar también el teclado…" : "Ej.: ya pedí el repuesto, llega el jueves…"}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, resize: "vertical", fontFamily: "inherit", outline: "none" }} />
            <AiDraft repairId={repairId} stage="novedad" text={text} onUse={setText} />

            {(images.length > 0 || uploading > 0) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {images.map((src) => (
                  <div key={src} style={{ position: "relative" }}>
                    <img src={src} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-soft)" }} />
                    <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== src))} aria-label="Quitar foto" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "var(--danger-bright)", color: "#fff", fontSize: 11, cursor: "pointer" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => <div key={i} style={{ width: 60, height: 60, borderRadius: 8, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-muted)" }}>Subiendo…</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" disabled={images.length >= MAX_IMAGES} onClick={() => cameraRef.current?.click()} style={smallBtn("#1e2a3a")}><Camera size={13} strokeWidth={STROKE} aria-hidden="true" /> Tomar foto</button>
              <button type="button" disabled={images.length >= MAX_IMAGES} onClick={() => galleryRef.current?.click()} style={smallBtn("#1e2a3a")}><Images size={13} strokeWidth={STROKE} aria-hidden="true" /> Galería</button>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Fotos opcionales · {images.length}/{MAX_IMAGES}</span>
            </div>

            {(
              <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.35)" }}>
                <div style={{ fontSize: 11, color: "var(--warn)", lineHeight: 1.45 }}>
                  <TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> El cliente verá este texto, las fotos y tu nombre. Revisa que las fotos no muestren datos privados.
                </div>
                {data.hasClientPhone && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ok)", marginTop: 6, cursor: "pointer", fontWeight: 600 }}>
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    Avisar al cliente por WhatsApp
                  </label>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setFormOpen(false); setText(""); setImages([]); setNotify(false); }} disabled={saving}
                style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={submit} disabled={saving || uploading > 0}
                style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: mode === "cliente" ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : "linear-gradient(135deg, var(--text-secondary), var(--text-secondary))", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "wait" : "pointer", opacity: saving || uploading ? 0.7 : 1 }}>
                {saving ? "Guardando…" : uploading ? "Subiendo fotos…" : mode === "cliente" ? "Publicar al cliente" : "Guardar nota interna"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ImageLightbox src={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function smallBtn(color: string, solid = false): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 8, border: `1px solid ${color}55`, background: solid ? color : `${color}10`, color: solid ? "#fff" : color, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
}
