import { backend } from '../data';
import { isIOS, isStandalone } from './device';

/**
 * Vraies notifications (Web Push) : arrivent même appli fermée.
 * iPhone : uniquement depuis l'appli installée sur l'écran d'accueil (iOS 16.4+).
 */
const FLAG = 'mahq_push_actif';

export type PushState = 'indisponible' | 'installer_iphone' | 'refuse' | 'inactif' | 'actif';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'installer_iphone';
  if (!pushSupported() || !import.meta.env.PROD) return 'indisponible';
  if (Notification.permission === 'denied') return 'refuse';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'actif' : 'inactif';
}

/** Cet appareil reçoit-il déjà les push ? (évite les doublons avec les alertes internes) */
export const pushActiveHere = () => {
  try { return localStorage.getItem(FLAG) === '1'; } catch { return false; }
};

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Ce navigateur ne gère pas les notifications push.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées. Tu peux les réautoriser dans les réglages du téléphone (Réglages → Notifications → MA HQ).');
  const res = await fetch('/.netlify/functions/push');
  const { publicKey, error } = await res.json();
  if (!publicKey) throw new Error(error || 'Serveur de notifications indisponible.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await backend.savePushSubscription({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignoré */ }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await backend.deletePushSubscription(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  try { localStorage.removeItem(FLAG); } catch { /* ignoré */ }
}

export async function sendTestPush() {
  const token = await backend.accessToken();
  const res = await fetch('/.netlify/functions/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'test' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Envoi impossible.');
  if (!body.appareils) throw new Error('Aucun appareil enregistré. Active d’abord les notifications.');
  return body.appareils as number;
}
