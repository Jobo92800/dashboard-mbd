import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

type Remote = { version: string; note?: string };

/** Vérifie toutes les 2 min (et au retour sur l'appli) si une nouvelle version est en ligne. */
export function UpdateNotice() {
  const [remote, setRemote] = useState<Remote | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const check = async () => {
      if (Date.now() - last.current < 20_000) return;
      last.current = Date.now();
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Remote;
        if (data.version && data.version !== __APP_VERSION__) setRemote(data);
      } catch { /* hors connexion : on réessaiera */ }
    };
    check();
    const timer = setInterval(check, 120_000);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', check);
    };
  }, []);

  const update = async () => {
    setReloading(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch { /* pas de service worker : simple rechargement */ }
    window.location.reload();
  };

  if (!remote || hidden === remote.version) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md items-center gap-3 rounded-mab-carte border border-mab-filet-aqua bg-white p-3 pl-4 shadow-mab-flottante sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0 lg:bottom-6"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mab-wash-2 text-mab-aqua-texte"><Sparkles size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-mab-encre">Nouvelle version de MA HQ</p>
        <p className="truncate text-xs text-mab-texte">{remote.note || 'Des améliorations sont disponibles.'}</p>
      </div>
      <button
        onClick={update}
        disabled={reloading}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-mab-pilule bg-mab-aqua-encre px-4 text-sm font-semibold text-white transition hover:bg-mab-aqua-texte"
      >
        <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} /> Actualiser
      </button>
      <button onClick={() => setHidden(remote.version)} aria-label="Plus tard" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-mab-gris hover:bg-mab-wash">
        <X size={16} />
      </button>
    </div>
  );
}
