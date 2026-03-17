'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeliveryStore, useMemberStore, useTaskStore, useProjectStore, useGatewayStore } from '@/domains';
import { useAuthStore } from '@/domains/auth';
import { Button, Textarea } from '@/components/ui';
import type { Document } from '@/db/schema';
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ClipboardList,
  ExternalLink,
  FileCheck,
  User,
  Hash,
} from 'lucide-react';
import clsx from 'clsx';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { formatRelativeTime } from '@/hooks/useRelativeTime';
import { getActiveGwClient } from '@/components/chat/chat-utils';

interface DeliveryStatusCardProps {
  document: Document;
}

/**
 * 解析文档 Front Matter 中的交付字段
 */
function parseDeliveryFrontmatter(content: string): {
  delivery_status?: 'pending' | 'approved' | 'rejected' | 'revision_needed';
  delivery_assignee?: string;
  delivery_platform?: string;
  delivery_version?: number;
  delivery_reviewer?: string;
  delivery_comment?: string;
} {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter = frontmatterMatch[1];
  const result: Record<string, string | number | undefined> = {};

  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      let value: string | number | undefined = keyMatch[2].trim();

      if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      if (value === 'true') value = true as unknown as string;
      if (value === 'false') value = false as unknown as string;

      if (key.startsWith('delivery_')) {
        result[key] = value;
      }
    }
  }

  return result as ReturnType<typeof parseDeliveryFrontmatter>;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800/50',
    dotColor: 'bg-yellow-400',
  },
  approved: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800/50',
    dotColor: 'bg-green-400',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800/50',
    dotColor: 'bg-red-400',
  },
  revision_needed: {
    icon: RefreshCw,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800/50',
    dotColor: 'bg-orange-400',
  },
} as const;

