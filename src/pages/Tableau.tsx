import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { format, getDaysInMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, Target } from 'lucide-react';
import { useStore } from '../state/store';
import { backend } from '../data';
import { isAdmin } from '../lib/permissions';
import type { Objective } from '../lib/types';
import { Button, Card, Empty, IconButton, Input, Modal, PageTitle, Surtitre } from '../components/ui';

type Stat = { leads: number; joints: number; bilans: number; realises: number; cures: number; ca: number; caBilans: number };
type Commerciale = { leads: number; joints: number; bilans: number; venus: number; annules: number; manques: number; cures: number };
type Therapeute = { bilans: number; cures: number; ca: number };
type Data = {
  month: string; previous: string; centres: string[];
  current: Record<string, Stat>; prev: Record<string, Stat>;
  sources: Record<string, { leads: number; bilans: number }>;
  commerciales: Record<string, Commerciale>;
  therapeutes: Record<string, Therapeute>;
  leadsParJour: Record<string, number>;
  updatedAt: string;
};
/** Chiffres clés, dans l'ordre du parcours. `obj` = champ d'objectif correspondant. */
const KEYS: { id: keyof Stat; label: string; short: string; step: 'tel' | 'centre'; obj?: 'leads' | 'bilans' | 'conversions' | 'ca' }[] = [
  { id: 'leads', label: 'Prospects reçus', short: 'Prospects', step: 'tel', obj: 'leads' },
  { id: 'bilans', label: 'Bilans placés', short: 'Bilans placés', step: 'tel', obj: 'bilans' },
  { id: 'realises', label: 'Bilans réalisés', short: 'Bilans réalisés', step: 'centre' },
  { id: 'cures', label: 'Cures vendues', short: 'Cures', step: 'centre', obj: 'conversions' },
  { id: 'ca', label: 'CA cures', short: 'CA', step: 'centre', obj: 'ca' },
];
const OBJ_KEYS = [
  { id: 'leads', label: 'Prospects' }, { id: 'bilans', label: 'Bilans placés' }, { id: 'conversions', label: 'Cures' }, { id: 'ca', label: 'CA cures (€)' },
] as const;
const CENTRES = ['Le Grau-du-Roi', 'Le Crès', 'Sérignan', 'Cabestany', 'Avignon'];
const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const isMoney = (k: keyof Stat) => k === 'ca' || k === 'caBilans';
const fmt = (k: keyof Stat, n: number) => (isMoney(k) ? euro(n) : new Intl.NumberFormat('fr-FR').format(n));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const sum = (rec: Record<string, Stat>, k: keyof Stat) => Object.values(rec).reduce((s, x) => s + (x[k] ?? 0), 0);
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
const shift = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };

/** Données d'exemple pour la démo (proches des volumes réels de septembre 2026). */
function demoData(month: string): Data {
  const base: Record<string, Stat> = {
    'Le Grau-du-Roi': { leads: 111, joints: 70, bilans: 18, realises: 16, cures: 11, ca: 14800, caBilans: 390 },
    'Le Crès': { leads: 72, joints: 45, bilans: 17, realises: 14, cures: 8, ca: 11600, caBilans: 520 },
    'Sérignan': { leads: 152, joints: 96, bilans: 25, realises: 19, cures: 12, ca: 13900, caBilans: 480 },
    'Cabestany': { leads: 129, joints: 80, bilans: 23, realises: 15, cures: 7, ca: 9800, caBilans: 770 },
    'Avignon': { leads: 125, joints: 83, bilans: 31, realises: 24, cures: 14, ca: 21400, caBilans: 390 },
  };
  const prev = Object.fromEntries(Object.entries(base).map(([c, s]) => [c, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 0.85)])) as Stat]));
  return {
    month, previous: shift(month, -1), centres: CENTRES, current: base, prev,
    sources: { 'Facebook Ads': { leads: 402, bilans: 71 }, 'LP-Google': { leads: 88, bilans: 19 }, 'Bioportrait': { leads: 54, bilans: 14 }, 'Site Web': { leads: 29, bilans: 6 }, 'Instagram Ads': { leads: 16, bilans: 4 } },
    commerciales: {
      Marie: { leads: 210, joints: 140, bilans: 41, venus: 22, annules: 3, manques: 2, cures: 13 },
      Leslie: { leads: 180, joints: 115, bilans: 33, venus: 18, annules: 4, manques: 1, cures: 9 },
      Alex: { leads: 90, joints: 60, bilans: 16, venus: 7, annules: 1, manques: 1, cures: 4 },
    },
    therapeutes: {
      Laura: { bilans: 12, cures: 8, ca: 11200 }, Caroll: { bilans: 11, cures: 7, ca: 7900 }, Marie: { bilans: 10, cures: 6, ca: 8100 },
      Malvina: { bilans: 8, cures: 5, ca: 6100 }, Alex: { bilans: 7, cures: 4, ca: 6400 }, Sara: { bilans: 8, cures: 3, ca: 3600 }, Marine: { bilans: 7, cures: 4, ca: 5200 },
    },
    leadsParJour: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`${month}-${String(i + 1).padStart(2, '0')}`, 12 + ((i * 7) % 19)])),
    updatedAt: new Date().toISOString(),
  };
}

