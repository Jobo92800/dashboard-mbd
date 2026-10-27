// Pilotage des missions d'un projet en « validation_mode » (ex. Franchise) :
// dépendances, livrable validé, points d'avancement (ex-T0.A) et journal des décisions (ex-T0.B).
import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, CircleDot, GitBranch, Link2, MessageSquareQuote, Plus, Scale, Search, Trash2, X } from 'lucide-react';
import type { DecisionEntry, DecisionKind, Project, Task, UpdateState } from '../lib/types';
import { DECISION_KINDS, LAUNCH_ORDERS, UPDATE_STATES } from '../lib/types';
import { useStore } from '../state/store';
import { isAdmin } from '../lib/permissions';
import { fmtStamp } from '../lib/dates';
import { Markdown } from '../lib/markdown';
import { Avatar, Badge, Button, Field, Input, Modal, Select, Textarea } from './ui';

/** « T1.A · Philosophie… » → « T1.A ». */
export const codeOf = (t: Task) => /^(T\d+\.[A-Z]+)\b/.exec(t.title)?.[1] ?? null;
export const isValidated = (t: Task) => !!t.validated_at;
/** Dépendances pas encore validées (ou faites, hors mode validation). */
export function openDeps(t: Task, all: Task[], strict: boolean) {
  return (t.depends_on ?? []).map((id) => all.find((x) => x.id === id)).filter((d): d is Task => !!d && !(strict ? isValidated(d) : d.status === 'fait'));
}
const stateOf = (id: UpdateState) => UPDATE_STATES.find((s) => s.id === id)!;
const kindOf = (id: DecisionKind) => DECISION_KINDS.find((k) => k.id === id)!;

