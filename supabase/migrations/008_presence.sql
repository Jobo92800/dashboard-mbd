-- ============================================================================
-- MA HQ · « vu pour la dernière fois »
-- La présence en direct (en ligne / hors ligne) passe par le canal temps réel
-- de Supabase, sans rien écrire en base. Cette table garde seulement l'heure
-- de dernière connexion, pour afficher « Hors ligne · vu il y a 3 h ».
-- Volontairement hors de la publication temps réel : elle change souvent.
-- ============================================================================

create table public.last_seen (
  id uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.last_seen enable row level security;
create policy "présences lisibles" on public.last_seen for select using (public.is_active());
create policy "je signale ma présence" on public.last_seen for insert with check (id = auth.uid() and public.is_active());
create policy "je mets à jour ma présence" on public.last_seen for update using (id = auth.uid());
