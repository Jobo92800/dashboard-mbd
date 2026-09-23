import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalEvent } from '../lib/types';
import { EVENT_TYPES } from '../lib/types';
import { useStore } from '../state/store';
import { canEditEvent } from '../lib/permissions';
import { todayIso } from '../lib/dates';
import { absenceWarning } from '../lib/absences';
import { Button, Field, Input, Modal, PeoplePicker, Select, Textarea } from './ui';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const fmtDur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`);

export function EventModal({ draft, onClose }: { draft: Partial<CalEvent> | null; onClose: () => void }) {
  const { snap, me, byId, saveEvent, deleteEvent } = useStore();
  const [e, setE] = useState<Partial<CalEvent>>({});
  useEffect(() => {
    if (draft) setE({ kind: 'Réunion', date: todayIso(), time: '09:00', duration_min: 30, participant_ids: me ? [me.id] : [], ...draft });
  }, [draft, me]);
  if (!draft || !me) return null;
  const isEdit = !!draft.id;
  const readOnly = isEdit && !canEditEvent(me, draft as CalEvent);
  const set = (patch: Partial<CalEvent>) => setE((x) => ({ ...x, ...patch }));
  const valid = !!e.title?.trim() && !!e.date;
  const submit = () => { if (!valid) return; onClose(); saveEvent({ ...e, title: e.title!.trim() } as CalEvent); };

  return (
    <Modal
      open
      onClose={onClose}
      title={readOnly ? e.title ?? 'Événement' : isEdit ? 'Modifier l’événement' : 'Nouvel événement'}
      footer={readOnly ? <Button onClick={onClose}>Fermer</Button> : (
        <>
          {isEdit && (
            <Button variant="danger" className="mr-auto" onClick={() => { onClose(); deleteEvent(draft as CalEvent); }}>
              <Trash2 size={16} /> Supprimer
            </Button>
          )}
          <Button variant="tertiaire" onClick={onClose}>Annuler</Button>
          <Button variant="primaire" disabled={!valid} onClick={submit}>Enregistrer</Button>
        </>
      )}
    >
      <fieldset disabled={readOnly} className="grid gap-4">
        <Field label="Titre">
          <Input autoFocus value={e.title ?? ''} onChange={(x) => set({ title: x.target.value })} placeholder="Ex. Point hebdo direction" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={e.kind} onChange={(x) => set({ kind: x.target.value })}>
              {EVENT_TYPES.map((k) => <option key={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={e.date ?? ''} onChange={(x) => set({ date: x.target.value })} />
          </Field>
          <Field label="Heure">
            <Input type="time" value={e.time ?? ''} onChange={(x) => set({ time: x.target.value })} />
          </Field>
          <Field label="Durée">
            <Select value={e.duration_min} onChange={(x) => set({ duration_min: Number(x.target.value) })}>
              {DURATIONS.map((d) => <option key={d} value={d}>{fmtDur(d)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Participants" help="Chaque participant est prévenu dans ses notifications.">
          <PeoplePicker people={snap.profiles.filter((p) => p.active)} value={e.participant_ids ?? []} onChange={(ids) => set({ participant_ids: ids })} />
        </Field>
        {(e.participant_ids ?? []).map((id) => absenceWarning(snap.absences, byId.get(id), e.date, me)).filter(Boolean).map((w) => (
          <p key={w} className="rounded-mab-champ bg-mab-rose-wash px-4 py-2 text-sm text-mab-rose-texte">🌴 {w}</p>
        ))}
        <Field label="Note / objectif">
          <Textarea value={e.note ?? ''} onChange={(x) => set({ note: x.target.value })} />
        </Field>
      </fieldset>
    </Modal>
  );
}

export { fmtDur };
