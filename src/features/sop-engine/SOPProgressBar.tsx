'use client';

import { useMemo, useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SOPStage, StageRecord, InputDef } from '@/db/schema';
import clsx from 'clsx';
import { Check, RotateCcw, SkipForward, Play, Palette, Send } from 'lucide-react';
import { Input, Textarea } from '@/shared/ui';
import { SOP_STAGE_CONFIG, getStageConfig } from '@/shared/lib/sop-config';

/** SOP 阶段操作参数 */
interface SOPStageAction {
  action: 'confirm' | 'reject' | 'skip' | 'start';
  sopInputs?: Record<string, string>;
}

interface SOPProgressBarProps {
  stages: SOPStage[];
  stageHistory: StageRecord[];
  currentStageId?: string | null;
  /** 紧凑模式（任务卡片用） */
  compact?: boolean;
  /** 展开模式（TaskDrawer 用） */
  expanded?: boolean;
  /** 模板名称 */
  templateName?: string;
  /** 阶段操作回调（sopInputs 为 input 阶段的用户填写数据） */
  onStageAction?: (params: SOPStageAction) => Promise<void>;
  /** render 阶段：打开 Content Studio 回调 */
  onOpenStudio?: (documentId: string) => void;
}

/**
 * SOP 进度条组件
 * - compact: 卡片内使用，只显示进度条 + 文字
 * - expanded: TaskDrawer 中使用，显示完整阶段列表 + 操作按钮
 */
