import { useState, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { Column, Task, Profile } from './types';
import { api } from './lib/api';
import { ColumnView } from './components/ColumnView';
import { TaskModal } from './components/TaskModal';
import { AuthModal } from './components/AuthModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import {
  Plus,
  Sun,
  Moon,
  Search,
  Filter,
  UserCircle2,
  RefreshCw,
} from 'lucide-react';

export function App() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(
    localStorage.getItem('kanban_user_email') || 'demo@kanban.dev'
  );

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
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
      const [boardData, profilesData] = await Promise.all([
        api.getBoard(),
        api.getProfiles().catch(() => []),
      ]);
      setColumns(boardData || []);
      setProfiles(profilesData || []);
    } catch (err) {
      console.error('Failed to load board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData();
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

  // Filter columns based on search and priority
  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((t) => {
      const matchesSearch =
        searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority =
        selectedPriority === 'all' || t.priority === selectedPriority;
      return matchesSearch && matchesPriority;
    }),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Kanban Studio Logo"
            className="w-9 h-9 rounded-xl object-contain shadow-xs bg-white dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              Kanban Studio
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Streamlined agile task management</p>
          </div>
        </div>

        {/* Center: Search & Filter Controls */}
        <div className="hidden md:flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 pr-3 py-1.5 w-56 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400 ml-1.5" />
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPriority(p)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize cursor-pointer transition-colors ${
                  selectedPriority === p
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Primary "+ Create" Button matching your screenshot */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>

        {/* Right Tools: Refresh, Theme Switch, Auth Session */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBoardData}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Reload board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* User Profile / Supabase Auth Button */}
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            <UserCircle2 className="w-4 h-4 text-indigo-500" />
            <span className="max-w-[120px] truncate">{userEmail}</span>
          </button>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="flex-1 overflow-x-auto p-6 flex items-start gap-4">
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
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Create New Column
              </h4>
              <input
                type="text"
                autoFocus
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Column name (e.g. QA Testing)"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Create Column
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="px-3 py-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-full py-4 border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl text-xs font-semibold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 transition-all cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/30"
            >
              <Plus className="w-4 h-4" /> Add another column
            </button>
          )}
        </div>
      </main>

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