export default function Tableau() {
  const { me, mode, snap } = useStore();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editObj, setEditObj] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setLoading(true); setError('');
    try {
      if (mode === 'demo') { setData(demoData(month)); return; }
      const token = await backend.accessToken();
      const res = await fetch(`/.netlify/functions/tableau?mois=${month}${fresh ? '&rafraichir=1' : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Tableau indisponible.');
      setData(body as Data);
    } catch (e) { setError((e as Error).message); setData(null); }
    finally { setLoading(false); }
  }, [month, mode]);
  useEffect(() => { load(); }, [load]);

  const objectives = useMemo(() => new Map(snap.objectives.filter((o) => o.month === month).map((o) => [o.centre, o])), [snap.objectives, month]);
  if (!isAdmin(me)) return <Navigate to="/" replace />;

  const today = new Date().toISOString().slice(0, 10);
  const isCurrent = month === today.slice(0, 7);
  const daysIn = getDaysInMonth(parseISO(`${month}-01`));
  const elapsed = isCurrent ? Number(today.slice(8, 10)) : daysIn;
  const project = (n: number) => (isCurrent && elapsed > 0 ? Math.round((n / elapsed) * daysIn) : n);
  const objTotal = (k?: keyof Objective) => { if (!k) return null; const vals = CENTRES.map((c) => objectives.get(c)?.[k] as number | null | undefined).filter((v): v is number => typeof v === 'number'); return vals.length ? vals.reduce((a, b) => a + b, 0) : null; };
  const t = (k: keyof Stat) => (data ? sum(data.current, k) : 0);

  return (
    <>
      <PageTitle title={<>Tableau de <b>bord</b></>} sub="Au téléphone avec CRM 2026, en centre avec CRM News.">
        <Button onClick={() => setEditObj(true)}><Target size={16} /> Objectifs du mois</Button>
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <IconButton label="Mois précédent" onClick={() => setMonth(shift(month, -1))}><ChevronLeft size={18} /></IconButton>
        <h2 className="min-w-[150px] text-center text-lg font-semibold capitalize">{format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: fr })}</h2>
        <IconButton label="Mois suivant" disabled={isCurrent} onClick={() => setMonth(shift(month, 1))}><ChevronRight size={18} /></IconButton>
        {isCurrent && <span className="text-xs text-mab-texte">Jour {elapsed} / {daysIn} · projection fin de mois au rythme actuel</span>}
        <Button variant="discret" className="ml-auto" disabled={loading} onClick={() => load(true)}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser</Button>
      </div>
      {mode === 'demo' && <p className="mb-4 rounded-mab-champ bg-mab-violet-wash px-4 py-2 text-sm text-mab-violet-texte">Démo : chiffres d’exemple. En ligne, ils viennent de ton Airtable.</p>}

      {error === 'non_configure' ? (
        <Empty title="Tableau pas encore branché sur Airtable" text="Il faut une fois lancer la commande « npm run airtable:configurer » avec ton jeton Airtable (lecture seule). Claude t’indique la marche à suivre." />
      ) : error ? (
        <Empty title="Impossible de lire Airtable" text={error} action={<Button variant="secondaire" onClick={() => load(true)}>Réessayer</Button>} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-mab-carte bg-white" />)}</div>
      ) : (
        <>
          {/* Le parcours en un coup d'œil */}
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {KEYS.map((k, i) => {
              const v = t(k.id);
              const p = sum(data.prev, k.id);
              const delta = p ? Math.round(((v - p) / p) * 100) : null;
              const obj = objTotal(k.obj);
              const first = i === 0 || KEYS[i - 1].step !== k.step;
              return (
                <Card key={k.id} className={`px-4 py-4 sm:px-5 ${k.id === 'ca' ? 'col-span-2 lg:col-span-1' : ''}`}>
                  <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${first ? (k.step === 'tel' ? 'text-mab-aqua-texte' : 'text-mab-violet-texte') : 'text-transparent max-lg:hidden'}`}>{k.step === 'tel' ? '① Téléphone' : '② Centre'}</p>
                  <p className="text-sm text-mab-texte">{k.label}</p>
                  <p className="mt-1 text-[28px] font-light tabular-nums leading-tight text-mab-encre sm:text-[32px]">{fmt(k.id, v)}</p>
                  {delta !== null && (
                    <p className={`text-xs font-medium ${delta >= 0 ? 'text-mab-succes' : 'text-mab-erreur'}`}>
                      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} % <span className="font-normal text-mab-texte">vs {format(parseISO(`${data.previous}-01`), 'MMMM', { locale: fr })}</span>
                    </p>
                  )}
                  {obj !== null && <ObjBar value={v} goal={obj} projected={project(v)} fmtv={(n) => fmt(k.id, n)} />}
                </Card>
              );
            })}
          </div>

          {/* ① Téléphone */}
          <section className="mb-8">
            <Surtitre>① Au téléphone · les commerciales</Surtitre>
            <h2 className="mb-3 mt-1 text-xl font-light">Des prospects aux <b className="font-semibold">bilans placés</b></h2>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Rate label="Prospects joints" value={pct(t('joints'), t('leads'))} hint={`${t('joints')} sur ${t('leads')}`} />
              <Rate label="Joint → bilan placé" value={pct(t('bilans'), t('joints'))} hint={`${t('bilans')} bilans`} />
              <Rate label="Prospect → bilan placé" value={pct(t('bilans'), t('leads'))} hint="taux global" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 text-lg font-semibold">Bilans placés par commerciale</h3>
                <HBars rows={Object.entries(data.commerciales).filter(([, s]) => s.bilans).sort((a, b) => b[1].bilans - a[1].bilans).map(([name, s]) => ({
                  name, value: s.bilans,
                  extra: [s.joints ? `${pct(s.bilans, s.joints)} % des joints` : null, `${s.venus} venu${s.venus > 1 ? 's' : ''}`, s.annules ? `${s.annules} annulé${s.annules > 1 ? 's' : ''}` : null, s.manques ? `${s.manques} absent${s.manques > 1 ? 's' : ''}` : null].filter(Boolean).join(' · '),
                }))} />
                <p className="mt-3 text-xs text-mab-gris-doux">« Venus » : bilans placés ce mois-ci dont la cliente est déjà passée en centre. Les autres ont leur rendez-vous plus tard.</p>
              </Card>
              <Card className="p-5">
                <h3 className="mb-3 text-lg font-semibold">D’où viennent les prospects</h3>
                <HBars rows={Object.entries(data.sources).sort((a, b) => b[1].leads - a[1].leads).map(([name, s]) => ({ name, value: s.leads, extra: `${plural(s.bilans, 'bilan')} · ${pct(s.bilans, s.leads)} %` }))} />
              </Card>
            </div>
          </section>

          {/* ② Centre */}
          <section className="mb-8">
            <Surtitre>② En centre · les thérapeutes</Surtitre>
            <h2 className="mb-3 mt-1 text-xl font-light">Des bilans réalisés aux <b className="font-semibold">cures vendues</b></h2>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Rate label="Bilan → cure" value={pct(t('cures'), t('realises'))} hint={`${t('cures')} sur ${t('realises')} bilans`} />
              <Card className="px-4 py-3"><p className="text-xs text-mab-texte">Panier moyen</p><p className="text-xl font-light tabular-nums">{t('cures') ? euro(t('ca') / t('cures')) : '—'}</p></Card>
              <Card className="px-4 py-3"><p className="text-xs text-mab-texte">Bilans seuls encaissés</p><p className="text-xl font-light tabular-nums">{euro(t('caBilans'))}</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="mb-3 text-lg font-semibold">Cures vendues par thérapeute</h3>
              <HBars rows={Object.entries(data.therapeutes).sort((a, b) => b[1].cures - a[1].cures || b[1].bilans - a[1].bilans).map(([name, s]) => ({
                name, value: s.cures, extra: `${plural(s.bilans, 'bilan')} · ${pct(s.cures, s.bilans)} % · ${euro(s.ca)}`,
              }))} limit={12} />
              <p className="mt-3 text-xs text-mab-gris-doux">Quand deux thérapeutes sont notées sur une fiche, la cure compte pour chacune et le montant est partagé.</p>
            </Card>
          </section>

          {/* Par centre */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-light">Par <b className="font-semibold">centre</b></h2>
            <CentreTable data={data} objectives={objectives} project={project} isCurrent={isCurrent} />
          </section>

          <Card className="p-5">
            <Surtitre>Rythme</Surtitre>
            <h2 className="mb-3 mt-1 text-lg font-semibold">Nouveaux prospects par jour</h2>
            <DailyBars month={month} values={data.leadsParJour} />
          </Card>

          <p className="mt-4 text-xs text-mab-gris-doux">Données Airtable lues le {format(new Date(data.updatedAt), "d MMMM 'à' HH:mm", { locale: fr })} (mises en cache 5 min). Téléphone : fiches CRM 2026 créées ce mois-ci, y compris celles passées en « Perdu / Injoignable » ; un bilan compte au jour où il est placé. Centre : fiches clientes CRM News dont le bilan a eu lieu ce mois-ci ; une cure est vendue quand un montant de cure est renseigné.</p>
        </>
      )}

      <ObjectivesModal open={editObj} month={month} objectives={objectives} onClose={() => setEditObj(false)} />
    </>
  );
}

