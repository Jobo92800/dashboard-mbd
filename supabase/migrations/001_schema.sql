-- ============================================================================
-- MA HQ · schéma complet (à exécuter une fois dans Supabase > SQL Editor)
-- Toutes les tables ont RLS activé : la base elle-même refuse ce qu'un
-- utilisateur n'a pas le droit de voir ou de modifier, quoi qu'envoie le navigateur.
-- ============================================================================

-- ---------- Profils (un par compte de connexion) ----------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  job_title text not null default '',
  color text not null default '#3bbfbf',
  role text not null default 'membre' check (role in ('admin', 'membre')),
  active boolean not null default true,
  availability text not null default 'disponible' check (availability in ('disponible', 'occupe', 'absent')),
  availability_note text not null default ''
);

-- Crée automatiquement le profil quand un compte est créé (invitation).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, job_title, color, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'job_title', ''),
    coalesce(new.raw_user_meta_data->>'color', '#3bbfbf'),
    -- Le tout premier compte devient administrateur ; les suivants suivent l'invitation.
    case when not exists (select 1 from public.profiles) then 'admin'
         else coalesce(new.raw_user_meta_data->>'role', 'membre') end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Fonctions d'aide aux règles d'accès ------------------------------
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin');
$$;

-- Un membre ne peut changer ni son rôle ni son statut actif ; il faut au moins un admin.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email)
     and not public.is_admin() then
    raise exception 'Seul un administrateur peut changer le rôle ou l''accès.';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and (select count(*) from profiles where role = 'admin' and active) <= 1 then
    raise exception 'Il faut garder au moins un administrateur actif.';
  end if;
  return new;
end $$;

create trigger protect_profile before update on public.profiles
for each row execute function public.protect_profile();

-- ---------- Projets --------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  start_date date,
  end_date date,
  color text not null default '#3bbfbf',
  status text not null default 'en_cours' check (status in ('planifie', 'en_cours', 'termine', 'archive')),
  phases text[] not null default '{}',
  member_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from projects where id = pid and auth.uid() = any(member_ids)
  ) and public.is_active();
$$;

-- ---------- Tâches (project_id vide = tâche rapide) -------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  phase text,
  title text not null,
  note text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  priority text not null default 'Moyenne' check (priority in ('Haute', 'Moyenne', 'Basse')),
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'fait')),
  kind text,
  centre text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index on public.tasks (project_id);
create index on public.tasks (assignee_id);

-- ---------- Commentaires ----------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.comments (project_id);

-- ---------- Événements ------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'Réunion',
  date date not null,
  time text not null default '09:00',
  duration_min int not null default 30,
  participant_ids uuid[] not null default '{}',
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null
);

-- ---------- Notifications et activité ---------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index on public.activity (created_at desc);

-- ============================================================================
-- Règles d'accès (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;
alter table public.activity enable row level security;

-- Profils : toute l'équipe active se voit ; chacun modifie le sien, l'admin tous.
create policy "profils lisibles" on public.profiles for select using (public.is_active());
create policy "profil modifiable" on public.profiles for update
  using (public.is_active() and (id = auth.uid() or public.is_admin()));

-- Projets : admin = tout ; membre = ceux dont il fait partie, en lecture.
create policy "projets lisibles" on public.projects for select
  using (public.is_admin() or (public.is_active() and auth.uid() = any(member_ids)));
create policy "projets créés par admin" on public.projects for insert with check (public.is_admin());
create policy "projets modifiés par admin" on public.projects for update using (public.is_admin());
create policy "projets supprimés par admin" on public.projects for delete using (public.is_admin());

-- Tâches.
create policy "tâches lisibles" on public.tasks for select using (
  public.is_admin() or (public.is_active() and (
    (project_id is not null and public.is_project_member(project_id))
    or (project_id is null and (assignee_id = auth.uid() or created_by = auth.uid()))
  )));
create policy "tâches créées" on public.tasks for insert with check (
  public.is_active() and created_by = auth.uid() and (
    public.is_admin() or (project_id is not null and public.is_project_member(project_id)) or project_id is null
  ));
create policy "tâches modifiées" on public.tasks for update using (
  public.is_admin() or (public.is_active() and (
    (project_id is not null and public.is_project_member(project_id))
    or (project_id is null and (assignee_id = auth.uid() or created_by = auth.uid()))
  )));
create policy "tâches supprimées" on public.tasks for delete using (
  public.is_admin() or (public.is_active() and (
    created_by = auth.uid() or (project_id is null and assignee_id = auth.uid())
  )));

-- Commentaires : membres du projet ; on ne supprime que les siens (admin : tous).
create policy "commentaires lisibles" on public.comments for select using (public.is_project_member(project_id));
create policy "commentaires écrits" on public.comments for insert
  with check (author_id = auth.uid() and public.is_project_member(project_id));
create policy "commentaires supprimés" on public.comments for delete
  using (author_id = auth.uid() or public.is_admin());

-- Événements : participants, organisateur et admin.
create policy "événements lisibles" on public.events for select using (
  public.is_admin() or (public.is_active() and (created_by = auth.uid() or auth.uid() = any(participant_ids))));
create policy "événements créés" on public.events for insert with check (public.is_active() and created_by = auth.uid());
create policy "événements modifiés" on public.events for update using (public.is_admin() or created_by = auth.uid());
create policy "événements supprimés" on public.events for delete using (public.is_admin() or created_by = auth.uid());

-- Notifications : chacun lit et marque les siennes ; tout membre actif peut en envoyer.
create policy "notifications lisibles" on public.notifications for select using (user_id = auth.uid());
create policy "notifications envoyées" on public.notifications for insert with check (public.is_active());
create policy "notifications lues" on public.notifications for update using (user_id = auth.uid());
create policy "notifications supprimées" on public.notifications for delete using (user_id = auth.uid());

-- Activité : admin voit tout ; membre voit celle de ses projets et la sienne.
create policy "activité lisible" on public.activity for select using (
  public.is_admin() or (public.is_active() and (
    (project_id is not null and public.is_project_member(project_id)) or actor_id = auth.uid())));
create policy "activité écrite" on public.activity for insert with check (public.is_active() and actor_id = auth.uid());

-- ============================================================================
-- Temps réel : chaque écran se met à jour quand un collègue modifie quelque chose.
-- ============================================================================
alter publication supabase_realtime add table
  public.profiles, public.projects, public.tasks, public.comments,
  public.events, public.notifications, public.activity;
