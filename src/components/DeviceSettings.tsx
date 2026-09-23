import { useEffect, useState } from 'react';
import { BellRing, Mail, Share, Smartphone, Volume2 } from 'lucide-react';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { backend } from '../data';
import { disableNotifications, enableNotifications, notifEnabled, notifSupported, showSystemNotification, useInstall } from '../lib/device';
import { fridayReport, weeklyRecap, type Email } from '../lib/recap';
import { isAdmin } from '../lib/permissions';
import { playSound, setSoundsEnabled, soundsEnabled } from '../lib/sounds';
import { Button, Card, Modal, Surtitre } from './ui';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-mab-pilule transition ${on ? 'bg-mab-aqua' : 'bg-mab-rail'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export function DeviceCard() {
  const inst = useInstall();
  const toast = useToast();
  const [on, setOn] = useState(notifEnabled());
  const [sound, setSound] = useState(soundsEnabled());
  useEffect(() => { if (window.location.hash === '#appareil') document.getElementById('appareil')?.scrollIntoView({ behavior: 'smooth' }); }, []);

  const toggle = async (v: boolean) => {
    try {
      if (v) { await enableNotifications(); toast('Notifications activées sur cet appareil'); }
      else disableNotifications();
      setOn(notifEnabled());
    } catch (e) { toast((e as Error).message, 'erreur'); }
  };

  return (
    <Card id="appareil" className="grid gap-5 p-6">
      <Surtitre>Sur cet appareil</Surtitre>
      <div className="flex items-start gap-4">
        <Smartphone size={22} className="mt-0.5 shrink-0 text-mab-aqua-texte" />
        <div className="flex-1">
          <p className="font-semibold">Appli sur l’écran d’accueil</p>
          {inst.installed ? (
            <p className="text-sm text-mab-texte">C’est fait : MA HQ est installée sur cet appareil.</p>
          ) : inst.canPrompt ? (
            <>
              <p className="mb-2 text-sm text-mab-texte">Une icône MA HQ comme une vraie appli, qui s’ouvre en plein écran.</p>
              <Button onClick={async () => { if (await inst.install()) toast('MA HQ est installée'); }}>Installer MA HQ</Button>
            </>
          ) : inst.ios ? (
            <p className="text-sm text-mab-texte">
              Sur iPhone, dans Safari : touche <Share size={14} className="inline align-text-bottom" /> <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>. Les notifications fonctionnent ensuite depuis l’icône.
            </p>
          ) : (
            <p className="text-sm text-mab-texte">Sur ordinateur (Chrome ou Edge) : l’icône d’installation apparaît à droite de la barre d’adresse. Sur Android : menu ⋮ → « Installer l’application ».</p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-4">
        <BellRing size={22} className="mt-0.5 shrink-0 text-mab-aqua-texte" />
        <div className="flex-1">
          <p className="font-semibold">Notifications</p>
          <p className="text-sm text-mab-texte">
            {notifSupported()
              ? 'Tâche confiée, @mention, nouveau message, invitation à une réunion : prévenu(e) même quand MA HQ est en arrière-plan.'
              : 'Ce navigateur ne gère pas les notifications. Sur iPhone : installe d’abord l’appli (ci-dessus).'}
          </p>
          <p className="mt-1 text-xs text-mab-gris-doux">Tant que la base de données n’est pas branchée, elles arrivent quand l’appli est ouverte dans un onglet ; ensuite, même appli fermée.</p>
          {on && (
            <Button variant="discret" className="mt-1 !px-0" onClick={() => showSystemNotification('MA HQ', 'Les notifications fonctionnent sur cet appareil ✨', '/')}>
              Envoyer une notification d’essai
            </Button>
          )}
        </div>
        {notifSupported() && <Toggle on={on} onChange={toggle} label="Activer les notifications" />}
      </div>
      <div className="flex items-start gap-4">
        <Volume2 size={22} className="mt-0.5 shrink-0 text-mab-aqua-texte" />
        <div className="flex-1">
          <p className="font-semibold">Sons</p>
          <p className="text-sm text-mab-texte">Un petit son à l’arrivée d’un message, d’une annonce de la direction ou d’une notification.</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Button variant="discret" className="!px-0 !pr-3" onClick={() => playSound('message', true)}>▶ Message</Button>
            <Button variant="discret" onClick={() => playSound('annonce', true)}>▶ Annonce</Button>
            <Button variant="discret" onClick={() => playSound('notification', true)}>▶ Notification</Button>
          </div>
        </div>
        <Toggle on={sound} onChange={(v) => { setSoundsEnabled(v); setSound(v); if (v) playSound('notification', true); }} label="Activer les sons" />
      </div>
    </Card>
  );
}

export function EmailCard() {
  const { me, snap, updateProfile, mode } = useStore();
  const toast = useToast();
  const [preview, setPreview] = useState<Email | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const origin = window.location.origin;

  const showMonday = () => {
    const mail = weeklyRecap(snap, me, origin);
    if (!mail) { toast('Rien à t’envoyer cette semaine : ni tâche, ni rendez-vous, ni message non lu.'); return; }
    setPreview(mail);
  };
  const sendNow = async (type: 'lundi' | 'vendredi') => {
    setBusy(true);
    try {
      const token = await backend.accessToken();
      const res = await fetch('/.netlify/functions/envoyer-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Envoi impossible.');
      toast(body.empty ? 'Rien à t’envoyer cette semaine.' : `E-mail envoyé à ${me.email}`);
    } catch (e) { toast((e as Error).message, 'erreur'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="grid gap-5 p-6">
      <Surtitre>E-mails automatiques</Surtitre>
      <div className="flex items-start gap-4">
        <Mail size={22} className="mt-0.5 shrink-0 text-mab-aqua-texte" />
        <div className="flex-1">
          <p className="font-semibold">Récap du lundi matin{isAdmin(me) && ' et bilan du vendredi'}</p>
          <p className="text-sm text-mab-texte">
            Lundi vers 8 h : tes retards, tes tâches et rendez-vous de la semaine, tes messages non lus.
            {isAdmin(me) && ' Vendredi vers 17 h : le bilan de l’équipe (fait, en retard, projets à surveiller, semaine suivante).'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="discret" className="!px-0 !pr-3" onClick={showMonday}>Aperçu du récap du lundi</Button>
            {isAdmin(me) && <Button variant="discret" onClick={() => setPreview(fridayReport(snap, origin))}>Aperçu du bilan du vendredi</Button>}
            {mode === 'supabase' && <Button variant="discret" disabled={busy} onClick={() => sendNow('lundi')}>M’envoyer mon récap maintenant</Button>}
          </div>
        </div>
        <Toggle on={me.recap_email} onChange={(v) => updateProfile(me.id, { recap_email: v }, v ? 'Récap activé' : 'Récap désactivé')} label="Recevoir le récap par e-mail" />
      </div>
      {preview && (
        <Modal open wide onClose={() => setPreview(null)} title={`Aperçu · ${preview.subject}`}>
          <iframe title="Aperçu de l’e-mail" srcDoc={preview.html} className="h-[70vh] w-full rounded-mab-champ border border-mab-filet" />
        </Modal>
      )}
    </Card>
  );
}
