import { Check, ListChecks, MessageSquare, Paperclip, Pencil, Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Task } from '../lib/types';
import { useStore } from '../state/store';
import { isDone, isLate } from '../lib/selectors';
import { relativeLabel } from '../lib/dates';
import { canEditTask } from '../lib/permissions';
import { Avatar, Badge, IconButton } from './ui';

const PRIO_TONE = { Haute: 'emotion', Moyenne: 'factuel', Basse: 'neutre' } as const;

export function StatusCheck({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { setTaskStatus } = useStore();
  const done = isDone(task);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={done ? 'Marquer comme à faire' : 'Marquer comme fait'}
      onClick={() => setTaskStatus(task, done ? 'a_faire' : 'fait')}
      className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-mab-etiquette border-2 transition before:absolute before:-inset-2.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mab-aqua focus-visible:ring-offset-2 disabled:opacity-40 ${
        done ? 'border-mab-aqua bg-mab-aqua text-white' : task.status === 'en_cours' ? 'border-mab-violet bg-mab-violet-wash' : 'border-mab-filet-aqua bg-white hover:border-mab-aqua'
      }`}
    >
      {done && <Check size={14} strokeWidth={3} />}
    </button>
  );
}

/** Petits repères : sous-tâches, pièces jointes, commentaires, répétition. */
export function TaskMeta({ task }: { task: Task }) {
  const { snap } = useStore();
  const comments = snap.task_comments.filter((c) => c.task_id === task.id).length;
  const done = task.checklist.filter((c) => c.done).length;
  return (
    <>
      {task.checklist.length > 0 && (
        <span className={`inline-flex items-center gap-1 ${done === task.checklist.length ? 'text-mab-succes' : ''}`} title="Sous-tâches">
          <ListChecks size={13} /> {done}/{task.checklist.length}
        </span>
      )}
      {task.attachments.length > 0 && <span className="inline-flex items-center gap-1" title="Pièces jointes"><Paperclip size={13} /> {task.attachments.length}</span>}
      {comments > 0 && <span className="inline-flex items-center gap-1" title="Commentaires"><MessageSquare size={13} /> {comments}</span>}
      {task.recurrence && <span className="inline-flex items-center text-mab-violet-texte" title="Tâche récurrente"><Repeat size={13} /></span>}
    </>
  );
}

export function TaskRow({ task, onEdit, showProject = false, compact = false }: {
  task: Task; onEdit?: (t: Task) => void; showProject?: boolean; compact?: boolean;
}) {
  const { byId, snap, me } = useStore();
  const project = task.project_id ? snap.projects.find((p) => p.id === task.project_id) : undefined;
  const late = isLate(task);
  const done = isDone(task);
  const editable = me ? canEditTask(me, task, snap.projects) : false;
  return (
    <div className={`group flex items-center gap-3 border-b border-mab-filet px-1 py-3 last:border-0 ${compact ? 'py-2.5' : ''}`}>
      <StatusCheck task={task} disabled={!editable} />
      <div className="min-w-0 flex-1">
        {onEdit && editable ? (
          <button type="button" onClick={() => onEdit(task)} className={`block max-w-full truncate text-left text-[15px] hover:underline ${done ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}>{task.title}</button>
        ) : (
          <p className={`truncate text-[15px] ${done ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}>{task.title}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mab-texte">
          <span className={late ? 'font-semibold text-mab-erreur' : ''}>{relativeLabel(task.due_date)}</span>
          {task.status === 'en_cours' && <span className="font-medium text-mab-violet-texte">En cours</span>}
          {showProject && project && (
            <Link to={`/projets/${project.id}`} className="inline-flex items-center gap-1.5 hover:underline">
              <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
              {project.name}
            </Link>
          )}
          {showProject && !project && task.kind && <span>{task.kind}</span>}
          {task.centre && <span>· {task.centre}</span>}
          <TaskMeta task={task} />
        </div>
      </div>
      {!compact && task.priority !== 'Moyenne' && !done && (
        <>
          <Badge tone={PRIO_TONE[task.priority]} className="max-sm:hidden">{task.priority}</Badge>
          {task.priority === 'Haute' && <span className="h-2 w-2 shrink-0 rounded-full bg-mab-rose sm:hidden" title="Priorité haute" />}
        </>
      )}
      <Avatar p={byId.get(task.assignee_id ?? '')} size={28} />
      {onEdit && editable && (
        <IconButton label="Modifier la tâche" className="hidden opacity-60 group-hover:opacity-100 sm:grid" onClick={() => onEdit(task)}>
          <Pencil size={15} />
        </IconButton>
      )}
    </div>
  );
}
