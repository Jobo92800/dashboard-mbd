import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, eachDayOfInterval, format, isWeekend, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, ChevronLeft, ChevronRight, Palmtree, Trash2, X } from 'lucide-react';
import { useStore } from '../state/store';
import type { Absence } from '../lib/types';
import { ABSENCE_KINDS } from '../lib/types';
import { toIso, todayIso } from '../lib/dates';
import { isAdmin } from '../lib/permissions';
import { absenceKind, absenceRange, absencesBetween } from '../lib/absences';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Input, Modal, PageTitle, Select, Textarea } from '../components/ui';

export const KIND_COLOR: Record<string, string> = {
  'Congés': '#3bbfbf', Formation: '#8e6fc6', 'Déplacement': '#3d6e93', Maladie: '#9babab', Absence: '#9babab', Autre: '#8e3c80',
};

export default function Absences() {
  const { snap, me, byId, decideAbsence, deleteAbsence } = useStore();
  const [draft, setDraft] = useState<Partial<Absence> | null>(null);
  const [week0, setWeek0] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const admin = isAdmin(me);
  const today = todayIso();

  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const weeks = narrow ? 2 : 6;
  const days = eachDayOfInterval({ start: week0, end: addDays(addWeeks(week0, weeks), -1) }).filter((d) => !isWeekend(d));
  const from = toIso(days[0]);
  const to = toIso(days[days.length - 1]);
  const people = snap.profiles.filter((p) => p.active);
  const inRange = absencesBetween(snap.absences, from, to);
  const pending = snap.absences.filter((a) => a.status === 'en_attente').sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const upcoming = snap.absences.filter((a) => a.status !== 'refusee' && a.end_date >= today).sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const mine = snap.absences.filter((a) => a.user_id === me!.id).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));

  return (
    <>
      <PageTitle title={<>Absences & <b>congés</b></>} sub="Qui est là, qui ne l’est pas. Les absences apparaissent dans l’agenda, et l’appli prévient avant de confier une tâche à quelqu’un d’absent.">
        <Button variant="primaire" onClick={() => setDraft({ user_id: me!.id })}><Palmtree size={17} /> Déclarer une absence</Button>
      </PageTitle>

      {admin && pending.length > 0 && (
        <Card className="mb-6 border-mab-filet-rose p-5">
          <h2 className="mb-3 text-lg font-semibold">Demandes à valider · {pending.length}</h2>
          {pending.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-mab-filet py-3 last:border-0">
              <Avatar p={byId.get(a.user_id)} size={32} />
              <div className="min-w-[160px] flex-1">
                <p className="font-medium">{byId.get(a.user_id)?.full_name} · {a.kind}</p>
                <p className="text-sm text-mab-texte">{absenceRange(a)}{a.note && ` · ${a.note}`}</p>
              </div>
              <div className="flex w-full justify-end gap-1 sm:w-auto">
                <Button variant="secondaire" className="!h-9" onClick={() => decideAbsence(a, 'validee')}><Check size={15} /> Valider</Button>
                <Button variant="discret" className="!text-mab-erreur" onClick={() => decideAbsence(a, 'refusee')}><X size={15} /> Refuser</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconButton label="Semaines précédentes" onClick={() => setWeek0((w) => addWeeks(w, narrow ? -1 : -2))}><ChevronLeft size={18} /></IconButton>
          <h2 className="font-semibold">Du {format(days[0], 'd MMM', { locale: fr })} au {format(days[days.length - 1], 'd MMM', { locale: fr })}</h2>
          <IconButton label="Semaines suivantes" onClick={() => setWeek0((w) => addWeeks(w, narrow ? 1 : 2))}><ChevronRight size={18} /></IconButton>
          <Button variant="discret" onClick={() => setWeek0(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Aujourd’hui</Button>
        </div>
        <div className="sm:min-w-[760px]">
          <div className="grid" style={{ gridTemplateColumns: `${narrow ? 88 : 150}px repeat(${days.length}, minmax(0,1fr))` }}>
            <span />
            {days.map((d) => (
              <span key={d.toISOString()} className={`pb-1 text-center text-[10px] ${toIso(d) === today ? 'font-bold text-mab-aqua-texte' : 'text-mab-gris'} ${d.getDay() === 1 ? 'border-l border-mab-filet' : ''}`}>
                {d.getDay() === 1 && <span className="block font-semibold text-mab-texte">{format(d, 'd MMM', { locale: fr })}</span>}
                {format(d, 'EEEEE', { locale: fr }).toUpperCase()}
              </span>
            ))}
            {people.map((p) => (
              <PersonRow key={p.id} name={p.full_name} avatar={<Avatar p={p} size={24} />} days={days.map(toIso)} list={inRange.filter((a) => a.user_id === p.id)} onPick={(a) => setDraft(a)} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mab-texte">
          {ABSENCE_KINDS.map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-mab-puce" style={{ background: KIND_COLOR[k] }} />{k}</span>)}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-mab-puce border border-dashed border-mab-gris bg-white" />En attente de validation</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">À venir dans l’équipe</h2>
          {upcoming.length === 0 && <p className="text-sm text-mab-texte">Personne n’est absent prochainement.</p>}
          {upcoming.slice(0, 15).map((a) => <AbsenceRow key={a.id} a={a} />)}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Mes absences</h2>
          {mine.length === 0 ? <Empty title="Aucune absence déclarée" /> : mine.map((a) => (
            <AbsenceRow key={a.id} a={a} actions={
              <>
                {(admin || a.status === 'en_attente') && <Button variant="discret" onClick={() => setDraft(a)}>Modifier</Button>}
                {(admin || a.status !== 'validee' || a.start_date > today) && (
                  <IconButton label="Supprimer" onClick={() => confirm('Supprimer cette absence ?') && deleteAbsence(a.id)}><Trash2 size={15} /></IconButton>
                )}
              </>
            } />
          ))}
        </Card>
      </div>
      <AbsenceModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function PersonRow({ name, avatar, days, list, onPick }: { name: string; avatar: React.ReactNode; days: string[]; list: Absence[]; onPick: (a: Absence) => void }) {
  const { me } = useStore();
  return (
    <>
      <span className="flex items-center gap-2 border-t border-mab-filet py-1.5 pr-2 text-sm"><span className="shrink-0">{avatar}</span><span className="truncate">{name.split(' ')[0]}</span></span>
      {days.map((d, i) => {
        const a = list.find((x) => x.start_date <= d && x.end_date >= d);
        const color = a ? KIND_COLOR[absenceKind(a, me)] ?? '#9babab' : undefined;
        const start = a && (i === 0 || !(a.start_date <= days[i - 1] && a.end_date >= days[i - 1]));
        return (
          <span key={d} className={`flex items-center border-t border-mab-filet py-1.5 ${new Date(d).getDay() === 1 ? 'border-l' : ''}`}>
            {a && (
              <button
                title={`${absenceKind(a, me)} ${absenceRange(a)}${a.status === 'en_attente' ? ' (en attente)' : ''}`}
                onClick={() => (isAdmin(me) || a.user_id === me!.id) && onPick(a)}
                className={`h-5 w-full ${start ? 'rounded-l-mab-puce' : ''} ${a.end_date === d ? 'rounded-r-mab-puce' : ''} ${a.status === 'en_attente' ? `border-y border-dashed bg-white ${start ? 'border-l' : ''} ${a.end_date === d ? 'border-r' : ''}` : ''}`}
                style={a.status === 'en_attente' ? { borderColor: color } : { background: color }}
              />
            )}
          </span>
        );
      })}
    </>
  );
}

function AbsenceRow({ a, actions }: { a: Absence; actions?: React.ReactNode }) {
  const { byId, me } = useStore();
  const kind = absenceKind(a, me);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-mab-filet py-2.5 last:border-0">
      <Avatar p={byId.get(a.user_id)} size={30} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{byId.get(a.user_id)?.full_name} · <span style={{ color: KIND_COLOR[kind] === '#3bbfbf' ? '#1f7f7f' : KIND_COLOR[kind] }}>{kind}</span></p>
        <p className="text-xs text-mab-texte">{absenceRange(a)}{a.note && (isAdmin(me) || a.user_id === me!.id) ? ` · ${a.note}` : ''}</p>
      </div>
      {a.status === 'en_attente' && <Badge tone="factuel">En attente</Badge>}
      {a.status === 'refusee' && <Badge tone="erreur">Refusée</Badge>}
      {actions}
    </div>
  );
}

export function AbsenceModal({ draft, onClose }: { draft: Partial<Absence> | null; onClose: () => void }) {
  const { snap, me, saveAbsence, deleteAbsence } = useStore();
  const [a, setA] = useState<Partial<Absence>>({});
  useEffect(() => { if (draft) setA({ kind: 'Congés', start_date: todayIso(), end_date: todayIso(), note: '', ...draft }); }, [draft]);
  const overlapTasks = useMemo(() => {
    if (!a.user_id || !a.start_date || !a.end_date) return [];
    return snap.tasks.filter((t) => t.assignee_id === a.user_id && t.status !== 'fait' && t.due_date && t.due_date >= a.start_date! && t.due_date <= a.end_date!);
  }, [a, snap.tasks]);
  if (!draft || !me) return null;
  const admin = isAdmin(me);
  const valid = a.user_id && a.start_date && a.end_date && a.start_date <= a.end_date;
  const submit = () => { if (!valid) return; saveAbsence(a as Absence); onClose(); };
  return (
    <Modal
      open
      onClose={onClose}
      title={draft.id ? 'Modifier l’absence' : admin ? 'Noter une absence' : 'Demander une absence'}
      footer={
        <>
          {draft.id && admin && <Button variant="danger" className="mr-auto" onClick={() => { deleteAbsence(draft.id!); onClose(); }}><Trash2 size={15} /> Supprimer</Button>}
          <Button variant="tertiaire" onClick={onClose}>Annuler</Button>
          <Button variant="primaire" disabled={!valid} onClick={submit}>{admin ? 'Enregistrer' : 'Envoyer la demande'}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        {admin && (
          <Field label="Personne">
            <Select value={a.user_id} onChange={(e) => setA({ ...a, user_id: e.target.value })}>
              {snap.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Motif">
          <Select value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value })}>
            {ABSENCE_KINDS.map((k) => <option key={k}>{k}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Premier jour"><Input type="date" value={a.start_date ?? ''} onChange={(e) => setA({ ...a, start_date: e.target.value, end_date: a.end_date && a.end_date < e.target.value ? e.target.value : a.end_date })} /></Field>
          <Field label="Dernier jour"><Input type="date" value={a.end_date ?? ''} min={a.start_date} onChange={(e) => setA({ ...a, end_date: e.target.value })} /></Field>
        </div>
        <Field label="Précision (facultatif)" help="Visible uniquement par toi et les administrateurs.">
          <Textarea rows={2} value={a.note ?? ''} onChange={(e) => setA({ ...a, note: e.target.value })} />
        </Field>
        {a.kind === 'Maladie' && <p className="text-sm text-mab-texte">Le motif reste confidentiel : l’équipe voit seulement « Absence ».</p>}
        {!admin && <p className="text-sm text-mab-texte">Un administrateur valide la demande ; tu seras prévenu(e).</p>}
        {overlapTasks.length > 0 && (
          <div className="rounded-mab-champ bg-mab-rose-wash px-4 py-3 text-sm text-mab-rose-texte">
            <b>{overlapTasks.length} tâche{overlapTasks.length > 1 ? 's' : ''}</b> tombe{overlapTasks.length > 1 ? 'nt' : ''} pendant cette absence :
            <ul className="mt-1 list-disc pl-5">{overlapTasks.slice(0, 5).map((t) => <li key={t.id}>{t.title}</li>)}</ul>
            Pense à les avancer ou à les confier à quelqu’un d’autre.
          </div>
        )}
      </div>
    </Modal>
  );
}
