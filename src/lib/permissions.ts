import type { CalEvent, Profile, Project, Snapshot, Task } from './types';

/**
 * Règles d'accès. Elles sont appliquées deux fois : ici pour l'affichage, et
 * dans la base (RLS Supabase, voir supabase/migrations) pour la sécurité réelle.
 *
 * Admin : voit tout, gère projets, équipe et paramètres.
 * Membre : voit les projets dont il fait partie, y fait avancer les tâches,
 * commente ; gère ses tâches rapides et ses événements.
 */
export const isAdmin = (me: Profile | null) => !!me && me.role === 'admin' && me.active;

export const isProjectMember = (me: Profile, p: Project) => isAdmin(me) || p.member_ids.includes(me.id);

export function canSeeTask(me: Profile, t: Task, projects: Project[]) {
  if (isAdmin(me)) return true;
  if (t.project_id) {
    const p = projects.find((x) => x.id === t.project_id);
    return !!p && p.member_ids.includes(me.id);
  }
  return t.assignee_id === me.id || t.created_by === me.id;
}

export function canSeeEvent(me: Profile, e: CalEvent) {
  return isAdmin(me) || e.created_by === me.id || e.participant_ids.includes(me.id);
}

export const canEditTask = canSeeTask;
export const canDeleteTask = (me: Profile, t: Task, projects: Project[]) =>
  isAdmin(me) || t.created_by === me.id || (!t.project_id && canSeeTask(me, t, projects));
export const canEditEvent = (me: Profile, e: CalEvent) => isAdmin(me) || e.created_by === me.id;

/** Ce qu'un utilisateur a le droit de lire (mode démo ; en mode réel la base filtre déjà). */
export function visibleFor(me: Profile, s: Snapshot): Snapshot {
  const convs = s.conversations.filter((c) => c.member_ids.includes(me.id));
  const convIds = new Set(convs.map((c) => c.id));
  const privateParts = {
    notifications: s.notifications.filter((n) => n.user_id === me.id),
    conversations: convs,
    messages: s.messages.filter((m) => convIds.has(m.conversation_id)),
    reads: s.reads.filter((r) => r.user_id === me.id),
  };
  if (isAdmin(me)) return { ...s, ...privateParts };
  const projects = s.projects.filter((p) => p.member_ids.includes(me.id));
  const ids = new Set(projects.map((p) => p.id));
  return {
    profiles: s.profiles,
    projects,
    tasks: s.tasks.filter((t) => canSeeTask(me, t, projects)),
    comments: s.comments.filter((c) => ids.has(c.project_id)),
    events: s.events.filter((e) => canSeeEvent(me, e)),
    ...privateParts,
    activity: s.activity.filter((a) => (a.project_id ? ids.has(a.project_id) : a.actor_id === me.id)),
  };
}
