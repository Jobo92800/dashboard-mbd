import { useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import type { Project } from '../lib/types';
import { useStore } from '../state/store';
import { fmtStamp } from '../lib/dates';
import { isAdmin } from '../lib/permissions';
import { Avatar, Button, IconButton } from './ui';

export function Comments({ project }: { project: Project }) {
  const { snap, byId, me, addComment, deleteComment } = useStore();
  const [text, setText] = useState('');
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const list = snap.comments.filter((c) => c.project_id === project.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const people = snap.profiles.filter((p) => p.active && (project.member_ids.includes(p.id) || p.role === 'admin'));
  const suggestions = mention ? people.filter((p) => p.full_name.toLowerCase().startsWith(mention.q.toLowerCase())).slice(0, 6) : [];

  const onChange = (v: string, caret: number) => {
    setText(v);
    const m = /@([\p{L}-]*)$/u.exec(v.slice(0, caret));
    setMention(m ? { q: m[1], start: caret - m[0].length } : null);
    setActive(0);
  };
  const insert = (name: string) => {
    if (!mention) return;
    const first = name.split(' ')[0];
    const caret = ref.current?.selectionStart ?? text.length;
    const v = text.slice(0, mention.start) + '@' + first + ' ' + text.slice(caret);
    setText(v); setMention(null);
    requestAnimationFrame(() => { ref.current?.focus(); const pos = mention.start + first.length + 2; ref.current?.setSelectionRange(pos, pos); });
  };
  const send = () => {
    if (!text.trim()) return;
    addComment(project, text.trim());
    setText('');
  };

  const render = (body: string) =>
    body.split(/(@[\p{L}-]+)/u).map((part, i) =>
      part.startsWith('@') && people.some((p) => p.full_name.split(' ')[0].toLowerCase() === part.slice(1).toLowerCase())
        ? <b key={i} className="font-semibold text-mab-aqua-texte">{part}</b>
        : <span key={i}>{part}</span>,
    );

  return (
    <div>
      <div className="grid gap-4">
        {list.length === 0 && <p className="text-sm text-mab-texte">Pas encore d’échange. Utilise @prénom pour prévenir quelqu’un.</p>}
        {list.map((c) => {
          const author = byId.get(c.author_id);
          return (
            <div key={c.id} className="group flex gap-3">
              <Avatar p={author} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><b>{author?.full_name ?? '—'}</b> <span className="text-xs text-mab-gris-doux">{fmtStamp(c.created_at)}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-mab-encre">{render(c.body)}</p>
              </div>
              {(c.author_id === me!.id || isAdmin(me)) && (
                <IconButton label="Supprimer le message" className="opacity-0 group-hover:opacity-100" onClick={() => confirm('Supprimer ce message ?') && deleteComment(c.id)}>
                  <Trash2 size={14} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative mt-5">
        <textarea
          ref={ref}
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(suggestions[active].full_name); return; }
              if (e.key === 'Escape') { setMention(null); return; }
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="Écrire un message… @prénom pour mentionner"
          className="w-full rounded-mab-champ border border-mab-filet bg-white px-4 py-3 text-[15px] focus:border-mab-aqua focus:outline-none focus:ring-2 focus:ring-mab-aqua/30"
        />
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-60 rounded-mab-champ border border-mab-filet bg-white p-1 shadow-mab-flottante">
            {suggestions.map((p, i) => (
              <button key={p.id} onMouseDown={(e) => { e.preventDefault(); insert(p.full_name); }} className={`flex w-full items-center gap-2 rounded-mab-etiquette px-2 py-1.5 text-left text-sm ${i === active ? 'bg-mab-wash-2' : ''}`}>
                <Avatar p={p} size={22} /> {p.full_name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-mab-gris-doux">⌘ + Entrée pour envoyer</span>
          <Button variant="secondaire" className="!h-9" disabled={!text.trim()} onClick={send}><Send size={15} /> Envoyer</Button>
        </div>
      </div>
    </div>
  );
}
