import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import type { Profile } from '../lib/types';
import { initials } from '../lib/palette';

type Variant = 'primaire' | 'secondaire' | 'tertiaire' | 'danger' | 'discret';

export function Button({ variant = 'secondaire', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-mab-pilule text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-mab-terrain-2-fond disabled:text-mab-gris-doux disabled:shadow-none disabled:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mab-aqua focus-visible:ring-offset-2';
  const styles: Record<Variant, string> = {
    primaire: 'h-11 px-6 bg-mab-rose text-white shadow-mab-cta hover:bg-mab-rose-texte',
    secondaire: 'h-11 px-5 bg-white border border-mab-aqua text-mab-aqua-texte hover:bg-mab-wash-2',
    tertiaire: 'h-9 px-2 text-mab-texte hover:underline',
    danger: 'h-11 px-5 bg-white border border-mab-filet-rose text-mab-erreur hover:bg-mab-rose-wash',
    discret: 'h-9 px-3 text-mab-aqua-texte hover:bg-mab-wash-2',
  };
  return <button type="button" className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

export function IconButton({ label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-mab-pilule text-mab-texte transition [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 hover:bg-mab-wash-2 hover:text-mab-aqua-texte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mab-aqua ${className}`}
      {...rest}
    />
  );
}

export function Card({ className = '', children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-mab-carte border border-mab-filet bg-white ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Surtitre({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[.14em] text-mab-aqua-texte ${className}`}>{children}</p>;
}

type Tone = 'mesure' | 'factuel' | 'emotion' | 'violet' | 'succes' | 'erreur' | 'neutre';
const TONES: Record<Tone, string> = {
  mesure: 'bg-mab-wash-2 text-mab-aqua-texte',
  factuel: 'bg-mab-terrain-2-fond text-mab-terrain-2-texte',
  emotion: 'bg-mab-rose-wash text-mab-rose-texte',
  violet: 'bg-mab-violet-wash text-mab-violet-texte',
  succes: 'bg-[#e7f5ee] text-mab-succes',
  erreur: 'bg-mab-rose-wash text-mab-erreur',
  neutre: 'bg-mab-wash text-mab-texte',
};
export function Badge({ tone = 'neutre', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-mab-pilule px-2.5 py-1 text-[11px] font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({ p, size = 32, ring = false }: { p?: Profile; size?: number; ring?: boolean }) {
  if (!p) return <span className="inline-grid shrink-0 place-items-center rounded-full bg-mab-rail text-mab-gris" style={{ width: size, height: size, fontSize: size * 0.34 }}>?</span>;
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.full_name}
        title={`${p.full_name} · ${p.job_title}`}
        className={`inline-block shrink-0 rounded-full bg-mab-rail object-cover ${ring ? 'ring-2 ring-white' : ''} ${p.active ? '' : 'opacity-40'}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={`${p.full_name} · ${p.job_title}`}
      className={`relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''} ${p.active ? '' : 'opacity-40'}`}
      style={{ width: size, height: size, background: p.color, fontSize: Math.max(10, size * 0.34) }}
    >
      {initials(p.full_name)}
    </span>
  );
}

export function AvatarStack({ people, max = 5, size = 30 }: { people: (Profile | undefined)[]; max?: number; size?: number }) {
  const list = people.filter(Boolean) as Profile[];
  return (
    <div className="flex items-center">
      {list.slice(0, max).map((p, i) => (
        <span key={p.id} style={{ marginLeft: i ? -8 : 0 }}>
          <Avatar p={p} size={size} ring />
        </span>
      ))}
      {list.length > max && <span className="ml-1 text-xs text-mab-texte">+{list.length - max}</span>}
    </div>
  );
}

const DOT: Record<Profile['availability'], string> = { disponible: 'bg-mab-succes', occupe: 'bg-[#d99a2b]', absent: 'bg-mab-gris-doux' };
export const AVAIL_LABEL: Record<Profile['availability'], string> = { disponible: 'Disponible', occupe: 'Occupé·e', absent: 'Absent·e' };
export function AvailDot({ a, className = '' }: { a: Profile['availability']; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${DOT[a]} ${className}`} title={AVAIL_LABEL[a]} />;
}

/** Barre de progression DA : le dégradé couvre tout le rail, le remplissage le découpe. */
export function Progress({ done, total, showCount = true }: { done: number; total: number; showCount?: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-mab-pilule bg-mab-rail" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
        <div className="absolute inset-0 bg-mab-degrade-marque transition-[clip-path] duration-200" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
      </div>
      {showCount && <span className="shrink-0 text-xs font-semibold tabular-nums text-mab-texte">{done} / {total}</span>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-mab-encre/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-[22px] bg-white shadow-mab-flottante sm:max-h-[92vh] sm:rounded-mab-carte ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-mab-pilule bg-mab-rail sm:hidden" aria-hidden />
        <div className="flex items-center justify-between border-b border-mab-filet px-5 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-mab-encre">{title}</h2>
          <IconButton label="Fermer" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className={`overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 ${footer ? '' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-mab-filet px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, help, children, className = '' }: { label: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-mab-encre">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-mab-texte">{help}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-mab-champ border border-mab-filet bg-white px-4 text-[15px] text-mab-encre placeholder:text-mab-gris-doux focus:border-mab-aqua focus:outline-none focus:ring-2 focus:ring-mab-aqua/30';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} h-11 ${p.className ?? ''}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} h-11 pr-8 ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${inputCls} py-3 ${p.className ?? ''}`} />;

/** Sélection de personnes par pastilles (choix multiple). */
export function PeoplePicker({ people, value, onChange }: { people: Profile[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={`flex items-center gap-2 rounded-mab-pilule border py-1 pl-1 pr-3 text-sm transition ${
              on ? 'border-mab-aqua bg-mab-wash-2 text-mab-encre' : 'border-mab-filet bg-white text-mab-texte hover:border-mab-filet-aqua'
            }`}
          >
            <Avatar p={p} size={24} />
            {p.full_name}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-mab-carte border border-dashed border-mab-filet-aqua bg-mab-wash px-6 py-10 text-center">
      {icon && <div className="text-mab-aqua">{icon}</div>}
      <p className="font-semibold text-mab-encre">{title}</p>
      {text && <p className="max-w-sm text-sm text-mab-texte">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'erreur' }) {
  return (
    <Card className="px-5 py-4">
      <p className={`text-3xl font-light tabular-nums ${tone === 'erreur' ? 'text-mab-erreur' : 'text-mab-encre'}`}>{value}</p>
      <p className="mt-1 text-sm text-mab-texte">{label}</p>
    </Card>
  );
}

export function PageTitle({ title, sub, children }: { title: ReactNode; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-light leading-tight tracking-tight text-mab-encre sm:text-[34px] [&_b]:font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-mab-texte">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-mab-pilule border border-mab-filet bg-white p-1" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`rounded-mab-pilule px-4 py-1.5 text-sm font-medium transition ${
            value === it.id ? 'bg-mab-aqua-encre text-white' : 'text-mab-texte hover:bg-mab-wash-2'
          }`}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 opacity-70">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export type MenuAction = { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; onClick: () => void; danger?: boolean; hidden?: boolean };

/** Bouton « ⋯ » qui ouvre une liste d'actions (utile sur téléphone). */
export function ActionMenu({ actions, label = 'Plus d’actions', className = '' }: { actions: MenuAction[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const list = actions.filter((a) => !a.hidden);
  if (!list.length) return null;
  return (
    <div className={`relative ${className}`}>
      <IconButton label={label} className="border border-mab-filet" onClick={() => setOpen((o) => !o)}><MoreHorizontal size={18} /></IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-60 rounded-mab-champ border border-mab-filet bg-white p-1 shadow-mab-flottante">
            {list.map((a) => (
              <button
                key={a.label}
                onClick={() => { setOpen(false); a.onClick(); }}
                className={`flex w-full items-center gap-2.5 rounded-mab-etiquette px-3 py-2.5 text-left text-sm hover:bg-mab-wash ${a.danger ? 'text-mab-erreur' : 'text-mab-encre'}`}
              >
                <a.icon size={16} className="shrink-0" /> {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
