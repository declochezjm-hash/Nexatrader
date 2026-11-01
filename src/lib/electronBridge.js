/**
 * Pont renderer ↔ Electron (preload / IPC).
 */

const DESKTOP_UA_TOKEN = 'NexaTraderDesktop';

export function isNexaTraderDesktopShell() {
  if (typeof navigator === 'undefined') return false;
  if (navigator.userAgent.includes(DESKTOP_UA_TOKEN)) return true;
  return Boolean(window.__NEXATRADER_DESKTOP__);
}

/** @deprecated Préférer isNexaTraderDesktopShell — l’UA « Electron » seule inclut Cursor/VS Code. */
export function isRunningInElectronShell() {
  return isNexaTraderDesktopShell();
}

export function isElectronBridgeAvailable() {
  return Boolean(
    typeof window !== 'undefined' &&
      (window.__NEXATRADER_DESKTOP__ ||
        window.nexaTrader?.runtime?.isElectron ||
        window.nexaTrader?.auth?.loginWithGoogle ||
        window.nexaTrader?.invoke),
  );
}

/** Message d’aide selon navigateur vs fenêtre NexaTrader. */
export function getElectronEnvironmentHint() {
  if (isElectronBridgeAvailable()) {
    return null;
  }
  if (isNexaTraderDesktopShell()) {
    return (
      'Pont IPC indisponible dans cette fenêtre. Appuyez sur Ctrl+R pour recharger, ou relancez npm run dev.'
    );
  }
  return (
    'Ouvrez l’application « NexaTrader — Desktop » (npm run dev), pas l’aperçu navigateur de Cursor ni un onglet localhost:5173.'
  );
}

export function waitForElectronBridge(timeoutMs = 15000) {
  if (isElectronBridgeAvailable()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (isElectronBridgeAvailable()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    };
    const timer = setInterval(tick, 100);
    tick();
  });
}

export async function loginWithGoogleIpc() {
  if (window.nexaTrader?.auth?.loginWithGoogle) {
    return window.nexaTrader.auth.loginWithGoogle();
  }
  if (window.nexaTrader?.invoke) {
    return window.nexaTrader.invoke('auth:googleLogin');
  }
  const hint = getElectronEnvironmentHint();
  throw new Error(hint ?? 'Pont Electron introuvable.');
}
