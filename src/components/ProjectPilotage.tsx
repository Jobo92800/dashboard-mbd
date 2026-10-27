// Vues « Aperçu », « Suivi » et « Décisions » d'un projet piloté par missions.
import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Hourglass, Plus, Printer } from 'lucide-react';
import type { DecisionKind, Project, Task } from '../lib/types';
import { DECISION_KINDS, LAUNCH_ORDERS } from '../lib/types';
import { useStore } from '../state/store';
import { Markdown } from '../lib/markdown';
import { assigneesOf } from '../lib/assignees';
import { fmtShort } from '../lib/dates';
import { isLate } from '../lib/selectors';
import { Avatar, Badge, Button, Card, Surtitre } from './ui';
import { codeOf, DecideModal, DecisionModal, DecisionRow, isValidated, openDeps, UpdateCard } from './MissionPanels';
import type { DecisionEntry } from '../lib/types';

type P = { project: Project; tasks: Task[]; phases: string[]; phaseOf: (t: Task) => string; onEdit: (t: Task) => void };
const short = (ph: string) => ph.replace(/^\d+\s*·\s*/, '');
const LAUNCH_RANK = { maintenant: 0, ensuite: 1, plus_tard: 2 } as const;
const byLaunch = (a: Task, b: Task) => (LAUNCH_RANK[a.launch_order ?? 'plus_tard'] - LAUNCH_RANK[b.launch_order ?? 'plus_tard']) || (a.created_at < b.created_at ? -1 : 1);

