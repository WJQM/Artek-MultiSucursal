"use client";
import { CircleCheck, CircleX, Hourglass, Link2Off, MapPin, ShoppingBag, Store } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState, use } from "react";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton } from "@/frontend/components/Skeletons";

/** Enlace personal del cliente (llega por WhatsApp): ver su apartado, cuánto le queda, o cancelarlo. */

interface Resv { code: string; status: string; itemName: string; qty: number; total: number; clientName: string; expiresAt: string; until: string; saleCode: string | null; branch: { name: string; address: string | null; map: string | null } }
const STATUS: Record<string, { icon: React.ReactNode; label: string }> = {
  active: { icon: <ShoppingBag size={44} strokeWidth={1.5} aria-hidden="true" />, label: "Apartado" },
  sold: { icon: <CircleCheck size={44} strokeWidth={1.5} aria-hidden="true" />, label: "Recogido" },
  expired: { icon: <Hourglass size={44} strokeWidth={1.5} aria-hidden="true" />, label: "Venció" },
  cancelled: { icon: <CircleX size={44} strokeWidth={1.5} aria-hidden="true" />, label: "Cancelado" },
};

function Left({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return <b suppressHydrationWarning>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</b>;
}

export default function ApartadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [k, setK] = useState("");
  const [r, setR] = useState<Resv | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k") || "";
    setK(key);
    fetch(`/api/reservations/public/${encodeURIComponent(id)}?k=${encodeURIComponent(key)}`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "No se encontró el apartado"); else setR(d);
    }).catch(() => setError("Sin conexión"));
  }, [id]);

  const cancel = async () => {
    if (!await askConfirm("¿Seguro que ya no lo quieres? El producto vuelve a la venta.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/public/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo cancelar"); return; }
      setR((p) => (p ? { ...p, status: "cancelled" } : p));
    } finally { setBusy(false); }
  };

  const st = r ? STATUS[r.status] || STATUS.active : null;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", padding: 16 }}>
      <div style={{ maxWidth: 440, margin: "24px auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: 22, textAlign: "center" }}>
        {error && <><div style={{ fontSize: 40 }}><Link2Off size={40} strokeWidth={1.5} aria-hidden="true" /></div><div style={{ fontWeight: 700, marginTop: 6 }}>{error}</div></>}
        {!r && !error && <ListSkeleton rows={2} />}
        {r && st && (
          <>
            <div style={{ fontSize: 44 }}>{st.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginTop: 6 }}>{st.label} · {r.code}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, textDecoration: r.status === "cancelled" || r.status === "expired" ? "line-through" : "none" }}>{r.itemName}{r.qty > 1 ? ` × ${r.qty}` : ""}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>Bs. {Math.round(r.total).toLocaleString("es-BO")}</div>
            {r.status === "active" && (
              <div style={{ margin: "16px 0 6px", padding: 14, borderRadius: 14, background: "var(--brand-dark)", color: "var(--border-strong)", fontSize: 12, lineHeight: 1.5 }}>
                Te lo guardamos por
                <div style={{ fontSize: 30, color: "var(--accent-on-dark)", letterSpacing: 1, fontVariantNumeric: "tabular-nums" }}><Left to={r.expiresAt} /></div>
                hasta el {r.until}
              </div>
            )}
            {r.status === "active" && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Pagas al recogerlo. Muestra tu código <b>{r.code}</b> en la tienda.</div>}
            {r.status === "sold" && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10 }}>¡Gracias por tu compra!{r.saleCode ? ` Nota de venta ${r.saleCode}.` : ""}</div>}
            {r.status === "expired" && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10 }}>El plazo terminó y el producto volvió a la venta.</div>}
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.branch.name}{r.branch.address ? ` · ${r.branch.address}` : ""}</div>
            {r.branch.map && r.status === "active" && <a href={r.branch.map} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 14, padding: 12, borderRadius: 12, background: "var(--accent-bg-soft)", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}><MapPin size={14} strokeWidth={STROKE} aria-hidden="true" /> Cómo llegar</a>}
            {r.status === "active" && <button disabled={busy} onClick={cancel} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1.5px solid var(--danger-line)", background: "#fff", color: "var(--danger)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "Cancelando…" : "Ya no lo quiero, cancelar apartado"}</button>}
            {(r.status === "cancelled" || r.status === "expired") && <a href="/portal" style={{ display: "block", marginTop: 14, padding: 12, borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Ver productos</a>}
          </>
        )}
        <a href="/portal" style={{ display: "block", marginTop: 6, padding: "10px 0", fontSize: 12.5, color: "var(--text-muted)" }}>Ir al portal</a>
      </div>
    </div>
  );
}
