// Tableau de bord direction, en deux temps comme le parcours réel :
//  ① Téléphone (commerciales) — base « CRM 2026 » : prospects reçus, appels passés
//     (1er / 2e / 3e appel datés dans la période) dont décrochés, puis bilans placés.
//  ② Centre (thérapeutes) — base « CRM News », table Clients : une fiche par bilan
//     réalisé en centre ; une cure est vendue quand « Montant Cure » est renseigné.
// Réservé aux administrateurs. GET ?du=AAAA-MM-JJ&au=AAAA-MM-JJ (ou ?mois=AAAA-MM).
// La comparaison porte sur la période précédente de même durée.
import { callerProfile, json } from '../lib/server.mts';

const CRM = process.env.AIRTABLE_BASE_ID || 'appNML7rJEKiWkuVg';
const MASTER = process.env.AIRTABLE_TABLE_ID || 'tblgCdNITlPy74Z5G';
const NEWS = process.env.AIRTABLE_CLIENTS_BASE_ID || 'appI97jEL2mSCg3Wc';
const CLIENTS = 'tblfqxwGePzeiWqqY';
const CENTRES = ['Le Grau-du-Roi', 'Le Crès', 'Sérignan', 'Cabestany', 'Avignon'] as const;
/** Les trois tentatives d'appel : [date de l'appel, case « a décroché »]. */
const CALLS = [['1er Appel', 'Répondu Appel 1'], ['2ème Appel', 'Répondu Appel 2'], ['3ème Appel', 'Répondu Appel 3']] as const;
const CURES = ['Montant Cure', ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Montant cure ${n}`)];

type Rec = { fields: Record<string, unknown> };

/** « LGR », « Grau-du-Roi », « Le Grau-du-Roi (30) » → « Le Grau-du-Roi ». */
function centreOf(v: unknown) {
  const s = String((v as { name?: string })?.name ?? v ?? '').toLowerCase();
  if (/grau|lgr/.test(s)) return 'Le Grau-du-Roi';
  if (/cr[eè]s/.test(s)) return 'Le Crès';
  if (/s[ée]rignan/.test(s)) return 'Sérignan';
  if (/cabestany/.test(s)) return 'Cabestany';
  if (/avignon/.test(s)) return 'Avignon';
  return 'Non renseigné';
}

/** Jour « AAAA-MM-JJ » d'une date Airtable, à l'heure de Paris. */
function dayOf(v: unknown) {
  if (!v || typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d);
}

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** « Malvina, Alex » → ['Malvina', 'Alex'] ; « MARIE SAN », « marie-san » → « Marie-San » ; « Alexandra 2 » → « Alexandra ». */
function people(v: unknown) {
  return String(v ?? '').split(/,|&|\/|\bet\b/i)
    .map((s) => s.toLowerCase().replace(/\d+/g, '').replace(/[\s_-]+/g, ' ').trim())
    .filter(Boolean)
    .map((s) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-'));
}

async function fetchAll(base: string, table: string, fields: string[], formula: string) {
  const token = process.env.AIRTABLE_TOKEN;
  const out: Rec[] = [];
  let offset = '';
  for (let page = 0; page < 60; page++) {
    const q = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
    fields.forEach((f) => q.append('fields[]', f));
    if (offset) q.set('offset', offset);
    const res = await fetch(`https://api.airtable.com/v0/${base}/${table}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      if ((res.status === 403 || res.status === 404) && base === NEWS) throw new Error('Le jeton Airtable n’a pas accès à la base « CRM News ». Ajoute-la au jeton sur airtable.com/create/tokens.');
      throw new Error(`Airtable ${res.status} : ${(await res.text()).slice(0, 200)}`);
    }
    const body = await res.json() as { records: Rec[]; offset?: string };
    out.push(...body.records);
    if (!body.offset) break;
    offset = body.offset;
  }
  return out;
}

