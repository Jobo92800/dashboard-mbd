export type Role = 'admin' | 'membre';
export type Availability = 'disponible' | 'occupe' | 'absent';
export type Priority = 'Haute' | 'Moyenne' | 'Basse';
export type TaskStatus = 'a_faire' | 'en_cours' | 'fait';
export type ProjectStatus = 'planifie' | 'en_cours' | 'termine' | 'archive';

export const CENTRES = ['Le Grau-du-Roi', 'Avignon', 'Sérignan', 'Cabestany', 'Le Crès'] as const;
export const QUICK_TYPES = ['Appel', 'Commande', 'Client', 'Centre', 'Administratif', 'Autre'] as const;
export const EVENT_TYPES = ['Réunion flash', 'Réunion', 'Point info', 'Point stratégique', 'Formation', 'Autre'] as const;
export const PRIORITIES: Priority[] = ['Haute', 'Moyenne', 'Basse'];

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  job_title: string;
  color: string;
  role: Role;
  active: boolean;
  availability: Availability;
  availability_note: string;
  recap_email: boolean; // reçoit le récap du lundi (et le bilan du vendredi pour les admins)
  avatar_url: string | null; // photo de profil (sinon : initiales sur fond de couleur)
  notif_prefs: Partial<Record<NotifKind, boolean>>; // absent = activé
}

export interface Project {
  id: string;
  name: string;
  description: string;
  start_date: string; // AAAA-MM-JJ
  end_date: string;
  color: string;
  status: ProjectStatus;
  phases: string[];
  member_ids: string[];
  created_by: string | null;
  created_at: string;
  // Pilotage façon « roadmap » : progression officielle = livrables validés ; coordination et décisions.
  validation_mode?: boolean;
  coordinator_id?: string | null;
  decider_id?: string | null;
}

export type Recurrence = 'quotidienne' | 'jours_ouvres' | 'hebdomadaire' | 'bimensuelle' | 'mensuelle';
export const RECURRENCES: { id: Recurrence; label: string }[] = [
  { id: 'quotidienne', label: 'Tous les jours' },
  { id: 'jours_ouvres', label: 'Du lundi au vendredi' },
  { id: 'hebdomadaire', label: 'Toutes les semaines' },
  { id: 'bimensuelle', label: 'Toutes les 2 semaines' },
  { id: 'mensuelle', label: 'Tous les mois' },
];

/** Sous-tâche ; `level` 1 ou 2 = sous-sous-tâche (indentée), comme dans Asana. */
export interface ChecklistItem { id: string; text: string; done: boolean; level?: number }

/** Lien (Canva, Drive…) ou fichier déposé. `path` = emplacement dans le stockage pour un fichier. */
export type Bucket = 'pieces-jointes' | 'messagerie' | 'documents';
export interface Attachment { id: string; name: string; url: string; kind: 'lien' | 'fichier'; path?: string; size?: number; bucket?: Bucket; mime?: string }

/** Une tâche sans project_id est une « tâche rapide » (hors projet). */
export interface Task {
  id: string;
  project_id: string | null;
  phase: string | null;
  title: string;
  note: string;
  assignee_id: string | null; // première personne (compatibilité)
  assignee_ids: string[]; // toutes les personnes concernées : une seule tâche partagée
  start_date?: string | null; // début (vue Chronologie) ; absent sur les anciennes tâches
  // Pilotage des missions (projets en « validation_mode ») ; absents sur les anciennes tâches.
  depends_on?: string[]; // missions dont celle-ci dépend
  launch_order?: LaunchOrder | null;
  deliverable?: string; // livrable attendu
  deliverable_version?: string; // version actuelle du livrable (ex. V0.1)
  validated_by?: string | null; // validation explicite du livrable
  validated_at?: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  kind: string | null; // type de tâche rapide (Appel, Commande…)
  centre: string | null;
  created_by: string | null;
  created_at: string;
  done_at: string | null;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  recurrence: Recurrence | null;
}

export type LaunchOrder = 'maintenant' | 'ensuite' | 'plus_tard';
export const LAUNCH_ORDERS: { id: LaunchOrder; label: string }[] = [
  { id: 'maintenant', label: 'Maintenant' }, { id: 'ensuite', label: 'Ensuite' }, { id: 'plus_tard', label: 'Plus tard' },
];

