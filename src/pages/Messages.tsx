import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, ListPlus, LogOut, MessageSquarePlus, Paperclip, Pencil, Pin, Reply, Search, Send, SmilePlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { isToday, isYesterday, parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useStore } from '../state/store';
import type { Conversation, Message, Profile } from '../lib/types';
import { useToast } from '../state/toast';
import { useOpenAttachment } from '../components/TaskExtras';
import { TaskModal, type TaskDraft } from '../components/TaskModal';
import { conversationName } from '../lib/conversations';
import { Avatar, Button, Empty, Field, IconButton, Input, Modal, PeoplePicker, Textarea } from '../components/ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function ConvAvatar({ c, meId, size = 40 }: { c: Conversation; meId: string; size?: number }) {
  const { byId } = useStore();
  const others = c.member_ids.filter((id) => id !== meId);
  if (others.length === 1) return <Avatar p={byId.get(others[0])} size={size} />;
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
  const { snap, me, byId, unreadByConv } = useStore();
  const [q, setQ] = useState('');
  const [composeFor, setComposeFor] = useState<string[] | null>(null);

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
    .filter((c) => !q || norm(conversationName(c, me!.id, byId)).includes(norm(q)))
    .sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
  const current = snap.conversations.find((c) => c.id === id);

  return (
    <div className="-mb-10 grid h-[calc(100dvh-7.5rem)] min-h-[420px] overflow-hidden rounded-mab-carte border border-mab-filet bg-white sm:h-[calc(100dvh-9rem)] grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`flex min-h-0 flex-col border-mab-filet lg:border-r ${id ? 'hidden lg:flex' : 'flex'}`}>
        <div className="border-b border-mab-filet p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-2xl font-light">Mes <b className="font-semibold">messages</b></h1>
            <Button variant="secondaire" className="!h-10 !px-4" onClick={() => setComposeFor([])}><MessageSquarePlus size={16} /> Nouveau</Button>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-mab-pilule border border-mab-filet bg-mab-wash px-4">
            <Search size={15} className="text-mab-gris" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une conversation" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && <p className="px-5 py-10 text-center text-sm text-mab-texte">{q ? 'Aucune conversation trouvée.' : 'Aucune conversation. Écris à quelqu’un avec « Nouveau ».'}</p>}
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
                    <span className={`truncate text-[15px] ${unread ? 'font-semibold text-mab-encre' : 'font-medium text-mab-encre'}`}>{conversationName(c, me!.id, byId)}</span>
                    <span className="shrink-0 text-xs text-mab-gris-doux">{timeLabel(c.last_message_at)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${unread ? 'text-mab-encre' : 'text-mab-texte'}`}>{last ? `${c.member_ids.length > 2 || last.author_id === me!.id ? `${author} : ` : ''}${last.body}` : 'Pas encore de message'}</span>
                    {unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-mab-rose px-1.5 text-[11px] font-bold text-white">{unread}</span>}
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

      <NewConversationModal preset={composeFor} onClose={() => setComposeFor(null)} />
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2">{part}</a>
      : <Fragment key={i}>{part}</Fragment>,
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
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useMemo(
    () => snap.messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [snap.messages, conv.id],
  );
  const byMsg = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const unread = unreadByConv.get(conv.id) ?? 0;
  const group = conv.member_ids.length > 2 || !!conv.title;
  const name = conversationName(conv, me!.id, byId);
  const members = conv.member_ids.map((x) => byId.get(x)).filter(Boolean) as Profile[];
  const pinned = conv.pinned_ids.map((id) => byMsg.get(id)).filter(Boolean) as Message[];
  const [managing, setManaging] = useState(false);

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
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-mab-texte">
            {group ? members.map((p) => (p.id === me!.id ? 'toi' : p.full_name.split(' ')[0])).join(', ') : members.find((p) => p.id !== me!.id)?.job_title}
          </p>
        </div>
        <Button variant="discret" onClick={() => setManaging(true)}>{group ? <><Users size={15} /> Groupe</> : <><UserPlus size={15} /> Ajouter</>}</Button>
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
        onClick={() => setPicker(null)}
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
              <div id={`msg-${m.id}`} className={`group relative flex items-end gap-2 rounded-mab-champ transition-colors ${mine ? 'justify-end' : ''} ${sameBlock ? 'mt-1' : 'mt-3'} ${flash === m.id ? 'bg-mab-wash-2' : ''}`}>
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
                      {m.body && linkify(m.body)}
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
                  {(!messages[i + 1] || messages[i + 1].author_id !== m.author_id || m.edited_at || isPinned) && (
                    <span className="mt-1 px-1 text-[11px] text-mab-gris-doux">
                      {format(parseISO(m.created_at), 'HH:mm')}{m.edited_at && ' · modifié'}{isPinned && ' · 📌'}
                    </span>
                  )}
                </div>

                {editingId !== m.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute -top-4 z-10 hidden items-center gap-0.5 rounded-mab-pilule border border-mab-filet bg-white p-0.5 shadow-mab-carte group-hover:flex ${picker === m.id ? '!flex' : ''} ${mine ? 'right-2' : 'left-12'}`}
                  >
                    <IconButton label="Réagir" className="!h-7 !w-7" onClick={() => setPicker(picker === m.id ? null : m.id)}><SmilePlus size={15} /></IconButton>
                    <IconButton label="Répondre" className="!h-7 !w-7" onClick={() => setReplyTo(m)}><Reply size={15} /></IconButton>
                    <IconButton label={isPinned ? 'Désépingler' : 'Épingler'} className="!h-7 !w-7" onClick={() => togglePin(conv, m.id)}><Pin size={15} /></IconButton>
                    <IconButton label="Transformer en tâche" className="!h-7 !w-7" onClick={() => toTask(m)}><ListPlus size={15} /></IconButton>
                    {mine && <IconButton label="Modifier" className="!h-7 !w-7" onClick={() => { setEditingId(m.id); setEditText(m.body); }}><Pencil size={14} /></IconButton>}
                    {mine && <IconButton label="Supprimer" className="!h-7 !w-7 hover:!text-mab-erreur" onClick={() => confirm('Supprimer ce message pour tout le monde ?') && deleteMessage(m.id)}><Trash2 size={14} /></IconButton>}
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

      <div className="border-t border-mab-filet bg-white">
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
        <div className="flex items-end gap-2 p-3">
          <IconButton label="Joindre un fichier" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></IconButton>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              if (e.key === 'Escape' && replyTo) { e.stopPropagation(); setReplyTo(null); }
            }}
            onPaste={(e) => { const pasted = Array.from(e.clipboardData.files); if (pasted.length) { e.preventDefault(); setFiles((f) => [...f, ...pasted]); } }}
            placeholder={`Écrire à ${group ? 'tout le groupe' : name.split(' ')[0]}…`}
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
        <p className="px-4 pb-2 text-[11px] text-mab-gris-doux">Entrée pour envoyer · Maj + Entrée pour aller à la ligne · glisse ou colle un fichier pour le joindre</p>
      </div>

      <ManageModal open={managing} conv={conv} onClose={() => setManaging(false)} />
      <TaskModal draft={taskDraft} onClose={() => setTaskDraft(null)} />
    </>
  );
}

