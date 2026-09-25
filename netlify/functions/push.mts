// Envoi des notifications sur les téléphones et ordinateurs (Web Push).
//  GET                         → clé publique (pour que l'appli puisse s'abonner)
//  POST {type:'notification'}  → appelé par la base à chaque notification
//  POST {type:'message'}       → appelé par la base à chaque nouveau message
//  POST {type:'test'} + jeton  → « M'envoyer une notification d'essai »
import webpush from 'web-push';
import { adminClient, callerProfile, json } from '../lib/server.mts';

type Payload = { title: string; body: string; url: string; tag: string; count?: number };

function vapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@mabeautyplus.fr', pub, priv);
  return pub;
}

/** Envoie à tous les appareils de ces personnes ; retire les appareils qui n'existent plus. */
async function sendTo(userIds: string[], payload: Omit<Payload, 'count'>) {
  if (!userIds.length) return 0;
  const sb = adminClient();
  const { data: subs } = await sb.from('push_subscriptions').select('*').in('user_id', userIds);
  let sent = 0;
  for (const s of subs ?? []) {
    // Pastille de l'icône : nombre de notifications non lues de la personne.
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', s.user_id).eq('read', false);
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, count: count ?? 0 }),
        { TTL: 60 * 60 * 24, urgency: 'high', topic: payload.tag.slice(0, 32).replace(/[^\w-]/g, '') || undefined },
      );
      sent++;
      await sb.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push', code, (e as Error).message);
    }
  }
  return sent;
}

const firstName = (n?: string | null) => (n ?? '').split(' ')[0] || 'Quelqu’un';

export default async (req: Request) => {
  const pub = vapid();
  if (req.method === 'GET') return pub ? json(200, { publicKey: pub }) : json(503, { error: 'Notifications pas encore configurées sur le serveur.' });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  if (!pub) return json(503, { error: 'Notifications pas encore configurées sur le serveur.' });

  const { type, id } = await req.json().catch(() => ({} as { type?: string; id?: string }));
  const sb = adminClient();

  try {
    if (type === 'test') {
      const me = await callerProfile(req);
      if (!me) return json(401, { error: 'Session expirée, reconnecte-toi.' });
      const n = await sendTo([me.id], { title: 'MA HQ', body: `Bravo ${firstName(me.full_name)}, les notifications fonctionnent sur cet appareil ✨`, url: '/profil', tag: 'test' });
      return json(200, { ok: true, appareils: n });
    }

    if (type === 'notification' && id) {
      // Marquage atomique : une notification n'est envoyée qu'une fois.
      const { data: n } = await sb.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', id).is('pushed_at', null).select('*').maybeSingle();
      if (!n) return json(200, { ok: true, skipped: true });
      await sendTo([n.user_id], { title: 'MA HQ', body: n.text, url: n.link || '/', tag: `notif-${n.id}` });
      return json(200, { ok: true });
    }

    if (type === 'message' && id) {
      const { data: m } = await sb.from('messages').update({ pushed_at: new Date().toISOString() }).eq('id', id).is('pushed_at', null).select('*').maybeSingle();
      if (!m) return json(200, { ok: true, skipped: true });
      const { data: conv } = await sb.from('conversations').select('*').eq('id', m.conversation_id).maybeSingle();
      if (!conv) return json(200, { ok: true });
      const { data: people } = await sb.from('profiles').select('id, full_name, active').in('id', conv.member_ids);
      const author = people?.find((p) => p.id === m.author_id);
      // Sourdine respectée ; les personnes @mentionnées reçoivent déjà la notification de mention.
      const { data: muted } = await sb.from('reads').select('user_id').eq('conversation_id', conv.id).eq('muted', true);
      const mutedIds = new Set((muted ?? []).map((r) => r.user_id));
      const mentioned = new Set((people ?? []).filter((p) => new RegExp(`@${firstName(p.full_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(m.body)).map((p) => p.id));
      const to = (people ?? []).filter((p) => p.active && p.id !== m.author_id && !mutedIds.has(p.id) && !mentioned.has(p.id)).map((p) => p.id);
      const group = !!conv.title || conv.member_ids.length > 2;
      const text = m.body?.trim() || '📎 Pièce jointe';
      await sendTo(to, {
        title: group ? `${conv.title ?? 'Groupe'}` : `💬 ${author?.full_name ?? 'Message'}`,
        body: group ? `${firstName(author?.full_name)} : ${text}` : text,
        url: `/messages/${conv.id}`,
        tag: `conv-${conv.id}`,
      });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Requête inconnue.' });
  } catch (e) {
    console.error(e);
    return json(500, { error: (e as Error).message });
  }
};
