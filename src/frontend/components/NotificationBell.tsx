"use client";
import { Bell } from "@/frontend/components/icons";
import { NotifIcon, STROKE } from "@/frontend/components/UiIcons";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { useLiveRefresh } from "@/frontend/lib/live";
import { useBumpOnIncrease } from "@/frontend/lib/motion";
import { useRouter } from "next/navigation";
import { sileo } from "@/frontend/lib/toast";
import { askConfirm } from "@/frontend/lib/dialog";

// Mismos íconos que el Panel Principal

/**
 * Campana de notificaciones (barra superior y Mis Asignaciones), con el mismo diseño que la del Panel Principal. Se actualiza en tiempo real;
 * al tocar un aviso de una orden ("… en OT-12") llama a onOpenCode para abrirla.
 */
interface Notif { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }

export function NotificationBell({ onOpenCode }: { onOpenCode?: (code: string) => void }) {
  const [list, setList] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const load = () => apiFetch("/api/notifications").then((r) => (r.ok ? r.json() : [])).then((d) => { if (Array.isArray(d)) setList(d); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useLiveRefresh(["Notification"], load);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = list.filter((n) => !n.read).length;
  // Llega una notificación nueva: la campana se sacude
  const bellRef = useRef<HTMLSpanElement>(null);
  useBumpOnIncrease(unread, bellRef, "rt-ring");
  const markRead = (id: string) => { setList((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n))); apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: id }) }).catch(() => {}); };
  const markAll = () => { setList((l) => l.map((n) => ({ ...n, read: true }))); apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ markAll: true }) }).catch(() => {}); };

  const clearAll = async () => {
    if (!await askConfirm("¿Eliminar todas las notificaciones?")) return;
    const r = await apiFetch("/api/notifications", { method: "DELETE" }).catch(() => null);
    if (r?.ok) { setList([]); setOpen(false); sileo.success({ title: "Notificaciones limpiadas" }); }
  };

  // Mismo diseño que la campana del Panel Principal
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="topbar-bell" aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ""}`}
        style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid var(--border)", background: open ? "rgba(var(--accent-bright-rgb), 0.08)" : "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative", overflow: "visible", transition: "background 0.2s, border-color 0.2s" }}>
        <span ref={bellRef} style={{ display: "inline-block", lineHeight: 0 }}><Bell size={19} strokeWidth={STROKE} aria-hidden="true" /></span>
        {unread > 0 && <span key={unread} className="rt-pop" style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px", background: "var(--danger-bright)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", border: "2px solid var(--bg-primary)", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 46, right: 0, width: "min(380px, calc(100vw - 24px))", maxHeight: 460, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 12px 48px rgba(26,29,46,0.40)", overflow: "hidden", zIndex: 60, animation: "fadeScale 0.2s ease-out" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notificaciones {unread > 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", background: "rgba(239,68,68,0.12)", color: "var(--danger-bright)", borderRadius: 10, fontWeight: 600 }}>{unread}</span>}</span>
            <div style={{ display: "flex", gap: 10 }}>
              {unread > 0 && <button type="button" onClick={markAll} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>✓ Leídas</button>}
              {list.length > 0 && <button type="button" onClick={clearAll} style={{ background: "none", border: "none", color: "var(--danger-bright)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Limpiar</button>}
            </div>
          </div>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            {list.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}><div style={{ marginBottom: 8, opacity: 0.5 }}><Bell size={28} strokeWidth={1.5} aria-hidden="true" /></div><p style={{ fontSize: 13 }}>Sin notificaciones</p></div>
            ) : list.map((n, i) => {
              const code = n.title.match(/\b([A-Z]{1,4}-\d+)\b/)?.[1] || n.message.match(/\b(OT-\d+)\b/)?.[1];
              return (
                <div key={n.id} role="button" tabIndex={0}
                  onClick={() => { markRead(n.id); if (n.type === "review") { setOpen(false); router.push("/reviews"); } else if (code && onOpenCode) { onOpenCode(code); setOpen(false); } }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLDivElement).click(); }}
                  style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", background: n.read ? "transparent" : "rgba(99,102,241,0.03)", display: "flex", gap: 12, alignItems: "flex-start", animation: `fadeIn 0.2s ease-out ${i * 0.03}s both` }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: n.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(n.createdAt).toLocaleString("es-BO", { hourCycle: "h23" })}</div>
                  </div>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 6 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
