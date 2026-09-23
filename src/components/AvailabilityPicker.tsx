import { useEffect, useState } from 'react';
import type { Availability } from '../lib/types';
import { useStore } from '../state/store';
import { AVAIL_LABEL, AvailDot, Input } from './ui';

export function AvailabilityPicker() {
  const { me, updateProfile } = useStore();
  const [note, setNote] = useState(me?.availability_note ?? '');
  useEffect(() => setNote(me?.availability_note ?? ''), [me?.availability_note]);
  if (!me) return null;
  const set = (a: Availability) => updateProfile(me.id, { availability: a });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['disponible', 'occupe', 'absent'] as Availability[]).map((a) => (
        <button
          key={a}
          onClick={() => set(a)}
          aria-pressed={me.availability === a}
          className={`flex items-center gap-2 rounded-mab-pilule border px-3.5 py-1.5 text-sm transition ${
            me.availability === a ? 'border-mab-aqua bg-mab-wash-2 font-semibold text-mab-encre' : 'border-mab-filet bg-white text-mab-texte hover:border-mab-filet-aqua'
          }`}
        >
          <AvailDot a={a} /> {AVAIL_LABEL[a]}
        </button>
      ))}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== me.availability_note && updateProfile(me.id, { availability_note: note }, 'Statut mis à jour')}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="Précision : en tournage jusqu’à 15 h…"
        className="!h-9 min-w-[220px] flex-1 !text-sm"
      />
    </div>
  );
}
