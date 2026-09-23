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
}

/** Une tâche sans project_id est une « tâche rapide » (hors projet). */
export interface Task {
  id: string;
  project_id: string | null;
  phase: string | null;
  title: string;
  note: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  kind: string | null; // type de tâche rapide (Appel, Commande…)
  centre: string | null;
  created_by: string | null;
  created_at: string;
  done_at: string | null;
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
}

export interface Notification {
  id: string;
  user_id: string;
  text: string;
  link: string | null;
  read: boolean;
  created_at: string;
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
}

export interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/** Dernière lecture d'une conversation par une personne (id = conversation:personne). */
export interface ReadMark {
  id: string;
  conversation_id: string;
  user_id: string;
  read_at: string;
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
}

export type Table = keyof Snapshot;
