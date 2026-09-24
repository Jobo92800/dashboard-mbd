import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useStore } from '../state/store';
import type { CalEvent } from '../lib/types';
import { fmtLong, toIso, todayIso } from '../lib/dates';
import { isDone, isLate } from '../lib/selectors';
import { TaskRow } from '../components/TaskRow';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { EventModal, fmtDur } from '../components/EventModal';
import { Avatar, AvatarStack, Button, Card, IconButton, PageTitle } from '../components/ui';
import { absenceKind, absenceRange } from '../lib/absences';
import { KIND_COLOR } from './Absences';
import { isAssigned } from '../lib/assignees';

export default function Agenda() {
  const { snap, byId, me } = useStore();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState(todayIso());
  const [person, setPerson] = useState('');
  const [eventDraft, setEventDraft] = useState<Partial<CalEvent> | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) });
  const tasks = useMemo(() => snap.tasks.filter((t) => t.due_date && (!person || isAssigned(t, person))), [snap.tasks, person]);
  const events = useMemo(() => snap.events.filter((e) => !person || e.participant_ids.includes(person)), [snap.events, person]);
  const projectColor = (id: string | null) => snap.projects.find((p) => p.id === id)?.color ?? '#9babab';

  const absences = snap.absences.filter((a) => a.status !== 'refusee' && (!person || a.user_id === person));
  const absentOn = (iso: string) => absences.filter((a) => a.start_date <= iso && a.end_date >= iso);
  const dayTasks = tasks.filter((t) => t.due_date === day);
  const dayEvents = events.filter((e) => e.date === day).sort((a, b) => (a.time < b.time ? -1 : 1));

  const exportIcs = () => {
    const mine = snap.events.filter((e) => e.participant_ids.includes(me!.id) || e.created_by === me!.id);
    const stamp = (d: string, t: string, addMin = 0) => {
      const dt = new Date(`${d}T${t || '09:00'}:00`);
      dt.setMinutes(dt.getMinutes() + addMin);
      return format(dt, "yyyyMMdd'T'HHmmss");
    };
    const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAbeautyplus//MA HQ//FR'];
    mine.forEach((e) => lines.push('BEGIN:VEVENT', `UID:${e.id}@mahq`, `DTSTART:${stamp(e.date, e.time)}`, `DTEND:${stamp(e.date, e.time, e.duration_min)}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.note)}`, 'END:VEVENT'));
    lines.push('END:VCALENDAR');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = 'mahq-agenda.ics';
    a.click();
  };

  return (
    <>
      <PageTitle title={<>Agenda & <b>échéances</b></>} sub="Deadlines des projets, tâches rapides et réunions de l’équipe.">
        <Button onClick={exportIcs} title="Télécharger mes événements pour Google Agenda / iPhone" className="max-sm:!px-4"><Download size={16} /><span className="max-sm:hidden"> Exporter (.ics)</span></Button>
        <Button variant="primaire" onClick={() => setEventDraft({ date: day })}><CalendarPlus size={17} /> Nouvel événement</Button>
      </PageTitle>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-3">
            <IconButton label="Mois précédent" onClick={() => setCursor((c) => addMonths(c, -1))}><ChevronLeft size={18} /></IconButton>
            <h2 className="min-w-[140px] text-center text-lg font-semibold capitalize">{format(cursor, 'MMMM yyyy', { locale: fr })}</h2>
            <IconButton label="Mois suivant" onClick={() => setCursor((c) => addMonths(c, 1))}><ChevronRight size={18} /></IconButton>
            <Button variant="discret" onClick={() => { setCursor(startOfMonth(new Date())); setDay(todayIso()); }}>Aujourd’hui</Button>
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-10 rounded-mab-pilule border border-mab-filet bg-white px-4 text-sm max-sm:w-full sm:ml-auto">
              <option value="">Toute l’équipe</option>
              {snap.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-mab-champ border border-mab-filet bg-mab-filet">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="bg-mab-wash py-2 text-center text-xs font-semibold text-mab-texte"><span className="sm:hidden">{d[0]}</span><span className="max-sm:hidden">{d}</span></div>)}
            {days.map((d) => {
              const iso = toIso(d);
              const dt = tasks.filter((t) => t.due_date === iso);
              const de = events.filter((e) => e.date === iso);
              const selected = iso === day;
              const isToday = iso === todayIso();
              const lateCount = dt.filter(isLate).length;
              return (
                <button
                  key={iso}
                  onClick={() => setDay(iso)}
                  onDoubleClick={() => setEventDraft({ date: iso })}
                  className={`flex min-h-[58px] flex-col items-center gap-1 bg-white p-1 text-left transition sm:min-h-[96px] sm:items-stretch sm:p-1.5 ${isSameMonth(d, cursor) ? '' : 'bg-mab-wash/60 text-mab-gris-doux'} ${selected ? '!bg-mab-wash-2 ring-2 ring-inset ring-mab-aqua' : 'hover:bg-mab-wash'}`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? 'bg-mab-aqua-encre text-white' : ''}`}>{format(d, 'd')}</span>
                  {absentOn(iso).length > 0 && (
                    <span className="truncate text-[10px] text-mab-texte max-sm:hidden sm:text-[11px]" title={absentOn(iso).map((a) => byId.get(a.user_id)?.full_name).join(', ')}>
                      🌴 {absentOn(iso).map((a) => byId.get(a.user_id)?.full_name.split(' ')[0]).join(', ')}
                    </span>
                  )}
                  {de.slice(0, 2).map((e) => (
                    <span key={e.id} className="truncate rounded-mab-puce bg-mab-violet-wash px-1 text-[10px] font-medium text-mab-violet-texte max-sm:hidden sm:text-[11px]">{e.time} {e.title}</span>
                  ))}
                  {(de.length > 0 || absentOn(iso).length > 0) && (
                    <span className="flex gap-0.5 sm:hidden">
                      {de.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-mab-violet" />}
                      {absentOn(iso).length > 0 && <span className="text-[9px] leading-none">🌴</span>}
                    </span>
                  )}
                  {dt.length > 0 && (
                    <span className="flex flex-wrap items-center gap-0.5">
                      {dt.slice(0, 6).map((t) => <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${isDone(t) ? 'opacity-30' : ''}`} style={{ background: projectColor(t.project_id) }} />)}
                      <span className={`ml-0.5 text-[10px] ${lateCount ? 'font-semibold text-mab-erreur' : 'text-mab-texte'}`}>{dt.length}</span>
                    </span>
                  )}
                  {de.length > 2 && <span className="text-[10px] text-mab-texte max-sm:hidden">+{de.length - 2}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mab-texte">
            {snap.projects.filter((p) => p.status === 'en_cours').map((p) => (
              <Link key={p.id} to={`/projets/${p.id}`} className="flex items-center gap-1.5 hover:underline"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</Link>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mab-gris-doux" />Tâches rapides</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-mab-puce bg-mab-violet-wash" />Événements</span>
            <span className="flex items-center gap-1.5">🌴 Absences</span>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold capitalize">{fmtLong(day)}</h2>
          <div className="mt-2 flex gap-2">
            <Button variant="discret" onClick={() => setEventDraft({ date: day })}>+ Événement</Button>
            <Button variant="discret" onClick={() => setTaskDraft({ due_date: day })}>+ Tâche rapide</Button>
          </div>
          {absentOn(day).length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">Absents · {absentOn(day).length}</h3>
              {absentOn(day).map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                  <Avatar p={byId.get(a.user_id)} size={24} />
                  <span className="flex-1">{byId.get(a.user_id)?.full_name}</span>
                  <span className="text-xs" style={{ color: KIND_COLOR[absenceKind(a, me)] === '#3bbfbf' ? '#1f7f7f' : KIND_COLOR[absenceKind(a, me)] }}>{absenceKind(a, me)}{a.status === 'en_attente' && ' (demandée)'}</span>
                </div>
              ))}
              <p className="text-xs text-mab-gris-doux">{absentOn(day).map((a) => `${byId.get(a.user_id)?.full_name.split(' ')[0]} ${absenceRange(a)}`).join(' · ')}</p>
            </>
          )}
          <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">Événements · {dayEvents.length}</h3>
          {dayEvents.length === 0 && <p className="py-2 text-sm text-mab-gris-doux">Aucun.</p>}
          {dayEvents.map((e) => (
            <button key={e.id} onClick={() => setEventDraft(e)} className="block w-full border-b border-mab-filet py-3 text-left last:border-0 hover:bg-mab-wash">
              <p className="font-medium">{e.time} · {e.title}</p>
              <p className="mb-1.5 text-xs text-mab-texte">{e.kind} · {fmtDur(e.duration_min)}{e.note ? ` · ${e.note}` : ''}</p>
              <AvatarStack people={e.participant_ids.map((x) => byId.get(x))} size={24} />
            </button>
          ))}
          <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">Échéances · {dayTasks.length}</h3>
          {dayTasks.length === 0 && <p className="py-2 text-sm text-mab-gris-doux">Aucune.</p>}
          {dayTasks.map((t) => <TaskRow key={t.id} task={t} showProject compact onEdit={setTaskDraft} />)}
        </Card>
      </div>

      <EventModal draft={eventDraft} onClose={() => setEventDraft(null)} />
      <TaskModal draft={taskDraft} onClose={() => setTaskDraft(null)} />
    </>
  );
}
