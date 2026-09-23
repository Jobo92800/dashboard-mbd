// Outils communs aux fonctions serveur : accès complet à la base, envoi d'e-mails Brevo.
import { createClient } from '@supabase/supabase-js';
import type { Profile, Snapshot } from '../../src/lib/types';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_URL manquante sur Netlify.');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Adresse publique du site (fournie automatiquement par Netlify). */
export const appUrl = () => (process.env.APP_URL || process.env.URL || 'http://localhost:5190').replace(/\/$/, '');

const TABLES = ['profiles', 'projects', 'tasks', 'events', 'conversations', 'messages', 'reads'] as const;

/** Toutes les données utiles aux récaps (clé serveur : pas de filtre RLS). */
export async function loadAll(): Promise<Snapshot> {
  const sb = adminClient();
  const out: Record<string, unknown[]> = { comments: [], notifications: [], activity: [], task_comments: [], templates: [] };
  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select('*');
    if (error) throw new Error(`${t} : ${error.message}`);
    out[t] = data ?? [];
  }
  return out as unknown as Snapshot;
}

/** Vérifie le jeton de la personne connectée et renvoie son profil actif. */
export async function callerProfile(req: Request): Promise<Profile | null> {
  const sb = adminClient();
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return p?.active ? (p as Profile) : null;
}

export async function sendEmail(to: Profile, mail: { subject: string; html: string; text: string }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY manquante sur Netlify.');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'MA HQ · MAbeautyplus', email: process.env.MAIL_FROM || 'contact@mabeautyplus.fr' },
      to: [{ email: to.email, name: to.full_name }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      tags: ['ma-hq'],
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status} : ${await res.text()}`);
}
