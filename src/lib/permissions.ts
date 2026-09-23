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
    reads: s.reads.filter((r) => convIds.has(r.conversation_id)), // « Vu par » : lectures des autres membres
    reactions: s.reactions.filter((r) => s.messages.some((m) => m.id === r.message_id && convIds.has(m.conversation_id))),
    docs: isAdmin(me) ? s.docs : s.docs.filter((d) => !d.admins_only),
    link_folders: isAdmin(me) ? s.link_folders : s.link_folders.filter((f) => !f.admins_only),
    links: isAdmin(me) ? s.links : s.links.filter((l) => !l.folder_id || s.link_folders.some((f) => f.id === l.folder_id && !f.admins_only)),
  };
  if (isAdmin(me)) return { ...s, ...privateParts };
  const visibleTasks = s.tasks.filter((t) => canSeeTask(me, t, s.projects.filter((p) => p.member_ids.includes(me.id))));
  const taskIds = new Set(visibleTasks.map((t) => t.id));
  const projects = s.projects.filter((p) => p.member_ids.includes(me.id));
  const ids = new Set(projects.map((p) => p.id));
  return {
    profiles: s.profiles,
    projects,
    tasks: visibleTasks,
    task_comments: s.task_comments.filter((c) => taskIds.has(c.task_id)),
    templates: s.templates,
    announcements: s.announcements,
    announcement_reads: s.announcement_reads,
    absences: s.absences,
    last_seen: s.last_seen,
    comments: s.comments.filter((c) => ids.has(c.project_id)),
    events: s.events.filter((e) => canSeeEvent(me, e)),
    ...privateParts,
    activity: s.activity.filter((a) => (a.project_id ? ids.has(a.project_id) : a.actor_id === me.id)),
  };
}
