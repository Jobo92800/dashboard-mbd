// Rappels automatiques (toutes les 5 minutes) :
//  • « ⏰ Dans 15 min : … » pour chaque rendez-vous, aux participants et à l'organisateur ;
//  • « ☀️ Aujourd'hui : … » à 8 h (heure de Paris), rendez-vous et tâches du jour.
// Chaque rappel est une notification : la base déclenche ensuite l'envoi sur les téléphones.
import type { Config } from '@netlify/functions';
import { adminClient } from '../lib/server.mts';

function parisNow() {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

/** Minutes entre deux instants « AAAA-MM-JJ » + « HH:MM » du même fuseau. */
const minutesBetween = (d1: string, t1: string, d2: string, t2: string) =>
  (Date.parse(`${d2}T${t2}:00Z`) - Date.parse(`${d1}T${t1}:00Z`)) / 60000;

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

export default async () => {
  const sb = adminClient();
  const now = parisNow();
  const tomorrow = new Date(Date.parse(`${now.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const notify = (rows: { user_id: string; text: string; link: string; kind: string }[]) =>
    rows.length ? sb.from('notifications').insert(rows.map((r) => ({ ...r, read: false, created_at: nowIso }))) : null;

  // ---------- Rendez-vous qui commencent dans les 15 prochaines minutes ----------
  const { data: events } = await sb.from('events').select('*').in('date', [now.date, tomorrow]).is('reminded_at', null);
  const { data: absences } = await sb.from('absences').select('user_id, start_date, end_date').eq('status', 'validee');
  for (const ev of events ?? []) {
    const mins = minutesBetween(now.date, now.time, ev.date, ev.time);
    if (mins < 0 || mins > 15) continue;
    // Marquage atomique : un seul rappel, même si deux passages se chevauchent.
    const { data: claimed } = await sb.from('events').update({ reminded_at: nowIso }).eq('id', ev.id).is('reminded_at', null).select('id').maybeSingle();
    if (!claimed) continue;
    const people = [...new Set([...(ev.participant_ids ?? []), ev.created_by].filter(Boolean))] as string[];
    const away = new Set((absences ?? []).filter((a) => a.start_date <= ev.date && a.end_date >= ev.date).map((a) => a.user_id));
    const base = mins <= 1 ? `⏰ Ça commence : ${ev.title} (${ev.time})` : `⏰ Dans ${Math.round(mins)} min : ${ev.title} (${ev.time})`;
    // Avec un lien visio, toucher la notification ouvre directement la réunion.
    const text = ev.visio_url ? `${base} · touche pour rejoindre la visio` : base;
    const link = ev.visio_url || `/agenda?rdv=${ev.id}`;
    await notify(people.filter((id) => !away.has(id)).map((user_id) => ({ user_id, text, link, kind: 'rdv' })));
  }

  // ---------- Récap du matin, entre 8 h 00 et 8 h 04 ----------
  if (now.time >= '08:00' && now.time < '08:05') {
    const [{ data: profiles }, { data: tasks }, { data: todayEvents }, { data: already }] = await Promise.all([
      sb.from('profiles').select('id, notif_prefs, active').eq('active', true),
      sb.from('tasks').select('assignee_id, assignee_ids, due_date, status').neq('status', 'fait').not('due_date', 'is', null).lte('due_date', now.date),
      sb.from('events').select('title, time, participant_ids, created_by').eq('date', now.date).order('time'),
      sb.from('notifications').select('user_id').eq('kind', 'matin').gte('created_at', `${now.date}T00:00:00Z`),
    ]);
    const done = new Set((already ?? []).map((n) => n.user_id));
    const rows = [];
    for (const p of profiles ?? []) {
      if (done.has(p.id) || p.notif_prefs?.matin === false) continue;
      const mine = (tasks ?? []).filter((t) => (t.assignee_ids?.length ? t.assignee_ids : [t.assignee_id]).includes(p.id));
      const late = mine.filter((t) => t.due_date < now.date).length;
      const evs = (todayEvents ?? []).filter((e) => e.participant_ids?.includes(p.id) || e.created_by === p.id);
      if (!mine.length && !evs.length) continue;
      const parts = [];
      if (evs.length) parts.push(`${plural(evs.length, 'rendez-vous').replace('rendez-vouss', 'rendez-vous')} (${evs.slice(0, 2).map((e) => `${e.time} ${e.title}`).join(', ')}${evs.length > 2 ? '…' : ''})`);
      if (mine.length) parts.push(`${plural(mine.length, 'tâche')}${late ? `, dont ${late} en retard` : ''}`);
      rows.push({ user_id: p.id, text: `☀️ Aujourd’hui : ${parts.join(' et ')}`, link: '/', kind: 'matin' });
    }
    await notify(rows);
  }
};

export const config: Config = { schedule: '*/5 * * * *' };
