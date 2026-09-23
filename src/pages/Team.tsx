import { useSearchParams, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useStore } from '../state/store';
import type { Profile } from '../lib/types';
import { isDone, isLate, sortTasks } from '../lib/selectors';
import { AVAIL_LABEL, AvailDot, Avatar, Card, PageTitle } from '../components/ui';
import { TaskRow } from '../components/TaskRow';

export default function Team() {
  const { snap } = useStore();
  const [params, setParams] = useSearchParams();
  const selected = params.get('personne');
  const people = snap.profiles.filter((p) => p.active);
  const person = people.find((p) => p.id === selected);
  const maxLoad = Math.max(1, ...people.map((p) => snap.tasks.filter((t) => t.assignee_id === p.id && !isDone(t)).length));

  return (
    <>
      <PageTitle title={<>L’<b>équipe</b></>} sub="Disponibilités, charge de travail et projets de chacun." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.id} p={p} max={maxLoad} active={p.id === selected} onClick={() => setParams(p.id === selected ? {} : { personne: p.id })} />
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
    </>
  );
}

function PersonCard({ p, max, active, onClick }: { p: Profile; max: number; active: boolean; onClick: () => void }) {
  const { snap } = useStore();
  const open = snap.tasks.filter((t) => t.assignee_id === p.id && !isDone(t));
  const late = open.filter(isLate).length;
  const projects = snap.projects.filter((x) => x.status === 'en_cours' && x.member_ids.includes(p.id));
  return (
    <Card className={`p-5 transition ${active ? '!border-mab-aqua bg-mab-wash-2' : 'hover:border-mab-filet-aqua'}`}>
      <button onClick={onClick} className="block w-full text-left">
        <div className="flex items-center gap-3">
          <span className="relative"><Avatar p={p} size={48} /><AvailDot a={p.availability} className="absolute bottom-0 right-0 h-3 w-3" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.full_name} {p.role === 'admin' && <span className="ml-1 text-xs font-normal text-mab-texte">· admin</span>}</p>
            <p className="truncate text-sm text-mab-texte">{p.job_title}</p>
          </div>
        </div>
        <p className="mt-3 text-sm"><b className="font-medium">{AVAIL_LABEL[p.availability]}</b>{p.availability_note && <span className="text-mab-texte"> · {p.availability_note}</span>}</p>
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
      <a href={`mailto:${p.email}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-mab-aqua-texte hover:underline"><Mail size={13} /> {p.email}</a>
    </Card>
  );
}
