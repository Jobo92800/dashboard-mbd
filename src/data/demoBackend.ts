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
    // Les démos créées avant la messagerie n'ont pas ces tables : on les complète.
    if (raw) return { conversations: [], messages: [], reads: [], ...JSON.parse(raw) } as Snapshot;
  } catch { /* stockage indisponible : on repart du jeu d'exemple */ }
  return structuredClone(seed) as Snapshot;
}

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
    if (table === 'conversations') {
      s.messages = s.messages.filter((m) => m.conversation_id !== id);
      s.reads = s.reads.filter((r) => r.conversation_id !== id);
    }
    write(s);
  },

  async inviteMember(m: NewMember) {
    const s = read();
    if (s.profiles.some((p) => p.email.toLowerCase() === m.email.toLowerCase())) {
      throw new Error('Une personne utilise déjà cet e-mail.');
    }
    s.profiles.push({
      id: uid(), ...m, email: m.email.trim().toLowerCase(), active: true,
      availability: 'disponible', availability_note: '',
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
