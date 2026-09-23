import type { Absence, Profile } from './types';
import { fmtShort } from './dates';

/** Absence (validée ou demandée) couvrant cette date pour cette personne. */
export function absenceOn(absences: Absence[], userId: string | null | undefined, date: string | null | undefined) {
  if (!userId || !date) return undefined;
  return absences.find((a) => a.user_id === userId && a.status !== 'refusee' && a.start_date <= date && a.end_date >= date);
}

/** Absences qui chevauchent une période. */
export function absencesBetween(absences: Absence[], from: string, to: string) {
  return absences.filter((a) => a.status !== 'refusee' && a.start_date <= to && a.end_date >= from);
}

/**
 * Motif affiché : un arrêt maladie reste confidentiel (« Absence ») pour les
 * autres membres ; la personne concernée et les admins voient le vrai motif.
 */
export function absenceKind(a: Absence, viewer: Profile | null) {
  if (a.kind === 'Maladie' && viewer && viewer.role !== 'admin' && viewer.id !== a.user_id) return 'Absence';
  return a.kind;
}

export const absenceRange = (a: Absence) =>
  a.start_date === a.end_date ? `le ${fmtShort(a.start_date)}` : `du ${fmtShort(a.start_date)} au ${fmtShort(a.end_date)}`;

export function absenceWarning(absences: Absence[], person: Profile | undefined, date: string | null | undefined, viewer: Profile | null) {
  const a = person && absenceOn(absences, person.id, date);
  if (!a || !person) return null;
  const text = `${person.full_name.split(' ')[0]} sera absent·e (${absenceKind(a, viewer).toLowerCase()}) ${absenceRange(a)}${a.status === 'en_attente' ? ', demande en attente' : ''}`;
  return text.endsWith('.') ? text : `${text}.`;
}
