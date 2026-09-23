import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bold, BookOpen, Eye, FilePlus2, Heading2, Link2, List, ListChecks, Lock, Pencil, Pin, Search, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Doc } from '../lib/types';
import { DOC_CATEGORIES } from '../lib/types';
import { fmtStamp } from '../lib/dates';
import { isAdmin } from '../lib/permissions';
import { Markdown } from '../lib/markdown';
import { AttachmentList } from '../components/TaskExtras';
import { Badge, Button, Card, Empty, Field, IconButton, Input, Select } from '../components/ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Docs() {
  const { id } = useParams();
  const { snap } = useStore();
  const nav = useNavigate();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const current = snap.docs.find((d) => d.id === id);
  const isNew = id === 'nouveau';

  const list = useMemo(
    () => snap.docs
      .filter((d) => (!cat || d.category === cat) && (!q || norm(`${d.title} ${d.content} ${d.attachments.map((a) => a.name).join(' ')}`).includes(norm(q))))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.updated_at < b.updated_at ? 1 : -1)),
    [snap.docs, cat, q],
  );
  const counts = (c: string) => snap.docs.filter((d) => d.category === c).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={`${id ? 'hidden lg:block' : ''}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-[28px] font-light leading-tight">Procédures & <b className="font-semibold">documents</b></h1>
        </div>
        <Button variant="secondaire" className="mb-4 w-full" onClick={() => nav('/documents/nouveau')}><FilePlus2 size={16} /> Nouveau document</Button>
        <div className="mb-3 flex h-10 items-center gap-2 rounded-mab-pilule border border-mab-filet bg-white px-4">
          <Search size={15} className="text-mab-gris" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans les documents" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => setCat('')} className={`rounded-mab-pilule px-3 py-1 text-xs font-medium ${!cat ? 'bg-mab-aqua-encre text-white' : 'bg-white text-mab-texte border border-mab-filet'}`}>Tout · {snap.docs.length}</button>
          {DOC_CATEGORIES.filter((c) => counts(c)).map((c) => (
            <button key={c} onClick={() => setCat(c === cat ? '' : c)} className={`rounded-mab-pilule px-3 py-1 text-xs font-medium ${cat === c ? 'bg-mab-aqua-encre text-white' : 'bg-white text-mab-texte border border-mab-filet'}`}>{c} · {counts(c)}</button>
          ))}
        </div>
        <Card className="overflow-hidden">
          {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-mab-texte">Aucun document.</p>}
          {list.map((d) => (
            <Link key={d.id} to={`/documents/${d.id}`} className={`flex items-start gap-3 border-b border-mab-filet px-4 py-3 last:border-0 ${d.id === id ? 'bg-mab-wash-2' : 'hover:bg-mab-wash'}`}>
              <BookOpen size={17} className="mt-0.5 shrink-0 text-mab-aqua-texte" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-mab-encre">
                  <span className="truncate">{d.title}</span>
                  {d.pinned && <Pin size={12} className="shrink-0 text-mab-rose" />}
                  {d.admins_only && <Lock size={12} className="shrink-0 text-mab-gris" />}
                </span>
                <span className="block truncate text-xs text-mab-texte">{d.category} · mis à jour {fmtStamp(d.updated_at)}</span>
              </span>
            </Link>
          ))}
        </Card>
      </aside>

      <section className={`min-w-0 ${id ? '' : 'hidden lg:block'}`}>
        {isNew ? <DocEditor key="nouveau" onDone={(newId) => nav(`/documents/${newId}`, { replace: true })} onCancel={() => nav('/documents')} />
          : current ? <DocView key={current.id} doc={current} />
          : id ? <Empty title="Document introuvable" text="Il a été supprimé, ou il est réservé aux administrateurs." action={<Link to="/documents" className="text-mab-aqua-texte underline">Retour</Link>} />
          : (
            <Empty
              icon={<BookOpen size={32} />}
              title="La mémoire de l’équipe"
              text="Protocoles, scripts commerciaux, runbooks, accès utiles : tout ce qu’on se repasse en PDF, rangé et à jour."
              action={<Button variant="secondaire" onClick={() => nav('/documents/nouveau')}>Créer un document</Button>}
            />
          )}
      </section>
    </div>
  );
}

function DocView({ doc }: { doc: Doc }) {
  const { me, byId, deleteDoc, addDocAttachment, removeDocAttachment, saveDoc } = useStore();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const admin = isAdmin(me);
  const canEdit = admin || !doc.admins_only;
  const canDelete = admin || doc.author_id === me!.id;
  if (editing) return <DocEditor doc={doc} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  return (
    <Card className="p-6 sm:p-8">
      <button onClick={() => nav('/documents')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-mab-aqua-texte hover:underline lg:hidden"><ArrowLeft size={16} /> Documents</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="mesure">{doc.category}</Badge>
          {doc.admins_only && <Badge><Lock size={11} /> Admins</Badge>}
          {doc.pinned && <Badge tone="emotion"><Pin size={11} /> Épinglé</Badge>}
        </div>
        <div className="flex gap-1">
          {admin && <IconButton label={doc.pinned ? 'Désépingler' : 'Épingler en haut de la liste'} onClick={() => saveDoc({ id: doc.id, title: doc.title, pinned: !doc.pinned })}><Pin size={16} /></IconButton>}
          {canEdit && <Button onClick={() => setEditing(true)}><Pencil size={15} /> Modifier</Button>}
          {canDelete && <IconButton label="Supprimer" onClick={() => { if (confirm(`Supprimer « ${doc.title} » ?`)) { deleteDoc(doc.id); nav('/documents'); } }}><Trash2 size={16} /></IconButton>}
        </div>
      </div>
      <h1 className="mt-3 text-[30px] font-light leading-tight tracking-tight text-mab-encre">{doc.title}</h1>
      <p className="mt-1 text-xs text-mab-gris-doux">Mis à jour par {byId.get(doc.updated_by ?? '')?.full_name ?? '—'} le {fmtStamp(doc.updated_at)}</p>
      <div className="mt-6">{doc.content.trim() ? <Markdown text={doc.content} /> : <p className="text-mab-gris-doux">Document vide.</p>}</div>
      <div className="mt-8 border-t border-mab-filet pt-5">
        <p className="mb-2.5 text-sm font-semibold">Fichiers et liens</p>
        <AttachmentList items={doc.attachments} disabled={!canEdit} onAdd={(input) => addDocAttachment(doc, input)} onRemove={(aid) => removeDocAttachment(doc, aid)} />
      </div>
    </Card>
  );
}

const TOOLS = [
  { icon: Heading2, label: 'Titre', before: '## ', after: '', line: true },
  { icon: Bold, label: 'Gras', before: '**', after: '**' },
  { icon: List, label: 'Liste', before: '- ', after: '', line: true },
  { icon: ListChecks, label: 'Case à cocher', before: '- [ ] ', after: '', line: true },
  { icon: Link2, label: 'Lien', before: '[', after: '](https://)' },
];

function DocEditor({ doc, onDone, onCancel }: { doc?: Doc; onDone: (id: string) => void; onCancel: () => void }) {
  const { me, saveDoc } = useStore();
  const [d, setD] = useState<Partial<Doc>>(doc ?? { title: '', category: 'Protocoles', content: '', admins_only: false });
  const [preview, setPreview] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (doc) setD(doc); }, [doc]);
  const admin = isAdmin(me);

  const wrap = (t: (typeof TOOLS)[number]) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const next = t.line
      ? value.slice(0, lineStart) + t.before + value.slice(lineStart)
      : value.slice(0, s) + t.before + value.slice(s, e) + t.after + value.slice(e);
    setD((x) => ({ ...x, content: next }));
    requestAnimationFrame(() => { el.focus(); const pos = t.line ? s + t.before.length : e + t.before.length; el.setSelectionRange(pos, pos); });
  };

  const save = async () => {
    if (!d.title?.trim()) return;
    const id = await saveDoc({ ...d, title: d.title.trim() } as Doc);
    onDone(id);
  };

  return (
    <Card className="grid gap-4 p-6">
      <Input autoFocus value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre du document" aria-label="Titre" className="!h-12 !text-xl !font-medium" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie">
          <Select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
            {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        {admin && (
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-mab-aqua" checked={!!d.admins_only} onChange={(e) => setD({ ...d, admins_only: e.target.checked })} />
            <Lock size={14} /> Réservé aux administrateurs
          </label>
        )}
      </div>
      {d.category === 'Outils & accès' && (
        <p className="rounded-mab-champ bg-mab-rose-wash px-4 py-3 text-sm text-mab-rose-texte">
          N’écris jamais de mot de passe ici. Note l’adresse de l’outil, à quoi il sert et <b>qui contacter</b> pour obtenir un accès.
        </p>
      )}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {!preview && TOOLS.map((t) => (
            <IconButton key={t.label} label={t.label} onClick={() => wrap(t)}><t.icon size={16} /></IconButton>
          ))}
          <Button variant="discret" className="ml-auto" onClick={() => setPreview((p) => !p)}>{preview ? <><Pencil size={14} /> Écrire</> : <><Eye size={14} /> Aperçu</>}</Button>
        </div>
        {preview ? (
          <div className="min-h-[320px] rounded-mab-champ border border-mab-filet p-5"><Markdown text={d.content ?? ''} /></div>
        ) : (
          <textarea
            ref={ta}
            value={d.content ?? ''}
            onChange={(e) => setD({ ...d, content: e.target.value })}
            rows={16}
            placeholder={'# Étapes\n1. Première étape\n2. Deuxième étape\n\n## Points de vigilance\n- …'}
            className="w-full rounded-mab-champ border border-mab-filet bg-white px-4 py-3 font-mono text-sm leading-relaxed focus:border-mab-aqua focus:outline-none focus:ring-2 focus:ring-mab-aqua/30"
          />
        )}
        <p className="mt-1 text-xs text-mab-gris-doux"># titre · ## sous-titre · - liste · 1. étapes · - [ ] case · **gras** · [texte](lien) · &gt; encadré</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="tertiaire" onClick={onCancel}>Annuler</Button>
        <Button variant="primaire" disabled={!d.title?.trim()} onClick={save}>Enregistrer</Button>
      </div>
      {!doc && <p className="text-xs text-mab-gris-doux">Les fichiers (PDF, images…) s’ajoutent une fois le document enregistré.</p>}
    </Card>
  );
}
