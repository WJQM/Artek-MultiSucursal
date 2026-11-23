"use client";
import { CircleCheck, ClipboardList, MessageCircle, Printer, ShoppingCart, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { nudgeOnBackdrop } from "@/frontend/components/FormKit";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { rxHeroHtml, rxDocument, rxEsc, rxNum, type RxCompany } from "@/frontend/components/ReportSheet";

/**
 * Lista de compra: lo que está en el mínimo o por debajo, con la cantidad sugerida (llegar al doble del mínimo).
 * Se envía al proveedor por WhatsApp, se imprime en carta o se copia.
 */

interface Row { id: string; name: string; quantity: number; minStock: number; kind: string; category?: string | null; suggested: number }
interface Data { branch: string; company: string; supplier: { name: string; phone: string }; items: Row[] }

const waNumber = (p: string) => { let d = p.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length === 8) d = "591" + d; return d.length >= 10 ? d : ""; };

export function PurchaseList({ kind, onClose }: { kind: "all" | "product" | "part"; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // Datos del taller (logo, teléfono) para el encabezado de la hoja impresa
  const [company, setCompany] = useState<RxCompany | null>(null);
  useEffect(() => { fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setCompany(d); }).catch(() => {}); }, []);

  useEffect(() => {
    apiFetch(`/api/inventory/purchase${kind === "all" ? "" : `?kind=${kind}`}`).then((r) => r.json()).then((d: Data & { error?: string }) => {
      if (d.error) { sileo.error({ title: d.error }); closeRef.current(); return; }
      setData(d);
      setQty(Object.fromEntries(d.items.map((i) => [i.id, i.suggested])));
      // Marcados: los que están por debajo del mínimo (los que están justo en el mínimo, a elección)
      setOn(Object.fromEntries(d.items.map((i) => [i.id, i.quantity < i.minStock])));
      setSupName(d.supplier.name); setSupPhone(d.supplier.phone);
    }).catch(() => { sileo.error({ title: "Sin conexión" }); closeRef.current(); });
  }, [kind]);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", k); };
  }, []);

  if (typeof document === "undefined") return null;
  const chosen = (data?.items || []).filter((i) => on[i.id] && (qty[i.id] || 0) > 0);
  const who = [data?.company, data?.branch && (/^sucursal/i.test(data.branch) ? data.branch : `Sucursal ${data.branch}`)].filter(Boolean).join(" – ");
  const today = new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const text = () => `Hola${supName ? ` ${supName}` : ""}, buenas. Pedido de *${who || "el taller"}* (${today}):\n\n${chosen.map((i) => `• ${qty[i.id]} × ${i.name}`).join("\n")}\n\n¿Me confirma disponibilidad y precio? Gracias.`;

  const saveSupplier = () => { apiFetch("/api/inventory/purchase", { method: "PUT", body: JSON.stringify({ name: supName, phone: supPhone }) }).catch(() => {}); };
  const whatsapp = () => {
    if (!chosen.length) { sileo.error({ title: "Marca al menos un producto" }); return; }
    const n = waNumber(supPhone);
    if (supPhone && !n) { sileo.error({ title: "Celular del proveedor inválido" }); return; }
    if (supPhone !== data?.supplier.phone || supName !== data?.supplier.name) saveSupplier();
    window.open(`https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(text())}`, "_blank");
  };
  const copy = async () => {
    if (!chosen.length) { sileo.error({ title: "Marca al menos un producto" }); return; }
    try { await navigator.clipboard.writeText(text().replace(/\*/g, "")); sileo.success({ title: "Lista copiada" }); } catch { sileo.error({ title: "No se pudo copiar" }); }
  };
  const print = () => {
    if (!chosen.length) { sileo.error({ title: "Marca al menos un producto" }); return; }
    const w = window.open("", "_blank");
    if (!w) return;
    const units = chosen.reduce((a, i) => a + (qty[i.id] || 0), 0);
    const rows = chosen.map((i, n) => `<tr><td class="c"><span class="rx-check"></span></td><td class="c muted">${n + 1}</td>`
      + `<td><b>${rxEsc(i.name)}</b>${i.category ? `<div class="muted" style="font-size:10px">${rxEsc(i.category)}</div>` : ""}</td>`
      + `<td class="n" style="color:${i.quantity < i.minStock ? "#dc2626" : "inherit"};font-weight:700">${rxNum(i.quantity)}</td><td class="n muted">${rxNum(i.minStock)}</td>`
      + `<td class="n" style="font-weight:800;font-size:13px">${rxNum(qty[i.id] || 0)}</td><td style="width:110px"></td></tr>`).join("");
    const s: RxCompany = company || { companyName: data?.company || "" };
    const body = rxHeroHtml({ s, branch: data?.branch, icon: "", label: "Lista de compra", title: today, sub: supName ? `Proveedor: ${supName}${supPhone ? ` · ${supPhone}` : ""}` : "Sin proveedor asignado" })
      + `<div class="rx-kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">`
      + `<div class="rx-kpi" style="--c:#0e7c86"><span>Productos</span><b>${rxNum(chosen.length)}</b><small>en esta lista</small></div>`
      + `<div class="rx-kpi" style="--c:#f59e0b"><span>Unidades a pedir</span><b>${rxNum(units)}</b><small>en total</small></div>`
      + `<div class="rx-kpi" style="--c:#dc2626"><span>Debajo del mínimo</span><b>${rxNum(chosen.filter((i) => i.quantity < i.minStock).length)}</b><small>los más urgentes</small></div></div>`
      + `<div><div class="rx-sect">Productos a comprar <em>marca ✓ lo que ya compraste</em></div>`
      + `<div class="rx-tw"><table class="rx-t"><thead><tr><th class="c" style="width:34px">✓</th><th class="c" style="width:34px">#</th><th>Producto</th><th class="n">Hay</th><th class="n">Mínimo</th><th class="n">Pedir</th><th>Precio</th></tr></thead>`
      + `<tbody>${rows}</tbody><tfoot><tr><td colspan="5">Total a pedir</td><td class="n">${rxNum(units)}</td><td></td></tr></tfoot></table></div></div>`
      + `<p class="rx-note">Cantidad sugerida: llegar al doble del stock mínimo. La columna “Precio” queda libre para anotarlo en la tienda.</p>`
      + `<div class="rx-foot"><span>${rxEsc(who)}</span><span>Lista de compra · ${rxEsc(today)}</span></div>`;
    w.document.write(rxDocument({ title: "Lista de compra", barTitle: "Lista de compra", body, autoPrint: true }));
    w.document.close();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Lista de compra" onClick={nudgeOnBackdrop}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "calc(100dvh - 24px)", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "14px 18px", background: "var(--text-primary)", color: "#fff", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}><ShoppingCart size={20} strokeWidth={STROKE} aria-hidden="true" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Lista de compra</div>
            <div style={{ fontSize: 11.5, opacity: 0.8 }}>{data ? `${data.branch} · ${data.items.length} en el mínimo o por debajo` : "Cargando…"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {data && !data.items.length && <div style={{ textAlign: "center", padding: 24, color: "var(--ok)", fontWeight: 700 }}><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Todo tiene stock suficiente. Nada por reponer.</div>}
          {data && data.items.length > 0 && (
            <>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "var(--bg-primary)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                  <span style={{ width: 22 }} /><span style={{ flex: 1 }}>Producto</span><span style={{ width: 52, textAlign: "center" }}>Hay/Mín</span><span style={{ width: 60, textAlign: "center" }}>Pedir</span>
                </div>
                {data.items.map((i) => (
                  <div key={i.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 10px", borderTop: "1px solid var(--bg-hover)", opacity: on[i.id] ? 1 : 0.55 }}>
                    <input type="checkbox" aria-label={`Pedir ${i.name}`} checked={!!on[i.id]} onChange={(e) => setOn((p) => ({ ...p, [i.id]: e.target.checked }))} style={{ width: 22, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{i.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{i.kind === "part" ? "Repuesto" : "Producto"}{i.category ? ` · ${i.category}` : ""}</span>
                    </span>
                    <span style={{ width: 52, flexShrink: 0, textAlign: "center", fontWeight: 700, fontSize: 13, color: i.quantity < i.minStock ? "var(--danger-bright)" : "var(--warn-bright)" }}>{i.quantity}/{i.minStock}</span>
                    <input aria-label={`Cantidad a pedir de ${i.name}`} type="number" min={0} max={9999} value={qty[i.id] ?? 0} onChange={(e) => setQty((p) => ({ ...p, [i.id]: Math.max(0, Math.min(9999, parseInt(e.target.value) || 0)) }))}
                      style={{ width: 60, flexShrink: 0, padding: "6px 4px", border: "1px solid var(--border-strong)", borderRadius: 8, textAlign: "center", fontWeight: 700, fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Cantidad sugerida: llegar al doble del mínimo. Puedes cambiarla. Los que están justo en el mínimo vienen sin marcar.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input aria-label="Proveedor" value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="Proveedor (opcional)" style={inp} />
                <input aria-label="Celular del proveedor" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} placeholder="Celular del proveedor" inputMode="tel" style={inp} />
              </div>
              <button type="button" onClick={whatsapp} style={{ padding: 12, borderRadius: 10, border: "none", background: "#25d366", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                <MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> Enviar pedido por WhatsApp ({chosen.length})
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={print} style={btnO}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir (carta)</button>
                <button type="button" onClick={copy} style={btnO}><ClipboardList size={14} strokeWidth={STROKE} aria-hidden="true" /> Copiar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const inp: React.CSSProperties = { flex: "1 1 180px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 0 };
const btnO: React.CSSProperties = { flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
