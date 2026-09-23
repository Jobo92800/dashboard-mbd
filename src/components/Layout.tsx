import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, FolderKanban, ListChecks, LogOut, Menu, MessagesSquare, Search, ShieldCheck, Sun, Users } from 'lucide-react';
import { useStore } from '../state/store';
import { isAdmin } from '../lib/permissions';
import { fmtStamp } from '../lib/dates';
import { isLate } from '../lib/selectors';
import { resetDemo } from '../data/demoBackend';
import { AvailDot, Avatar, IconButton } from './ui';
import { SearchPalette } from './SearchPalette';
import { useToast } from '../state/toast';
import { setAppBadge, showSystemNotification, useInstall } from '../lib/device';

export function Layout({ children }: { children: ReactNode }) {
  const { me, snap, mode, loaded, unreadMessages } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenuOpen(false), [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!me) return null;

  const myLate = snap.tasks.filter((t) => t.assignee_id === me.id && isLate(t)).length;
  const nav = [
    { to: '/', label: 'Ma journée', icon: Sun, count: myLate },
    { to: '/projets', label: 'Projets', icon: FolderKanban },
    { to: '/taches', label: 'Tâches', icon: ListChecks },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, count: unreadMessages },
    { to: '/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/equipe', label: 'Équipe', icon: Users },
  ];

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 bg-mab-degrade-profond px-4 py-5 text-white">
      <Link to="/" className="mb-6 flex items-center gap-3 px-2">
        <img src="/mabeautyplus-lotus.svg" alt="" className="h-9 w-9 rounded-mab-etiquette bg-white p-1" />
        <span>
          <span className="block text-lg font-semibold leading-none">MA HQ</span>
          <span className="text-xs text-mab-profond-doux">Pilotage MAbeautyplus</span>
        </span>
      </Link>
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-mab-champ px-3 py-2.5 text-[15px] font-medium transition ${
              isActive ? 'bg-white/15 text-white' : 'text-mab-profond-texte hover:bg-white/10'
            }`
          }
        >
          <n.icon size={19} />
          <span className="flex-1">{n.label}</span>
          {!!n.count && <span className="rounded-mab-pilule bg-mab-rose px-2 text-xs font-semibold leading-5">{n.count}</span>}
        </NavLink>
      ))}
      {isAdmin(me) && (
        <>
          <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-mab-profond-source">Administration</p>
          <NavLink
            to="/admin"
            className={({ isActive }) => `flex items-center gap-3 rounded-mab-champ px-3 py-2.5 text-[15px] font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-mab-profond-texte hover:bg-white/10'}`}
          >
            <ShieldCheck size={19} /> Membres & accès
          </NavLink>
        </>
      )}
      <div className="mt-auto">
        <InstallHint />
        {mode === 'demo' && (
          <div className="mb-3 rounded-mab-champ border border-white/15 p-3 text-xs text-mab-profond-texte">
            <b className="text-white">Mode démo.</b> Les données restent dans ce navigateur.
            <button className="mt-1 block underline" onClick={() => { if (confirm('Remettre les données de démonstration à zéro ?')) resetDemo(); }}>
              Réinitialiser la démo
            </button>
          </div>
        )}
        <Link to="/profil" className="flex items-center gap-3 rounded-mab-champ px-2 py-2 hover:bg-white/10">
          <span className="relative">
            <Avatar p={me} size={36} />
            <AvailDot a={me.availability} className="absolute -bottom-0.5 -right-0.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{me.full_name}</span>
            <span className="block truncate text-xs text-mab-profond-doux">{me.role === 'admin' ? 'Administrateur' : 'Membre'}</span>
          </span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-mab-wash bg-mab-halo-haut bg-no-repeat lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-mab-encre/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="h-full w-[270px]" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-mab-filet bg-white/90 px-4 backdrop-blur sm:px-8">
          <IconButton label="Ouvrir le menu" className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={20} /></IconButton>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 flex-1 items-center gap-2 rounded-mab-pilule border border-mab-filet bg-mab-wash px-4 text-left text-sm text-mab-gris-doux transition hover:border-mab-filet-aqua sm:max-w-md"
          >
            <Search size={16} className="shrink-0" /> <span className="flex-1 truncate"><span className="sm:hidden">Rechercher…</span><span className="hidden sm:inline">Rechercher un projet, une tâche, une personne…</span></span>
            <kbd className="hidden rounded-mab-puce border border-mab-filet bg-white px-1.5 text-[11px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/messages" aria-label="Messages" className="relative grid h-9 w-9 place-items-center rounded-mab-pilule text-mab-texte hover:bg-mab-wash-2 hover:text-mab-aqua-texte">
              <MessagesSquare size={19} />
              {unreadMessages > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-mab-rose px-1 text-[10px] font-bold text-white">{unreadMessages}</span>}
            </Link>
            <Notifications />
            <Link to="/profil" className="rounded-full lg:hidden" aria-label="Mon profil"><Avatar p={me} size={34} /></Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
          {loaded ? children : (
            <div className="grid h-[50vh] place-items-center"><img src="/mabeautyplus-lotus.svg" alt="Chargement" className="h-10 w-10 animate-pulse" /></div>
          )}
        </main>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MessageWatcher />
    </div>
  );
}