/** Progression officielle : seules les missions au livrable validé comptent. */
export function OfficialProgress({ tasks }: { tasks: Task[] }) {
  const ok = tasks.filter(isValidated).length;
  const pct = tasks.length ? Math.round((ok / tasks.length) * 100) : 0;
  return (
    <div title={`${ok} mission${ok > 1 ? 's' : ''} validée${ok > 1 ? 's' : ''} sur ${tasks.length}`}>
      <div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="font-medium text-mab-encre">Progression officielle</span><span className="tabular-nums text-mab-texte"><b className="text-mab-encre">{pct} %</b> · {ok} / {tasks.length} validées</span></div>
      <div className="h-2 overflow-hidden rounded-mab-pilule bg-mab-rail"><div className="h-full rounded-mab-pilule bg-mab-succes" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ------------------------------------------------------------- Aperçu */

export function OverviewView({ project, tasks, phases, phaseOf, onEdit }: P) {
  const { byId } = useStore();
  const people = [...new Set(tasks.flatMap(assigneesOf))].map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  const [person, setPerson] = useState<string>('');
  const shown = person ? people.filter((p) => p.id === person) : people;
  return (
    <div className="grid gap-4">
      <Card className="p-5"><OfficialProgress tasks={tasks} /></Card>

      <Card className="p-5">
        <Surtitre>Familles de missions</Surtitre>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {phases.map((ph) => {
            const l = tasks.filter((t) => phaseOf(t) === ph);
            if (!l.length) return null;
            const ok = l.filter(isValidated).length;
            return (
              <div key={ph} className="rounded-mab-champ border border-mab-filet px-3.5 py-2.5">
                <p className="truncate text-sm font-semibold" title={ph}>{short(ph)}</p>
                <p className="text-xs text-mab-texte">{l.length} missions · {ok} validée{ok > 1 ? 's' : ''} · {l.filter((t) => t.status === 'en_cours').length} en cours</p>
              </div>
            );
          })}
        </div>
      </Card>

      {project.description.trim() && (
        <Card className="p-5 sm:p-6">
          <Surtitre>Guide du projet</Surtitre>
          <div className="mt-2 max-w-mab-texte"><Markdown text={project.description} /></div>
        </Card>
      )}

      <Card className="p-5 print:shadow-none">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex-1"><Surtitre>Fiches individuelles</Surtitre><h3 className="mt-1 text-lg font-semibold">Qui fait quoi, et dans quel ordre</h3></div>
          <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-9 rounded-mab-pilule border border-mab-filet bg-white px-3 text-sm print:hidden">
            <option value="">Toute l’équipe</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <Button variant="discret" className="!h-9 print:hidden" onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>
        </div>
        <div className="grid gap-5">
          {shown.map((p) => {
            const mine = tasks.filter((t) => assigneesOf(t).includes(p.id)).sort(byLaunch);
            const first = mine.filter((t) => t.launch_order === 'maintenant' && !isValidated(t));
            return (
              <div key={p.id} className="break-inside-avoid rounded-mab-champ border border-mab-filet p-4">
                <div className="mb-2 flex items-center gap-2.5"><Avatar p={p} size={32} /><b className="text-[15px]">{p.full_name}</b><span className="text-sm text-mab-texte">· {mine.length} missions</span></div>
                {first.length > 0 && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-mab-rose-texte">À ouvrir en premier</p>}
                <ol className="mb-2 grid gap-1">{first.map((t, i) => <li key={t.id}><button onClick={() => onEdit(t)} className="text-left text-sm hover:underline">{i + 1}. <b>{t.title}</b>{t.deliverable && <span className="text-mab-texte"> · {t.deliverable}</span>}</button></li>)}</ol>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-mab-gris">Toutes ses missions</p>
                <ul className="grid gap-0.5">
                  {mine.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <button onClick={() => onEdit(t)} className="text-left hover:underline">{t.title}</button>
                      <span className="text-xs text-mab-gris">{LAUNCH_ORDERS.find((o) => o.id === t.launch_order)?.label ?? ''}{t.due_date ? ` · ${fmtShort(t.due_date)}` : ''}</span>
                      {isValidated(t) ? <Badge tone="succes">Validée</Badge> : t.status === 'en_cours' ? <Badge tone="violet">En cours</Badge> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Suivi */

/** Le tableau de suivi de la coordination (ex-T0.A) : où en est chaque mission. */
export function FollowView({ project, tasks, onEdit }: P) {
  const { snap, me, deleteTaskUpdate } = useStore();
  const strict = !!project.validation_mode;
  const ids = new Set(tasks.map((t) => t.id));
  const updates = snap.task_updates.filter((u) => ids.has(u.task_id)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const last = (t: Task) => updates.find((u) => u.task_id === t.id);
  const blocked = tasks.filter((t) => last(t)?.state === 'bloquee' && !isValidated(t));
  const toValidate = tasks.filter((t) => !isValidated(t) && (last(t)?.state === 'en_validation' || last(t)?.state === 'terminee'));
  const running = tasks.filter((t) => t.status === 'en_cours' && !isValidated(t));
  const silent = running.filter((t) => { const u = last(t); return !u || Date.now() - new Date(u.created_at).getTime() > 7 * 86_400_000; });
  const starting = tasks.filter((t) => t.status === 'a_faire' && t.launch_order === 'maintenant');
  const List = ({ title, icon, list, empty, tone, deps = true }: { title: string; icon: React.ReactNode; list: Task[]; empty: string; tone?: string; deps?: boolean }) => (
    <Card className="p-4">
      <h3 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${tone ?? ''}`}>{icon}{title} · {list.length}</h3>
      {list.length === 0 ? <p className="text-sm text-mab-gris-doux">{empty}</p> : (
        <ul className="grid gap-1">
          {list.map((t) => {
            const dep = deps ? openDeps(t, tasks, strict) : [];
            return <li key={t.id} className="text-sm"><button onClick={() => onEdit(t)} className="text-left hover:underline">{t.title}</button>{dep.length > 0 && <span className="ml-1.5 text-xs text-mab-rose-texte">attend {dep.map(codeOf).filter(Boolean).join(', ')}</span>}{isLate(t) && <span className="ml-1.5 text-xs font-semibold text-mab-erreur">en retard</span>}</li>;
          })}
        </ul>
      )}
    </Card>
  );
  return (
    <div className="grid gap-4">
      <Card className="p-5"><OfficialProgress tasks={tasks} /></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Bloquées" icon={<AlertTriangle size={15} />} tone="text-mab-erreur" list={blocked} empty="Aucune mission bloquée." />
        <List title="Livrable prêt, à valider" icon={<BadgeCheck size={15} className="text-mab-succes" />} list={toValidate} empty="Rien en attente de validation." />
        <List title="En cours sans point depuis 7 jours" icon={<Hourglass size={15} className="text-mab-violet-texte" />} list={silent} empty="Toutes les missions en cours ont un point récent." />
        <List title="À lancer maintenant" icon={<Plus size={15} className="text-mab-aqua-texte" />} list={starting} deps={false} empty="Tout ce qui devait partir maintenant est lancé." />
      </div>
      <Card className="p-5">
        <Surtitre>Fil de suivi</Surtitre>
        <h3 className="mb-3 mt-1 text-lg font-semibold">Derniers points d’avancement</h3>
        {updates.length === 0 && <p className="text-sm text-mab-gris-doux">Aucun point encore. Dans une mission : « Faire le point » après un travail significatif.</p>}
        <div className="grid gap-2.5">
          {updates.slice(0, 40).map((u) => {
            const t = tasks.find((x) => x.id === u.task_id)!;
            return <button key={u.id} className="text-left" onClick={() => onEdit(t)}><UpdateCard u={u} task={t} canDelete={u.author_id === me!.id} onDelete={() => deleteTaskUpdate(u.id)} /></button>;
          })}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Décisions */

/** Journal des décisions (ex-T0.B) : demandes à trancher, puis tout l'historique. */
export function DecisionsView({ project, onEdit }: P) {
  const { snap, byId } = useStore();
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState<DecisionEntry | null>(null);
  const [kind, setKind] = useState<DecisionKind | ''>('');
  const all = snap.decisions_log.filter((d) => d.project_id === project.id).sort((a, b) => ((a.decided_at ?? a.created_at) < (b.decided_at ?? b.created_at) ? 1 : -1));
  const pending = all.filter((d) => d.kind === 'a_decider');
  const rest = all.filter((d) => d.kind !== 'a_decider' && (!kind || d.kind === kind));
  const decider = project.decider_id ? byId.get(project.decider_id) : null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-mab-texte">Les missions travaillent, {decider ? <b>{decider.full_name.split(' ')[0]}</b> : 'la direction'} décide, le suivi est mis à jour. Rien n’est une décision tant qu’il n’est pas validé ici.</p>
        <Button variant="primaire" onClick={() => setAdding(true)}><Plus size={16} /> Nouvelle entrée</Button>
      </div>
      <Card className="p-5">
        <h3 className="mb-3 text-lg font-semibold">À décider · {pending.length}</h3>
        {pending.length === 0 ? <p className="text-sm text-mab-gris-doux">Aucune décision en attente.</p> : <div className="grid gap-2">{pending.map((d) => <DecisionRow key={d.id} d={d} project={project} onDecide={() => setDeciding(d)} onOpenTask={onEdit} />)}</div>}
      </Card>
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-lg font-semibold">Journal</h3>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setKind('')} className={`rounded-mab-pilule px-2.5 py-1 text-xs font-medium ${!kind ? 'bg-mab-encre text-white' : 'text-mab-texte ring-1 ring-mab-filet'}`}>Tout</button>
            {DECISION_KINDS.filter((k) => k.id !== 'a_decider').map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} title={k.help} className={`rounded-mab-pilule px-2.5 py-1 text-xs font-medium ${kind === k.id ? 'bg-mab-encre text-white' : 'text-mab-texte ring-1 ring-mab-filet'}`}>{k.label}</button>
            ))}
          </div>
        </div>
        {rest.length === 0 ? <p className="text-sm text-mab-gris-doux">Rien pour l’instant.</p> : <div className="grid gap-2">{rest.map((d) => <DecisionRow key={d.id} d={d} project={project} onDecide={() => setDeciding(d)} onOpenTask={onEdit} />)}</div>}
      </Card>
      <DecisionModal open={adding} project={project} onClose={() => setAdding(false)} />
      {deciding && <DecideModal entry={deciding} onClose={() => setDeciding(null)} />}
    </div>
  );
}
