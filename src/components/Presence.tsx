import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from 'date-fns';
import type { Profile } from '../lib/types';
import { useStore } from '../state/store';
import { AVAIL_LABEL, AvailDot } from './ui';

/** « à l'instant », « il y a 12 min », « il y a 3 h », « hier à 18:20 », « le 21/09 ». */
export function seenLabel(iso: string | null) {
  if (!iso) return 'Hors ligne';
  const d = parseISO(iso);
  const min = differenceInMinutes(new Date(), d);
  if (min < 2) return 'Vu à l’instant';
  if (min < 60) return `Vu il y a ${min} min`;
  const days = differenceInCalendarDays(new Date(), d);
  if (days === 0) return `Vu il y a ${Math.floor(min / 60)} h`;
  if (days === 1) return `Vu hier à ${format(d, 'HH:mm')}`;
  if (days < 7) return `Vu il y a ${days} jours`;
  return `Vu le ${format(d, 'dd/MM')}`;
}

/** Connecté : son statut choisi. Pas connecté : rond vide gris « Hors ligne ». */
export function PresenceDot({ p, className = '', size = 10 }: { p: Profile; className?: string; size?: number }) {
  const { online, me } = useStore();
  const isOnline = online.has(p.id) || p.id === me?.id;
  if (!isOnline) {
    return (
      <span
        title="Hors ligne"
        className={`inline-block shrink-0 rounded-full border-2 border-mab-gris-doux bg-white ring-2 ring-white ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <AvailDot a={p.availability} className={className} />;
}

/** Texte sous le nom : statut (et précision) si connecté, sinon « Hors ligne · vu il y a… ». */
export function usePresenceText() {
  const { online, me, lastSeenOf } = useStore();
  return (p: Profile) => {
    if (online.has(p.id) || p.id === me?.id) {
      const label = AVAIL_LABEL[p.availability];
      const note = p.availability_note.trim();
      const extra = note && note.toLowerCase() !== label.toLowerCase() ? ` · ${note}` : '';
      return p.availability === 'disponible' ? `En ligne${extra}` : `${label}${extra}`;
    }
    const seen = lastSeenOf(p.id);
    return seen ? `Hors ligne · ${seenLabel(seen).replace(/^Vu/, 'vu')}` : 'Hors ligne';
  };
}