/**
 * Prévient de ce qui arrive : bandeau dans l'appli si on la regarde,
 * notification de l'appareil si elle est en arrière-plan. Met aussi la pastille sur l'icône.
 */
function MessageWatcher() {
  const { snap, me, byId, loaded, unreadMessages } = useStore();
  const toast = useToast();
  const loc = useLocation();
  const seenMsg = useRef<Set<string> | null>(null);
  const seenNotif = useRef<Set<string> | null>(null);
  const away = () => document.hidden || !document.hasFocus();

  useEffect(() => {
    if (!loaded) return;
    if (!seenMsg.current) { seenMsg.current = new Set(snap.messages.map((m) => m.id)); return; }
    for (const m of snap.messages) {
      if (seenMsg.current.has(m.id)) continue;
      seenMsg.current.add(m.id);
      const url = `/messages/${m.conversation_id}`;
      if (m.author_id === me?.id || (loc.pathname === url && !away())) continue;
      const who = byId.get(m.author_id)?.full_name.split(' ')[0] ?? 'Quelqu’un';
      const text = m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body;
      if (away()) showSystemNotification(`💬 ${who}`, text, url);
      else toast(`💬 ${who} : ${text.slice(0, 60)}`);
    }
  }, [snap.messages, loaded, me?.id, byId, loc.pathname, toast]);

  useEffect(() => {
    if (!loaded) return;
    if (!seenNotif.current) { seenNotif.current = new Set(snap.notifications.map((n) => n.id)); return; }
    for (const n of snap.notifications) {
      if (seenNotif.current.has(n.id)) continue;
      seenNotif.current.add(n.id);
      if (n.read) continue;
      if (away()) showSystemNotification('MA HQ', n.text, n.link ?? '/');
      else toast(`🔔 ${n.text}`);
    }
  }, [snap.notifications, loaded, toast]);

  const unreadNotifs = snap.notifications.filter((n) => !n.read).length;
  useEffect(() => { setAppBadge(unreadMessages + unreadNotifs); }, [unreadMessages, unreadNotifs]);
  return null;
}

function InstallHint() {
  const inst = useInstall();
  if (inst.installed || (!inst.canPrompt && !inst.ios)) return null;
  return (
    <Link to="/profil#appareil" className="mb-3 block rounded-mab-champ bg-white/10 p-3 text-xs text-mab-profond-texte hover:bg-white/15">
      <b className="block text-sm text-white">📱 Installer l’appli</b>
      Une icône MA HQ sur ton écran d’accueil, et les notifications.
    </Link>
  );
}

function Notifications() {
  const { snap, markAllRead, markRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const list = [...snap.notifications].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 30);
  const unread = list.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Bell size={19} />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-mab-rose px-1 text-[10px] font-bold text-white">{unread}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-24px))] rounded-mab-carte border border-mab-filet bg-white shadow-mab-flottante">
          <div className="flex items-center justify-between border-b border-mab-filet px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && <button className="text-sm text-mab-aqua-texte hover:underline" onClick={() => markAllRead()}>Tout marquer comme lu</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.length === 0 && <p className="px-4 py-8 text-center text-sm text-mab-texte">Rien de neuf pour l’instant.</p>}
            {list.map((n) => (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); setOpen(false); if (n.link) nav(n.link); }}
                className={`flex w-full gap-3 border-b border-mab-filet px-4 py-3 text-left last:border-0 hover:bg-mab-wash ${n.read ? '' : 'bg-mab-wash-2/60'}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-mab-rose'}`} />
                <span>
                  <span className="block text-sm text-mab-encre">{n.text}</span>
                  <span className="text-xs text-mab-gris-doux">{fmtStamp(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SignOutButton() {
  const { signOut } = useStore();
  const nav = useNavigate();
  return (
    <button onClick={async () => { await signOut(); nav('/connexion'); }} className="inline-flex items-center gap-2 text-sm font-medium text-mab-texte hover:text-mab-erreur">
      <LogOut size={16} /> Se déconnecter
    </button>
  );
}

