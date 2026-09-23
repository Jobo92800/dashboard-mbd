import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListPlus, Search } from 'lucide-react';
import { useStore } from '../state/store';
import { CENTRES, PRIORITIES } from '../lib/types';
import { isDone, isLate, sortTasks } from '../lib/selectors';
import { isAdmin } from '../lib/permissions';
import { TaskRow } from '../components/TaskRow';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { Button, Card, Empty, PageTitle, Tabs } from '../components/ui';

type TabId = 'miennes' | 'rapides' | 'retard' | 'toutes';
const sel = 'h-10 rounded-mab-pilule border border-mab-filet bg-white px-4 text-sm text-mab-encre';

export default function Tasks() {
  const { snap, me } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>('miennes');
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [q, setQ] = useState('');
  const [person, setPerson] = useState('');
  const [prio, setPrio] = useState('');
  const [centre, setCentre] = useState('');
  const [project, setProject] = useState('');
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (params.get('nouvelle')) { setDraft({}); params.delete('nouvelle'); setParams(params, { replace: true }); return; }
    const tid = params.get('tache');
    const t = tid && snap.tasks.find((x) => x.id === tid);
    if (t) { setDraft(t); params.delete('tache'); setParams(params, { replace: true }); }
  }, [params, snap.tasks, setParams]);

  const base = useMemo(() => {
    switch (tab) {
      case 'miennes': return snap.tasks.filter((t) => t.assignee_id === me!.id);
      case 'rapides': return snap.tasks.filter((t) => !t.project_id);
      case 'retard': return snap.tasks.filter(isLate);
      default: return snap.tasks;
    }
  }, [tab, snap.tasks, me]);

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = sortTasks(base.filter((t) =>
    (showDone || !isDone(t)) &&
    (!person || t.assignee_id === person) &&
    (!prio || t.priority === prio) &&
    (!centre || t.centre === centre) &&
    (!project || (project === 'rapide' ? !t.project_id : t.project_id === project)) &&
    (!q || norm(t.title + ' ' + t.note).includes(norm(q))),
  ));

  const count = (f: (t: typeof snap.tasks[number]) => boolean) => snap.tasks.filter((t) => !isDone(t) && f(t)).length;

  return (
    <>
      <PageTitle title={<>Toutes les <b>tâches</b></>} sub="Tâches de projets et tâches rapides : appels, commandes, relances, administratif.">
        <Button variant="primaire" onClick={() => setDraft({})}><ListPlus size={17} /> Nouvelle tâche rapide</Button>
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { id: 'miennes', label: 'Les miennes', count: count((t) => t.assignee_id === me!.id) },
          { id: 'rapides', label: 'Rapides', count: count((t) => !t.project_id) },
          { id: 'retard', label: 'En retard', count: snap.tasks.filter(isLate).length },
          { id: 'toutes', label: isAdmin(me) ? 'Toutes' : 'Toutes celles que je vois', count: count(() => true) },
        ]} />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-mab-pilule border border-mab-filet px-4">
          <Search size={15} className="text-mab-gris" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par mot-clé" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        {tab !== 'miennes' && (
          <select className={sel} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Toutes les personnes</option>
            {snap.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
        <select className={sel} value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Tous les projets</option>
          <option value="rapide">Hors projet (rapides)</option>
          {snap.projects.filter((p) => p.status !== 'archive').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={sel} value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="">Toutes priorités</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className={sel} value={centre} onChange={(e) => setCentre(e.target.value)}>
          <option value="">Tous les centres</option>
          {CENTRES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm text-mab-texte"><input type="checkbox" className="accent-mab-aqua" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Afficher les faites</label>
      </Card>

      {list.length === 0 ? (
        <Empty title={tab === 'retard' ? 'Aucun retard, bravo' : 'Aucune tâche'} text="Change les filtres ou ajoute une tâche." />
      ) : (
        <Card className="px-5 py-2">
          {list.map((t) => <TaskRow key={t.id} task={t} showProject onEdit={setDraft} />)}
        </Card>
      )}
      <p className="mt-3 text-sm text-mab-texte">{list.length} tâche{list.length > 1 ? 's' : ''}</p>

      <TaskModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
