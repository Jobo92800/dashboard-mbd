-- ============================================================================
-- MA HQ · liens utiles : dossiers et liens partagés par l'équipe
-- ============================================================================

create table public.link_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📁',
  color text not null default '#3bbfbf',
  position int not null default 0,
  admins_only boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.link_folders(id) on delete set null,
  title text not null,
  url text not null check (url ~* '^https?://'),
  description text not null default '',
  pinned boolean not null default false,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.links (folder_id, position);

create or replace function public.can_see_folder(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_folders f where f.id = fid and (public.is_admin() or (public.is_active() and not f.admins_only)));
$$;

alter table public.link_folders enable row level security;
alter table public.links enable row level security;

create policy "dossiers lisibles" on public.link_folders for select
  using (public.is_admin() or (public.is_active() and not admins_only));
create policy "dossiers créés" on public.link_folders for insert
  with check (public.is_active() and created_by = auth.uid() and (public.is_admin() or not admins_only));
create policy "dossiers modifiés" on public.link_folders for update
  using (public.is_admin() or (public.is_active() and not admins_only))
  with check (public.is_admin() or not admins_only);
create policy "dossiers supprimés" on public.link_folders for delete
  using (public.is_admin() or created_by = auth.uid());

create policy "liens lisibles" on public.links for select
  using (public.is_active() and (folder_id is null or public.can_see_folder(folder_id)));
create policy "liens ajoutés" on public.links for insert
  with check (public.is_active() and created_by = auth.uid() and (folder_id is null or public.can_see_folder(folder_id)));
create policy "liens modifiés" on public.links for update
  using (public.is_active() and (folder_id is null or public.can_see_folder(folder_id)))
  with check (folder_id is null or public.can_see_folder(folder_id));
-- Supprimer : admin, auteur du lien, ou créateur du dossier qui le contient.
create policy "liens supprimés" on public.links for delete using (
  public.is_admin() or created_by = auth.uid()
  or exists (select 1 from link_folders f where f.id = folder_id and f.created_by = auth.uid()));

alter publication supabase_realtime add table public.link_folders, public.links;

-- ---------- Contenu de départ (fourni par Jonathan le 23/09/2026) ----------
with app as (
  insert into public.link_folders (name, emoji, color, position) values ('Application', '📱', '#3bbfbf', 0) returning id
), lp as (
  insert into public.link_folders (name, emoji, color, position) values ('LP', '🌐', '#e8318a', 1) returning id
)
insert into public.links (folder_id, title, url, position)
select app.id, v.title, v.url, v.pos from app, (values
  ('Appli thérapeute', 'https://app.mabeautyplus.fr/', 0),
  ('CRM Prospect', 'https://crmnews.netlify.app/', 1),
  ('Appli Podcast', 'https://applinutritonjuin2026.netlify.app/', 2)
) as v(title, url, pos)
union all
select lp.id, v.title, v.url, v.pos from lp, (values
  ('Méthode MAbeautyplus', 'https://methode.mabeautyplus.fr', 0),
  ('Bio-Portrait', 'https://bioportraitdecouverte.mabeautyplus.fr', 1)
) as v(title, url, pos);
