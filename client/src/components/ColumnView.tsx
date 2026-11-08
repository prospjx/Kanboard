import React, { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import type { Column, Task } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, MoreVertical, Trash2, Edit2 } from 'lucide-react';

interface ColumnViewProps {
  column: Column;
  onAddTask: (columnId: string, title: string) => void;
  onUpdateColumnTitle: (columnId: string, newTitle: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onSelectTask: (task: Task) => void;
}

export const ColumnView: React.FC<ColumnViewProps> = ({
  column,
  onAddTask,
  onUpdateColumnTitle,
  onDeleteColumn,
  onSelectTask,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [columnTitle, setColumnTitle] = useState(column.title);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (columnTitle.trim() && columnTitle !== column.title) {
      onUpdateColumnTitle(column.id, columnTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
      setIsAddingCard(false);
    }
  };

  return (
    <div className="w-80 shrink-0 flex flex-col bg-black/[0.015] dark:bg-white/[0.02] rounded-xl border border-black/5 dark:border-white/5 p-3 max-h-[calc(100vh-140px)] transition-colors">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 py-1.5 mb-2">
        <div className="flex items-center gap-2 flex-1 mr-2">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="flex-1">
              <input
                type="text"
                autoFocus
                value={columnTitle}
                onChange={(e) => setColumnTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                className="w-full text-sm font-semibold bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-[#1A56DB] outline-none text-[#111827] dark:text-white"
              />
            </form>
          ) : (
            <h3
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-[#111827] dark:text-zinc-100 cursor-pointer hover:text-[#1A56DB] dark:hover:text-blue-400 truncate"
              title="Click to rename"
            >
              {column.title}
            </h3>
          )}
          {/* Low-contrast inline tabular count badge */}
          <span className="px-2 py-0.5 text-xs font-normal rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#4B5563] dark:text-zinc-400">
            {column.tasks.length}
          </span>
        </div>

        {/* Action Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-7 z-20 w-36 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-xl shadow-lg py-1 text-xs animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditingTitle(true);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" /> Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteColumn(column.id);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Droppable Task List */}
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto min-h-[80px] px-0.5 py-1 transition-colors ${
              snapshot.isDraggingOver
                ? 'bg-blue-50/40 dark:bg-blue-950/20 rounded-lg'
                : ''
            }`}
          >
            {column.tasks.map((task, idx) => (
              <TaskCard
                key={task.id}
                task={task}
                index={idx}
                onClick={() => onSelectTask(task)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Composer (To Do / In-Card) & Ghost Add Button */}
      <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
        {isAddingCard ? (
          /* Proper nesting: Outer card 12px (rounded-xl), Inner input 8px (rounded-lg) with active dot and composer-expand animation */
          <form
            onSubmit={handleCreateCard}
            className="composer-expand p-3 bg-white dark:bg-zinc-800 rounded-xl border border-black/10 dark:border-white/10 shadow-sm space-y-2.5"
          >
            <div className="relative">
              <textarea
                autoFocus
                rows={2}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full p-2.5 pr-6 bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-lg text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-[#1A56DB] resize-none"
              />
              {/* Active dot indicator on the right */}
              <div className="absolute right-2.5 top-3 w-1.5 h-1.5 rounded-full bg-[#1A56DB] animate-pulse" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="btn-hover-state px-3 py-1.5 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
              >
                Add Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCard(false);
                  setNewTaskTitle('');
                }}
                className="btn-hover-state px-3 py-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-medium cursor-pointer rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Ghost Add Button with btn-hover-state micro-feedback */
          <button
            onClick={() => setIsAddingCard(true)}
            className="btn-hover-state w-full py-2 px-3 border border-dashed border-transparent hover:border-black/15 dark:hover:border-white/15 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add a card
          </button>
        )}
      </div>
    </div>
  );
};

