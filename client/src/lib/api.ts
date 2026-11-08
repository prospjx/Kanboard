const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Get current auth token (from Supabase session or dev mock user)
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('kanban_auth_token') || 'mock-user-00000000-0000-0000-0000-000000000001';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const api = {
  async getProfiles() {
    const res = await fetch(`${API_BASE}/profiles`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load profiles');
    return res.json();
  },

  async getBoard() {
    const res = await fetch(`${API_BASE}/board`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load board');
    return res.json();
  },

  async createColumn(data: { title: string; position: number }) {
    const res = await fetch(`${API_BASE}/columns`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create column');
    return res.json();
  },

  async updateColumn(columnId: string, data: { title?: string; position?: number }) {
    const res = await fetch(`${API_BASE}/columns/${columnId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update column');
    return res.json();
  },

  async deleteColumn(columnId: string) {
    const res = await fetch(`${API_BASE}/columns/${columnId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error('Failed to delete column');
    return res.json();
  },

  async createTask(data: {
    column_id: string;
    title: string;
    description?: string;
    priority?: string;
    due_date?: string;
    assignee_id?: string;
    labels?: string[];
  }) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async updateTask(taskId: string, data: Record<string, any>) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async reorderTask(data: { task_id: string; new_column_id: string; new_position: number }) {
    const res = await fetch(`${API_BASE}/tasks/reorder`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to reorder task');
    return res.json();
  },

  async deleteTask(taskId: string) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  async createSubtask(taskId: string, data: { title: string }) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create subtask');
    return res.json();
  },

  async updateSubtask(subtaskId: string, data: { title?: string; is_completed?: boolean }) {
    const res = await fetch(`${API_BASE}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update subtask');
    return res.json();
  },

  async deleteSubtask(subtaskId: string) {
    const res = await fetch(`${API_BASE}/subtasks/${subtaskId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error('Failed to delete subtask');
    return res.json();
  },

  async createComment(taskId: string, data: { content: string }) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create comment');
    return res.json();
  },

  async getActivityLogs() {
    const res = await fetch(`${API_BASE}/activity`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load activity logs');
    return res.json();
  },
};

