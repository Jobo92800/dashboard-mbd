// Tableau de bord direction : chiffres par centre et par mois, lus dans Airtable
// (base « CRM 2026 », table « Prospects Master » + « Perdu / Injoignable »).
// Réservé aux administrateurs. GET ?mois=AAAA-MM
import { callerProfile, json } from '../lib/server.mts';

const BASE = process.env.AIRTABLE_BASE_ID || 'appNML7rJEKiWkuVg';
const MASTER = process.env.AIRTABLE_TABLE_ID || 'tblgCdNITlPy74Z5G';
const PERDU = 'tblSyB6j2gvKtvo4Y';
const CENTRES = ['Le Grau-du-Roi', 'Le Crès', 'Sérignan', 'Cabestany', 'Avignon'] as const;

type Rec = { fields: Record<string, unknown> };

/** « LGR », « Grau-du-Roi », « Le Grau-du-Roi (30) » → « Le Grau-du-Roi ». */
function centreOf(v: unknown) {
  const s = String(v ?? '').toLowerCase();
  if (/grau|lgr/.test(s)) return 'Le Grau-du-Roi';
  if (/cr[eè]s/.test(s)) return 'Le Crès';
  if (/s[ée]rignan/.test(s)) return 'Sérignan';
  if (/cabestany/.test(s)) return 'Cabestany';
  if (/avignon/.test(s)) return 'Avignon';
  return 'Non renseigné';
}

/** Mois « AAAA-MM » d'une date Airtable, à l'heure de Paris. */
function monthOf(v: unknown) {
  if (!v || typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 7);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
}

const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};

async function fetchAll(table: string, fields: string[], formula: string) {
  const token = process.env.AIRTABLE_TOKEN;
  const out: Rec[] = [];
  let offset = '';
  for (let page = 0; page < 60; page++) {
    const q = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
    fields.forEach((f) => q.append('fields[]', f));
    if (offset) q.set('offset', offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status} : ${(await res.text()).slice(0, 200)}`);
    const body = await res.json() as { records: Rec[]; offset?: string };
    out.push(...body.records);
    if (!body.offset) break;
    offset = body.offset;
  }
  return out;
}

const inMonths = (field: string, months: string[]) =>
  `OR(${months.map((m) => `DATETIME_FORMAT(SET_TIMEZONE({${field}},'Europe/Paris'),'YYYY-MM')='${m}'`).join(',')})`;

type Stat = { leads: number; bilans: number; conversions: number; ca: number };
const empty = (): Stat => ({ leads: 0, bilans: 0, conversions: 0, ca: 0 });

const cache = new Map<string, { at: number; data: unknown }>();

export default async (req: Request) => {
  const me = await callerProfile(req);
  if (!me) return json(401, { error: 'Session expirée, reconnecte-toi.' });
  if (me.role !== 'admin') return json(403, { error: 'Réservé aux administrateurs.' });
  if (!process.env.AIRTABLE_TOKEN) return json(503, { error: 'non_configure' });

  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('mois') ?? '') ? url.searchParams.get('mois')! : new Date().toISOString().slice(0, 7);
  const fresh = url.searchParams.get('rafraichir') === '1';
  const hit = cache.get(month);
  if (hit && !fresh && Date.now() - hit.at < 5 * 60_000) return json(200, hit.data);

  const months = [month, prevMonth(month)];
  try {
    const fields = ['Centre', 'Création', 'Date Bilan Placé', 'Date Converti', 'Date de convertion', 'Montant Cure', 'Source', 'Commercial'];
    const [master, perdus] = await Promise.all([
      fetchAll(MASTER, fields, `OR(${inMonths('Création', months)},${inMonths('Date Bilan Placé', months)},${inMonths('Date Converti', months)})`),
      fetchAll(PERDU, ['Centre', 'Création', 'Source'], inMonths('Création', months)),
    ]);

    const byMonth: Record<string, Record<string, Stat>> = {};
    const bucket = (m: string, c: string) => ((byMonth[m] ??= {})[c] ??= empty());
    const sources: Record<string, { leads: number; conversions: number }> = {};
    const commerciaux: Record<string, { bilans: number; conversions: number }> = {};
    const leadsParJour: Record<string, number> = {};

    for (const r of [...master, ...perdus]) {
      const f = r.fields;
      const c = centreOf(f['Centre']);
      const created = monthOf(f['Création']);
      if (created && months.includes(created)) {
        bucket(created, c).leads++;
        if (created === month) {
          const src = String(f['Source'] ?? 'Non renseignée');
          (sources[src] ??= { leads: 0, conversions: 0 }).leads++;
          const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(String(f['Création'])));
          leadsParJour[day] = (leadsParJour[day] ?? 0) + 1;
        }
      }
    }
    for (const r of master) {
      const f = r.fields;
      const c = centreOf(f['Centre']);
      const who = String(f['Commercial'] ?? 'Non attribué');
      const b = monthOf(f['Date Bilan Placé']);
      if (b && months.includes(b)) {
        bucket(b, c).bilans++;
        if (b === month) (commerciaux[who] ??= { bilans: 0, conversions: 0 }).bilans++;
      }
      const cv = monthOf(f['Date Converti']) ?? monthOf(f['Date de convertion']);
      if (cv && months.includes(cv)) {
        const s = bucket(cv, c);
        s.conversions++;
        s.ca += Number(f['Montant Cure'] ?? 0) || 0;
        if (cv === month) {
          (commerciaux[who] ??= { bilans: 0, conversions: 0 }).conversions++;
          const src = String(f['Source'] ?? 'Non renseignée');
          (sources[src] ??= { leads: 0, conversions: 0 }).conversions++;
        }
      }
    }

    const data = {
      month,
      previous: months[1],
      centres: CENTRES,
      current: byMonth[month] ?? {},
      prev: byMonth[months[1]] ?? {},
      sources,
      commerciaux,
      leadsParJour,
      updatedAt: new Date().toISOString(),
    };
    cache.set(month, { at: Date.now(), data });
    return json(200, data);
  } catch (e) {
    console.error(e);
    return json(502, { error: (e as Error).message });
  }
};
