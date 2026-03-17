'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDeliveryStore, useMemberStore, useDocumentStore, useTaskStore, useProjectStore, useChatStore } from '@/store';
import { useGatewayStore } from '@/store/gateway.store';
import { useAuthStore } from '@/store/auth.store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Textarea, Badge } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import type { Delivery } from '@/db/schema';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Filter,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { formatRelativeTime } from '@/hooks/useRelativeTime';

export default function DeliveriesPage() {
  const { t, i18n } = useTranslation();

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/30', label: t('deliveries.pending') };
      case 'approved':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/30', label: t('deliveries.approved') };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/30', label: t('deliveries.rejected') };
      case 'revision_needed':
        return { icon: RefreshCw, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/30', label: t('deliveries.revisionNeeded') };
      default:
        return { icon: AlertCircle, color: 'text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700', label: t('deliveries.unknown') };
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'tencent-doc': return t('deliveries.platform.tencentDoc');
      case 'feishu': return t('deliveries.platform.feishu');
      case 'notion': return t('deliveries.platform.notion');
      case 'local': return t('deliveries.platform.local');
      default: return t('deliveries.platform.external');
    }
  };

  // 精确 selector 订阅
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const updateDeliveryAsync = useDeliveryStore((s) => s.updateDeliveryAsync);
  const deleteDeliveryAsync = useDeliveryStore((s) => s.deleteDeliveryAsync);
  
  const members = useMemberStore((s) => s.members);
  const getAIMembers = useMemberStore((s) => s.getAIMembers);
  const getHumanMembers = useMemberStore((s) => s.getHumanMembers);
  
  const documents = useDocumentStore((s) => s.documents);
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const openChatWithMessage = useChatStore((s) => s.openChatWithMessage);
  
  // v3.0 多用户：获取用户专用会话键（注意：不在组件级别缓存，而是在函数调用时实时计算）
  const authUser = useAuthStore((s) => s.user);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);
  
  const aiMembers = useMemo(() => getAIMembers(), [members]);
  const humanMembers = useMemo(() => getHumanMembers(), [members]);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'revision_needed'>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const deleteAction = useConfirmAction<string>();

  // Escape key support for dialogs
  useEscapeKey(!!selectedDelivery, useCallback(() => setSelectedDelivery(null), []));

  const filteredDeliveries = useMemo(() => {
    if (filterStatus === 'all') return deliveries;
    return deliveries.filter(d => d.status === filterStatus);
  }, [deliveries, filterStatus]);

  const statusCounts = useMemo(() => ({
    all: deliveries.length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    approved: deliveries.filter(d => d.status === 'approved').length,
    rejected: deliveries.filter(d => d.status === 'rejected').length,
    revision_needed: deliveries.filter(d => d.status === 'revision_needed').length,
  }), [deliveries]);

  // 通过 taskId 查找关联的 task 和 project
  const getDeliveryContext = useCallback((delivery: Delivery) => {
    const task = delivery.taskId ? tasks.find(t => t.id === delivery.taskId) : null;
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    return { task, project };
  }, [tasks, projects]);

  // 泳道数据：按项目分组
  const swimlaneData = useMemo(() => {
    const lanes: { projectId: string | null; projectName: string; deliveries: Delivery[]; count: number }[] = [];
    const projectMap = new Map<string | null, Delivery[]>();

    for (const delivery of filteredDeliveries) {
      const { project } = getDeliveryContext(delivery);
      const pid = project?.id || null;
      if (!projectMap.has(pid)) projectMap.set(pid, []);
      projectMap.get(pid)!.push(delivery);
    }

    // 有项目的泳道
    for (const project of projects) {
      const projectDeliveries = projectMap.get(project.id);
      if (projectDeliveries && projectDeliveries.length > 0) {
        lanes.push({ projectId: project.id, projectName: project.name, deliveries: projectDeliveries, count: projectDeliveries.length });
        projectMap.delete(project.id);
      }
    }

    // 未分类泳道
    const uncategorized = projectMap.get(null) || [];
    if (uncategorized.length > 0) {
      lanes.push({ projectId: null, projectName: t('deliveries.uncategorized'), deliveries: uncategorized, count: uncategorized.length });
    }

    return lanes;
  }, [filteredDeliveries, projects, getDeliveryContext, t]);

  const toggleLane = useCallback((laneId: string) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  }, []);

  const handleReview = async (deliveryId: string, status: 'approved' | 'rejected' | 'revision_needed') => {
    await updateDeliveryAsync(deliveryId, {
      status,
      reviewComment: reviewComment || null,
      reviewedAt: new Date(),
      reviewerId: humanMembers[0]?.id,
    });
    setSelectedDelivery(null);
    setReviewComment('');
  };

  // 与 AI 讨论交付物
  const handleChatAboutDelivery = useCallback((delivery: Delivery) => {
    const { task, project } = getDeliveryContext(delivery);
    const member = members.find(m => m.id === delivery.memberId);
    const linkedDoc = delivery.documentId ? documents.find(d => d.id === delivery.documentId) : null;

    // v3.0 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;

    const lines = [
      '**这是一条引用讨论消息，请先不要执行任何操作，我们只需要讨论方案。**',
      '',
      '---',
      '',
      '## 来源信息',
      '- **数据来源**: TeamClaw 协作平台',
      '- **服务类型**: 本地 SQLite 数据库（通过 TeamClaw MCP 工具访问）',
      '',
      '## 引用的交付物',
      `- **交付物 ID**: ${delivery.id}`,
      `- **标题**: ${delivery.title}`,
      `- **状态**: ${getStatusDisplay(delivery.status).label}`,
      `- **平台**: ${getPlatformName(delivery.platform)}`,
      `- **提交人**: ${member?.name || '未知'}`,
      `- **提交时间**: ${new Date(delivery.createdAt).toLocaleString('zh-CN')}`,
      '',
    ];

    if (delivery.description) {
      lines.push('### 描述', delivery.description, '');
    }

    if (project) {
      lines.push('## 所属项目', `- **项目名称**: ${project.name}`, '');
    }

    if (task) {
      lines.push('## 关联任务', `- **任务 ID**: ${task.id}`, `- **任务标题**: ${task.title}`, '');
    }

    if (linkedDoc) {
      lines.push('## 关联文档', `- **文档 ID**: ${linkedDoc.id}`, `- **文档标题**: ${linkedDoc.title}`, '');
    }

    if (delivery.externalUrl) {
      lines.push(`## 外部链接`, `- ${delivery.externalUrl}`, '');
    }

    if (delivery.reviewComment) {
      lines.push('## 审核评论', delivery.reviewComment, '');
    }

    lines.push(
      '---',
      '',
      '## 访问方式',
      '- 交付物: `list_deliveries`',
      '- 任务: `get_task` 或 `list_tasks`',
      '- 文档: `get_document` 或 `list_documents`',
      '',
      '**请分析这个交付物，给出你的审核建议，但暂时不要执行任何修改操作。**'
    );

    // v3.0 多用户：传入用户专用会话键
    openChatWithMessage(lines.join('\n'), { sessionKey: userSessionKey || undefined });
  }, [getDeliveryContext, members, documents, getStatusDisplay, getPlatformName, openChatWithMessage, authUser, getUserSessionKey]);

  return (
    <AppShell>
      <Header
        title={t('deliveries.title')}
        actions={
          statusCounts.pending > 0 ? (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 text-sm rounded">
              {t('deliveries.pendingReview', { count: statusCounts.pending })}
            </Badge>
          ) : undefined
        }
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('deliveries.allDeliveries'), value: statusCounts.all, border: '' },
            { label: t('deliveries.pending'), value: statusCounts.pending, border: 'border-l-4 border-yellow-500', color: 'text-yellow-600' },
            { label: t('deliveries.approved'), value: statusCounts.approved, border: 'border-l-4 border-green-500', color: 'text-green-600' },
            { label: t('deliveries.needModifyReturn'), value: statusCounts.rejected + statusCounts.revision_needed, border: 'border-l-4 border-red-500', color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className={clsx('card p-4', s.border)}>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{s.label}</div>
              <div className={clsx('text-2xl font-bold font-display', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* 过滤器 */}
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          {(['all', 'pending', 'approved', 'rejected', 'revision_needed'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={clsx(
                'px-3 py-1 rounded text-sm transition-colors',
                filterStatus === status
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
              style={{ color: filterStatus === status ? undefined : 'var(--text-secondary)' }}
            >
              {status === 'all' ? t('deliveries.all') : getStatusDisplay(status).label}
              {status !== 'all' && ` (${statusCounts[status]})`}
            </button>
          ))}
        </div>

        {/* 泳道式交付列表（按项目分组）*/}
        {filteredDeliveries.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.noDeliveries')}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.noDeliveriesHint')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {swimlaneData.map(lane => {
              const laneId = lane.projectId || '__uncategorized__';
              const isCollapsed = collapsedLanes.has(laneId);
              // 各状态小计
              const lanePending = lane.deliveries.filter(d => d.status === 'pending').length;
              const laneApproved = lane.deliveries.filter(d => d.status === 'approved').length;
              const laneRejected = lane.deliveries.filter(d => d.status === 'rejected').length;
              const laneRevision = lane.deliveries.filter(d => d.status === 'revision_needed').length;

              return (
                <div key={laneId} className="card overflow-hidden">
                  {/* 泳道标题行 */}
                  <button
                    onClick={() => toggleLane(laneId)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                      : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    }
                    <FolderKanban className="w-4 h-4" style={{ color: lane.projectId ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />
                    <span className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                      {lane.projectName}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {lane.count} {t('deliveries.deliveryCount')}
                    </span>
                    {/* 状态小计 */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {lanePending > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-yellow-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{lanePending}
                        </span>
                      )}
                      {laneApproved > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-green-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{laneApproved}
                        </span>
                      )}
                      {laneRevision > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{laneRevision}
                        </span>
                      )}
                      {laneRejected > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{laneRejected}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* 泳道内容 */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-3">
                      {lane.deliveries.map(delivery => {
                        const statusDisplay = getStatusDisplay(delivery.status);
                        const StatusIcon = statusDisplay.icon;
                        const member = aiMembers.find(m => m.id === delivery.memberId);
                        const { task } = getDeliveryContext(delivery);

                        return (
                          <div
                            key={delivery.id}
                            className={clsx(
                              'card p-4 cursor-pointer hover:shadow-card-hover transition-shadow',
                              'border-l-4',
                              delivery.status === 'pending' && 'border-l-yellow-500',
                              delivery.status === 'approved' && 'border-l-green-500',
                              delivery.status === 'rejected' && 'border-l-red-500',
                              delivery.status === 'revision_needed' && 'border-l-orange-500'
                            )}
                            onClick={() => setSelectedDelivery(delivery)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{delivery.title}</h3>
                                  {delivery.source === 'openclaw' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                                      {t('deliveries.synced')}
                                    </span>
                                  )}
                                  <span className={clsx('px-2 py-0.5 rounded text-xs flex items-center gap-1', statusDisplay.bgColor, statusDisplay.color)}>
                                    <StatusIcon className="w-3 h-3" />
                                    {statusDisplay.label}
                                  </span>
                                </div>
                                {/* 关联任务标注 */}
                                {task && (
                                  <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <ClipboardList className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{t('deliveries.linkedTask')}: {task.title}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                  <span>{member?.name || t('deliveries.unknownAi')}</span>
                                  <span>{getPlatformName(delivery.platform)}</span>
                                  <span>{formatRelativeTime(delivery.createdAt, i18n.language)}</span>
                                </div>
                                {delivery.description && (
                                  <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{delivery.description}</p>
                                )}
                                {delivery.reviewedAt && (
                                  <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
                                    {t('deliveries.reviewer')}: {members.find(m => m.id === delivery.reviewerId)?.name || t('deliveries.unknown')}
                                    {delivery.reviewComment && ` · ${delivery.reviewComment}`}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleChatAboutDelivery(delivery); }}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                  title="与 AI 讨论"
                                >
                                  <MessageSquare className="w-4 h-4" style={{ color: 'var(--ai)' }} />
                                </button>
                                {delivery.documentId && (() => {
                                  const linkedDoc = documents.find(d => d.id === delivery.documentId);
                                  return linkedDoc ? (
                                    <a
                                      href={`/wiki?doc=${linkedDoc.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                                    >
                                      <FileText className="w-4 h-4" />
                                      {linkedDoc.title}
                                    </a>
                                  ) : null;
                                })()}
                                {delivery.externalUrl && (
                                  <a
                                    href={delivery.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('deliveries.openDoc')}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 审核对话框 */}
      {selectedDelivery && (() => {
        const { task: selTask, project: selProject } = getDeliveryContext(selectedDelivery);
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDelivery(null)}>
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-float" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold font-display mb-4" style={{ color: 'var(--text-primary)' }}>{t('deliveries.reviewDoc')}</h3>
            <div className="mb-4">
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.docTitle')}</div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedDelivery.title}</div>
            </div>
            {/* 关联项目和任务 */}
            {(selProject || selTask) && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--background)' }}>
                {selProject && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <FolderKanban className="w-3.5 h-3.5" style={{ color: 'var(--primary-500)' }} />
                    <span style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.linkedProject')}:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selProject.name}</span>
                  </div>
                )}
                {selTask && (
                  <div className={clsx('flex items-center gap-1.5 text-sm', selProject && 'mt-1.5')}>
                    <ClipboardList className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.linkedTask')}:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selTask.title}</span>
                  </div>
                )}
              </div>
            )}
            {selectedDelivery.documentId && (() => {
              const linkedDoc = documents.find(d => d.id === selectedDelivery.documentId);
              return linkedDoc ? (
                <div className="mb-4">
                  <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.linkedDoc')}</div>
                  <a
                    href={`/wiki?doc=${linkedDoc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    {linkedDoc.title}
                  </a>
                </div>
              ) : null;
            })()}
            {selectedDelivery.externalUrl && (
              <div className="mb-4">
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.externalLink')}</div>
                <a href={selectedDelivery.externalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-1">
                  <ExternalLink className="w-3.5 h-3.5" /> {selectedDelivery.externalUrl}
                </a>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('deliveries.reviewComment')}</label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder={t('deliveries.reviewCommentPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 mr-auto" onClick={() => {
                deleteAction.requestConfirm(selectedDelivery.id);
              }}>
                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { handleChatAboutDelivery(selectedDelivery); setSelectedDelivery(null); }}>
                <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ai)' }} /> 与 AI 讨论
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSelectedDelivery(null)}>{t('common.cancel')}</Button>
              <Button size="sm" className="text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30" onClick={() => handleReview(selectedDelivery.id, 'revision_needed')}>{t('deliveries.needModify')}</Button>
              <Button size="sm" variant="danger" onClick={() => handleReview(selectedDelivery.id, 'rejected')}>{t('deliveries.return')}</Button>
              <Button size="sm" className="bg-green-500 text-white hover:bg-green-600" onClick={() => handleReview(selectedDelivery.id, 'approved')}>{t('deliveries.pass')}</Button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(async (deliveryId) => {
          await deleteDeliveryAsync(deliveryId);
          setSelectedDelivery(null);
        })}
        title={t('deliveries.confirmDelete', { defaultValue: '删除交付记录' })}
        message={t('deliveries.deleteWarning', { defaultValue: '确定要删除这条交付记录吗？此操作不可恢复。' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />
    </AppShell>
  );
}
