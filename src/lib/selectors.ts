import type { Project, Task } from './types';
import { daysUntil, todayIso } from './dates';

export const isDone = (t: Task) => t.status === 'fait';
export const isLate = (t: Task) => !isDone(t) && !!t.due_date && t.due_date < todayIso();
export const isToday = (t: Task) => !isDone(t) && t.due_date === todayIso();

export function progress(tasks: Task[], projectId: string) {
  const list = tasks.filter((t) => t.project_id === projectId);
  return { done: list.filter(isDone).length, total: list.length, late: list.filter(isLate).length };
}

export type Health = { label: string; tone: 'succes' | 'erreur' | 'factuel' | 'mesure' | 'neutre' | 'emotion' };

/** Santé d'un projet : terminé, en retard, à risque (fin proche et avancement faible), dans les temps. */
export function projectHealth(p: Project, tasks: Task[]): Health {
  if (p.status === 'archive') return { label: 'Archivé', tone: 'neutre' };
  if (p.status === 'termine') return { label: 'Terminé', tone: 'succes' };
  if (p.status === 'planifie') return { label: 'Planifié', tone: 'factuel' };
  const { done, total, late } = progress(tasks, p.id);
  if (total && done === total) return { label: 'Prêt à clôturer', tone: 'succes' };
  if (p.end_date && daysUntil(p.end_date) < 0) return { label: 'Échéance dépassée', tone: 'erreur' };
  if (late > 0) return { label: `${late} en retard`, tone: 'erreur' };
  const pct = total ? done / total : 0;
  if (p.end_date && daysUntil(p.end_date) <= 3 && pct < 0.7) return { label: 'À risque', tone: 'emotion' };
  return { label: 'Dans les temps', tone: 'mesure' };
}

const PRIO_RANK = { Haute: 0, Moyenne: 1, Basse: 2 } as const;
export function sortTasks(list: Task[]) {
  return [...list].sort((a, b) => {
    if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
    const da = a.due_date ?? '9999', db = b.due_date ?? '9999';
    if (da !== db) return da < db ? -1 : 1;
    return PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
  });
}
