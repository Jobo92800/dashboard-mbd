import { Link } from 'react-router-dom';
import { CalendarDays, Check, Flag, Layers, ListChecks, MessageSquareText, Paperclip, Pencil, Repeat, RotateCcw, Trash2, UserRound } from 'lucide-react';
import type { Task, TaskStatus } from '../lib/types';
import { RECURRENCES } from '../lib/types';
import { useStore } from '../state/store';
import { canDeleteTask, canEditTask } from '../lib/permissions';
import { fmtLong, fmtStamp, relativeLabel } from '../lib/dates';
import { isDone, isLate } from '../lib/selectors';
import { absenceWarning } from '../lib/absences';
import { Markdown } from '../lib/markdown';
import { ActionMenu, Avatar, Badge, Button, Modal } from './ui';
import { Attachments, ChecklistEditor } from './TaskExtras';
import { Discussion } from './Comments';
import { PresenceDot, usePresenceText } from './Presence';

const STATUS: { id: TaskStatus; label: string }[] = [
  { id: 'a_faire', label: 'À faire' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'fait', label: 'Fait' },
];

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-mab-champ bg-mab-wash px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-mab-aqua-texte">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-mab-gris">{label}</p>
        <div className="mt-0.5 text-sm text-mab-encre">{children}</div>
      </div>
    </div>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-mab-filet pt-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-mab-encre">{icon}{title}</h3>
      {children}
    </section>
  );
}

