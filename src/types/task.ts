
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  // dueDate?: string; // ISO string date - REMOVED
  completed: boolean;
  subtasks: Subtask[];
  createdAt?: any; // Firestore Timestamp or server timestamp
}
