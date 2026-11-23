"use client";
import { CalendarDays, CircleCheck, CircleX, Link2Off, MapPin } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState, use } from "react";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton } from "@/frontend/components/Skeletons";

/** Enlace personal del cliente (llega por WhatsApp): ver o cancelar su cita. */

interface Appt { code: string; when: string; status: string; clientName: string; device: string; issue: string | null; branch: { name: string; address: string | null; map: string | null }; canCancel: boolean }
const STATUS: Record<string, string> = { new: "Reservada", confirmed: "Confirmada por el taller", cancelled: "Cancelada", done: "Atendida", noshow: "No asistió" };

export default function CitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [k, setK] = useState("");
  const [a, setA] = useState<Appt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k") || "";
    setK(key);
    fetch(`/api/appointments/public/${encodeURIComponent(id)}?k=${encodeURIComponent(key)}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "No se encontró la cita"); else setA(d);
    }).catch(() => setError("Sin conexión"));
  }, [id]);

  const cancel = async () => {
    if (!await askConfirm("¿Seguro que quieres cancelar tu cita?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/appointments/public/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo cancelar"); return; }
      setA((p) => (p ? { ...p, status: "cancelled", canCancel: false } : p));
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", padding: 16 }}>
      <div style={{ maxWidth: 480, margin: "24px auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20, textAlign: "center" }}>
        {error && <><div style={{ fontSize: 40 }}><Link2Off size={40} strokeWidth={1.5} aria-hidden="true" /></div><div style={{ fontWeight: 700, marginTop: 6 }}>{error}</div></>}
        {!a && !error && <ListSkeleton rows={2} />}
        {a && (
          <>
            <div style={{ fontSize: 40 }}>{a.status === "cancelled" ? <CircleX size={40} strokeWidth={1.5} aria-hidden="true" /> : a.status === "done" ? <CircleCheck size={40} strokeWidth={1.5} aria-hidden="true" /> : <CalendarDays size={40} strokeWidth={1.5} aria-hidden="true" />}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginTop: 6 }}>{STATUS[a.status] || a.status} · {a.code}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, textDecoration: a.status === "cancelled" ? "line-through" : "none" }}>{a.when}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6 }}>{a.clientName} · {a.device}{a.issue ? ` — ${a.issue}` : ""}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> {a.branch.name}{a.branch.address ? ` · ${a.branch.address}` : ""}</div>
            {a.branch.map && a.status !== "cancelled" && <a href={a.branch.map} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 14, padding: 12, borderRadius: 12, background: "var(--accent-bg-soft)", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> Cómo llegar</a>}
            {a.canCancel && <button disabled={busy} onClick={cancel} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1.5px solid var(--danger-line)", background: "#fff", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>{busy ? "Cancelando…" : "Cancelar mi cita"}</button>}
            {a.status === "cancelled" && <a href="/reservar" style={{ display: "block", marginTop: 14, padding: 12, borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Reservar otro horario</a>}
          </>
        )}
        <a href="/portal" style={{ display: "block", marginTop: 6, padding: "10px 0", fontSize: 12.5, color: "var(--text-muted)" }}>Ir al portal</a>
      </div>
    </div>
  );
}
