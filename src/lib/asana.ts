// Import d'un projet exporté d'Asana (Projet → Exporter → CSV).
// Une ligne avec « Section/Column » et sans parent = une tâche ; les lignes enfants
// deviennent ses sous-tâches (indentées jusqu'à 2 niveaux), leurs notes rejoignent la note de la tâche.
import type { ChecklistItem, Priority, Profile, Task } from './types';
import { uid } from '../data/backend';

/** Lecture CSV (guillemets, retours à la ligne et "" échappés). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

type Row = { id: string; name: string; section: string; parent: string; notes: string; start: string; due: string; completed: string; email: string; priority: string; blockedBy: string; blocking: string; children: Row[] };

export type AsanaImport = {
  name: string;
  phases: string[];
  tasks: Omit<Task, 'id' | 'project_id' | 'created_by' | 'created_at'>[];
  stats: { tasks: number; subtasks: number; done: number; dated: number };
};

const PRIO: Record<string, Priority> = { haute: 'Haute', élevée: 'Haute', elevee: 'Haute', high: 'Haute', moyenne: 'Moyenne', medium: 'Moyenne', basse: 'Basse', faible: 'Basse', low: 'Basse' };
const date = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
/** Sections par défaut d'Asana, vides dans un modèle : on ne les garde que si elles ont des tâches. */
const DEFAULT_SECTIONS = ['À faire', 'En cours', 'Terminé', 'To do', 'Doing', 'Done', 'Untitled section', 'Section sans titre'];

export function readAsana(text: string, profiles: Profile[]): AsanaImport {
  const [head, ...lines] = parseCsv(text);
  const col = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase());
  const k = {
    id: col('Task ID'), name: col('Name'), section: col('Section/Column'), parent: col('Parent task'), notes: col('Notes'),
    start: col('Start Date'), due: col('Due Date'), completed: col('Completed At'), email: col('Assignee Email'),
    priority: head.findIndex((h) => /priorit/i.test(h)), project: col('Projects'),
    blockedBy: col('Blocked By (Dependencies)'), blocking: col('Blocking (Dependencies)'),
  };
  if (k.name < 0 || k.parent < 0) throw new Error('Ce fichier ne ressemble pas à un export CSV d’Asana (colonnes « Name » et « Parent task » introuvables).');
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  const all: Row[] = [];
  const roots: Row[] = [];
  let projectName = '';
  for (const r of lines) {
    const row: Row = {
      id: get(r, k.id), name: get(r, k.name), section: get(r, k.section), parent: get(r, k.parent), notes: (k.notes >= 0 ? r[k.notes] ?? '' : '').trim(),
      start: get(r, k.start), due: get(r, k.due), completed: get(r, k.completed), email: get(r, k.email).toLowerCase(),
      priority: get(r, k.priority), blockedBy: get(r, k.blockedBy), blocking: get(r, k.blocking), children: [],
    };
    if (!row.name) continue;
    if (!projectName) projectName = get(r, k.project);
    if (row.parent) {
      // Asana désigne le parent par son nom : on prend la dernière ligne de ce nom (export en profondeur d'abord).
      const parent = [...all].reverse().find((x) => x.name === row.parent);
      if (parent) parent.children.push(row); else roots.push(row);
    } else roots.push(row);
    all.push(row);
  }

  const phases: string[] = [];
  for (const r of roots) if (r.section && !phases.includes(r.section)) phases.push(r.section);
  const used = new Set(roots.map((r) => r.section));
  const keptPhases = phases.filter((p) => used.has(p) || !DEFAULT_SECTIONS.includes(p));

  const byEmail = new Map(profiles.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id]));
  let subtasks = 0, done = 0, dated = 0;

  const tasks = roots.map((r) => {
    const checklist: ChecklistItem[] = [];
    const notes: string[] = [];
    const walk = (list: Row[], level: number) => {
      for (const c of list) {
        checklist.push({ id: uid(), text: c.name, done: !!c.completed, ...(level ? { level: Math.min(level, 2) } : {}) });
        subtasks++;
        if (c.notes) notes.push(`**${c.name}** : ${c.notes}`);
        walk(c.children, level + 1);
      }
    };
    walk(r.children, 0);
    const deps = [r.blockedBy && `Bloquée par : ${r.blockedBy}`, r.blocking && `Bloque : ${r.blocking}`].filter(Boolean);
    const note = [r.notes, deps.join('\n'), notes.length ? `### Détails des sous-tâches\n\n${notes.join('\n\n')}` : ''].filter(Boolean).join('\n\n');
    const assignee = byEmail.get(r.email);
    if (r.completed) done++;
    if (date(r.due) || date(r.start)) dated++;
    return {
      phase: r.section || null, title: r.name, note,
      assignee_id: assignee ?? null, assignee_ids: assignee ? [assignee] : [],
      start_date: date(r.start), due_date: date(r.due),
      priority: PRIO[r.priority.toLowerCase()] ?? 'Moyenne',
      status: r.completed ? 'fait' as const : 'a_faire' as const,
      kind: null, centre: null, done_at: r.completed ? `${date(r.completed)}T12:00:00.000Z` : null,
      checklist, attachments: [], recurrence: null,
    };
  });

  const clean = projectName.replace(/^[^\p{L}\p{N}]+/u, '').replace(/™/g, '').replace(/^template\s+(process\s+)?(asana\s*)?\|?\s*/i, '').trim();
  return { name: clean || 'Projet importé d’Asana', phases: keptPhases, tasks, stats: { tasks: tasks.length, subtasks, done, dated } };
}