function Rate({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-mab-texte">{label}</p>
      <p className="text-xl font-light tabular-nums">{value} %</p>
      {hint && <p className="text-[11px] text-mab-gris-doux">{hint}</p>}
    </Card>
  );
}

/** Progression vers l'objectif, avec la projection en fin de mois. */
function ObjBar({ value, goal, projected, fmtv }: { value: number; goal: number; projected: number; fmtv: (n: number) => string }) {
  const p = goal ? Math.min(100, (value / goal) * 100) : 0;
  const reached = value >= goal;
  return (
    <div className="mt-2" title={`${fmtv(value)} sur ${fmtv(goal)} · projection ${fmtv(projected)}`}>
      <div className="h-1.5 overflow-hidden rounded-mab-pilule bg-mab-rail">
        <div className={`h-full rounded-mab-pilule ${reached ? 'bg-mab-succes' : 'bg-mab-aqua'}`} style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-mab-texte">{Math.round((value / goal) * 100)} % de l’objectif ({fmtv(goal)}){projected !== value && !reached && <> · projection {fmtv(projected)}</>}</p>
    </div>
  );
}

const COLS: { id: keyof Stat; label: string; obj?: keyof Objective }[] = [
  { id: 'leads', label: 'Prospects', obj: 'leads' },
  { id: 'bilans', label: 'Bilans placés', obj: 'bilans' },
  { id: 'realises', label: 'Bilans réalisés' },
  { id: 'cures', label: 'Cures', obj: 'conversions' },
  { id: 'ca', label: 'CA cures', obj: 'ca' },
];

