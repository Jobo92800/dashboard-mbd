-- ============================================================================
-- MA HQ · annonces, messagerie enrichie, documents, absences
-- ============================================================================

-- ---------- Messagerie : réponses, pièces jointes, modification, épingles ----
alter table public.messages
  add column reply_to uuid references public.messages(id) on delete set null,
  add column attachments jsonb not null default '[]'::jsonb,
  add column edited_at timestamptz;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (length(body) <= 5000);

alter table public.conversations add column pinned_ids uuid[] not null default '{}';

-- Seul l'auteur modifie son message.
create policy "messages modifiés" on public.messages for update using (author_id = auth.uid());

create table public.reactions (
  id text primary key, -- message:personne:emoji
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (length(emoji) <= 16)
);
create index on public.reactions (message_id);

create or replace function public.can_see_message(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from messages m where m.id = mid and public.in_conversation(m.conversation_id));
$$;

alter table public.reactions enable row level security;
create policy "réactions lisibles" on public.reactions for select using (public.can_see_message(message_id));
create policy "réactions ajoutées" on public.reactions for insert with check (user_id = auth.uid() and public.can_see_message(message_id));
create policy "réactions retirées" on public.reactions for delete using (user_id = auth.uid());

-- ---------- Annonces --------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  important boolean not null default false,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.announcement_reads (
  id text primary key, -- annonce:personne
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
create policy "annonces lisibles" on public.announcements for select using (public.is_active());
create policy "annonces gérées par admin" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "lectures d'annonces lisibles" on public.announcement_reads for select using (public.is_active());
create policy "je confirme ma lecture" on public.announcement_reads for insert with check (user_id = auth.uid() and public.is_active());
create policy "je mets à jour ma lecture" on public.announcement_reads for update using (user_id = auth.uid());

-- ---------- Documents -------------------------------------------------------
create table public.docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Autre',
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  admins_only boolean not null default false,
  pinned boolean not null default false,
  author_id uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.can_see_doc(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from docs d where d.id = did and (public.is_admin() or (public.is_active() and not d.admins_only)));
$$;

alter table public.docs enable row level security;
create policy "documents lisibles" on public.docs for select using (public.is_admin() or (public.is_active() and not admins_only));
create policy "documents créés" on public.docs for insert
  with check (public.is_active() and author_id = auth.uid() and (public.is_admin() or not admins_only));
create policy "documents modifiés" on public.docs for update
  using (public.is_admin() or (public.is_active() and not admins_only))
  with check (public.is_admin() or not admins_only);
create policy "documents supprimés" on public.docs for delete using (public.is_admin() or author_id = auth.uid());

-- ---------- Absences --------------------------------------------------------
create table public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  kind text not null default 'Congés',
  note text not null default '',
  status text not null default 'en_attente' check (status in ('en_attente', 'validee', 'refusee')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on public.absences (user_id, start_date);

alter table public.absences enable row level security;
create policy "absences lisibles" on public.absences for select using (public.is_active());
-- Un membre demande pour lui-même (en attente) ; un admin note pour n'importe qui.
create policy "absences demandées" on public.absences for insert with check (
  public.is_admin() or (public.is_active() and user_id = auth.uid() and status = 'en_attente'));
create policy "absences modifiées" on public.absences for update
  using (public.is_admin() or (user_id = auth.uid() and status = 'en_attente'))
  with check (public.is_admin() or (user_id = auth.uid() and status = 'en_attente'));
create policy "absences supprimées" on public.absences for delete using (
  public.is_admin() or (user_id = auth.uid() and (status <> 'validee' or start_date > current_date)));

-- ---------- Fichiers : messagerie et documents (espaces privés séparés) -----
insert into storage.buckets (id, name, public, file_size_limit) values
  ('messagerie', 'messagerie', false, 20971520),
  ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

-- messagerie/<conversation>/<fichier>
create policy "fichiers messagerie lisibles" on storage.objects for select
  using (bucket_id = 'messagerie' and public.in_conversation(((storage.foldername(name))[1])::uuid));
create policy "fichiers messagerie déposés" on storage.objects for insert
  with check (bucket_id = 'messagerie' and public.in_conversation(((storage.foldername(name))[1])::uuid));

-- documents/<document>/<fichier>
create policy "fichiers documents lisibles" on storage.objects for select
  using (bucket_id = 'documents' and public.can_see_doc(((storage.foldername(name))[1])::uuid));
create policy "fichiers documents déposés" on storage.objects for insert
  with check (bucket_id = 'documents' and public.can_see_doc(((storage.foldername(name))[1])::uuid));
create policy "fichiers documents supprimés" on storage.objects for delete
  using (bucket_id = 'documents' and public.can_see_doc(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table
  public.reactions, public.announcements, public.announcement_reads, public.docs, public.absences;
