# MA HQ · Pilotage MAbeautyplus

L’espace de travail interne de l’équipe : projets, tâches, agenda, équipe,
avec des comptes personnels et deux niveaux d’accès (administrateur / membre).

Reprend tout ce que faisait `MA_HQ_V22_STABLE.html` et ajoute :

| Nouveauté | Pourquoi |
| --- | --- |
| **Comptes et connexion** (e-mail + mot de passe, invitation par e-mail, mot de passe oublié) | Chacun a son accès, on sait qui a fait quoi |
| **Admin / Membre** | Les membres ne voient que leurs projets ; seuls les admins créent/suppriment des projets et gèrent l’équipe |
| **Données partagées en temps réel** (Supabase) | Fini le `localStorage` : tout le monde voit la même chose, sur tous les appareils |
| **Ma journée** | Ce que j’ai à faire (retards, aujourd’hui, semaine), mes rendez-vous, mon statut |
| **Notifications** | Tâche confiée, @mention, invitation à une réunion, tâche terminée |
| **Statut des tâches** À faire / En cours / Fait + **vue Tableau** (glisser-déposer) | Voir ce qui avance, pas seulement ce qui est fini |
| **Santé des projets** (dans les temps / à risque / en retard) + **vue direction** | Savoir en 5 secondes où intervenir |
| **Chronologie** des projets | Voir les chevauchements sur plusieurs semaines |
| **Recherche globale** (⌘K) | Retrouver un projet, une tâche, une personne |
| **Centre concerné** sur les tâches | Filtrer par Grau-du-Roi, Avignon, Sérignan, Cabestany, Le Crès |
| **Modèles d’étapes** à la création d’un projet | Webinaire, protocole, campagne… sans tout ressaisir |
| **Charge de travail** par personne | Répartir avant de surcharger |
| **Archivage** des projets, **historique** d’activité | Rien ne se perd |
| **Export agenda (.ics)** | Ajouter ses réunions à Google Agenda / iPhone |
| Mobile, charte MAbeautyplus | Utilisable en centre, sur téléphone |

---

## Essayer tout de suite (mode démo)

Sans configuration, l’application tourne en **mode démo** avec les données de la
V22 : comptes Jo et Nico (admin), Marie, Leslie, Elisa, Flora (membres),
mot de passe `demo`. Les données restent dans le navigateur.

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5190.

## Passer en mode réel (Supabase + Netlify)

1. **Créer un projet Supabase** (supabase.com → New project, région Europe).
2. **Créer les tables** : Supabase → *SQL Editor* → *New query* → coller tout le
   fichier `supabase/migrations/001_schema.sql` → *Run*.
3. **Autoriser l’adresse du site** : *Authentication → URL Configuration* :
   - *Site URL* : l’adresse Netlify du site (ex. `https://mahq.netlify.app`)
   - *Redirect URLs* : ajouter `https://mahq.netlify.app/mot-de-passe`
4. **E-mails** : *Authentication → Emails → SMTP Settings* : mêmes réglages
   Brevo que l’app nutrition (expéditeur `contact@mabeautyplus.fr`).
5. **Créer le premier compte (toi)** : *Authentication → Users → Add user →
   Send invitation* avec ton e-mail. **Le tout premier compte devient
   automatiquement administrateur.** Les suivants s’invitent depuis l’appli
   (*Membres & accès → Inviter une personne*).
6. **Netlify** → nouveau site depuis ce dépôt, puis *Site configuration →
   Environment variables* :
   | Variable | Où la trouver (Supabase → Project Settings → API) |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | clé `anon` / publishable |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` / secret — **jamais dans le code** |
7. Redéployer. La page de connexion n’affiche plus les comptes démo : on est en
   mode réel.

## Qui peut faire quoi

| | Admin | Membre |
| --- | --- | --- |
| Voir les projets | Tous | Ceux dont il fait partie |
| Créer / modifier / archiver / supprimer un projet | ✓ | — |
| Ajouter, modifier, cocher des tâches d’un projet | ✓ | Dans ses projets |
| Tâches rapides | Toutes | Les siennes (créées ou confiées) |
| Événements | Tous | Ceux où il est invité / qu’il organise |
| Commenter, @mentionner | ✓ | Dans ses projets |
| Inviter, changer un rôle, désactiver un accès | ✓ | — |

Ces règles sont appliquées **par la base de données** (RLS), pas seulement par
l’écran : un membre ne peut pas contourner ses droits. Un compte désactivé ne
peut plus rien lire ni écrire ; son historique est conservé.

## Organisation du code

```
src/
  pages/          Un fichier par écran (Ma journée, Projets, Tâches, Agenda…)
  components/     Éléments réutilisés (fenêtres, lignes de tâche, mise en page)
  state/store.tsx Toutes les actions (créer, modifier, notifier, historiser)
  data/           Mode démo (navigateur) et mode réel (Supabase), même contrat
  lib/            Types, dates, règles d’accès, calculs (retards, santé)
  tokens.css      Charte MAbeautyplus (ne pas modifier ici)
supabase/migrations/  Schéma de la base + règles d’accès
netlify/functions/    Invitation d’un membre (seule à utiliser la clé secrète)
```
