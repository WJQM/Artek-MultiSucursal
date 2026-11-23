// Estado compartido de instalación PWA (banner + opción del menú lateral).

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_DAYS = 14;

/** Hay dos apps: la del portal (clientes: /portal y /track) y la del sistema (todo lo demás) */
export type PwaApp = "sistema" | "portal";
export function appOf(pathname: string): PwaApp {
  return /^\/(portal|track)(\/|$)/.test(pathname) ? "portal" : "sistema";
}
function currentApp(): PwaApp {
  return typeof window === "undefined" ? "sistema" : appOf(window.location.pathname);
}
// Cada app recuerda por separado si se instaló o si se cerró su aviso
const key = (k: string) => (currentApp() === "portal" ? `${k}:portal` : k);
const DISMISS_KEY = "pwaInstallDismissedUntil";
const INSTALLED_KEY = "pwaInstalled";
const SHOWN_KEY = "pwaBannerShown";

let deferred: BeforeInstallPromptEvent | null = null;
let deferredApp: PwaApp | null = null; // app a la que corresponde el aviso del navegador
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
function ss(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

// layout.tsx guarda aquí el aviso de instalación si llega antes de que cargue este código
type PwaWindow = Window & { __pwaDeferred?: BeforeInstallPromptEvent };

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isInstalled(): boolean {
  return isStandalone() || ls()?.getItem(key(INSTALLED_KEY)) === "1";
}

/** iPhone/iPad en Safari: no hay botón de instalar, se hace con Compartir → Agregar a inicio */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** El usuario cerró o rechazó el banner hace menos de 14 días */
export function isDismissed(): boolean {
  const until = Number(ls()?.getItem(key(DISMISS_KEY)) || 0);
  return until > Date.now();
}

export function dismiss() {
  ls()?.setItem(key(DISMISS_KEY), String(Date.now() + DISMISS_DAYS * 86_400_000));
  notify();
}

/** El banner automático se muestra una sola vez por sesión (antes aparecía en cada página) */
export function bannerAlreadyShown(): boolean {
  return ss()?.getItem(key(SHOWN_KEY)) === "1";
}
export function markBannerShown() {
  ss()?.setItem(key(SHOWN_KEY), "1");
}

export function canInstall(): boolean {
  // El aviso del navegador es de la app de la página donde llegó (portal o sistema)
  return !!deferred && deferredApp === currentApp() && !isInstalled();
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const ev = deferred;
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null; // el evento solo se puede usar una vez
    (window as PwaWindow).__pwaDeferred = undefined;
    if (outcome === "accepted") ls()?.setItem(key(INSTALLED_KEY), "1");
    else dismiss();
    notify();
    return outcome;
  } catch {
    return "unavailable";
  }
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let initialized = false;
/** Se llama una vez al cargar la app */
export function initPwa() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // El script temprano de layout.tsx guarda el evento en window.__pwaDeferred
  const take = () => {
    const ev = (window as PwaWindow).__pwaDeferred as BeforeInstallPromptEvent | undefined;
    if (!ev || ev === deferred) return;
    deferred = ev;
    deferredApp = currentApp();
    // Si el navegador ofrece instalar, la app no está instalada (p. ej. la desinstalaron)
    ls()?.removeItem(key(INSTALLED_KEY));
    notify();
  };
  take();
  window.addEventListener("pwa-deferred", take);

  window.addEventListener("appinstalled", () => {
    deferred = null;
    (window as PwaWindow).__pwaDeferred = undefined;
    ls()?.setItem(key(INSTALLED_KEY), "1");
    notify();
  });
}

/** Estado como valor primitivo para useSyncExternalStore (el React Compiler memoiza llamadas sin dependencias). */
export function getSnapshot(): string {
  // El 3.º carácter: iPhone en Safari sin instalar (se muestra el instructivo)
  const ios = isIosSafari() && !isInstalled();
  return `${canInstall() ? 1 : 0}${isDismissed() ? 1 : 0}${ios ? 1 : 0}${currentApp() === "portal" ? "p" : "s"}`;
}
export function getServerSnapshot(): string {
  return "000s";
}
