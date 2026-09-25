import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { enablePush, pushState, type PushState } from '../lib/push';
import { Button } from './ui';

const LATER = 'mahq_push_plus_tard';

/** Petite invitation sur « Ma journée » tant que les notifications ne sont pas activées sur l'appareil. */
export function PushInvite() {
  const { mode } = useStore();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(() => { try { return Number(localStorage.getItem(LATER) || 0) > Date.now(); } catch { return false; } });
  useEffect(() => { if (mode === 'supabase') pushState().then(setState); }, [mode]);
  if (mode !== 'supabase' || hidden || !state || !['inactif', 'installer_iphone'].includes(state)) return null;

  const later = () => {
    try { localStorage.setItem(LATER, String(Date.now() + 7 * 24 * 3600 * 1000)); } catch { /* ignoré */ }
    setHidden(true);
  };
  return (
    <div className="mb-6 flex items-center gap-3 rounded-mab-carte border border-mab-filet-aqua bg-white p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mab-wash-2 text-mab-aqua-texte"><BellRing size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Reçois les notifications sur ce {/iphone|android|mobile/i.test(navigator.userAgent) ? 'téléphone' : 'poste'}</p>
        <p className="text-xs text-mab-texte">
          {state === 'installer_iphone'
            ? <>Sur iPhone, installe d’abord MA HQ sur l’écran d’accueil. <Link to="/profil#appareil" className="font-medium text-mab-aqua-texte underline">Comment faire</Link></>
            : 'Tâches confiées, messages, annonces : même quand l’appli est fermée.'}
        </p>
      </div>
      {state === 'inactif' && (
        <Button variant="secondaire" className="!h-10 shrink-0" onClick={async () => {
          try { await enablePush(); toast('Notifications activées sur cet appareil'); setState(await pushState()); }
          catch (e) { toast((e as Error).message, 'erreur'); setState(await pushState()); }
        }}>Activer</Button>
      )}
      <button onClick={later} aria-label="Plus tard" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-mab-gris hover:bg-mab-wash"><X size={16} /></button>
    </div>
  );
}
