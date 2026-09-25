-- ============================================================================
-- MA HQ · comptes rendus de réunion, lien visio, agenda synchronisé,
-- objectifs du tableau de bord
-- ============================================================================

-- ---------- Rendez-vous : visio et compte rendu ----------
alter table public.events
  add column visio_url text,
  add column minutes text not null default '',
  add column decisions jsonb not null default '[]'::jsonb,
  add column minutes_by uuid references public.profiles(id) on delete set null,
  add column minutes_updated_at timestamptz;

-- Les participants peuvent rédiger le compte rendu (mais pas déplacer ni
-- renommer le rendez-vous : réservé à l'organisateur et aux admins).
drop policy "événements modifiés" on public.events;
create policy "événements modifiés" on public.events for update using (
  public.is_admin() or created_by = auth.uid() or (public.is_active() and auth.uid() = any(participant_ids)));

create or replace function public.protect_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or old.created_by = auth.uid() then return new; end if;
  if new.title is distinct from old.title or new.kind is distinct from old.kind or new.date is distinct from old.date
     or new.time is distinct from old.time or new.duration_min is distinct from old.duration_min
     or new.participant_ids is distinct from old.participant_ids or new.note is distinct from old.note
     or new.visio_url is distinct from old.visio_url or new.created_by is distinct from old.created_by then
    raise exception 'Seul l''organisateur peut modifier le rendez-vous ; les participants peuvent rédiger le compte rendu.';
  end if;
  return new;
end $$;

create trigger protect_event before update on public.events
for each row execute function public.protect_event();

-- ---------- Agenda synchronisé : un lien secret par personne ----------
create table public.calendar_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.calendar_tokens enable row level security;
create policy "mon lien d'agenda" on public.calendar_tokens for select using (user_id = auth.uid());
create policy "je crée mon lien d'agenda" on public.calendar_tokens for insert with check (user_id = auth.uid() and public.is_active());
create policy "je supprime mon lien d'agenda" on public.calendar_tokens for delete using (user_id = auth.uid());

-- ---------- Objectifs mensuels par centre (tableau de bord) ----------
create table public.objectives (
  id text primary key, -- « AAAA-MM:Centre »
  month text not null,
  centre text not null,
  leads int,
  bilans int,
  conversions int,
  ca numeric,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.objectives enable row level security;
create policy "objectifs réservés aux admins" on public.objectives for all using (public.is_admin()) with check (public.is_admin());