function SOPProgressBar({
  stages,
  stageHistory,
  currentStageId,
  compact = false,
  expanded = false,
  templateName,
  onStageAction,
  onOpenStudio,
}: SOPProgressBarProps) {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // input 阶段的表单数据
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // 是否为 input 阶段且正在等待输入
  const isInputStage = useMemo(() => {
    const current = stages.find(s => s.id === currentStageId);
    const record = stageHistory.find(r => r.stageId === currentStageId);
    return current?.type === 'input' && record?.status === 'waiting_input';
  }, [stages, stageHistory, currentStageId]);

  // 当前 input 阶段的输入定义
  const currentInputDefs = useMemo((): InputDef[] => {
    if (!isInputStage) return [];
    const current = stages.find(s => s.id === currentStageId);
    return current?.requiredInputs || [];
  }, [isInputStage, stages, currentStageId]);

  // input 表单验证
  const isInputValid = useMemo(() => {
    if (!isInputStage) return true;
    return currentInputDefs.every(def => 
      !def.required || (inputValues[def.id] && inputValues[def.id].trim().length > 0)
    );
  }, [isInputStage, currentInputDefs, inputValues]);

  // 更新 input 值
  const handleInputChange = useCallback((defId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [defId]: value }));
  }, []);

  // 计算进度
  const { completedCount, totalCount, currentStage, currentRecord } = useMemo(() => {
    const total = stages.length;
    const completed = stageHistory.filter(
      r => r.status === 'completed' || r.status === 'skipped'
    ).length;
    const current = stages.find(s => s.id === currentStageId);
    const record = stageHistory.find(r => r.stageId === currentStageId);
    return { completedCount: completed, totalCount: total, currentStage: current, currentRecord: record };
  }, [stages, stageHistory, currentStageId]);

  // 获取阶段记录的状态
  const getStageStatus = (stageId: string): string => {
    const record = stageHistory.find(r => r.stageId === stageId);
    if (record) return record.status;
    if (stageId === currentStageId) return 'active';
    return 'pending';
  };

  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // 判断是否可执行操作
  const canConfirm = currentRecord && (currentRecord.status === 'waiting_confirm' || currentRecord.status === 'active' || currentRecord.status === 'waiting_input');
  const canReject = currentRecord && currentRecord.status === 'waiting_confirm';
  const canSkip = currentStage?.optional && currentRecord && currentRecord.status !== 'completed' && currentRecord.status !== 'skipped';
  const needsStart = !currentStageId || stageHistory.length === 0;

  // render 阶段的文档 ID
  const renderDocumentId = useMemo(() => {
    if (!currentStage || currentStage.type !== 'render') return null;
    const record = stageHistory.find(r => r.stageId === currentStageId);
    return record?.renderDocumentId || null;
  }, [currentStage, currentStageId, stageHistory]);

  // 执行操作
  const handleAction = async (action: 'confirm' | 'reject' | 'skip' | 'start') => {
    if (!onStageAction || actionLoading) return;
    setActionLoading(action);
    try {
      // input 阶段 confirm 时传递表单数据
      const sopInputs = (action === 'confirm' && isInputStage && Object.keys(inputValues).length > 0)
        ? inputValues : undefined;
      await onStageAction({ action, sopInputs });
      // 提交成功后清空表单
      if (sopInputs) setInputValues({});
    } catch (err) {
      console.error('[SOPProgressBar] 操作失败:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // 紧凑模式：进度条 + 当前阶段标签
  if (compact) {
    return (
      <div className="mt-2 ml-6">
        {/* SOP 模板名 */}
        {templateName && (
          <div className="text-[10px] mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
            SOP: {templateName}
          </div>
        )}
        {/* 进度条 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--surface-hover)' }}>
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {completedCount}/{totalCount}
          </span>
        </div>
        {/* 当前阶段状态 */}
        {currentStage && currentRecord && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', getStageConfig(currentRecord.status).dot)}
            />
            <span className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              {currentStage.label}
              {' · '}
              {t(getStageConfig(currentRecord.status).i18nKey)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 展开模式：完整阶段列表
  if (expanded) {
    return (
      <div>
        {/* 标题 + 进度 */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('sop.progress')} {totalCount > 0 && `(${completedCount}/${totalCount})`}
          </label>
          {templateName && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {templateName}
            </span>
          )}
        </div>

        {/* 进度条 */}
        {totalCount > 0 && (
          <div className="w-full h-1.5 rounded-full mb-3" style={{ background: 'var(--surface-hover)' }}>
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* 阶段列表 */}
        <div className="space-y-1">
          {stages.map((stage, index) => {
            const status = getStageStatus(stage.id);
            const colors = getStageConfig(status);
            const isCurrent = stage.id === currentStageId;
            const record = stageHistory.find(r => r.stageId === stage.id);

            return (
              <div
                key={stage.id}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                  isCurrent && colors.bg,
                )}
              >
                {/* 序号/状态图标 */}
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0',
                  status === 'completed' || status === 'skipped'
                    ? 'bg-emerald-500 text-white'
                    : status === 'failed'
                      ? 'bg-red-500 text-white'
                      : isCurrent
                        ? 'bg-primary-500 text-white'
                        : 'border'
                )}
                  style={!(status === 'completed' || status === 'skipped' || status === 'failed' || isCurrent)
                    ? { borderColor: 'var(--border)', color: 'var(--text-tertiary)' }
                    : undefined
                  }
                >
                  {status === 'completed' ? '✓' : status === 'skipped' ? '⊘' : status === 'failed' ? '✗' : index + 1}
                </div>

                {/* 阶段信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={clsx('text-xs font-medium truncate', isCurrent && colors.text)}
                      style={!isCurrent ? { color: status === 'completed' || status === 'skipped' ? 'var(--text-tertiary)' : 'var(--text-primary)' } : undefined}
                    >
                      {stage.label}
                    </span>
                    {/* 阶段类型标签 */}
                    <span className="text-[9px] px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                      {t(`sop.stageType${stage.type.charAt(0).toUpperCase() + stage.type.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any)}
                    </span>
                    {/* render 阶段标记 */}
                    {stage.type === 'render' && (
                      <Palette className="w-3 h-3 flex-shrink-0 text-violet-500" />
                    )}
                  </div>
                  {/* 当前阶段显示状态 + 产出预览 */}
                  {isCurrent && record && (
                    <span className={clsx('text-[10px]', colors.text)}>
                      {t(getStageConfig(record.status).i18nKey)}
                    </span>
                  )}
                  {/* 已完成阶段的产出摘要 */}
                  {record?.output && status === 'completed' && (
                    <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                      {record.output.slice(0, 80)}{record.output.length > 80 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input 阶段表单 */}
        {isInputStage && currentInputDefs.length > 0 && (
          <div className="mt-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {t('sop.stageWaitingInput')}
            </div>
            <div className="space-y-3">
              {currentInputDefs.map(def => (
                <div key={def.id}>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {def.label}
                    {def.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {def.type === 'textarea' ? (
                    <Textarea
                      value={inputValues[def.id] || ''}
                      onChange={e => handleInputChange(def.id, e.target.value)}
                      placeholder={def.placeholder || ''}
                      rows={3}
                      className="text-xs"
                    />
                  ) : def.type === 'select' && def.options ? (
                    <select
                      value={inputValues[def.id] || ''}
                      onChange={e => handleInputChange(def.id, e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">{def.placeholder || t('sop.selectCategory')}</option>
                      {def.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={inputValues[def.id] || ''}
                      onChange={e => handleInputChange(def.id, e.target.value)}
                      placeholder={def.placeholder || ''}
                      className="text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮区 */}
        {onStageAction && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            {needsStart ? (
              <button
                onClick={() => handleAction('start')}
                disabled={!!actionLoading}
                className={clsx(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  'bg-primary-500 text-white hover:bg-primary-600',
                  actionLoading && 'opacity-50'
                )}
              >
                <Play className="w-3 h-3" />
                {actionLoading === 'start' ? '...' : t('sop.advanceStage')}
              </button>
            ) : (
              <>
                {/* render 阶段：打开 Content Studio 按钮 */}
                {currentStage?.type === 'render' && renderDocumentId && onOpenStudio && (
                  <button
                    onClick={() => onOpenStudio(renderDocumentId)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      'bg-violet-500 text-white hover:bg-violet-600',
                    )}
                  >
                    <Palette className="w-3 h-3" />
                    {t('studio.openInStudio')}
                  </button>
                )}

                {/* 确认/提交按钮 */}
                {canConfirm && (
                  <button
                    onClick={() => handleAction('confirm')}
                    disabled={!!actionLoading || (isInputStage && !isInputValid)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      'bg-emerald-500 text-white hover:bg-emerald-600',
                      (actionLoading || (isInputStage && !isInputValid)) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isInputStage ? <Send className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    {actionLoading === 'confirm' ? '...' : isInputStage ? t('sop.submitInput') : t('sop.confirmStage')}
                  </button>
                )}

                {/* 驳回按钮 */}
                {canReject && (
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={!!actionLoading}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900',
                      actionLoading && 'opacity-50'
                    )}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {actionLoading === 'reject' ? '...' : t('sop.rejectStage')}
                  </button>
                )}

                {/* 跳过按钮 */}
                {canSkip && (
                  <button
                    onClick={() => handleAction('skip')}
                    disabled={!!actionLoading}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      actionLoading && 'opacity-50'
                    )}
                    style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                  >
                    <SkipForward className="w-3 h-3" />
                    {actionLoading === 'skip' ? '...' : t('sop.skipStage')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // 默认模式
  return null;
}

export default memo(SOPProgressBar);