/** Carte de lecture d'une tâche : tout voir d'un coup d'œil, cocher, commenter ; « Modifier » ouvre le formulaire. */
export function TaskSheet({ task, onEdit, onClose }: { task: Task; onEdit: () => void; onClose: () => void }) {
  const { snap, me, byId, setTaskStatus, setChecklist, addTaskComment, deleteTaskComment, deleteTask } = useStore();
  const presenceText = usePresenceText();
  const project = snap.projects.find((p) => p.id === task.project_id);
  const assignee = byId.get(task.assignee_id ?? '');
  const creator = byId.get(task.created_by ?? '');
  const editable = canEditTask(me!, task, snap.projects);
  const done = isDone(task);
  const late = isLate(task);
  const warning = !done ? absenceWarning(snap.absences, assignee, task.due_date, me) : null;
  const comments = snap.task_comments.filter((c) => c.task_id === task.id);
  const commenters = snap.profiles.filter((p) => p.active && (!project || project.member_ids.includes(p.id) || p.role === 'admin'));
  const checklistDone = task.checklist.filter((c) => c.done).length;

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={project ? project.name : 'Tâche rapide'}
      footer={
        <>
          {canDeleteTask(me!, task, snap.projects) && (
            <ActionMenu className="mr-auto" label="Plus d’actions" actions={[
              { label: 'Supprimer la tâche', icon: Trash2, danger: true, onClick: () => { if (confirm('Supprimer cette tâche ?')) { onClose(); deleteTask(task); } } },
            ]} />
          )}
          {editable && <Button onClick={onEdit}><Pencil size={15} /> Modifier</Button>}
          {editable && (done
            ? <Button variant="secondaire" onClick={() => setTaskStatus(task, 'a_faire')}><RotateCcw size={15} /> Rouvrir</Button>
            : <Button variant="primaire" onClick={() => { setTaskStatus(task, 'fait'); onClose(); }}><Check size={16} /> Marquer comme fait</Button>)}
          {!editable && <Button variant="tertiaire" onClick={onClose}>Fermer</Button>}
        </>
      }
    >
      <div className="grid gap-5">
        {/* Titre et étiquettes */}
        <div>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            <Badge tone={done ? 'succes' : task.status === 'en_cours' ? 'violet' : late ? 'erreur' : 'neutre'}>
              {done ? '✓ Fait' : task.status === 'en_cours' ? 'En cours' : late ? 'En retard' : 'À faire'}
            </Badge>
            {task.priority === 'Haute' && <Badge tone="emotion"><Flag size={11} /> Priorité haute</Badge>}
            {task.priority === 'Basse' && <Badge>Priorité basse</Badge>}
            {task.recurrence && <Badge tone="violet"><Repeat size={11} /> {RECURRENCES.find((r) => r.id === task.recurrence)?.label}</Badge>}
            {task.kind && <Badge tone="factuel">{task.kind}</Badge>}
            {task.centre && <Badge tone="mesure">{task.centre}</Badge>}
            {project && (
              <Link to={`/projets/${project.id}`} onClick={onClose} className="inline-flex items-center gap-1.5 rounded-mab-pilule bg-mab-wash px-2.5 py-1 text-[11px] font-semibold text-mab-texte hover:bg-mab-wash-2">
                <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />{project.name}
              </Link>
            )}
          </div>
          <h2 className={`text-[26px] font-light leading-tight tracking-tight sm:text-[30px] ${done ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}>{task.title}</h2>
        </div>

        {/* Statut en un toucher */}
        {editable && (
          <div className="inline-flex w-full rounded-mab-pilule border border-mab-filet bg-white p-1 sm:w-auto" role="radiogroup" aria-label="Statut">
            {STATUS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={task.status === s.id}
                onClick={() => task.status !== s.id && setTaskStatus(task, s.id)}
                className={`flex-1 rounded-mab-pilule px-4 py-2 text-sm font-medium transition sm:flex-none ${
                  task.status === s.id
                    ? s.id === 'fait' ? 'bg-mab-succes text-white' : s.id === 'en_cours' ? 'bg-mab-violet text-white' : 'bg-mab-aqua-encre text-white'
                    : 'text-mab-texte hover:bg-mab-wash-2'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Infos clés */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Info icon={<UserRound size={17} />} label="Responsable">
            {assignee ? (
              <span className="flex items-center gap-2.5">
                <span className="relative"><Avatar p={assignee} size={30} /><PresenceDot p={assignee} className="absolute -bottom-0.5 -right-0.5" /></span>
                <span className="min-w-0">
                  <span className="block font-medium">{assignee.id === me!.id ? 'Moi' : assignee.full_name}</span>
                  <span className="block truncate text-xs text-mab-texte">{presenceText(assignee)}</span>
                </span>
              </span>
            ) : <span className="text-mab-gris-doux">Personne</span>}
          </Info>
          <Info icon={<CalendarDays size={17} />} label="Échéance">
            {task.due_date ? (
              <>
                <span className={`block font-medium ${late ? 'text-mab-erreur' : ''}`}>{relativeLabel(task.due_date)}</span>
                <span className="block text-xs capitalize text-mab-texte">{fmtLong(task.due_date)}</span>
              </>
            ) : <span className="text-mab-gris-doux">Sans échéance</span>}
          </Info>
          {project && (
            <Info icon={<Layers size={17} />} label="Étape">
              {task.phase ? task.phase.replace(/^\d+\s*·\s*/, '') : <span className="text-mab-gris-doux">Sans étape</span>}
            </Info>
          )}
          <Info icon={<Pencil size={17} />} label="Créée par">
            <span className="flex items-center gap-2">
              {creator && <Avatar p={creator} size={22} />}
              <span>{creator ? (creator.id === me!.id ? 'Moi' : creator.full_name) : '—'} <span className="text-xs text-mab-texte">· {fmtStamp(task.created_at)}</span></span>
            </span>
          </Info>
        </div>

        {warning && <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-2.5 text-sm text-mab-rose-texte">🌴 {warning}</p>}
        {done && task.done_at && <p className="text-sm text-mab-succes">✓ Terminée le {fmtStamp(task.done_at)}</p>}

        {/* Description */}
        {task.note.trim() ? (
          <div className="rounded-mab-champ border border-mab-filet px-4 py-3"><Markdown text={task.note} /></div>
        ) : editable ? (
          <button onClick={onEdit} className="rounded-mab-champ border border-dashed border-mab-filet px-4 py-3 text-left text-sm text-mab-gris-doux hover:border-mab-filet-aqua hover:text-mab-aqua-texte">+ Ajouter une description</button>
        ) : null}

        {(task.checklist.length > 0 || editable) && (
          <Block icon={<ListChecks size={16} className="text-mab-aqua-texte" />} title={`Sous-tâches${task.checklist.length ? ` · ${checklistDone}/${task.checklist.length}` : ''}`}>
            <ChecklistEditor items={task.checklist} disabled={!editable} onChange={(items) => setChecklist(task, items)} />
          </Block>
        )}

        {(task.attachments.length > 0 || editable) && (
          <Block icon={<Paperclip size={16} className="text-mab-aqua-texte" />} title={`Pièces jointes${task.attachments.length ? ` · ${task.attachments.length}` : ''}`}>
            <Attachments task={task} disabled={!editable} />
          </Block>
        )}

        <Block icon={<MessageSquareText size={16} className="text-mab-aqua-texte" />} title={`Commentaires${comments.length ? ` · ${comments.length}` : ''}`}>
          <Discussion compact items={comments} people={commenters} onSend={(body) => addTaskComment(task, body)} onDelete={deleteTaskComment} empty="Aucun commentaire. Le responsable est prévenu à chaque message." />
        </Block>
      </div>
    </Modal>
  );
}
