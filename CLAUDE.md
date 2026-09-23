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

- Messagerie (23 sept.) : tables `conversations` / `messages` / `reads`
  (migration 002). Conversations **privées, admins compris**. Discussion à deux
  réutilisée si elle existe ; y ajouter quelqu'un crée un nouveau groupe.
  Non-lus = messages des autres postérieurs à `reads.read_at`.

- Lot « efficacité » (23 sept.) — migration 003 :
  - tâches : `checklist` / `attachments` (jsonb), `recurrence` ; la suivante est
    créée à la complétion (`spawnNext`, jamais dans le passé) ;
  - `task_comments` ; fichiers dans le bucket privé `pieces-jointes/<task_id>/…`
    (liens signés 10 min ; en démo : data URL ≤ 700 Ko) ;
  - `templates` : échéances en jours relatifs à une « date clé » ; la duplication
    de projet passe par un modèle éphémère calé sur la date de début ;
  - PWA : `public/manifest.webmanifest`, `public/sw.js` (enregistré en prod
    seulement), notifications système quand l'onglet est en arrière-plan. Le vrai
    Web Push (appli fermée) reste à faire une fois Supabase branché (clés VAPID) ;
  - e-mails : `src/lib/recap.ts` partagé entre l'aperçu (Profil) et les fonctions
    Netlify planifiées `recap-lundi` (6 h UTC) et `bilan-vendredi` (15 h UTC),
    envoi Brevo (`BREVO_API_KEY`), bouton de test `envoyer-recap`.

- Lot « équipe » (migration 004) : annonces + accusés de lecture (admins
  publient) ; messagerie : réactions (table `reactions`), `reply_to`,
  `attachments`, `edited_at`, épingles (`conversations.pinned_ids`),
  « transformer en tâche » ; base documentaire `docs` (mise en forme maison
  `src/lib/markdown.tsx`, sans HTML injecté, `admins_only`) ; absences avec
  validation admin, visibles dans agenda / équipe / Ma journée, alerte dans
  les fiches tâche et événement. Buckets privés `messagerie/<conv>/…` et
  `documents/<doc>/…`. Limite connue : le motif « Maladie » est masqué à
  l'écran pour les membres, mais reste lisible via l'API.
- Groupes (migration 006) : `conversations.avatar_url / description / admin_ids`,
  `reads.muted / pinned` (réglages perso), lectures des autres visibles par les
  membres (« Vu par »). Trigger `protect_conversation` : un non-admin du groupe
  ne peut qu'épingler des messages ou se retirer. Photos de groupe dans
  `avatars/groupes/<id>/`. Sourdine = pas de son ni de pastille, @mention notifiée.
- Mise en production : tester en démo → valider 004 en transaction annulée →
  demander à Jonathan → `db:push` → aperçu Netlify → production.

## Règles
- Pas de push GitHub ni de déploiement Netlify sans demande explicite.
