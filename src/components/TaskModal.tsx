import { useEffect, useState } from 'react';
import { CheckCircle2, ListChecks, MessageSquareText, Paperclip, Repeat, Trash2 } from 'lucide-react';
import type { Priority, Recurrence, Task, TaskStatus } from '../lib/types';
import { CENTRES, PRIORITIES, QUICK_TYPES, RECURRENCES } from '../lib/types';
import { useStore } from '../state/store';
import { canDeleteTask, canEditTask } from '../lib/permissions';
import { fmtStamp } from '../lib/dates';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { Attachments, ChecklistEditor } from './TaskExtras';
import { Discussion } from './Comments';
import { absenceWarning } from '../lib/absences';

export type TaskDraft = Partial<Task>;

function Section({ icon, title, children, aside }: { icon: React.ReactNode; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-mab-filet pt-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-mab-encre">{icon}{title}{aside && <span className="ml-auto font-normal">{aside}</span>}</h3>
      {children}
    </section>
  );
}

/** Fiche complète d'une tâche (de projet ou rapide) : infos, sous-tâches, pièces jointes, commentaires. */
export function TaskModal({ draft, onClose }: { draft: TaskDraft | null; onClose: () => void }) {
  const { snap, me, byId, saveTask, deleteTask, setChecklist, addTaskComment, deleteTaskComment } = useStore();
  const [t, setT] = useState<TaskDraft>({});
  useEffect(() => {
    if (draft) setT({ priority: 'Moyenne', status: 'a_faire', assignee_id: me?.id, checklist: [], attachments: [], recurrence: null, ...draft });
  }, [draft, me?.id]);
  if (!draft || !me) return null;

  const isEdit = !!draft.id;
  const live = isEdit ? snap.tasks.find((x) => x.id === draft.id) : undefined;
  const project = snap.projects.find((p) => p.id === t.project_id);
  const people = snap.profiles.filter((p) => p.active && (!project || project.member_ids.includes(p.id)));
  const editable = !live || canEditTask(me, live, snap.projects);
  const set = (patch: TaskDraft) => setT((x) => ({ ...x, ...patch }));
  const valid = !!t.title?.trim();

  const submit = async () => {
    if (!valid || !editable) return;
    onClose();
    // Sous-tâches et pièces jointes d'une tâche existante sont déjà enregistrées au fil de l'eau.
    const { checklist, attachments, ...fields } = t;
    await saveTask({ ...(isEdit ? fields : { ...fields, checklist, attachments }), title: t.title!.trim() } as Task);
  };

  const checklist = live ? live.checklist : t.checklist ?? [];
  const comments = live ? snap.task_comments.filter((c) => c.task_id === live.id) : [];
  const commenters = snap.profiles.filter((p) => p.active && (!project || project.member_ids.includes(p.id) || p.role === 'admin'));
  const creator = live?.created_by ? byId.get(live.created_by) : undefined;

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isEdit ? (project ? project.name : 'Tâche rapide') : project ? `Nouvelle tâche · ${project.name}` : 'Nouvelle tâche rapide'}
      footer={
        <>
          {isEdit && canDeleteTask(me, draft as Task, snap.projects) && (
            <Button variant="danger" className="mr-auto" onClick={() => { if (confirm('Supprimer cette tâche ?')) { onClose(); deleteTask(draft as Task); } }}>
              <Trash2 size={16} /> Supprimer
            </Button>
          )}
          <Button variant="tertiaire" onClick={onClose}>{editable ? 'Annuler' : 'Fermer'}</Button>
          {editable && <Button variant="primaire" disabled={!valid} onClick={submit}>{isEdit ? 'Enregistrer' : 'Ajouter la tâche'}</Button>}
        </>
      }
    >
      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset disabled={!editable} className="grid gap-4">
          <Input
            autoFocus={!isEdit}
            value={t.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Titre de la tâche"
            aria-label="Titre de la tâche"
            className="!h-12 !text-lg !font-medium"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Responsable">
              <Select value={t.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
                <option value="">Personne</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Échéance">
              <Input type="date" value={t.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
            </Field>
            <Field label="Répétition" help={t.recurrence ? 'La suivante se crée quand celle-ci est faite.' : undefined}>
              <Select value={t.recurrence ?? ''} onChange={(e) => set({ recurrence: (e.target.value || null) as Recurrence | null })}>
                <option value="">Ne se répète pas</option>
                {RECURRENCES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </Field>
            <Field label="Priorité">
              <Select value={t.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={t.status} onChange={(e) => set({ status: e.target.value as TaskStatus, done_at: e.target.value === 'fait' ? new Date().toISOString() : null })}>
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="fait">Fait</option>
              </Select>
            </Field>
            {project ? (
              <Field label="Étape du projet">
                <Select value={t.phase ?? ''} onChange={(e) => set({ phase: e.target.value || null })}>
                  <option value="">Sans étape</option>
                  {project.phases.map((ph) => <option key={ph}>{ph}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Type">
                <Select value={t.kind ?? ''} onChange={(e) => set({ kind: e.target.value || null })}>
                  <option value="">—</option>
                  {QUICK_TYPES.map((k) => <option key={k}>{k}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Centre concerné">
              <Select value={t.centre ?? ''} onChange={(e) => set({ centre: e.target.value || null })}>
                <option value="">Tous / aucun</option>
                {CENTRES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          {(() => {
            const w = absenceWarning(snap.absences, byId.get(t.assignee_id ?? ''), t.due_date, me);
            return w && t.status !== 'fait' ? <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-2.5 text-sm text-mab-rose-texte">🌴 {w} Choisis une autre date ou une autre personne ?</p> : null;
          })()}
          <Field label="Description">
            <Textarea value={t.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Contexte, consignes, numéro à rappeler…" />
          </Field>
        </fieldset>
        <button type="submit" hidden />

        <Section icon={<ListChecks size={16} className="text-mab-aqua-texte" />} title="Sous-tâches">
          <ChecklistEditor
            items={checklist}
            disabled={!editable}
            onChange={(items) => (live ? setChecklist(live, items) : set({ checklist: items }))}
          />
        </Section>

        <Section icon={<Paperclip size={16} className="text-mab-aqua-texte" />} title="Pièces jointes">
          {live ? <Attachments task={live} disabled={!editable} /> : <p className="text-sm text-mab-gris-doux">Tu pourras joindre fichiers et liens une fois la tâche créée.</p>}
        </Section>

        {live && (
          <Section icon={<MessageSquareText size={16} className="text-mab-aqua-texte" />} title={`Commentaires${comments.length ? ` · ${comments.length}` : ''}`}>
            <Discussion
              compact
              items={comments}
              people={commenters}
              onSend={(body) => addTaskComment(live, body)}
              onDelete={deleteTaskComment}
              empty="Aucun commentaire. Le responsable est prévenu à chaque message."
            />
          </Section>
        )}

        {live && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mab-gris-doux">
            <span>Créée par {creator?.full_name ?? '—'} le {fmtStamp(live.created_at)}</span>
            {live.done_at && <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Terminée le {fmtStamp(live.done_at)}</span>}
            {live.recurrence && <span className="inline-flex items-center gap-1"><Repeat size={12} /> {RECURRENCES.find((r) => r.id === live.recurrence)?.label}</span>}
          </p>
        )}
      </form>
    </Modal>
  );
}
