import { useEffect, useState } from 'react';

/** Fonctions liées à l'appareil : installation de l'appli, notifications système, pastille d'icône. */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIOS(),
    async install() {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      listeners.forEach((l) => l());
      return outcome === 'accepted';
    },
  };
}

const PREF = 'mahq_notifs_appareil';
export const notifSupported = () => 'Notification' in window;
export const notifEnabled = () => {
  try { return notifSupported() && Notification.permission === 'granted' && localStorage.getItem(PREF) !== 'off'; } catch { return false; }
};

export async function enableNotifications() {
  if (!notifSupported()) throw new Error('Ce navigateur ne gère pas les notifications. Sur iPhone : installe d’abord l’appli sur l’écran d’accueil.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées. Tu peux les réautoriser dans les réglages du navigateur.');
  try { localStorage.setItem(PREF, 'on'); } catch { /* ignoré */ }
}

export function disableNotifications() {
  try { localStorage.setItem(PREF, 'off'); } catch { /* ignoré */ }
}

/** Affiche une notification système (via le service worker quand il existe : indispensable sur mobile). */
export async function showSystemNotification(title: string, body: string, url: string) {
  if (!notifEnabled()) return;
  const opts = { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url }, tag: url };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch { /* on retombe sur l'API simple */ }
  const n = new Notification(title, opts);
  n.onclick = () => { window.focus(); window.location.assign(url); };
}

/** Pastille du nombre de non-lus sur l'icône de l'appli installée. */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* non géré */ }
}
