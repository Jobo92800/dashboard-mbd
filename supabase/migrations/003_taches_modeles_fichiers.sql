-- ============================================================================
-- MA HQ · sous-tâches, pièces jointes, récurrence, commentaires de tâche,
-- modèles de projets, préférence e-mail (à exécuter après 002_messagerie.sql)
-- ============================================================================

alter table public.tasks
  add column checklist jsonb not null default '[]'::jsonb,
  add column attachments jsonb not null default '[]'::jsonb,
  add column recurrence text check (recurrence in ('quotidienne', 'jours_ouvres', 'hebdomadaire', 'bimensuelle', 'mensuelle'));

alter table public.profiles add column recap_email boolean not null default true;

-- Peut-on voir cette tâche ? (mêmes règles que la table tasks)
create or replace function public.can_see_task(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks t where t.id = tid and (
      public.is_admin() or (public.is_active() and (
        (t.project_id is not null and public.is_project_member(t.project_id))
        or (t.project_id is null and (t.assignee_id = auth.uid() or t.created_by = auth.uid()))
      ))
    )
  );
$$;

-- ---------- Commentaires sur une tâche --------------------------------------
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.task_comments (task_id);
alter table public.task_comments enable row level security;
create policy "commentaires tâche lisibles" on public.task_comments for select using (public.can_see_task(task_id));
create policy "commentaires tâche écrits" on public.task_comments for insert with check (author_id = auth.uid() and public.can_see_task(task_id));
create policy "commentaires tâche supprimés" on public.task_comments for delete using (author_id = auth.uid() or public.is_admin());

-- ---------- Modèles de projets ----------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  reference_label text not null default 'Date clé',
  start_offset int not null default 0,
  end_offset int not null default 0,
  phases text[] not null default '{}',
  member_ids uuid[] not null default '{}',
  tasks jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.templates enable row level security;
create policy "modèles lisibles" on public.templates for select using (public.is_active());
create policy "modèles gérés par admin" on public.templates for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Fichiers joints (stockage privé, liens temporaires) --------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('pieces-jointes', 'pieces-jointes', false, 20971520)
on conflict (id) do nothing;

-- Les fichiers sont rangés par tâche : « <id de la tâche>/<fichier> ».
create policy "pièces jointes lisibles" on storage.objects for select
  using (bucket_id = 'pieces-jointes' and public.can_see_task(((storage.foldername(name))[1])::uuid));
create policy "pièces jointes déposées" on storage.objects for insert
  with check (bucket_id = 'pieces-jointes' and public.can_see_task(((storage.foldername(name))[1])::uuid));
create policy "pièces jointes supprimées" on storage.objects for delete
  using (bucket_id = 'pieces-jointes' and public.can_see_task(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table public.task_comments, public.templates;
