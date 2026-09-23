import { addDays, addMonths, addWeeks, format, isWeekend, parseISO } from 'date-fns';
import type { Recurrence } from './types';
import { todayIso } from './dates';

function step(d: Date, r: Recurrence) {
  switch (r) {
    case 'quotidienne': return addDays(d, 1);
    case 'jours_ouvres': { let n = addDays(d, 1); while (isWeekend(n)) n = addDays(n, 1); return n; }
    case 'hebdomadaire': return addWeeks(d, 1);
    case 'bimensuelle': return addWeeks(d, 2);
    case 'mensuelle': return addMonths(d, 1);
  }
}

/** Prochaine échéance après la date donnée, jamais dans le passé (pas d'arriéré qui s'accumule). */
export function nextOccurrence(from: string | null, r: Recurrence) {
  const today = todayIso();
  let d = step(parseISO(from ?? today), r);
  while (format(d, 'yyyy-MM-dd') <= today) d = step(d, r);
  return format(d, 'yyyy-MM-dd');
}

export const shiftIso = (iso: string, days: number) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
