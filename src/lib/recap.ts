import { addDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Profile, Snapshot, Task } from './types';
import { isDone, projectHealth } from './selectors';
import { assigneesOf, isAssigned } from './assignees';

/**
 * Contenu des e-mails automatiques. Utilisé à l'identique par l'aperçu dans
 * l'appli et par les fonctions Netlify planifiées (netlify/functions/recap-*).
 */
export interface Email { subject: string; html: string; text: string }

const C = {
  wash: '#f4fbfb', filet: '#e6efef', encre: '#152b2c', texte: '#41595a', gris: '#7c9091',
  aquaTexte: '#1f7f7f', rose: '#e8318a', erreur: '#c0392b', washRose: '#fef3f8', wash2: '#eaf7f7',
};
const FONT = "Poppins, 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const day = (iso: string) => format(parseISO(iso), 'EEEE d MMMM', { locale: fr });
const short = (iso: string) => format(parseISO(iso), 'EEE d MMM', { locale: fr });
const first = (p?: Profile) => p?.full_name.split(' ')[0] ?? '—';

function layout(appUrl: string, title: string, intro: string, body: string, cta: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.wash};font-family:${FONT};color:${C.encre}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.wash};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:8px 8px 20px"><img src="${appUrl}/email-logo.png" width="140" alt="MAbeautyplus" style="display:block;width:140px;height:auto;border:0"></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.filet};border-radius:18px;padding:28px 28px 32px">
<h1 style="margin:0 0 6px;font-size:26px;line-height:32px;font-weight:300;color:${C.encre}">${title}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:24px;color:${C.texte}">${intro}</p>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td style="background:${C.rose};border-radius:999px">
<a href="${appUrl}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(cta)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 8px;font-size:11px;line-height:16px;color:${C.gris}">MA HQ · espace de travail de l’équipe MAbeautyplus. Tu peux couper ces e-mails dans « Mon profil ».</td></tr>
</table></td></tr></table></body></html>`;
}

function section(label: string, rows: string[], tone: 'normal' | 'erreur' = 'normal') {
  if (!rows.length) return '';
  const color = tone === 'erreur' ? C.erreur : C.aquaTexte;
  return `<p style="margin:22px 0 8px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${color}">${esc(label)} · ${rows.length}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`;
}

const row = (main: string, sub: string, right = '') =>
  `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.filet}"><div style="font-size:15px;line-height:22px;color:${C.encre}">${main}</div><div style="font-size:12px;line-height:18px;color:${C.texte}">${sub}</div></td><td align="right" style="padding:10px 0 10px 10px;border-bottom:1px solid ${C.filet};font-size:12px;color:${C.texte};white-space:nowrap;vertical-align:top">${right}</td></tr>`;

function taskSub(s: Snapshot, t: Task) {
  const p = s.projects.find((x) => x.id === t.project_id);
  return esc(p ? p.name : t.kind ?? 'Tâche rapide') + (t.priority === 'Haute' ? ` · <b style="color:${C.rose}">priorité haute</b>` : '');
}

/** Récap du lundi matin, personnel. Renvoie null s'il n'y a rien à dire. */
export function weeklyRecap(s: Snapshot, person: Profile, appUrl: string, today = new Date()): Email | null {
  const t0 = format(today, 'yyyy-MM-dd');
  const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const mine = s.tasks.filter((t) => isAssigned(t, person.id) && !isDone(t));
  const late = mine.filter((t) => t.due_date && t.due_date < t0).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const week = mine.filter((t) => t.due_date && t.due_date >= t0 && t.due_date <= end).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const events = s.events
    .filter((e) => e.date >= t0 && e.date <= end && (e.participant_ids.includes(person.id) || e.created_by === person.id))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const readAt = new Map(s.reads.filter((r) => r.user_id === person.id).map((r) => [r.conversation_id, r.read_at]));
  const convIds = new Set(s.conversations.filter((c) => c.member_ids.includes(person.id)).map((c) => c.id));
  const unread = s.messages.filter((m) => convIds.has(m.conversation_id) && m.author_id !== person.id && m.created_at > (readAt.get(m.conversation_id) ?? '')).length;
  if (!late.length && !week.length && !events.length && !unread) return null;

  const body =
    section('En retard', late.map((t) => row(esc(t.title), taskSub(s, t), `<span style="color:${C.erreur}">${short(t.due_date!)}</span>`)), 'erreur') +
    section('Cette semaine', week.map((t) => row(esc(t.title), taskSub(s, t), short(t.due_date!)))) +
    section('Rendez-vous', events.map((e) => row(esc(e.title), `${esc(e.kind)} · ${e.duration_min} min`, `${short(e.date)} · ${e.time}`))) +
    (unread ? `<p style="margin:22px 0 0;padding:14px 16px;background:${C.wash2};border-radius:14px;font-size:14px;color:${C.aquaTexte}">💬 ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''} dans ta messagerie.</p>` : '');

  const n = late.length + week.length;
  const intro = `${n ? `<b>${n} tâche${n > 1 ? 's' : ''}</b> à traiter${late.length ? `, dont <b style="color:${C.erreur}">${late.length} en retard</b>` : ''}` : 'Pas de tâche datée cette semaine'}${events.length ? ` et ${events.length} rendez-vous` : ''}.`;
  const text = [
    `Bonjour ${first(person)}, voici ta semaine.`,
    late.length ? `\nEN RETARD\n${late.map((t) => `- ${t.title} (${short(t.due_date!)})`).join('\n')}` : '',
    week.length ? `\nCETTE SEMAINE\n${week.map((t) => `- ${t.title} (${short(t.due_date!)})`).join('\n')}` : '',
    events.length ? `\nRENDEZ-VOUS\n${events.map((e) => `- ${short(e.date)} ${e.time} · ${e.title}`).join('\n')}` : '',
    unread ? `\n${unread} message(s) non lu(s).` : '',
    `\nOuvrir MA HQ : ${appUrl}`,
  ].join('\n');
  return {
    subject: late.length ? `Ta semaine · ${n} tâches, dont ${late.length} en retard` : `Ta semaine · ${n} tâche${n > 1 ? 's' : ''}${events.length ? ` et ${events.length} rendez-vous` : ''}`,
    html: layout(appUrl, `Bonjour ${esc(first(person))}, <b style="font-weight:600">voici ta semaine</b>`, intro, body, 'Ouvrir ma journée'),
    text,
  };
}

