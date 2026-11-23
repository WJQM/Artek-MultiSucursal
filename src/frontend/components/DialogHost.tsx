"use client";

import { useEffect, useSyncExternalStore } from "react";
import { closeDialog, dialogStore } from "@/frontend/lib/dialog";

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const CLOSE_TEXT = /^(✕|×|✖|cerrar|listo|ahora no|cancelar|entendido)$/i;

const focusablesIn = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);

function closerOf(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>("[data-close]")
    || el.querySelector<HTMLElement>('button[aria-label^="Cerrar"]')
    || [...el.querySelectorAll<HTMLElement>("button")].find((b) => CLOSE_TEXT.test((b.textContent || "").trim()))
    || el;
}

/**
 * Comportamiento común de todas las ventanas (`aria-modal="true"`): el foco entra al abrir, Tab no sale
 * de la ventana y vuelve al botón de origen al cerrar. Con `data-esc`, la tecla Escape la cierra.
 */
function useModalBehavior() {
  useEffect(() => {
    const stack: { el: HTMLElement; back: HTMLElement | null }[] = [];
    let pending = 0;

    const focusInto = (el: HTMLElement) => {
      if (el.contains(document.activeElement)) return;
      const target = el.querySelector<HTMLElement>("[data-autofocus]") || el;
      if (target === el && !el.hasAttribute("tabindex")) el.tabIndex = -1;
      target.focus({ preventScroll: true });
      if (target instanceof HTMLTextAreaElement) target.select();
    };
    const sync = () => {
      pending = 0;
      const open = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')];
      for (let i = stack.length - 1; i >= 0; i--) {
        if (open.includes(stack[i].el)) continue;
        const wasTop = i === stack.length - 1;
        const [gone] = stack.splice(i, 1);
        if (wasTop && gone.back?.isConnected) gone.back.focus({ preventScroll: true });
      }
      for (const el of open) {
        if (stack.some((s) => s.el === el)) continue;
        stack.push({ el, back: document.activeElement instanceof HTMLElement ? document.activeElement : null });
        focusInto(el);
      }
    };
    const schedule = () => { if (!pending) pending = window.setTimeout(sync, 0); };
    const onKey = (e: KeyboardEvent) => {
      const top = stack[stack.length - 1]?.el;
      if (!top || e.defaultPrevented) return;
      if (e.key === "Escape" && top.hasAttribute("data-esc")) {
        e.preventDefault();
        e.stopImmediatePropagation(); // solo se cierra la ventana de arriba
        closerOf(top).click();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusablesIn(top);
      if (!items.length) { e.preventDefault(); top.focus({ preventScroll: true }); return; }
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (!top.contains(active) || (e.shiftKey && (active === first || active === top))) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };

    const watcher = new MutationObserver(schedule);
    watcher.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    sync();
    return () => { watcher.disconnect(); document.removeEventListener("keydown", onKey); clearTimeout(pending); };
  }, []);
}

export function DialogHost() {
  useModalBehavior();
  const queue = useSyncExternalStore(dialogStore.subscribe, dialogStore.get, () => dialogStore.empty);
  const d = queue[0];
  if (!d) return null;
  const cancel = () => closeDialog(d.id, false);
  const danger = d.kind === "confirm" && d.danger;

  return (
    <div className="rt-dlg" key={d.id} role="alertdialog" aria-modal="true" aria-labelledby={`rt-dlg-${d.id}`} data-esc
      onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="rt-dlg-card rt-pop">
        {d.kind !== "copy" && d.title && <h2 className="rt-dlg-title">{d.title}</h2>}
        <p className="rt-dlg-msg" id={`rt-dlg-${d.id}`}>{d.message}</p>
        {d.kind === "copy" && (
          <textarea className="rt-dlg-copy" aria-label={d.message} readOnly value={d.text} rows={Math.min(8, d.text.split("\n").length + 1)} data-autofocus />
        )}
        <div className="rt-dlg-acts">
          {d.kind === "confirm" && <button type="button" className="rt-dlg-btn" data-close data-autofocus={danger ? "" : undefined} onClick={cancel}>{d.cancelLabel}</button>}
          <button type="button" className={`rt-dlg-btn ${danger ? "danger" : "primary"}`} data-close={d.kind === "confirm" ? undefined : ""}
            data-autofocus={d.kind === "copy" || danger ? undefined : ""} onClick={() => closeDialog(d.id, true)}>{d.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
