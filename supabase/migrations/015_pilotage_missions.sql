-- Pilotage des missions (projet Franchise) :
--   · une mission dépend d'autres missions, a un ordre de lancement et un livrable versionné,
--     validé explicitement (qui, quand) ; la « progression officielle » ne compte que les validées ;
--   · points d'avancement par mission (remplace les reports vers T0.A) ;
--   · journal des décisions du projet (remplace T0.B) : demandes, décisions, faits, hypothèses…

alter table public.tasks
  add column if not exists depends_on uuid[] not null default '{}',
  add column if not exists launch_order text check (launch_order in ('maintenant', 'ensuite', 'plus_tard')),
  add column if not exists deliverable text not null default '',
  add column if not exists deliverable_version text not null default '',
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists validated_at timestamptz;

alter table public.projects
  add column if not exists validation_mode boolean not null default false,
  add column if not exists coordinator_id uuid references public.profiles(id) on delete set null,
  add column if not exists decider_id uuid references public.profiles(id) on delete set null;

-- ---------- Points d'avancement ---------------------------------------------
create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'en_cours' check (state in ('a_lancer', 'en_cours', 'bloquee', 'en_validation', 'terminee')),
  version text not null default '',
  done_text text not null default '',
  blockers text not null default '',
  arbitrages text not null default '',
  next_action text not null default '',
  created_at timestamptz not null default now()
);
create index on public.task_updates (task_id);
alter table public.task_updates enable row level security;
create policy "points lisibles" on public.task_updates for select using (public.can_see_task(task_id));
create policy "points écrits" on public.task_updates for insert with check (author_id = auth.uid() and public.can_see_task(task_id));
create policy "points supprimés" on public.task_updates for delete using (author_id = auth.uid() or public.is_admin());

-- ---------- Journal des décisions -------------------------------------------
create table public.decisions_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  kind text not null default 'a_decider' check (kind in ('a_decider', 'decision', 'proposition', 'hypothese', 'a_confirmer', 'fait', 'rejete')),
  title text not null,
  context text not null default '',
  options text not null default '',
  decision text not null default '',
  consequences text not null default '',
  changes_roadmap boolean not null default false,
  author_id uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.decisions_log (project_id);
alter table public.decisions_log enable row level security;
create policy "décisions lisibles" on public.decisions_log for select using (public.is_project_member(project_id));
create policy "décisions écrites" on public.decisions_log for insert with check (author_id = auth.uid() and public.is_project_member(project_id));
create policy "décisions mises à jour" on public.decisions_log for update using (public.is_project_member(project_id));
create policy "décisions supprimées" on public.decisions_log for delete using (author_id = auth.uid() or public.is_admin());

alter publication supabase_realtime add table public.task_updates, public.decisions_log;
