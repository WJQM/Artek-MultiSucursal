"use client";
import type { ReactNode } from "react";
import type { AppIcon } from "@/frontend/components/icons";

export interface AuthFeature { Icon: AppIcon; title: string; text: string }

/**
 * Diseño común de las pantallas de entrada (login del personal y del Super Admin):
 * panel oscuro con la marca a la izquierda y el formulario centrado a la derecha.
 * En celular el panel se vuelve una franja arriba con la marca y el título.
 * Clases del formulario: au-input, au-btn, au-link, au-label.
 */
export function AuthLayout({ brand, title, subtitle, features, footer, mounted, children }: {
  brand: ReactNode; title: ReactNode; subtitle: string; features: AuthFeature[]; footer: ReactNode; mounted: boolean; children: ReactNode;
}) {
  return (
    <div className="au-root">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .au-root { min-height: 100dvh; display: flex; background: #fff; color: var(--text-primary); }
        .au-side { width: 42%; max-width: 600px; flex-shrink: 0; background: var(--brand-dark); color: #fff; padding: 44px clamp(32px, 4.5vw, 64px); display: flex; flex-direction: column; }
        .au-mid { margin: auto 0; padding: 40px 0; }
        .au-title { font-size: clamp(26px, 2.4vw, 32px); font-weight: 700; line-height: 1.2; letter-spacing: -0.5px; }
        .au-title span { color: var(--accent-on-dark-soft); }
        .au-sub { font-size: 15px; color: var(--border-strong); margin: 12px 0 32px; max-width: 380px; line-height: 1.5; }
        .au-feat { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 22px; }
        .au-feat-ic { width: 42px; height: 42px; border-radius: 11px; background: rgba(255,255,255,.07); color: #5fd4dc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .au-feat b { display: block; font-size: 15px; font-weight: 600; }
        .au-feat small { display: block; font-size: 13px; color: var(--text-faint); margin-top: 3px; }
        .au-foot { font-size: 12px; color: var(--text-faint); }
        .au-main { flex: 1; display: flex; flex-direction: column; min-width: 0; padding: 28px clamp(20px, 5vw, 64px); }
        .au-card { width: 100%; max-width: 420px; margin: auto; padding: 24px 0; opacity: 0; transform: translateY(12px); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1); }
        .au-card.in { opacity: 1; transform: none; }
        .au-label { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 7px; }
        .au-input { width: 100%; height: 48px; padding: 0 14px; background: #fff; border: 1px solid var(--border-strong); border-radius: 10px; color: var(--text-primary); font-size: 16px; outline: none; font-family: inherit; box-shadow: 0 1px 2px rgba(16,24,40,.05); transition: border-color .15s, box-shadow .15s; }
        select.au-input { padding-right: 10px; }
        .au-input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15) !important; }
        .au-input::placeholder { color: var(--text-muted); }
        .au-btn { width: 100%; height: 48px; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; color: #fff; background: var(--accent); cursor: pointer; font-family: inherit; }
        @media (hover: hover) and (pointer: fine) { .au-btn:hover:not(:disabled) { filter: none !important; background: var(--accent-dim); } }
        .au-btn:disabled { background: var(--border-strong); }
        .au-link { background: none; border: none; padding: 0; color: var(--accent); cursor: pointer; font-weight: 600; font-family: inherit; font-size: inherit; text-decoration: none; }
        @media (hover: hover) and (pointer: fine) { .au-link:hover { text-decoration: underline; } }
        @media (max-width: 900px) {
          .au-root { flex-direction: column; }
          .au-side { width: auto; max-width: none; padding: 20px; }
          .au-mid { margin: 16px 0 0; padding: 0; }
          .au-title { font-size: 21px; }
          .au-sub, .au-feats, .au-foot { display: none; }
          .au-main { padding: 8px 20px 28px; }
          .au-card { margin: 0 auto; }
        }
      `}</style>

      <aside className="au-side">
        {brand}
        <div className="au-mid">
          <div className="au-title">{title}</div>
          <p className="au-sub">{subtitle}</p>
          <div className="au-feats">
            {features.map(({ Icon, title: t, text }) => (
              <div key={t} className="au-feat">
                <div className="au-feat-ic"><Icon size={22} aria-hidden="true" /></div>
                <div><b>{t}</b><small>{text}</small></div>
              </div>
            ))}
          </div>
        </div>
        <div className="au-foot">{footer}</div>
      </aside>

      <main className="au-main">
        <div className={`au-card${mounted ? " in" : ""}`}>{children}</div>
      </main>
    </div>
  );
}
