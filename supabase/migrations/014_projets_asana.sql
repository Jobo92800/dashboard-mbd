-- Projets façon Asana : date de début des tâches (vue Chronologie).
-- Les sous-tâches gardent leur niveau d'indentation dans le JSON « checklist » (champ level), sans changement de schéma.
alter table public.tasks add column if not exists start_date date;
