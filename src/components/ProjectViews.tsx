// Vues d'un projet, sur le modèle d'Asana : Liste, Tableau (colonnes), Chronologie, Calendrier, Tableau de bord.
import { Fragment, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Project, Task, TaskStatus } from '../lib/types';
import { useStore } from '../state/store';
import { isDone, isLate } from '../lib/selectors';
import { fmtShort, todayIso, toIso } from '../lib/dates';
import { AssigneeStack, StatusCheck, TaskMeta } from './TaskRow';
import { Badge, Button, Card, IconButton } from './ui';
import { assigneesOf } from '../lib/assignees';

export const NO_PHASE = 'Sans étape';
const short = (ph: string) => ph.replace(/^\d+\s*·\s*/, '');
const STATUS: { id: TaskStatus; label: string; tone: 'neutre' | 'factuel' | 'succes' }[] = [
  { id: 'a_faire', label: 'À faire', tone: 'neutre' },
  { id: 'en_cours', label: 'En cours', tone: 'factuel' },
  { id: 'fait', label: 'Fait', tone: 'succes' },
];
const PRIO_TONE = { Haute: 'emotion', Moyenne: 'factuel', Basse: 'neutre' } as const;
/** Une teinte par étape (terrains de la DA), dans l'ordre des étapes. */
const PHASE_TONES = [
  { bg: 'bg-mab-terrain-1-fond', border: 'border-mab-terrain-1-filet', text: 'text-mab-terrain-1-texte', bar: '#7fd4d4' },
  { bg: 'bg-mab-terrain-3-fond', border: 'border-mab-terrain-3-filet', text: 'text-mab-terrain-3-texte', bar: '#b9a6e0' },
  { bg: 'bg-mab-terrain-5-fond', border: 'border-mab-terrain-5-filet', text: 'text-mab-terrain-5-texte', bar: '#f2a7cb' },
  { bg: 'bg-mab-terrain-2-fond', border: 'border-mab-terrain-2-filet', text: 'text-mab-terrain-2-texte', bar: '#9cc0dd' },
  { bg: 'bg-mab-terrain-4-fond', border: 'border-mab-terrain-4-filet', text: 'text-mab-terrain-4-texte', bar: '#d9a8cf' },
];
export const toneOf = (phases: string[], ph: string) => PHASE_TONES[Math.max(0, phases.indexOf(ph)) % PHASE_TONES.length];

type Common = { project: Project; tasks: Task[]; phases: string[]; phaseOf: (t: Task) => string; onEdit: (t: Task) => void; onNew: (extra: Partial<Task>) => void; canEdit: boolean };

/* ------------------------------------------------------------------ Liste */

