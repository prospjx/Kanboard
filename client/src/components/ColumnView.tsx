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
    <div className="w-80 shrink-0 flex flex-col bg-zinc-100/80 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-3 max-h-[calc(100vh-130px)] shadow-xs">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 py-2 mb-2">
        <div className="flex items-center gap-2 flex-1 mr-2">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="flex-1">
              <input
                type="text"
                autoFocus
                value={columnTitle}
                onChange={(e) => setColumnTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                className="w-full text-sm font-bold bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-indigo-500 outline-none text-zinc-900 dark:text-white"
              />
            </form>
          ) : (
            <h3
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
              title="Click to rename"
            >
              {column.title}
            </h3>
          )}
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {column.tasks.length}
          </span>
        </div>

        {/* Action Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-7 z-20 w-36 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg py-1 text-xs animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditingTitle(true);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-200 cursor-pointer"
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
            className={`flex-1 overflow-y-auto min-h-[100px] px-1 py-1 rounded-xl transition-colors ${
              snapshot.isDraggingOver
                ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
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

      {/* Add Task Button & Form */}
      <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
        {isAddingCard ? (
          <form onSubmit={handleCreateCard} className="space-y-2">
            <textarea
              autoFocus
              rows={2}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-xs"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
              >
                Add Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCard(false);
                  setNewTaskTitle('');
                }}
                className="px-3 py-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full py-2 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add a card
          </button>
        )}
      </div>
    </div>
  );
};

