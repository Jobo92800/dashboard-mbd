// Tableau de bord direction, en deux temps comme le parcours réel :
//  ① Téléphone (commerciales) — base « CRM 2026 » : prospects → joints → bilans placés.
//  ② Centre (thérapeutes) — base « CRM News », table Clients : une fiche par bilan
//     réalisé en centre ; une cure est vendue quand « Montant Cure » est renseigné.
// Réservé aux administrateurs. GET ?mois=AAAA-MM
import { callerProfile, json } from '../lib/server.mts';

const CRM = process.env.AIRTABLE_BASE_ID || 'appNML7rJEKiWkuVg';
const MASTER = process.env.AIRTABLE_TABLE_ID || 'tblgCdNITlPy74Z5G';
const PERDU = 'tblSyB6j2gvKtvo4Y';
const NEWS = process.env.AIRTABLE_CLIENTS_BASE_ID || 'appI97jEL2mSCg3Wc';
const CLIENTS = 'tblfqxwGePzeiWqqY';
const CENTRES = ['Le Grau-du-Roi', 'Le Crès', 'Sérignan', 'Cabestany', 'Avignon'] as const;
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

/** Mois « AAAA-MM » d'une date Airtable, à l'heure de Paris. */
function monthOf(v: unknown) {
  if (!v || typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 7);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
}
const dayOf = (v: unknown) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(String(v)));

const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};

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

/** Le IF est indispensable : sur une date vide, DATETIME_FORMAT renvoie une erreur
 *  qui fait écarter la fiche entière, même quand l'autre moitié du OR est vraie. */
const inMonths = (field: string, months: string[]) =>
  `OR(${months.map((m) => `IF({${field}},DATETIME_FORMAT(SET_TIMEZONE({${field}},'Europe/Paris'),'YYYY-MM'),'')='${m}'`).join(',')})`;

/** Par centre et par mois. */
type Stat = { leads: number; joints: number; bilans: number; realises: number; cures: number; ca: number; caBilans: number };
const empty = (): Stat => ({ leads: 0, joints: 0, bilans: 0, realises: 0, cures: 0, ca: 0, caBilans: 0 });
/** Sort des bilans placés par une commerciale. */
type Commerciale = { leads: number; joints: number; bilans: number; venus: number; annules: number; manques: number; cures: number };
type Therapeute = { bilans: number; cures: number; ca: number };

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

  try {
    const data = await compute(month);
    cache.set(month, { at: Date.now(), data });
    return json(200, data);
  } catch (e) {
    console.error(e);
    return json(502, { error: (e as Error).message });
  }
};

export async function compute(month: string) {
  const months = [month, prevMonth(month)];
  {
    const phoneFields = ['Centre', 'Création', 'Source', 'Commercial', 'Statut', 'Date Bilan Placé', 'Répondu Appel 1', 'Répondu Appel 2', 'Répondu Appel 3'];
    const [master, perdus, clients] = await Promise.all([
      fetchAll(CRM, MASTER, phoneFields, `OR(${inMonths('Création', months)},${inMonths('Date Bilan Placé', months)})`),
      fetchAll(CRM, PERDU, phoneFields, `OR(${inMonths('Création', months)},${inMonths('Date Bilan Placé', months)})`),
      fetchAll(NEWS, CLIENTS, ['Centre', 'Thérapeute', 'Date bilan', 'date de création', 'Bilan seul', ...CURES],
        `OR(${inMonths('Date bilan', months)},AND(NOT({Date bilan}),${inMonths('date de création', months)}))`),
    ]);

    const byMonth: Record<string, Record<string, Stat>> = {};
    const bucket = (m: string, c: string) => ((byMonth[m] ??= {})[c] ??= empty());
    const sources: Record<string, { leads: number; bilans: number }> = {};
    const commerciales: Record<string, Commerciale> = {};
    const therapeutes: Record<string, Therapeute> = {};
    const leadsParJour: Record<string, number> = {};
    const com = (n: string) => (commerciales[n] ??= { leads: 0, joints: 0, bilans: 0, venus: 0, annules: 0, manques: 0, cures: 0 });

    // ① Téléphone. Les fiches de « Perdu / Injoignable » sont recréées au moment où on les
    // y déplace : leur date de création n'est pas celle de l'arrivée du prospect, elles ne
    // comptent donc pas comme prospects du mois (seulement pour les bilans placés).
    const fromMaster = new Set(master);
    for (const r of [...master, ...perdus]) {
      const f = r.fields;
      const c = centreOf(f['Centre']);
      const who = String(f['Commercial'] ?? '').trim() || 'Non attribué';
      const src = String(f['Source'] ?? '').trim() || 'Non renseignée';
      const joint = Boolean(f['Répondu Appel 1'] || f['Répondu Appel 2'] || f['Répondu Appel 3']);
      const created = monthOf(f['Création']);
      if (created && months.includes(created) && fromMaster.has(r)) {
        const s = bucket(created, c);
        s.leads++;
        if (joint) s.joints++;
        if (created === month) {
          (sources[src] ??= { leads: 0, bilans: 0 }).leads++;
          leadsParJour[dayOf(f['Création'])] = (leadsParJour[dayOf(f['Création'])] ?? 0) + 1;
          if (who !== 'Non attribué') { com(who).leads++; if (joint) com(who).joints++; }
        }
      }
      const placed = monthOf(f['Date Bilan Placé']);
      if (placed && months.includes(placed)) {
        bucket(placed, c).bilans++;
        if (placed === month) {
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
      const m = monthOf(f['Date bilan']) ?? monthOf(f['date de création']);
      if (!m || !months.includes(m)) continue;
      const s = bucket(m, centreOf(f['Centre']));
      const cure = CURES.reduce((t, k) => t + (Number(f[k]) || 0), 0);
      const bilanSeul = Number(f['Bilan seul']) || 0;
      s.realises++;
      s.caBilans += bilanSeul;
      if (cure > 0) { s.cures++; s.ca += cure; }
      if (m === month) {
        const names = people(f['Thérapeute']);
        for (const n of names.length ? names : ['Non renseignée']) {
          const t = (therapeutes[n] ??= { bilans: 0, cures: 0, ca: 0 });
          t.bilans++;
          if (cure > 0) { t.cures++; t.ca += cure / Math.max(1, names.length); }
        }
      }
    }

    return {
      month,
      previous: months[1],
      centres: CENTRES,
      current: byMonth[month] ?? {},
      prev: byMonth[months[1]] ?? {},
      sources,
      commerciales,
      therapeutes,
      leadsParJour,
      updatedAt: new Date().toISOString(),
    };
  }
}
