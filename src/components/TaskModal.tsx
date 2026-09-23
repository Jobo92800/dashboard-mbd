import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Priority, Task, TaskStatus } from '../lib/types';
import { CENTRES, PRIORITIES, QUICK_TYPES } from '../lib/types';
import { useStore } from '../state/store';
import { canDeleteTask } from '../lib/permissions';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

export type TaskDraft = Partial<Task>;

/** Création / modification d'une tâche, de projet ou rapide (sans project_id). */
export function TaskModal({ draft, onClose }: { draft: TaskDraft | null; onClose: () => void }) {
  const { snap, me, saveTask, deleteTask } = useStore();
  const [t, setT] = useState<TaskDraft>({});
  useEffect(() => { if (draft) setT({ priority: 'Moyenne', status: 'a_faire', assignee_id: me?.id, ...draft }); }, [draft, me?.id]);
  if (!draft || !me) return null;

  const project = snap.projects.find((p) => p.id === t.project_id);
  const people = snap.profiles.filter((p) => p.active && (!project || project.member_ids.includes(p.id)));
  const isEdit = !!draft.id;
  const set = (patch: TaskDraft) => setT((x) => ({ ...x, ...patch }));
  const valid = !!t.title?.trim();

  const submit = async () => {
    if (!valid) return;
    onClose();
    await saveTask({ ...t, title: t.title!.trim() } as Task);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier la tâche' : project ? `Nouvelle tâche · ${project.name}` : 'Nouvelle tâche rapide'}
      footer={
        <>
          {isEdit && canDeleteTask(me, draft as Task, snap.projects) && (
            <Button variant="danger" className="mr-auto" onClick={() => { onClose(); deleteTask(draft as Task); }}>
              <Trash2 size={16} /> Supprimer
            </Button>
          )}
          <Button variant="tertiaire" onClick={onClose}>Annuler</Button>
          <Button variant="primaire" disabled={!valid} onClick={submit}>{isEdit ? 'Enregistrer' : 'Ajouter la tâche'}</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Tâche">
          <Input autoFocus value={t.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. Valider le message J+1" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsable">
            <Select value={t.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
              <option value="">Personne</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Échéance">
            <Input type="date" value={t.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
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
            <Field label="Étape du projet" className="sm:col-span-2">
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
          <Field label="Centre concerné" className={project ? 'sm:col-span-2' : ''}>
            <Select value={t.centre ?? ''} onChange={(e) => set({ centre: e.target.value || null })}>
              <option value="">Tous / aucun</option>
              {CENTRES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Note" help="Contexte, lien, numéro à rappeler…">
          <Textarea value={t.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
