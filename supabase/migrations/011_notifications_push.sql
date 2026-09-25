-- ============================================================================
-- MA HQ · vraies notifications sur le téléphone (Web Push)
-- 1. Chaque appareil qui accepte les notifications est enregistré ici.
-- 2. À chaque notification ou nouveau message, la base appelle la fonction
--    Netlify « push », qui envoie la notification à tous les appareils des
--    personnes concernées (via Apple / Google), même appli fermée.
-- La fonction relit la ligne avec la clé serveur et la marque « envoyée » :
-- un appel extérieur ne peut ni inventer un contenu ni renvoyer deux fois.
-- ============================================================================

create extension if not exists pg_net;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "mes appareils" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "j'enregistre mon appareil" on public.push_subscriptions for insert with check (user_id = auth.uid() and public.is_active());
create policy "je mets à jour mon appareil" on public.push_subscriptions for update using (user_id = auth.uid());
create policy "je retire mon appareil" on public.push_subscriptions for delete using (user_id = auth.uid());

alter table public.notifications add column pushed_at timestamptz;
alter table public.messages add column pushed_at timestamptz;

create or replace function public.push_trigger() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://dashboardmbd.netlify.app/.netlify/functions/push',
    body := jsonb_build_object('type', tg_argv[0], 'id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Un souci d'envoi ne doit jamais empêcher d'enregistrer la notification ou le message.
  return new;
end $$;

create trigger push_notification after insert on public.notifications
for each row execute function public.push_trigger('notification');

create trigger push_message after insert on public.messages
for each row execute function public.push_trigger('message');
