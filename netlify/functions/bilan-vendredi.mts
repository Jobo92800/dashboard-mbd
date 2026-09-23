// Bilan de la semaine envoyé aux administrateurs chaque vendredi vers 17 h (heure de Paris en été).
import type { Config } from '@netlify/functions';
import { fridayReport } from '../../src/lib/recap';
import { appUrl, loadAll, sendEmail } from '../lib/server.mts';

export default async () => {
  const snap = await loadAll();
  const mail = fridayReport(snap, appUrl());
  for (const p of snap.profiles.filter((x) => x.active && x.role === 'admin' && x.recap_email)) {
    try { await sendEmail(p, mail); } catch (e) { console.error(p.email, (e as Error).message); }
  }
};

export const config: Config = { schedule: '0 15 * * 5' };
