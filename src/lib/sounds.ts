/**
 * Petits sons de notification, synthétisés à la volée (aucun fichier audio).
 * Les navigateurs n'autorisent le son qu'après un premier clic sur la page :
 * on prépare le moteur audio à la première interaction.
 */
export type SoundKind = 'message' | 'annonce' | 'notification';

const PREF = 'mahq_sons';
let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export const soundsEnabled = () => {
  try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; }
};
export const setSoundsEnabled = (on: boolean) => {
  try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* ignoré */ }
};

/** Une note douce : attaque rapide, extinction naturelle. */
function note(ac: AudioContext, freq: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

let last = 0;

export function playSound(kind: SoundKind, force = false) {
  if (!force && !soundsEnabled()) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  // Plusieurs arrivées d'un coup = un seul son.
  const nowMs = Date.now();
  if (!force && nowMs - last < 1200) return;
  last = nowMs;
  const t = ac.currentTime + 0.01;
  if (kind === 'message') {
    // « pop » montant, deux notes rapprochées
    note(ac, 880, t, 0.14, 0.18);
    note(ac, 1318.5, t + 0.09, 0.22, 0.14);
  } else if (kind === 'annonce') {
    // carillon de trois notes (do, mi, sol), un peu plus présent
    note(ac, 523.25, t, 0.5, 0.2, 'triangle');
    note(ac, 659.25, t + 0.16, 0.5, 0.18, 'triangle');
    note(ac, 783.99, t + 0.32, 0.8, 0.18, 'triangle');
  } else {
    note(ac, 740, t, 0.35, 0.14);
  }
}
