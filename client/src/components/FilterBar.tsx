import React from 'react';
import type { Profile } from '../types';
import {
  Search,
  User,
  Tag,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedPriority: string;
  onPriorityChange: (p: string) => void;
  selectedAssignee: string;
  onAssigneeChange: (a: string) => void;
  selectedTag: string;
  onTagChange: (t: string) => void;
  overdueOnly: boolean;
  onOverdueToggle: () => void;
  allAvailableTags: string[];
  profiles: Profile[];
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedPriority,
  onPriorityChange,
  selectedAssignee,
  onAssigneeChange,
  selectedTag,
  onTagChange,
  overdueOnly,
  onOverdueToggle,
  allAvailableTags,
  profiles,
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="px-6 py-2 bg-white/50 dark:bg-zinc-900/50 border-b border-black/5 dark:border-white/5 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-xs">
      
      {/* Search Input */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 bg-black/[0.025] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-lg text-xs outline-none focus:border-[#1A56DB] text-zinc-900 dark:text-white transition-colors"
          />
        </div>
      </div>

      {/* Multi-attribute Filters */}
      <div className="flex flex-wrap items-center gap-2">
        
        {/* Priority Filter */}
        <div className="flex items-center bg-black/[0.025] dark:bg-white/[0.04] p-0.5 rounded-lg border border-black/5 dark:border-white/10">
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPriorityChange(p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize cursor-pointer transition-colors ${
                selectedPriority === p
                  ? 'bg-white dark:bg-zinc-800 text-[#1A56DB] dark:text-blue-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Assignee Dropdown */}
        <div className="relative flex items-center">
          <User className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <select
            value={selectedAssignee}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="pl-7 pr-3 py-1.5 bg-black/[0.025] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-lg text-[11px] outline-none focus:border-[#1A56DB] text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Tag / Label Dropdown */}
        {allAvailableTags.length > 0 && (
          <div className="relative flex items-center">
            <Tag className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedTag}
              onChange={(e) => onTagChange(e.target.value)}
              className="pl-7 pr-3 py-1.5 bg-black/[0.025] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-lg text-[11px] outline-none focus:border-[#1A56DB] text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              <option value="all">All Tags</option>
              {allAvailableTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Overdue Only Filter Switch */}
        <button
          onClick={onOverdueToggle}
          className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-medium cursor-pointer transition-all ${
            overdueOnly
              ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-xs'
              : 'bg-black/[0.025] dark:bg-white/[0.04] border-black/5 dark:border-white/10 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Overdue</span>
        </button>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
            title="Reset All Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

      </div>
    </div>
  );
};