/** Fiches dont le champ date tombe entre deux jours inclus (heure de Paris).
 *  Le IF est indispensable : sur une date vide, DATETIME_FORMAT renvoie une erreur
 *  qui fait écarter la fiche entière, même quand l'autre moitié du OR est vraie. */
const between = (field: string, from: string, to: string) => {
  const v = `IF({${field}},VALUE(DATETIME_FORMAT(SET_TIMEZONE({${field}},'Europe/Paris'),'YYYYMMDD')),0)`;
  return `AND(${v}>=${from.replaceAll('-', '')},${v}<=${to.replaceAll('-', '')})`;
};

/** Par centre et par mois. */
type Stat = { leads: number; appels: number; appeles: number; joints: number; bilans: number; realises: number; cures: number; ca: number; caBilans: number };
const empty = (): Stat => ({ leads: 0, appels: 0, appeles: 0, joints: 0, bilans: 0, realises: 0, cures: 0, ca: 0, caBilans: 0 });
/** Sort des bilans placés par une commerciale. */
type Commerciale = { leads: number; appels: number; appeles: number; joints: number; bilans: number; venus: number; annules: number; manques: number; cures: number };
type Therapeute = { bilans: number; cures: number; ca: number };

const cache = new Map<string, { at: number; data: unknown }>();

export default async (req: Request) => {
  const me = await callerProfile(req);
  if (!me) return json(401, { error: 'Session expirée, reconnecte-toi.' });
  if (me.role !== 'admin') return json(403, { error: 'Réservé aux administrateurs.' });
  if (!process.env.AIRTABLE_TOKEN) return json(503, { error: 'non_configure' });

  const url = new URL(req.url);
  const q = url.searchParams;
  let from = q.get('du'), to = q.get('au');
  const mois = q.get('mois');
  if (!isDay(from) || !isDay(to)) {
    const m = mois && /^\d{4}-\d{2}$/.test(mois) ? mois : new Date().toISOString().slice(0, 7);
    from = `${m}-01`;
    to = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10); // dernier jour du mois
  }
  if (from! > to!) [from, to] = [to, from];
  if (daysBetween(from!, to!) > 366) return json(400, { error: 'Choisis une période d’un an maximum.' });
  const key = `${from}|${to}`;
  const fresh = q.get('rafraichir') === '1';
  const hit = cache.get(key);
  if (hit && !fresh && Date.now() - hit.at < 5 * 60_000) return json(200, hit.data);

  try {
    const data = await compute(from!, to!);
    cache.set(key, { at: Date.now(), data });
    return json(200, data);
  } catch (e) {
    console.error(e);
    return json(502, { error: (e as Error).message });
  }
};

