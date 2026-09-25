import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, FileText, ListChecks, Pencil, Plus, Send, Trash2, Users, Video } from 'lucide-react';
import type { CalEvent, Decision } from '../lib/types';
import { useStore } from '../state/store';
import { canEditEvent, isAdmin } from '../lib/permissions';
import { fmtLong, fmtStamp, todayIso } from '../lib/dates';
import { Markdown } from '../lib/markdown';
import { visioProvider } from '../lib/visio';
import { uid } from '../data/backend';
import { isDone } from '../lib/selectors';
import { ActionMenu, Avatar, Badge, Button, IconButton, Input, Modal, Textarea } from './ui';
import { PresenceDot } from './Presence';
import { fmtDur } from './EventModal';

/** Carte d'un rendez-vous : infos, bouton visio, compte rendu et décisions. */
export function EventSheet({ event, onClose, onEdit, onOpenTask }: {
  event: CalEvent; onClose: () => void; onEdit: () => void; onOpenTask: (taskId: string) => void;
}) {
  const { snap, me, byId, saveMinutes, shareMinutes, deleteEvent } = useStore();
  const [notes, setNotes] = useState(event.minutes);
  const [editingNotes, setEditingNotes] = useState(false);
  const [newDecision, setNewDecision] = useState('');
  const [converting, setConverting] = useState<Decision | null>(null);
  useEffect(() => { if (!editingNotes) setNotes(event.minutes); }, [event.minutes, editingNotes]);

  const people = [...new Set([event.created_by ?? '', ...event.participant_ids])].map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  const organizer = canEditEvent(me!, event);
  const canWrite = organizer || isAdmin(me) || event.participant_ids.includes(me!.id);
  const past = event.date < todayIso();
  const provider = visioProvider(event.visio_url);
  const author = byId.get(event.minutes_by ?? '');

  const saveNotes = () => { setEditingNotes(false); if (notes !== event.minutes) saveMinutes(event, { minutes: notes }, 'Compte rendu enregistré'); };
  const addDecision = () => {
    const text = newDecision.trim();
    if (!text) return;
    saveMinutes(event, { decisions: [...event.decisions, { id: uid(), text, task_id: null }] });
    setNewDecision('');
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={event.kind}
      footer={
        <>
          {organizer && (
            <ActionMenu className="mr-auto" actions={[{ label: 'Supprimer le rendez-vous', icon: Trash2, danger: true, onClick: () => { if (confirm('Supprimer ce rendez-vous ? Les participants seront prévenus.')) { onClose(); deleteEvent(event); } } }]} />
          )}
          {organizer && <Button onClick={onEdit}><Pencil size={15} /> Modifier</Button>}
          {canWrite && (event.minutes.trim() || event.decisions.length > 0) && (
            <Button variant="secondaire" onClick={() => shareMinutes(event)}><Send size={15} /> Partager le compte rendu</Button>
          )}
          {!canWrite && <Button variant="tertiaire" onClick={onClose}>Fermer</Button>}
        </>
      }
    >
      <div className="grid gap-5">
        <div>
          <h2 className="text-[26px] font-light leading-tight tracking-tight text-mab-encre sm:text-[30px]">{event.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mab-texte">
            <span className="inline-flex items-center gap-1.5 capitalize"><CalendarDays size={15} className="text-mab-aqua-texte" /> {fmtLong(event.date)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-mab-aqua-texte" /> {event.time} · {fmtDur(event.duration_min)}</span>
            {past && <Badge>Passé</Badge>}
          </p>
        </div>

        {event.visio_url && (
          <a href={event.visio_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-mab-champ bg-mab-aqua-encre px-4 py-3 text-white transition hover:bg-mab-aqua-texte">
            <Video size={20} />
            <span className="flex-1"><b className="block">Rejoindre la visio</b><span className="text-xs text-mab-profond-texte">{provider} · {event.visio_url.replace(/^https?:\/\//, '').slice(0, 40)}</span></span>
          </a>
        )}

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-mab-aqua-texte" /> Participants · {people.length}</p>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <span key={p.id} className="flex items-center gap-2 rounded-mab-pilule border border-mab-filet py-1 pl-1 pr-3 text-sm">
                <span className="relative"><Avatar p={p} size={24} /><PresenceDot p={p} size={8} className="absolute -bottom-0.5 -right-0.5" /></span>
                {p.id === me!.id ? 'Moi' : p.full_name.split(' ')[0]}{p.id === event.created_by && <span className="text-[10px] text-mab-gris-doux">organisateur</span>}
              </span>
            ))}
          </div>
        </div>

        {event.note && <div className="rounded-mab-champ bg-mab-wash px-4 py-3 text-sm"><Markdown text={event.note} /></div>}

        {/* Compte rendu */}
        <section className="border-t border-mab-filet pt-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={16} className="text-mab-aqua-texte" />
            <h3 className="flex-1 text-sm font-semibold">Compte rendu</h3>
            {canWrite && !editingNotes && <Button variant="discret" className="!h-8" onClick={() => setEditingNotes(true)}><Pencil size={14} /> {event.minutes.trim() ? 'Modifier' : 'Rédiger'}</Button>}
          </div>
          {editingNotes ? (
            <div className="grid gap-2">
              <Textarea autoFocus rows={8} value={notes} onChange={(x) => setNotes(x.target.value)} placeholder={'## Points abordés\n- …\n\n## À retenir\n- …'} className="font-mono !text-sm" />
              <div className="flex justify-end gap-2">
                <Button variant="tertiaire" onClick={() => { setNotes(event.minutes); setEditingNotes(false); }}>Annuler</Button>
                <Button variant="secondaire" onClick={saveNotes}><Check size={15} /> Enregistrer</Button>
              </div>
            </div>
          ) : event.minutes.trim() ? (
            <div className="rounded-mab-champ border border-mab-filet px-4 py-3"><Markdown text={event.minutes} /></div>
          ) : (
            <p className="text-sm text-mab-gris-doux">{canWrite ? 'Pas encore de compte rendu.' : 'Pas de compte rendu pour l’instant.'}</p>
          )}
          {author && event.minutes_updated_at && <p className="mt-1.5 text-xs text-mab-gris-doux">Mis à jour par {author.full_name} le {fmtStamp(event.minutes_updated_at)}</p>}
        </section>

        {/* Décisions */}
        <section className="border-t border-mab-filet pt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ListChecks size={16} className="text-mab-aqua-texte" /> Décisions · {event.decisions.length}</p>
          <div className="grid gap-2">
            {event.decisions.map((d) => {
              const task = d.task_id ? snap.tasks.find((t) => t.id === d.task_id) : undefined;
              return (
                <div key={d.id} className="group flex flex-wrap items-center gap-2 rounded-mab-champ border border-mab-filet px-3 py-2.5">
                  <span className={`min-w-0 flex-1 text-[15px] ${task && isDone(task) ? 'text-mab-gris-doux line-through' : ''}`}>{d.text}</span>
                  {task ? (
                    <button onClick={() => onOpenTask(task.id)} className="inline-flex items-center gap-1.5 rounded-mab-pilule bg-mab-wash-2 px-2.5 py-1 text-xs font-medium text-mab-aqua-texte hover:underline">
                      {isDone(task) ? '✓ Tâche faite' : 'Tâche créée'}
                      <span className="flex -space-x-1.5">{(task.assignee_ids?.length ? task.assignee_ids : [task.assignee_id]).filter(Boolean).slice(0, 3).map((id) => <Avatar key={id!} p={byId.get(id!)} size={18} ring />)}</span>
                    </button>
                  ) : d.task_id ? (
                    <span className="text-xs text-mab-gris-doux">Tâche supprimée</span>
                  ) : canWrite ? (
                    <Button variant="secondaire" className="!h-8 !px-3" onClick={() => setConverting(d)}><Plus size={14} /> En faire une tâche</Button>
                  ) : null}
                  {canWrite && !task && (
                    <IconButton label="Retirer la décision" className="hover-reveal !h-7 !w-7 opacity-0 group-hover:opacity-100" onClick={() => saveMinutes(event, { decisions: event.decisions.filter((x) => x.id !== d.id) })}>
                      <Trash2 size={13} />
                    </IconButton>
                  )}
                </div>
              );
            })}
            {event.decisions.length === 0 && !canWrite && <p className="text-sm text-mab-gris-doux">Aucune décision notée.</p>}
          </div>
          {canWrite && (
            <div className="mt-2 flex gap-2">
              <Input value={newDecision} onChange={(x) => setNewDecision(x.target.value)} onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); addDecision(); } }} placeholder="Ajouter une décision (Entrée)" className="!h-10 !text-sm" />
              <Button variant="discret" className="!h-10" disabled={!newDecision.trim()} onClick={addDecision}><Plus size={15} /> Ajouter</Button>
            </div>
          )}
        </section>
      </div>

      {converting && <DecisionTask event={event} decision={converting} onClose={() => setConverting(null)} />}
    </Modal>
  );
}