/** Bilan du vendredi, pour les administrateurs : ce qui a été fait, ce qui coince, la semaine suivante. */
export function fridayReport(s: Snapshot, appUrl: string, today = new Date()): Email {
  const t0 = format(today, 'yyyy-MM-dd');
  const since = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextMon = format(addDays(endOfWeek(today, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');
  const nextSun = format(addDays(endOfWeek(today, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');
  const people = s.profiles.filter((p) => p.active);
  const byId = new Map(s.profiles.map((p) => [p.id, p]));
  const names = (t: Task) => assigneesOf(t).map((id) => first(byId.get(id))).join(', ') || '—';

  const done = s.tasks.filter((t) => t.done_at && t.done_at.slice(0, 10) >= since);
  const late = s.tasks.filter((t) => !isDone(t) && t.due_date && t.due_date < t0);
  const risky = s.projects.filter((p) => p.status === 'en_cours').map((p) => ({ p, h: projectHealth(p, s.tasks) })).filter((x) => x.h.tone === 'erreur' || x.h.tone === 'emotion');
  const next = s.tasks.filter((t) => !isDone(t) && t.due_date && t.due_date >= nextMon && t.due_date <= nextSun);

  const perPerson = people.map((p) => ({
    p,
    done: done.filter((t) => isAssigned(t, p.id)).length,
    late: late.filter((t) => isAssigned(t, p.id)).length,
    next: next.filter((t) => isAssigned(t, p.id)).length,
  })).filter((x) => x.done || x.late || x.next);

  const table = perPerson.length ? `<p style="margin:22px 0 8px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${C.aquaTexte}">Par personne</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
<tr style="color:${C.gris};font-size:12px"><td style="padding:6px 0">Personne</td><td align="center">Faites</td><td align="center">En retard</td><td align="center">Semaine pro.</td></tr>
${perPerson.map((x) => `<tr><td style="padding:8px 0;border-top:1px solid ${C.filet}">${esc(x.p.full_name)}</td><td align="center" style="border-top:1px solid ${C.filet}">${x.done}</td><td align="center" style="border-top:1px solid ${C.filet};color:${x.late ? C.erreur : C.encre};font-weight:${x.late ? 600 : 400}">${x.late}</td><td align="center" style="border-top:1px solid ${C.filet}">${x.next}</td></tr>`).join('')}
</table>` : '';

  const body =
    table +
    section('Projets à surveiller', risky.map(({ p, h }) => row(esc(p.name), esc(h.label), p.end_date ? `fin ${short(p.end_date)}` : '')), 'erreur') +
    section('En retard', late.slice(0, 12).map((t) => row(esc(t.title), `${esc(names(t))} · ${taskSub(s, t)}`, `<span style="color:${C.erreur}">${short(t.due_date!)}</span>`)), 'erreur') +
    section('Terminé cette semaine', done.slice(0, 12).map((t) => row(esc(t.title), `${esc(names(t))} · ${taskSub(s, t)}`)));

  const intro = `<b>${done.length}</b> tâche${done.length > 1 ? 's' : ''} terminée${done.length > 1 ? 's' : ''} cette semaine, <b style="color:${late.length ? C.erreur : C.encre}">${late.length}</b> en retard, <b>${next.length}</b> prévue${next.length > 1 ? 's' : ''} la semaine prochaine.`;
  return {
    subject: `Bilan de la semaine · ${done.length} faites, ${late.length} en retard`,
    html: layout(appUrl, `Bilan de la <b style="font-weight:600">semaine</b>`, intro, body, 'Ouvrir la vue direction'),
    text: `Bilan de la semaine (${day(t0)})\n${done.length} terminées, ${late.length} en retard, ${next.length} la semaine prochaine.\n${risky.map(({ p, h }) => `- ${p.name} : ${h.label}`).join('\n')}\n\n${appUrl}`,
  };
}
