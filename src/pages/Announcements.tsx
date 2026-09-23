import { useEffect, useState } from 'react';
import { BellRing, Check, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Announcement } from '../lib/types';
import { fmtStamp } from '../lib/dates';
import { isAdmin } from '../lib/permissions';
import { Markdown } from '../lib/markdown';
import { Avatar, AvatarStack, Badge, Button, Card, Empty, Field, Input, Modal, PageTitle, Textarea } from '../components/ui';

export default function Announcements() {
  const { snap, me, unreadAnnouncements } = useStore();
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null);
  const list = [...snap.announcements].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const admin = isAdmin(me);

  return (
    <>
      <PageTitle title={<>Les <b>annonces</b></>} sub="Les informations importantes pour toute l’équipe. Un clic sur « J’ai lu » pour confirmer.">
        {admin && <Button variant="primaire" onClick={() => setEditing({})}><Megaphone size={17} /> Nouvelle annonce</Button>}
      </PageTitle>
      {unreadAnnouncements.length > 0 && (
        <p className="mb-4 text-sm font-medium text-mab-rose-texte">{unreadAnnouncements.length} annonce{unreadAnnouncements.length > 1 ? 's' : ''} à lire</p>
      )}
      {list.length === 0 ? (
        <Empty icon={<Megaphone size={32} />} title="Aucune annonce" text={admin ? 'Publie la première : elle sera envoyée à toute l’équipe.' : 'Les annonces de la direction apparaîtront ici.'} />
      ) : (
        <div className="grid max-w-3xl gap-4">
          {list.map((a) => <AnnouncementCard key={a.id} a={a} onEdit={() => setEditing(a)} />)}
        </div>
      )}
      <AnnouncementModal draft={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function AnnouncementCard({ a, onEdit, compact = false }: { a: Announcement; onEdit?: () => void; compact?: boolean }) {
  const { snap, me, byId, markAnnouncementRead, deleteAnnouncement, remindAnnouncement } = useStore();
  const [showReaders, setShowReaders] = useState(false);
  const team = snap.profiles.filter((p) => p.active);
  const readerIds = new Set(snap.announcement_reads.filter((r) => r.announcement_id === a.id).map((r) => r.user_id));
  const readers = team.filter((p) => readerIds.has(p.id));
  const missing = team.filter((p) => !readerIds.has(p.id));
  const iRead = readerIds.has(me!.id);
  const admin = isAdmin(me);
  const author = byId.get(a.author_id);

  return (
    <Card className={`p-5 sm:p-6 ${!iRead ? (a.important ? 'border-mab-rose' : 'border-mab-filet-aqua') : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar p={author} size={36} />
          <div>
            <p className="text-sm"><b>{author?.full_name ?? '—'}</b></p>
            <p className="text-xs text-mab-gris-doux">{fmtStamp(a.created_at)}{a.updated_at && ' · modifiée'}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {a.important && <Badge tone="emotion">Important</Badge>}
          {!iRead && <Badge tone="mesure">Nouveau</Badge>}
        </div>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-mab-encre">{a.title}</h2>
      <Markdown text={a.body} className={compact ? 'line-clamp-4' : ''} />

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-mab-filet pt-4">
        <button onClick={() => setShowReaders((v) => !v)} className="flex items-center gap-2 text-sm text-mab-texte hover:text-mab-encre" aria-expanded={showReaders}>
          <AvatarStack people={readers} max={6} size={24} />
          <span>Lu par <b className="text-mab-encre">{readers.length}/{team.length}</b></span>
        </button>
        <div className="ml-auto flex flex-wrap gap-1">
          {admin && onEdit && <Button variant="discret" onClick={onEdit}><Pencil size={14} /> Modifier</Button>}
          {admin && missing.length > 0 && <Button variant="discret" onClick={() => remindAnnouncement(a)}><BellRing size={14} /> Relancer</Button>}
          {admin && <Button variant="discret" className="!text-mab-erreur" onClick={() => confirm('Supprimer cette annonce ?') && deleteAnnouncement(a.id)}><Trash2 size={14} /></Button>}
          {!iRead
            ? <Button variant="secondaire" className="!h-9" onClick={() => markAnnouncementRead(a)}><Check size={15} /> J’ai lu</Button>
            : <span className="inline-flex items-center gap-1 px-2 text-sm text-mab-succes"><Check size={15} /> Lu</span>}
        </div>
      </div>
      {showReaders && (
        <div className="mt-3 grid gap-3 rounded-mab-champ bg-mab-wash p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">Ont lu</p>
            {readers.map((p) => <p key={p.id}>{p.full_name}</p>)}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-mab-rose-texte">Pas encore</p>
            {missing.length ? missing.map((p) => <p key={p.id}>{p.full_name}</p>) : <p className="text-mab-texte">Tout le monde a lu 🎉</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

function AnnouncementModal({ draft, onClose }: { draft: Partial<Announcement> | null; onClose: () => void }) {
  const { saveAnnouncement } = useStore();
  const [a, setA] = useState<Partial<Announcement>>({});
  useEffect(() => { if (draft) setA({ important: false, ...draft }); }, [draft]);
  if (!draft) return null;
  const valid = a.title?.trim() && a.body?.trim();
  const submit = () => { if (!valid) return; saveAnnouncement({ ...a, title: a.title!.trim(), body: a.body!.trim() } as Announcement); onClose(); };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={draft.id ? 'Modifier l’annonce' : 'Nouvelle annonce'}
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid} onClick={submit}>{draft.id ? 'Enregistrer' : 'Publier à toute l’équipe'}</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Titre"><Input autoFocus value={a.title ?? ''} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="Ex. Nouveau protocole radiofréquence à partir du 1er octobre" /></Field>
        <Field label="Message" help="Mise en forme : **gras**, - liste, # titre, liens collés directement.">
          <Textarea rows={8} value={a.body ?? ''} onChange={(e) => setA({ ...a, body: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-mab-rose" checked={!!a.important} onChange={(e) => setA({ ...a, important: e.target.checked })} />
          <span><b>Important</b> : mise en avant en haut de « Ma journée » tant que ce n’est pas lu</span>
        </label>
        {!draft.id && <p className="text-sm text-mab-texte">Toute l’équipe reçoit une notification à la publication.</p>}
      </div>
    </Modal>
  );
}
