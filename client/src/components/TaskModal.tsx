import React, { useState } from 'react';
import type { Task, Profile } from '../types';
import {
  X,
  Calendar,
  AlertCircle,
  CheckSquare,
  Plus,
  Trash2,
  MessageSquare,
  Send,
  User,
  Tag
} from 'lucide-react';

interface TaskModalProps {
  task: Task | null;
  profiles: Profile[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Record<string, any>) => void;
  onDelete: (taskId: string) => void;
  onCreateSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (subtaskId: string, currentStatus: boolean) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onAddComment: (taskId: string, content: string) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  profiles,
  onClose,
  onUpdate,
  onDelete,
  onCreateSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddComment,
}) => {
  if (!task) return null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => {
    if (task.assignee_ids && task.assignee_ids.length > 0) return task.assignee_ids;
    if (task.assignee_id) return [task.assignee_id];
    return [];
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [labels, setLabels] = useState<string[]>(Array.isArray(task.labels) ? task.labels : []);

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      onUpdate(task.id, { title: title.trim() });
    }
  };

  const handleDescBlur = () => {
    if (description !== task.description) {
      onUpdate(task.id, { description });
    }
  };

  const handlePriorityChange = (val: string) => {
    setPriority(val as any);
    onUpdate(task.id, { priority: val });
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueDate(val);
    onUpdate(task.id, { due_date: val ? new Date(val).toISOString() : null });
  };

  const handleToggleAssignee = (profileId: string) => {
    const next = assigneeIds.includes(profileId)
      ? assigneeIds.filter((id) => id !== profileId)
      : [...assigneeIds, profileId];
    setAssigneeIds(next);
    onUpdate(task.id, {
      assignee_ids: next,
      assignee_id: next.length > 0 ? next[0] : null,
    });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const updated = [...labels, newTag.trim()];
      setLabels(updated);
      setNewTag('');
      onUpdate(task.id, { labels: updated });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = labels.filter((t) => t !== tagToRemove);
    setLabels(updated);
    onUpdate(task.id, { labels: updated });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    onCreateSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(task.id, newComment.trim());
    setNewComment('');
  };

  const completedSubtasks = (task.subtasks || []).filter((s) => s.is_completed).length;
  const totalSubtasks = (task.subtasks || []).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-xl font-bold bg-transparent text-zinc-900 dark:text-white border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 outline-none w-full mr-4 px-1"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          
          {/* Main content column (left 2/3) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Description (Markdown supported)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                rows={4}
                placeholder="Add more details about this task..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
              />
            </div>

            {/* Subtask / Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Subtasks / Checklist ({completedSubtasks}/{totalSubtasks})
                  </span>
                </div>
                {totalSubtasks > 0 && (
                  <span className="text-xs font-medium text-zinc-500">{progressPercent}%</span>
                )}
              </div>

              {totalSubtasks > 0 && (
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-3">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {(task.subtasks || []).map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between group p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-lg text-sm"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={st.is_completed}
                        onChange={() => onToggleSubtask(st.id, st.is_completed)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 cursor-pointer"
                      />
                      <span
                        className={
                          st.is_completed
                            ? 'line-through text-zinc-400 dark:text-zinc-500'
                            : 'text-zinc-700 dark:text-zinc-200'
                        }
                      >
                        {st.title}
                      </span>
                    </label>
                    <button
                      onClick={() => onDeleteSubtask(st.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 transition-opacity p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddSubtask} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add a checklist item..."
                  className="flex-1 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>
            </div>

            {/* Comments Stream */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Activity & Comments ({(task.comments || []).length})
                </span>
              </div>

              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                {(task.comments || []).map((c) => (
                  <div key={c.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {c.user?.avatar_url ? (
                          <img
                            src={c.user.avatar_url}
                            alt={c.user.full_name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                            {(c.user?.full_name || 'U')[0]}
                          </div>
                        )}
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {c.user?.full_name || 'Team Member'}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 pl-7">{c.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                  title="Send Comment"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

          {/* Right sidebar options (1/3) */}
          <div className="space-y-5 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
            
            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Priority
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePriorityChange(opt.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      priority === opt.value
                        ? `${opt.color} ring-2 ring-indigo-500 shadow-xs`
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignees (Multi-select) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Assignees</span>
                <span className="text-[10px] text-zinc-400">{assigneeIds.length} selected</span>
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {profiles.map((p) => {
                  const isAssigned = assigneeIds.includes(p.id);
                  const color = p.color || '#4F46E5';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleAssignee(p.id)}
                      className={`w-full p-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer border ${
                        isAssigned
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {p.full_name[0]}
                          </div>
                        )}
                        <span className="truncate text-xs font-medium">{p.full_name}</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                        isAssigned ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isAssigned && '✓'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={handleDueDateChange}
                className="w-full px-2.5 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              />
            </div>

            {/* Labels / Tags */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Labels / Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {labels.map((lbl) => (
                  <span
                    key={lbl}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md text-[11px] font-medium border border-indigo-100 dark:border-indigo-800"
                  >
                    {lbl}
                    <button
                      onClick={() => handleRemoveTag(lbl)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag & press enter"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