/** « En faire une tâche » : pour qui et pour quand, en un clic. */
function DecisionTask({ event, decision, onClose }: { event: CalEvent; decision: Decision; onClose: () => void }) {
  const { snap, me, decisionToTask } = useStore();
  const [who, setWho] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const people = [...new Set([event.created_by ?? '', ...event.participant_ids])].filter(Boolean);
  const others = snap.profiles.filter((p) => p.active && !people.includes(p.id));
  const list = [...people.map((id) => snap.profiles.find((p) => p.id === id)).filter(Boolean), ...others] as typeof snap.profiles;
  const submit = async () => { setBusy(true); await decisionToTask(event, decision, { assignees: who, due: due || null }); setBusy(false); onClose(); };
  return (
    <Modal
      open
      onClose={onClose}
      title="En faire une tâche"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!who.length || busy} onClick={submit}>{who.length > 1 ? `Partager entre ${who.length} personnes` : 'Créer la tâche'}</Button></>}
    >
      <div className="grid gap-4">
        <p className="rounded-mab-champ bg-mab-wash px-4 py-3 text-[15px]">{decision.text}</p>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Pour qui ?</span>
          <div className="flex flex-wrap gap-2">
            {list.map((p) => {
              const on = who.includes(p.id);
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setWho((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                  className={`flex items-center gap-2 rounded-mab-pilule border py-1 pl-1 pr-3 text-sm transition ${on ? 'border-mab-aqua bg-mab-wash-2 text-mab-encre' : 'border-mab-filet bg-white text-mab-texte hover:border-mab-filet-aqua'}`}>
                  <Avatar p={p} size={24} /> {p.id === me!.id ? 'Moi' : p.full_name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Pour quand ?</span>
          <Input type="date" value={due} onChange={(x) => setDue(x.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