/** Liste groupée par étape, colonnes façon Asana ; les sous-tâches se déplient sous la tâche. */
export function ListView({ tasks, phases, phaseOf, onEdit, onNew, canEdit, header }: Common & { header: (ph: string, i: number, list: Task[]) => React.ReactNode }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, k: string, fn: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); fn(n); };
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_96px_96px_96px] gap-3 border-b border-mab-filet px-5 py-2.5 text-xs font-medium text-mab-texte md:grid">
        <span>Nom</span><span>Responsable</span><span>Échéance</span><span>Priorité</span><span>Statut</span>
      </div>
      {phases.map((ph, i) => {
        const all = tasks.filter((t) => phaseOf(t) === ph);
        if (ph === NO_PHASE && !all.length) return null;
        const isClosed = closed.has(ph);
        return (
          <section key={ph} id={`etape-${i}`} className="scroll-mt-24 border-b border-mab-filet last:border-0">
            <div className="flex items-center gap-1 px-3 pt-3">
              <IconButton label={isClosed ? 'Déplier l’étape' : 'Replier l’étape'} className="!h-8 !w-8 shrink-0" onClick={() => toggle(closed, ph, setClosed)}>
                <ChevronDown size={16} className={`transition ${isClosed ? '-rotate-90' : ''}`} />
              </IconButton>
              <div className="min-w-0 flex-1">{header(ph, i, all)}</div>
            </div>
            {!isClosed && (
              <div className="pb-2">
                {all.map((t) => {
                  const expanded = open.has(t.id);
                  return (
                    <Fragment key={t.id}>
                      <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-mab-filet/70 px-5 py-2 hover:bg-mab-wash md:grid-cols-[minmax(0,1fr)_120px_96px_96px_96px]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {t.checklist.length > 0 ? (
                            <button aria-label={expanded ? 'Masquer les sous-tâches' : 'Voir les sous-tâches'} onClick={() => toggle(open, t.id, setOpen)} className="-ml-1 grid h-6 w-5 shrink-0 place-items-center text-mab-gris">
                              <ChevronRight size={15} className={`transition ${expanded ? 'rotate-90' : ''}`} />
                            </button>
                          ) : <span className="-ml-1 w-5 shrink-0" />}
                          <StatusCheck task={t} disabled={!canEdit} />
                          <button onClick={() => onEdit(t)} className={`min-w-0 truncate text-left text-[15px] hover:underline ${isDone(t) ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`} title={t.title}>{t.title}</button>
                          <span className="hidden shrink-0 items-center gap-2.5 text-xs text-mab-texte sm:flex"><TaskMeta task={t} /></span>
                        </div>
                        <div className="md:contents">
                          <span className="hidden md:block"><AssigneeStack task={t} size={24} /></span>
                          <span className={`text-sm ${isLate(t) ? 'font-semibold text-mab-erreur' : 'text-mab-texte'}`}>{t.start_date && t.due_date && t.start_date !== t.due_date ? `${fmtShort(t.start_date)} – ${fmtShort(t.due_date)}` : fmtShort(t.due_date)}</span>
                          <span className="hidden md:block"><Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge></span>
                          <span className="hidden md:block"><Badge tone={STATUS.find((s) => s.id === t.status)!.tone}>{STATUS.find((s) => s.id === t.status)!.label}</Badge></span>
                        </div>
                      </div>
                      {expanded && <SubtaskList task={t} canEdit={canEdit} />}
                    </Fragment>
                  );
                })}
                {all.length === 0 && <p className="border-t border-mab-filet/70 px-12 py-2.5 text-sm text-mab-gris-doux">Aucune tâche.</p>}
                {canEdit && ph !== NO_PHASE && (
                  <button onClick={() => onNew({ phase: ph })} className="ml-12 mt-1 inline-flex items-center gap-1 py-1.5 text-sm font-medium text-mab-aqua-texte hover:underline"><Plus size={15} /> Ajouter une tâche</button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </Card>
  );
}

/** Sous-tâches cochables directement dans la liste. */
function SubtaskList({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { setChecklist } = useStore();
  return (
    <div className="border-t border-mab-filet/50 bg-mab-wash/60 py-1 pl-[68px] pr-5">
      {task.checklist.map((c) => (
        <label key={c.id} className="flex items-center gap-2.5 py-1 text-sm" style={c.level ? { marginLeft: c.level * 22 } : undefined}>
          <input type="checkbox" checked={c.done} disabled={!canEdit} className="h-4 w-4 shrink-0 accent-mab-aqua"
            onChange={() => setChecklist(task, task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} />
          <span className={c.done ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}>{c.text}</span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Tableau */

/** Colonnes par étape (comme Asana) ou par statut ; on glisse une carte d'une colonne à l'autre. */
export function BoardView({ tasks, phases, phaseOf, onEdit, onNew, canEdit }: Common) {
  const { saveTask, setTaskStatus } = useStore();
  const [by, setBy] = useState<'etape' | 'statut'>(() => (localStorage.getItem('mahq_tableau_par') as 'etape' | 'statut') || 'etape');
  const [over, setOver] = useState<string | null>(null);
  const cols = by === 'etape'
    ? phases.filter((ph) => ph !== NO_PHASE || tasks.some((t) => phaseOf(t) === NO_PHASE)).map((ph) => ({ id: ph, label: short(ph), list: tasks.filter((t) => phaseOf(t) === ph) }))
    : STATUS.map((s) => ({ id: s.id, label: s.label, list: tasks.filter((t) => t.status === s.id) }));
  const drop = (col: string, id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (by === 'statut') { if (t.status !== col) setTaskStatus(t, col as TaskStatus); }
    else if (phaseOf(t) !== col) saveTask({ id: t.id, title: t.title, phase: col === NO_PHASE ? null : col });
  };
  const choose = (v: 'etape' | 'statut') => { setBy(v); try { localStorage.setItem('mahq_tableau_par', v); } catch { /* ignoré */ } };
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-mab-texte">
        Colonnes :
        {(['etape', 'statut'] as const).map((v) => (
          <button key={v} onClick={() => choose(v)} className={`rounded-mab-pilule px-3 py-1 font-medium ${by === v ? 'bg-mab-encre text-white' : 'bg-white text-mab-texte ring-1 ring-mab-filet'}`}>{v === 'etape' ? 'Étapes' : 'Statut'}</button>
        ))}
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {cols.map((c) => {
          const tone = by === 'etape' ? toneOf(phases, c.id) : null;
          return (
            <div key={c.id}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(c.id); } }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); drop(c.id, e.dataTransfer.getData('text/plain')); }}
              className={`flex max-h-[75vh] w-[280px] shrink-0 flex-col rounded-mab-carte border p-2.5 transition ${over === c.id ? 'border-mab-aqua bg-mab-wash-2' : 'border-mab-filet bg-mab-wash'}`}>
              <p className="mb-2.5 flex items-start justify-between gap-2 px-1.5 pt-1 text-sm font-semibold">
                <span className="flex min-w-0 items-center gap-2">{tone && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone.bar }} />}<span className="line-clamp-2">{c.label}</span></span>
                <span className="font-normal text-mab-texte">{c.list.length}</span>
              </p>
              <div className="grid gap-2 overflow-y-auto">
                {c.list.map((t) => (
                  <div key={t.id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => onEdit(t)}
                    className="cursor-pointer rounded-mab-champ border border-mab-filet bg-white p-3 transition hover:border-mab-filet-aqua">
                    <div className="flex items-start gap-2">
                      <span onClick={(e) => e.stopPropagation()}><StatusCheck task={t} disabled={!canEdit} /></span>
                      <p className={`flex-1 text-sm ${isDone(t) ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}>{t.title}</p>
                    </div>
                    {(t.priority === 'Haute' || t.status === 'en_cours') && (
                      <div className="mt-2 flex flex-wrap gap-1.5">{t.priority === 'Haute' && <Badge tone="emotion">Haute</Badge>}{by === 'etape' && t.status === 'en_cours' && <Badge tone="factuel">En cours</Badge>}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-mab-texte">
                      <span className="flex items-center gap-2.5"><span className={isLate(t) ? 'font-semibold text-mab-erreur' : ''}>{t.due_date ? fmtShort(t.due_date) : ''}</span><TaskMeta task={t} /></span>
                      {assigneesOf(t).length > 0 && <AssigneeStack task={t} size={22} />}
                    </div>
                  </div>
                ))}
                {c.list.length === 0 && <p className="px-1 py-4 text-center text-xs text-mab-gris-doux">{canEdit ? 'Glisse une tâche ici' : '—'}</p>}
              </div>
              {canEdit && by === 'etape' && c.id !== NO_PHASE && (
                <button onClick={() => onNew({ phase: c.id })} className="mt-2 inline-flex items-center gap-1 px-1.5 py-1 text-sm font-medium text-mab-aqua-texte hover:underline"><Plus size={15} /> Ajouter une tâche</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Chronologie */

const DAY_W = { jours: 36, semaines: 14 } as const;

/** Diagramme de Gantt : une barre par tâche (début → échéance), glissable et étirable. */
export function TimelineView({ project, tasks, phases, phaseOf, onEdit, canEdit }: Common) {
  const { saveTask } = useStore();
  const [zoom, setZoom] = useState<'jours' | 'semaines'>('jours');
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'start' | 'end'; x: number; delta: number } | null>(null);
  const dayW = DAY_W[zoom];
  const today = todayIso();

  const span = (t: Task) => {
    const s = t.start_date || t.due_date, e = t.due_date || t.start_date;
    return s && e ? { s: s <= e ? s : e, e: s <= e ? e : s } : null;
  };
  const dated = tasks.filter((t) => span(t));
  const undated = tasks.filter((t) => !span(t));

  // Fenêtre affichée : du plus tôt au plus tard (projet, tâches, aujourd'hui), avec de la marge.
  const range = useMemo(() => {
    const ds = [today, project.start_date, project.end_date, ...dated.flatMap((t) => [span(t)!.s, span(t)!.e])].filter(Boolean) as string[];
    const min = ds.reduce((a, b) => (a < b ? a : b));
    const max = ds.reduce((a, b) => (a > b ? a : b));
    const from = startOfWeek(addDays(parseISO(min), -7), { weekStartsOn: 1 });
    const to = endOfWeek(addDays(parseISO(max), 21), { weekStartsOn: 1 });
    return { from, days: differenceInCalendarDays(to, from) + 1 };
  }, [today, project.start_date, project.end_date, dated]); // eslint-disable-line react-hooks/exhaustive-deps
  const x = (iso: string) => differenceInCalendarDays(parseISO(iso), range.from) * dayW;
  const days = Array.from({ length: range.days }, (_, i) => addDays(range.from, i));
  const months = days.reduce<{ label: string; n: number }[]>((acc, d) => {
    const label = format(d, 'MMMM yyyy', { locale: fr });
    if (acc.at(-1)?.label === label) acc.at(-1)!.n++; else acc.push({ label, n: 1 });
    return acc;
  }, []);

  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const toToday = (el: HTMLDivElement | null) => {
    scroller.current = el;
    if (el && !scrolled.current) { scrolled.current = true; el.scrollLeft = Math.max(0, x(today) - 160); }
  };

  const startDrag = (e: ReactPointerEvent, t: Task, mode: 'move' | 'start' | 'end') => {
    if (!canEdit) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ id: t.id, mode, x: e.clientX, delta: 0 });
  };
  const moveDrag = (e: ReactPointerEvent) => { if (drag) setDrag({ ...drag, delta: Math.round((e.clientX - drag.x) / dayW) }); };
  const endDrag = (t: Task) => {
    if (!drag) return;
    const d = drag.delta, mode = drag.mode;
    setDrag(null);
    if (!d) { if (mode === 'move') onEdit(t); return; }
    const sp = span(t)!;
    const shift = (iso: string) => toIso(addDays(parseISO(iso), d));
    let s = sp.s, en = sp.e;
    if (mode === 'move') { s = shift(s); en = shift(en); }
    if (mode === 'start') s = shift(s) > en ? en : shift(s);
    if (mode === 'end') en = shift(en) < s ? s : shift(en);
    saveTask({ id: t.id, title: t.title, start_date: s === en ? null : s, due_date: en });
  };
  const place = (t: Task, iso: string) => saveTask({ id: t.id, title: t.title, start_date: null, due_date: iso });

  const LABEL_W = 260;
  const width = range.days * dayW;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-mab-filet px-4 py-2.5">
        <Button variant="discret" onClick={() => scroller.current?.scrollTo({ left: Math.max(0, x(today) - 160), behavior: 'smooth' })}>Aujourd’hui</Button>
        <div className="ml-auto flex rounded-mab-pilule border border-mab-filet p-0.5 text-sm">
          {(['jours', 'semaines'] as const).map((z) => (
            <button key={z} onClick={() => setZoom(z)} className={`rounded-mab-pilule px-3 py-1 font-medium ${zoom === z ? 'bg-mab-encre text-white' : 'text-mab-texte'}`}>{z === 'jours' ? 'Jours' : 'Semaines'}</button>
          ))}
        </div>
      </div>
      <div ref={toToday} className="relative max-h-[70vh] overflow-auto">
        <div style={{ width: LABEL_W + width }} className="relative">
          {/* En-tête : mois puis jours */}
          <div className="sticky top-0 z-20 flex bg-white">
            <div className="sticky left-0 z-30 shrink-0 border-b border-r border-mab-filet bg-white" style={{ width: LABEL_W }} />
            <div className="border-b border-mab-filet">
              <div className="flex">{months.map((m) => <div key={m.label} className="border-r border-mab-filet py-1 text-xs font-semibold capitalize text-mab-encre" style={{ width: m.n * dayW }}><span className="sticky inline-block whitespace-nowrap px-2" style={{ left: LABEL_W }}>{m.label}</span></div>)}</div>
              <div className="flex">
                {days.map((d) => {
                  const iso = toIso(d);
                  const monday = d.getDay() === 1;
                  return <div key={iso} className={`shrink-0 py-1 text-center text-[10px] ${iso === today ? 'font-bold text-mab-rose-texte' : 'text-mab-gris'}`} style={{ width: dayW }}>{zoom === 'jours' ? format(d, 'd') : monday ? format(d, 'd') : ''}</div>;
                })}
              </div>
            </div>
          </div>
          {/* Grille de fond : week-ends et aujourd'hui */}
          <div className="pointer-events-none absolute bottom-0 top-[46px] z-0 flex" style={{ left: LABEL_W }}>
            {days.map((d) => <div key={toIso(d)} className={`h-full shrink-0 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-mab-wash' : ''} ${d.getDay() === 1 ? 'border-l border-mab-filet/70' : ''}`} style={{ width: dayW }} />)}
          </div>
          <div className="pointer-events-none absolute bottom-0 top-[46px] z-10 w-0.5 bg-mab-rose" style={{ left: LABEL_W + x(today) + dayW / 2 }} />

          {phases.map((ph) => {
            const list = tasks.filter((t) => phaseOf(t) === ph).sort((a, b) => (span(a)?.s ?? '9999') < (span(b)?.s ?? '9999') ? -1 : 1);
            if (!list.length) return null;
            const tone = toneOf(phases, ph);
            return (
              <Fragment key={ph}>
                <div className="relative z-10 flex border-b border-mab-filet bg-white/90">
                  <div className="sticky left-0 shrink-0 truncate bg-white px-4 py-2 text-sm font-semibold" style={{ width: LABEL_W }} title={ph}>{short(ph)}</div>
                </div>
                {list.map((t) => {
                  const sp = span(t);
                  const isDrag = drag?.id === t.id;
                  let s = sp?.s, en = sp?.e;
                  if (sp && isDrag && drag) {
                    const sh = (iso: string) => toIso(addDays(parseISO(iso), drag.delta));
                    if (drag.mode === 'move') { s = sh(sp.s); en = sh(sp.e); }
                    if (drag.mode === 'start') s = sh(sp.s) > sp.e ? sp.e : sh(sp.s);
                    if (drag.mode === 'end') en = sh(sp.e) < sp.s ? sp.s : sh(sp.e);
                  }
                  return (
                    <div key={t.id} className="group relative z-10 flex h-10 border-b border-mab-filet/60">
                      <button onClick={() => onEdit(t)} className="sticky left-0 z-20 flex shrink-0 items-center gap-2 truncate border-r border-mab-filet bg-white px-4 text-left text-sm hover:bg-mab-wash" style={{ width: LABEL_W }} title={t.title}>
                        <span className={`truncate ${isDone(t) ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}>{t.title}</span>
                      </button>
                      <div className="relative" style={{ width }}
                        onClick={(e) => {
                          if (sp || !canEdit) return;
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          place(t, toIso(addDays(range.from, Math.floor((e.clientX - rect.left) / dayW))));
                        }}>
                        {!sp && canEdit && <span className="pointer-events-none absolute inset-y-0 left-2 hidden items-center text-xs text-mab-gris-doux group-hover:flex" style={{ left: Math.max(8, x(today) - 40) }}>Clique sur un jour pour la placer</span>}
                        {s && en && (
                          <div
                            onPointerDown={(e) => startDrag(e, t, 'move')} onPointerMove={moveDrag} onPointerUp={() => endDrag(t)}
                            className={`absolute top-1.5 flex h-7 touch-none select-none items-center rounded-mab-etiquette px-2 text-xs font-medium text-mab-encre shadow-sm ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDone(t) ? 'opacity-50' : ''} ${isLate(t) ? 'ring-2 ring-mab-erreur/60' : ''}`}
                            style={{ left: x(s) + 2, width: Math.max(dayW - 4, (differenceInCalendarDays(parseISO(en), parseISO(s)) + 1) * dayW - 4), background: tone.bar }}
                            title={`${t.title} · ${fmtShort(s)}${s !== en ? ` → ${fmtShort(en)}` : ''}`}>
                            {canEdit && <span onPointerDown={(e) => startDrag(e, t, 'start')} onPointerMove={moveDrag} onPointerUp={() => endDrag(t)} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />}
                            <span className="truncate">{(differenceInCalendarDays(parseISO(en), parseISO(s)) + 1) * dayW > 70 ? t.title : ''}</span>
                            {canEdit && <span onPointerDown={(e) => startDrag(e, t, 'end')} onPointerMove={moveDrag} onPointerUp={() => endDrag(t)} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
      <p className="border-t border-mab-filet px-4 py-2.5 text-xs text-mab-gris-doux">
        {undated.length ? `${undated.length} tâche${undated.length > 1 ? 's' : ''} sans date. ` : ''}
        {canEdit ? 'Glisse une barre pour la déplacer, tire ses bords pour changer le début ou l’échéance ; sur une tâche sans date, clique sur un jour.' : ''}
      </p>
    </Card>
  );
}

/* ----------------------------------------------------------- Calendrier */

/** Mois en grille : chaque tâche à sa date d'échéance ; on la glisse sur un autre jour. */
export function CalendarView({ tasks, phases, phaseOf, onEdit, onNew, canEdit }: Common) {
  const { saveTask } = useStore();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [over, setOver] = useState<string | null>(null);
  const from = startOfWeek(month, { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = Array.from({ length: differenceInCalendarDays(to, from) + 1 }, (_, i) => addDays(from, i));
  const today = todayIso();
  const undated = tasks.filter((t) => !t.due_date).length;
  const drop = (iso: string, id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.due_date === iso) return;
    const d = t.due_date ? differenceInCalendarDays(parseISO(iso), parseISO(t.due_date)) : 0;
    saveTask({ id: t.id, title: t.title, due_date: iso, start_date: t.start_date && t.due_date ? toIso(addDays(parseISO(t.start_date), d)) : t.start_date ?? null });
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-mab-filet px-4 py-2.5">
        <IconButton label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={18} /></IconButton>
        <h3 className="min-w-[150px] text-center font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: fr })}</h3>
        <IconButton label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={18} /></IconButton>
        <Button variant="discret" onClick={() => setMonth(startOfMonth(new Date()))}>Aujourd’hui</Button>
        {undated > 0 && <span className="ml-auto text-xs text-mab-gris-doux">{undated} sans échéance</span>}
      </div>
      <div className="grid grid-cols-7 border-b border-mab-filet text-center text-xs font-medium text-mab-texte">
        {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const iso = toIso(d);
          const list = tasks.filter((t) => t.due_date === iso);
          return (
            <div key={iso}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(iso); } }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); drop(iso, e.dataTransfer.getData('text/plain')); }}
              onDoubleClick={() => canEdit && onNew({ due_date: iso })}
              className={`group min-h-[92px] border-b border-r border-mab-filet p-1 sm:min-h-[112px] sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${isSameMonth(d, month) ? '' : 'bg-mab-wash/70'} ${over === iso ? 'bg-mab-wash-2' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${iso === today ? 'bg-mab-rose font-semibold text-white' : isSameMonth(d, month) ? 'text-mab-encre' : 'text-mab-gris-doux'}`}>{format(d, 'd')}</span>
                {canEdit && <button aria-label={`Ajouter une tâche le ${format(d, 'd MMMM', { locale: fr })}`} onClick={() => onNew({ due_date: iso })} className="hidden h-6 w-6 place-items-center rounded-full text-mab-aqua-texte hover:bg-mab-wash-2 group-hover:grid"><Plus size={14} /></button>}
              </div>
              <div className="grid gap-1">
                {list.slice(0, 4).map((t) => {
                  const tone = toneOf(phases, phaseOf(t));
                  return (
                    <button key={t.id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => onEdit(t)}
                      className={`truncate rounded-mab-puce border px-1.5 py-0.5 text-left text-[11px] font-medium sm:text-xs ${tone.bg} ${tone.border} ${tone.text} ${isDone(t) ? 'line-through opacity-60' : ''}`} title={t.title}>
                      {t.title}
                    </button>
                  );
                })}
                {list.length > 4 && <span className="px-1 text-[11px] text-mab-texte">+{list.length - 4} autres</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- Tableau de bord */

/** Chiffres du projet : avancement, retard, par étape, par personne, rythme d'achèvement. */
export function DashboardView({ tasks, phases, phaseOf }: Common) {
  const { byId } = useStore();
  const done = tasks.filter(isDone).length;
  const late = tasks.filter(isLate).length;
  const subs = tasks.flatMap((t) => t.checklist);
  const subsDone = subs.filter((c) => c.done).length;
  const byPhase = phases.map((ph) => {
    const l = tasks.filter((t) => phaseOf(t) === ph);
    return { ph, total: l.length, done: l.filter(isDone).length, doing: l.filter((t) => t.status === 'en_cours').length, late: l.filter(isLate).length };
  }).filter((x) => x.total);
  const people = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    const ids = assigneesOf(t);
    for (const id of ids.length ? ids : ['']) { const p = people.get(id) ?? { total: 0, done: 0 }; p.total++; if (isDone(t)) p.done++; people.set(id, p); }
  }
  // Achèvement sur les 6 dernières semaines : tâches terminées chaque semaine.
  const weeks = Array.from({ length: 6 }, (_, i) => startOfWeek(addDays(new Date(), -7 * (5 - i)), { weekStartsOn: 1 }));
  const perWeek = weeks.map((w) => ({ w, n: tasks.filter((t) => t.done_at && differenceInCalendarDays(new Date(t.done_at), w) >= 0 && differenceInCalendarDays(new Date(t.done_at), w) < 7).length }));
  const maxWeek = Math.max(1, ...perWeek.map((x) => x.n));
  const maxPhase = Math.max(1, ...byPhase.map((x) => x.total));
  const maxPerson = Math.max(1, ...[...people.values()].map((x) => x.total));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tâches terminées" value={done} sub={`sur ${tasks.length}`} />
        <Kpi label="Restantes" value={tasks.length - done} sub={`${tasks.filter((t) => t.status === 'en_cours').length} en cours`} />
        <Kpi label="En retard" value={late} tone={late ? 'erreur' : undefined} sub={late ? 'échéance dépassée' : 'aucune'} />
        <Kpi label="Sous-tâches cochées" value={subs.length ? `${Math.round((subsDone / subs.length) * 100)} %` : '—'} sub={`${subsDone} sur ${subs.length}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-1 text-lg font-semibold">Avancement par étape</h3>
          <Legend />
          <div className="mt-3 grid gap-3">
            {byPhase.map((x) => (
              <div key={x.ph} title={`${short(x.ph)} : ${x.done} faites, ${x.doing} en cours, ${x.total - x.done - x.doing} à faire${x.late ? `, ${x.late} en retard` : ''}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-medium">{short(x.ph)}</span><span className="shrink-0 tabular-nums text-mab-texte"><b className="text-mab-encre">{x.done}</b> / {x.total}{x.late ? <span className="text-mab-erreur"> · {x.late} en retard</span> : null}</span></div>
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-mab-pilule bg-mab-rail" style={{ width: `${Math.max(12, (x.total / maxPhase) * 100)}%` }}>
                  <div className="h-full bg-mab-aqua" style={{ width: `${(x.done / x.total) * 100}%` }} />
                  <div className="h-full bg-mab-violet" style={{ width: `${(x.doing / x.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-1 text-lg font-semibold">Tâches par personne</h3>
          <Legend only />
          <div className="mt-3 grid gap-3">
            {[...people.entries()].sort((a, b) => b[1].total - a[1].total).map(([id, p]) => (
              <div key={id || 'personne'} title={`${byId.get(id)?.full_name ?? 'Personne'} : ${p.done} faites sur ${p.total}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-medium">{id ? byId.get(id)?.full_name ?? '—' : 'Non attribuées'}</span><span className="tabular-nums text-mab-texte"><b className="text-mab-encre">{p.done}</b> / {p.total}</span></div>
                <div className="h-2.5 overflow-hidden rounded-mab-pilule bg-mab-rail" style={{ width: `${Math.max(12, (p.total / maxPerson) * 100)}%` }}><div className="h-full bg-mab-aqua" style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="mb-3 text-lg font-semibold">Tâches terminées par semaine</h3>
        <div className="flex h-36 items-end gap-3" role="img" aria-label="Tâches terminées sur les six dernières semaines">
          {perWeek.map(({ w, n }) => (
            <div key={toIso(w)} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Semaine du ${format(w, 'd MMM', { locale: fr })} : ${n} tâche${n > 1 ? 's' : ''}`}>
              <span className="text-xs font-semibold tabular-nums text-mab-encre">{n || ''}</span>
              <div className="w-full max-w-[56px] rounded-t-[4px] bg-mab-aqua" style={{ height: `${(n / maxWeek) * 100}%`, minHeight: n ? 3 : 0 }} />
              <span className="text-[11px] text-mab-gris">{format(w, 'd MMM', { locale: fr })}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'erreur' }) {
  return (
    <Card className="px-4 py-4">
      <p className="text-sm text-mab-texte">{label}</p>
      <p className={`mt-1 text-[30px] font-light tabular-nums leading-tight ${tone === 'erreur' ? 'text-mab-erreur' : 'text-mab-encre'}`}>{value}</p>
      {sub && <p className="text-xs text-mab-gris">{sub}</p>}
    </Card>
  );
}

function Legend({ only }: { only?: boolean }) {
  return (
    <p className="flex gap-4 text-xs text-mab-texte">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-mab-aqua" />Faites</span>
      {!only && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-mab-violet" />En cours</span>}
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-mab-rail" />À faire</span>
    </p>
  );
}