/** Point d'avancement d'une mission (ce qui était « à reporter dans T0.A »). */
export type UpdateState = 'a_lancer' | 'en_cours' | 'bloquee' | 'en_validation' | 'terminee';
export const UPDATE_STATES: { id: UpdateState; label: string; tone: 'neutre' | 'violet' | 'erreur' | 'factuel' | 'succes' }[] = [
  { id: 'a_lancer', label: 'À lancer', tone: 'neutre' },
  { id: 'en_cours', label: 'En cours', tone: 'violet' },
  { id: 'bloquee', label: 'Bloquée', tone: 'erreur' },
  { id: 'en_validation', label: 'En attente de validation', tone: 'factuel' },
  { id: 'terminee', label: 'Terminée', tone: 'succes' },
];
export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  state: UpdateState;
  version: string;
  done_text: string;
  blockers: string;
  arbitrages: string;
  next_action: string;
  created_at: string;
}

/** Journal des décisions d'un projet (ce qui était « T0.B »). */
export type DecisionKind = 'a_decider' | 'decision' | 'proposition' | 'hypothese' | 'a_confirmer' | 'fait' | 'rejete';
export const DECISION_KINDS: { id: DecisionKind; label: string; help: string; tone: 'emotion' | 'succes' | 'violet' | 'factuel' | 'neutre' | 'mesure' | 'erreur' }[] = [
  { id: 'a_decider', label: 'À décider', help: 'Un choix à trancher par la direction', tone: 'emotion' },
  { id: 'decision', label: 'Décision', help: 'Choix officiellement validé', tone: 'succes' },
  { id: 'proposition', label: 'Proposition', help: 'Idée à étudier, pas encore validée', tone: 'violet' },
  { id: 'hypothese', label: 'Hypothèse', help: 'Scénario ou chiffre de travail, non confirmé', tone: 'factuel' },
  { id: 'a_confirmer', label: 'À confirmer', help: 'Information à vérifier par la bonne personne', tone: 'mesure' },
  { id: 'fait', label: 'Fait', help: 'Information réelle et vérifiée', tone: 'neutre' },
  { id: 'rejete', label: 'Écartée', help: 'Option examinée puis écartée', tone: 'erreur' },
];
export interface DecisionEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  kind: DecisionKind;
  title: string;
  context: string;
  options: string;
  decision: string;
  consequences: string;
  changes_roadmap: boolean;
  author_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/** Tâche de modèle : l'échéance est un décalage en jours par rapport à la date de référence. */
export interface TemplateTask {
  title: string;
  phase: string | null;
  offset_days: number | null;
  priority: Priority;
  assignee_id: string | null;
  note: string;
  checklist: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  reference_label: string; // ex. « Jour du live »
  start_offset: number; // début du projet par rapport à la référence
  end_offset: number;
  phases: string[];
  member_ids: string[];
  tasks: TemplateTask[];
  created_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface CalEvent {
  id: string;
  title: string;
  kind: string;
  date: string;
  time: string;
  duration_min: number;
  participant_ids: string[];
  note: string;
  created_by: string | null;
  reminded_at?: string | null; // rappel « dans 15 min » déjà envoyé
  visio_url: string | null; // Meet, Zoom, WhatsApp, Teams…
  minutes: string; // compte rendu (notes)
  decisions: Decision[];
  minutes_by: string | null;
  minutes_updated_at: string | null;
}

/** Décision prise en réunion ; peut devenir une tâche (task_id). */
export interface Decision {
  id: string;
  text: string;
  task_id: string | null;
}

/** Objectif mensuel d'un centre (tableau de bord, admins). */
export interface Objective {
  id: string; // « AAAA-MM:Centre »
  month: string;
  centre: string;
  leads: number | null;
  bilans: number | null;
  conversions: number | null;
  ca: number | null;
  updated_by: string | null;
  updated_at: string;
}

/** Catégorie d'une notification : sert aux préférences « ce qui sonne sur mon téléphone ». */
export type NotifKind = 'tache' | 'message' | 'mention' | 'rdv' | 'annonce' | 'absence' | 'projet' | 'matin' | 'autre';

/** Catégories réglables dans Mon profil (les @mentions passent toujours). */
export const NOTIF_PREFS: { id: Exclude<NotifKind, 'mention' | 'autre'>; label: string; help: string }[] = [
  { id: 'message', label: 'Messages', help: 'Nouveaux messages privés et de groupe' },
  { id: 'tache', label: 'Tâches', help: 'Tâche confiée, commentée ou terminée' },
  { id: 'rdv', label: 'Rendez-vous', help: 'Invitation, changement, et rappel 15 min avant' },
  { id: 'annonce', label: 'Annonces', help: 'Annonces de la direction' },
  { id: 'absence', label: 'Absences', help: 'Demandes et validations' },
  { id: 'projet', label: 'Projets', help: 'Ajout à un projet' },
  { id: 'matin', label: 'Récap du matin', help: 'À 8 h : tes rendez-vous et tâches du jour' },
];

export interface Notification {
  id: string;
  user_id: string;
  text: string;
  link: string | null;
  read: boolean;
  created_at: string;
  kind?: NotifKind;
}

export interface Activity {
  id: string;
  actor_id: string | null;
  project_id: string | null;
  text: string;
  created_at: string;
}

/** Conversation privée : visible uniquement de ses participants (admins compris). */
export interface Conversation {
  id: string;
  title: string | null; // null = discussion à deux ou groupe sans nom
  member_ids: string[];
  created_by: string | null;
  created_at: string;
  last_message_at: string;
  pinned_ids: string[]; // messages épinglés
  avatar_url: string | null; // photo du groupe
  description: string;
  admin_ids: string[]; // administrateurs du groupe (le créateur au départ)
}

export interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  reply_to: string | null; // message auquel on répond
  attachments: Attachment[];
  edited_at: string | null;
}

