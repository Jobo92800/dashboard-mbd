import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { backend } from '../data';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { isIOS } from '../lib/device';
import { Button, Modal } from './ui';

/** Lien d'abonnement : les rendez-vous MA HQ apparaissent et se mettent à jour dans l'agenda du téléphone. */
export function CalendarSync({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useStore();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [withTasks, setWithTasks] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    backend.calendarToken().then(setToken).catch((e) => setError((e as Error).message));
  }, [open]);
  if (!open) return null;

  const host = window.location.host;
  const path = `/.netlify/functions/agenda?t=${token}${withTasks ? '&taches=1' : ''}`;
  const https = `https://${host}${path}`;
  const webcal = `webcal://${host}${path}`;
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(https); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast('Copie impossible : sélectionne le lien à la main.', 'erreur'); }
  };
  const reset = async () => {
    if (!confirm('Créer un nouveau lien ? L’ancien cessera de fonctionner (à refaire sur tes appareils).')) return;
    try { setToken(await backend.calendarToken(true)); toast('Nouveau lien créé'); } catch (e) { toast((e as Error).message, 'erreur'); }
  };

  return (
    <Modal open onClose={onClose} title="Synchroniser avec mon téléphone">
      {mode === 'demo' || error ? (
        <p className="text-sm text-mab-texte">{error || 'Disponible sur l’appli en ligne.'}</p>
      ) : !token ? (
        <div className="h-24 animate-pulse rounded-mab-champ bg-mab-wash" />
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-mab-texte">
            Tes rendez-vous MA HQ apparaissent dans l’agenda de ton téléphone et <b>se mettent à jour tout seuls</b> (nouveau rendez-vous, déplacement, annulation). À faire une seule fois par appareil.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={withTasks} onChange={(e) => setWithTasks(e.target.checked)} />
            Ajouter aussi mes tâches à échéance (en « journée entière »)
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={webcal} className="flex items-center justify-center gap-2 rounded-mab-pilule bg-mab-aqua-encre px-4 py-3 text-sm font-semibold text-white hover:bg-mab-aqua-texte">
              {isIOS() ? '📱 Ajouter à l’iPhone' : '📅 Agenda Apple / Outlook'}
            </a>
            <a href={google} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-mab-pilule border border-mab-aqua px-4 py-3 text-sm font-semibold text-mab-aqua-texte hover:bg-mab-wash-2">
              Ajouter à Google Agenda ↗
            </a>
          </div>
          <div className="rounded-mab-champ bg-mab-wash p-3">
            <p className="mb-1 text-xs font-medium text-mab-texte">Ou copie ce lien dans ton agenda (« S’abonner à un calendrier ») :</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-xs text-mab-encre">{https}</code>
              <Button variant="discret" className="!h-8 shrink-0" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} Copier</Button>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-mab-texte">
            <li><b>iPhone</b> : touche « Ajouter à l’iPhone » puis « S’abonner ». Mise à jour réglable dans Réglages → Calendrier → Comptes.</li>
            <li><b>Google Agenda</b> : Google rafraîchit les abonnements lui-même, en général plusieurs fois par jour (parfois plus lentement).</li>
            <li>Ce lien est personnel : ne le partage pas.</li>
          </ul>
          <button onClick={reset} className="inline-flex items-center gap-1.5 justify-self-start text-xs text-mab-texte hover:underline"><RefreshCw size={12} /> Créer un nouveau lien (si l’ancien a été partagé par erreur)</button>
        </div>
      )}
    </Modal>
  );
}
