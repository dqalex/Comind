'use client';

import { useState, useMemo, useCallback } from 'react';
import { useGatewayStore } from '@/core/gateway/store';
import { useDocumentStore } from '@/domains';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { CronJob, CronSchedule, CronPayload, CronDelivery } from '@/types';

// --- 类型定义 ---
export type ScheduleKind = 'every' | 'cron';
export type PayloadKind = 'agentTurn' | 'systemEvent';
export type DeliveryMode = 'announce' | 'webhook' | 'none';

export const defaultForm = {
  name: '',
  agentId: '' as string,
  scheduleKind: 'cron' as ScheduleKind,
  everySeconds: '60',
  expr: '0 8 * * *',
  tz: '',
  sessionTarget: 'main' as 'main' | 'isolated',
  wakeMode: 'now' as 'now' | 'next-heartbeat',
  payloadKind: 'agentTurn' as PayloadKind,
  payloadMessage: '',
  payloadText: '',
  payloadThinking: 'low',
  payloadTimeoutSeconds: '120',
  deliveryMode: 'announce' as DeliveryMode,
  deliveryChannel: '',
  deliveryWebhook: '',
};

export type ScheduleFormData = typeof defaultForm;

// --- 工具函数 ---
export function formatSchedule(schedule: CronSchedule, t: (key: string, options?: Record<string, unknown>) => string): string {
  switch (schedule.kind) {
    case 'every': return t('agents.every', { sec: ((schedule.everyMs || 60000) / 1000).toFixed(0) });
    case 'at': return t('agents.scheduledAt', { at: schedule.at || '-' });
    case 'cron': return `${schedule.expr || '-'}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    default: return '-';
  }
}

export function formatPayload(payload: CronPayload): string {
  switch (payload.kind) {
    case 'agentTurn': return `Agent: ${payload.message?.slice(0, 40) || '-'}`;
    case 'systemEvent': return `Event: ${payload.text?.slice(0, 40) || '-'}`;
    default: return '-';
  }
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// --- 表单数据 → API 数据转换 ---
function buildScheduleFromForm(form: ScheduleFormData): CronSchedule {
  return form.scheduleKind === 'every'
    ? { kind: 'every', everyMs: parseInt(form.everySeconds) * 1000 }
    : { kind: 'cron', expr: form.expr, tz: form.tz || undefined };
}

function buildPayloadFromForm(form: ScheduleFormData): CronPayload {
  return form.payloadKind === 'agentTurn'
    ? { kind: 'agentTurn', message: form.payloadMessage, thinking: form.payloadThinking, timeoutSeconds: parseInt(form.payloadTimeoutSeconds) || 120 }
    : { kind: 'systemEvent', text: form.payloadText };
}

function buildDeliveryFromForm(form: ScheduleFormData): CronDelivery {
  return {
    mode: form.deliveryMode,
    ...(form.deliveryMode === 'announce' && form.deliveryChannel ? { channel: form.deliveryChannel } : {}),
  };
}

// --- 主 Hook ---
export function useSchedulePage() {
  const {
    cronJobs, cronRuns, agentsList,
    createCronJob, updateCronJob, toggleCronJob, runCronJob, deleteCronJob, fetchCronRuns,
    refreshCronJobs,
  } = useGatewayStore();
  const { documents } = useDocumentStore();

  // UI 状态
  const [showCreate, setShowCreate] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [showRunsJobId, setShowRunsJobId] = useState<string | null>(null);
  const deleteAction = useConfirmAction<string>();
  const [form, setForm] = useState(defaultForm);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editForm, setEditForm] = useState(defaultForm);

  // Escape key 关闭对话框
  useEscapeKey(showCreate, useCallback(() => setShowCreate(false), []));
  useEscapeKey(!!editingJob, useCallback(() => setEditingJob(null), []));

  // 派生数据
  const enabledJobs = useMemo(() => cronJobs.filter(j => j.enabled), [cronJobs]);
  const disabledJobs = useMemo(() => cronJobs.filter(j => !j.enabled), [cronJobs]);

  const nextWakeJob = useMemo(() => {
    const withNext = cronJobs.filter(j => j.enabled && j.state?.nextRunAtMs && j.state.nextRunAtMs > 0);
    if (withNext.length === 0) return null;
    return withNext.reduce((a, b) => (a.state?.nextRunAtMs || Infinity) < (b.state?.nextRunAtMs || Infinity) ? a : b);
  }, [cronJobs]);

  // 事件处理
  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) return;
    await createCronJob({
      name: form.name.trim(),
      agentId: form.agentId || undefined,
      schedule: buildScheduleFromForm(form),
      sessionTarget: form.sessionTarget,
      wakeMode: form.wakeMode,
      payload: buildPayloadFromForm(form),
      delivery: buildDeliveryFromForm(form),
    });
    setForm(defaultForm);
    setShowCreate(false);
  }, [form, createCronJob]);

  const handleToggleRuns = useCallback(async (jobId: string) => {
    if (showRunsJobId === jobId) {
      setShowRunsJobId(null);
      return;
    }
    setShowRunsJobId(jobId);
    await fetchCronRuns(jobId);
  }, [showRunsJobId, fetchCronRuns]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCronJob(id);
  }, [deleteCronJob]);

  const handleEditOpen = useCallback((job: CronJob) => {
    setEditingJob(job);
    setEditForm({
      name: job.name,
      agentId: job.agentId || '',
      scheduleKind: job.schedule.kind === 'every' ? 'every' : 'cron',
      everySeconds: job.schedule.kind === 'every' ? String((job.schedule.everyMs || 60000) / 1000) : '60',
      expr: job.schedule.kind === 'cron' ? (job.schedule.expr || '0 8 * * *') : '0 8 * * *',
      tz: job.schedule.tz || '',
      sessionTarget: (job.sessionTarget as 'main' | 'isolated') || 'main',
      wakeMode: (job.wakeMode as 'now' | 'next-heartbeat') || 'now',
      payloadKind: job.payload.kind as PayloadKind,
      payloadMessage: job.payload.message || '',
      payloadText: job.payload.text || '',
      payloadThinking: job.payload.thinking || 'low',
      payloadTimeoutSeconds: String(job.payload.timeoutSeconds || 120),
      deliveryMode: (job.delivery?.mode as DeliveryMode) || 'announce',
      deliveryChannel: job.delivery?.channel || '',
      deliveryWebhook: '',
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingJob || !editForm.name.trim()) return;
    await updateCronJob(editingJob.id, {
      name: editForm.name.trim(),
      agentId: editForm.agentId || undefined,
      schedule: buildScheduleFromForm(editForm),
      sessionTarget: editForm.sessionTarget,
      wakeMode: editForm.wakeMode,
      payload: buildPayloadFromForm(editForm),
      delivery: buildDeliveryFromForm(editForm),
    });
    setEditingJob(null);
    await refreshCronJobs();
  }, [editingJob, editForm, updateCronJob, refreshCronJobs]);

  const toggleExpand = useCallback((jobId: string) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId);
  }, []);

  return {
    // 数据
    cronJobs, cronRuns, agentsList, documents,
    enabledJobs, disabledJobs, nextWakeJob,
    // UI 状态
    showCreate, setShowCreate,
    expandedJobId, toggleExpand,
    showRunsJobId, handleToggleRuns,
    deleteAction,
    form, setForm,
    editingJob, setEditingJob,
    editForm, setEditForm,
    // 操作
    handleCreate, handleDelete, handleEditOpen, handleEditSave,
    toggleCronJob, runCronJob, refreshCronJobs,
  };
}
