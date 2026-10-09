import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp } from 'lucide-react';
import { useStore } from '../state/store';
import { readAsana, type AsanaImport } from '../lib/asana';
import { Button, Field, Input, Modal, PeoplePicker } from './ui';

/** Importer un projet exporté d'Asana (CSV) : étapes, tâches, sous-tâches et notes. */
export function ImportAsanaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snap, me, importProject } = useStore();
  const nav = useNavigate();
  const [data, setData] = useState<AsanaImport | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [fresh, setFresh] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => { setData(null); setError(''); setName(''); setStart(''); setEnd(''); setMembers([]); setFresh(true); };
  const close = () => { reset(); onClose(); };

  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const d = readAsana(await file.text(), snap.profiles);
      if (!d.tasks.length) throw new Error('Aucune tâche trouvée dans ce fichier.');
      setData(d);
      setName(d.name);
      setMembers(me ? [me.id] : []);
    } catch (e) { setError((e as Error).message); setData(null); }
  };

  const submit = async () => {
    if (!data || !name.trim()) return;
    setBusy(true);
    try {
      const tasks = fresh
        ? data.tasks.map((t) => ({ ...t, status: 'a_faire' as const, done_at: null, checklist: t.checklist.map((c) => ({ ...c, done: false })) }))
        : data.tasks;
      const ids = new Set(members);
      for (const t of tasks) for (const a of t.assignee_ids) ids.add(a);
      const id = await importProject({ name: name.trim(), description: 'Importé d’Asana.', start_date: start, end_date: end, phases: data.phases, member_ids: [...ids] }, tasks);
      close();
      nav(`/projets/${id}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Importer un projet Asana"
      footer={<><Button variant="tertiaire" onClick={close}>Annuler</Button><Button variant="primaire" disabled={!data || !name.trim() || busy} onClick={submit}>{busy ? 'Import…' : 'Créer le projet'}</Button></>}
    >
      {!data ? (
        <div className="grid gap-4">
          <p className="text-sm text-mab-texte">Dans Asana, ouvre le projet puis la flèche à côté de son nom → <b>Exporter / Imprimer</b> → <b>CSV</b>. Dépose ici le fichier obtenu : les sections deviennent des étapes, les tâches gardent leurs sous-tâches (même sur plusieurs niveaux), leurs notes et leurs liens.</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-mab-carte border border-dashed border-mab-filet-aqua bg-mab-wash px-5 py-8 text-center text-sm font-medium text-mab-aqua-texte hover:bg-mab-wash-2">
            <FileUp size={22} /> Choisir le fichier CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {error && <p className="text-sm text-mab-erreur">{error}</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-mab-champ bg-mab-wash px-4 py-3 text-sm">
            <p><b>{data.phases.length}</b> étape{data.phases.length > 1 ? 's' : ''} · <b>{data.stats.tasks}</b> tâches · <b>{data.stats.subtasks}</b> sous-tâches</p>
            <ul className="mt-1.5 list-disc pl-5 text-mab-texte">{data.phases.map((p) => <li key={p}>{p} <span className="text-mab-gris-doux">· {data.tasks.filter((t) => t.phase === p).length} tâches</span></li>)}</ul>
          </div>
          <Field label="Nom du projet"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début (facultatif)"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Fin (facultatif)"><Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Personnes sur le projet">
            <PeoplePicker people={snap.profiles.filter((x) => x.active)} value={members} onChange={setMembers} />
          </Field>
          {(data.stats.done > 0 || data.tasks.some((t) => t.checklist.some((c) => c.done))) && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="mt-0.5 accent-mab-aqua" />
              <span>Repartir de zéro <span className="text-mab-texte">(certaines tâches étaient cochées dans Asana ; on les décoche pour ce nouveau projet)</span></span>
            </label>
          )}
          <p className="text-xs text-mab-gris-doux">Les dates et les responsables présents dans Asana sont repris quand l’adresse e-mail correspond à quelqu’un de l’équipe. Tu pourras ensuite placer les dates dans la vue Chronologie.</p>
          <button className="justify-self-start text-sm text-mab-aqua-texte underline" onClick={reset}>Choisir un autre fichier</button>
        </div>
      )}
    </Modal>
  );
}