/** Une réaction = une personne + un emoji sur un message (id = message:personne:emoji). */
export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

/** Annonce publiée par un admin à toute l'équipe, avec accusé de lecture. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  important: boolean;
  author_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface AnnouncementRead {
  id: string; // annonce:personne
  announcement_id: string;
  user_id: string;
  read_at: string;
}

export const DOC_CATEGORIES = ['Protocoles', 'Commercial', 'Webinaires', 'Outils & accès', 'Organisation', 'Autre'] as const;

/** Page de la base documentaire (procédures, scripts, runbooks…). */
export interface Doc {
  id: string;
  title: string;
  category: string;
  content: string; // texte mis en forme simple (titres #, listes -, **gras**, liens)
  attachments: Attachment[];
  admins_only: boolean;
  pinned: boolean;
  author_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ABSENCE_KINDS = ['Congés', 'Formation', 'Déplacement', 'Maladie', 'Autre'] as const;
export type AbsenceStatus = 'en_attente' | 'validee' | 'refusee';

export interface Absence {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  kind: string;
  note: string;
  status: AbsenceStatus;
  created_by: string | null;
  created_at: string;
}

/** Préférences d'une personne sur une conversation (id = conversation:personne). */
export interface ReadMark {
  id: string;
  conversation_id: string;
  user_id: string;
  read_at: string; // dernière lecture (sert aussi au « Vu par »)
  muted: boolean; // sourdine : ni son ni alerte (les @mentions passent)
  pinned: boolean; // épinglée en haut de la liste
}

/** Dossier de liens utiles (Applications, Landing pages…). */
export interface LinkFolder {
  id: string;
  name: string;
  emoji: string;
  color: string;
  position: number;
  admins_only: boolean;
  created_by: string | null;
  created_at: string;
}

export interface UsefulLink {
  id: string;
  folder_id: string | null;
  title: string;
  url: string;
  description: string;
  pinned: boolean; // favori, affiché tout en haut
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Dernière présence connue d'une personne (id = id de la personne). */
export interface LastSeen {
  id: string;
  seen_at: string;
}

export interface Snapshot {
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  comments: Comment[];
  events: CalEvent[];
  notifications: Notification[];
  activity: Activity[];
  conversations: Conversation[];
  messages: Message[];
  reads: ReadMark[];
  task_comments: TaskComment[];
  task_updates: TaskUpdate[];
  decisions_log: DecisionEntry[];
  templates: ProjectTemplate[];
  reactions: Reaction[];
  announcements: Announcement[];
  announcement_reads: AnnouncementRead[];
  docs: Doc[];
  absences: Absence[];
  link_folders: LinkFolder[];
  links: UsefulLink[];
  last_seen: LastSeen[];
  objectives: Objective[];
}

export type Table = keyof Snapshot;
