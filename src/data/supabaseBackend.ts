import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend } from './backend';
import type { Profile, Snapshot, Table } from '../lib/types';

/** Postgres refuse une date vide : '' devient null. */
function clean<T extends object>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (k.endsWith('_date') && out[k] === '') out[k] = null;
  return out as unknown as T;
}

const TABLES: Table[] = [
  'profiles', 'projects', 'tasks', 'comments', 'events', 'notifications', 'activity',
  'conversations', 'messages', 'reads', 'task_comments', 'templates',
  'reactions', 'announcements', 'announcement_reads', 'docs', 'absences',
];

export function makeSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey);

  const check = (error: { message: string } | null) => {
    if (error) throw new Error(translate(error.message));
  };

  return {
    mode: 'supabase',

    async currentUser() {
      const { data } = await sb.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return null;
      const { data: p } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!p || !p.active) return null;
      return p as Profile;
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      check(error);
      const { data } = await sb.auth.getUser();
      const { data: p } = await sb.from('profiles').select('active').eq('id', data.user!.id).maybeSingle();
      if (!p?.active) {
        await sb.auth.signOut();
        throw new Error('Ce compte a été désactivé par un administrateur.');
      }
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/mot-de-passe`,
      });
      check(error);
    },

    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      check(error);
    },

    async load(_me: Profile) {
      const results = await Promise.all(
        TABLES.map((t) => {
          let q = sb.from(t).select('*');
          if (t === 'activity' || t === 'notifications') q = q.order('created_at', { ascending: false }).limit(200);
          if (t === 'messages') q = q.order('created_at', { ascending: false }).limit(3000);
          return q;
        }),
      );
      const snap = {} as Snapshot;
      results.forEach((r, i) => {
        check(r.error);
        (snap as unknown as Record<string, unknown[]>)[TABLES[i]] = r.data ?? [];
      });
      return snap;
    },

    async insert(table, row) {
      check((await sb.from(table).insert(clean(row))).error);
    },

    async update(table, id, patch) {
      check((await sb.from(table).update(clean(patch as Record<string, unknown>)).eq('id', id)).error);
    },

    async insertMany(table, rows) {
      if (rows.length) check((await sb.from(table).insert(rows.map(clean))).error);
    },

    async uploadFile(file, folder, bucket = 'pieces-jointes') {
      const max = bucket === 'documents' ? 50 : 20;
      if (file.size > max * 1024 * 1024) throw new Error(`Fichier trop lourd (${max} Mo maximum).`);
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      const path = `${folder}/${Date.now()}-${safe}`;
      check((await sb.storage.from(bucket).upload(path, file, { contentType: file.type })).error);
      return { path, url: '' };
    },

    async uploadAvatar(image, folder) {
      // Nouveau nom à chaque fois : l'ancienne photo ne reste pas en cache chez les autres.
      const path = `${folder}/${Date.now()}.jpg`;
      check((await sb.storage.from('avatars').upload(path, image, { contentType: 'image/jpeg', upsert: true })).error);
      return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    },

    async fileUrl(path, _fallback, bucket = 'pieces-jointes') {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
      check(error);
      return data!.signedUrl;
    },

    async upsert(table, row) {
      check((await sb.from(table).upsert(clean(row))).error);
    },

    async remove(table, id) {
      check((await sb.from(table).delete().eq('id', id)).error);
    },

    async accessToken() {
      const { data } = await sb.auth.getSession();
      return data.session?.access_token ?? '';
    },

    async inviteMember(m) {
      const { data } = await sb.auth.getSession();
      const res = await fetch('/.netlify/functions/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ ...m, redirectTo: `${window.location.origin}/mot-de-passe` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "L'invitation n'a pas pu partir.");
      return {};
    },

    subscribe(cb) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ch = sb.channel('mahq-changes');
      TABLES.forEach((t) =>
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          clearTimeout(timer);
          timer = setTimeout(cb, 300);
        }),
      );
      ch.subscribe();
      return () => { clearTimeout(timer); sb.removeChannel(ch); };
    },

    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => cb(event));
      return () => data.subscription.unsubscribe();
    },
  };
}

function translate(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return "Ce compte n'a pas encore été activé : ouvre le lien reçu par e-mail.";
  if (/row-level security/i.test(msg)) return "Tu n'as pas les droits pour faire cette action.";
  if (/Password should be/i.test(msg)) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (/Failed to fetch/i.test(msg)) return 'Connexion impossible. Vérifie ta connexion internet.';
  return msg;
}
