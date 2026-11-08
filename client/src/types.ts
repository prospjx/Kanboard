export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  color?: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user?: Profile;
  content: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  task_id?: string;
  task_title: string;
  action: 'created' | 'moved' | 'updated' | 'commented' | 'completed';
  details: string;
  created_at: string;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export interface Task {
  id: string;
  column_id: string;
  status: TaskStatus;
  user_id: string;
  assignee_id?: string;
  assignee?: Profile;
  assignees?: Profile[];
  assignee_ids?: string[];
  title: string;
  description: string;
  priority: Priority;
  due_date?: string;
  position: number;
  labels: string[];
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  comments: Comment[];
}

export interface Column {
  id: string;
  user_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  tasks: Task[];
}

