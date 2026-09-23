import { useEffect, useState } from 'react';
import type { Profile } from '../lib/types';
import { useStore } from '../state/store';
import { Button, Field, Input, Modal } from './ui';

/** Le nom a-t-il été rempli automatiquement depuis l'e-mail (« jonathan_schwartz ») ? */
export function needsName(p: Profile | null) {
  if (!p) return false;
  const local = p.email.split('@')[0];
  const name = p.full_name.trim();
  // Nom recopié tel quel depuis l'e-mail (tout en minuscules) ou contenant _ . @ chiffres.
  return !name || name === local || /[_@.\d]/.test(name);
}

/** Propose un prénom et un nom à partir de l'e-mail : « jonathan_schwartz » → Jonathan / Schwartz. */
function guess(p: Profile) {
  const parts = p.email.split('@')[0].split(/[._-]+/).filter((x) => x && !/^\d+$/.test(x));
  const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return { first: cap(parts[0]), last: parts.slice(1).map(cap).join(' ') };
}

export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/** Champs prénom / nom / fonction, réutilisés à l'accueil et dans le profil. */
export function NameFields({ first, last, job, onChange }: {
  first: string; last: string; job: string; onChange: (v: { first: string; last: string; job: string }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Prénom"><Input autoFocus value={first} onChange={(e) => onChange({ first: e.target.value, last, job })} autoComplete="given-name" /></Field>
      <Field label="Nom"><Input value={last} onChange={(e) => onChange({ first, last: e.target.value, job })} autoComplete="family-name" /></Field>
      <Field label="Fonction" className="sm:col-span-2" help="Ex. Gérant · Digital, Thérapeute · Le Crès, Commerciale B2B">
        <Input value={job} onChange={(e) => onChange({ first, last, job: e.target.value })} />
      </Field>
    </div>
  );
}

const SKIP = 'mahq_nom_plus_tard';

/** À la première connexion : « Comment veux-tu apparaître pour l'équipe ? » */
export function NameSetup() {
  const { me, loaded, updateProfile } = useStore();
  const [v, setV] = useState({ first: '', last: '', job: '' });
  const [skipped, setSkipped] = useState(() => { try { return sessionStorage.getItem(SKIP) === '1'; } catch { return false; } });
  const open = loaded && !skipped && needsName(me);
  useEffect(() => { if (open && me) { const g = guess(me); setV({ first: g.first, last: g.last, job: me.job_title }); } }, [open, me]);
  if (!open || !me) return null;

  const later = () => { try { sessionStorage.setItem(SKIP, '1'); } catch { /* ignoré */ } setSkipped(true); };
  const save = () => {
    const full = `${v.first.trim()} ${v.last.trim()}`.trim();
    if (!v.first.trim()) return;
    updateProfile(me.id, { full_name: full, job_title: v.job.trim() }, `Bienvenue ${v.first.trim()} !`);
  };
  return (
    <Modal
      open
      onClose={later}
      title="Comment veux-tu apparaître ?"
      footer={<><Button variant="tertiaire" onClick={later}>Plus tard</Button><Button variant="primaire" disabled={!v.first.trim()} onClick={save}>C’est moi</Button></>}
    >
      <p className="mb-4 text-sm text-mab-texte">C’est le nom que verra l’équipe sur les tâches, les messages et les annonces. Tu pourras le changer à tout moment dans « Mon profil ».</p>
      <NameFields first={v.first} last={v.last} job={v.job} onChange={setV} />
    </Modal>
  );
}
