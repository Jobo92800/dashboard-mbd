// Invitation d'un membre : seul un administrateur connecté peut l'appeler.
// La clé « service_role » ne quitte jamais le serveur (variable Netlify).
import { createClient } from '@supabase/supabase-js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json(500, { error: 'Serveur non configuré (SUPABASE_SERVICE_ROLE_KEY manquante sur Netlify).' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Qui appelle ? Il doit être administrateur actif.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json(401, { error: 'Session expirée, reconnecte-toi.' });
  const { data: profile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
  if (!profile?.active || profile.role !== 'admin') return json(403, { error: 'Réservé aux administrateurs.' });

  // 2. Données de l'invitation.
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const full_name = String(body.full_name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || !full_name) return json(400, { error: 'Nom et e-mail valides requis.' });
  const role = body.role === 'admin' ? 'admin' : 'membre';

  // 3. Envoi : Supabase crée le compte (le profil suit par déclencheur) et envoie l'e-mail.
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, job_title: String(body.job_title || ''), color: String(body.color || '#3bbfbf'), role },
    redirectTo: typeof body.redirectTo === 'string' ? body.redirectTo : undefined,
  });
  if (error) {
    const msg = /already been registered|already exists/i.test(error.message) ? 'Une personne utilise déjà cet e-mail.' : error.message;
    return json(400, { error: msg });
  }
  return json(200, { ok: true });
};
