import React, { useState } from 'react';
import type { Column, Profile, ActivityLog } from '../types';
import {
  X,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flame,
  ListTodo,
  TrendingUp,
  History,
  MessageSquare,
  MoveRight,
  PlusCircle,
} from 'lucide-react';

interface StatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  profiles: Profile[];
  activityLogs: ActivityLog[];
}

export const StatsDrawer: React.FC<StatsDrawerProps> = ({
  isOpen,
  onClose,
  columns,
  profiles,
  activityLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'activity'>('stats');

  if (!isOpen) return null;

  // Flatten tasks
  const allTasks = columns.flatMap((col) => col.tasks);
  const totalTasks = allTasks.length;

  // Status breakdown
  const doneTasks = allTasks.filter(
    (t) => t.status === 'done' || t.column_id === columns.find((c) => c.title.toLowerCase().includes('done'))?.id
  );
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // Due date / Urgency calculation
  const now = Date.now();
  const overdueTasks = allTasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false;
    return new Date(t.due_date).getTime() < now;
  });

  const urgentTasks = allTasks.filter((t) => t.priority === 'urgent');

  // Priority breakdown
  const priorityCounts = {
    urgent: allTasks.filter((t) => t.priority === 'urgent').length,
    high: allTasks.filter((t) => t.priority === 'high').length,
    medium: allTasks.filter((t) => t.priority === 'medium').length,
    low: allTasks.filter((t) => t.priority === 'low').length,
  };

  // Member workload
  const memberWorkload = profiles.map((p) => {
    const assigned = allTasks.filter((t) => t.assignee_id === p.id);
    return {
      profile: p,
      count: assigned.length,
      done: assigned.filter((t) => t.status === 'done').length,
    };
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'moved':
        return <MoveRight className="w-3.5 h-3.5 text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />;
      case 'commented':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Board Insights
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Metrics & Real-time Audit Timeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-5 pt-3 gap-4 text-xs font-semibold bg-zinc-50/50 dark:bg-zinc-900">
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'stats'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Statistics & Summary
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <History className="w-4 h-4" /> Global Activity Log ({activityLogs.length})
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'stats' ? (
            <>
              {/* Top High-level KPI Cards with Clean Solid Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <span className="text-xs font-medium">Total Tasks</span>
                    <ListTodo className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {totalTasks}
                  </div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    {columns.length} columns active
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <span className="text-xs font-medium">Completed</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {completionRate}%
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    {doneTasks.length} of {totalTasks} finished
                  </div>
                </div>

                <div className="p-4 bg-rose-50 dark:bg-rose-950 rounded-2xl border border-rose-200 dark:border-rose-900">
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
                    <span className="text-xs font-medium">Overdue Tasks</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                    {overdueTasks.length}
                  </div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    Requires immediate action
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-2xl border border-amber-200 dark:border-amber-900">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
                    <span className="text-xs font-medium">Urgent Priority</span>
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {urgentTasks.length}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    High focus items
                  </div>
                </div>
              </div>

              {/* Column WIP Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Column Distribution
                </h3>
                <div className="space-y-2">
                  {columns.map((col) => {
                    const pct = totalTasks > 0 ? Math.round((col.tasks.length / totalTasks) * 100) : 0;
                    return (
                      <div key={col.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60">
                        <div className="flex items-center justify-between text-xs font-medium mb-2">
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{col.title}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{col.tasks.length} tasks ({pct}%)</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Priority Breakdown with Solid Colors */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Priority Distribution
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-900">
                    <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Urgent</div>
                    <div className="text-xl font-bold text-rose-800 dark:text-rose-200 mt-1">{priorityCounts.urgent}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900">
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">High</div>
                    <div className="text-xl font-bold text-amber-800 dark:text-amber-200 mt-1">{priorityCounts.high}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
                    <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Med</div>
                    <div className="text-xl font-bold text-blue-800 dark:text-blue-200 mt-1">{priorityCounts.medium}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Low</div>
                    <div className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">{priorityCounts.low}</div>
                  </div>
                </div>
              </div>

              {/* Team Workload */}
              {profiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Team Workload
                  </h3>
                  <div className="space-y-2">
                    {memberWorkload.map(({ profile, count, done }) => (
                      <div key={profile.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.full_name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                              {profile.full_name[0]}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{profile.full_name}</div>
                            <div className="text-[10px] text-zinc-400">{profile.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{count} tasks</div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{done} done</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Activity Feed Timeline */
            <div className="space-y-4">
              {activityLogs.length > 0 ? (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-xs p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                    <div className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 shrink-0 mt-0.5 shadow-xs">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1">
                      <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {log.details}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  No activity recorded yet.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
