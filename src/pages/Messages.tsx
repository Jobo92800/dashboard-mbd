import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BellOff, Camera, CheckCheck, Crown, FileText, Info, ListPlus, LogOut, MailOpen, MessageSquarePlus, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Reply, Search, Send, SmilePlus, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { isToday, isYesterday, parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useStore } from '../state/store';
import type { Conversation, Message, Profile } from '../lib/types';
import { useToast } from '../state/toast';
import { useOpenAttachment } from '../components/TaskExtras';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { canManage, conversationName, isGroup } from '../lib/conversations';
import { Avatar, Badge, Button, Empty, Field, IconButton, Input, Modal, PeoplePicker, Tabs, Textarea } from '../components/ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function ConvAvatar({ c, meId, size = 40 }: { c: Conversation; meId: string; size?: number }) {
  const { byId } = useStore();
  if (c.avatar_url) return <img src={c.avatar_url} alt="" className="shrink-0 rounded-full bg-mab-rail object-cover" style={{ width: size, height: size }} />;
  const others = c.member_ids.filter((id) => id !== meId);
  if (others.length === 1 && !c.title) return <Avatar p={byId.get(others[0])} size={size} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-mab-wash-2 text-mab-aqua-texte" style={{ width: size, height: size }}>
      <Users size={size * 0.45} />
    </span>
  );
}

function timeLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMM', { locale: fr });
}

export default function Messages() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { snap, me, byId, unreadByConv, mutedConvs } = useStore();
  const [q, setQ] = useState('');
  const [composeFor, setComposeFor] = useState<string[] | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [filter, setFilter] = useState<'tous' | 'non_lus' | 'groupes'>('tous');
  const pinnedConvs = new Set(snap.reads.filter((r) => r.user_id === me!.id && r.pinned).map((r) => r.conversation_id));

  // Arrivée depuis la fiche d'une personne : /messages?a=<id>
  useEffect(() => {
    const target = params.get('a');
    if (!target || !me) return;
    const direct = snap.conversations.find((c) => !c.title && c.member_ids.length === 2 && c.member_ids.includes(target) && c.member_ids.includes(me.id));
    params.delete('a');
    setParams(params, { replace: true });
    if (direct) nav(`/messages/${direct.id}`, { replace: true });
    else setComposeFor([target]);
  }, [params, setParams, snap.conversations, me, nav]);

  const lastMsg = useMemo(() => {
    const m = new Map<string, (typeof snap.messages)[number]>();
    for (const msg of snap.messages) {
      const cur = m.get(msg.conversation_id);
      if (!cur || cur.created_at < msg.created_at) m.set(msg.conversation_id, msg);
    }
    return m;
  }, [snap.messages]);

  const list = snap.conversations
    .filter((c) => !q || norm(`${conversationName(c, me!.id, byId)} ${c.member_ids.map((x) => byId.get(x)?.full_name ?? '').join(' ')}`).includes(norm(q)))
    .filter((c) => filter === 'tous' || (filter === 'groupes' ? isGroup(c) : (unreadByConv.get(c.id) ?? 0) > 0))
    .sort((a, b) => Number(pinnedConvs.has(b.id)) - Number(pinnedConvs.has(a.id)) || (a.last_message_at < b.last_message_at ? 1 : -1));
  const current = snap.conversations.find((c) => c.id === id);

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] overflow-hidden bg-white lg:-mb-10 lg:h-[calc(100dvh-9rem)] lg:min-h-[420px] lg:grid-cols-[340px_minmax(0,1fr)] lg:rounded-mab-carte lg:border lg:border-mab-filet
        max-lg:fixed max-lg:inset-x-0 ${id ? 'max-lg:pt-safe max-lg:inset-y-0 max-lg:z-40' : 'max-lg:top-[calc(4rem+env(safe-area-inset-top))] max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-lg:z-20'}`}
    >
      <aside className={`flex min-h-0 flex-col border-mab-filet lg:border-r ${id ? 'hidden lg:flex' : 'flex'}`}>
        <div className="border-b border-mab-filet p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-2xl font-light">Mes <b className="font-semibold">messages</b></h1>
            <div className="flex gap-1">
              <IconButton label="Nouveau message" className="!h-10 !w-10 border border-mab-aqua !text-mab-aqua-texte" onClick={() => setComposeFor([])}><MessageSquarePlus size={18} /></IconButton>
              <IconButton label="Nouveau groupe" className="!h-10 !w-10 border border-mab-aqua !text-mab-aqua-texte" onClick={() => setNewGroup(true)}><Users size={18} /></IconButton>
            </div>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-mab-pilule border border-mab-filet bg-mab-wash px-4">
            <Search size={15} className="text-mab-gris" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une conversation" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="mt-3">
            <Tabs value={filter} onChange={setFilter} items={[
              { id: 'tous', label: 'Tous' },
              { id: 'non_lus', label: 'Non lus', count: [...unreadByConv.keys()].length || undefined },
              { id: 'groupes', label: 'Groupes' },
            ]} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && <p className="px-5 py-10 text-center text-sm text-mab-texte">{q || filter !== 'tous' ? 'Aucune conversation ici.' : 'Aucune conversation. Écris à quelqu’un ou crée un groupe avec les boutons ci-dessus.'}</p>}
          {list.map((c) => {
            const last = lastMsg.get(c.id);
            const unread = unreadByConv.get(c.id) ?? 0;
            const author = last && (last.author_id === me!.id ? 'Toi' : byId.get(last.author_id)?.full_name.split(' ')[0]);
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`flex items-center gap-3 border-b border-mab-filet px-4 py-3 transition ${c.id === id ? 'bg-mab-wash-2' : 'hover:bg-mab-wash'}`}
              >
                <ConvAvatar c={c} meId={me!.id} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`flex min-w-0 items-center gap-1 text-[15px] ${unread ? 'font-semibold text-mab-encre' : 'font-medium text-mab-encre'}`}>
                      <span className="truncate">{conversationName(c, me!.id, byId)}</span>
                      {pinnedConvs.has(c.id) && <Pin size={12} className="shrink-0 text-mab-rose" aria-label="Épinglée" />}
                      {mutedConvs.has(c.id) && <BellOff size={12} className="shrink-0 text-mab-gris-doux" aria-label="En sourdine" />}
                    </span>
                    <span className="shrink-0 text-xs text-mab-gris-doux">{timeLabel(c.last_message_at)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${unread ? 'text-mab-encre' : 'text-mab-texte'}`}>{last ? `${isGroup(c) || last.author_id === me!.id ? `${author} : ` : ''}${last.body || '📎 Pièce jointe'}` : isGroup(c) ? `Groupe créé · ${c.member_ids.length} membres` : 'Pas encore de message'}</span>
                    {unread > 0 && <span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white ${mutedConvs.has(c.id) ? 'bg-mab-gris-doux' : 'bg-mab-rose'}`}>{unread}</span>}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </aside>

      <section className={`min-h-0 flex-col ${id ? 'flex' : 'hidden lg:flex'}`}>
        {current ? (
          <Thread key={current.id} conv={current} />
        ) : id ? (
          <div className="m-auto p-6"><Empty title="Conversation introuvable" text="Elle a peut-être été quittée ou supprimée." action={<Link className="text-mab-aqua-texte underline" to="/messages">Retour aux messages</Link>} /></div>
        ) : (
          <div className="m-auto max-w-sm p-6 text-center">
            <MessageSquarePlus size={36} className="mx-auto text-mab-aqua" />
            <p className="mt-3 font-semibold">Choisis une conversation</p>
            <p className="mt-1 text-sm text-mab-texte">Ou écris à une ou plusieurs personnes de l’équipe. Les messages sont privés : seuls les participants les voient.</p>
          </div>
        )}
      </section>

      <NewConversationModal preset={composeFor} onClose={() => setComposeFor(null)} onGroup={() => { setComposeFor(null); setNewGroup(true); }} />
      <NewGroupModal open={newGroup} onClose={() => setNewGroup(false)} />
    </div>
  );
}

function linkify(text: string, members: Profile[] = [], mine = false) {
  const firsts = new Set(members.map((p) => p.full_name.split(' ')[0].toLowerCase()));
  return text.split(/(https?:\/\/[^\s]+|@[\p{L}-]+)/gu).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2">{part}</a>
      : part.startsWith('@') && firsts.has(part.slice(1).toLowerCase())
        ? <b key={i} className={`font-semibold ${mine ? 'text-mab-aqua-clair' : 'text-mab-aqua-texte'}`}>{part}</b>
        : <Fragment key={i}>{part}</Fragment>,
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-mab-etiquette px-3 py-2 text-left text-sm hover:bg-mab-wash ${danger ? 'text-mab-erreur' : 'text-mab-encre'}`}>
      <Icon size={16} className="shrink-0" /> {label}
    </button>
  );
}

function dayLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return 'Aujourd’hui';
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];

function excerpt(text: string, n = 80) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function Thread({ conv }: { conv: Conversation }) {
  const { snap, me, byId, sendMessage, markConversationRead, unreadByConv, deleteMessage, editMessage, toggleReaction, togglePin } = useStore();
  const toast = useToast();
  const openAtt = useOpenAttachment();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [picker, setPicker] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Écran tactile : toucher un message affiche ses actions. */
  const [touched, setTouched] = useState<string | null>(null);
  const isTouch = typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches;
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useMemo(
    () => snap.messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [snap.messages, conv.id],
  );
  const byMsg = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const unread = unreadByConv.get(conv.id) ?? 0;
  const group = isGroup(conv);
  const name = conversationName(conv, me!.id, byId);
  const members = conv.member_ids.map((x) => byId.get(x)).filter(Boolean) as Profile[];
  const pinned = conv.pinned_ids.map((id) => byMsg.get(id)).filter(Boolean) as Message[];
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutedConvs, setConversationPref, markConversationUnread, deleteConversation, leaveConversation } = useStore();
  const myPref = snap.reads.find((r) => r.id === `${conv.id}:${me!.id}`);
  const manage = canManage(conv, me);
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const mentionList = mention ? members.filter((p) => p.id !== me!.id && norm(p.full_name).startsWith(norm(mention.q))).slice(0, 6) : [];
  const insertMention = (p: Profile) => {
    if (!mention) return;
    const first = p.full_name.split(' ')[0];
    const caret = input.current?.selectionStart ?? text.length;
    setText(text.slice(0, mention.start) + '@' + first + ' ' + text.slice(caret));
    setMention(null);
    requestAnimationFrame(() => { const pos = mention.start + first.length + 2; input.current?.focus(); input.current?.setSelectionRange(pos, pos); });
  };
  /** Pour mon dernier message : qui l'a vu (lecture postérieure à l'envoi). */
  const lastMine = [...messages].reverse().find((m) => m.author_id === me!.id);
  const seenBy = lastMine
    ? snap.reads.filter((r) => r.conversation_id === conv.id && r.user_id !== me!.id && r.read_at >= lastMine.created_at).map((r) => byId.get(r.user_id)).filter(Boolean) as Profile[]
    : [];

  useEffect(() => { if (unread > 0) markConversationRead(conv.id); }, [unread, conv.id, markConversationRead]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  useEffect(() => { input.current?.focus(); }, [conv.id, replyTo]);

  const send = async () => {
    if ((!text.trim() && !files.length) || sending) return;
    setSending(true);
    try {
      await sendMessage(conv, text, { replyTo: replyTo?.id ?? null, files });
      setText(''); setFiles([]); setReplyTo(null);
      if (input.current) input.current.style.height = 'auto';
    } catch (e) { toast((e as Error).message, 'erreur'); }
    finally { setSending(false); }
  };

  const jumpTo = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1600);
  };

  const toTask = (m: Message) => {
    const author = byId.get(m.author_id)?.full_name ?? '';
    setTaskDraft({
      title: excerpt(m.body || m.attachments.map((a) => a.name).join(', '), 100),
      note: `Depuis la conversation « ${name} » — message ${/^[aeiouyéèêh]/i.test(author) ? 'd’' : 'de '}${author} (${format(parseISO(m.created_at), "d MMM 'à' HH:mm", { locale: fr })}) :\n${m.body}`,
      attachments: m.attachments,
    });
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-mab-filet px-4 py-3">
        <IconButton label="Retour aux conversations" className="lg:hidden" onClick={() => nav('/messages')}><ArrowLeft size={18} /></IconButton>
        <ConvAvatar c={conv} meId={me!.id} size={38} />
        <button className="min-w-0 flex-1 text-left" onClick={() => setInfoOpen(true)}>
          <p className="flex items-center gap-1.5 truncate font-semibold">{name}{mutedConvs.has(conv.id) && <BellOff size={13} className="text-mab-gris-doux" />}</p>
          <p className="truncate text-xs text-mab-texte">
            {group ? members.map((p) => (p.id === me!.id ? 'toi' : p.full_name.split(' ')[0])).join(', ') : members.find((p) => p.id !== me!.id)?.job_title}
          </p>
        </button>
        <IconButton label={group ? 'Infos du groupe' : 'Infos'} onClick={() => setInfoOpen(true)}><Info size={18} /></IconButton>
        <div className="relative">
          <IconButton label="Plus d’options" onClick={() => setMenuOpen((o) => !o)}><MoreHorizontal size={18} /></IconButton>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-30 w-60 rounded-mab-champ border border-mab-filet bg-white p-1 shadow-mab-flottante" onClick={() => setMenuOpen(false)}>
                <MenuItem icon={myPref?.pinned ? PinOff : Pin} label={myPref?.pinned ? 'Désépingler de la liste' : 'Épingler en haut de la liste'} onClick={() => setConversationPref(conv.id, { pinned: !myPref?.pinned })} />
                <MenuItem icon={BellOff} label={myPref?.muted ? 'Réactiver les alertes' : 'Mettre en sourdine'} onClick={() => setConversationPref(conv.id, { muted: !myPref?.muted })} />
                <MenuItem icon={MailOpen} label="Marquer comme non lu" onClick={async () => { await markConversationUnread(conv.id); nav('/messages'); }} />
                <MenuItem icon={group ? Users : UserPlus} label={group ? 'Infos et membres' : 'Créer un groupe avec…'} onClick={() => setInfoOpen(true)} />
                {group && <MenuItem icon={LogOut} label="Quitter le groupe" danger onClick={() => { if (confirm('Quitter ce groupe ? Tu ne verras plus ses messages.')) { leaveConversation(conv); nav('/messages'); } }} />}
                {(group ? manage : true) && (
                  <MenuItem icon={Trash2} label={group ? 'Supprimer le groupe' : 'Supprimer la conversation'} danger onClick={() => {
                    if (confirm(group ? `Supprimer « ${name} » et tous ses messages, pour tous les membres ?` : 'Supprimer cette conversation et tous ses messages, pour vous deux ?')) { deleteConversation(conv); nav('/messages'); }
                  }} />
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {pinned.length > 0 && (
        <div className="border-b border-mab-filet bg-white px-4 py-2">
          <button onClick={() => setPinsOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm" aria-expanded={pinsOpen}>
            <Pin size={14} className="shrink-0 text-mab-rose" />
            <span className="font-medium">{pinned.length} message{pinned.length > 1 ? 's' : ''} épinglé{pinned.length > 1 ? 's' : ''}</span>
            {!pinsOpen && <span className="truncate text-mab-texte">· {excerpt(pinned[pinned.length - 1].body, 60)}</span>}
          </button>
          {pinsOpen && (
            <div className="mt-2 grid gap-1">
              {pinned.map((m) => (
                <button key={m.id} onClick={() => { jumpTo(m.id); setPinsOpen(false); }} className="rounded-mab-etiquette px-2 py-1.5 text-left text-sm hover:bg-mab-wash">
                  <b>{byId.get(m.author_id)?.full_name.split(' ')[0]}</b> : {excerpt(m.body || m.attachments.map((a) => a.name).join(', '), 120)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={`relative min-h-0 flex-1 overflow-y-auto bg-mab-wash px-4 py-4 sm:px-6 ${dragOver ? 'ring-2 ring-inset ring-mab-aqua' : ''}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]); }}
        onClick={() => { setPicker(null); setTouched(null); }}
      >
        {messages.length === 0 && <p className="py-10 text-center text-sm text-mab-texte">Écris le premier message.</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.author_id === me!.id;
          const newDay = !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
          const sameBlock = prev && !newDay && prev.author_id === m.author_id && !m.reply_to && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
          const author = byId.get(m.author_id);
          const parent = m.reply_to ? byMsg.get(m.reply_to) : undefined;
          const reactions = snap.reactions.filter((r) => r.message_id === m.id);
          const grouped = EMOJIS.concat([...new Set(reactions.map((r) => r.emoji))].filter((e) => !EMOJIS.includes(e)))
            .map((e) => ({ e, users: reactions.filter((r) => r.emoji === e).map((r) => r.user_id) }))
            .filter((g) => g.users.length);
          const isPinned = conv.pinned_ids.includes(m.id);
          return (
            <Fragment key={m.id}>
              {newDay && <p className="my-4 text-center text-xs font-medium capitalize text-mab-gris">{dayLabel(m.created_at)}</p>}
              <div
                id={`msg-${m.id}`}
                onClick={(e) => { if (isTouch && editingId !== m.id) { e.stopPropagation(); setTouched(touched === m.id ? null : m.id); setPicker(null); } }}
                className={`group relative flex items-end gap-2 rounded-mab-champ transition-colors ${mine ? 'justify-end' : ''} ${sameBlock ? 'mt-1' : 'mt-3'} ${flash === m.id ? 'bg-mab-wash-2' : ''}`}>
                {!mine && <span className="w-8 shrink-0">{!sameBlock && <Avatar p={author} size={32} />}</span>}
                <div className={`flex max-w-[78%] flex-col sm:max-w-[65%] ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && group && !sameBlock && <span className="mb-1 ml-1 text-xs font-medium text-mab-texte">{author?.full_name}</span>}
                  {editingId === m.id ? (
                    <div className="w-[min(480px,70vw)]">
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editText.trim()) editMessage(m, editText); setEditingId(null); }
                          if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                        }}
                        rows={3}
                        className="w-full rounded-mab-champ border border-mab-aqua bg-white px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-mab-aqua/30"
                      />
                      <p className="text-right text-[11px] text-mab-gris-doux">Entrée pour enregistrer · Échap pour annuler</p>
                    </div>
                  ) : (
                    <div
                      title={format(parseISO(m.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                      className={`whitespace-pre-wrap break-words rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                        mine ? 'rounded-br-md bg-mab-aqua-encre text-white' : 'rounded-bl-md border border-mab-filet bg-white text-mab-encre'
                      } ${isPinned ? 'ring-2 ring-mab-filet-rose' : ''}`}
                    >
                      {parent && (
                        <button
                          onClick={(e) => { e.stopPropagation(); jumpTo(parent.id); }}
                          className={`mb-1.5 block w-full rounded-mab-etiquette border-l-[3px] px-2.5 py-1 text-left text-xs ${mine ? 'border-mab-aqua-clair bg-white/10 text-mab-profond-texte' : 'border-mab-aqua bg-mab-wash text-mab-texte'}`}
                        >
                          <b>{byId.get(parent.author_id)?.full_name.split(' ')[0]}</b> · {excerpt(parent.body || '📎 pièce jointe', 90)}
                        </button>
                      )}
                      {m.reply_to && !parent && <span className="mb-1 block text-xs italic opacity-70">Réponse à un message supprimé</span>}
                      {m.body && linkify(m.body, members, mine)}
                      {m.attachments.length > 0 && (
                        <span className={`grid gap-1 ${m.body ? 'mt-2' : ''}`}>
                          {m.attachments.map((a) => (
                            <button
                              key={a.id}
                              onClick={(e) => { e.stopPropagation(); openAtt(a); }}
                              className={`flex items-center gap-2 rounded-mab-etiquette px-2.5 py-1.5 text-left text-sm ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-mab-wash hover:bg-mab-wash-2'}`}
                            >
                              <FileText size={15} className="shrink-0" /><span className="truncate">{a.name}</span>
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                  {grouped.length > 0 && (
                    <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? 'justify-end pr-2' : 'pl-2'}`}>
                      {grouped.map((g) => (
                        <button
                          key={g.e}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(m, g.e); }}
                          title={g.users.map((u) => (u === me!.id ? 'Toi' : byId.get(u)?.full_name.split(' ')[0])).join(', ')}
                          className={`flex items-center gap-1 rounded-mab-pilule border px-1.5 py-0.5 text-xs shadow-sm ${g.users.includes(me!.id) ? 'border-mab-aqua bg-mab-wash-2' : 'border-mab-filet bg-white'}`}
                        >
                          <span>{g.e}</span><span className="font-semibold text-mab-texte">{g.users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {(!messages[i + 1] || messages[i + 1].author_id !== m.author_id || m.edited_at || isPinned || m.id === lastMine?.id) && (
                    <span className="mt-1 px-1 text-[11px] text-mab-gris-doux">
                      {format(parseISO(m.created_at), 'HH:mm')}{m.edited_at && ' · modifié'}{isPinned && ' · 📌'}
                      {m.id === lastMine?.id && seenBy.length > 0 && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-mab-aqua-texte" title={seenBy.map((p) => p.full_name).join(', ')}>
                          <CheckCheck size={13} /> {group ? `Vu par ${seenBy.length === members.length - 1 ? 'tous' : seenBy.map((p) => p.full_name.split(' ')[0]).join(', ')}` : 'Vu'}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {editingId !== m.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute -top-4 z-10 hidden items-center gap-0.5 rounded-mab-pilule border border-mab-filet bg-white p-0.5 shadow-mab-carte [@media(hover:hover)]:group-hover:flex ${picker === m.id || touched === m.id ? '!flex' : ''} ${mine ? 'right-2' : 'left-12'} max-sm:-top-9 max-sm:left-auto max-sm:right-2`}
                  >
                    <IconButton label="Réagir" className="!h-7 !w-7 [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => setPicker(picker === m.id ? null : m.id)}><SmilePlus size={15} /></IconButton>
                    <IconButton label="Répondre" className="!h-7 !w-7 [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => { setReplyTo(m); setTouched(null); }}><Reply size={15} /></IconButton>
                    <IconButton label={isPinned ? 'Désépingler' : 'Épingler'} className="!h-7 !w-7 [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => togglePin(conv, m.id)}><Pin size={15} /></IconButton>
                    <IconButton label="Transformer en tâche" className="!h-7 !w-7 [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => toTask(m)}><ListPlus size={15} /></IconButton>
                    {mine && <IconButton label="Modifier" className="!h-7 !w-7 [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => { setEditingId(m.id); setEditText(m.body); }}><Pencil size={14} /></IconButton>}
                    {mine && <IconButton label="Supprimer" className="!h-7 !w-7 hover:!text-mab-erreur [@media(hover:none)]:!h-9 [@media(hover:none)]:!w-9" onClick={() => confirm('Supprimer ce message pour tout le monde ?') && deleteMessage(m.id)}><Trash2 size={14} /></IconButton>}
                    {picker === m.id && (
                      <div className={`absolute top-9 flex gap-0.5 rounded-mab-pilule border border-mab-filet bg-white p-1 shadow-mab-flottante ${mine ? 'right-0' : 'left-0'}`}>
                        {EMOJIS.map((e) => (
                          <button key={e} onClick={() => { toggleReaction(m, e); setPicker(null); }} className="grid h-8 w-8 place-items-center rounded-full text-lg hover:bg-mab-wash-2" aria-label={`Réagir ${e}`}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="pb-safe border-t border-mab-filet bg-white">
        {replyTo && (
          <div className="flex items-center gap-2 border-b border-mab-filet bg-mab-wash px-4 py-2 text-sm">
            <Reply size={15} className="shrink-0 text-mab-aqua-texte" />
            <span className="min-w-0 flex-1 truncate">Réponse à <b>{byId.get(replyTo.author_id)?.full_name.split(' ')[0]}</b> : {excerpt(replyTo.body || '📎 pièce jointe', 90)}</span>
            <IconButton label="Annuler la réponse" className="!h-7 !w-7" onClick={() => setReplyTo(null)}><X size={15} /></IconButton>
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-mab-pilule border border-mab-filet bg-mab-wash py-1 pl-3 pr-1 text-xs">
                <FileText size={13} /> <span className="max-w-[180px] truncate">{f.name}</span>
                <button aria-label={`Retirer ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-mab-rail"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        {mentionList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {mentionList.map((p) => (
              <button key={p.id} onMouseDown={(e) => { e.preventDefault(); insertMention(p); }} className="flex items-center gap-1.5 rounded-mab-pilule border border-mab-filet-aqua bg-mab-wash-2 py-0.5 pl-0.5 pr-3 text-sm">
                <Avatar p={p} size={22} /> {p.full_name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 p-3">
          <IconButton label="Joindre un fichier" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></IconButton>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const mm = /@([\p{L}-]*)$/u.exec(e.target.value.slice(0, e.target.selectionStart));
              setMention(group && mm ? { q: mm[1], start: e.target.selectionStart - mm[0].length } : null);
              e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (mentionList.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); insertMention(mentionList[0]); return; }
              if (mention && e.key === 'Escape') { e.stopPropagation(); setMention(null); return; }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              if (e.key === 'Escape' && replyTo) { e.stopPropagation(); setReplyTo(null); }
            }}
            onPaste={(e) => { const pasted = Array.from(e.clipboardData.files); if (pasted.length) { e.preventDefault(); setFiles((f) => [...f, ...pasted]); } }}
            placeholder={group ? 'Écrire au groupe… @prénom pour mentionner' : `Écrire à ${name.split(' ')[0]}…`}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-mab-champ border border-mab-filet bg-white px-4 py-2.5 text-[15px] focus:border-mab-aqua focus:outline-none focus:ring-2 focus:ring-mab-aqua/30"
          />
          <button
            aria-label="Envoyer"
            disabled={(!text.trim() && !files.length) || sending}
            onClick={send}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mab-rose text-white shadow-mab-cta transition hover:bg-mab-rose-texte disabled:bg-mab-terrain-2-fond disabled:text-mab-gris-doux disabled:shadow-none"
          >
            <Send size={18} className={sending ? 'animate-pulse' : ''} />
          </button>
        </div>
        <p className="px-4 pb-2 text-[11px] text-mab-gris-doux max-sm:hidden">Entrée pour envoyer · Maj + Entrée pour aller à la ligne · glisse ou colle un fichier pour le joindre</p>
      </div>

      <ConversationInfo open={infoOpen} conv={conv} onClose={() => setInfoOpen(false)} />
      <TaskModal draft={taskDraft} onClose={() => setTaskDraft(null)} />
    </>
  );
}

function NewConversationModal({ preset, onClose, onGroup }: { preset: string[] | null; onClose: () => void; onGroup: () => void }) {
  const { snap, me, startConversation } = useStore();
  const nav = useNavigate();
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (preset) { setIds(preset); setTitle(''); setBody(''); } }, [preset]);
  if (!preset) return null;
  const people = snap.profiles.filter((p) => p.active && p.id !== me!.id);
  const valid = ids.length > 0 && body.trim();
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const id = await startConversation(ids, ids.length > 1 ? title : '', body);
    setBusy(false);
    onClose();
    nav(`/messages/${id}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau message"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid || busy} onClick={submit}><Send size={16} /> Envoyer</Button></>}
    >
      <div className="grid gap-4">
        <p className="-mt-1 text-sm text-mab-texte">Pour un groupe avec nom, photo et administrateurs : <button type="button" className="font-medium text-mab-aqua-texte underline" onClick={onGroup}>créer un groupe</button>.</p>
        <Field label="À qui ?" help="Une personne pour une discussion privée, plusieurs pour un échange rapide.">
          <div className="mb-2 flex gap-2">
            <button type="button" className="text-xs font-medium text-mab-aqua-texte hover:underline" onClick={() => setIds(people.map((p) => p.id))}>Toute l’équipe</button>
            {ids.length > 0 && <button type="button" className="text-xs text-mab-texte hover:underline" onClick={() => setIds([])}>Aucun</button>}
          </div>
          <PeoplePicker people={people} value={ids} onChange={setIds} />
        </Field>
        {ids.length > 1 && (
          <Field label="Nom du groupe (facultatif)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Direction, Équipe Avignon…" />
          </Field>
        )}
        <Field label="Message">
          <Textarea autoFocus={preset.length > 0} rows={4} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} />
        </Field>
      </div>
    </Modal>
  );
}

function GroupPhotoPicker({ url, onPick, busy, size = 88 }: { url: string | null; onPick: (f: File) => void; busy?: boolean; size?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button type="button" onClick={() => ref.current?.click()} aria-label="Choisir la photo du groupe" className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mab-aqua">
      {url
        ? <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
        : <span className="grid place-items-center rounded-full bg-mab-wash-2 text-mab-aqua-texte" style={{ width: size, height: size }}><Users size={size * 0.4} /></span>}
      <span className={`absolute inset-0 grid place-items-center rounded-full bg-mab-encre/45 text-white transition ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <Camera size={20} className={busy ? 'animate-pulse' : ''} />
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-mab-aqua-encre text-white [@media(hover:hover)]:hidden"><Camera size={13} /></span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </button>
  );
}

function NewGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snap, me, createGroup } = useStore();
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(''); setDescription(''); setIds([]); setPhoto(null); setPreview(null); } }, [open]);
  useEffect(() => { if (!photo) return; const u = URL.createObjectURL(photo); setPreview(u); return () => URL.revokeObjectURL(u); }, [photo]);
  if (!open) return null;
  const people = snap.profiles.filter((p) => p.active && p.id !== me!.id);
  const valid = title.trim() && ids.length > 0;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const id = await createGroup({ title, description, memberIds: ids, photo });
    setBusy(false);
    onClose();
    nav(`/messages/${id}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau groupe"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid || busy} onClick={submit}><Users size={16} /> {busy ? 'Création…' : 'Créer le groupe'}</Button></>}
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <GroupPhotoPicker url={preview} onPick={setPhoto} />
          <div className="grid flex-1 gap-3">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom du groupe (ex. Direction, Équipe Avignon)" aria-label="Nom du groupe" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (facultatif)" aria-label="Description" />
          </div>
        </div>
        <Field label={`Membres${ids.length ? ` · ${ids.length + 1} avec toi` : ''}`}>
          <div className="mb-2 flex gap-2">
            <button type="button" className="text-xs font-medium text-mab-aqua-texte hover:underline" onClick={() => setIds(people.map((p) => p.id))}>Toute l’équipe</button>
            {ids.length > 0 && <button type="button" className="text-xs text-mab-texte hover:underline" onClick={() => setIds([])}>Aucun</button>}
          </div>
          <PeoplePicker people={people} value={ids} onChange={setIds} />
        </Field>
        <p className="text-sm text-mab-texte">Tu seras administrateur du groupe : tu pourras changer son nom et sa photo, gérer les membres et nommer d’autres admins.</p>
      </div>
    </Modal>
  );
}

/** Fiche d'une conversation : infos, membres et rôles, fichiers partagés, messages épinglés, réglages. */
function ConversationInfo({ open, conv, onClose }: { open: boolean; conv: Conversation; onClose: () => void }) {
  const {
    snap, me, byId, updateConversation, setGroupPhoto, addGroupMembers, removeGroupMember, toggleGroupAdmin,
    leaveConversation, deleteConversation, startConversation, setConversationPref, mutedConvs,
  } = useStore();
  const toast = useToast();
  const openAtt = useOpenAttachment();
  const nav = useNavigate();
  const [tab, setTab] = useState<'membres' | 'fichiers' | 'epingles'>('membres');
  const [title, setTitle] = useState(conv.title ?? '');
  const [description, setDescription] = useState(conv.description);
  const [adding, setAdding] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(conv.title ?? ''); setDescription(conv.description); setAdding([]); setShowAdd(false); setTab('membres'); } }, [open, conv.title, conv.description]);
  if (!open) return null;

  const group = isGroup(conv);
  const manage = canManage(conv, me);
  const name = conversationName(conv, me!.id, byId);
  const members = conv.member_ids.map((x) => byId.get(x)).filter(Boolean) as Profile[];
  const candidates = snap.profiles.filter((p) => p.active && !conv.member_ids.includes(p.id));
  const messages = snap.messages.filter((m) => m.conversation_id === conv.id);
  const files = messages.flatMap((m) => m.attachments.map((a) => ({ a, m }))).reverse();
  const pinned = conv.pinned_ids.map((id) => messages.find((m) => m.id === id)).filter(Boolean) as Message[];
  const muted = mutedConvs.has(conv.id);

  const saveInfo = () => {
    const patch: Partial<Conversation> = {};
    if (title.trim() && title.trim() !== conv.title) patch.title = title.trim();
    if (description.trim() !== conv.description) patch.description = description.trim();
    if (Object.keys(patch).length) updateConversation(conv, patch, 'Groupe mis à jour');
  };
  const pickPhoto = async (f: File | null) => {
    setPhotoBusy(true);
    try { await setGroupPhoto(conv, f); } catch (e) { toast((e as Error).message, 'erreur'); }
    finally { setPhotoBusy(false); }
  };
  const addPeople = async () => {
    if (!adding.length) return;
    if (!group) {
      // Ajouter quelqu'un à une discussion à deux crée un nouveau groupe : l'historique privé reste privé.
      const others = [...conv.member_ids.filter((x) => x !== me!.id), ...adding];
      const id = await startConversation(others, `${members.map((p) => p.full_name.split(' ')[0]).join(', ')}…`, '');
      onClose();
      nav(`/messages/${id}`);
      return;
    }
    await addGroupMembers(conv, adding);
    setAdding([]); setShowAdd(false);
  };

  return (
    <Modal open wide onClose={onClose} title={group ? 'Infos du groupe' : 'Infos de la conversation'}>
      <div className="grid gap-5">
        {group ? (
          <div className="flex flex-wrap items-start gap-4">
            {manage ? <GroupPhotoPicker url={conv.avatar_url} busy={photoBusy} onPick={(f) => pickPhoto(f)} /> : <ConvAvatar c={conv} meId={me!.id} size={88} />}
            <div className="grid min-w-[220px] flex-1 gap-2">
              {manage ? (
                <>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveInfo} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Nom du groupe" className="!text-lg !font-semibold" />
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveInfo} placeholder="Description du groupe" aria-label="Description" />
                  {conv.avatar_url && <button className="justify-self-start text-xs text-mab-texte hover:underline" onClick={() => pickPhoto(null)}>Retirer la photo</button>}
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold">{name}</p>
                  {conv.description && <p className="text-sm text-mab-texte">{conv.description}</p>}
                </>
              )}
              <p className="text-xs text-mab-gris-doux">Créé par {byId.get(conv.created_by ?? '')?.full_name ?? '—'} · {members.length} membres</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ConvAvatar c={conv} meId={me!.id} size={64} />
            <div>
              <p className="text-xl font-semibold">{name}</p>
              <p className="text-sm text-mab-texte">{members.find((p) => p.id !== me!.id)?.job_title}</p>
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 rounded-mab-champ bg-mab-wash px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><BellOff size={16} className="text-mab-aqua-texte" /> <span><b>Sourdine</b> · ni son ni alerte (les @mentions passent quand même)</span></span>
          <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={muted} onChange={(e) => setConversationPref(conv.id, { muted: e.target.checked })} />
        </label>

        <Tabs value={tab} onChange={setTab} items={[
          { id: 'membres', label: 'Membres', count: members.length },
          { id: 'fichiers', label: 'Fichiers', count: files.length },
          { id: 'epingles', label: 'Épinglés', count: pinned.length },
        ]} />

        {tab === 'membres' && (
          <div>
            <div className="grid">
              {members.map((p) => {
                const admin = conv.admin_ids.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 border-b border-mab-filet py-2.5 last:border-0">
                    <Avatar p={p} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.full_name}{p.id === me!.id && ' (toi)'}</p>
                      <p className="truncate text-xs text-mab-texte">{p.job_title}</p>
                    </div>
                    {group && admin && <Badge tone="mesure"><Crown size={11} /> Admin</Badge>}
                    {group && manage && p.id !== me!.id && (
                      <div className="flex">
                        <IconButton label={admin ? 'Retirer le rôle admin' : 'Nommer admin du groupe'} onClick={() => toggleGroupAdmin(conv, p.id)}><Crown size={15} /></IconButton>
                        <IconButton label="Retirer du groupe" className="hover:!text-mab-erreur" onClick={() => confirm(`Retirer ${p.full_name} du groupe ?`) && removeGroupMember(conv, p.id)}><UserMinus size={15} /></IconButton>
                      </div>
                    )}
                    {p.id !== me!.id && group && (
                      <IconButton label={`Écrire à ${p.full_name.split(' ')[0]} en privé`} onClick={() => { onClose(); nav(`/messages?a=${p.id}`); }}><MessageSquarePlus size={15} /></IconButton>
                    )}
                  </div>
                );
              })}
            </div>
            {(manage || !group) && candidates.length > 0 && (
              showAdd ? (
                <div className="mt-3 grid gap-3 rounded-mab-champ border border-mab-filet p-3">
                  {!group && <p className="text-sm text-mab-texte">Ajouter quelqu’un crée un <b>nouveau groupe</b> ; cette discussion à deux reste privée.</p>}
                  <PeoplePicker people={candidates} value={adding} onChange={setAdding} />
                  <div className="flex justify-end gap-2">
                    <Button variant="tertiaire" onClick={() => setShowAdd(false)}>Annuler</Button>
                    <Button variant="secondaire" disabled={!adding.length} onClick={addPeople}><UserPlus size={15} /> {group ? 'Ajouter' : 'Créer le groupe'}</Button>
                  </div>
                </div>
              ) : (
                <Button variant="discret" className="mt-2" onClick={() => setShowAdd(true)}><UserPlus size={15} /> {group ? 'Ajouter des membres' : 'Créer un groupe avec d’autres personnes'}</Button>
              )
            )}
          </div>
        )}

        {tab === 'fichiers' && (
          files.length === 0 ? <p className="text-sm text-mab-texte">Aucun fichier partagé dans cette conversation.</p> : (
            <div className="grid gap-1.5">
              {files.map(({ a, m }) => (
                <button key={a.id} onClick={() => openAtt(a)} className="flex items-center gap-3 rounded-mab-champ border border-mab-filet px-3 py-2 text-left hover:bg-mab-wash">
                  <FileText size={16} className="shrink-0 text-mab-aqua-texte" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                  <span className="shrink-0 text-xs text-mab-gris-doux">{byId.get(m.author_id)?.full_name.split(' ')[0]} · {format(parseISO(m.created_at), 'd MMM', { locale: fr })}</span>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'epingles' && (
          pinned.length === 0 ? <p className="text-sm text-mab-texte">Aucun message épinglé. Survole un message puis 📌 pour l’épingler.</p> : (
            <div className="grid gap-2">
              {pinned.map((m) => (
                <div key={m.id} className="rounded-mab-champ border border-mab-filet-rose bg-mab-rose-wash px-4 py-3 text-sm">
                  <p className="mb-1 text-xs text-mab-texte"><b>{byId.get(m.author_id)?.full_name}</b> · {format(parseISO(m.created_at), "d MMM 'à' HH:mm", { locale: fr })}</p>
                  <p className="whitespace-pre-wrap">{m.body || '📎 Pièce jointe'}</p>
                </div>
              ))}
            </div>
          )
        )}

        <div className="flex flex-wrap gap-2 border-t border-mab-filet pt-4">
          {group && (
            <Button variant="danger" onClick={() => { if (confirm('Quitter ce groupe ? Tu ne verras plus ses messages.')) { onClose(); leaveConversation(conv); nav('/messages'); } }}>
              <LogOut size={15} /> Quitter le groupe
            </Button>
          )}
          {(group ? manage : true) && (
            <Button variant="danger" onClick={() => {
              if (confirm(group ? `Supprimer « ${name} » et tous ses messages, pour tous les membres ?` : 'Supprimer cette conversation et tous ses messages, pour vous deux ?')) { onClose(); deleteConversation(conv); nav('/messages'); }
            }}>
              <Trash2 size={15} /> {group ? 'Supprimer le groupe' : 'Supprimer la conversation'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
