import { useSearchParams, Link } from 'react-router-dom';
import { ListPlus, Mail, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { useStore } from '../state/store';
import type { Profile } from '../lib/types';
import { isDone, isLate, sortTasks } from '../lib/selectors';
import { Avatar, Card, PageTitle } from '../components/ui';
import { PresenceDot, usePresenceText } from '../components/Presence';
import { TaskRow } from '../components/TaskRow';
import { absenceKind, absenceOn } from '../lib/absences';
import { todayIso } from '../lib/dates';

export default function Team() {
  const { snap, online } = useStore();
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [params, setParams] = useSearchParams();
  const selected = params.get('personne');
  const people = snap.profiles.filter((p) => p.active).sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)));
  const person = people.find((p) => p.id === selected);
  const maxLoad = Math.max(1, ...people.map((p) => snap.tasks.filter((t) => t.assignee_id === p.id && !isDone(t)).length));

  return (
    <>
      <PageTitle title={<>L’<b>équipe</b></>} sub="Disponibilités, charge de travail et projets de chacun." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.id} p={p} max={maxLoad} active={p.id === selected} onClick={() => setParams(p.id === selected ? {} : { personne: p.id })} onAssign={() => setDraft({ assignee_id: p.id })} />
        ))}
      </div>

      {person && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <Avatar p={person} size={44} />
            <div>
              <h2 className="text-xl font-semibold">{person.full_name}</h2>
              <p className="text-sm text-mab-texte">{person.job_title}</p>
            </div>
          </div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">Tâches ouvertes</h3>
          {sortTasks(snap.tasks.filter((t) => t.assignee_id === person.id && !isDone(t))).map((t) => <TaskRow key={t.id} task={t} showProject />)}
          {!snap.tasks.some((t) => t.assignee_id === person.id && !isDone(t)) && <p className="py-3 text-sm text-mab-texte">Aucune tâche ouverte visible.</p>}
        </Card>
      )}
      <TaskModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function PersonCard({ p, max, active, onClick, onAssign }: { p: Profile; max: number; active: boolean; onClick: () => void; onAssign: () => void }) {
  const { snap, me } = useStore();
  const presenceText = usePresenceText();
  const open = snap.tasks.filter((t) => t.assignee_id === p.id && !isDone(t));
  const late = open.filter(isLate).length;
  const projects = snap.projects.filter((x) => x.status === 'en_cours' && x.member_ids.includes(p.id));
  return (
    <Card className={`p-5 transition ${active ? '!border-mab-aqua bg-mab-wash-2' : 'hover:border-mab-filet-aqua'}`}>
      <button onClick={onClick} className="block w-full text-left">
        <div className="flex items-center gap-3">
          <span className="relative"><Avatar p={p} size={48} /><PresenceDot p={p} size={13} className="absolute bottom-0 right-0" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.full_name} {p.role === 'admin' && <span className="ml-1 text-xs font-normal text-mab-texte">· admin</span>}</p>
            <p className="truncate text-sm text-mab-texte">{p.job_title}</p>
          </div>
        </div>
        {(() => {
          const away = absenceOn(snap.absences.filter((a) => a.status === 'validee'), p.id, todayIso());
          const next = snap.absences.filter((a) => a.user_id === p.id && a.status === 'validee' && a.start_date > todayIso()).sort((a, b) => (a.start_date < b.start_date ? -1 : 1))[0];
          return (
            <>
              {away
                ? <p className="mt-3 text-sm"><b className="font-medium">🌴 {absenceKind(away, me)}</b><span className="text-mab-texte"> jusqu’au {away.end_date.split('-').reverse().slice(0, 2).join('/')}</span></p>
                : <p className="mt-3 text-sm text-mab-texte">{presenceText(p)}</p>}
              {!away && next && <p className="text-xs text-mab-texte">Prochaine absence : {next.start_date.split('-').reverse().slice(0, 2).join('/')} → {next.end_date.split('-').reverse().slice(0, 2).join('/')}</p>}
            </>
          );
        })()}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-mab-texte">
            <span>Charge : {open.length} tâche{open.length > 1 ? 's' : ''} ouverte{open.length > 1 ? 's' : ''}</span>
            {late > 0 && <span className="font-semibold text-mab-erreur">{late} en retard</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-mab-pilule bg-mab-rail">
            <div className="h-full rounded-mab-pilule bg-mab-aqua" style={{ width: `${(open.length / max) * 100}%` }} />
          </div>
        </div>
      </button>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {projects.map((x) => (
          <Link key={x.id} to={`/projets/${x.id}`} className="inline-flex items-center gap-1.5 rounded-mab-pilule bg-mab-wash px-2.5 py-1 text-xs hover:bg-mab-wash-2">
            <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.name}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {p.id !== me!.id && (
          <Link to={`/messages?a=${p.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-mab-aqua-texte hover:underline"><MessageSquare size={15} /> Écrire</Link>
        )}
        <button onClick={onAssign} className="inline-flex items-center gap-1.5 text-sm font-medium text-mab-aqua-texte hover:underline"><ListPlus size={15} /> {p.id === me!.id ? 'Me créer une tâche' : 'Confier une tâche'}</button>
        <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 text-xs text-mab-texte hover:underline"><Mail size={13} /> {p.email}</a>
      </div>
    </Card>
  );
}
