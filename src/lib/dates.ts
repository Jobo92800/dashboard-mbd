import { format, parseISO, differenceInCalendarDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export const todayIso = () => format(new Date(), 'yyyy-MM-dd');
export const toIso = (d: Date) => format(d, 'yyyy-MM-dd');

const safe = (iso: string) => {
  const d = parseISO(iso);
  return isValid(d) ? d : null;
};

/** « 24 sept. » */
export function fmtShort(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = safe(iso);
  return d ? format(d, 'd MMM', { locale: fr }) : '—';
}

/** « jeudi 24 septembre » */
export function fmtLong(iso: string) {
  const d = safe(iso);
  return d ? format(d, 'EEEE d MMMM', { locale: fr }) : iso;
}

/** « 23/09 à 12:50 » */
export function fmtStamp(isoDateTime: string) {
  const d = new Date(isoDateTime);
  return isValid(d) ? format(d, "dd/MM 'à' HH:mm") : '';
}

/** Jours restants avant la date (négatif = en retard). */
export function daysUntil(iso: string) {
  const d = safe(iso);
  return d ? differenceInCalendarDays(d, new Date()) : 0;
}

export function relativeLabel(iso: string | null) {
  if (!iso) return 'Sans échéance';
  const n = daysUntil(iso);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  if (n < 0) return `En retard de ${-n} j`;
  if (n < 7) return fmtLong(iso).split(' ')[0].replace(/^./, (c) => c.toUpperCase());
  return fmtShort(iso);
}
