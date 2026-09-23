-- ============================================================================
-- MA HQ · messagerie interne (à exécuter après 001_schema.sql)
-- Conversations privées : seuls les participants lisent et écrivent,
-- les administrateurs n'y ont PAS accès.
-- ============================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  member_ids uuid[] not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index on public.conversations using gin (member_ids);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

-- Dernière lecture par personne (id = « conversation:personne »).
create table public.reads (
  id text primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create or replace function public.in_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and exists (
    select 1 from conversations where id = cid and auth.uid() = any(member_ids)
  );
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reads enable row level security;

create policy "conversations lisibles" on public.conversations for select
  using (public.is_active() and auth.uid() = any(member_ids));
create policy "conversations créées" on public.conversations for insert
  with check (public.is_active() and created_by = auth.uid() and auth.uid() = any(member_ids));
-- Un participant peut renommer, ajouter des personnes ou se retirer.
create policy "conversations modifiées" on public.conversations for update
  using (public.is_active() and auth.uid() = any(member_ids))
  with check (public.is_active());
create policy "conversations supprimées" on public.conversations for delete
  using (public.is_active() and auth.uid() = any(member_ids));

create policy "messages lisibles" on public.messages for select using (public.in_conversation(conversation_id));
create policy "messages envoyés" on public.messages for insert
  with check (author_id = auth.uid() and public.in_conversation(conversation_id));
create policy "messages supprimés" on public.messages for delete using (author_id = auth.uid());

create policy "lectures lisibles" on public.reads for select using (user_id = auth.uid());
create policy "lectures créées" on public.reads for insert with check (user_id = auth.uid() and public.in_conversation(conversation_id));
create policy "lectures modifiées" on public.reads for update using (user_id = auth.uid());

alter publication supabase_realtime add table public.conversations, public.messages, public.reads;
