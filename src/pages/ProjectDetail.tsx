import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, CheckCheck, Copy, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Task, TaskStatus } from '../lib/types';
import { daysUntil, fmtShort, fmtStamp } from '../lib/dates';
import { isDone, isLate, progress, projectHealth, sortTasks } from '../lib/selectors';
import { isAdmin, isProjectMember } from '../lib/permissions';
import { TaskRow, StatusCheck, TaskMeta } from '../components/TaskRow';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { ProjectModal } from '../components/ProjectModal';
import { DuplicateModal, SaveTemplateModal } from '../components/TemplateModals';
import { Comments } from '../components/Comments';
import { Avatar, AvatarStack, Badge, Button, Card, Empty, Progress, Surtitre, Tabs } from '../components/ui';

type View = 'roadmap' | 'tableau' | 'liste';

export default function ProjectDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { snap, me, byId, loaded, deleteProject, saveProject } = useStore();
  const [view, setView] = useState<View>(() => (localStorage.getItem('mahq_vue_projet') as View) || 'roadmap');
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [dup, setDup] = useState(false);
  const [asTpl, setAsTpl] = useState(false);
  const [person, setPerson] = useState('');
  const [hideDone, setHideDone] = useState(false);

  const project = snap.projects.find((p) => p.id === id);
  const tasks = useMemo(() => snap.tasks.filter((t) => t.project_id === id), [snap.tasks, id]);

  useEffect(() => { try { localStorage.setItem('mahq_vue_projet', view); } catch { /* ignoré */ } }, [view]);
  useEffect(() => {
    const tid = params.get('tache');
    const t = tid && snap.tasks.find((x) => x.id === tid);
    if (t) { setDraft(t); params.delete('tache'); setParams(params, { replace: true }); }
  }, [params, snap.tasks, setParams]);

  if (!project) {
    return loaded ? <Empty title="Projet introuvable" text="Il a peut-être été supprimé, ou tu n’y as pas accès." action={<Link className="text-mab-aqua-texte underline" to="/projets">Retour aux projets</Link>} /> : null;
  }

  const admin = isAdmin(me);
  const member = isProjectMember(me!, project);
  const pr = progress(snap.tasks, project.id);
  const h = projectHealth(project, snap.tasks);
  const left = project.end_date ? daysUntil(project.end_date) : null;
  const filtered = sortTasks(tasks.filter((t) => (!person || t.assignee_id === person) && (!hideDone || !isDone(t))));
  const phases = [...project.phases, ...(tasks.some((t) => !t.phase || !project.phases.includes(t.phase)) ? ['Sans étape'] : [])];
  const phaseOf = (t: Task) => (t.phase && project.phases.includes(t.phase) ? t.phase : 'Sans étape');
  const activity = snap.activity.filter((a) => a.project_id === project.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 10);

  const newTask = (extra: TaskDraft = {}) => setDraft({ project_id: project.id, ...extra });

  return (
    <>
      <button onClick={() => nav('/projets')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-mab-aqua-texte hover:underline"><ArrowLeft size={16} /> Tous les projets</button>

      <Card className="relative mb-6 overflow-hidden p-6">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: project.color }} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={h.tone}>{h.label}</Badge>
              <span className="text-sm text-mab-texte">{fmtShort(project.start_date)} → {fmtShort(project.end_date)}</span>
              {left !== null && project.status === 'en_cours' && <span className={`text-sm ${left < 0 ? 'font-semibold text-mab-erreur' : 'text-mab-texte'}`}>· {left < 0 ? `dépassé de ${-left} j` : `J-${left}`}</span>}
            </div>
            <h1 className="mt-2 text-[30px] font-light leading-tight tracking-tight text-mab-encre">{project.name}</h1>
            {project.description && <p className="mt-2 text-[15px] text-mab-texte">{project.description}</p>}
          </div>
          {admin && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(true)}><Pencil size={15} /> Modifier</Button>
              <Button variant="discret" onClick={() => setDup(true)}><Copy size={15} /> Dupliquer</Button>
              <Button variant="discret" onClick={() => setAsTpl(true)}><LayoutTemplate size={15} /> En faire un modèle</Button>
              {project.status === 'en_cours' && pr.total > 0 && pr.done === pr.total && (
                <Button onClick={() => saveProject({ ...project, status: 'termine' })}><CheckCheck size={15} /> Clôturer</Button>
              )}
              {project.status !== 'archive' ? (
                <Button variant="discret" onClick={() => saveProject({ ...project, status: 'archive' })}><Archive size={15} /> Archiver</Button>
              ) : (
                <Button variant="danger" onClick={() => { if (confirm(`Supprimer définitivement « ${project.name} » et toutes ses tâches ?`)) { deleteProject(project); nav('/projets'); } }}><Trash2 size={15} /> Supprimer</Button>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <Progress done={pr.done} total={pr.total} />
          <AvatarStack people={project.member_ids.map((x) => byId.get(x))} max={8} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Tabs value={view} onChange={setView} items={[{ id: 'roadmap', label: 'Roadmap' }, { id: 'tableau', label: 'Tableau' }, { id: 'liste', label: 'Liste' }]} />
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-10 rounded-mab-pilule border border-mab-filet bg-white px-4 text-sm">
              <option value="">Tout le monde</option>
              {project.member_ids.map((x) => byId.get(x)).filter(Boolean).map((p) => <option key={p!.id} value={p!.id}>{p!.full_name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-mab-texte"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="accent-mab-aqua" /> Masquer les tâches faites</label>
            {member && <Button variant="primaire" className="ml-auto" onClick={() => newTask()}><Plus size={17} /> Ajouter une tâche</Button>}
          </div>

          {view === 'roadmap' && (
            <>
              <PhaseStepper phases={phases} tasks={tasks} phaseOf={phaseOf} />
              <div className="grid gap-4">
                {phases.map((ph, i) => {
                  const list = filtered.filter((t) => phaseOf(t) === ph);
                  const all = tasks.filter((t) => phaseOf(t) === ph);
                  if (ph === 'Sans étape' && !all.length) return null;
                  return (
                    <Card key={ph} className="p-5">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: i % 2 ? '#e8318a' : '#3bbfbf' }}>{i + 1}</span>
                        <h3 className="flex-1 font-semibold">{ph.replace(/^\d+\s*·\s*/, '')}</h3>
                        <span className="text-xs text-mab-texte">{all.filter(isDone).length} / {all.length}</span>
                      </div>
                      {list.map((t) => <TaskRow key={t.id} task={t} onEdit={setDraft} />)}
                      {list.length === 0 && <p className="py-2 text-sm text-mab-gris-doux">Aucune tâche{person || hideDone ? ' avec ces filtres' : ''}.</p>}
                      {member && ph !== 'Sans étape' && (
                        <button onClick={() => newTask({ phase: ph })} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-mab-aqua-texte hover:underline"><Plus size={15} /> Ajouter dans cette étape</button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {view === 'tableau' && <Kanban tasks={filtered} onEdit={setDraft} canEdit={member} />}

          {view === 'liste' && (
            <Card className="px-5 py-2">
              {filtered.length === 0 ? <p className="py-6 text-center text-sm text-mab-texte">Aucune tâche.</p> : filtered.map((t) => <TaskRow key={t.id} task={t} onEdit={setDraft} />)}
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card className="p-5">
            <Surtitre>Discussion</Surtitre>
            <h2 className="mb-4 mt-1 text-lg font-semibold">Échanges de l’équipe</h2>
            {member ? <Comments project={project} /> : <p className="text-sm text-mab-texte">Réservé aux personnes du projet.</p>}
          </Card>
          <Card className="p-5">
            <Surtitre>Historique</Surtitre>
            <h2 className="mb-3 mt-1 text-lg font-semibold">Activité du projet</h2>
            {activity.length === 0 && <p className="text-sm text-mab-texte">Rien pour l’instant.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2.5 border-b border-mab-filet py-2 text-sm last:border-0">
                <Avatar p={byId.get(a.actor_id ?? '')} size={24} />
                <p><b>{byId.get(a.actor_id ?? '')?.full_name}</b> {a.text}<span className="block text-xs text-mab-gris-doux">{fmtStamp(a.created_at)}</span></p>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <TaskModal draft={draft} onClose={() => setDraft(null)} />
      <ProjectModal open={editing} project={project} onClose={() => setEditing(false)} />
      <DuplicateModal open={dup} project={project} onClose={() => setDup(false)} />
      <SaveTemplateModal open={asTpl} project={project} onClose={() => setAsTpl(false)} />
    </>
  );
}

function PhaseStepper({ phases, tasks, phaseOf }: { phases: string[]; tasks: Task[]; phaseOf: (t: Task) => string }) {
  const steps = phases.filter((p) => p !== 'Sans étape');
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {steps.map((ph) => {
        const all = tasks.filter((t) => phaseOf(t) === ph);
        const done = all.filter(isDone).length;
        const late = all.some(isLate);
        const complete = all.length > 0 && done === all.length;
        return (
          <div key={ph} className={`min-w-[140px] flex-1 rounded-mab-champ border px-3 py-2.5 ${complete ? 'border-mab-filet-aqua bg-mab-wash-2' : late ? 'border-mab-filet-rose bg-mab-rose-wash' : 'border-mab-filet bg-white'}`}>
            <p className="truncate text-xs font-semibold text-mab-encre" title={ph}>{ph.replace(/^\d+\s*·\s*/, '')}</p>
            <p className={`mt-0.5 text-xs ${late && !complete ? 'text-mab-erreur' : 'text-mab-texte'}`}>{complete ? 'Terminé' : `${done} / ${all.length}${late ? ' · retard' : ''}`}</p>
          </div>
        );
      })}
    </div>
  );
}

const COLS: { id: TaskStatus; label: string }[] = [
  { id: 'a_faire', label: 'À faire' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'fait', label: 'Fait' },
];

function Kanban({ tasks, onEdit, canEdit }: { tasks: Task[]; onEdit: (t: Task) => void; canEdit: boolean }) {
  const { setTaskStatus, byId } = useStore();
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLS.map((c) => {
        const list = tasks.filter((t) => t.status === c.id);
        return (
          <div
            key={c.id}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(c.id); } }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
              if (t && t.status !== c.id) setTaskStatus(t, c.id);
            }}
            className={`rounded-mab-carte border p-3 transition ${over === c.id ? 'border-mab-aqua bg-mab-wash-2' : 'border-mab-filet bg-mab-wash'}`}
          >
            <p className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{c.label}<span className="font-normal text-mab-texte">{list.length}</span></p>
            <div className="grid gap-2">
              {list.map((t) => (
                <div
                  key={t.id}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  onClick={() => canEdit && onEdit(t)}
                  className="cursor-pointer rounded-mab-champ border border-mab-filet bg-white p-3 transition hover:border-mab-filet-aqua"
                >
                  <div className="flex items-start gap-2">
                    <span onClick={(e) => e.stopPropagation()}><StatusCheck task={t} disabled={!canEdit} /></span>
                    <p className={`flex-1 text-sm ${isDone(t) ? 'text-mab-gris-doux line-through' : ''}`}>{t.title}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-mab-texte">
                    <span className="flex items-center gap-2.5"><span className={isLate(t) ? 'font-semibold text-mab-erreur' : ''}>{fmtShort(t.due_date)}</span><TaskMeta task={t} /></span>
                    <Avatar p={byId.get(t.assignee_id ?? '')} size={22} />
                  </div>
                </div>
              ))}
              {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-mab-gris-doux">{canEdit ? 'Glisse une tâche ici' : '—'}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
