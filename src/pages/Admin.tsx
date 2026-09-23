import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useStore } from '../state/store';
import type { Profile, Role } from '../lib/types';
import { isAdmin } from '../lib/permissions';
import { nextColor, PROJECT_COLORS } from '../lib/palette';
import { useToast } from '../state/toast';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageTitle, Select } from '../components/ui';

export default function Admin() {
  const { me, snap, updateProfile, mode } = useStore();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  if (!isAdmin(me)) return <Navigate to="/" replace />;
  const admins = snap.profiles.filter((p) => p.role === 'admin' && p.active).length;

  const toggleActive = (p: Profile) => {
    if (p.id === me!.id) return;
    const msg = p.active ? `Désactiver l’accès de ${p.full_name} ? La personne ne pourra plus se connecter. Son historique est conservé.` : `Réactiver l’accès de ${p.full_name} ?`;
    if (confirm(msg)) updateProfile(p.id, { active: !p.active }, p.active ? 'Accès désactivé' : 'Accès réactivé');
  };

  return (
    <>
      <PageTitle title={<>Membres & <b>accès</b></>} sub="Invite l’équipe, choisis qui administre, retire un accès en un clic.">
        <Button variant="primaire" onClick={() => setInviting(true)}><UserPlus size={17} /> Inviter une personne</Button>
      </PageTitle>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2"><ShieldCheck size={18} className="text-mab-aqua-texte" /><h2 className="font-semibold">Administrateur</h2></div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-mab-texte">
            <li>Voit tous les projets, toutes les tâches et tous les événements</li>
            <li>Crée, modifie, archive et supprime les projets</li>
            <li>Invite l’équipe, change les rôles, désactive les accès</li>
            <li>Accède à la vue direction et au fil d’activité complet</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">Membre</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-mab-texte">
            <li>Voit uniquement les projets dont il fait partie</li>
            <li>Ajoute, modifie et coche les tâches de ces projets, commente</li>
            <li>Gère ses tâches rapides et les événements qu’il organise</li>
            <li>Met à jour sa disponibilité et son profil</li>
          </ul>
        </Card>
      </div>

      {/* Téléphone : une carte par personne */}
      <div className="grid gap-3 sm:hidden">
        {[...snap.profiles].sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name)).map((p) => {
          const self = p.id === me!.id;
          const lastAdmin = p.role === 'admin' && admins <= 1;
          return (
            <Card key={p.id} className={`p-4 ${p.active ? '' : 'bg-mab-wash'}`}>
              <div className="flex items-center gap-3">
                <Avatar p={p} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.full_name}{self && ' (toi)'}</p>
                  <p className="truncate text-xs text-mab-texte">{p.email}</p>
                </div>
                {p.active ? <Badge tone="succes">Actif</Badge> : <Badge>Désactivé</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={p.role}
                  disabled={self || lastAdmin || !p.active}
                  onChange={(e) => updateProfile(p.id, { role: e.target.value as Role }, 'Rôle mis à jour')}
                  className="h-10 flex-1 rounded-mab-pilule border border-mab-filet bg-white px-3 text-sm disabled:opacity-50"
                  aria-label={`Rôle de ${p.full_name}`}
                >
                  <option value="admin">Administrateur</option>
                  <option value="membre">Membre</option>
                </select>
                <Button variant="discret" onClick={() => setEditing(p)}>Modifier</Button>
                {!self && <Button variant="discret" className={p.active ? '!text-mab-erreur' : ''} onClick={() => toggleActive(p)}>{p.active ? 'Désactiver' : 'Réactiver'}</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-x-auto max-sm:hidden">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-mab-filet text-left text-xs text-mab-texte">
              <th className="px-5 py-3 font-medium">Personne</th>
              <th className="px-3 py-3 font-medium">E-mail</th>
              <th className="px-3 py-3 font-medium">Rôle</th>
              <th className="px-3 py-3 font-medium">Accès</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {[...snap.profiles].sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name)).map((p) => {
              const self = p.id === me!.id;
              const lastAdmin = p.role === 'admin' && admins <= 1;
              return (
                <tr key={p.id} className={`border-b border-mab-filet last:border-0 ${p.active ? '' : 'bg-mab-wash'}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3"><Avatar p={p} size={32} /><span><b className="block font-semibold">{p.full_name}{self && ' (toi)'}</b><span className="text-xs text-mab-texte">{p.job_title}</span></span></div>
                  </td>
                  <td className="px-3 py-3 text-mab-texte">{p.email}</td>
                  <td className="px-3 py-3">
                    <select
                      value={p.role}
                      disabled={self || lastAdmin || !p.active}
                      title={self ? 'Tu ne peux pas changer ton propre rôle' : lastAdmin ? 'Il faut au moins un administrateur' : undefined}
                      onChange={(e) => updateProfile(p.id, { role: e.target.value as Role }, 'Rôle mis à jour')}
                      className="h-9 rounded-mab-pilule border border-mab-filet bg-white px-3 text-sm disabled:opacity-50"
                    >
                      <option value="admin">Administrateur</option>
                      <option value="membre">Membre</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">{p.active ? <Badge tone="succes">Actif</Badge> : <Badge>Désactivé</Badge>}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="discret" onClick={() => setEditing(p)}>Modifier</Button>
                    {!self && <Button variant="discret" className={p.active ? '!text-mab-erreur' : ''} onClick={() => toggleActive(p)}>{p.active ? 'Désactiver' : 'Réactiver'}</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {mode === 'demo' && <p className="mt-3 text-sm text-mab-texte">Mode démo : les personnes invitées se connectent avec le mot de passe « demo ».</p>}

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <EditMemberModal member={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snap, inviteMember, mode } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ full_name: '', email: '', job_title: '', role: 'membre' as Role });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const valid = f.full_name.trim() && /^\S+@\S+\.\S+$/.test(f.email.trim());
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await inviteMember({ ...f, email: f.email.trim(), full_name: f.full_name.trim(), color: nextColor(snap.profiles.map((p) => p.color)) });
      toast(mode === 'demo' ? `${f.full_name} peut se connecter (mot de passe : demo)` : `Invitation envoyée à ${f.email}`);
      setF({ full_name: '', email: '', job_title: '', role: 'membre' });
      onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Inviter une personne" footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid || busy} onClick={submit}>{busy ? 'Envoi…' : 'Envoyer l’invitation'}</Button></>}>
      <div className="grid gap-4">
        <Field label="Prénom et nom"><Input autoFocus value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="E-mail professionnel" help="La personne reçoit un e-mail pour choisir son mot de passe."><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Fonction"><Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} placeholder="Ex. Thérapeute · Le Crès" /></Field>
        <Field label="Rôle">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="membre">Membre</option>
            <option value="admin">Administrateur</option>
          </Select>
        </Field>
        {error && <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-3 text-sm text-mab-erreur">{error}</p>}
      </div>
    </Modal>
  );
}

export function EditMemberModal({ member, onClose }: { member: Profile | null; onClose: () => void }) {
  const { updateProfile } = useStore();
  const [f, setF] = useState<Partial<Profile>>({});
  const [lastId, setLastId] = useState<string | null>(null);
  if (!member) return null;
  if (lastId !== member.id) { setLastId(member.id); setF({ full_name: member.full_name, job_title: member.job_title, color: member.color }); }
  const save = () => { updateProfile(member.id, f, 'Profil mis à jour'); onClose(); };
  return (
    <Modal open onClose={onClose} title={`Modifier · ${member.full_name}`} footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!f.full_name?.trim()} onClick={save}>Enregistrer</Button></>}>
      <div className="grid gap-4">
        <Field label="Prénom et nom"><Input value={f.full_name ?? ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Fonction"><Input value={f.job_title ?? ''} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Couleur</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, color: c })} className={`h-8 w-8 rounded-full ${f.color === c ? 'ring-2 ring-mab-encre ring-offset-2' : ''}`} style={{ background: c }} />)}
          </div>
        </div>
      </div>
    </Modal>
  );
}
