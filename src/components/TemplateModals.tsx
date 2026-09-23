import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LayoutTemplate, Trash2 } from 'lucide-react';
import type { Project, ProjectTemplate } from '../lib/types';
import { useStore } from '../state/store';
import { fmtShort, todayIso } from '../lib/dates';
import { shiftIso } from '../lib/recurrence';
import { Button, Empty, Field, Input, Modal, PeoplePicker } from './ui';

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Formulaire « créer depuis un modèle », utilisé dans la fenêtre Créer un projet. */
export function FromTemplateForm({ tpl, onDone }: { tpl: ProjectTemplate; onDone: () => void }) {
  const { snap, createFromTemplate } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [ref, setRef] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(''); setRef(''); setMembers(tpl.member_ids.filter((id) => snap.profiles.some((p) => p.id === id && p.active))); }, [tpl, snap.profiles]);

  const dated = tpl.tasks.filter((t) => t.offset_days !== null);
  const first = dated.length ? Math.min(...dated.map((t) => t.offset_days!)) : 0;
  const last = dated.length ? Math.max(...dated.map((t) => t.offset_days!)) : 0;
  const past = ref && dated.some((t) => shiftIso(ref, t.offset_days!) < todayIso());
  const valid = name.trim() && ref;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const id = await createFromTemplate(tpl, { name: name.trim(), refDate: ref, memberIds: members, keepAssignees: keep });
    setBusy(false);
    onDone();
    nav(`/projets/${id}`);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du projet"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`Ex. ${tpl.name} · novembre`} /></Field>
        <Field label={tpl.reference_label || 'Date de référence'} help="Toutes les échéances se calent sur cette date.">
          <Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
      </div>
      {ref && (
        <div className="rounded-mab-champ bg-mab-wash-2 px-4 py-3 text-sm text-mab-aqua-texte">
          <b>{plural(tpl.tasks.length, 'tâche')}</b> réparties en {plural(tpl.phases.length, 'étape')}, du <b>{fmtShort(shiftIso(ref, first))}</b> au <b>{fmtShort(shiftIso(ref, last))}</b>.
          {past && <span className="mt-1 block text-mab-erreur">Attention : certaines échéances tombent déjà dans le passé.</span>}
        </div>
      )}
      <Field label="Personnes sur le projet">
        <PeoplePicker people={snap.profiles.filter((p) => p.active)} value={members} onChange={setMembers} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-mab-encre">
        <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Garder les mêmes responsables par tâche (sinon, tâches à attribuer)
      </label>
      <div className="flex justify-end">
        <Button variant="primaire" disabled={!valid || busy} onClick={submit}>{busy ? 'Création…' : `Créer le projet et ses ${tpl.tasks.length} tâches`}</Button>
      </div>
    </div>
  );
}

export function SaveTemplateModal({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { snap, saveTemplateFromProject } = useStore();
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [ref, setRef] = useState('');
  const [keep, setKeep] = useState(true);
  useEffect(() => { if (open) { setName(project.name); setLabel('Date clé'); setRef(project.end_date || project.start_date || todayIso()); } }, [open, project]);
  const count = useMemo(() => snap.tasks.filter((t) => t.project_id === project.id).length, [snap.tasks, project.id]);
  if (!open) return null;
  const valid = name.trim() && ref;
  return (
    <Modal
      open
      onClose={onClose}
      title="Enregistrer comme modèle"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid} onClick={() => { saveTemplateFromProject(project, { name: name.trim(), refDate: ref, label: label.trim(), keepAssignees: keep }); onClose(); }}>Enregistrer le modèle</Button></>}
    >
      <div className="grid gap-4">
        <p className="text-sm text-mab-texte">
          Les {plural(count, 'tâche')} et les étapes sont copiées. Chaque échéance est retenue <b>en nombre de jours avant ou après une date clé</b> : pour un webinaire, la date du live. Au prochain usage, il suffira de choisir la nouvelle date.
        </p>
        <Field label="Nom du modèle"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de la date clé" help="Ex. Jour du live, Lancement, Ouverture."><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Date clé dans ce projet"><Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Retenir qui fait quoi
        </label>
      </div>
    </Modal>
  );
}

export function DuplicateModal({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { duplicateProject } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(`${project.name} (copie)`); setStart(todayIso()); } }, [open, project]);
  if (!open) return null;
  const submit = async () => {
    setBusy(true);
    const id = await duplicateProject(project, { name: name.trim(), startDate: start, keepAssignees: keep });
    setBusy(false);
    onClose();
    nav(`/projets/${id}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Dupliquer le projet"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!name.trim() || !start || busy} onClick={submit}><Copy size={16} /> Dupliquer</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Nom de la copie"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Nouvelle date de début" help={project.start_date ? `L’original commence le ${fmtShort(project.start_date)} : toutes les échéances sont décalées d’autant.` : undefined}>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Garder les responsables
        </label>
        <p className="text-sm text-mab-texte">Les tâches repartent « à faire », sous-tâches décochées. Commentaires et pièces jointes ne sont pas copiés.</p>
      </div>
    </Modal>
  );
}

export function TemplatesModal({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (t: ProjectTemplate) => void }) {
  const { snap, byId, deleteTemplate } = useStore();
  if (!open) return null;
  return (
    <Modal open wide onClose={onClose} title="Modèles de projets">
      {snap.templates.length === 0 ? (
        <Empty icon={<LayoutTemplate size={30} />} title="Aucun modèle" text="Ouvre un projet réussi, puis « Enregistrer comme modèle »." />
      ) : (
        <div className="grid gap-3">
          {snap.templates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-mab-champ border border-mab-filet p-4">
              <LayoutTemplate size={20} className="text-mab-aqua-texte" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-mab-texte">{plural(t.tasks.length, 'tâche')} · {plural(t.phases.length, 'étape')} · calé sur « {t.reference_label} » · par {byId.get(t.created_by ?? '')?.full_name ?? '—'}</p>
              </div>
              <Button variant="secondaire" className="!h-9" onClick={() => { onClose(); onUse(t); }}>Utiliser</Button>
              <Button variant="discret" className="!text-mab-erreur" onClick={() => confirm(`Supprimer le modèle « ${t.name} » ? Les projets déjà créés ne changent pas.`) && deleteTemplate(t.id)}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
