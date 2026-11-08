import React, { useState } from 'react';
import type { Profile } from '../types';
import {
  X,
  Minus,
  Calendar,
  User,
  Tag,
  AlertCircle,
  MessageSquare,
  Heading1,
  Heading2,
  CheckSquare,
  List,
  Code,
  Quote,
  Table,
} from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  onSubmit: (taskData: {
    title: string;
    description: string;
    priority: string;
    due_date?: string;
    assignee_id?: string;
    assignee_ids?: string[];
    labels: string[];
  }) => Promise<void>;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { value: 'high', label: 'High', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onSubmit,
}) => {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [createAnother, setCreateAnother] = useState(false);
  const [loading, setLoading] = useState(false);

  // Active pill dropdown toggles
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  // Slash command menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      if (!labels.includes(newTagInput.trim())) {
        setLabels([...labels, newTagInput.trim()]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setLabels(labels.filter((l) => l !== tag));
  };

  const handleToggleAssignee = (profileId: string) => {
    if (assigneeIds.includes(profileId)) {
      setAssigneeIds(assigneeIds.filter((id) => id !== profileId));
    } else {
      setAssigneeIds([...assigneeIds, profileId]);
    }
  };

  const resetForm = () => {
    setSummary('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setAssigneeIds([]);
    setLabels([]);
    setShowDatePicker(false);
    setShowAssigneePicker(false);
    setShowPriorityPicker(false);
    setShowLabelPicker(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summary.trim() || loading) return;

    setLoading(true);
    try {
      await onSubmit({
        title: summary.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : undefined,
        assignee_ids: assigneeIds,
        labels,
      });

      if (createAnother) {
        resetForm();
      } else {
        resetForm();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setLoading(false);
    }
  };

  const SLASH_ACTIONS = [
    { label: 'Heading 1', description: 'Large section heading', icon: Heading1, template: '# Heading 1\n' },
    { label: 'Heading 2', description: 'Medium section heading', icon: Heading2, template: '## Heading 2\n' },
    { label: 'Checklist / Task list', description: 'Track subtasks with checkboxes', icon: CheckSquare, template: '- [ ] ' },
    { label: 'Bullet list', description: 'Create a simple bulleted list', icon: List, template: '- ' },
    { label: 'Code snippet', description: 'Capture code or monospace text', icon: Code, template: '```\n// your code here\n```\n' },
    { label: 'Quote', description: 'Capture a quote or reference', icon: Quote, template: '> ' },
    { label: 'Table', description: 'Insert a 3x3 table', icon: Table, template: '| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Data | Data | Data |\n' },
  ];

  const filteredSlashActions = SLASH_ACTIONS.filter((act) =>
    act.label.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const applySlashAction = (template: string) => {
    // Replace the trailing slash query with the selected template
    const lastSlashIdx = description.lastIndexOf('/');
    const prefix = lastSlashIdx >= 0 ? description.substring(0, lastSlashIdx) : description;
    setDescription(prefix + template);
    setShowSlashMenu(false);
    setSlashQuery('');
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastSlash = textBeforeCursor.lastIndexOf('/');

    if (lastSlash !== -1 && (lastSlash === 0 || /\s/.test(textBeforeCursor[lastSlash - 1]))) {
      const query = textBeforeCursor.slice(lastSlash + 1);
      if (!query.includes('\n') && query.length < 15) {
        setSlashQuery(query);
        setShowSlashMenu(true);
        setSelectedSlashIndex(0);
        return;
      }
    }
    setShowSlashMenu(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSlashMenu || filteredSlashActions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashActions.length) % filteredSlashActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      applySlashAction(filteredSlashActions[selectedSlashIndex].template);
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-7 relative transition-all">
        
        {/* Header row: Project identifier, Task tag, and window controls */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-xs">
              ⚡
            </div>
            <span>KAN</span>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900">
              <span className="w-3 h-3 rounded-xs border-2 border-blue-600 dark:border-blue-400 flex items-center justify-center text-[8px]">✓</span>
              <span>Task</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          {/* Summary Input */}
          <div>
            <input
              type="text"
              autoFocus
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary"
              className="w-full text-xl font-bold bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none pb-1"
            />
          </div>

          {/* Description Input & Slash Command Menu */}
          <div className="relative">
            <textarea
              rows={4}
              value={description}
              onChange={handleDescriptionChange}
              onKeyDown={handleDescriptionKeyDown}
              placeholder="Add a description or type / for actions"
              className="w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 outline-none resize-none pt-1"
            />

            {/* Notion / Jira Style Slash Command Palette */}
            {showSlashMenu && (
              <div className="absolute left-0 top-12 z-30 w-72 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Basic blocks
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredSlashActions.length > 0 ? (
                    filteredSlashActions.map((act, idx) => {
                      const Icon = act.icon;
                      const isSelected = idx === selectedSlashIndex;
                      return (
                        <button
                          key={act.label}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur
                            applySlashAction(act.template);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg border ${
                            isSelected
                              ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                              : 'bg-zinc-100 dark:bg-zinc-700/80 border-zinc-200 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold">{act.label}</div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{act.description}</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-xs text-zinc-400 text-center">
                      No matching actions
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Jira-style Attribute Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 relative">
            
            {/* Due Date Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  dueDate
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>{dueDate ? new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Due date'}</span>
              </button>

              {showDatePicker && (
                <div className="absolute left-0 bottom-10 z-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setShowDatePicker(false);
                    }}
                    className="px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none text-zinc-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Multi-Assignee Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  assigneeIds.length > 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {assigneeIds.length === 0
                    ? 'Assignees'
                    : assigneeIds.length === 1
                    ? profiles.find((p) => p.id === assigneeIds[0])?.full_name || '1 Assignee'
                    : `${assigneeIds.length} Assignees`}
                </span>
              </button>

              {showAssigneePicker && (
                <div className="absolute left-0 bottom-10 z-20 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 text-xs max-h-56 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Select Assignees ({assigneeIds.length})
                  </div>
                  {profiles.map((p) => {
                    const isSelected = assigneeIds.includes(p.id);
                    const color = p.color || '#4F46E5';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleAssignee(p.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {p.full_name[0]}
                            </div>
                          )}
                          <span className="truncate text-xs">{p.full_name}</span>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {isSelected && '✓'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Priority Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPriorityPicker(!showPriorityPicker)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span className="capitalize">{priority}</span>
              </button>

              {showPriorityPicker && (
                <div className="absolute left-0 bottom-10 z-20 w-32 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1 text-xs">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPriority(opt.value);
                        setShowPriorityPicker(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg capitalize"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Labels Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  labels.length > 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                <span>{labels.length > 0 ? `${labels.length} labels` : 'Labels'}</span>
              </button>

              {showLabelPicker && (
                <div className="absolute left-0 bottom-10 z-20 w-52 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 text-xs">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {labels.map((l) => (
                      <span
                        key={l}
                        className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center gap-1"
                      >
                        {l}
                        <button type="button" onClick={() => handleRemoveTag(l)} className="hover:text-rose-500">×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Type tag & press enter"
                    className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none text-zinc-900 dark:text-white"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Footer Controls: Left feedback icon, Create another checkbox, Create button */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
              title="Give feedback"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createAnother}
                  onChange={(e) => setCreateAnother(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                />
                <span>Create another</span>
              </label>

              <button
                type="submit"
                disabled={!summary.trim() || loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

