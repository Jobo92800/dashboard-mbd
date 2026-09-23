import type { Profile, Role, Snapshot, Table } from '../lib/types';

export interface NewMember {
  email: string;
  full_name: string;
  job_title: string;
  role: Role;
  color: string;
}

/** Contrat commun au mode démo (navigateur) et au mode réel (Supabase). */
export interface Backend {
  mode: 'demo' | 'supabase';
  currentUser(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  load(me: Profile): Promise<Snapshot>;
  insert<T extends Table>(table: T, row: Snapshot[T][number]): Promise<void>;
  update<T extends Table>(table: T, id: string, patch: Partial<Snapshot[T][number]>): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  /** Crée ou remplace la ligne portant cet id. */
  upsert<T extends Table>(table: T, row: Snapshot[T][number]): Promise<void>;
  inviteMember(m: NewMember): Promise<{ tempPassword?: string }>;
  /** Prévient quand les données changent ailleurs (autre onglet, collègue). */
  subscribe(cb: () => void): () => void;
  /** Prévient quand la session change (connexion, lien de mot de passe…). */
  onAuth(cb: (event: string) => void): () => void;
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