function Section({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-mab-filet pt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 text-sm font-semibold text-mab-encre">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------ Blocs de la fiche mission */

export function MissionBlocks({ task, project, editable, onOpenTask }: { task: Task; project: Project; editable: boolean; onOpenTask?: (t: Task) => void }) {
  const { snap, me, byId, saveTask, validateDeliverable, unvalidateDeliverable, deleteTaskUpdate } = useStore();
  const [updating, setUpdating] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deciding, setDeciding] = useState<DecisionEntry | null>(null);
  const [picking, setPicking] = useState(false);
  const strict = !!project.validation_mode;
  const all = snap.tasks.filter((t) => t.project_id === project.id);
  const deps = (task.depends_on ?? []).map((id) => all.find((x) => x.id === id)).filter(Boolean) as Task[];
  const blocking = all.filter((t) => t.depends_on?.includes(task.id));
  const pending = openDeps(task, all, strict);
  const updates = snap.task_updates.filter((u) => u.task_id === task.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const decisions = snap.decisions_log.filter((d) => d.task_id === task.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const canValidate = isAdmin(me) || project.decider_id === me!.id;
  const proofOk = task.attachments.length > 0;
  const missing = [!task.deliverable?.trim() && 'le livrable', !task.deliverable_version?.trim() && 'la version', !proofOk && 'une preuve (fichier ou lien dans Pièces jointes)'].filter(Boolean) as string[];
  const save = (patch: Partial<Task>) => saveTask({ id: task.id, title: task.title, ...patch });

  const Chip = ({ t, onRemove }: { t: Task; onRemove?: () => void }) => {
    const ok = strict ? isValidated(t) : t.status === 'fait';
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-mab-pilule border border-mab-filet bg-white py-1 pl-2 pr-1.5 text-xs">
        {ok ? <CheckCircle2 size={13} className="shrink-0 text-mab-succes" /> : <CircleDot size={13} className="shrink-0 text-mab-gris" />}
        <button onClick={() => onOpenTask?.(t)} className="truncate font-medium hover:underline" title={t.title}>{codeOf(t) ?? t.title}</button>
        {onRemove && <button aria-label={`Retirer ${t.title}`} onClick={onRemove} className="rounded-full p-0.5 text-mab-gris hover:bg-mab-wash"><X size={12} /></button>}
      </span>
    );
  };

  return (
    <>
      {/* Lancement et dépendances */}
      <Section icon={<GitBranch size={16} className="text-mab-aqua-texte" />} title="Lancement et dépendances">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-mab-texte">Ordre de lancement :</span>
          {editable ? (
            <div className="inline-flex rounded-mab-pilule border border-mab-filet p-0.5">
              {LAUNCH_ORDERS.map((o) => (
                <button key={o.id} onClick={() => save({ launch_order: task.launch_order === o.id ? null : o.id })}
                  className={`rounded-mab-pilule px-3 py-1 text-xs font-medium ${task.launch_order === o.id ? 'bg-mab-encre text-white' : 'text-mab-texte hover:bg-mab-wash'}`}>{o.label}</button>
              ))}
            </div>
          ) : <b>{LAUNCH_ORDERS.find((o) => o.id === task.launch_order)?.label ?? '—'}</b>}
        </div>
        <p className="mb-1.5 text-xs font-medium text-mab-texte">Dépend de</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {deps.map((d) => <Chip key={d.id} t={d} onRemove={editable ? () => save({ depends_on: (task.depends_on ?? []).filter((x) => x !== d.id) }) : undefined} />)}
          {deps.length === 0 && <span className="text-sm text-mab-gris-doux">Aucune mission</span>}
          {editable && <button onClick={() => setPicking(true)} className="inline-flex h-7 items-center gap-1 rounded-mab-pilule border border-dashed border-mab-filet-aqua px-2.5 text-xs font-medium text-mab-aqua-texte hover:bg-mab-wash-2"><Plus size={13} /> Ajouter</button>}
        </div>
        {pending.length > 0 && task.status !== 'a_faire' && !isValidated(task) && (
          <p className="mt-2 flex items-start gap-1.5 rounded-mab-champ bg-mab-rose-wash px-3 py-2 text-xs text-mab-rose-texte">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{pending.map(codeOf).filter(Boolean).join(', ') || `${pending.length} mission(s)`} {pending.length > 1 ? 'ne sont' : 'n’est'} pas encore {strict ? 'validée' : 'terminée'}{pending.length > 1 ? 's' : ''} : avance en marquant les points en PROPOSITION ou À CONFIRMER.</span>
          </p>
        )}
        {blocking.length > 0 && (
          <>
            <p className="mb-1.5 mt-3 text-xs font-medium text-mab-texte">Débloque ensuite</p>
            <div className="flex flex-wrap gap-1.5">{blocking.map((b) => <Chip key={b.id} t={b} />)}</div>
          </>
        )}
      </Section>

      {/* Livrable et validation */}
      <Section icon={<BadgeCheck size={16} className="text-mab-aqua-texte" />} title="Livrable et validation">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_140px]">
          <Field label="Livrable attendu">
            <Input defaultValue={task.deliverable ?? ''} disabled={!editable} placeholder="Ex. Manuel §3.1-3.3"
              onBlur={(e) => e.target.value !== (task.deliverable ?? '') && save({ deliverable: e.target.value.trim() })} />
          </Field>
          <Field label="Version">
            <Input defaultValue={task.deliverable_version ?? ''} disabled={!editable} placeholder="V0.1"
              onBlur={(e) => e.target.value !== (task.deliverable_version ?? '') && save({ deliverable_version: e.target.value.trim() })} />
          </Field>
        </div>
        <div className="mt-3 rounded-mab-champ bg-mab-wash px-4 py-3 text-sm">
          {isValidated(task) ? (
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 size={18} className="text-mab-succes" />
              <span className="flex-1"><b>Validé</b> par {byId.get(task.validated_by ?? '')?.full_name ?? '—'} le {fmtStamp(task.validated_at!)}{task.deliverable_version ? ` · ${task.deliverable_version}` : ''}</span>
              {canValidate && <Button variant="discret" className="!h-8" onClick={() => unvalidateDeliverable(task)}>Retirer la validation</Button>}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-mab-texte">{missing.length ? <>Pour valider, il manque {missing.join(', ')}.</> : 'Livrable, version et preuve présents : prêt à valider.'}</span>
              {canValidate && <Button variant="secondaire" className="!h-9" disabled={missing.length > 0} onClick={() => validateDeliverable(task)}><BadgeCheck size={15} /> Valider le livrable</Button>}
            </div>
          )}
          {strict && <p className="mt-1.5 text-xs text-mab-gris-doux">Une mission n’est achevée qu’avec un livrable, une version, une preuve et une validation explicite.</p>}
        </div>
      </Section>

      {/* Points d'avancement */}
      <Section icon={<MessageSquareQuote size={16} className="text-mab-aqua-texte" />} title={`Points d’avancement${updates.length ? ` · ${updates.length}` : ''}`}
        action={editable && <Button variant="discret" className="!h-8" onClick={() => setUpdating(true)}><Plus size={14} /> Faire le point</Button>}>
        {updates.length === 0 && <p className="text-sm text-mab-gris-doux">Aucun point pour l’instant. Après un travail significatif, fais le point : statut, travail accompli, blocages et prochaine action.</p>}
        <div className="grid gap-2.5">
          {updates.slice(0, 5).map((u) => <UpdateCard key={u.id} u={u} canDelete={u.author_id === me!.id || isAdmin(me)} onDelete={() => deleteTaskUpdate(u.id)} />)}
          {updates.length > 5 && <p className="text-xs text-mab-gris-doux">+ {updates.length - 5} points plus anciens (onglet Suivi du projet).</p>}
        </div>
      </Section>

      {/* Décisions liées */}
      <Section icon={<Scale size={16} className="text-mab-aqua-texte" />} title={`Décisions${decisions.length ? ` · ${decisions.length}` : ''}`}
        action={<Button variant="discret" className="!h-8" onClick={() => setAsking(true)}><Plus size={14} /> Demander une décision</Button>}>
        {decisions.length === 0 && <p className="text-sm text-mab-gris-doux">Un choix à faire, un arbitrage ? Demande une décision{project.decider_id ? ` à ${byId.get(project.decider_id)?.full_name.split(' ')[0]}` : ''} : elle sera tracée dans le journal du projet.</p>}
        <div className="grid gap-2">{decisions.map((d) => <DecisionRow key={d.id} d={d} project={project} onDecide={() => setDeciding(d)} />)}</div>
      </Section>

      <UpdateModal open={updating} task={task} onClose={() => setUpdating(false)} />
      <DecisionModal open={asking} project={project} task={task} onClose={() => setAsking(false)} />
      {deciding && <DecideModal entry={deciding} onClose={() => setDeciding(null)} />}
      {picking && <DependencyPicker task={task} all={all} onClose={() => setPicking(false)} onSave={(ids) => save({ depends_on: ids })} />}
    </>
  );
}

function DependencyPicker({ task, all, onClose, onSave }: { task: Task; all: Task[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const [ids, setIds] = useState<string[]>(task.depends_on ?? []);
  // On évite les boucles : une mission qui dépend (même indirectement) de celle-ci n'est pas proposée.
  const after = useMemo(() => {
    const out = new Set<string>([task.id]);
    let grew = true;
    while (grew) { grew = false; for (const t of all) if (!out.has(t.id) && t.depends_on?.some((d) => out.has(d))) { out.add(t.id); grew = true; } }
    return out;
  }, [all, task.id]);
  const list = all.filter((t) => !after.has(t.id) && (!q || t.title.toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal open onClose={onClose} title="Cette mission dépend de…"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" onClick={() => { onSave(ids); onClose(); }}>Enregistrer</Button></>}>
      <label className="mb-3 flex items-center gap-2 rounded-mab-champ border border-mab-filet px-3">
        <Search size={15} className="text-mab-gris" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une mission (ex. T1.C)" className="h-10 flex-1 bg-transparent text-[16px] outline-none sm:text-sm" />
      </label>
      <div className="grid max-h-[50vh] gap-0.5 overflow-y-auto">
        {list.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-mab-etiquette px-2 py-1.5 text-sm hover:bg-mab-wash">
            <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={ids.includes(t.id)} onChange={() => setIds(ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id])} />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------ Points d'avancement */

export function UpdateCard({ u, canDelete, onDelete, task }: { u: import('../lib/types').TaskUpdate; canDelete: boolean; onDelete: () => void; task?: Task }) {
  const { byId } = useStore();
  const st = stateOf(u.state);
  const rows: [string, string][] = [['Travail accompli', u.done_text], ['Blocages', u.blockers], ['Arbitrages à faire', u.arbitrages], ['Prochaine action', u.next_action]];
  return (
    <div className="group rounded-mab-champ border border-mab-filet p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
        <Avatar p={byId.get(u.author_id)} size={24} />
        <b>{byId.get(u.author_id)?.full_name.split(' ')[0] ?? '—'}</b>
        <Badge tone={st.tone}>{st.label}</Badge>
        {u.version && <Badge>{u.version}</Badge>}
        {task && <span className="truncate text-xs font-medium text-mab-texte">{task.title}</span>}
        <span className="ml-auto text-xs text-mab-gris-doux">{fmtStamp(u.created_at)}</span>
        {canDelete && <button aria-label="Supprimer ce point" onClick={() => confirm('Supprimer ce point d’avancement ?') && onDelete()} className="hover-reveal rounded-full p-1 text-mab-gris opacity-0 hover:bg-mab-wash group-hover:opacity-100"><Trash2 size={13} /></button>}
      </div>
      <dl className="grid gap-1.5 text-sm">
        {rows.filter(([, v]) => v.trim()).map(([k, v]) => (
          <div key={k}><dt className={`text-xs font-semibold ${k === 'Blocages' ? 'text-mab-erreur' : 'text-mab-gris'}`}>{k}</dt><dd className="whitespace-pre-line text-mab-encre">{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function UpdateModal({ open, task, onClose }: { open: boolean; task: Task; onClose: () => void }) {
  const { addTaskUpdate } = useStore();
  const [f, setF] = useState({ state: 'en_cours' as UpdateState, version: '', done_text: '', blockers: '', arbitrages: '', next_action: '' });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  if (!open) return null;
  const close = () => { setF({ state: 'en_cours', version: '', done_text: '', blockers: '', arbitrages: '', next_action: '' }); onClose(); };
  return (
    <Modal open wide onClose={close} title={`Faire le point · ${codeOf(task) ?? task.title}`}
      footer={<><Button variant="tertiaire" onClick={close}>Annuler</Button><Button variant="primaire" disabled={!f.done_text.trim() && !f.next_action.trim()} onClick={async () => { await addTaskUpdate(task, f); close(); }}>Enregistrer le point</Button></>}>
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Statut de la mission</p>
          <div className="flex flex-wrap gap-1.5">
            {UPDATE_STATES.map((s) => (
              <button key={s.id} onClick={() => set({ state: s.id })} className={`rounded-mab-pilule border px-3 py-1.5 text-sm font-medium ${f.state === s.id ? 'border-mab-encre bg-mab-encre text-white' : 'border-mab-filet text-mab-texte hover:bg-mab-wash'}`}>{s.label}</button>
            ))}
          </div>
        </div>
        <Field label="Livrable / version" help={task.deliverable ? `Livrable attendu : ${task.deliverable}` : undefined}>
          <Input value={f.version} onChange={(e) => set({ version: e.target.value })} placeholder={task.deliverable_version || 'Ex. V0.1'} />
        </Field>
        <Field label="Travail accompli"><Textarea rows={3} value={f.done_text} onChange={(e) => set({ done_text: e.target.value })} placeholder="Ce qui a été produit depuis le dernier point" /></Field>
        <Field label="Blocages"><Textarea rows={2} value={f.blockers} onChange={(e) => set({ blockers: e.target.value })} placeholder="Ce qui empêche d’avancer (information manquante, attente d’un fournisseur…)" /></Field>
        <Field label="Arbitrages à faire" help="Pour une vraie décision de direction, utilise plutôt « Demander une décision » : elle sera tracée dans le journal."><Textarea rows={2} value={f.arbitrages} onChange={(e) => set({ arbitrages: e.target.value })} /></Field>
        <Field label="Prochaine action"><Input value={f.next_action} onChange={(e) => set({ next_action: e.target.value })} placeholder="Qui fait quoi, et pour quand" /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------ Journal des décisions */

export function DecisionRow({ d, project, onDecide, onOpenTask }: { d: DecisionEntry; project: Project; onDecide: () => void; onOpenTask?: (t: Task) => void }) {
  const { snap, me, byId, deleteDecisionEntry } = useStore();
  const [open, setOpen] = useState(d.kind === 'a_decider');
  const k = kindOf(d.kind);
  const task = d.task_id ? snap.tasks.find((t) => t.id === d.task_id) : undefined;
  const canDecide = d.kind === 'a_decider' && (project.decider_id === me!.id || isAdmin(me));
  return (
    <div className={`rounded-mab-champ border p-3.5 ${d.kind === 'a_decider' ? 'border-mab-filet-rose bg-mab-rose-wash/50' : 'border-mab-filet'}`}>
      <div className="flex flex-wrap items-start gap-2">
        <Badge tone={k.tone}>{k.label}</Badge>
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left text-sm font-semibold text-mab-encre hover:underline">{d.title}</button>
        {task && <button onClick={() => onOpenTask?.(task)} className="inline-flex items-center gap-1 text-xs font-medium text-mab-aqua-texte hover:underline"><Link2 size={12} />{codeOf(task) ?? 'Mission'}</button>}
      </div>
      <p className="mt-1 text-xs text-mab-gris-doux">
        {d.author_id ? `${byId.get(d.author_id)?.full_name.split(' ')[0] ?? '—'} · ` : ''}{fmtStamp(d.created_at)}
        {d.decided_at && ` · tranché par ${byId.get(d.decided_by ?? '')?.full_name.split(' ')[0] ?? '—'} le ${fmtStamp(d.decided_at)}`}
        {d.changes_roadmap && ' · modifie la roadmap'}
      </p>
      {open && (
        <div className="mt-2.5 grid gap-2 text-sm">
          {d.context && <div><p className="text-xs font-semibold text-mab-gris">Contexte</p><Markdown text={d.context} /></div>}
          {d.options && <div><p className="text-xs font-semibold text-mab-gris">Options</p><Markdown text={d.options} /></div>}
          {d.decision && <div className="rounded-mab-etiquette bg-white px-3 py-2"><p className="text-xs font-semibold text-mab-succes">{d.kind === 'rejete' ? 'Écarté' : 'Décision'}</p><Markdown text={d.decision} /></div>}
          {d.consequences && <div><p className="text-xs font-semibold text-mab-gris">Conséquences</p><Markdown text={d.consequences} /></div>}
          <div className="flex flex-wrap gap-2">
            {canDecide && <Button variant="primaire" className="!h-9" onClick={onDecide}><Scale size={15} /> Trancher</Button>}
            {(d.author_id === me!.id || isAdmin(me)) && <Button variant="discret" className="!h-9" onClick={() => confirm('Supprimer cette entrée du journal ?') && deleteDecisionEntry(d.id)}><Trash2 size={14} /> Supprimer</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionModal({ open, project, task, onClose }: { open: boolean; project: Project; task?: Task; onClose: () => void }) {
  const { snap, byId, saveDecisionEntry } = useStore();
  const empty = { kind: 'a_decider' as DecisionKind, title: '', context: '', options: '', task_id: task?.id ?? '' };
  const [f, setF] = useState(empty);
  if (!open) return null;
  const close = () => { setF(empty); onClose(); };
  const decider = project.decider_id ? byId.get(project.decider_id)?.full_name.split(' ')[0] : null;
  const missions = snap.tasks.filter((t) => t.project_id === project.id).sort((a, b) => (a.title < b.title ? -1 : 1));
  return (
    <Modal open wide onClose={close} title={f.kind === 'a_decider' ? `Demander une décision${decider ? ` à ${decider}` : ''}` : 'Ajouter au journal'}
      footer={<><Button variant="tertiaire" onClick={close}>Annuler</Button><Button variant="primaire" disabled={!f.title.trim()} onClick={async () => { await saveDecisionEntry({ project_id: project.id, ...f, title: f.title.trim(), task_id: f.task_id || null }); close(); }}>{f.kind === 'a_decider' ? 'Envoyer la demande' : 'Ajouter'}</Button></>}>
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Type</p>
          <div className="flex flex-wrap gap-1.5">
            {DECISION_KINDS.filter((k) => k.id !== 'rejete').map((k) => (
              <button key={k.id} title={k.help} onClick={() => setF({ ...f, kind: k.id })} className={`rounded-mab-pilule border px-3 py-1.5 text-sm font-medium ${f.kind === k.id ? 'border-mab-encre bg-mab-encre text-white' : 'border-mab-filet text-mab-texte hover:bg-mab-wash'}`}>{k.label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-mab-texte">{kindOf(f.kind).help}.</p>
        </div>
        <Field label={f.kind === 'a_decider' ? 'Ce qu’il faut décider' : 'Intitulé'}><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.kind === 'a_decider' ? 'Ex. Durée de la formation initiale des franchisés' : ''} /></Field>
        <Field label="Mission concernée">
          <Select value={f.task_id} onChange={(e) => setF({ ...f, task_id: e.target.value })}>
            <option value="">Aucune (projet en général)</option>
            {missions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </Field>
        <Field label="Contexte"><Textarea rows={3} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} placeholder="Pourquoi la question se pose, ce qu’on sait déjà" /></Field>
        {f.kind === 'a_decider' && (
          <Field label="Options possibles" help="Une option par ligne avec ses avantages et risques, ex. « - Option 1 : 5 jours (+ complet / − coût) »">
            <Textarea rows={4} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function DecideModal({ entry, onClose }: { entry: DecisionEntry; onClose: () => void }) {
  const { decide } = useStore();
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');
  const [roadmap, setRoadmap] = useState(false);
  const submit = async (accepted: boolean) => { await decide(entry, { decision: decision.trim(), consequences: consequences.trim(), changes_roadmap: roadmap, accepted }); onClose(); };
  return (
    <Modal open wide onClose={onClose} title="Trancher"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button disabled={!decision.trim()} onClick={() => submit(false)}>Écarter</Button><Button variant="primaire" disabled={!decision.trim()} onClick={() => submit(true)}><Scale size={15} /> Valider la décision</Button></>}>
      <div className="grid gap-4">
        <div className="rounded-mab-champ bg-mab-wash px-4 py-3 text-sm">
          <p className="font-semibold">{entry.title}</p>
          {entry.options && <div className="mt-1.5"><Markdown text={entry.options} /></div>}
        </div>
        <Field label="Décision" help="Ex. « Je valide l’option 2. Cette décision devient la référence officielle du projet. »"><Textarea autoFocus rows={3} value={decision} onChange={(e) => setDecision(e.target.value)} /></Field>
        <Field label="Conséquences et points qui restent à confirmer"><Textarea rows={2} value={consequences} onChange={(e) => setConsequences(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roadmap} onChange={(e) => setRoadmap(e.target.checked)} className="accent-mab-aqua" /> Cette décision modifie la roadmap (la coordination est prévenue)</label>
      </div>
    </Modal>
  );
}
