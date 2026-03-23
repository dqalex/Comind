'use client';

import { memo, useCallback } from 'react';
import clsx from 'clsx';
import {
  MoreVertical,
  User,
  Bot,
  CheckSquare,
  Square,
} from 'lucide-react';
import { SOPProgressBar } from '@/features/sop-engine';
import type { Task, Member } from '@/db/schema';

interface TaskCardProps {
  task: Task;
  priorityInfo: { label: string; class: string };
  assignee: Member | null | undefined;
  isSelected: boolean;
  isDragging: boolean;
  selectionMode: boolean;
  sopTemplate: { id: string; name: string; stages: any[] } | null;
  syncedLabel: string;
  onToggleSelection: (taskId: string) => void;
  onOpenDrawer: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onMenuToggle: (taskId: string, e: React.MouseEvent) => void;
}

// 使用 memo 优化防止无关状态变化导致的重渲染
const TaskCard = memo(function TaskCard({
  task,
  priorityInfo,
  assignee,
  isSelected,
  isDragging,
  selectionMode,
  sopTemplate,
  syncedLabel,
  onToggleSelection,
  onOpenDrawer,
  onDragStart,
  onMenuToggle,
}: TaskCardProps) {
  const handleDragEnd = useCallback(() => {
    // 由父组件统一处理 dragEnd 状态重置
  }, []);

  return (
    <div
      className={clsx('card p-3 group relative cursor-pointer', isDragging && 'opacity-40', isSelected && 'ring-2 ring-primary-500')}
      onClick={() => selectionMode ? onToggleSelection(task.id) : onOpenDrawer(task.id)}
      draggable={!selectionMode}
      onDragStart={(e) => !selectionMode && onDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          {/* 选择框 */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelection(task.id); }}
            className="mt-0.5 flex-shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary-500" />
            ) : (
              <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>
          <h4 className="text-sm font-medium flex-1 pr-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="truncate">{task.title}</span>
            {task.source === 'openclaw' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex-shrink-0">
                {syncedLabel}
              </span>
            )}
          </h4>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(task.id, e); }}
          className="p-0.5 opacity-0 group-hover:opacity-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
        >
          <MoreVertical className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2 ml-6">
        <span className={clsx('tag text-[10px]', priorityInfo.class)}>{priorityInfo.label}</span>
        {assignee && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {assignee.type === 'ai' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {assignee.name}
          </span>
        )}
      </div>

      {/* SOP 进度 */}
      {sopTemplate && Array.isArray(sopTemplate.stages) && sopTemplate.stages.length > 0 && (() => {
        const history = Array.isArray(task.stageHistory) ? task.stageHistory : [];
        return (
          <SOPProgressBar
            compact
            stages={sopTemplate.stages}
            stageHistory={history}
            currentStageId={task.currentStageId}
            templateName={sopTemplate.name}
          />
        );
      })()}

      {/* 子任务进度（非 SOP 任务） */}
      {!task.sopTemplateId && Array.isArray(task.checkItems) && task.checkItems.length > 0 && (() => {
        const total = task.checkItems.length;
        const done = task.checkItems.filter((ci: { completed: boolean }) => ci.completed).length;
        return (
          <div className="mt-2 ml-6 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--surface-hover)' }}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
              {done}/{total}
            </span>
          </div>
        );
      })()}
    </div>
  );
});

export default TaskCard;
