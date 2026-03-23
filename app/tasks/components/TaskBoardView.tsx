'use client';

import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Milestone as MilestoneIcon,
} from 'lucide-react';
import { Button } from '@/shared/ui';
import { MilestoneDivider } from '@/features/milestone-tracker/MilestoneDivider';
import TaskCard from './TaskCard';
import type { Task, Member } from '@/db/schema';
import type { StatusColumn } from '../hooks/useTasksPage';

interface StatusColumnConfig {
  key: StatusColumn;
  label: string;
  color: string;
}

interface MilestoneGroup {
  milestoneId: string | null;
  milestoneName: string;
  milestoneStatus?: string;
  tasks: Record<StatusColumn, Task[]>;
  count: number;
}

interface SwimLane {
  projectId: string | null;
  projectName: string;
  milestoneGroups: MilestoneGroup[];
  count: number;
}

interface TaskBoardViewProps {
  // 数据
  swimlaneData: SwimLane[];
  tasksByStatus: Record<StatusColumn, Task[]>;
  STATUS_COLUMNS: StatusColumnConfig[];
  PRIORITY_MAP: Record<string, { label: string; class: string }>;
  sopTemplates: any[];
  selectedTaskIds: Set<string>;
  selectionMode: boolean;
  currentProjectId: string | null;
  isSwimLaneView: boolean;
  collapsedLanes: Set<string>;
  collapsedStatusColumns: Set<StatusColumn>;
  // 拖拽
  dragTaskId: string | null;
  dragMilestoneId: string | null;
  dragOverTarget: { col: StatusColumn; projectId: string | null; milestoneId: string | null } | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId?: string | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId?: string | null) => void;
  onMilestoneDragStart: (e: React.DragEvent, milestoneId: string) => void;
  onMilestoneDrop: (e: React.DragEvent, projectId: string | null, targetMilestoneId: string | null) => void;
  // 操作
  onToggleLane: (laneId: string) => void;
  onToggleStatusColumn: (col: StatusColumn) => void;
  onToggleSelection: (taskId: string) => void;
  onOpenDrawer: (taskId: string) => void;
  onMenuToggle: (taskId: string, e: React.MouseEvent) => void;
  onShowMilestoneManager: (projectId: string | null) => void;
  getMemberName: (assignees?: string[] | null) => Member | null | undefined;
  // i18n
  t: (key: string) => string;
  syncedLabel: string;
  dragHereLabel: string;
  taskCountLabel: string;
  noTasksHint: string;
  milestoneTitle: string;
}

