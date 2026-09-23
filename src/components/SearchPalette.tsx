import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FolderKanban, Link2, ListChecks, Megaphone, MessagesSquare, Search, UserRound } from 'lucide-react';
import { useStore } from '../state/store';
import { relativeLabel } from '../lib/dates';
import { conversationName } from '../lib/conversations';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snap, me, byId } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    const out: { key: string; icon: typeof Search; title: string; sub: string; to: string }[] = [];
    snap.projects.filter((p) => norm(p.name + ' ' + p.description).includes(n)).slice(0, 5)
      .forEach((p) => out.push({ key: p.id, icon: FolderKanban, title: p.name, sub: 'Projet', to: `/projets/${p.id}` }));
    snap.tasks.filter((t) => norm(t.title + ' ' + t.note).includes(n)).slice(0, 8).forEach((t) => {
      const p = snap.projects.find((x) => x.id === t.project_id);
      out.push({ key: t.id, icon: ListChecks, title: t.title, sub: `${p ? p.name : 'Tâche rapide'} · ${relativeLabel(t.due_date)}`, to: p ? `/projets/${p.id}?tache=${t.id}` : `/taches?tache=${t.id}` });
    });
    snap.links.filter((l) => norm(`${l.title} ${l.url} ${l.description}`).includes(n)).slice(0, 5)
      .forEach((l) => out.push({ key: l.id, icon: Link2, title: l.title, sub: `Lien · ${l.url.replace(/^https?:\/\//, '')}`, to: '/liens' }));
    snap.docs.filter((d) => norm(`${d.title} ${d.content}`).includes(n)).slice(0, 5)
      .forEach((d) => out.push({ key: d.id, icon: BookOpen, title: d.title, sub: `Document · ${d.category}`, to: `/documents/${d.id}` }));
    snap.announcements.filter((a) => norm(`${a.title} ${a.body}`).includes(n)).slice(0, 3)
      .forEach((a) => out.push({ key: a.id, icon: Megaphone, title: a.title, sub: 'Annonce', to: '/annonces' }));
    snap.messages.filter((m) => norm(m.body).includes(n)).slice(-5).reverse().forEach((m) => {
      const c = snap.conversations.find((x) => x.id === m.conversation_id);
      if (c) out.push({ key: m.id, icon: MessagesSquare, title: m.body, sub: `Message · ${conversationName(c, me!.id, byId)}`, to: `/messages/${c.id}` });
    });
    snap.profiles.filter((p) => norm(p.full_name + ' ' + p.job_title).includes(n)).slice(0, 4)
      .forEach((p) => out.push({ key: p.id, icon: UserRound, title: p.full_name, sub: p.job_title, to: `/equipe?personne=${p.id}` }));
    return out;
  }, [q, snap, me, byId]);

  if (!open) return null;
  const go = (to: string) => { onClose(); nav(to); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-mab-encre/40 px-3 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-mab-carte bg-white shadow-mab-flottante" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-mab-filet px-4">
          <Search size={18} className="text-mab-gris" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && results[active]) go(results[active].to);
            }}
            placeholder="Rechercher…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-mab-gris-doux"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {q && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-mab-texte">Aucun résultat pour « {q} ».</p>}
          {!q && <p className="px-3 py-6 text-center text-sm text-mab-texte">Tape le nom d’un projet, d’une tâche ou d’une personne.</p>}
          {results.map((r, i) => (
            <button
              key={r.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.to)}
              className={`flex w-full items-center gap-3 rounded-mab-champ px-3 py-2.5 text-left ${i === active ? 'bg-mab-wash-2' : ''}`}
            >
              <r.icon size={17} className="shrink-0 text-mab-aqua-texte" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-mab-encre">{r.title}</span>
                <span className="block truncate text-xs text-mab-texte">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
