import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useStore } from '../state/store';
import { backend } from '../data';
import { useToast } from '../state/toast';
import { AvailabilityPicker } from '../components/AvailabilityPicker';
import { SignOutButton } from '../components/Layout';
import { Avatar, Badge, Button, Card, Field, Input, PageTitle, Surtitre } from '../components/ui';
import { DeviceCard, EmailCard } from '../components/DeviceSettings';
import { NameFields, splitName } from '../components/NameSetup';
import { PROJECT_COLORS } from '../lib/palette';

export default function Profile() {
  const { me, mode, updateProfile, setAvatar, removeAvatar } = useStore();
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { await setAvatar(file); } catch (e) { toast((e as Error).message, 'erreur'); }
    finally { setUploading(false); }
  };
  const [id, setId] = useState(() => ({ ...splitName(me?.full_name ?? ''), job: me?.job_title ?? '' }));
  useEffect(() => { if (me) setId({ ...splitName(me.full_name), job: me.job_title }); }, [me?.full_name, me?.job_title]); // eslint-disable-line react-hooks/exhaustive-deps
  const toast = useToast();
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
        <Card className="grid gap-5 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mab-aqua focus-visible:ring-offset-2"
              aria-label="Changer ma photo"
            >
              <Avatar p={me} size={80} />
              <span className={`absolute inset-0 grid place-items-center rounded-full bg-mab-encre/45 text-white transition ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <Camera size={22} className={uploading ? 'animate-pulse' : ''} />
              </span>
            </button>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="flex-1">
              <p className="text-xl font-semibold">{me.full_name}</p>
              <p className="text-sm text-mab-texte">{me.email} · <Badge tone={me.role === 'admin' ? 'mesure' : 'neutre'}>{me.role === 'admin' ? 'Administrateur' : 'Membre'}</Badge></p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Button variant="discret" className="!px-0 !pr-3" disabled={uploading} onClick={() => photoRef.current?.click()}>
                  <Camera size={15} /> {uploading ? 'Envoi…' : me.avatar_url ? 'Changer la photo' : 'Ajouter une photo'}
                </Button>
                {me.avatar_url && <Button variant="discret" className="!text-mab-texte" onClick={() => removeAvatar()}>Retirer</Button>}
              </div>
            </div>
          </div>
          <NameFields first={id.first} last={id.last} job={id.job} onChange={setId} />
          <div>
            <span className="mb-1.5 block text-sm font-medium">Ma couleur</span>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Couleur ${c}`} aria-pressed={me.color === c} onClick={() => updateProfile(me.id, { color: c })} className={`h-8 w-8 rounded-full ${me.color === c ? 'ring-2 ring-mab-encre ring-offset-2' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <Button
              disabled={!id.first.trim() || (`${id.first.trim()} ${id.last.trim()}`.trim() === me.full_name && id.job.trim() === me.job_title)}
              onClick={() => updateProfile(me.id, { full_name: `${id.first.trim()} ${id.last.trim()}`.trim(), job_title: id.job.trim() }, 'Profil mis à jour')}
            >
              Enregistrer
            </Button>
          </div>
        </Card>
        <Card className="p-6">
          <Surtitre className="mb-3">Ma disponibilité</Surtitre>
          <AvailabilityPicker />
        </Card>
        <DeviceCard />
        <EmailCard />
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
    </>
  );
}
