"use client";
import { Camera, Images, X } from "@/frontend/components/icons";
import { STROKE, StatusIcon } from "@/frontend/components/UiIcons";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { uploadImage } from "@/frontend/lib/upload-image";
import { celebrate } from "@/frontend/lib/motion";
import { AiDraft } from "@/frontend/components/AiDraft";

/**
 * "Registrar y avanzar": al avanzar el estado de una orden se escribe en la bitácora lo que
 * corresponde a esa etapa (diagnóstico, repuesto que falta, informe final). Estado y registro
 * se guardan juntos. Fotos opcionales. El administrador puede registrar a nombre del técnico.
 */

const STAGES: Record<string, { label: string; color: string; title: string; ask: string; placeholder: string; required: boolean }> = {
  diagnosed: { label: "Diagnosticado", color: "#0e7490", title: "Diagnóstico", ask: "¿Qué encontraste en el equipo?", placeholder: "Ej.: humedad en la placa, conector de carga flojo, disco con sectores dañados…", required: true },
  waiting_parts: { label: "Esperando repuestos", color: "#c2410c", title: "Repuesto necesario", ask: "¿Qué repuesto falta?", placeholder: "Ej.: pantalla 15.6\" 30 pines, batería original, llega en 3 días…", required: true },
  in_progress: { label: "En progreso", color: "#2563eb", title: "Inicio de la reparación", ask: "¿Qué vas a hacer? (opcional)", placeholder: "Ej.: cambio de pantalla y limpieza interna…", required: false },
  completed: { label: "Completado", color: "#047857", title: "Informe final", ask: "¿Qué se hizo y qué recomiendas al cliente?", placeholder: "Ej.: se cambió la pantalla, se probó 2 horas sin fallas. Recomendación: usar funda protectora…", required: true },
};
const MAX_IMAGES = 6;

export function needsAdvanceDialog(to: string) { return to in STAGES; }

export function AdvanceDialog({ repair, to, isManager, onClose, onDone }: {
  repair: { id: string; code: string; device?: string; technicianId?: string | null; technicianName?: string | null; clientPhone?: string | null };
  to: string;
  isManager: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const stage = STAGES[to];
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [visible, setVisible] = useState(to === "completed");
  const canOnBehalf = isManager && !!repair.technicianId;
  const [onBehalf, setOnBehalf] = useState(canOnBehalf);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose, saving]);

  if (!stage || typeof document === "undefined") return null;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try { const url = await uploadImage(f); setImages((p) => [...p, url].slice(0, MAX_IMAGES)); }
      catch (e) { sileo.error({ title: (e as Error).message }); }
      setUploading((n) => n - 1);
    }
  };

  const tooShort = stage.required && text.trim().length < 3;

  const submit = async () => {
    if (saving || uploading) return;
    if (tooShort) { setError(`Escribe ${stage.ask.toLowerCase().replace(/[¿?]/g, "")} para poder avanzar.`); return; }
    setSaving(true); setError("");
    try {
      const res = await apiFetch(`/api/repairs/${repair.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: to, log: { text, images, visibleToClient: visible, onBehalf: canOnBehalf && onBehalf } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo avanzar"); setSaving(false); return; }
      celebrate(to === "completed" ? "complete" : "advance");
      // Ej.: "OT-13 pasó a Completado" · "Informe final guardado en la bitácora · visible para el cliente"
      sileo.success({
        title: `${repair.code} pasó a ${stage.label}`,
        description: text.trim() || images.length
          ? `${stage.title} guardado en la bitácora${visible ? " · visible para el cliente" : ""}${canOnBehalf && onBehalf && repair.technicianName ? ` · a nombre de ${repair.technicianName}` : ""}.`
          : undefined,
      });
      onDone();
    } catch { setError("Sin conexión"); setSaving(false); }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Pasar a ${stage.label}`}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "calc(100dvh - 24px)", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "14px 18px", background: stage.color, color: "#fff", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
          <StatusIcon status={to} size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pasar a {stage.label}</div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>{repair.code}{repair.device ? ` · ${repair.device}` : ""}</div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cancelar" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", display: "grid", placeItems: "center", padding: 0, cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="f-advancedialog-1" style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
            {stage.title}: {stage.ask} {stage.required && <span style={{ color: "var(--danger-bright)" }}>*</span>}
          </label>
          <textarea id="f-advancedialog-1" value={text} onChange={(e) => { setText(e.target.value); if (error) setError(""); }} rows={4} maxLength={2000} autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${error ? "var(--danger-bright)" : "var(--border-strong)"}`, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none" }} />
          <AiDraft repairId={repair.id} stage={to} text={text} onUse={(t) => { setText(t); if (error) setError(""); }} />

          {(images.length > 0 || uploading > 0) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {images.map((src) => (
                <div key={src} style={{ position: "relative" }}>
                  <img src={src} alt="" style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-soft)" }} />
                  <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== src))} aria-label="Quitar foto" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "var(--danger-bright)", color: "#fff", display: "grid", placeItems: "center", padding: 0, cursor: "pointer" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => <div key={i} style={{ width: 62, height: 62, borderRadius: 8, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-muted)" }}>Subiendo…</div>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <button type="button" disabled={images.length >= MAX_IMAGES} onClick={() => cameraRef.current?.click()} style={btn}><Camera size={14} strokeWidth={STROKE} aria-hidden="true" />Tomar foto</button>
            <button type="button" disabled={images.length >= MAX_IMAGES} onClick={() => galleryRef.current?.click()} style={btn}><Images size={14} strokeWidth={STROKE} aria-hidden="true" />Galería</button>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Fotos opcionales · {images.length}/{MAX_IMAGES}</span>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--text-primary)", fontWeight: 700, padding: "8px 10px", borderRadius: 10, background: visible ? "rgba(16,185,129,0.07)" : "var(--bg-tertiary)", border: `1px solid ${visible ? "rgba(16,185,129,0.35)" : "var(--border-soft)"}`, cursor: "pointer" }}>
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              Visible para el cliente en su seguimiento
              <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: visible ? "var(--warn)" : "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>
                {visible
                  ? `Lo verá con tu nombre${repair.clientPhone ? " y le llegará en el WhatsApp de cambio de estado" : ""}. Revisa que las fotos no muestren datos privados.`
                  : "Si no lo marcas, queda solo para el personal."}
              </span>
            </span>
          </label>

          {canOnBehalf && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--text-primary)", fontWeight: 700, padding: "8px 10px", borderRadius: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-soft)", cursor: "pointer" }}>
              <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                Registrar a nombre de {repair.technicianName || "el técnico asignado"}
                <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginTop: 3 }}>Queda anotado que lo registraste tú.</span>
              </span>
            </label>
          )}

          {error && <div role="alert" style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-line)", borderRadius: 8, padding: "8px 10px" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            <button type="button" onClick={submit} disabled={saving || uploading > 0}
              style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: tooShort ? "var(--border-strong)" : stage.color, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Guardando…" : uploading ? "Subiendo fotos…" : `Registrar y pasar a ${stage.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, border: "1px solid #1e2a3a55", background: "#1e2a3a10", color: "#1e2a3a", fontSize: 11.5, fontWeight: 700, cursor: "pointer" };
