import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend } from '../data';
import { useStore } from '../state/store';
import { Button, Field, Input } from '../components/ui';

/** Page ouverte depuis l'e-mail d'invitation ou de réinitialisation. */
export default function SetPassword() {
  const { setRecovery } = useStore();
  const nav = useNavigate();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return setError('Au moins 8 caractères.');
    if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    try { await backend.updatePassword(pwd); setRecovery(false); window.location.replace('/'); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-white bg-mab-halo-haut bg-no-repeat px-5">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-4">
        <img src="/mabeautyplus-logo.svg" alt="MAbeautyplus" className="mb-6 h-10 w-auto self-start" />
        <h1 className="text-3xl font-light text-mab-encre">Choisis ton <b className="font-semibold">mot de passe</b></h1>
        <p className="text-mab-texte">Il te servira à te connecter à MA HQ depuis n’importe quel appareil.</p>
        <Field label="Nouveau mot de passe" help="8 caractères minimum.">
          <Input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
        <Field label="Confirmer">
          <Input type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
        </Field>
        {error && <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-3 text-sm text-mab-erreur">{error}</p>}
        <Button type="submit" variant="primaire" className="!h-12" disabled={busy}>Enregistrer mon mot de passe</Button>
        <button type="button" className="text-sm text-mab-texte hover:underline" onClick={() => nav('/connexion')}>Retour à la connexion</button>
      </form>
    </div>
  );
}
