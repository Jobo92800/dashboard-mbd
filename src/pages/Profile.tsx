import { useState } from 'react';
import { useStore } from '../state/store';
import { backend } from '../data';
import { useToast } from '../state/toast';
import { AvailabilityPicker } from '../components/AvailabilityPicker';
import { SignOutButton } from '../components/Layout';
import { Avatar, Badge, Button, Card, Field, Input, PageTitle, Surtitre } from '../components/ui';
import { EditMemberModal } from './Admin';

export default function Profile() {
  const { me, mode } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState('');
  if (!me) return null;
  const changePwd = async () => {
    setError('');
    if (pwd.length < 8) return setError('Au moins 8 caractères.');
    if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques.');
    try { await backend.updatePassword(pwd); setPwd(''); setPwd2(''); toast('Mot de passe changé'); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <PageTitle title={<>Mon <b>profil</b></>} />
      <div className="grid max-w-3xl gap-6">
        <Card className="flex flex-wrap items-center gap-4 p-6">
          <Avatar p={me} size={64} />
          <div className="flex-1">
            <p className="text-xl font-semibold">{me.full_name}</p>
            <p className="text-mab-texte">{me.job_title}</p>
            <p className="mt-1 text-sm text-mab-texte">{me.email} · <Badge tone={me.role === 'admin' ? 'mesure' : 'neutre'}>{me.role === 'admin' ? 'Administrateur' : 'Membre'}</Badge></p>
          </div>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
        </Card>
        <Card className="p-6">
          <Surtitre className="mb-3">Ma disponibilité</Surtitre>
          <AvailabilityPicker />
        </Card>
        {mode === 'supabase' && (
          <Card className="grid gap-4 p-6">
            <Surtitre>Changer mon mot de passe</Surtitre>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nouveau mot de passe"><Input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
              <Field label="Confirmer"><Input type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} /></Field>
            </div>
            {error && <p className="text-sm text-mab-erreur">{error}</p>}
            <div><Button onClick={changePwd} disabled={!pwd}>Changer le mot de passe</Button></div>
          </Card>
        )}
        <div><SignOutButton /></div>
      </div>
      <EditMemberModal member={editing ? me : null} onClose={() => setEditing(false)} />
    </>
  );
}
