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

type Stat = { leads: number; bilans: number; conversions: number; ca: number };
type Data = {
  month: string; previous: string; centres: string[];
  current: Record<string, Stat>; prev: Record<string, Stat>;
  sources: Record<string, { leads: number; conversions: number }>;
  commerciaux: Record<string, { bilans: number; conversions: number }>;
  leadsParJour: Record<string, number>;
  updatedAt: string;
};
const KEYS: { id: keyof Stat; label: string; short: string }[] = [
  { id: 'leads', label: 'Prospects', short: 'Prospects' },
  { id: 'bilans', label: 'Bilans placés', short: 'Bilans' },
  { id: 'conversions', label: 'Cures signées', short: 'Cures' },
  { id: 'ca', label: 'Chiffre d’affaires', short: 'CA' },
];
const CENTRES = ['Le Grau-du-Roi', 'Le Crès', 'Sérignan', 'Cabestany', 'Avignon'];
const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmt = (k: keyof Stat, n: number) => (k === 'ca' ? euro(n) : new Intl.NumberFormat('fr-FR').format(n));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const sum = (rec: Record<string, Stat>, k: keyof Stat) => Object.values(rec).reduce((s, x) => s + x[k], 0);
const shift = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };

/** Données d'exemple pour la démo (proches des volumes réels de septembre 2026). */
function demoData(month: string): Data {
  const base: Record<string, Stat> = {
    'Le Grau-du-Roi': { leads: 111, bilans: 18, conversions: 20, ca: 26400 },
    'Le Crès': { leads: 72, bilans: 17, conversions: 14, ca: 18480 },
    'Sérignan': { leads: 152, bilans: 25, conversions: 15, ca: 19800 },
    'Cabestany': { leads: 129, bilans: 23, conversions: 10, ca: 13200 },
    'Avignon': { leads: 125, bilans: 31, conversions: 17, ca: 22440 },
  };
  const prev = Object.fromEntries(Object.entries(base).map(([c, s]) => [c, { leads: Math.round(s.leads * 0.55), bilans: Math.round(s.bilans * 0.8), conversions: Math.round(s.conversions * 0.9), ca: Math.round(s.ca * 0.9) }]));
  return {
    month, previous: shift(month, -1), centres: CENTRES, current: base, prev,
    sources: { 'Facebook Ads': { leads: 402, conversions: 41 }, 'LP-Google': { leads: 88, conversions: 14 }, 'Bioportrait': { leads: 54, conversions: 12 }, 'Site Web': { leads: 29, conversions: 5 }, 'Instagram Ads': { leads: 16, conversions: 4 } },
    commerciaux: { Marie: { bilans: 38, conversions: 29 }, Leslie: { bilans: 31, conversions: 22 }, Elisa: { bilans: 27, conversions: 15 }, Flora: { bilans: 18, conversions: 10 } },
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
  const objTotal = (k: keyof Stat) => { const vals = CENTRES.map((c) => objectives.get(c)?.[k as keyof Objective] as number | null | undefined).filter((v): v is number => typeof v === 'number'); return vals.length ? vals.reduce((a, b) => a + b, 0) : null; };

  return (
    <>
      <PageTitle title={<>Tableau de <b>bord</b></>} sub="Prospects, bilans et cures par centre · source Airtable « CRM 2026 ».">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-mab-carte bg-white" />)}</div>
      ) : (
        <>
          {/* Chiffres clés */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KEYS.map((k) => {
              const v = sum(data.current, k.id);
              const p = sum(data.prev, k.id);
              const delta = p ? Math.round(((v - p) / p) * 100) : null;
              const obj = objTotal(k.id);
              return (
                <Card key={k.id} className="px-4 py-4 sm:px-5">
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

          {/* Taux */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Rate label="Prospect → bilan" value={pct(sum(data.current, 'bilans'), sum(data.current, 'leads'))} />
            <Rate label="Bilan → cure" value={pct(sum(data.current, 'conversions'), sum(data.current, 'bilans'))} />
            <Card className="px-4 py-3"><p className="text-xs text-mab-texte">Panier moyen</p><p className="text-xl font-light tabular-nums">{sum(data.current, 'conversions') ? euro(sum(data.current, 'ca') / sum(data.current, 'conversions')) : '—'}</p></Card>
          </div>

          {/* Par centre */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-light">Par <b className="font-semibold">centre</b></h2>
            <CentreTable data={data} objectives={objectives} project={project} isCurrent={isCurrent} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <Surtitre>Sources</Surtitre>
              <h2 className="mb-3 mt-1 text-lg font-semibold">D’où viennent les prospects</h2>
              <HBars rows={Object.entries(data.sources).sort((a, b) => b[1].leads - a[1].leads).map(([name, s]) => ({ name, value: s.leads, extra: `${s.conversions} cure${s.conversions > 1 ? 's' : ''} · ${pct(s.conversions, s.leads)} %` }))} />
            </Card>
            <Card className="p-5">
              <Surtitre>Équipe commerciale</Surtitre>
              <h2 className="mb-3 mt-1 text-lg font-semibold">Cures signées par commercial</h2>
              <HBars rows={Object.entries(data.commerciaux).sort((a, b) => b[1].conversions - a[1].conversions).map(([name, s]) => ({ name, value: s.conversions, extra: `${s.bilans} bilan${s.bilans > 1 ? 's' : ''} · ${pct(s.conversions, s.bilans)} %` }))} />
            </Card>
          </div>

          <Card className="mt-6 p-5">
            <Surtitre>Rythme</Surtitre>
            <h2 className="mb-3 mt-1 text-lg font-semibold">Nouveaux prospects par jour</h2>
            <DailyBars month={month} values={data.leadsParJour} />
          </Card>

          <p className="mt-4 text-xs text-mab-gris-doux">Données Airtable lues le {format(new Date(data.updatedAt), "d MMMM 'à' HH:mm", { locale: fr })} (mises en cache 5 min). Les prospects passés dans « Perdu / Injoignable » sont comptés dans les prospects du mois. Les taux comparent les volumes du mois : une cure signée ce mois-ci peut venir d’un bilan du mois précédent, d’où parfois plus de 100 %.</p>
        </>
      )}

      <ObjectivesModal open={editObj} month={month} objectives={objectives} onClose={() => setEditObj(false)} />
    </>
  );
}

function Rate({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-mab-texte">{label}</p>
      <p className="text-xl font-light tabular-nums">{value} %</p>
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

function CentreTable({ data, objectives, project, isCurrent }: { data: Data; objectives: Map<string, Objective>; project: (n: number) => number; isCurrent: boolean }) {
  const rows = [...CENTRES, ...Object.keys(data.current).filter((c) => !CENTRES.includes(c))];
  const max = (k: keyof Stat) => Math.max(1, ...rows.map((c) => data.current[c]?.[k] ?? 0));
  const cell = (c: string, k: keyof Stat) => {
    const v = data.current[c]?.[k] ?? 0;
    const goal = objectives.get(c)?.[k as keyof Objective] as number | null | undefined;
    return (
      <div className="min-w-[96px]" title={`${c} · ${KEYS.find((x) => x.id === k)!.label} : ${fmt(k, v)}${goal ? ` / objectif ${fmt(k, goal)}` : ''}`}>
        <p className="tabular-nums text-mab-encre">{fmt(k, v)}{goal ? <span className="text-xs text-mab-texte"> / {fmt(k, goal)}</span> : null}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-mab-pilule bg-mab-rail">
          <div className={`h-full rounded-mab-pilule ${goal && v >= goal ? 'bg-mab-succes' : 'bg-mab-aqua'}`} style={{ width: `${goal ? Math.min(100, (v / goal) * 100) : (v / max(k)) * 100}%` }} />
        </div>
        {isCurrent && goal && v < goal && <p className="mt-0.5 text-[10px] text-mab-gris-doux">→ {fmt(k, project(v))} fin de mois</p>}
      </div>
    );
  };
  return (
    <>
      <Card className="overflow-x-auto max-sm:hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mab-filet text-left text-xs text-mab-texte">
              <th className="px-5 py-3 font-medium">Centre</th>
              {KEYS.map((k) => <th key={k.id} className="px-3 py-3 font-medium">{k.label}</th>)}
              <th className="px-3 py-3 font-medium">Prospect → bilan</th>
              <th className="px-3 py-3 font-medium">Bilan → cure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const s = data.current[c] ?? { leads: 0, bilans: 0, conversions: 0, ca: 0 };
              return (
                <tr key={c} className="border-b border-mab-filet align-top last:border-0">
                  <td className="px-5 py-3 font-semibold">{c}</td>
                  {KEYS.map((k) => <td key={k.id} className="px-3 py-3">{cell(c, k.id)}</td>)}
                  <td className="px-3 py-3 tabular-nums">{pct(s.bilans, s.leads)} %</td>
                  <td className="px-3 py-3 tabular-nums">{pct(s.conversions, s.bilans)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-3 sm:hidden">
        {rows.map((c) => {
          const s = data.current[c] ?? { leads: 0, bilans: 0, conversions: 0, ca: 0 };
          return (
            <Card key={c} className="p-4">
              <p className="mb-3 font-semibold">{c}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {KEYS.map((k) => <div key={k.id}><p className="text-xs text-mab-texte">{k.short}</p>{cell(c, k.id)}</div>)}
              </div>
              <p className="mt-3 text-xs text-mab-texte">Prospect → bilan {pct(s.bilans, s.leads)} % · Bilan → cure {pct(s.conversions, s.bilans)} %</p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function HBars({ rows }: { rows: { name: string; value: number; extra: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-mab-texte">Pas de données ce mois-ci.</p>;
  return (
    <div className="grid gap-2.5">
      {rows.slice(0, 8).map((r) => (
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
              {KEYS.map((k) => (
                <label key={k.id} className="block">
                  <span className="mb-1 block text-xs text-mab-texte">{k.short}{k.id === 'ca' ? ' (€)' : ''}</span>
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