function NewConversationModal({ preset, onClose }: { preset: string[] | null; onClose: () => void }) {
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
        <Field label="À qui ?" help="Une personne pour une discussion privée, plusieurs pour un groupe.">
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

function ManageModal({ open, conv, onClose }: { open: boolean; conv: Conversation; onClose: () => void }) {
  const { snap, me, byId, updateConversation, leaveConversation, startConversation } = useStore();
  const nav = useNavigate();
  const [title, setTitle] = useState(conv.title ?? '');
  const [add, setAdd] = useState<string[]>([]);
  useEffect(() => { if (open) { setTitle(conv.title ?? ''); setAdd([]); } }, [open, conv.title]);
  if (!open) return null;
  const direct = conv.member_ids.length === 2 && !conv.title;
  const candidates = snap.profiles.filter((p) => p.active && !conv.member_ids.includes(p.id));

  const save = async () => {
    if (direct && add.length) {
      // Ajouter quelqu'un à une discussion privée crée un nouveau groupe : l'historique à deux reste privé.
      onClose();
      const others = [...conv.member_ids.filter((x) => x !== me!.id), ...add];
      const id = await startConversation(others, title, '');
      nav(`/messages/${id}`);
      return;
    }
    const patch: Partial<Conversation> = {};
    if ((title.trim() || null) !== conv.title) patch.title = title.trim() || null;
    if (add.length) patch.member_ids = [...conv.member_ids, ...add];
    if (Object.keys(patch).length) updateConversation(conv, patch, 'Groupe mis à jour');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={direct ? 'Créer un groupe' : 'Groupe'}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => { if (confirm('Quitter cette conversation ? Tu ne verras plus ses messages.')) { onClose(); leaveConversation(conv); nav('/messages'); } }}>
            <LogOut size={15} /> Quitter
          </Button>
          <Button variant="tertiaire" onClick={onClose}>Annuler</Button>
          <Button variant="primaire" onClick={save} disabled={direct && !add.length}>{direct ? 'Créer le groupe' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="grid gap-5">
        {direct && <p className="text-sm text-mab-texte">Ajouter quelqu’un crée un <b>nouveau groupe</b>. Cette discussion à deux reste privée.</p>}
        {(!direct || add.length > 0) && (
          <Field label="Nom du groupe">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Facultatif" />
          </Field>
        )}
        {!direct && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Pencil size={14} /> Participants</p>
            <div className="flex flex-wrap gap-2">
              {conv.member_ids.map((x) => byId.get(x)).filter(Boolean).map((p) => (
                <span key={p!.id} className="flex items-center gap-2 rounded-mab-pilule border border-mab-filet py-1 pl-1 pr-3 text-sm"><Avatar p={p} size={22} />{p!.full_name}</span>
              ))}
            </div>
          </div>
        )}
        {candidates.length > 0 && (
          <Field label="Ajouter des personnes">
            <PeoplePicker people={candidates} value={add} onChange={setAdd} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
