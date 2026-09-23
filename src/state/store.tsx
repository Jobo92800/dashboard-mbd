import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend } from '../data';
import { uid } from '../data/backend';
import type { NewMember } from '../data/backend';
import type { Attachment, CalEvent, ChecklistItem, Conversation, Message, Profile, Project, ProjectTemplate, Snapshot, Task, TaskStatus } from '../lib/types';
import { nextOccurrence, shiftIso } from '../lib/recurrence';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useToast } from './toast';
import { nextColor as nextColorFor } from '../lib/palette';

const EMPTY: Snapshot = {
  profiles: [], projects: [], tasks: [], comments: [], events: [], notifications: [], activity: [],
  conversations: [], messages: [], reads: [], task_comments: [], templates: [],
};
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

  /** Tâche récurrente terminée : on prépare la suivante (sauf si elle existe déjà). */
  const spawnNext = async (t: Task) => {
    if (!t.recurrence) return;
    const due = nextOccurrence(t.due_date, t.recurrence);
    const exists = snap.tasks.some((x) => x.id !== t.id && x.title === t.title && x.recurrence === t.recurrence && x.due_date === due && x.status !== 'fait');
    if (exists) return;
    const next: Task = {
      ...t, id: uid(), due_date: due, status: 'a_faire', done_at: null, created_at: now(), created_by: me!.id,
      checklist: t.checklist.map((c) => ({ ...c, done: false })),
    };
    await backend.insert('tasks', next);
  };

  const mentionedIn = (body: string) =>
    snap.profiles.filter((p) => new RegExp(`@${escapeRe(p.full_name.split(' ')[0])}\\b`, 'i').test(body)).map((p) => p.id);

  /** Crée un projet et ses tâches à partir d'un modèle, calé sur une date de référence. */
  const instantiate = async (tpl: ProjectTemplate, name: string, refDate: string, memberIds: string[], keepAssignees: boolean) => {
    const project: Project = {
      id: uid(), name, description: tpl.description, color: nextColorFor(snap.projects.map((p) => p.color)),
      start_date: shiftIso(refDate, tpl.start_offset), end_date: shiftIso(refDate, tpl.end_offset),
      status: 'en_cours', phases: [...tpl.phases], member_ids: memberIds, created_by: me!.id, created_at: now(),
    };
    const tasks: Task[] = tpl.tasks.map((tt) => ({
      id: uid(), project_id: project.id, phase: tt.phase, title: tt.title, note: tt.note,
      assignee_id: keepAssignees && tt.assignee_id && memberIds.includes(tt.assignee_id) ? tt.assignee_id : null,
      due_date: tt.offset_days === null ? null : shiftIso(refDate, tt.offset_days),
      priority: tt.priority, status: 'a_faire', kind: null, centre: null, created_by: me!.id, created_at: now(), done_at: null,
      checklist: tt.checklist.map((text) => ({ id: uid(), text, done: false })), attachments: [], recurrence: null,
    }));
    await run(
      (st) => ({ ...st, projects: [project, ...st.projects], tasks: [...tasks, ...st.tasks] }),
      async () => {
        await backend.insert('projects', project);
        await backend.insertMany('tasks', tasks);
        await log(`a créé le projet « ${name} » (${tasks.length} tâches)`, project.id);
        await notify(memberIds, `${firstName(me!.id)} t’a ajouté(e) au projet « ${name} »`, `/projets/${project.id}`);
      },
      `Projet créé avec ${tasks.length} tâches`,
    );
    return project.id;
  };

  /** Transforme un projet existant en modèle (échéances en jours par rapport à la référence). */
  const templateFrom = (p: Project, refDate: string, name: string, label: string, keepAssignees: boolean): ProjectTemplate => {
    const off = (iso: string | null) => (iso ? differenceInCalendarDays(parseISO(iso), parseISO(refDate)) : null);
    return {
      id: uid(), name, description: p.description, reference_label: label,
      start_offset: off(p.start_date) ?? 0, end_offset: off(p.end_date) ?? 0,
      phases: [...p.phases], member_ids: [...p.member_ids],
      tasks: snap.tasks.filter((t) => t.project_id === p.id).map((t) => ({
        title: t.title, phase: t.phase, offset_days: off(t.due_date), priority: t.priority,
        assignee_id: keepAssignees ? t.assignee_id : null, note: t.note, checklist: t.checklist.map((c) => c.text),
      })),
      created_by: me!.id, created_at: now(),
    };
  };

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
            if (patch.status === 'fait' && existing.status !== 'fait') await spawnNext({ ...existing, ...patch } as Task);
            if (reassigned) await notify([t.assignee_id!], `${firstName(me!.id)} t’a confié : « ${t.title} »${where}`, project ? `/projets/${project.id}` : '/ma-journee');
          },
          'Tâche mise à jour',
        );
      }
      const row: Task = {
        id: uid(), project_id: null, phase: null, note: '', assignee_id: me!.id, due_date: null,
        priority: 'Moyenne', status: 'a_faire', kind: null, centre: null,
        created_by: me!.id, created_at: now(), done_at: null, checklist: [], attachments: [], recurrence: null, ...t,
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
          if (status === 'fait') await spawnNext(t);
          if (status === 'fait' && t.project_id) {
            await log(`a terminé « ${t.title} »`, t.project_id);
            if (t.created_by && t.created_by !== t.assignee_id)
              await notify([t.created_by], `${firstName(me!.id)} a terminé « ${t.title} »`, `/projets/${t.project_id}`);
          }
        },
      );
    },

    /** Modification légère (sous-tâches, pièces jointes) sans message de confirmation. */
    patchTask(t: Task, patch: Partial<Task>) {
      return run(
        (s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }),
        () => backend.update('tasks', t.id, patch),
      );
    },

    setChecklist(t: Task, checklist: ChecklistItem[]) {
      return actions.patchTask(t, { checklist });
    },

    async addAttachment(t: Task, input: { file?: File; name?: string; url?: string }) {
      let att: Attachment;
      if (input.file) {
        const { path, url } = await backend.uploadFile(input.file, t.id);
        att = { id: uid(), name: input.file.name, url, path: path || undefined, kind: 'fichier', size: input.file.size };
      } else {
        let url = (input.url ?? '').trim();
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        att = { id: uid(), name: (input.name ?? '').trim() || url.replace(/^https?:\/\//, '').slice(0, 60), url, kind: 'lien' };
      }
      const current = snap.tasks.find((x) => x.id === t.id) ?? t;
      await actions.patchTask(current, { attachments: [...current.attachments, att] });
    },

    removeAttachment(t: Task, id: string) {
      return actions.patchTask(t, { attachments: t.attachments.filter((a) => a.id !== id) });
    },

    openAttachment: (a: Attachment) => (a.path ? backend.fileUrl(a.path, a.url) : Promise.resolve(a.url)),

    addTaskComment(t: Task, body: string) {
      const row = { id: uid(), task_id: t.id, author_id: me!.id, body, created_at: now() };
      const link = t.project_id ? `/projets/${t.project_id}?tache=${t.id}` : `/taches?tache=${t.id}`;
      const mentioned = mentionedIn(body);
      return run(
        (s) => ({ ...s, task_comments: [...s.task_comments, row] }),
        async () => {
          await backend.insert('task_comments', row);
          await notify(mentioned, `${firstName(me!.id)} t’a mentionné(e) sur « ${t.title} »`, link);
          const others = [t.assignee_id ?? '', t.created_by ?? ''].filter((id) => id && !mentioned.includes(id));
          await notify(others, `${firstName(me!.id)} a commenté « ${t.title} »`, link);
        },
      );
    },

    deleteTaskComment(id: string) {
      return run((s) => ({ ...s, task_comments: s.task_comments.filter((c) => c.id !== id) }), () => backend.remove('task_comments', id));
    },

    saveTemplateFromProject(p: Project, opts: { name: string; refDate: string; label: string; keepAssignees: boolean }) {
      const tpl = templateFrom(p, opts.refDate, opts.name, opts.label, opts.keepAssignees);
      return run((s) => ({ ...s, templates: [tpl, ...s.templates] }), () => backend.insert('templates', tpl), 'Modèle enregistré');
    },

    deleteTemplate(id: string) {
      return run((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }), () => backend.remove('templates', id), 'Modèle supprimé');
    },

    createFromTemplate(tpl: ProjectTemplate, opts: { name: string; refDate: string; memberIds: string[]; keepAssignees: boolean }) {
      return instantiate(tpl, opts.name, opts.refDate, opts.memberIds, opts.keepAssignees);
    },

    /** Copie d'un projet décalée à une nouvelle date de début. */
    duplicateProject(p: Project, opts: { name: string; startDate: string; keepAssignees: boolean }) {
      const ref = p.start_date || now().slice(0, 10);
      const tpl = templateFrom(p, ref, opts.name, 'Début', true);
      return instantiate(tpl, opts.name, opts.startDate, [...p.member_ids], opts.keepAssignees);
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
      const mentioned = mentionedIn(body);
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

    /**
     * Ouvre (ou retrouve) une conversation avec ces personnes. À deux et sans
     * nom de groupe, on réutilise la discussion existante plutôt que d'en créer une autre.
     */
    async startConversation(otherIds: string[], title: string, firstMessage: string) {
      const members = [...new Set([me!.id, ...otherIds])];
      const cleanTitle = title.trim() || null;
      const existing = !cleanTitle && members.length === 2
        ? snap.conversations.find((c) => !c.title && c.member_ids.length === 2 && members.every((m) => c.member_ids.includes(m)))
        : undefined;
      const conv: Conversation = existing ?? {
        id: uid(), title: cleanTitle, member_ids: members, created_by: me!.id, created_at: now(), last_message_at: now(),
      };
      if (!existing) {
        await run((st) => ({ ...st, conversations: [conv, ...st.conversations] }), () => backend.insert('conversations', conv));
      }
      if (firstMessage.trim()) await actions.sendMessage(conv, firstMessage);
      return conv.id;
    },

    sendMessage(conv: Conversation, body: string) {
      const at = now();
      const msg: Message = { id: uid(), conversation_id: conv.id, author_id: me!.id, body: body.trim(), created_at: at };
      const mark = { id: `${conv.id}:${me!.id}`, conversation_id: conv.id, user_id: me!.id, read_at: at };
      return run(
        (st) => ({
          ...st,
          messages: [...st.messages, msg],
          conversations: st.conversations.map((c) => (c.id === conv.id ? { ...c, last_message_at: at } : c)),
          reads: [...st.reads.filter((r) => r.id !== mark.id), mark],
        }),
        async () => {
          await backend.insert('messages', msg);
          await backend.update('conversations', conv.id, { last_message_at: at });
          await backend.upsert('reads', mark);
        },
      );
    },

    markConversationRead(convId: string) {
      const mark = { id: `${convId}:${me!.id}`, conversation_id: convId, user_id: me!.id, read_at: now() };
      return run((st) => ({ ...st, reads: [...st.reads.filter((r) => r.id !== mark.id), mark] }), () => backend.upsert('reads', mark));
    },

    updateConversation(conv: Conversation, patch: Partial<Conversation>, okText?: string) {
      return run(
        (st) => ({ ...st, conversations: st.conversations.map((c) => (c.id === conv.id ? { ...c, ...patch } : c)) }),
        () => backend.update('conversations', conv.id, patch),
        okText,
      );
    },

    leaveConversation(conv: Conversation) {
      const rest = conv.member_ids.filter((id) => id !== me!.id);
      return run(
        (st) => ({ ...st, conversations: st.conversations.filter((c) => c.id !== conv.id), messages: st.messages.filter((m) => m.conversation_id !== conv.id) }),
        () => (rest.length ? backend.update('conversations', conv.id, { member_ids: rest }) : backend.remove('conversations', conv.id)),
        'Conversation quittée',
      );
    },

    deleteMessage(id: string) {
      return run((st) => ({ ...st, messages: st.messages.filter((m) => m.id !== id) }), () => backend.remove('messages', id));
    },

    markRead(id: string) {
      return run(
        (s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
        () => backend.update('notifications', id, { read: true }),
      );
    },
  };

  const byId = useMemo(() => new Map(snap.profiles.map((p) => [p.id, p])), [snap.profiles]);

  /** Messages non lus par conversation (ceux des autres, postérieurs à ma dernière lecture). */
  const unreadByConv = useMemo(() => {
    const out = new Map<string, number>();
    if (!me) return out;
    const readAt = new Map(snap.reads.filter((r) => r.user_id === me.id).map((r) => [r.conversation_id, r.read_at]));
    for (const m of snap.messages) {
      if (m.author_id === me.id) continue;
      if (m.created_at > (readAt.get(m.conversation_id) ?? '')) out.set(m.conversation_id, (out.get(m.conversation_id) ?? 0) + 1);
    }
    return out;
  }, [snap.messages, snap.reads, me]);
  const unreadMessages = [...unreadByConv.values()].reduce((a, b) => a + b, 0);

  return { me, booting, loaded, snap, byId, unreadByConv, unreadMessages, recovery, setRecovery, mode: backend.mode, reload, ...actions };
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
