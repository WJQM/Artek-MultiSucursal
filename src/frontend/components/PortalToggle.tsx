"use client";
// Botón "Portal / Oculto" de las tarjetas del catálogo y etiqueta "Oculto en portal"

const EYE = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EYE_OFF = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19" /><path d="M6.61 6.61A17.5 17.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;

export function PortalToggle({ visible, onToggle, grow }: { visible: boolean; onToggle: () => void; grow?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={visible}
      aria-label={visible ? "Ocultar del portal" : "Mostrar en el portal"}
      title={visible ? "Visible en el portal: tocar para ocultarlo" : "Oculto en el portal: tocar para mostrarlo"}
      style={{
        flex: grow ? "1 1 90px" : undefined, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        background: visible ? "rgba(16,185,129,0.08)" : "rgba(100,116,139,0.10)",
        border: `1px solid ${visible ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.3)"}`, borderRadius: 8,
        color: visible ? "var(--ok)" : "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {visible ? EYE : EYE_OFF}
      <span className="cat-lbl">{visible ? "Portal" : "Oculto"}</span>
    </button>
  );
}

export function HiddenBadge({ top = 10, left = 10, inline = false }: { top?: number; left?: number; inline?: boolean }) {
  return (
    <div style={{ ...(inline ? { alignSelf: "flex-start" } : { position: "absolute", top, left, zIndex: 3 }), padding: "3px 8px", borderRadius: 6, background: "rgba(30,42,58,0.88)", color: "#fff", fontSize: 11, fontWeight: 700, pointerEvents: "none" }}>
      Oculto en portal
    </div>
  );
}

/** Cambia la visibilidad con respuesta inmediata y vuelve atrás si el servidor falla */
export async function togglePortalVisibility<T extends { id: string; showInPortal?: boolean }>(
  item: T,
  endpoint: string,
  setItems: (fn: (prev: T[]) => T[]) => void,
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>,
  toast: { success: (o: { title: string }) => void; error: (o: { title: string }) => void },
) {
  const next = item.showInPortal === false;
  setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, showInPortal: next } : x)));
  try {
    const res = await apiFetch(endpoint, { method: "PATCH", body: JSON.stringify({ id: item.id, showInPortal: next }) });
    if (!res.ok) throw new Error();
    toast.success({ title: next ? "Ahora se ve en el portal" : "Oculto en el portal" });
  } catch {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, showInPortal: !next } : x)));
    toast.error({ title: "No se pudo cambiar" });
  }
}
