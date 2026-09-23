import seed from './seed.json';
import type { Backend, NewMember } from './backend';
import { uid } from './backend';
import { visibleFor } from '../lib/permissions';
import type { Profile, Snapshot, Table } from '../lib/types';

/**
 * Mode démo : toutes les données vivent dans le navigateur (localStorage).
 * Mot de passe de tous les comptes de démonstration : « demo ».
 */
const KEY = 'mahq_demo_v1';
const SESSION = 'mahq_demo_session';
export const DEMO_PASSWORD = 'demo';

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* stockage indisponible : on repart du jeu d'exemple */ }
  return normalize(structuredClone(seed) as unknown as Partial<Snapshot>);
}

/** Complète les démos enregistrées par une version précédente de l'appli. */
function normalize(raw: Partial<Snapshot>): Snapshot {
  const s = {
    conversations: [], messages: [], reads: [], task_comments: [], templates: [],
    reactions: [], announcements: [], announcement_reads: [], docs: [], absences: [], ...raw,
  } as Snapshot;
  s.messages = s.messages.map((m) => ({ ...m, reply_to: m.reply_to ?? null, attachments: m.attachments ?? [], edited_at: m.edited_at ?? null }));
  s.conversations = s.conversations.map((c) => ({ ...c, pinned_ids: c.pinned_ids ?? [] }));
  s.tasks = s.tasks.map((t) => ({ ...t, checklist: t.checklist ?? [], attachments: t.attachments ?? [], recurrence: t.recurrence ?? null }));
  s.profiles = s.profiles.map((p) => ({ ...p, recap_email: p.recap_email ?? true }));
  return s;
}

const MAX_DEMO_FILE = 700 * 1024;

const listeners = new Set<() => void>();
function write(s: Snapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignoré */ }
  listeners.forEach((cb) => cb());
}

const wait = () => new Promise((r) => setTimeout(r, 60));

export const demoBackend: Backend = {
  mode: 'demo',

  async currentUser() {
    const id = localStorage.getItem(SESSION);
    const me = read().profiles.find((p) => p.id === id && p.active);
    return me ?? null;
  },

  async signIn(email, password) {
    await wait();
    const me = read().profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!me || password !== DEMO_PASSWORD) throw new Error('E-mail ou mot de passe incorrect.');
    if (!me.active) throw new Error('Ce compte a été désactivé par un administrateur.');
    localStorage.setItem(SESSION, me.id);
  },

  async signOut() {
    localStorage.removeItem(SESSION);
  },

  async sendPasswordReset() {
    throw new Error('En mode démo, le mot de passe est toujours « demo ».');
  },

  async updatePassword() {
    throw new Error('En mode démo, le mot de passe ne se change pas.');
  },

  async load(me: Profile) {
    await wait();
    return visibleFor(me, read());
  },

  async insert(table, row) {
    const s = read();
    (s[table] as unknown[]).unshift(row);
    write(s);
  },

  async update(table, id, patch) {
    const s = read();
    const list = s[table] as { id: string }[];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    write(s);
  },

  async insertMany(table, rows) {
    const s = read();
    (s[table] as unknown[]).unshift(...rows);
    write(s);
  },

  async uploadFile(file) {
    if (file.size > MAX_DEMO_FILE) throw new Error('En mode démo, les fichiers sont limités à 700 Ko. Une fois la base branchée : jusqu’à 20 Mo.');
    const url = await new Promise<string>((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => ko(new Error('Lecture du fichier impossible.'));
      r.readAsDataURL(file);
    });
    return { path: '', url };
  },

  async fileUrl(_path, fallback) {
    return fallback;
  },

  async upsert(table, row) {
    const s = read();
    const list = s[table] as { id: string }[];
    const i = list.findIndex((r) => r.id === (row as { id: string }).id);
    if (i >= 0) list[i] = row as { id: string }; else list.unshift(row as { id: string });
    write(s);
  },

  async remove(table: Table, id: string) {
    const s = read();
    (s[table] as { id: string }[]) = (s[table] as { id: string }[]).filter((r) => r.id !== id);
    if (table === 'projects') {
      s.tasks = s.tasks.filter((t) => t.project_id !== id);
      s.comments = s.comments.filter((c) => c.project_id !== id);
    }
    if (table === 'tasks') s.task_comments = s.task_comments.filter((c) => c.task_id !== id);
    if (table === 'messages') s.reactions = s.reactions.filter((r) => r.message_id !== id);
    if (table === 'announcements') s.announcement_reads = s.announcement_reads.filter((r) => r.announcement_id !== id);
    if (table === 'conversations') {
      s.messages = s.messages.filter((m) => m.conversation_id !== id);
      s.reads = s.reads.filter((r) => r.conversation_id !== id);
    }
    write(s);
  },

  async accessToken() {
    return '';
  },

  async inviteMember(m: NewMember) {
    const s = read();
    if (s.profiles.some((p) => p.email.toLowerCase() === m.email.toLowerCase())) {
      throw new Error('Une personne utilise déjà cet e-mail.');
    }
    s.profiles.push({
      id: uid(), ...m, email: m.email.trim().toLowerCase(), active: true,
      availability: 'disponible', availability_note: '', recap_email: true,
    });
    write(s);
    return { tempPassword: DEMO_PASSWORD };
  },

  subscribe(cb) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
  },

  onAuth() {
    return () => {};
  },
};

export function resetDemo() {
  localStorage.removeItem(KEY);
  listeners.forEach((cb) => cb());
}
