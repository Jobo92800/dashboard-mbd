// Récap personnel envoyé chaque lundi vers 8 h (heure de Paris en été, 7 h en hiver).
import type { Config } from '@netlify/functions';
import { weeklyRecap } from '../../src/lib/recap';
import { appUrl, loadAll, sendEmail } from '../lib/server.mts';

export default async () => {
  const snap = await loadAll();
  let sent = 0;
  for (const p of snap.profiles.filter((x) => x.active && x.recap_email)) {
    const mail = weeklyRecap(snap, p, appUrl());
    if (!mail) continue;
    try { await sendEmail(p, mail); sent++; } catch (e) { console.error(p.email, (e as Error).message); }
  }
  console.log(`Récap du lundi : ${sent} e-mail(s) envoyé(s).`);
};

export const config: Config = { schedule: '0 6 * * 1' };
