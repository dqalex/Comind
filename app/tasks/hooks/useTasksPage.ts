'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import { useTaskStore, useProjectStore, useMemberStore, useTaskLogStore, useMilestoneStore, useSOPTemplateStore, useChatStore } from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import { useAuthStore } from '@/domains/auth';
import type { Task, Milestone } from '@/db/schema';

export type ViewMode = 'board' | 'list';
export type StatusColumn = 'todo' | 'in_progress' | 'reviewing' | 'completed';

export function useTasksPage() {
  const { t } = useTranslation();
  const { tasks, createTask, updateTaskAsync, deleteTaskAsync, error, setError } = useTaskStore();
  const { projects, currentProjectId } = useProjectStore();
  const { members } = useMemberStore();
  const { milestones } = useMilestoneStore();
  const { templates: sopTemplates } = useSOPTemplateStore();
  // v0.9.8 多用户：获取用户专用会话键（注意：不在组件级别缓存，而是在函数调用时实时计算）
  const { connected, connectionMode, serverProxyConnected, getUserSessionKey } = useGatewayStore();
  const gwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;
  const authUser = useAuthStore((s) => s.user);
  
  const { openChatWithMessage } = useChatStore();
  const { createLog } = useTaskLogStore();
  const { updateMilestoneAsync } = useMilestoneStore();

  const STATUS_COLUMNS: { key: StatusColumn; label: string; color: string }[] = useMemo(() => [
    { key: 'todo', label: t('tasks.todo'), color: 'bg-slate-400' },
    { key: 'in_progress', label: t('tasks.inProgress'), color: 'bg-blue-500' },
    { key: 'reviewing', label: t('tasks.reviewing'), color: 'bg-amber-500' },
    { key: 'completed', label: t('tasks.completed'), color: 'bg-emerald-500' },
  ], [t]);

  const PRIORITY_MAP: Record<string, { label: string; class: string }> = useMemo(() => ({
    high: { label: t('tasks.high'), class: 'priority-high' },
    medium: { label: t('tasks.medium'), class: 'priority-medium' },
    low: { label: t('tasks.low'), class: 'priority-low' },
  }), [t]);

  // UI 状态
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'local' | 'openclaw'>('all');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', projectId: '', priority: 'medium' as 'high' | 'medium' | 'low', assigneeId: '', milestoneId: '', sopTemplateId: '' });
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 拖拽
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragMilestoneId, setDragMilestoneId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ col: StatusColumn; projectId: string | null; milestoneId: string | null } | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [collapsedStatusColumns, setCollapsedStatusColumns] = useState<Set<StatusColumn>>(new Set());
  const deleteAction = useConfirmAction<string>();

  // 里程碑管理
  const [showMilestoneManager, setShowMilestoneManager] = useState<string | null>(null);

  // 多选
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const pushErrorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectionMode = selectedTaskIds.size > 0;

  // 快速创建
  const [showQuickInput, setShowQuickInput] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [showBatchStatusMenu, setShowBatchStatusMenu] = useState(false);

  // Escape key
  useEscapeKey(showNewTaskDialog, useCallback(() => setShowNewTaskDialog(false), []));

  // 抽屉任务（从 store 实时获取避免 stale）
  const drawerTask = useMemo(() => {
    if (!drawerTaskId) return null;
    return tasks.find(t => t.id === drawerTaskId) || null;
  }, [drawerTaskId, tasks]);

  // 右键菜单 outside-click
  useEffect(() => {
    if (!menuTaskId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuTaskId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuTaskId]);

  // 错误自动清除
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // 清理 pushErrorTimerRef
  useEffect(() => {
    return () => {
      if (pushErrorTimerRef.current) clearTimeout(pushErrorTimerRef.current);
    };
  }, []);

  // --- 拖拽 ---
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    setDragMilestoneId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleMilestoneDragStart = useCallback((e: React.DragEvent, milestoneId: string) => {
    setDragMilestoneId(milestoneId);
    setDragTaskId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('milestoneId', milestoneId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId: string | null = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ col, projectId, milestoneId });
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverTarget(null); }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId: string | null = null) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId;
    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updates: Partial<Task> = {};
        if (task.status !== col) updates.status = col;
        if ((task.projectId || null) !== projectId) updates.projectId = projectId || undefined;
        if ((task.milestoneId || null) !== milestoneId) updates.milestoneId = milestoneId || undefined;
        if (col === 'completed' && task.progress !== 100) updates.progress = 100;
        if (Object.keys(updates).length > 0) await updateTaskAsync(taskId, updates);
      }
    }
    setDragTaskId(null);
    setDragMilestoneId(null);
    setDragOverTarget(null);
  }, [dragTaskId, tasks, updateTaskAsync]);

  const handleMilestoneDrop = useCallback(async (e: React.DragEvent, projectId: string | null, targetMilestoneId: string | null) => {
    e.preventDefault();
    const draggedMilestoneId = e.dataTransfer.getData('milestoneId');
    if (!draggedMilestoneId || draggedMilestoneId === targetMilestoneId) return;
    const projectMs = milestones.filter(m => m.projectId === projectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const dragIndex = projectMs.findIndex(m => m.id === draggedMilestoneId);
    if (dragIndex === -1) return;
    const targetIndex = targetMilestoneId ? projectMs.findIndex(m => m.id === targetMilestoneId) : projectMs.length;
    const newMs = [...projectMs];
    const [removed] = newMs.splice(dragIndex, 1);
    newMs.splice(targetIndex, 0, removed);
    await Promise.all(newMs.map((m, idx) => m.sortOrder !== idx ? updateMilestoneAsync(m.id, { sortOrder: idx }) : Promise.resolve()));
    setDragMilestoneId(null);
  }, [milestones, updateMilestoneAsync]);

  // --- 数据 ---
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (currentProjectId) result = result.filter(t => t.projectId === currentProjectId);
    if (filterPriority !== 'all') result = result.filter(t => t.priority === filterPriority);
    if (filterSource !== 'all') result = result.filter(t => t.source === filterSource);
    return result;
  }, [tasks, currentProjectId, filterPriority, filterSource]);

  const sourceCounts = useMemo(() => ({
    all: tasks.length,
    local: tasks.filter(t => t.source === 'local').length,
    openclaw: tasks.filter(t => t.source === 'openclaw').length,
  }), [tasks]);

  type MilestoneGroup = {
    milestoneId: string | null;
    milestoneName: string;
    milestoneStatus?: string;
    tasks: Record<StatusColumn, Task[]>;
    count: number;
  };

  const swimlaneData = useMemo(() => {
    const lanes: { projectId: string | null; projectName: string; milestoneGroups: MilestoneGroup[]; count: number }[] = [];
    const projectMap = new Map<string | null, Task[]>();
    for (const task of filteredTasks) {
      const pid = task.projectId || null;
      if (!projectMap.has(pid)) projectMap.set(pid, []);
      projectMap.get(pid)!.push(task);
    }

    const groupByMilestone = (projectTasks: Task[], projectId: string | null): MilestoneGroup[] => {
      const groups: MilestoneGroup[] = [];
      const msMap = new Map<string | null, Task[]>();
      for (const task of projectTasks) {
        const mid = task.milestoneId || null;
        if (!msMap.has(mid)) msMap.set(mid, []);
        msMap.get(mid)!.push(task);
      }
      const projectMilestones = milestones.filter(m => m.projectId === projectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (const ms of projectMilestones) {
        const msTasks = msMap.get(ms.id) || [];
        if (msTasks.length === 0 && !currentProjectId) continue;
        const byStatus: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
        for (const t of msTasks) { if (byStatus[t.status as StatusColumn]) byStatus[t.status as StatusColumn].push(t); }
        groups.push({ milestoneId: ms.id, milestoneName: ms.title, milestoneStatus: ms.status ?? undefined, tasks: byStatus, count: msTasks.length });
        msMap.delete(ms.id);
      }
      const unassigned = msMap.get(null) || [];
      if (unassigned.length > 0 || currentProjectId || groups.length === 0) {
        const byStatus: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
        for (const t of unassigned) { if (byStatus[t.status as StatusColumn]) byStatus[t.status as StatusColumn].push(t); }
        groups.push({ milestoneId: null, milestoneName: t('milestones.unassigned'), tasks: byStatus, count: unassigned.length });
      }
      return groups;
    };

    for (const project of projects) {
      if (currentProjectId && project.id !== currentProjectId) continue;
      const projectTasks = projectMap.get(project.id) || [];
      lanes.push({ projectId: project.id, projectName: project.name, milestoneGroups: groupByMilestone(projectTasks, project.id), count: projectTasks.length });
      projectMap.delete(project.id);
    }
    const uncategorized = projectMap.get(null) || [];
    if (uncategorized.length > 0 || !currentProjectId) {
      lanes.push({ projectId: null, projectName: t('tasks.uncategorized'), milestoneGroups: groupByMilestone(uncategorized, null), count: uncategorized.length });
    }
    return lanes;
  }, [filteredTasks, projects, milestones, currentProjectId, t]);

  const tasksByStatus = useMemo(() => {
    const map: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
    for (const t of filteredTasks) { if (map[t.status as StatusColumn]) map[t.status as StatusColumn].push(t); }
    return map;
  }, [filteredTasks]);

  // --- 创建 ---
  const handleQuickCreate = useCallback(async (title: string) => {
    if (!title.trim()) return;
    await createTask({ title: title.trim(), projectId: currentProjectId || undefined, status: 'todo', priority: 'medium', assignees: [], creatorId: 'system' });
    setQuickTitle('');
  }, [createTask, currentProjectId]);

  const handleCreateTask = useCallback(async () => {
    if (!newTask.title.trim()) return;
    let projectId: string | undefined;
    if (newTask.projectId !== undefined) projectId = newTask.projectId || undefined;
    else projectId = currentProjectId || undefined;
    const selectedSopTemplate = newTask.sopTemplateId ? sopTemplates.find(t => t.id === newTask.sopTemplateId) : null;
    const firstStageId = selectedSopTemplate?.stages?.[0]?.id;
    await createTask({
      title: newTask.title.trim(), projectId, priority: newTask.priority || 'medium',
      assignees: newTask.assigneeId ? [newTask.assigneeId] : [],
      milestoneId: newTask.milestoneId || undefined, status: 'todo', creatorId: 'system',
      sopTemplateId: newTask.sopTemplateId || undefined, currentStageId: firstStageId,
    });
    setNewTask({ title: '', projectId: '', priority: 'medium', assigneeId: '', milestoneId: '', sopTemplateId: '' });
    setShowNewTaskDialog(false);
  }, [newTask, currentProjectId, createTask, sopTemplates]);

  // --- 状态变更 ---
  const handleStatusChange = useCallback(async (taskId: string, newStatus: StatusColumn) => {
    const task = tasks.find(t => t.id === taskId);
    const oldLabel = STATUS_COLUMNS.find(s => s.key === task?.status)?.label || task?.status || '';
    const newLabel = STATUS_COLUMNS.find(s => s.key === newStatus)?.label || newStatus;
    await updateTaskAsync(taskId, { status: newStatus });
    createLog({ taskId, action: t('tasks.statusChange'), message: `${oldLabel} → ${newLabel}` });
  }, [tasks, STATUS_COLUMNS, updateTaskAsync, createLog, t]);

  const getMemberName = useCallback((assignees?: string[] | null) => {
    if (!assignees || assignees.length === 0) return null;
    return members.find(m => m.id === assignees[0]);
  }, [members]);

  const toggleLane = useCallback((laneId: string) => {
    setCollapsedLanes(prev => { const next = new Set(prev); if (next.has(laneId)) { next.delete(laneId); } else { next.add(laneId); } return next; });
  }, []);

  const toggleStatusColumn = useCallback((col: StatusColumn) => {
    setCollapsedStatusColumns(prev => { const next = new Set(prev); if (next.has(col)) { next.delete(col); } else { next.add(col); } return next; });
  }, []);

  // --- 多选操作 ---
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => { const next = new Set(prev); if (next.has(taskId)) { next.delete(taskId); } else { next.add(taskId); } return next; });
  }, []);

  const selectAllVisible = useCallback(() => { setSelectedTaskIds(new Set(filteredTasks.map(t => t.id))); }, [filteredTasks]);
  const clearSelection = useCallback(() => { setSelectedTaskIds(new Set()); }, []);

  // v0.9.8 多用户：批量推送使用用户专用会话键
  const handleBatchPush = useCallback(async () => {
    // v0.9.8 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;

    if (!gwConnected || !userSessionKey || selectedTaskIds.size === 0) return;
    setPushing(true);
    try {
      const res = await fetch('/api/task-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskIds: Array.from(selectedTaskIds), sessionKey: userSessionKey }) });
      const json = await res.json();
      setPushing(false);
      clearSelection();
      if (res.ok && json.success) {
        // v0.9.8 多用户：传入用户专用会话键
        openChatWithMessage(json.data.message, { sessionKey: userSessionKey });
      } else {
        setPushError(json.error || 'Batch push failed');
        if (pushErrorTimerRef.current) clearTimeout(pushErrorTimerRef.current);
        pushErrorTimerRef.current = setTimeout(() => setPushError(null), 5000);
      }
    } catch (e) {
      setPushing(false);
      clearSelection();
      setPushError(e instanceof Error ? e.message : 'Batch push failed');
      if (pushErrorTimerRef.current) clearTimeout(pushErrorTimerRef.current);
      pushErrorTimerRef.current = setTimeout(() => setPushError(null), 5000);
    }
  }, [gwConnected, authUser, getUserSessionKey, selectedTaskIds, openChatWithMessage, clearSelection]);

  const handleBatchStatusChange = useCallback(async (newStatus: StatusColumn) => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const newLabel = STATUS_COLUMNS.find(s => s.key === newStatus)?.label || newStatus;
    await Promise.all(ids.map(async (id) => {
      const task = tasks.find(t => t.id === id);
      const oldLabel = STATUS_COLUMNS.find(s => s.key === task?.status)?.label || task?.status || '';
      await updateTaskAsync(id, { status: newStatus });
      createLog({ taskId: id, action: t('tasks.statusChange'), message: `${oldLabel} → ${newLabel}` });
    }));
    clearSelection();
  }, [selectedTaskIds, tasks, updateTaskAsync, createLog, clearSelection, STATUS_COLUMNS, t]);

  const batchDeleteConfirm = useConfirmAction<boolean>();
  const handleBatchDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    await Promise.all(Array.from(selectedTaskIds).map(id => deleteTaskAsync(id)));
    clearSelection();
  }, [selectedTaskIds, deleteTaskAsync, clearSelection]);

  const isSwimLaneView = !currentProjectId;

  return {
    t,
    // Store 数据
    tasks, projects, members, milestones, sopTemplates,
    currentProjectId, gwConnected,
    error,
    // 配置
    STATUS_COLUMNS, PRIORITY_MAP,
    // UI 状态
    viewMode, setViewMode,
    filterPriority, setFilterPriority,
    filterSource, setFilterSource,
    sourceCounts,
    // 新建
    showNewTaskDialog, setShowNewTaskDialog,
    newTask, setNewTask,
    handleCreateTask,
    showQuickInput, setShowQuickInput,
    quickInputRef, quickTitle, setQuickTitle,
    handleQuickCreate,
    // 菜单
    menuTaskId, setMenuTaskId,
    menuPosition, setMenuPosition,
    menuRef,
    // 抽屉
    drawerTaskId, setDrawerTaskId, drawerTask,
    // 里程碑
    showMilestoneManager, setShowMilestoneManager,
    // 拖拽
    dragTaskId, dragMilestoneId, dragOverTarget,
    handleDragStart, handleMilestoneDragStart, handleDragOver, handleDragLeave, handleDrop, handleMilestoneDrop,
    // 折叠
    collapsedLanes, toggleLane,
    collapsedStatusColumns, toggleStatusColumn,
    // 删除
    deleteAction, deleteTaskAsync,
    // 数据
    filteredTasks, swimlaneData, tasksByStatus,
    isSwimLaneView,
    // 状态变更
    handleStatusChange, getMemberName,
    // 多选
    selectedTaskIds, selectionMode,
    toggleTaskSelection, selectAllVisible, clearSelection,
    pushing, pushError, setPushError,
    handleBatchPush, handleBatchStatusChange,
    batchDeleteConfirm, handleBatchDelete,
    showBatchStatusMenu, setShowBatchStatusMenu,
  };
}
