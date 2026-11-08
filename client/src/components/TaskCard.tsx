import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Task } from '../types';
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: () => void;
}

const PRIORITY_BADGES: Record<string, { label: string; style: string }> = {
  low: { label: 'Low', style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  medium: { label: 'Med', style: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  high: { label: 'High', style: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  urgent: { label: 'Urgent', style: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800 font-bold' },
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onClick }) => {
  const completedSubtasks = (task.subtasks || []).filter((s) => s.is_completed).length;
  const totalSubtasks = (task.subtasks || []).length;
  const hasSubtasks = totalSubtasks > 0;
  const progressPercent = hasSubtasks ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Enhanced Due date styling & urgency calculation
  let dueDateText = '';
  let dueDateBadgeStyle = 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700/60 border-zinc-200 dark:border-zinc-700';

  if (task.due_date) {
    const d = new Date(task.due_date);
    const nowTime = Date.now();
    const diffDays = Math.ceil((d.getTime() - nowTime) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      dueDateText = daysAgo === 1 ? 'Overdue 1d' : `Overdue ${daysAgo}d`;
      dueDateBadgeStyle = 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 font-bold';
    } else if (diffDays === 0) {
      dueDateText = 'Due Today';
      dueDateBadgeStyle = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 font-semibold';
    } else if (diffDays === 1) {
      dueDateText = 'Due Tomorrow';
      dueDateBadgeStyle = 'text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800';
    } else {
      dueDateText = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  // Parse labels safely
  let labelsList: string[] = [];
  if (Array.isArray(task.labels)) {
    labelsList = task.labels;
  } else if (typeof task.labels === 'string') {
    try {
      labelsList = JSON.parse(task.labels);
    } catch {
      labelsList = [];
    }
  }

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`kanban-card-drag group bg-white dark:bg-zinc-800/90 border rounded-xl p-3.5 mb-2.5 shadow-xs hover:shadow-md cursor-pointer select-none ${
            snapshot.isDragging
              ? 'ring-2 ring-indigo-500 shadow-xl border-indigo-300 dark:border-indigo-600 rotate-1'
              : 'border-zinc-200/80 dark:border-zinc-700/60 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          {/* Top row: Labels & Priority */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex flex-wrap gap-1 max-w-[70%]">
              {labelsList.slice(0, 3).map((lbl, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900"
                >
                  {lbl}
                </span>
              ))}
              {labelsList.length > 3 && (
                <span className="text-[10px] text-zinc-400">+{labelsList.length - 3}</span>
              )}
            </div>

            {task.priority && (
              <span
                className={`px-2 py-0.5 text-[10px] rounded-md border flex items-center gap-1 ${
                  PRIORITY_BADGES[task.priority]?.style || ''
                }`}
              >
                <AlertCircle className="w-2.5 h-2.5" />
                {PRIORITY_BADGES[task.priority]?.label || task.priority}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {task.title}
          </h4>

          {/* Subtask checklist progress preview */}
          {hasSubtasks && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  {completedSubtasks}/{totalSubtasks}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-700/70 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer: Date, Comments count, Assignee Avatar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700/50 text-[11px] text-zinc-400">
            <div className="flex items-center gap-2">
              {dueDateText && (
                <span
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 text-[10px] ${dueDateBadgeStyle}`}
                >
                  <Calendar className="w-2.5 h-2.5 shrink-0" />
                  <span>{dueDateText}</span>
                </span>
              )}

              {(task.comments || []).length > 0 && (
                <span className="flex items-center gap-1 text-zinc-400">
                  <MessageSquare className="w-3 h-3" />
                  {task.comments.length}
                </span>
              )}
            </div>

            {/* Multi-Assignee Avatar Stack */}
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {(() => {
                const assignees = task.assignees && task.assignees.length > 0
                  ? task.assignees
                  : task.assignee
                  ? [task.assignee]
                  : [];

                if (assignees.length === 0) return null;

                const displayAssignees = assignees.slice(0, 3);
                const extraCount = assignees.length - 3;

                return (
                  <>
                    {displayAssignees.map((a, idx) => {
                      const color = a.color || '#4F46E5';
                      return a.avatar_url ? (
                        <img
                          key={a.id || idx}
                          src={a.avatar_url}
                          alt={a.full_name}
                          className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800"
                          title={a.full_name}
                        />
                      ) : (
                        <div
                          key={a.id || idx}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-800"
                          style={{ backgroundColor: color }}
                          title={a.full_name}
                        >
                          {a.full_name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}

                    {extraCount > 0 && (
                      <div
                        className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-zinc-800"
                        title={`${extraCount} more assignees`}
                      >
                        +{extraCount}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

