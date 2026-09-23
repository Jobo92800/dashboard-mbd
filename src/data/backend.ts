import type { Bucket, Profile, Role, Snapshot, Table } from '../lib/types';

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
  insertMany<T extends Table>(table: T, rows: Snapshot[T][number][]): Promise<void>;
  /** Dépose un fichier joint et renvoie son emplacement. */
  uploadFile(file: File, folder: string, bucket?: Bucket): Promise<{ path: string; url: string }>;
  /** Adresse temporaire pour ouvrir un fichier joint. */
  fileUrl(path: string, fallback: string, bucket?: Bucket): Promise<string>;
  /** Dépose une photo (profil : dossier = id de la personne ; groupe : « groupes/<id> »). */
  uploadAvatar(image: Blob, folder: string): Promise<string>;
  /** Crée ou remplace la ligne portant cet id. */
  upsert<T extends Table>(table: T, row: Snapshot[T][number]): Promise<void>;
  /** Jeton de session, pour appeler les fonctions serveur. */
  accessToken(): Promise<string>;
  inviteMember(m: NewMember): Promise<{ tempPassword?: string }>;
  /** Prévient quand les données changent ailleurs (autre onglet, collègue). */
  subscribe(cb: () => void): () => void;
  /** Qui a l'appli ouverte en ce moment (présence en direct). */
  presence(me: Profile, onChange: (online: Set<string>) => void): () => void;
  /** Prévient quand la session change (connexion, lien de mot de passe…). */
  onAuth(cb: (event: string) => void): () => void;
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
