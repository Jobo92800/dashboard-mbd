// « M'envoyer mon récap maintenant » : pour tester l'e-mail sans attendre lundi.
import { fridayReport, weeklyRecap } from '../../src/lib/recap';
import { appUrl, callerProfile, json, loadAll, sendEmail } from '../lib/server.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  try {
    const me = await callerProfile(req);
    if (!me) return json(401, { error: 'Session expirée, reconnecte-toi.' });
    const { type } = await req.json().catch(() => ({ type: 'lundi' }));
    const snap = await loadAll();
    if (type === 'vendredi') {
      if (me.role !== 'admin') return json(403, { error: 'Réservé aux administrateurs.' });
      await sendEmail(me, fridayReport(snap, appUrl()));
    } else {
      const mail = weeklyRecap(snap, me, appUrl());
      if (!mail) return json(200, { ok: true, empty: true });
      await sendEmail(me, mail);
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
};
