import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ClipboardPaste, Copy, ExternalLink, FolderPlus, Link2, Lock, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import type { LinkFolder, UsefulLink } from '../lib/types';
import { isAdmin } from '../lib/permissions';
import { PROJECT_COLORS } from '../lib/palette';
import { domainOf, faviconOf, normalizeUrl, parseBulk, suggestTitle } from '../lib/links';
import { ActionMenu, Button, Card, Empty, Field, Input, Modal, PageTitle, Select, Textarea } from '../components/ui';

const EMOJIS = ['📁', '📱', '🌐', '🧲', '📊', '🛠️', '🎓', '💼', '📣', '🛒', '🔒', '⭐', '🧾', '🎥', '🗂️', '💡'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Links() {
  const { snap } = useStore();
  const [q, setQ] = useState('');
  const [linkDraft, setLinkDraft] = useState<Partial<UsefulLink> | null>(null);
  const [folderDraft, setFolderDraft] = useState<Partial<LinkFolder> | null>(null);
  const [bulkFolder, setBulkFolder] = useState<string | null | undefined>(undefined);

  const folders = [...snap.link_folders].sort((a, b) => a.position - b.position);
  const match = (l: UsefulLink) => !q || norm(`${l.title} ${l.url} ${l.description}`).includes(norm(q));
  const byFolder = (id: string | null) => snap.links.filter((l) => l.folder_id === id && match(l)).sort((a, b) => a.position - b.position);
  const favorites = snap.links.filter((l) => l.pinned && match(l)).sort((a, b) => a.title.localeCompare(b.title));
  const loose = byFolder(null);
  const total = snap.links.length;

  return (
    <>
      <PageTitle title={<>Liens <b>utiles</b></>} sub="Toutes les adresses importantes de l’équipe, rangées par dossier.">
        <Button onClick={() => setFolderDraft({})}><FolderPlus size={16} /> Dossier</Button>
        <Button onClick={() => setBulkFolder(folders[0]?.id ?? null)} className="max-sm:!px-4"><ClipboardPaste size={16} /><span className="max-sm:hidden"> Coller plusieurs liens</span></Button>
        <Button variant="primaire" onClick={() => setLinkDraft({ folder_id: folders[0]?.id ?? null })}><Plus size={17} /> Ajouter un lien</Button>
      </PageTitle>

      {total > 0 && (
        <div className="mb-5 flex h-11 max-w-xl items-center gap-2 rounded-mab-pilule border border-mab-filet bg-white px-4">
          <Search size={16} className="text-mab-gris" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher parmi ${total} lien${total > 1 ? 's' : ''}`} className="flex-1 bg-transparent text-[15px] outline-none" />
        </div>
      )}

      {favorites.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte"><Star size={13} /> Favoris</p>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
            {favorites.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 rounded-mab-pilule border border-mab-filet bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium shadow-mab-carte transition hover:border-mab-filet-aqua">
                <Favicon url={l.url} title={l.title} size={26} />
                {l.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {total === 0 && folders.length === 0 ? (
        <Empty
          icon={<Link2 size={32} />}
          title="Aucun lien pour l’instant"
          text="Crée un dossier (Applications, Landing pages, Outils…) puis ajoute les adresses que l’équipe utilise tous les jours."
          action={<Button variant="secondaire" onClick={() => setFolderDraft({})}><FolderPlus size={16} /> Créer un dossier</Button>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {folders.map((f, i) => {
            const list = byFolder(f.id);
            if (q && !list.length) return null;
            return (
              <FolderCard
                key={f.id}
                folder={f}
                links={list}
                first={i === 0}
                last={i === folders.length - 1}
                onAdd={() => setLinkDraft({ folder_id: f.id })}
                onBulk={() => setBulkFolder(f.id)}
                onEdit={() => setFolderDraft(f)}
                onEditLink={setLinkDraft}
              />
            );
          })}
          {loose.length > 0 && (
            <FolderCard
              folder={null}
              links={loose}
              onAdd={() => setLinkDraft({ folder_id: null })}
              onBulk={() => setBulkFolder(null)}
              onEditLink={setLinkDraft}
            />
          )}
          {q && !favorites.length && folders.every((f) => !byFolder(f.id).length) && !loose.length && (
            <p className="text-sm text-mab-texte">Aucun lien ne correspond à « {q} ».</p>
          )}
        </div>
      )}

      <LinkModal draft={linkDraft} onClose={() => setLinkDraft(null)} onNewFolder={() => { setLinkDraft(null); setFolderDraft({}); }} />
      <FolderModal draft={folderDraft} onClose={() => setFolderDraft(null)} />
      <BulkModal folderId={bulkFolder} onClose={() => setBulkFolder(undefined)} />
    </>
  );
}

function Favicon({ url, title, size = 32 }: { url: string; title: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = faviconOf(url);
  if (failed || !src) {
    return (
      <span className="grid shrink-0 place-items-center rounded-mab-etiquette bg-mab-wash-2 font-semibold text-mab-aqua-texte" style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {title.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="shrink-0 rounded-mab-etiquette border border-mab-filet bg-white object-contain p-1" style={{ width: size, height: size }} />;
}

function FolderCard({ folder, links, first, last, onAdd, onBulk, onEdit, onEditLink }: {
  folder: LinkFolder | null; links: UsefulLink[]; first?: boolean; last?: boolean;
  onAdd: () => void; onBulk: () => void; onEdit?: () => void; onEditLink: (l: UsefulLink) => void;
}) {
  const { me, moveFolder, deleteFolder } = useStore();
  const admin = isAdmin(me);
  const color = folder?.color ?? '#9babab';
  const remove = () => {
    if (!folder) return;
    if (!links.length) { if (confirm(`Supprimer le dossier « ${folder.name} » ?`)) deleteFolder(folder, false); return; }
    const all = confirm(`Le dossier « ${folder.name} » contient ${links.length} lien(s).\n\nOK : supprimer le dossier ET ses liens.\nAnnuler : ne rien supprimer.`);
    if (all) deleteFolder(folder, true);
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-mab-filet px-4 py-3 sm:px-5" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
        <span className="text-2xl leading-none" aria-hidden>{folder?.emoji ?? '🔗'}</span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate font-semibold">{folder?.name ?? 'Sans dossier'}{folder?.admins_only && <Lock size={13} className="text-mab-gris" aria-label="Réservé aux admins" />}</h2>
          <p className="text-xs text-mab-texte">{links.length} lien{links.length > 1 ? 's' : ''}</p>
        </div>
        <Button variant="discret" className="!px-2.5" onClick={onAdd} aria-label="Ajouter un lien dans ce dossier"><Plus size={16} /><span className="max-sm:hidden"> Lien</span></Button>
        {folder && (
          <ActionMenu label="Options du dossier" actions={[
            { label: 'Modifier le dossier', icon: Pencil, onClick: () => onEdit?.() },
            { label: 'Coller plusieurs liens', icon: ClipboardPaste, onClick: onBulk },
            { label: 'Monter', icon: ArrowUp, onClick: () => moveFolder(folder, -1), hidden: first },
            { label: 'Descendre', icon: ArrowDown, onClick: () => moveFolder(folder, 1), hidden: last },
            { label: 'Supprimer le dossier', icon: Trash2, danger: true, onClick: remove, hidden: !(admin || folder.created_by === me!.id) },
          ]} />
        )}
      </div>
      {links.length === 0 ? (
        <button onClick={onAdd} className="w-full px-5 py-6 text-center text-sm text-mab-texte hover:bg-mab-wash">Dossier vide · <span className="font-medium text-mab-aqua-texte">ajouter un lien</span></button>
      ) : (
        <ul>{links.map((l) => <LinkRow key={l.id} link={l} onEdit={() => onEditLink(l)} />)}</ul>
      )}
    </Card>
  );
}

function LinkRow({ link, onEdit }: { link: UsefulLink; onEdit: () => void }) {
  const { me, toggleLinkPin, deleteLink } = useStore();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast('Copie impossible sur ce navigateur.', 'erreur'); }
  };
  const canDelete = isAdmin(me) || link.created_by === me!.id;
  return (
    <li className="group flex items-center gap-3 border-b border-mab-filet px-4 py-2.5 last:border-0 hover:bg-mab-wash sm:px-5">
      <a href={link.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 py-0.5">
        <Favicon url={link.url} title={link.title} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium text-mab-encre">
            <span className="truncate">{link.title}</span>
            {link.pinned && <Star size={12} className="shrink-0 fill-mab-rose text-mab-rose" aria-label="Favori" />}
          </span>
          <span className="block truncate text-xs text-mab-aqua-texte">{domainOf(link.url)}{link.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '')}</span>
          {link.description && <span className="block truncate text-xs text-mab-texte">{link.description}</span>}
        </span>
        <ExternalLink size={15} className="shrink-0 text-mab-gris-doux max-sm:hidden" />
      </a>
      <button onClick={copy} aria-label="Copier le lien" title="Copier le lien" className="grid h-9 w-9 shrink-0 place-items-center rounded-mab-pilule text-mab-texte hover:bg-mab-wash-2 hover:text-mab-aqua-texte">
        {copied ? <Check size={16} className="text-mab-succes" /> : <Copy size={16} />}
      </button>
      <ActionMenu label="Options du lien" actions={[
        { label: 'Modifier / déplacer', icon: Pencil, onClick: onEdit },
        { label: link.pinned ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: Star, onClick: () => toggleLinkPin(link) },
        { label: 'Supprimer', icon: Trash2, danger: true, hidden: !canDelete, onClick: () => confirm(`Supprimer « ${link.title} » ?`) && deleteLink(link) },
      ]} />
    </li>
  );
}

function LinkModal({ draft, onClose, onNewFolder }: { draft: Partial<UsefulLink> | null; onClose: () => void; onNewFolder: () => void }) {
  const { snap, saveLink } = useStore();
  const [l, setL] = useState<Partial<UsefulLink>>({});
  const [titleTouched, setTitleTouched] = useState(false);
  useEffect(() => { if (draft) { setL({ title: '', url: '', description: '', pinned: false, ...draft }); setTitleTouched(!!draft.id); } }, [draft]);
  if (!draft) return null;
  const url = normalizeUrl(l.url ?? '');
  const valid = !!url && !!l.title?.trim();
  const folders = [...snap.link_folders].sort((a, b) => a.position - b.position);
  const submit = () => { if (!valid) return; saveLink({ ...l, url: url!, title: l.title!.trim(), description: (l.description ?? '').trim() } as UsefulLink); onClose(); };
  return (
    <Modal
      open
      onClose={onClose}
      title={draft.id ? 'Modifier le lien' : 'Ajouter un lien'}
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!valid} onClick={submit}>{draft.id ? 'Enregistrer' : 'Ajouter'}</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Adresse" help={l.url && !url ? 'Adresse invalide. Exemple : methode.mabeautyplus.fr' : url && url !== l.url ? `Enregistrée comme ${url}` : 'Colle l’adresse, le « https:// » est ajouté tout seul.'}>
          <Input
            autoFocus={!draft.id}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            value={l.url ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const n = normalizeUrl(v);
              setL((x) => ({ ...x, url: v, title: !titleTouched && n ? suggestTitle(n) : x.title }));
            }}
            placeholder="https://…"
          />
        </Field>
        <Field label="Titre">
          <Input value={l.title ?? ''} onChange={(e) => { setTitleTouched(true); setL({ ...l, title: e.target.value }); }} placeholder="Ex. Appli thérapeute" />
        </Field>
        <Field label="Description (facultatif)">
          <Textarea rows={2} value={l.description ?? ''} onChange={(e) => setL({ ...l, description: e.target.value })} placeholder="À quoi ça sert, qui l’utilise…" />
        </Field>
        <Field label="Dossier">
          <div className="flex gap-2">
            <Select value={l.folder_id ?? ''} onChange={(e) => setL({ ...l, folder_id: e.target.value || null })}>
              <option value="">Sans dossier</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
            </Select>
            <Button variant="discret" onClick={onNewFolder} className="shrink-0"><FolderPlus size={15} /> Nouveau</Button>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-mab-rose" checked={!!l.pinned} onChange={(e) => setL({ ...l, pinned: e.target.checked })} />
          <Star size={14} /> Ajouter aux favoris (affiché tout en haut)
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function FolderModal({ draft, onClose }: { draft: Partial<LinkFolder> | null; onClose: () => void }) {
  const { me, snap, saveFolder } = useStore();
  const [f, setF] = useState<Partial<LinkFolder>>({});
  useEffect(() => {
    if (draft) {
      const used = snap.link_folders.map((x) => x.color);
      setF({ name: '', emoji: '📁', color: PROJECT_COLORS.find((c) => !used.includes(c)) ?? PROJECT_COLORS[0], admins_only: false, ...draft });
    }
  }, [draft, snap.link_folders]);
  if (!draft) return null;
  const submit = () => { if (!f.name?.trim()) return; saveFolder({ ...f, name: f.name.trim() } as LinkFolder); onClose(); };
  return (
    <Modal
      open
      onClose={onClose}
      title={draft.id ? 'Modifier le dossier' : 'Nouveau dossier'}
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!f.name?.trim()} onClick={submit}>{draft.id ? 'Enregistrer' : 'Créer le dossier'}</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Nom du dossier"><Input autoFocus value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Applications, Landing pages, Outils" /></Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Icône</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={f.emoji === e} onClick={() => setF({ ...f, emoji: e })} className={`grid h-10 w-10 place-items-center rounded-mab-champ border text-xl ${f.emoji === e ? 'border-mab-aqua bg-mab-wash-2' : 'border-mab-filet bg-white'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Couleur</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => <button key={c} type="button" aria-label={`Couleur ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} className={`h-8 w-8 rounded-full ${f.color === c ? 'ring-2 ring-mab-encre ring-offset-2' : ''}`} style={{ background: c }} />)}
          </div>
        </div>
        {isAdmin(me) && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={!!f.admins_only} onChange={(e) => setF({ ...f, admins_only: e.target.checked })} />
            <Lock size={14} /> Réservé aux administrateurs
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function BulkModal({ folderId, onClose }: { folderId: string | null | undefined; onClose: () => void }) {
  const { snap, addLinks, saveFolder } = useStore();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>('');
  useEffect(() => { if (folderId !== undefined) { setText(''); setTarget(folderId ?? ''); } }, [folderId]);
  const parsed = useMemo(() => parseBulk(text), [text]);
  if (folderId === undefined) return null;
  const ok = parsed.filter((p) => p.url);
  const folders = [...snap.link_folders].sort((a, b) => a.position - b.position);
  const findFolder = (name: string) => snap.link_folders.find((f) => norm(f.name) === norm(name));
  const named = [...new Set(ok.map((p) => p.folder).filter(Boolean) as string[])];
  const toCreate = named.filter((n) => !findFolder(n));
  const submit = async () => {
    if (!ok.length) return;
    setBusy(true);
    const loose = ok.filter((p) => !p.folder);
    if (loose.length) await addLinks(loose.map((p) => ({ url: p.url!, title: p.title })), target || null);
    for (const name of named) {
      const id = findFolder(name)?.id ?? (await saveFolder({ name }));
      await addLinks(ok.filter((p) => p.folder === name).map((p) => ({ url: p.url!, title: p.title })), id);
    }
    setBusy(false);
    onClose();
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Coller plusieurs liens"
      footer={<><Button variant="tertiaire" onClick={onClose}>Annuler</Button><Button variant="primaire" disabled={!ok.length || busy} onClick={submit}>{busy ? 'Ajout…' : `Ajouter ${ok.length || ''} lien${ok.length > 1 ? 's' : ''}`}</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Une ligne par lien" help="Adresse et titre dans l’ordre que tu veux, séparés par « : » ou « - ». Une ligne « Dossier Nom : » range les liens suivants dans ce dossier (créé s’il n’existe pas).">
          <Textarea
            autoFocus
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Dossier Application :\nhttps://app.mabeautyplus.fr/ : Appli thérapeute\nhttps://crmnews.netlify.app/ : CRM Prospect\n\nDossier LP :\nmethode.mabeautyplus.fr : Méthode MAbeautyplus'}
            className="font-mono !text-sm"
          />
        </Field>
        {toCreate.length > 0 && (
          <p className="rounded-mab-champ bg-mab-wash-2 px-4 py-2.5 text-sm text-mab-aqua-texte">Nouveau{toCreate.length > 1 ? 'x' : ''} dossier{toCreate.length > 1 ? 's' : ''} créé{toCreate.length > 1 ? 's' : ''} : <b>{toCreate.join(', ')}</b></p>
        )}
        <Field label={named.length ? 'Liens sans « Dossier … : » au-dessus' : 'Dans le dossier'}>
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Sans dossier</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
          </Select>
        </Field>
        {parsed.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Aperçu</p>
            {parsed.map((p, i) => p.header ? (
              <p key={i} className="mt-2 text-xs font-semibold uppercase tracking-[.12em] text-mab-aqua-texte">📁 {p.title}{findFolder(p.title) ? ' · existant' : ' · nouveau'}</p>
            ) : (
              <div key={i} className={`flex items-center gap-3 rounded-mab-champ border px-3 py-2 text-sm ${p.url ? 'border-mab-filet' : 'border-mab-filet-rose bg-mab-rose-wash'}`}>
                {p.url ? <Check size={15} className="shrink-0 text-mab-succes" /> : <span className="shrink-0 text-mab-erreur">✕</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.url ? p.title : p.line}</span>
                  <span className="block truncate text-xs text-mab-texte">{p.url ?? 'Aucune adresse reconnue sur cette ligne : elle sera ignorée'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
