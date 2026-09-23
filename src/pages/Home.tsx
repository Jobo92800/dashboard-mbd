import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays } from 'date-fns';
import { CalendarClock, CheckCircle2, Plus } from 'lucide-react';
import { useStore } from '../state/store';
import { fmtLong, fmtStamp, toIso, todayIso } from '../lib/dates';
import { isDone, isLate, progress, projectHealth, sortTasks } from '../lib/selectors';
import { isAdmin } from '../lib/permissions';
import type { Task } from '../lib/types';
import { TaskRow } from '../components/TaskRow';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { AvailabilityPicker } from '../components/AvailabilityPicker';
import { Avatar, AvailDot, Badge, Button, Card, Empty, PageTitle, Progress, Stat, Surtitre } from '../components/ui';
import { fmtDur } from '../components/EventModal';
import { conversationName } from '../lib/conversations';

export default function Home() {
  const { me, snap, byId, unreadByConv } = useStore();
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const today = todayIso();
  const in7 = toIso(addDays(new Date(), 7));

  const mine = useMemo(() => snap.tasks.filter((t) => t.assignee_id === me!.id), [snap.tasks, me]);
  const late = sortTasks(mine.filter(isLate));
  const todays = sortTasks(mine.filter((t) => !isDone(t) && t.due_date === today));
  const week = sortTasks(mine.filter((t) => !isDone(t) && t.due_date && t.due_date > today && t.due_date <= in7));
  const noDate = mine.filter((t) => !isDone(t) && !t.due_date);
  const doneToday = mine.filter((t) => isDone(t) && t.done_at?.slice(0, 10) === today).length;

  const myEvents = snap.events
    .filter((e) => e.date >= today && e.date <= in7 && (e.participant_ids.includes(me!.id) || e.created_by === me!.id))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const myProjects = snap.projects.filter((p) => p.status === 'en_cours' && p.member_ids.includes(me!.id));
  const atRisk = snap.projects.filter((p) => p.status === 'en_cours' && ['erreur', 'emotion'].includes(projectHealth(p, snap.tasks).tone));
  const activity = [...snap.activity].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);

  const hour = new Date().getHours();
  const hello = hour < 18 ? 'Bonjour' : 'Bonsoir';

  const Section = ({ title, list, tone }: { title: string; list: Task[]; tone?: 'erreur' }) =>
    list.length ? (
      <div className="mb-4">
        <p className={`mb-1 text-xs font-semibold uppercase tracking-[.12em] ${tone ? 'text-mab-erreur' : 'text-mab-aqua-texte'}`}>{title} · {list.length}</p>
        {list.map((t) => <TaskRow key={t.id} task={t} showProject onEdit={setDraft} />)}
      </div>
    ) : null;

  return (
    <>
      <PageTitle title={<>{hello} {me!.full_name.split(' ')[0]}, <b>voici ta journée</b></>} sub={fmtLong(today).replace(/^./, (c) => c.toUpperCase())}>
        <Button variant="primaire" onClick={() => setDraft({})}><Plus size={17} /> Nouvelle tâche</Button>
      </PageTitle>

      <Card className="mb-6 px-5 py-4">
        <Surtitre className="mb-2.5">Mon statut pour l’équipe</Surtitre>
        <AvailabilityPicker />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={late.length} label="En retard" tone={late.length ? 'erreur' : undefined} />
        <Stat value={todays.length} label="Pour aujourd’hui" />
        <Stat value={week.length} label="Dans les 7 jours" />
        <Stat value={doneToday} label="Terminées aujourd’hui" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Mes tâches</h2>
          {late.length + todays.length + week.length + noDate.length === 0 ? (
            <Empty icon={<CheckCircle2 size={32} />} title="Tout est à jour" text="Aucune tâche en attente sur les 7 prochains jours." />
          ) : (
            <>
              <Section title="En retard" list={late} tone="erreur" />
              <Section title="Aujourd’hui" list={todays} />
              <Section title="Cette semaine" list={week} />
              <Section title="Sans échéance" list={noDate} />
            </>
          )}
          <Link to="/taches" className="mt-2 inline-block text-sm font-medium text-mab-aqua-texte hover:underline">Voir toutes les tâches →</Link>
        </Card>

        <div className="grid content-start gap-6">
          {unreadByConv.size > 0 && (
            <Card className="border-mab-filet-rose p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Messages non lus</h2>
                <Link to="/messages" className="text-sm text-mab-aqua-texte hover:underline">Messagerie</Link>
              </div>
              {snap.conversations.filter((c) => unreadByConv.has(c.id)).map((c) => (
                <Link key={c.id} to={`/messages/${c.id}`} className="flex items-center justify-between gap-3 border-b border-mab-filet py-2.5 last:border-0 hover:bg-mab-wash">
                  <span className="truncate font-medium">{conversationName(c, me!.id, byId)}</span>
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-mab-rose px-1.5 text-[11px] font-bold text-white">{unreadByConv.get(c.id)}</span>
                </Link>
              ))}
            </Card>
          )}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mes rendez-vous</h2>
              <Link to="/agenda" className="text-sm text-mab-aqua-texte hover:underline">Agenda</Link>
            </div>
            {myEvents.length === 0 && <p className="text-sm text-mab-texte">Rien de prévu dans les 7 prochains jours.</p>}
            {myEvents.map((e) => (
              <div key={e.id} className="flex gap-3 border-b border-mab-filet py-3 last:border-0">
                <div className="grid w-12 shrink-0 place-items-center rounded-mab-champ bg-mab-wash-2 py-1 text-center">
                  <CalendarClock size={16} className="text-mab-aqua-texte" />
                  <span className="text-xs font-semibold text-mab-aqua-texte">{e.time}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-xs text-mab-texte">{e.date === today ? 'Aujourd’hui' : fmtLong(e.date)} · {fmtDur(e.duration_min)} · {e.kind}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold">Mes projets</h2>
            {myProjects.length === 0 && <p className="text-sm text-mab-texte">Tu n’es rattaché(e) à aucun projet en cours.</p>}
            <div className="grid gap-4">
              {myProjects.map((p) => {
                const pr = progress(snap.tasks, p.id);
                const h = projectHealth(p, snap.tasks);
                return (
                  <Link key={p.id} to={`/projets/${p.id}`} className="block rounded-mab-champ p-2 -m-2 hover:bg-mab-wash">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-medium"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.name}</span></span>
                      <Badge tone={h.tone}>{h.label}</Badge>
                    </div>
                    <Progress done={pr.done} total={pr.total} />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold">L’équipe maintenant</h2>
            <div className="grid gap-2.5">
              {snap.profiles.filter((p) => p.active && p.id !== me!.id).map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="relative"><Avatar p={p} size={32} /><AvailDot a={p.availability} className="absolute -bottom-0.5 -right-0.5" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.full_name}</p>
                    <p className="truncate text-xs text-mab-texte">{p.availability_note || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {isAdmin(me) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <Surtitre>Vue direction</Surtitre>
            <h2 className="mb-3 mt-1 text-lg font-semibold">Projets qui demandent ton attention</h2>
            {atRisk.length === 0 && <p className="text-sm text-mab-texte">Tous les projets en cours sont dans les temps.</p>}
            {atRisk.map((p) => {
              const h = projectHealth(p, snap.tasks);
              const pr = progress(snap.tasks, p.id);
              return (
                <Link key={p.id} to={`/projets/${p.id}`} className="flex items-center gap-3 border-b border-mab-filet py-3 last:border-0 hover:bg-mab-wash">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-xs text-mab-texte">{pr.done} / {pr.total}</span>
                  <Badge tone={h.tone}>{h.label}</Badge>
                </Link>
              );
            })}
          </Card>
          <Card className="p-5 sm:p-6">
            <Surtitre>Fil d’activité</Surtitre>
            <h2 className="mb-3 mt-1 text-lg font-semibold">Ce qui a bougé</h2>
            {activity.length === 0 && <p className="text-sm text-mab-texte">L’activité de l’équipe apparaîtra ici.</p>}
            {activity.map((a) => {
              const p = snap.projects.find((x) => x.id === a.project_id);
              return (
                <div key={a.id} className="flex gap-3 border-b border-mab-filet py-2.5 text-sm last:border-0">
                  <Avatar p={byId.get(a.actor_id ?? '')} size={26} />
                  <p className="flex-1">
                    <b>{byId.get(a.actor_id ?? '')?.full_name ?? 'Quelqu’un'}</b> {a.text}
                    {p && <> · <Link className="text-mab-aqua-texte hover:underline" to={`/projets/${p.id}`}>{p.name}</Link></>}
                    <span className="block text-xs text-mab-gris-doux">{fmtStamp(a.created_at)}</span>
                  </p>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <TaskModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
