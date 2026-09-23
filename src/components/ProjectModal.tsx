import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, ProjectStatus } from '../lib/types';
import { useStore } from '../state/store';
import { nextColor, PROJECT_COLORS } from '../lib/palette';
import { todayIso } from '../lib/dates';
import { Button, Field, Input, Modal, PeoplePicker, Select, Textarea } from './ui';

const TEMPLATES: Record<string, string[]> = {
  Standard: ['Cadrage', 'Production', 'Validation', 'Déploiement'],
  'Lancement / événement': ['Cadrage', 'Acquisition', 'Contenu', 'Pré-lancement', 'Jour J', 'Suivi'],
  'Protocole / soin': ['Conception', 'Validation', 'Formation des équipes', 'Déploiement centres'],
  'Campagne marketing': ['Brief', 'Création', 'Tracking', 'Lancement', 'Analyse'],
};

export function ProjectModal({ project, open, onClose }: { project?: Project; open: boolean; onClose: () => void }) {
  const { snap, me, saveProject } = useStore();
  const nav = useNavigate();
  const [p, setP] = useState<Partial<Project>>({});
  const [template, setTemplate] = useState('Standard');
  const [phasesText, setPhasesText] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = project ?? {
      name: '', description: '', start_date: todayIso(), end_date: '', status: 'en_cours' as ProjectStatus,
      member_ids: me ? [me.id] : [], color: nextColor(snap.projects.map((x) => x.color)),
    };
    setP(base);
    setPhasesText((project?.phases ?? TEMPLATES.Standard).join('\n'));
    setTemplate('Standard');
  }, [open, project, me, snap.projects]);

  if (!open) return null;
  const set = (patch: Partial<Project>) => setP((x) => ({ ...x, ...patch }));
  const datesOk = !p.start_date || !p.end_date || p.start_date <= p.end_date;
  const valid = !!p.name?.trim() && datesOk;

  const submit = async () => {
    if (!valid) return;
    const phases = phasesText.split('\n').map((s) => s.trim()).filter(Boolean);
    onClose();
    const id = await saveProject({ ...p, name: p.name!.trim(), phases } as Project);
    if (!project && typeof id === 'string') nav(`/projets/${id}`);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={project ? 'Modifier le projet' : 'Créer un projet'}
      footer={
        <>
          <Button variant="tertiaire" onClick={onClose}>Annuler</Button>
          <Button variant="primaire" disabled={!valid} onClick={submit}>{project ? 'Enregistrer' : 'Créer le projet'}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nom du projet">
          <Input autoFocus value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Webinaire d’octobre" />
        </Field>
        <Field label="Objectif / mission">
          <Textarea value={p.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Début">
            <Input type="date" value={p.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value })} />
          </Field>
          <Field label="Fin" help={datesOk ? undefined : 'La fin doit être après le début.'}>
            <Input type="date" value={p.end_date ?? ''} onChange={(e) => set({ end_date: e.target.value })} className={datesOk ? '' : '!border-mab-erreur'} />
          </Field>
          <Field label="Statut">
            <Select value={p.status} onChange={(e) => set({ status: e.target.value as ProjectStatus })}>
              <option value="planifie">Planifié</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="archive">Archivé</option>
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-mab-encre">Couleur de repérage</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Couleur ${c}`}
                aria-pressed={p.color === c}
                onClick={() => set({ color: c })}
                className={`h-8 w-8 rounded-full transition ${p.color === c ? 'ring-2 ring-mab-encre ring-offset-2' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <Field label="Personnes sur le projet">
          <PeoplePicker people={snap.profiles.filter((x) => x.active)} value={p.member_ids ?? []} onChange={(ids) => set({ member_ids: ids })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          {!project && (
            <Field label="Modèle d’étapes">
              <Select value={template} onChange={(e) => { setTemplate(e.target.value); setPhasesText(TEMPLATES[e.target.value].join('\n')); }}>
                {Object.keys(TEMPLATES).map((k) => <option key={k}>{k}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Étapes de la roadmap" help="Une étape par ligne, dans l’ordre." className={project ? 'sm:col-span-2' : ''}>
            <Textarea rows={5} value={phasesText} onChange={(e) => setPhasesText(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