export default function DeliveryStatusCard({ document }: DeliveryStatusCardProps) {
  const { t, i18n } = useTranslation();
  // 精确 selector 订阅
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const updateDeliveryAsync = useDeliveryStore((s) => s.updateDeliveryAsync);
  
  const getHumanMembers = useMemberStore((s) => s.getHumanMembers);
  const members = useMemberStore((s) => s.members);
  
  const tasks = useTaskStore((s) => s.tasks);
  
  const projects = useProjectStore((s) => s.projects);
  
  // v3.0 多用户：获取用户专用会话键
  const authUser = useAuthStore((s) => s.user);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);
  const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;
  
  const humanMembers = useMemo(() => getHumanMembers(), [getHumanMembers]);

  const [expanded, setExpanded] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | 'revision_needed'>('approved');
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 解析 Front Matter 中的交付字段
  const deliveryFields = useMemo(() => {
    if (!document.content || typeof document.content !== 'string') return null;
    return parseDeliveryFrontmatter(document.content);
  }, [document.content]);

  // 查找关联的交付记录（delivery 表）
  const linkedDelivery = useMemo(() => {
    return deliveries.find(d => d.documentId === document.id);
  }, [deliveries, document.id]);

  // 双重触发条件：Front Matter 有 delivery_status 或 delivery 表有记录
  const effectiveStatus = deliveryFields?.delivery_status || (linkedDelivery?.status as keyof typeof STATUS_CONFIG) || null;

  // 关联上下文（与交付中心弹窗一致）
  const deliveryContext = useMemo(() => {
    if (!linkedDelivery) return { task: null, project: null, assignee: null, reviewer: null };
    const task = linkedDelivery.taskId ? tasks.find(t => t.id === linkedDelivery.taskId) : null;
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    const assignee = linkedDelivery.memberId ? members.find(m => m.id === linkedDelivery.memberId) : null;
    const reviewer = linkedDelivery.reviewerId ? members.find(m => m.id === linkedDelivery.reviewerId) : null;
    return { task, project, assignee, reviewer };
  }, [linkedDelivery, tasks, projects, members]);

  // 审核提交
  const handleReview = useCallback(async () => {
    if (!linkedDelivery || submitting) return;
    setSubmitting(true);
    try {
      // v3.0 多用户：使用用户专用会话键通知 AI
      const result = await updateDeliveryAsync(linkedDelivery.id, {
        status: reviewStatus,
        reviewComment: reviewComment || null,
        reviewedAt: new Date(),
        reviewerId: humanMembers[0]?.id,
      }, userSessionKey ? { _gatewaySessionKey: userSessionKey } : undefined);

      // 审核成功后，通过 Gateway 信道发送通知给 AI
      if (result.success && result.notifyData) {
        const gwClient = getActiveGwClient();
        if (gwClient) {
          try {
            await gwClient.sendChatMessage({
              sessionKey: result.notifyData.sessionKey,
              message: result.notifyData.message,
              idempotencyKey: `review-notify-${linkedDelivery.id}-${Date.now()}`,
            });
          } catch (e) {
            console.error('[DeliveryStatusCard] Failed to send review notification:', e);
          }
        }
      }

      setShowReviewForm(false);
      setReviewComment('');
    } finally {
      setSubmitting(false);
    }
  }, [linkedDelivery, reviewStatus, reviewComment, updateDeliveryAsync, humanMembers, submitting]);

  useEscapeKey(showReviewForm, useCallback(() => setShowReviewForm(false), []));

  // 所有 hooks 已调用完毕，以下可以条件性 return
  if (!effectiveStatus) return null;

  const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const isPending = effectiveStatus === 'pending';
  const hasReviewComment = linkedDelivery?.reviewComment || deliveryFields?.delivery_comment;
  const reviewCommentText = linkedDelivery?.reviewComment || deliveryFields?.delivery_comment || '';

  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      {/* 折叠头部 - 状态摘要栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'w-full px-6 py-2.5 flex items-center gap-3 transition-colors hover:opacity-90',
          config.bgColor,
        )}
      >
        {/* 展开/收起指示器 */}
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        }

        {/* 状态图标 + 标签 */}
        <div className="flex items-center gap-1.5">
          <StatusIcon className={clsx('w-4 h-4', config.color)} />
          <span className={clsx('text-xs font-semibold', config.color)}>
            {t(`deliveries.${effectiveStatus === 'revision_needed' ? 'revisionNeeded' : effectiveStatus}`)}
          </span>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-3.5 bg-black/10 dark:bg-white/10" />

        {/* 交付者 */}
        {(deliveryContext.assignee || deliveryFields?.delivery_assignee) && (
          <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <User className="w-3 h-3" />
            <span>{deliveryContext.assignee?.name || deliveryFields?.delivery_assignee}</span>
          </div>
        )}

        {/* 关联项目 */}
        {deliveryContext.project && (
          <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <FolderKanban className="w-3 h-3" />
            <span>{deliveryContext.project.name}</span>
          </div>
        )}

        {/* 版本 */}
        {(linkedDelivery?.version || deliveryFields?.delivery_version) && (
          <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            <Hash className="w-3 h-3" />
            <span>v{linkedDelivery?.version || deliveryFields?.delivery_version}</span>
          </div>
        )}

        {/* 右侧：审核时间 + 快速审核按钮 */}
        <div className="ml-auto flex items-center gap-2">
          {linkedDelivery?.reviewedAt && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {formatRelativeTime(linkedDelivery.reviewedAt, i18n.language)}
            </span>
          )}
          {isPending && linkedDelivery && (
            <span className={clsx(
              'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
            )}>
              <FileCheck className="w-3 h-3" />
              {t('deliveries.reviewDoc')}
            </span>
          )}
        </div>
      </button>

      {/* 展开区域 */}
      {expanded && (
        <div className={clsx('px-6 py-4 space-y-4', config.bgColor, 'bg-opacity-50 dark:bg-opacity-10')}>

          {/* 上下文信息卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 关联项目 */}
            {deliveryContext.project && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--primary-500)' }} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.linkedProject')}</div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{deliveryContext.project.name}</div>
                </div>
              </div>
            )}

            {/* 关联任务 */}
            {deliveryContext.task && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.linkedTask')}</div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{deliveryContext.task.title}</div>
                </div>
              </div>
            )}

            {/* 交付者 */}
            {(deliveryContext.assignee || deliveryFields?.delivery_assignee) && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.assignee', { defaultValue: 'Assignee' })}</div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{deliveryContext.assignee?.name || deliveryFields?.delivery_assignee}</div>
                </div>
              </div>
            )}

            {/* 审核人（已审核时显示） */}
            {(deliveryContext.reviewer || deliveryFields?.delivery_reviewer) && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.reviewer')}</div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{deliveryContext.reviewer?.name || deliveryFields?.delivery_reviewer}</div>
                </div>
              </div>
            )}
          </div>

          {/* 外部链接 */}
          {linkedDelivery?.externalUrl && (
            <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)' }}>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-primary-500" />
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.externalLink')}</div>
                <a
                  href={linkedDelivery.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {linkedDelivery.externalUrl}
                </a>
              </div>
            </div>
          )}

          {/* 已有审核意见 */}
          {hasReviewComment && !showReviewForm && (
            <div className="p-3 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('deliveries.reviewComment')}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {reviewCommentText}
              </div>
            </div>
          )}

          {/* 审核操作区 */}
          {isPending && linkedDelivery && !showReviewForm && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowReviewForm(true); }}
                className="bg-primary-500 text-white hover:bg-primary-600"
              >
                <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                {t('deliveries.reviewDoc')}
              </Button>
            </div>
          )}

          {/* 已审核 - 重新审核入口 */}
          {!isPending && linkedDelivery && !showReviewForm && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowReviewForm(true); }}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t('deliveries.reReview', { defaultValue: 'Re-review' })}
              </Button>
            </div>
          )}

          {/* 内联审核表单（替代弹窗） */}
          {showReviewForm && linkedDelivery && (
            <div className="p-4 rounded-lg border space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {/* 审核结果三选一 */}
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {t('deliveries.reviewResult', { defaultValue: 'Review Result' })}
                </div>
                <div className="flex gap-2">
                  {(['approved', 'revision_needed', 'rejected'] as const).map(status => {
                    const cfg = STATUS_CONFIG[status];
                    const Icon = cfg.icon;
                    const labels = { approved: t('deliveries.pass'), revision_needed: t('deliveries.needModify'), rejected: t('deliveries.return') };
                    return (
                      <button
                        key={status}
                        onClick={() => setReviewStatus(status)}
                        className={clsx(
                          'flex-1 py-2.5 px-3 rounded-lg border text-xs font-medium transition-all',
                          reviewStatus === status
                            ? clsx(cfg.bgColor, cfg.borderColor, cfg.color, 'ring-1', cfg.borderColor)
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                        style={reviewStatus !== status ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        {labels[status]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 审核意见 */}
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {t('deliveries.reviewComment')}
                </div>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('deliveries.reviewCommentPlaceholder')}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* 提交按钮 */}
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => { setShowReviewForm(false); setReviewComment(''); }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleReview}
                  disabled={submitting}
                  className={clsx(
                    reviewStatus === 'approved' && 'bg-green-500 text-white hover:bg-green-600',
                    reviewStatus === 'revision_needed' && 'bg-orange-500 text-white hover:bg-orange-600',
                    reviewStatus === 'rejected' && 'bg-red-500 text-white hover:bg-red-600',
                  )}
                >
                  {submitting ? t('common.loading') : t('deliveries.submitReview', { defaultValue: 'Submit Review' })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
