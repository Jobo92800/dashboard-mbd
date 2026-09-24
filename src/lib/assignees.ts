import type { Task } from './types';

/** Personnes concernées par une tâche (une tâche peut être partagée entre plusieurs personnes). */
export function assigneesOf(t: Pick<Task, 'assignee_ids' | 'assignee_id'>): string[] {
  if (t.assignee_ids?.length) return t.assignee_ids;
  return t.assignee_id ? [t.assignee_id] : [];
}

export const isAssigned = (t: Pick<Task, 'assignee_ids' | 'assignee_id'>, id: string | null | undefined) =>
  !!id && assigneesOf(t).includes(id);

/** Garde `assignee_id` (première personne) aligné sur la liste, pour la compatibilité. */
export const withAssignees = (ids: string[]) => ({ assignee_ids: [...new Set(ids)], assignee_id: ids[0] ?? null });
