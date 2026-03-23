'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Badge } from '@/shared/ui';
import type { Task, Project, Member } from '@/db/schema';
import type { StatusColumn } from '../hooks/useTasksPage';

interface StatusColumnConfig {
  key: StatusColumn;
  label: string;
  color: string;
}

interface TaskListViewProps {
  filteredTasks: Task[];
  projects: Project[];
  STATUS_COLUMNS: StatusColumnConfig[];
  PRIORITY_MAP: Record<string, { label: string; class: string }>;
  getMemberName: (assignees?: string[] | null) => Member | null | undefined;
  onOpenDrawer: (taskId: string) => void;
  onRequestDelete: (taskId: string) => void;
  t: (key: string) => string;
}

export default function TaskListView({
  filteredTasks, projects, STATUS_COLUMNS, PRIORITY_MAP,
  getMemberName, onOpenDrawer, onRequestDelete, t,
}: TaskListViewProps) {
  const [collapsedCompleted, setCollapsedCompleted] = useState(false);

  // 分离已完成和未完成任务
  const incompleteTasks = filteredTasks.filter(t => t.status !== 'completed');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
  const hasCompleted = completedTasks.length > 0;

  const renderTaskRow = (task: Task) => {
    const assignee = getMemberName(task.assignees);
    const project = projects.find(p => p.id === task.projectId);
    const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
    const statusCol = STATUS_COLUMNS.find(s => s.key === task.status);
    return (
      <tr
        key={task.id}
        className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        style={{ borderColor: 'var(--border)' }}
        onClick={() => onOpenDrawer(task.id)}
      >
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>{task.title}</td>
        <td className="px-4 py-2.5">
          <Badge className={clsx('text-[10px]', `status-${task.status}`)}>{statusCol?.label}</Badge>
        </td>
        <td className="px-4 py-2.5">
          <Badge className={clsx('text-[10px]', priorityInfo.class)}>{priorityInfo.label}</Badge>
        </td>
        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{assignee?.name || '-'}</td>
        <td className="px-4 py-2.5 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{project?.name || t('tasks.uncategorized')}</td>
        <td className="px-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRequestDelete(task.id); }}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
            <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.title')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold w-24" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.status')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold w-20" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.priority')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold w-28" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.assignee')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold w-24" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.project')}</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {/* 未完成任务 */}
          {incompleteTasks.map(renderTaskRow)}

          {/* 已完成任务折叠栏 */}
          {hasCompleted && (
            <tr className="border-b bg-slate-50 dark:bg-slate-800/30" style={{ borderColor: 'var(--border)' }}>
              <td colSpan={6} className="px-4 py-2">
                <button
                  onClick={() => setCollapsedCompleted(!collapsedCompleted)}
                  className="flex items-center gap-2 text-xs font-medium hover:text-primary-600 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {collapsedCompleted ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t('tasks.completed')} ({completedTasks.length})
                </button>
              </td>
            </tr>
          )}

          {/* 已完成任务列表 */}
          {!collapsedCompleted && hasCompleted && completedTasks.map(renderTaskRow)}

          {/* 空状态 */}
          {filteredTasks.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.noTasks')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
