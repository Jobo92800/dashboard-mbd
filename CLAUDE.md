# MA HQ — mémoire du projet

Application interne de pilotage (projets, tâches, agenda, équipe) de
MAbeautyplus, créée le 23 sept. 2026 à partir de `~/Downloads/MA_HQ_V22_STABLE.html`
(prototype HTML unique en localStorage). Jonathan n'est pas développeur :
expliquer en français, sans jargon.

## Décisions
- Stack identique à la V2 thérapeute : Vite + React 19 + TypeScript + Tailwind
  (preset DA MAbeautyplus `tailwind-preset.cjs`, classes `mab-*`) + Supabase.
- **Deux backends, un seul contrat** (`src/data/backend.ts`) : mode démo
  (localStorage, mot de passe `demo`) si `VITE_SUPABASE_*` absent, sinon Supabase.
- Rôles : `admin` / `membre`. Règles dupliquées dans `src/lib/permissions.ts`
  (affichage + filtrage démo) et `supabase/migrations/001_schema.sql` (RLS,
  sécurité réelle). **Toute modification de droits se fait aux deux endroits.**
- Tâche rapide = tâche avec `project_id` null (une seule table `tasks`).
- Premier compte Supabase créé = admin automatiquement (trigger).
- Invitation : fonction Netlify `invite-member` (clé service_role côté serveur).
- Couleurs de projets/personnes prises dans la DA (`src/lib/palette.ts`).

## Règles
- Pas de push GitHub ni de déploiement Netlify sans demande explicite.
