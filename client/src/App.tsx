import { useState, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { Column, Task, Profile, ActivityLog } from './types';
import { api } from './lib/api';
import { initializeGuestAuth } from './lib/supabase';
import { ColumnView } from './components/ColumnView';
import { TaskModal } from './components/TaskModal';
import { AuthModal } from './components/AuthModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { StatsDrawer } from './components/StatsDrawer';
import { FilterBar } from './components/FilterBar';
import { TeamModal } from './components/TeamModal';
import {
  Plus,
  Sun,
  Moon,
  BarChart3,
  UserCircle2,
  RefreshCw,
} from 'lucide-react';

export function App() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStatsDrawerOpen, setIsStatsDrawerOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(
    localStorage.getItem('kanban_user_email') || 'Guest'
  );

  // Multi-attribute Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      localStorage.getItem('kanban_theme') === 'dark' ||
      (!('kanban_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kanban_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kanban_theme', 'light');
    }
  }, [isDark]);

  const loadBoardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [boardData, profilesData, logsData] = await Promise.all([
        api.getBoard(),
        api.getProfiles().catch(() => []),
        api.getActivityLogs().catch(() => []),
      ]);
      setColumns(boardData || []);
      setProfiles(profilesData || []);
      setActivityLogs(logsData || []);
    } catch (err: any) {
      console.error('Failed to load board data:', err);
      setError(err?.message || 'Unable to load task board. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Automatically set up guest session if not already logged in
    initializeGuestAuth().then((guest) => {
      setUserEmail(guest.email);
      loadBoardData();
    });
  }, []);

  // Drag and Drop Handler
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColIndex = columns.findIndex((c) => c.id === source.droppableId);
    const destColIndex = columns.findIndex((c) => c.id === destination.droppableId);
    if (sourceColIndex === -1 || destColIndex === -1) return;

    // Optimistically update frontend state
    const newColumns = [...columns];
    const sourceCol = { ...newColumns[sourceColIndex], tasks: [...newColumns[sourceColIndex].tasks] };
    const destCol =
      sourceColIndex === destColIndex
        ? sourceCol
        : { ...newColumns[destColIndex], tasks: [...newColumns[destColIndex].tasks] };

    const [movedTask] = sourceCol.tasks.splice(source.index, 1);
    movedTask.column_id = destCol.id;

    // Compute new position
    let newPosition = 1000;
    if (destCol.tasks.length === 0) {
      newPosition = 1000;
    } else if (destination.index === 0) {
      newPosition = destCol.tasks[0].position / 2;
    } else if (destination.index >= destCol.tasks.length) {
      newPosition = destCol.tasks[destCol.tasks.length - 1].position + 1000;
    } else {
      const prev = destCol.tasks[destination.index - 1].position;
      const next = destCol.tasks[destination.index].position;
      newPosition = (prev + next) / 2;
    }
    movedTask.position = newPosition;

    destCol.tasks.splice(destination.index, 0, movedTask);

    newColumns[sourceColIndex] = sourceCol;
    if (sourceColIndex !== destColIndex) {
      newColumns[destColIndex] = destCol;
    }
    setColumns(newColumns);

    // Persist to backend
    try {
      await api.reorderTask({
        task_id: draggableId,
        new_column_id: destination.droppableId,
        new_position: newPosition,
      });
    } catch (err) {
      console.error('Failed to persist task reorder:', err);
      loadBoardData();
    }
  };

  // Add Column
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    try {
      const lastPos = columns.length > 0 ? columns[columns.length - 1].position + 1000 : 1000;
      const created = await api.createColumn({ title: newColumnTitle.trim(), position: lastPos });
      created.tasks = [];
      setColumns([...columns, created]);
      setNewColumnTitle('');
      setIsAddingColumn(false);
    } catch (err) {
      console.error('Failed to create column:', err);
    }
  };

  // Update Column Title
  const handleUpdateColumnTitle = async (columnId: string, title: string) => {
    try {
      await api.updateColumn(columnId, { title });
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, title } : c))
      );
    } catch (err) {
      console.error('Failed to rename column:', err);
    }
  };

  // Delete Column
  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Are you sure you want to delete this column and all its tasks?')) return;
    try {
      await api.deleteColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    } catch (err) {
      console.error('Failed to delete column:', err);
    }
  };

  // Create Task via Jira-style modal (automatically adds to the To Do column)
  const handleCreateTaskFromModal = async (taskData: {
    title: string;
    description: string;
    priority: string;
    due_date?: string;
    assignee_id?: string;
    assignee_ids?: string[];
    labels: string[];
  }) => {
    // Locate the "To Do" column or default to the first column
    const todoCol =
      columns.find((c) => c.title.trim().toLowerCase() === 'to do' || c.title.trim().toLowerCase() === 'todo') ||
      columns[0];

    if (!todoCol) {
      alert('Please create a column first!');
      return;
    }

    const created = await api.createTask({
      column_id: todoCol.id,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      due_date: taskData.due_date,
      assignee_id: taskData.assignee_id,
      assignee_ids: taskData.assignee_ids,
      labels: taskData.labels,
    });

    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === todoCol.id) {
          return { ...c, tasks: [...c.tasks, created] };
        }
        return c;
      })
    );
  };

  // Team Member Management Handlers
  const handleAddTeamMember = async (memberData: {
    full_name: string;
    email?: string;
    avatar_url?: string;
    color?: string;
  }) => {
    const created = await api.createProfile(memberData);
    setProfiles((prev) => [...prev, created]);
  };

  const handleRemoveTeamMember = async (id: string) => {
    await api.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    // Refresh board to reflect removed profile association
    loadBoardData();
  };

  // Add Task inline
  const handleAddTask = async (columnId: string, title: string) => {
    try {
      const created = await api.createTask({
        column_id: columnId,
        title,
        priority: 'medium',
        labels: [],
      });
      setColumns((prev) =>
        prev.map((c) => {
          if (c.id === columnId) {
            return { ...c, tasks: [...c.tasks, created] };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  // Update Task details
  const handleUpdateTask = async (taskId: string, updates: Record<string, any>) => {
    try {
      const updated = await api.updateTask(taskId, updates);
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => (t.id === taskId ? { ...t, ...updated } : t)),
        }))
      );
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.filter((t) => t.id !== taskId),
        }))
      );
      setSelectedTask(null);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Subtask handlers
  const handleCreateSubtask = async (taskId: string, title: string) => {
    try {
      const st = await api.createSubtask(taskId, { title });
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), st] } : t
          ),
        }))
      );
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) =>
          prev ? { ...prev, subtasks: [...(prev.subtasks || []), st] } : null
        );
      }
    } catch (err) {
      console.error('Failed to create subtask:', err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: boolean) => {
    try {
      const updated = await api.updateSubtask(subtaskId, { is_completed: !currentStatus });
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => ({
            ...t,
            subtasks: (t.subtasks || []).map((s) => (s.id === subtaskId ? updated : s)),
          })),
        }))
      );
      if (selectedTask) {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                subtasks: (prev.subtasks || []).map((s) => (s.id === subtaskId ? updated : s)),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await api.deleteSubtask(subtaskId);
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => ({
            ...t,
            subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId),
          })),
        }))
      );
      if (selectedTask) {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                subtasks: (prev.subtasks || []).filter((s) => s.id !== subtaskId),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    }
  };

  // Comment handler
  const handleAddComment = async (taskId: string, content: string) => {
    try {
      const cm = await api.createComment(taskId, { content });
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) =>
            t.id === taskId ? { ...t, comments: [...(t.comments || []), cm] } : t
          ),
        }))
      );
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) =>
          prev ? { ...prev, comments: [...(prev.comments || []), cm] } : null
        );
      }
    } catch (err) {
      console.error('Failed to create comment:', err);
    }
  };

  // Extract all unique labels across tasks
  const allAvailableTags = Array.from(
    new Set(
      columns
        .flatMap((col) => col.tasks)
        .flatMap((t) => {
          if (Array.isArray(t.labels)) return t.labels;
          if (typeof t.labels === 'string') {
            try {
              return JSON.parse(t.labels);
            } catch {
              return [];
            }
          }
          return [];
        })
    )
  );

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedPriority !== 'all' ||
    selectedAssignee !== 'all' ||
    selectedTag !== 'all' ||
    overdueOnly;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedPriority('all');
    setSelectedAssignee('all');
    setSelectedTag('all');
    setOverdueOnly(false);
  };

  // Filter columns based on search, priority, assignee, tag, and overdue
  const now = Date.now();
  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((t) => {
      // 1. Text Search query
      const matchesSearch =
        searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Priority
      const matchesPriority =
        selectedPriority === 'all' || t.priority === selectedPriority;

      // 3. Assignee
      const matchesAssignee =
        selectedAssignee === 'all' ||
        (selectedAssignee === 'unassigned' && !t.assignee_id) ||
        t.assignee_id === selectedAssignee;

      // 4. Tag / Label
      let taskTags: string[] = [];
      if (Array.isArray(t.labels)) taskTags = t.labels;
      else if (typeof t.labels === 'string') {
        try {
          taskTags = JSON.parse(t.labels);
        } catch {
          taskTags = [];
        }
      }
      const matchesTag =
        selectedTag === 'all' || taskTags.includes(selectedTag);

      // 5. Overdue
      const matchesOverdue =
        !overdueOnly ||
        (Boolean(t.due_date) && t.status !== 'done' && new Date(t.due_date!).getTime() < now);

      return (
        matchesSearch &&
        matchesPriority &&
        matchesAssignee &&
        matchesTag &&
        matchesOverdue
      );
    }),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      
      {/* Top Navigation Bar (Reduced height to 64px, hairline subtle bottom border) */}
      <header className="h-16 px-6 border-b border-black/5 dark:border-white/5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Kanban Studio Logo"
            className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-zinc-800 p-0.5 border border-black/5 dark:border-white/10 shadow-xs"
          />
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              Kanban Studio
            </h1>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Streamlined agile task management</p>
          </div>
        </div>

        {/* Right Tools: Relocated Compact + Create Task pill button (height 36px, brand blue #1A56DB) & secondary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-4 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-full text-xs font-medium shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>

          {/* Team Pill & Avatar Cluster */}
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="h-9 px-3 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 border border-black/5 dark:border-white/10 rounded-full text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            title="Manage Team Members"
          >
            <div className="flex items-center -space-x-1.5">
              {profiles.slice(0, 3).map((p) => {
                const color = p.color || '#4F46E5';
                return p.avatar_url ? (
                  <img
                    key={p.id}
                    src={p.avatar_url}
                    alt={p.full_name}
                    className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900"
                  />
                ) : (
                  <div
                    key={p.id}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900"
                    style={{ backgroundColor: color }}
                  >
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
            <span className="hidden sm:inline font-semibold">Team ({profiles.length})</span>
          </button>

          <button
            onClick={() => setIsStatsDrawerOpen(true)}
            className="h-9 px-3.5 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 border border-black/5 dark:border-white/10 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Statistics & Activity Feed"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#1A56DB] dark:text-blue-400" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <button
            onClick={loadBoardData}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-full transition-colors cursor-pointer"
            title="Reload board"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-full transition-colors cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-0.5" />

          {/* User Profile Pill */}
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/10 rounded-full text-xs font-medium cursor-pointer transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserCircle2 className="w-4 h-4" />
            </div>
            <span className="max-w-[110px] truncate text-zinc-700 dark:text-zinc-300 text-[11px]">{userEmail}</span>
          </button>
        </div>
      </header>

      {/* Comprehensive Multi-Attribute Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPriority={selectedPriority}
        onPriorityChange={setSelectedPriority}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={setSelectedAssignee}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        overdueOnly={overdueOnly}
        onOverdueToggle={() => setOverdueOnly(!overdueOnly)}
        allAvailableTags={allAvailableTags}
        profiles={profiles}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Main Board Container (Normalized 16px gap, 8px baseline alignment) */}
      <main className="flex-1 overflow-x-auto p-6 flex items-start gap-4">
        {loading ? (
          <div className="w-full flex flex-col items-center justify-center py-24 text-zinc-400">
            <RefreshCw className="w-7 h-7 animate-spin text-[#1A56DB] mb-3" />
            <p className="text-xs font-medium">Loading your Kanban board...</p>
          </div>
        ) : error ? (
          <div className="w-full max-w-md mx-auto my-16 p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto mb-3">
              <span className="font-bold text-lg">!</span>
            </div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
              Failed to load tasks
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 mb-4">{error}</p>
            <button
              onClick={loadBoardData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <DragDropContext onDragEnd={handleDragEnd}>
              {filteredColumns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  onAddTask={handleAddTask}
                  onUpdateColumnTitle={handleUpdateColumnTitle}
                  onDeleteColumn={handleDeleteColumn}
                  onSelectTask={(task) => setSelectedTask(task)}
                />
              ))}
            </DragDropContext>

            {/* Add New Column Box */}
            <div className="w-80 shrink-0">
              {isAddingColumn ? (
                <form
                  onSubmit={handleCreateColumn}
                  className="bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-xl p-4 shadow-sm space-y-3"
                >
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Create New Column
                  </h4>
                  <input
                    type="text"
                    autoFocus
                    value={newColumnTitle}
                    onChange={(e) => setNewColumnTitle(e.target.value)}
                    placeholder="Column name (e.g. QA Testing)"
                    className="w-full px-3 py-2 bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-lg text-xs outline-none focus:border-[#1A56DB] text-zinc-900 dark:text-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Create Column
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingColumn(false)}
                      className="px-3 py-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingColumn(true)}
                  className="w-full py-3.5 border border-dashed border-black/10 dark:border-white/10 hover:border-[#1A56DB] dark:hover:border-blue-500 rounded-xl text-xs font-medium text-zinc-400 hover:text-[#1A56DB] dark:hover:text-blue-400 flex items-center justify-center gap-2 transition-all cursor-pointer bg-black/[0.01] dark:bg-white/[0.01]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another column
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Stats & Global Activity Slide-Out Drawer */}
      <StatsDrawer
        isOpen={isStatsDrawerOpen}
        onClose={() => setIsStatsDrawerOpen(false)}
        columns={columns}
        profiles={profiles}
        activityLogs={activityLogs}
      />

      {/* Task Creation Modal (adds to To Do column) */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        profiles={profiles}
        onSubmit={handleCreateTaskFromModal}
      />

      {/* Task Details Modal */}
      <TaskModal
        task={selectedTask}
        profiles={profiles}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onCreateSubtask={handleCreateSubtask}
        onToggleSubtask={handleToggleSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onAddComment={handleAddComment}
      />

      {/* Team Management Modal */}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        profiles={profiles}
        onAddMember={handleAddTeamMember}
        onRemoveMember={handleRemoveTeamMember}
      />

      {/* Supabase Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(_token, email) => {
          setUserEmail(email);
          loadBoardData();
        }}
      />
    </div>
  );
}

export default App;