// 渲染状态列
function StatusColumnView({
  col, columnTasks, projectId, milestoneId = null,
  isOver, isCollapsed, onToggleCollapse, onDragOver, onDragLeave, onDrop,
  dragHereLabel, renderCard,
}: {
  col: StatusColumnConfig;
  columnTasks: Task[];
  projectId: string | null;
  milestoneId?: string | null;
  isOver: boolean;
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  onDragOver: (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId?: string | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId?: string | null) => void;
  dragHereLabel: string;
  renderCard: (task: Task) => React.ReactNode;
}) {
  return (
    <div
      className={clsx('flex flex-col min-h-0 min-w-0', isOver && 'ring-2 ring-primary-400 rounded-lg')}
      onDragOver={(e) => onDragOver(e, col.key, projectId, milestoneId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col.key, projectId, milestoneId)}
    >
      <button
        className="flex items-center gap-2 mb-2 px-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        onClick={onToggleCollapse}
        disabled={!onToggleCollapse}
      >
        {onToggleCollapse && (
          isCollapsed
            ? <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        )}
        <span className={clsx('w-2 h-2 rounded-full', col.color)} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{col.label}</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{columnTasks.length}</span>
      </button>
      {!isCollapsed && (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {columnTasks.map(task => renderCard(task))}
          {columnTasks.length === 0 && (
            <div className="text-center py-6 text-[11px] rounded-lg border border-dashed" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}>
              {dragHereLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskBoardView(props: TaskBoardViewProps) {
  const {
    swimlaneData, tasksByStatus, STATUS_COLUMNS, PRIORITY_MAP, sopTemplates,
    selectedTaskIds, selectionMode, currentProjectId, isSwimLaneView, collapsedLanes, collapsedStatusColumns,
    dragTaskId, dragMilestoneId, dragOverTarget,
    onDragStart, onDragOver, onDragLeave, onDrop, onMilestoneDragStart, onMilestoneDrop,
    onToggleLane, onToggleStatusColumn, onToggleSelection, onOpenDrawer, onMenuToggle, onShowMilestoneManager,
    getMemberName, t, syncedLabel, dragHereLabel, taskCountLabel, noTasksHint, milestoneTitle,
  } = props;

  // 渲染单个任务卡片
  const renderCard = (task: Task) => {
    const assignee = getMemberName(task.assignees);
    const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
    const sopTemplate = task.sopTemplateId ? sopTemplates.find(t => t.id === task.sopTemplateId) || null : null;
    return (
      <TaskCard
        key={task.id}
        task={task}
        priorityInfo={priorityInfo}
        assignee={assignee}
        isSelected={selectedTaskIds.has(task.id)}
        isDragging={dragTaskId === task.id}
        selectionMode={selectionMode}
        sopTemplate={sopTemplate}
        syncedLabel={syncedLabel}
        onToggleSelection={onToggleSelection}
        onOpenDrawer={onOpenDrawer}
        onDragStart={onDragStart}
        onMenuToggle={(taskId, e) => onMenuToggle(taskId, e)}
      />
    );
  };

  // 判断是否处于 over 状态
  const isOverCol = (colKey: StatusColumn, projectId: string | null, milestoneId: string | null) =>
    dragOverTarget?.col === colKey && dragOverTarget?.projectId === projectId && dragOverTarget?.milestoneId === milestoneId;

  // 渲染里程碑分组内的 4 列
  const renderMilestoneColumns = (group: MilestoneGroup, projectId: string | null, padding = '') => (
    <div className={clsx('grid gap-4', collapsedStatusColumns.has('completed' as StatusColumn) ? 'grid-cols-[1fr_1fr_1fr_auto]' : 'grid-cols-4')}>
      {STATUS_COLUMNS.map(col => (
        <StatusColumnView
          key={col.key}
          col={col}
          columnTasks={group.tasks[col.key]}
          projectId={projectId}
          milestoneId={group.milestoneId}
          isOver={isOverCol(col.key, projectId, group.milestoneId)}
          isCollapsed={collapsedStatusColumns.has(col.key)}
          onToggleCollapse={col.key === 'completed' ? () => onToggleStatusColumn(col.key) : undefined}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          dragHereLabel={dragHereLabel}
          renderCard={renderCard}
        />
      ))}
    </div>
  );

  if (isSwimLaneView) {
    // 泳道视图（全部任务，按项目分组）
    return (
      <div className="space-y-6">
        {swimlaneData.map(lane => {
          const laneId = lane.projectId || '__uncategorized__';
          const isCollapsed = collapsedLanes.has(laneId);
          // 状态小计
          const laneStatusCounts: Record<StatusColumn, number> = { todo: 0, in_progress: 0, reviewing: 0, completed: 0 };
          for (const group of lane.milestoneGroups) {
            for (const col of STATUS_COLUMNS) {
              laneStatusCounts[col.key] += group.tasks[col.key].length;
            }
          }
          return (
            <div key={laneId} className="card overflow-hidden">
              {/* 泳道标题行 */}
              <div
                className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}
              >
                <button onClick={() => onToggleLane(laneId)} className="flex items-center gap-2.5 flex-1 min-w-0">
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  }
                  <FolderKanban className="w-4 h-4" style={{ color: lane.projectId ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />
                  <span className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>{lane.projectName}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{lane.count} {taskCountLabel}</span>
                </button>
                {lane.projectId && (
                  <button
                    onClick={() => onShowMilestoneManager(lane.projectId)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title={milestoneTitle}
                  >
                    <MilestoneIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  {STATUS_COLUMNS.map(col => {
                    const count = laneStatusCounts[col.key];
                    if (count === 0) return null;
                    return (
                      <span key={col.key} className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', col.color)} />
                        {count}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 泳道内容 */}
              {!isCollapsed && (
                <div className="p-4 space-y-4">
                  {lane.milestoneGroups.map(group => {
                    const msLaneId = `${laneId}__ms__${group.milestoneId || '__none__'}`;
                    const msCollapsed = collapsedLanes.has(msLaneId);
                    const hasMilestones = lane.milestoneGroups.length > 1 || lane.milestoneGroups[0]?.milestoneId !== null;
                    return (
                      <div
                        key={msLaneId}
                        onDragOver={(e) => { if (dragMilestoneId) e.preventDefault(); }}
                        onDrop={(e) => { if (dragMilestoneId) onMilestoneDrop(e, lane.projectId, group.milestoneId); }}
                      >
                        {hasMilestones && (
                          <MilestoneDivider
                            milestoneId={group.milestoneId}
                            title={group.milestoneName}
                            status={group.milestoneStatus}
                            count={group.count}
                            onAddMilestone={() => onShowMilestoneManager(lane.projectId)}
                            onDragStart={(e) => group.milestoneId && onMilestoneDragStart(e, group.milestoneId)}
                            isDragging={dragMilestoneId === group.milestoneId}
                          />
                        )}
                        {!msCollapsed && renderMilestoneColumns(group, lane.projectId)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {swimlaneData.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-tertiary)' }}>{noTasksHint}</div>
        )}
      </div>
    );
  }

  // 项目看板视图（选中了具体项目）
  const currentLane = swimlaneData.find(l => l.projectId === currentProjectId);
  const groups = currentLane?.milestoneGroups || [];
  const hasMilestones = groups.length > 1 || groups[0]?.milestoneId !== null;

  if (!hasMilestones) {
    return (
      <div className="space-y-4 h-full">
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => onShowMilestoneManager(currentProjectId)}>
            <MilestoneIcon className="w-3.5 h-3.5" /> {milestoneTitle}
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4 h-full">
          {STATUS_COLUMNS.map(col => (
            <StatusColumnView
              key={col.key}
              col={col}
              columnTasks={tasksByStatus[col.key]}
              projectId={currentProjectId}
              isOver={isOverCol(col.key, currentProjectId, null)}
              isCollapsed={collapsedStatusColumns.has(col.key)}
              onToggleCollapse={() => onToggleStatusColumn(col.key)}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              dragHereLabel={dragHereLabel}
              renderCard={renderCard}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(group => {
        const msLaneId = `__project__ms__${group.milestoneId || '__none__'}`;
        const msCollapsed = collapsedLanes.has(msLaneId);
        return (
          <div
            key={msLaneId}
            onDragOver={(e) => { if (dragMilestoneId) e.preventDefault(); }}
            onDrop={(e) => { if (dragMilestoneId) onMilestoneDrop(e, currentProjectId, group.milestoneId); }}
          >
            <MilestoneDivider
              milestoneId={group.milestoneId}
              title={group.milestoneName}
              status={group.milestoneStatus}
              count={group.count}
              onAddMilestone={() => onShowMilestoneManager(currentProjectId)}
              onDragStart={(e) => group.milestoneId && onMilestoneDragStart(e, group.milestoneId)}
              isDragging={dragMilestoneId === group.milestoneId}
            />
            {!msCollapsed && renderMilestoneColumns(group, currentProjectId, 'p-4')}
          </div>
        );
      })}
    </div>
  );
}
