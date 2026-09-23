import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LogOut, MessageSquarePlus, Pencil, Search, Send, Trash2, UserPlus, Users } from 'lucide-react';
import { isToday, isYesterday, parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useStore } from '../state/store';
import type { Conversation, Profile } from '../lib/types';
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

function Thread({ conv }: { conv: Conversation }) {
  const { snap, me, byId, sendMessage, markConversationRead, unreadByConv, deleteMessage } = useStore();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [managing, setManaging] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = useMemo(
    () => snap.messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [snap.messages, conv.id],
  );
  const unread = unreadByConv.get(conv.id) ?? 0;
  const group = conv.member_ids.length > 2 || !!conv.title;
  const name = conversationName(conv, me!.id, byId);
  const members = conv.member_ids.map((x) => byId.get(x)).filter(Boolean) as Profile[];

  useEffect(() => { if (unread > 0) markConversationRead(conv.id); }, [unread, conv.id, markConversationRead]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  useEffect(() => { input.current?.focus(); }, [conv.id]);

  const send = () => {
    if (!text.trim()) return;
    sendMessage(conv, text);
    setText('');
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-mab-wash px-4 py-4 sm:px-6">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-mab-texte">Écris le premier message.</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.author_id === me!.id;
          const newDay = !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
          const sameBlock = prev && !newDay && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
          const author = byId.get(m.author_id);
          return (
            <Fragment key={m.id}>
              {newDay && <p className="my-4 text-center text-xs font-medium capitalize text-mab-gris">{dayLabel(m.created_at)}</p>}
              <div className={`group flex items-end gap-2 ${mine ? 'justify-end' : ''} ${sameBlock ? 'mt-1' : 'mt-3'}`}>
                {!mine && <span className="w-8 shrink-0">{!sameBlock && <Avatar p={author} size={32} />}</span>}
                {mine && (
                  <button aria-label="Supprimer le message" className="mb-2 text-mab-gris-doux opacity-0 transition hover:text-mab-erreur group-hover:opacity-100" onClick={() => confirm('Supprimer ce message pour tout le monde ?') && deleteMessage(m.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
                <div className={`max-w-[78%] sm:max-w-[65%] ${mine ? 'items-end' : ''} flex flex-col`}>
                  {!mine && group && !sameBlock && <span className="mb-1 ml-1 text-xs font-medium text-mab-texte">{author?.full_name}</span>}
                  <div
                    title={format(parseISO(m.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                    className={`whitespace-pre-wrap break-words rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                      mine ? 'rounded-br-md bg-mab-aqua-encre text-white' : 'rounded-bl-md border border-mab-filet bg-white text-mab-encre'
                    }`}
                  >
                    {linkify(m.body)}
                  </div>
                  {(!messages[i + 1] || messages[i + 1].author_id !== m.author_id) && (
                    <span className="mt-1 px-1 text-[11px] text-mab-gris-doux">{format(parseISO(m.created_at), 'HH:mm')}</span>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="flex items-end gap-2 border-t border-mab-filet bg-white p-3">
        <textarea
          ref={input}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); (e.target as HTMLTextAreaElement).style.height = 'auto'; } }}
          placeholder={`Écrire à ${group ? 'tout le groupe' : name.split(' ')[0]}…`}
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-mab-champ border border-mab-filet bg-white px-4 py-2.5 text-[15px] focus:border-mab-aqua focus:outline-none focus:ring-2 focus:ring-mab-aqua/30"
        />
        <button
          aria-label="Envoyer"
          disabled={!text.trim()}
          onClick={send}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mab-rose text-white shadow-mab-cta transition hover:bg-mab-rose-texte disabled:bg-mab-terrain-2-fond disabled:text-mab-gris-doux disabled:shadow-none"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="bg-white px-4 pb-2 text-[11px] text-mab-gris-doux">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>

      <ManageModal open={managing} conv={conv} onClose={() => setManaging(false)} />
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
