"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TRACK_ICONS, TRACK_ICON_ONCE, trackConfetti } from "@/frontend/lib/track-lottie";

/**
 * Animaciones de la página de seguimiento. La librería se descarga aparte, después de mostrar la página:
 * mientras tanto (o si falla, o si el celular pide "reducir movimiento") se ve el ícono de siempre.
 */
const loadLottie = () => import("lottie-web/build/player/lottie_light").then((m) => m.default);
const prefersStill = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TrackStatusIcon({ status, color, fallback }: { status: string; color: string; fallback: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const holder = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState<string | null>(null);

  useEffect(() => {
    const build = TRACK_ICONS[status];
    if (!build || prefersStill()) return;
    let cancelled = false;
    let stop = () => {};

    loadLottie().then((lottie) => {
      if (cancelled || !box.current) return;
      const once = TRACK_ICON_ONCE.has(status);
      const player = lottie.loadAnimation({ container: box.current, renderer: "svg", loop: !once, autoplay: true, animationData: build() });
      player.addEventListener("DOMLoaded", () => { if (!cancelled) setDrawn(status); });

      // Los dibujos que se repiten descansan si la pestaña está oculta o si ya se bajó en la página
      let onScreen = true;
      const sync = () => {
        if (once) return;
        if (onScreen && document.visibilityState === "visible") player.play();
        else player.pause();
      };
      const watcher = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
      if (holder.current) watcher.observe(holder.current);
      document.addEventListener("visibilitychange", sync);
      stop = () => {
        watcher.disconnect();
        document.removeEventListener("visibilitychange", sync);
        player.destroy();
      };
    }).catch(() => {});

    return () => { cancelled = true; stop(); };
  }, [status]);

  return (
    <span ref={holder} className={`ic${drawn === status ? " has-lot" : ""}`} style={{ background: `${color}33` }} aria-hidden="true">
      <span className="em">{fallback}</span>
      <span ref={box} className="tk2-lot" />
    </span>
  );
}

/** Confeti de "¡Listo para recoger!": una sola vez por orden en cada dispositivo. */
export function TrackConfetti({ active, code }: { active: boolean; code: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || prefersStill()) return;
    const key = `tk-confeti:${code}`;
    try { if (localStorage.getItem(key)) return; } catch {}
    let cancelled = false;
    let stop = () => {};

    loadLottie().then((lottie) => {
      if (cancelled || !box.current) return;
      const player = lottie.loadAnimation({
        container: box.current, renderer: "svg", loop: false, autoplay: true,
        animationData: trackConfetti(), rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
      });
      let alive = true;
      stop = () => { if (alive) { alive = false; player.destroy(); } };
      player.addEventListener("DOMLoaded", () => { if (!cancelled) { try { localStorage.setItem(key, "1"); } catch {} } });
      player.addEventListener("complete", () => stop());
    }).catch(() => {});

    return () => { cancelled = true; stop(); };
  }, [active, code]);

  return <div ref={box} className="tk2-conf" aria-hidden="true" />;
}
