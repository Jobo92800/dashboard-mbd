import type { Conversation, Profile } from './types';

/** Nom affiché : le nom du groupe, sinon les prénoms des autres participants. */
export function conversationName(c: Conversation, meId: string, byId: Map<string, Profile>) {
  if (c.title) return c.title;
  const others = c.member_ids.filter((id) => id !== meId).map((id) => byId.get(id));
  if (others.length === 1) return others[0]?.full_name ?? 'Conversation';
  if (others.length === 0) return 'Moi uniquement';
  return others.map((p) => p?.full_name.split(' ')[0] ?? '?').join(', ');
}

/** Un groupe = conversation nommée ou à plus de deux. */
export const isGroup = (c: Conversation) => !!c.title || c.member_ids.length > 2;

/** Peut gérer le groupe : admin du groupe, ou administrateur de MA HQ. */
export function canManage(c: Conversation, me: Profile | null) {
  return !!me && (c.admin_ids.includes(me.id) || (me.role === 'admin' && me.active));
}
