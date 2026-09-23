import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { Button, Field, Input } from '../components/ui';
import { DEMO_PASSWORD } from '../data/demoBackend';
import { backend } from '../data';

export default function Login() {
  const { me, signIn, mode } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try { await signIn(email, password); nav('/'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const forgot = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Indique ton e-mail, puis clique à nouveau sur « Mot de passe oublié ».'); return; }
    try { await backend.sendPasswordReset(email); setInfo('Si ce compte existe, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.'); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="grid min-h-screen bg-white bg-mab-halo-haut bg-no-repeat lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-mab-degrade-profond p-12 text-white lg:flex">
        <img src="/mabeautyplus-logo-fond-profond.svg" alt="MAbeautyplus" className="h-12 w-auto self-start" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-mab-profond-doux">MA HQ</p>
          <h1 className="mt-3 text-[44px] font-light leading-[1.1] tracking-tight">
            Piloter les projets, <b className="font-semibold">savoir qui fait quoi</b>, ne rien laisser filer.
          </h1>
          <p className="mt-4 max-w-md text-lg font-light text-mab-profond-texte">L’espace de travail de l’équipe de direction et des centres MAbeautyplus.</p>
        </div>
        <p className="text-xs text-mab-profond-source">Accès réservé à l’équipe MAbeautyplus.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <img src="/mabeautyplus-logo.svg" alt="MAbeautyplus" className="mb-10 h-10 w-auto lg:hidden" />
          <h2 className="text-3xl font-light tracking-tight text-mab-encre">Bon retour <b className="font-semibold">parmi nous</b></h2>
          <p className="mt-2 text-mab-texte">Connecte-toi avec ton e-mail professionnel.</p>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            <Field label="E-mail">
              <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Mot de passe">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-3 text-sm text-mab-erreur" role="alert">{error}</p>}
            {info && <p className="rounded-mab-champ bg-mab-wash-2 px-4 py-3 text-sm text-mab-aqua-texte">{info}</p>}
            <Button type="submit" variant="primaire" className="!h-12 w-full" disabled={busy}>{busy ? 'Connexion…' : 'Me connecter'}</Button>
            {mode === 'supabase' && (
              <button type="button" onClick={forgot} className="text-sm text-mab-texte hover:underline">Mot de passe oublié</button>
            )}
          </form>

          {mode === 'demo' && (
            <DemoAccounts
              onPick={async (e) => {
                setEmail(e); setPassword(DEMO_PASSWORD); setError('');
                try { await signIn(e, DEMO_PASSWORD); nav('/'); } catch (err) { setError((err as Error).message); }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const accounts = [
    { email: 'jo@demo.mahq', label: 'Jo', role: 'Administrateur' },
    { email: 'nico@demo.mahq', label: 'Nico', role: 'Administrateur' },
    { email: 'marie@demo.mahq', label: 'Marie', role: 'Membre' },
    { email: 'flora@demo.mahq', label: 'Flora', role: 'Membre' },
  ];
  return (
    <div className="mt-8 rounded-mab-carte border border-mab-filet bg-mab-wash p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-mab-aqua-texte">Mode démo</p>
      <p className="mt-1 text-sm text-mab-texte">Un clic sur un compte pour entrer. Mot de passe de tous les comptes : <b>demo</b>.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {accounts.map((a) => (
          <button key={a.email} onClick={() => onPick(a.email)} className="rounded-mab-champ border border-mab-filet bg-white px-3 py-2 text-left text-sm transition hover:border-mab-filet-aqua hover:bg-mab-wash-2">
            <b className="block text-mab-encre">{a.label}</b>
            <span className="text-xs text-mab-texte">{a.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