function CentreTable({ data, objectives, project, isCurrent }: { data: Data; objectives: Map<string, Objective>; project: (n: number) => number; isCurrent: boolean }) {
  const rows = [...CENTRES, ...Object.keys(data.current).filter((c) => !CENTRES.includes(c))];
  const max = (k: keyof Stat) => Math.max(1, ...rows.map((c) => data.current[c]?.[k] ?? 0));
  const stat = (c: string): Stat => data.current[c] ?? { leads: 0, joints: 0, bilans: 0, realises: 0, cures: 0, ca: 0, caBilans: 0 };
  const cell = (c: string, col: typeof COLS[number]) => {
    const v = stat(c)[col.id] ?? 0;
    const goal = col.obj ? (objectives.get(c)?.[col.obj] as number | null | undefined) : null;
    return (
      <div className="min-w-[88px]" title={`${c} · ${col.label} : ${fmt(col.id, v)}${goal ? ` / objectif ${fmt(col.id, goal)}` : ''}`}>
        <p className="tabular-nums text-mab-encre">{fmt(col.id, v)}{goal ? <span className="text-xs text-mab-texte"> / {fmt(col.id, goal)}</span> : null}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-mab-pilule bg-mab-rail">
          <div className={`h-full rounded-mab-pilule ${goal && v >= goal ? 'bg-mab-succes' : 'bg-mab-aqua'}`} style={{ width: `${goal ? Math.min(100, (v / goal) * 100) : (v / max(col.id)) * 100}%` }} />
        </div>
        {isCurrent && goal && v < goal ? <p className="mt-0.5 text-[10px] text-mab-gris-doux">→ {fmt(col.id, project(v))} fin de mois</p> : null}
      </div>
    );
  };
  const Taux = ({ s }: { s: Stat }) => (
    <>
      <span title="Prospects → bilans placés (téléphone)">Placement {pct(s.bilans, s.leads)} %</span>
      <span title="Bilans réalisés → cures (centre)">Closing {pct(s.cures, s.realises)} %</span>
    </>
  );
  return (
    <>
      <Card className="overflow-x-auto max-sm:hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mab-filet text-left text-xs text-mab-texte">
              <th className="px-5 py-3 font-medium">Centre</th>
              <th className="px-3 py-3 font-medium">Prospects</th>
              <th className="px-3 py-3 font-medium">Bilans placés</th>
              <th className="bg-mab-wash px-3 py-3 font-medium text-mab-aqua-texte">Placement</th>
              <th className="px-3 py-3 font-medium">Bilans réalisés</th>
              <th className="px-3 py-3 font-medium">Cures</th>
              <th className="bg-mab-wash px-3 py-3 font-medium text-mab-violet-texte">Closing</th>
              <th className="px-3 py-3 font-medium">CA cures</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const s = stat(c);
              return (
                <tr key={c} className="border-b border-mab-filet align-top last:border-0">
                  <td className="px-5 py-3 font-semibold">{c}</td>
                  <td className="px-3 py-3">{cell(c, COLS[0])}</td>
                  <td className="px-3 py-3">{cell(c, COLS[1])}</td>
                  <td className="bg-mab-wash px-3 py-3 font-semibold tabular-nums">{pct(s.bilans, s.leads)} %</td>
                  <td className="px-3 py-3">{cell(c, COLS[2])}</td>
                  <td className="px-3 py-3">{cell(c, COLS[3])}</td>
                  <td className="bg-mab-wash px-3 py-3 font-semibold tabular-nums">{pct(s.cures, s.realises)} %</td>
                  <td className="px-3 py-3">{cell(c, COLS[4])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-3 sm:hidden">
        {rows.map((c) => {
          const s = stat(c);
          return (
            <Card key={c} className="p-4">
              <p className="mb-3 font-semibold">{c}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {COLS.map((col) => <div key={col.id}><p className="text-xs text-mab-texte">{col.label}</p>{cell(c, col)}</div>)}
              </div>
              <p className="mt-3 flex gap-4 text-xs font-medium text-mab-encre"><Taux s={s} /></p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function HBars({ rows, limit = 8 }: { rows: { name: string; value: number; extra: string }[]; limit?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-mab-texte">Pas de données ce mois-ci.</p>;
  return (
    <div className="grid gap-2.5">
      {rows.slice(0, limit).map((r) => (
        <div key={r.name} title={`${r.name} : ${r.value} · ${r.extra}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.name}</span>
            <span className="shrink-0 tabular-nums"><b>{r.value}</b> <span className="text-xs text-mab-texte">· {r.extra}</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-mab-pilule bg-mab-rail"><div className="h-full rounded-r-[4px] bg-mab-aqua" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function DailyBars({ month, values }: { month: string; values: Record<string, number> }) {
  const days = getDaysInMonth(parseISO(`${month}-01`));
  const list = Array.from({ length: days }, (_, i) => { const d = `${month}-${String(i + 1).padStart(2, '0')}`; return { d, v: values[d] ?? 0 }; });
  const max = Math.max(1, ...list.map((x) => x.v));
  const total = list.reduce((s, x) => s + x.v, 0);
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`Prospects par jour, total ${total}`}>
        {list.map((x) => (
          <div key={x.d} className="group relative flex h-full flex-1 items-end" title={`${format(parseISO(x.d), 'd MMM', { locale: fr })} : ${x.v} prospect${x.v > 1 ? 's' : ''}`}>
            <div className="w-full rounded-t-[4px] bg-mab-aqua transition group-hover:bg-mab-aqua-texte" style={{ height: `${(x.v / max) * 100}%`, minHeight: x.v ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-mab-gris-doux"><span>1</span><span>{Math.ceil(days / 2)}</span><span>{days}</span></div>
    </div>
  );
}

function ObjectivesModal({ open, month, objectives, onClose }: { open: boolean; month: string; objectives: Map<string, Objective>; onClose: () => void }) {
  const { saveObjective } = useStore();
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    if (!open) return;
    setVals(Object.fromEntries(CENTRES.map((c) => { const o = objectives.get(c); return [c, { leads: o?.leads?.toString() ?? '', bilans: o?.bilans?.toString() ?? '', conversions: o?.conversions?.toString() ?? '', ca: o?.ca?.toString() ?? '' }]; })));
  }, [open, objectives]);
  if (!open) return null;
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')) || 0);
  const save = async () => {
    for (const c of CENTRES) {
      const v = vals[c];
      await saveObjective({ id: `${month}:${c}`, month, centre: c, leads: num(v.leads), bilans: num(v.bilans), conversions: num(v.conversions), ca: num(v.ca) });
    }
    onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={`Objectifs · ${format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: fr })}`}
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" onClick={save}>Enregistrer les objectifs</Button></>}>
      <div className="grid gap-4">
        {CENTRES.map((c) => (
          <div key={c}>
            <p className="mb-1.5 text-sm font-semibold">{c}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OBJ_KEYS.map((k) => (
                <label key={k.id} className="block">
                  <span className="mb-1 block text-xs text-mab-texte">{k.label}</span>
                  <Input inputMode="numeric" value={vals[c]?.[k.id] ?? ''} onChange={(e) => setVals({ ...vals, [c]: { ...vals[c], [k.id]: e.target.value } })} className="!h-10" />
                </label>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-mab-gris-doux">Laisse vide ce que tu ne veux pas suivre. Les objectifs sont visibles uniquement par les administrateurs.</p>
      </div>
    </Modal>
  );
}
