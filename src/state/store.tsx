import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend } from '../data';
import { uid } from '../data/backend';
import type { NewMember } from '../data/backend';
import type { CalEvent, Profile, Project, Snapshot, Task, TaskStatus } from '../lib/types';
import { useToast } from './toast';

const EMPTY: Snapshot = { profiles: [], projects: [], tasks: [], comments: [], events: [], notifications: [], activity: [] };
const now = () => new Date().toISOString();

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

function useStoreValue() {
  const toast = useToast();
  const [me, setMe] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const meRef = useRef(me);
  meRef.current = me;

  const reload = useCallback(async () => {
    const current = meRef.current;
    if (!current) return;
    try {
      const fresh = await backend.currentUser();
      if (!fresh) { setMe(null); setSnap(EMPTY); return; }
      setMe(fresh);
      setSnap(await backend.load(fresh));
      setLoaded(true);
    } catch (e) {
      toast((e as Error).message, 'erreur');
    }
  }, [toast]);

  useEffect(() => {
    backend.currentUser().then((u) => { setMe(u); setBooting(false); }).catch(() => setBooting(false));
    return backend.onAuth((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setMe(null); setSnap(EMPTY); setLoaded(false); }
    });
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    reload();
    return backend.subscribe(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  /** Applique tout de suite à l'écran, enregistre, puis resynchronise. */
  const run = useCallback(
    async (optimistic: (s: Snapshot) => Snapshot, work: () => Promise<unknown>, okText?: string) => {
      setSnap((s) => optimistic(structuredClone(s)));
      try {
        await work();
        if (okText) toast(okText);
      } catch (e) {
        toast((e as Error).message, 'erreur');
      }
      reload();
    },
    [reload, toast],
  );

  const firstName = (id: string | null) => snap.profiles.find((p) => p.id === id)?.full_name.split(' ')[0] ?? 'Quelqu’un';

  const log = (text: string, project_id: string | null) =>
    backend.insert('activity', { id: uid(), actor_id: me!.id, project_id, text, created_at: now() });

  const notify = (userIds: string[], text: string, link: string | null) =>
    Promise.all(
      [...new Set(userIds)]
        .filter((id) => id && id !== me!.id)
        .map((user_id) => backend.insert('notifications', { id: uid(), user_id, text, link, read: false, created_at: now() })),
    );

  const actions = {
    async signIn(email: string, password: string) {
      await backend.signIn(email, password);
      setMe(await backend.currentUser());
    },
    async signOut() {
      await backend.signOut();
      setMe(null); setSnap(EMPTY); setLoaded(false);
    },

    saveProject(p: Partial<Project> & { name: string }) {
      const existing = p.id ? snap.projects.find((x) => x.id === p.id) : undefined;
      if (existing) {
        const patch = { ...p };
        const added = (p.member_ids ?? []).filter((id) => !existing.member_ids.includes(id));
        return run(
          (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }),
          async () => {
            await backend.update('projects', existing.id, patch);
            await notify(added, `${firstName(me!.id)} t’a ajouté(e) au projet « ${p.name} »`, `/projets/${existing.id}`);
          },
          'Projet mis à jour',
        );
      }
      const row: Project = {
        id: uid(), description: '', start_date: '', end_date: '', color: '#3bbfbf', status: 'en_cours',
        phases: ['Cadrage', 'Production', 'Validation', 'Déploiement'], member_ids: [],
        created_by: me!.id, created_at: now(), ...p,
      } as Project;
      return run(
        (s) => ({ ...s, projects: [row, ...s.projects] }),
        async () => {
          await backend.insert('projects', row);
          await log(`a créé le projet « ${row.name} »`, row.id);
          await notify(row.member_ids, `${firstName(me!.id)} t’a ajouté(e) au projet « ${row.name} »`, `/projets/${row.id}`);
        },
        'Projet créé',
      ).then(() => row.id);
    },

    deleteProject(p: Project) {
      return run(
        (s) => ({ ...s, projects: s.projects.filter((x) => x.id !== p.id), tasks: s.tasks.filter((t) => t.project_id !== p.id) }),
        async () => { await backend.remove('projects', p.id); await log(`a supprimé le projet « ${p.name} »`, null); },
        'Projet supprimé',
      );
    },

    saveTask(t: Partial<Task> & { title: string }) {
      const existing = t.id ? snap.tasks.find((x) => x.id === t.id) : undefined;
      const project = snap.projects.find((p) => p.id === (t.project_id ?? existing?.project_id));
      const where = project ? ` (${project.name})` : '';
      if (existing) {
        const patch = { ...t };
        const reassigned = t.assignee_id && t.assignee_id !== existing.assignee_id;
        return run(
          (s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }),
          async () => {
            await backend.update('tasks', existing.id, patch);
            if (reassigned) await notify([t.assignee_id!], `${firstName(me!.id)} t’a confié : « ${t.title} »${where}`, project ? `/projets/${project.id}` : '/ma-journee');
          },
          'Tâche mise à jour',
        );
      }
      const row: Task = {
        id: uid(), project_id: null, phase: null, note: '', assignee_id: me!.id, due_date: null,
        priority: 'Moyenne', status: 'a_faire', kind: null, centre: null,
        created_by: me!.id, created_at: now(), done_at: null, ...t,
      } as Task;
      return run(
        (s) => ({ ...s, tasks: [row, ...s.tasks] }),
        async () => {
          await backend.insert('tasks', row);
          if (project) await log(`a ajouté la tâche « ${row.title} »`, project.id);
          await notify([row.assignee_id ?? ''], `${firstName(me!.id)} t’a confié : « ${row.title} »${where}`, project ? `/projets/${project.id}` : '/ma-journee');
        },
        'Tâche ajoutée',
      );
    },

    setTaskStatus(t: Task, status: TaskStatus) {
      const patch = { status, done_at: status === 'fait' ? now() : null };
      return run(
        (s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }),
        async () => {
          await backend.update('tasks', t.id, patch);
          if (status === 'fait' && t.project_id) {
            await log(`a terminé « ${t.title} »`, t.project_id);
            if (t.created_by && t.created_by !== t.assignee_id)
              await notify([t.created_by], `${firstName(me!.id)} a terminé « ${t.title} »`, `/projets/${t.project_id}`);
          }
        },
      );
    },

    deleteTask(t: Task) {
      return run(
        (s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== t.id) }),
        () => backend.remove('tasks', t.id),
        'Tâche supprimée',
      );
    },

    addComment(project: Project, body: string) {
      const row = { id: uid(), project_id: project.id, author_id: me!.id, body, created_at: now() };
      const mentioned = snap.profiles
        .filter((p) => new RegExp(`@${escapeRe(p.full_name.split(' ')[0])}\\b`, 'i').test(body))
        .map((p) => p.id);
      return run(
        (s) => ({ ...s, comments: [...s.comments, row] }),
        async () => {
          await backend.insert('comments', row);
          await notify(mentioned, `${firstName(me!.id)} t’a mentionné(e) dans « ${project.name} »`, `/projets/${project.id}`);
        },
      );
    },

    deleteComment(id: string) {
      return run((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== id) }), () => backend.remove('comments', id));
    },

    saveEvent(e: Partial<CalEvent> & { title: string }) {
      const existing = e.id ? snap.events.find((x) => x.id === e.id) : undefined;
      if (existing) {
        return run(
          (s) => ({ ...s, events: s.events.map((x) => (x.id === e.id ? { ...x, ...e } : x)) }),
          () => backend.update('events', existing.id, e),
          'Événement mis à jour',
        );
      }
      const row: CalEvent = {
        id: uid(), kind: 'Réunion', date: '', time: '09:00', duration_min: 30, participant_ids: [], note: '',
        created_by: me!.id, ...e,
      } as CalEvent;
      return run(
        (s) => ({ ...s, events: [row, ...s.events] }),
        async () => {
          await backend.insert('events', row);
          await notify(row.participant_ids, `${firstName(me!.id)} t’invite : ${row.title} (${row.date.split('-').reverse().slice(0, 2).join('/')} à ${row.time})`, '/agenda');
        },
        'Événement enregistré',
      );
    },

    deleteEvent(e: CalEvent) {
      return run((s) => ({ ...s, events: s.events.filter((x) => x.id !== e.id) }), () => backend.remove('events', e.id), 'Événement supprimé');
    },

    updateProfile(id: string, patch: Partial<Profile>, okText?: string) {
      return run(
        (s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
        async () => {
          await backend.update('profiles', id, patch);
          if (id === me!.id) setMe({ ...me!, ...patch });
        },
        okText,
      );
    },

    async inviteMember(m: NewMember) {
      const r = await backend.inviteMember(m);
      await reload();
      return r;
    },

    markAllRead() {
      const unread = snap.notifications.filter((n) => !n.read);
      return run(
        (s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }),
        () => Promise.all(unread.map((n) => backend.update('notifications', n.id, { read: true }))),
      );
    },

    markRead(id: string) {
      return run(
        (s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
        () => backend.update('notifications', id, { read: true }),
      );
    },
  };

  const byId = useMemo(() => new Map(snap.profiles.map((p) => [p.id, p])), [snap.profiles]);

  return { me, booting, loaded, snap, byId, recovery, setRecovery, mode: backend.mode, reload, ...actions };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider manquant');
  return v;
}
