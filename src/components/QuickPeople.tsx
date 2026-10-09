import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { Profile } from '../lib/types';
import { Avatar } from './ui';

/** Bouton « + Ajouter » qui ouvre une liste de l'équipe : un clic ajoute ou retire la personne, sans passer par « Modifier ». */
export function QuickPeople({ people, value, onToggle, label = 'Ajouter', note }: {
  people: Profile[]; value: string[]; onToggle: (id: string) => void; label?: string; note?: (p: Profile) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const list = people.filter((p) => !q || p.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={box} className="relative inline-block">
      <button type="button" onClick={() => { setOpen(!open); setQ(''); }} aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-mab-pilule border border-dashed border-mab-filet-aqua px-3 text-sm font-medium text-mab-aqua-texte hover:bg-mab-wash-2">
        <Plus size={14} /> {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-mab-champ border border-mab-filet bg-white p-1.5 shadow-mab-flottante">
          {people.length > 6 && (
            <label className="mb-1 flex items-center gap-2 rounded-mab-etiquette bg-mab-wash px-2.5">
              <Search size={14} className="text-mab-gris" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher…" className="h-9 min-w-0 flex-1 bg-transparent text-[16px] outline-none sm:text-sm" />
            </label>
          )}
          <div className="max-h-64 overflow-y-auto">
            {list.map((p) => {
              const on = value.includes(p.id);
              const extra = note?.(p);
              return (
                <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                  className={`flex w-full items-center gap-2.5 rounded-mab-etiquette px-2 py-1.5 text-left text-sm ${on ? 'bg-mab-wash-2' : 'hover:bg-mab-wash'}`}>
                  <Avatar p={p} size={26} />
                  <span className="min-w-0 flex-1"><span className="block truncate">{p.full_name}</span>{extra && <span className="block text-[11px] text-mab-gris-doux">{extra}</span>}</span>
                  {on && <Check size={16} className="shrink-0 text-mab-aqua-texte" />}
                </button>
              );
            })}
            {list.length === 0 && <p className="px-2 py-3 text-center text-sm text-mab-gris-doux">Personne avec ce nom.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
