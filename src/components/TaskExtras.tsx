import { useRef, useState } from 'react';
import { ExternalLink, FileText, GripVertical, Link2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type { Attachment, ChecklistItem, Task } from '../lib/types';
import { uid } from '../data/backend';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { Button, IconButton, Input } from './ui';

/** Liste de sous-tâches : cocher, ajouter, renommer, réordonner, supprimer. */
export function ChecklistEditor({ items, onChange, disabled }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const done = items.filter((i) => i.done).length;
  const add = () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    onChange([...items, ...lines.map((l) => ({ id: uid(), text: l, done: false }))]);
    setText('');
  };
  const move = (from: number, to: number) => {
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-mab-pilule bg-mab-rail">
            <div className="absolute inset-0 bg-mab-degrade-marque transition-[clip-path] duration-200" style={{ clipPath: `inset(0 ${100 - (done / items.length) * 100}% 0 0)` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-mab-texte">{done} / {items.length}</span>
        </div>
      )}
      <div className="grid">
        {items.map((it, i) => (
          <div
            key={it.id}
            draggable={!disabled}
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => { e.preventDefault(); if (drag !== null && drag !== i) { move(drag, i); setDrag(i); } }}
            onDragEnd={() => setDrag(null)}
            className={`group flex items-center gap-2 rounded-mab-etiquette px-1 py-1 ${drag === i ? 'bg-mab-wash-2' : 'hover:bg-mab-wash'}`}
          >
            {!disabled && <GripVertical size={14} className="shrink-0 cursor-grab text-mab-gris-doux opacity-0 group-hover:opacity-100" />}
            <input
              type="checkbox"
              checked={it.done}
              disabled={disabled}
              onChange={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
              className="h-4 w-4 shrink-0 accent-mab-aqua"
              aria-label={it.text}
            />
            <input
              defaultValue={it.text}
              disabled={disabled}
              onBlur={(e) => e.target.value.trim() && e.target.value !== it.text && onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value.trim() } : x)))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none ${it.done ? 'text-mab-gris-doux line-through' : 'text-mab-encre'}`}
            />
            {!disabled && (
              <IconButton label="Supprimer la sous-tâche" className="!h-7 !w-7 opacity-0 group-hover:opacity-100" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                <X size={14} />
              </IconButton>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (t.includes('\n')) { e.preventDefault(); setText(t); }
            }}
            placeholder="Ajouter une sous-tâche (Entrée)"
            className="!h-10 !text-sm"
          />
          <Button variant="discret" className="!h-10" onClick={add} disabled={!text.trim()}><Plus size={15} /> Ajouter</Button>
        </div>
      )}
    </div>
  );
}

const fmtSize = (n?: number) => (!n ? '' : n < 1024 * 1024 ? `${Math.round(n / 1024)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);

/** Liens et fichiers joints à une tâche (enregistrés immédiatement). */
export function Attachments({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { addAttachment, removeAttachment } = useStore();
  return (
    <AttachmentList
      items={task.attachments}
      disabled={disabled}
      onAdd={(input) => addAttachment(task, input)}
      onRemove={(id) => removeAttachment(task, id)}
    />
  );
}

export function useOpenAttachment() {
  const { openAttachment } = useStore();
  const toast = useToast();
  return async (a: Attachment) => {
    try {
      const href = await openAttachment(a);
      if (href.startsWith('data:')) {
        const w = window.open();
        if (w) w.document.write(`<title>${a.name.replace(/</g, '')}</title><iframe src="${href}" style="border:0;width:100%;height:100%"></iframe>`);
      } else window.open(href, '_blank', 'noopener');
    } catch (e) { toast((e as Error).message, 'erreur'); }
  };
}

/** Liste de liens et fichiers joints (tâches, documents). */
export function AttachmentList({ items, onAdd, onRemove, disabled }: {
  items: Attachment[];
  onAdd: (input: { file?: File; name?: string; url?: string }) => Promise<void>;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const open = useOpenAttachment();
  const toast = useToast();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await onAdd({ file: f });
      toast(files.length > 1 ? `${files.length} fichiers ajoutés` : 'Fichier ajouté');
    } catch (e) { toast((e as Error).message, 'erreur'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const addLink = async () => {
    if (!url.trim()) return;
    await onAdd({ url, name });
    setUrl(''); setName(''); setLinkOpen(false);
  };

  return (
    <div
      onDragOver={(e) => { if (!disabled && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) upload(e.dataTransfer.files); }}
      className={`rounded-mab-champ transition ${over ? 'bg-mab-wash-2 ring-2 ring-mab-aqua' : ''}`}
    >
      <div className="grid gap-1.5">
        {items.map((a) => (
          <div key={a.id} className="group flex items-center gap-3 rounded-mab-champ border border-mab-filet bg-white px-3 py-2">
            {a.kind === 'lien' ? <Link2 size={16} className="shrink-0 text-mab-aqua-texte" /> : <FileText size={16} className="shrink-0 text-mab-violet-texte" />}
            <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-mab-encre hover:underline">{a.name}</button>
            <span className="text-xs text-mab-gris-doux">{fmtSize(a.size)}</span>
            <ExternalLink size={14} className="text-mab-gris-doux" />
            {!disabled && (
              <IconButton label="Retirer" className="!h-7 !w-7 opacity-0 group-hover:opacity-100" onClick={() => confirm(`Retirer « ${a.name} » ?`) && onRemove(a.id)}>
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-mab-gris-doux">Aucune pièce jointe.{!disabled && ' Glisse un fichier ici.'}</p>}
      </div>
      {!disabled && (
        <>
          {linkOpen ? (
            <div className="mt-2 grid gap-2 rounded-mab-champ border border-mab-filet bg-mab-wash p-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Adresse (Canva, Drive…)" className="!h-10 !text-sm" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom affiché (facultatif)" className="!h-10 !text-sm" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <div className="flex gap-1">
                <Button variant="secondaire" className="!h-10" onClick={addLink} disabled={!url.trim()}>Ajouter</Button>
                <IconButton label="Annuler" onClick={() => setLinkOpen(false)}><X size={16} /></IconButton>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              <Button variant="discret" onClick={() => setLinkOpen(true)}><Link2 size={15} /> Ajouter un lien</Button>
              <Button variant="discret" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <><Upload size={15} className="animate-pulse" /> Envoi…</> : <><Paperclip size={15} /> Joindre un fichier</>}
              </Button>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
