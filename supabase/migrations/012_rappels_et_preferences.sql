-- ============================================================================
-- MA HQ · rappels de rendez-vous, récap du matin, préférences de notification
-- ============================================================================

-- Catégorie de chaque notification (messages, tâches, rendez-vous, annonces…).
alter table public.notifications add column kind text not null default 'autre';

-- Ce que chacun veut recevoir sur son téléphone ({"matin": false} = coupé ; absent = activé).
alter table public.profiles add column notif_prefs jsonb not null default '{}'::jsonb;

-- Rappel « dans 15 min » déjà envoyé pour ce rendez-vous.
alter table public.events add column reminded_at timestamptz;
create index on public.events (date) where reminded_at is null;
