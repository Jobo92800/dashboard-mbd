// Flux d'agenda personnel (format iCalendar) : l'iPhone, Google Agenda ou Outlook
// s'y abonnent et affichent les rendez-vous MA HQ, mis à jour automatiquement.
// Accès par lien secret : /.netlify/functions/agenda?t=<jeton>[&taches=1]
import { adminClient } from '../lib/server.mts';

const TZ = `BEGIN:VTIMEZONE
TZID:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Replie les lignes à 75 octets, comme l'exige le format iCalendar. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** « 2026-09-25 » + « 14:30 » + 45 min → heure locale de fin (sans fuseau, calcul simple sur l'horloge). */
function localStamp(date: string, time: string, addMin = 0) {
  const d = new Date(`${date}T${time || '09:00'}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + addMin);
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15);
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Lien invalide', { status: 404 });
  const sb = adminClient();
  const { data: tok } = await sb.from('calendar_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!tok) return new Response('Lien invalide ou remplacé', { status: 404 });
  const { data: me } = await sb.from('profiles').select('id, active').eq('id', tok.user_id).maybeSingle();
  if (!me?.active) return new Response('Accès désactivé', { status: 403 });

  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const { data: events } = await sb.from('events').select('*').gte('date', from);
  const mine = (events ?? []).filter((e) => e.created_by === me.id || (e.participant_ids ?? []).includes(me.id));
  const app = (process.env.URL || 'https://dashboardmbd.netlify.app').replace(/\/$/, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAbeautyplus//MA HQ//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:MA HQ', 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
    ...TZ.split('\n'),
  ];
  for (const e of mine) {
    const desc = [e.note, e.visio_url ? `Visio : ${e.visio_url}` : '', `Ouvrir dans MA HQ : ${app}/agenda?rdv=${e.id}`].filter(Boolean).join('\n\n');
    lines.push(
      'BEGIN:VEVENT', `UID:${e.id}@mahq`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Paris:${localStamp(e.date, e.time)}`,
      `DTEND;TZID=Europe/Paris:${localStamp(e.date, e.time, e.duration_min || 30)}`,
      `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(desc)}`, `CATEGORIES:${esc(e.kind || 'Réunion')}`,
      ...(e.visio_url ? [`LOCATION:${esc(e.visio_url)}`, `URL:${esc(e.visio_url)}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'TRIGGER:-PT15M', 'END:VALARM',
      'END:VEVENT',
    );
  }

  if (url.searchParams.get('taches') === '1') {
    const { data: tasks } = await sb.from('tasks').select('id, title, due_date, status, assignee_id, assignee_ids, project_id').neq('status', 'fait').not('due_date', 'is', null).gte('due_date', from);
    for (const t of tasks ?? []) {
      const who: string[] = t.assignee_ids?.length ? t.assignee_ids : t.assignee_id ? [t.assignee_id] : [];
      if (!who.includes(me.id)) continue;
      const d = t.due_date.replace(/-/g, '');
      const next = new Date(`${t.due_date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        'BEGIN:VEVENT', `UID:tache-${t.id}@mahq`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:${esc(`✓ ${t.title}`)}`, `DESCRIPTION:${esc(`Tâche MA HQ : ${app}/${t.project_id ? `projets/${t.project_id}` : 'taches'}?tache=${t.id}`)}`,
        'TRANSP:TRANSPARENT', 'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ma-hq.ics"',
      'Cache-Control': 'no-cache, max-age=0',
    },
  });
};