export async function compute(from: string, to: string) {
  const len = daysBetween(from, to) + 1;
  let prevFrom = addDays(from, -len);
  const prevTo = addDays(from, -1);
  // Un mois entier se compare au mois précédent entier, pas aux N jours d'avant.
  if (from.endsWith('-01') && addDays(to, 1).endsWith('-01') && from.slice(0, 7) === to.slice(0, 7)) prevFrom = `${prevTo.slice(0, 7)}-01`;
  /** 'cur' pour la période choisie, 'prev' pour la période d'avant, null sinon. */
  const period = (d: string | null) => (!d ? null : d >= from && d <= to ? 'cur' : d >= prevFrom && d <= prevTo ? 'prev' : null);
  {
    const phoneFields = ['Centre', 'Création', 'Source', 'Commercial', 'Statut', 'Date Bilan Placé', ...CALLS.flat()];
    const phoneDates = ['Création', 'Date Bilan Placé', ...CALLS.map(([d]) => d)];
    const [master, clients] = await Promise.all([
      fetchAll(CRM, MASTER, phoneFields, `OR(${phoneDates.map((d) => between(d, prevFrom, to)).join(',')})`),
      fetchAll(NEWS, CLIENTS, ['Centre', 'Thérapeute', 'Date bilan', 'date de création', 'Bilan seul', ...CURES],
        `OR(${between('Date bilan', prevFrom, to)},AND(NOT({Date bilan}),${between('date de création', prevFrom, to)}))`),
    ]);

    const byMonth: Record<string, Record<string, Stat>> = {}; // 'cur' | 'prev'
    const bucket = (m: string, c: string) => ((byMonth[m] ??= {})[c] ??= empty());
    const sources: Record<string, { leads: number; bilans: number }> = {};
    const commerciales: Record<string, Commerciale> = {};
    const therapeutes: Record<string, Therapeute> = {};
    const leadsParJour: Record<string, number> = {};
    const com = (n: string) => (commerciales[n] ??= { leads: 0, appels: 0, appeles: 0, joints: 0, bilans: 0, venus: 0, annules: 0, manques: 0, cures: 0 });

    // ① Téléphone. Seule « Prospects Master » compte : les perdus / injoignables y restent,
    // la table « Perdu / Injoignable » n'en est qu'une copie partielle.
    for (const r of master) {
      const f = r.fields;
      const c = centreOf(f['Centre']);
      const who = String(f['Commercial'] ?? '').trim() || 'Non attribué';
      const src = String(f['Source'] ?? '').trim() || 'Non renseignée';
      const createdDay = dayOf(f['Création']);
      const created = period(createdDay);
      if (created) {
        bucket(created, c).leads++;
        if (created === 'cur') {
          (sources[src] ??= { leads: 0, bilans: 0 }).leads++;
          leadsParJour[createdDay!] = (leadsParJour[createdDay!] ?? 0) + 1;
          if (who !== 'Non attribué') com(who).leads++;
        }
      }
      // Appels passés dans la période, quel que soit le jour d'arrivée du prospect.
      for (const p of ['cur', 'prev'] as const) {
        const calls = CALLS.filter(([d]) => period(dayOf(f[d])) === p);
        if (!calls.length) continue;
        const answered = calls.some(([, rep]) => Boolean(f[rep]));
        const s = bucket(p, c);
        s.appels += calls.length; s.appeles++; if (answered) s.joints++;
        if (p === 'cur') { const k = com(who); k.appels += calls.length; k.appeles++; if (answered) k.joints++; }
      }
      const placed = period(dayOf(f['Date Bilan Placé']));
      if (placed) {
        bucket(placed, c).bilans++;
        if (placed === 'cur') {
          (sources[src] ??= { leads: 0, bilans: 0 }).bilans++;
          const k = com(who);
          k.bilans++;
          const statut = String(f['Statut'] ?? '').trim();
          if (statut === 'Converti' || statut === 'Non convertie') k.venus++;
          if (statut === 'Converti') k.cures++;
          if (statut.startsWith('Bilan annulé')) k.annules++;
          if (statut === 'RDV manqué') k.manques++;
        }
      }
    }

    // ② Centre
    for (const r of clients) {
      const f = r.fields;
      const m = period(dayOf(f['Date bilan']) ?? dayOf(f['date de création']));
      if (!m) continue;
      const s = bucket(m, centreOf(f['Centre']));
      const cure = CURES.reduce((t, k) => t + (Number(f[k]) || 0), 0);
      const bilanSeul = Number(f['Bilan seul']) || 0;
      s.realises++;
      s.caBilans += bilanSeul;
      if (cure > 0) { s.cures++; s.ca += cure; }
      if (m === 'cur') {
        const names = people(f['Thérapeute']);
        for (const n of names.length ? names : ['Non renseignée']) {
          const t = (therapeutes[n] ??= { bilans: 0, cures: 0, ca: 0 });
          t.bilans++;
          if (cure > 0) { t.cures++; t.ca += cure / Math.max(1, names.length); }
        }
      }
    }

    return {
      from, to, prevFrom, prevTo,
      centres: CENTRES,
      current: byMonth.cur ?? {},
      prev: byMonth.prev ?? {},
      sources,
      commerciales,
      therapeutes,
      leadsParJour,
      updatedAt: new Date().toISOString(),
    };
  }
}
