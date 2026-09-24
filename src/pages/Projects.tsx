import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, differenceInCalendarDays, parseISO, startOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange, FolderPlus, LayoutGrid, LayoutTemplate } from 'lucide-react';
import { useStore } from '../state/store';
import type { Project, ProjectStatus, ProjectTemplate } from '../lib/types';
import { TemplatesModal } from '../components/TemplateModals';
import { daysUntil, fmtShort, todayIso } from '../lib/dates';
import { isDone, isLate, progress, projectHealth } from '../lib/selectors';
import { isAdmin } from '../lib/permissions';
import { ProjectModal } from '../components/ProjectModal';
import { AvatarStack, Avatar, Badge, Button, Card, Empty, PageTitle, Progress, Stat, Tabs } from '../components/ui';
import { isAssigned } from '../lib/assignees';

type TabId = ProjectStatus;

export default function Projects() {
  const { me, snap } = useStore();
  const [tab, setTab] = useState<TabId>('en_cours');
  const [view, setView] = useState<'cartes' | 'chronologie'>('cartes');
  const [creating, setCreating] = useState(false);
  const [person, setPerson] = useState<string>('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [useTpl, setUseTpl] = useState<ProjectTemplate | null>(null);

  const counts = (s: ProjectStatus) => snap.projects.filter((p) => p.status === s).length;
  const list = snap.projects
    .filter((p) => p.status === tab && (!person || p.member_ids.includes(person)))
    .sort((a, b) => (a.end_date || '9999') < (b.end_date || '9999') ? -1 : 1);

  const active = snap.projects.filter((p) => p.status === 'en_cours');
  const activeTasks = snap.tasks.filter((t) => active.some((p) => p.id === t.project_id));
  const avg = active.length ? Math.round(active.reduce((s, p) => { const pr = progress(snap.tasks, p.id); return s + (pr.total ? pr.done / pr.total : 0); }, 0) / active.length * 100) : 0;
  const involved = new Set(active.flatMap((p) => p.member_ids)).size;

  return (
    <>
      <PageTitle title={<>Projets <b>en cours</b></>} sub="Piloter les missions et savoir qui fait quoi.">
        {isAdmin(me) && <Button onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={16} /> Modèles{snap.templates.length ? ` · ${snap.templates.length}` : ''}</Button>}
        {isAdmin(me) && <Button variant="primaire" onClick={() => { setUseTpl(null); setCreating(true); }}><FolderPlus size={17} /> Créer un projet</Button>}
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={active.length} label="Projets actifs" />
        <Stat value={activeTasks.filter(isLate).length} label="Tâches en retard" tone={activeTasks.some(isLate) ? 'erreur' : undefined} />
        <Stat value={involved} label="Personnes impliquées" />
        <Stat value={<>{avg}<span className="text-lg"> %</span></>} label="Avancement moyen" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { id: 'en_cours', label: 'En cours', count: counts('en_cours') },
          { id: 'planifie', label: 'À venir', count: counts('planifie') },
          { id: 'termine', label: 'Terminés', count: counts('termine') },
          { id: 'archive', label: 'Archivés', count: counts('archive') },
        ]} />
        <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-10 rounded-mab-pilule border border-mab-filet bg-white px-4 text-sm text-mab-encre">
          <option value="">Toute l’équipe</option>
          {snap.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <div className="inline-flex rounded-mab-pilule border border-mab-filet bg-white p-1 sm:ml-auto">
          <button aria-pressed={view === 'cartes'} onClick={() => setView('cartes')} className={`flex items-center gap-1.5 rounded-mab-pilule px-3 py-1.5 text-sm ${view === 'cartes' ? 'bg-mab-wash-2 font-semibold text-mab-aqua-texte' : 'text-mab-texte'}`}><LayoutGrid size={15} /> Cartes</button>
          <button aria-pressed={view === 'chronologie'} onClick={() => setView('chronologie')} className={`flex items-center gap-1.5 rounded-mab-pilule px-3 py-1.5 text-sm ${view === 'chronologie' ? 'bg-mab-wash-2 font-semibold text-mab-aqua-texte' : 'text-mab-texte'}`}><CalendarRange size={15} /> Chronologie</button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty title="Aucun projet ici" text={tab === 'en_cours' ? 'Les projets en cours apparaîtront ici.' : undefined} />
      ) : view === 'cartes' ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((p) => <ProjectCard key={p.id} p={p} />)}
        </div>
      ) : (
        <Timeline projects={list} />
      )}

      {tab === 'en_cours' && <WhoDoesWhat />}

      <ProjectModal open={creating} initialTemplate={useTpl} onClose={() => setCreating(false)} />
      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onUse={(t) => { setUseTpl(t); setCreating(true); }} />
    </>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const { snap, byId } = useStore();
  const pr = progress(snap.tasks, p.id);
  const h = projectHealth(p, snap.tasks);
  const left = p.end_date ? daysUntil(p.end_date) : null;
  return (
    <Link to={`/projets/${p.id}`} className="group block">
      <Card className="relative h-full overflow-hidden p-5 transition group-hover:border-mab-filet-aqua group-hover:shadow-mab-carte">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-mab-encre">{p.name}</h3>
          <Badge tone={h.tone}>{h.label}</Badge>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-mab-texte">{p.description}</p>
        <div className="my-4"><AvatarStack people={p.member_ids.map((id) => byId.get(id))} /></div>
        <Progress done={pr.done} total={pr.total} />
        <div className="mt-3 flex justify-between text-xs text-mab-texte">
          <span>{fmtShort(p.start_date)} → {fmtShort(p.end_date)}</span>
          {left !== null && p.status === 'en_cours' && (
            <span className={left < 0 ? 'font-semibold text-mab-erreur' : ''}>{left < 0 ? `Dépassé de ${-left} j` : left === 0 ? 'Se termine aujourd’hui' : `J-${left}`}</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function Timeline({ projects }: { projects: Project[] }) {
  const dated = projects.filter((p) => p.start_date && p.end_date);
  if (!dated.length) return <Empty title="Aucun projet daté" />;
  const min = parseISO(dated.reduce((m, p) => (p.start_date < m ? p.start_date : m), dated[0].start_date));
  const max = parseISO(dated.reduce((m, p) => (p.end_date > m ? p.end_date : m), dated[0].end_date));
  const start = startOfWeek(min, { weekStartsOn: 1 });
  const total = Math.max(differenceInCalendarDays(max, start) + 7, 14);
  const weeks = Array.from({ length: Math.ceil(total / 7) }, (_, i) => addDays(start, i * 7));
  const pos = (iso: string) => (differenceInCalendarDays(parseISO(iso), start) / total) * 100;
  const todayPos = pos(todayIso());
  return (
    <Card className="overflow-x-auto p-5">
      <div className="min-w-[720px]">
        <div className="relative ml-[220px] flex h-7 border-b border-mab-filet text-xs text-mab-texte">
          {weeks.map((w) => (
            <span key={w.toISOString()} className="absolute" style={{ left: `${pos(format(w, 'yyyy-MM-dd'))}%` }}>{format(w, 'd MMM', { locale: fr })}</span>
          ))}
        </div>
        {dated.map((p) => (
            <Link key={p.id} to={`/projets/${p.id}`} className="flex h-12 items-center border-b border-mab-filet last:border-0 hover:bg-mab-wash">
              <span className="flex w-[220px] shrink-0 items-center gap-2 pr-3 text-sm font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.name}</span>
              </span>
              <span className="relative h-full flex-1">
                {todayPos >= 0 && todayPos <= 100 && <span className="absolute inset-y-0 w-px bg-mab-rose" style={{ left: `${todayPos}%` }} />}
                <span
                  className="absolute top-1/2 h-5 -translate-y-1/2 rounded-mab-pilule opacity-90"
                  style={{ left: `${pos(p.start_date)}%`, width: `${Math.max(pos(p.end_date) - pos(p.start_date) + 100 / total, 1)}%`, background: p.color }}
                />
              </span>
            </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-mab-texte"><span className="mr-1 inline-block h-3 w-px bg-mab-rose align-middle" /> Aujourd’hui</p>
    </Card>
  );
}

function WhoDoesWhat() {
  const { snap } = useStore();
  const rows = useMemo(() => {
    return snap.profiles.filter((p) => p.active).map((person) => {
      const open = snap.tasks.filter((t) => isAssigned(t, person.id) && !isDone(t) && t.project_id);
      const projects = snap.projects.filter((p) => p.status === 'en_cours' && p.member_ids.includes(person.id));
      const next = open.filter((t) => t.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
      return { person, open: open.length, late: open.filter(isLate).length, projects, next };
    });
  }, [snap]);
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-light">Qui travaille <b className="font-semibold">sur quoi</b></h2>
      <div className="grid gap-3 sm:hidden">
        {rows.map((r) => (
          <Card key={r.person.id} className="p-4">
            <Link to={`/equipe?personne=${r.person.id}`} className="flex items-center gap-3">
              <Avatar p={r.person} size={36} />
              <span className="min-w-0 flex-1"><b className="block font-semibold">{r.person.full_name}</b><span className="block truncate text-xs text-mab-texte">{r.person.job_title}</span></span>
              <span className="text-right text-xs text-mab-texte"><b className="block text-base text-mab-encre">{r.open}</b>ouvertes</span>
            </Link>
            {r.late > 0 && <p className="mt-2 text-xs font-semibold text-mab-erreur">{r.late} en retard</p>}
            {r.next && <p className="mt-2 text-xs text-mab-texte">Prochaine : <span className="text-mab-encre">{r.next.title}</span> · {fmtShort(r.next.due_date)}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.projects.map((p) => (
                <Link key={p.id} to={`/projets/${p.id}`} className="inline-flex items-center gap-1.5 rounded-mab-pilule bg-mab-wash px-2.5 py-1 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto max-sm:hidden">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-mab-filet text-left text-xs text-mab-texte">
              <th className="px-5 py-3 font-medium">Personne</th>
              <th className="px-3 py-3 font-medium">Projets</th>
              <th className="px-3 py-3 font-medium">Tâches ouvertes</th>
              <th className="px-3 py-3 font-medium">Prochaine échéance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.person.id} className="border-b border-mab-filet last:border-0">
                <td className="px-5 py-3">
                  <Link to={`/equipe?personne=${r.person.id}`} className="flex items-center gap-3">
                    <Avatar p={r.person} size={30} />
                    <span><b className="block font-semibold">{r.person.full_name}</b><span className="text-xs text-mab-texte">{r.person.job_title}</span></span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.projects.map((p) => (
                      <Link key={p.id} to={`/projets/${p.id}`} className="inline-flex items-center gap-1.5 rounded-mab-pilule bg-mab-wash px-2.5 py-1 text-xs hover:bg-mab-wash-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums">{r.open}{r.late > 0 && <span className="ml-2 font-semibold text-mab-erreur">{r.late} en retard</span>}</td>
                <td className="px-3 py-3 text-mab-texte">{r.next ? <><span className="text-mab-encre">{r.next.title}</span> · {fmtShort(r.next.due_date)}</> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
