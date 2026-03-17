/**
 * useTaskSOP Hook
 * 
 * 处理任务的 SOP 模板关联和阶段推进逻辑
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTaskStore, useSOPTemplateStore, useTaskLogStore } from '@/domains';
import type { Task } from '@/db/schema';

interface UseTaskSOPOptions {
  task: Task;
  currentUserId?: string;
  onTaskUpdate?: () => void;
  onClose?: () => void;
}

interface SOPStageAction {
  action: 'confirm' | 'reject' | 'skip' | 'start';
  sopInputs?: Record<string, string>;
}

export function useTaskSOP({ task, currentUserId, onTaskUpdate, onClose }: UseTaskSOPOptions) {
  const router = useRouter();
  const updateTaskAsync = useTaskStore((s) => s.updateTaskAsync);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const sopTemplates = useSOPTemplateStore((s) => s.templates);
  const createLog = useTaskLogStore((s) => s.createLog);

  // 活跃 SOP 模板
  const activeSopTemplates = useMemo(() =>
    sopTemplates.filter(tpl => tpl.status === 'active'),
    [sopTemplates]
  );

  // 当前关联的模板
  const currentTemplate = useMemo(() =>
    task.sopTemplateId ? sopTemplates.find(t => t.id === task.sopTemplateId) : null,
    [task.sopTemplateId, sopTemplates]
  );

  // 阶段历史
  const stageHistory = useMemo(() =>
    Array.isArray(task.stageHistory) ? task.stageHistory : [],
    [task.stageHistory]
  );

  // SOP 模板关联/取消关联
  const handleSopTemplateChange = useCallback(async (templateId: string) => {
    const oldTpl = task.sopTemplateId ? sopTemplates.find(t => t.id === task.sopTemplateId) : null;
    
    if (templateId) {
      // 关联 SOP 模板：设置第一阶段为当前阶段，清空历史
      const tpl = sopTemplates.find(t => t.id === templateId);
      const firstStageId = tpl?.stages?.[0]?.id || null;
      await updateTaskAsync(task.id, {
        sopTemplateId: templateId,
        currentStageId: firstStageId,
        stageHistory: [],
        sopInputs: null,
      });
      createLog({
        taskId: task.id,
        action: 'SOP 关联',
        message: `${oldTpl?.name || '无'} → ${tpl?.name || templateId}`
      });
    } else {
      // 取消关联：清空所有 SOP 字段
      await updateTaskAsync(task.id, {
        sopTemplateId: null,
        currentStageId: null,
        stageHistory: [],
        sopInputs: null,
      });
      createLog({
        taskId: task.id,
        action: 'SOP 取消关联',
        message: `${oldTpl?.name || '未知'} → 无`
      });
    }
    
    await fetchTasks();
    onTaskUpdate?.();
  }, [task.id, task.sopTemplateId, sopTemplates, updateTaskAsync, createLog, fetchTasks, onTaskUpdate]);

  // SOP 阶段操作回调
  const handleSopAction = useCallback(async ({ action, sopInputs }: SOPStageAction) => {
    const res = await fetch(`/api/tasks/${task.id}/sop-advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        confirmedBy: currentUserId || 'human',
        sopInputs
      }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '操作失败' }));
      console.error('SOP action failed:', err.error);
    }
    
    await fetchTasks();
    onTaskUpdate?.();
  }, [task.id, fetchTasks, currentUserId, onTaskUpdate]);

  // render 阶段：跳转到 Wiki Content Studio 编辑
  const handleOpenStudio = useCallback((documentId: string) => {
    router.push(`/wiki?doc=${documentId}`);
    onClose?.();
  }, [router, onClose]);

  return {
    activeSopTemplates,
    currentTemplate,
    stageHistory,
    handleSopTemplateChange,
    handleSopAction,
    handleOpenStudio,
  };
}
