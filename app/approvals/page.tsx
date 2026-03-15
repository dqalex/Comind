'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Package,
  UserPlus,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Button, Badge, Card, CardContent } from '@/components/ui';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { useApprovalStore } from '@/store/approval';
import { useAuthStore } from '@/store';
import clsx from 'clsx';
import { toast } from 'sonner';

// 审批类型配置
const APPROVAL_TYPE_CONFIG = {
  skill_publish: { icon: Package, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  skill_install: { icon: Package, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  project_join: { icon: UserPlus, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950' },
  sensitive_action: { icon: Shield, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950' },
};

// 状态配置
const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  approved: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950' },
  rejected: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950' },
  cancelled: { icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950' },
  expired: { icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950' },
};

export default function ApprovalsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requests, isLoading, error, fetchRequests, approveRequest, rejectRequest, cancelRequest } = useApprovalStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  // 记录刚审批通过的请求，用于显示快捷操作
  const [justApproved, setJustApproved] = useState<Set<string>>(new Set());

  // 加载数据
  useEffect(() => {
    fetchRequests(statusFilter === 'all' ? undefined : { status: statusFilter });
  }, [statusFilter, fetchRequests]);

  // 统计（始终基于全量数据，不受过滤影响）
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  // 处理审批通过
  const handleApprove = async (id: string, resourceId?: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await approveRequest(id);
      setJustApproved(prev => new Set(prev).add(id));
      
      // 带引导的 toast
      if (resourceId) {
        toast.success(t('approvals.approveSuccess', '审批已通过'), {
          duration: 5000,
          action: {
            label: t('approvals.goToTrust', '前往信任'),
            onClick: () => router.push(`/skillhub/${resourceId}`),
          },
        });
      } else {
        toast.success(t('approvals.approveSuccess', '审批已通过'));
      }
    } catch (err) {
      toast.error(t('approvals.approveFailed', '审批失败，请重试'));
      console.error('Approve failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // 处理拒绝
  const handleReject = async (id: string) => {
    if (processingId) return;
    if (!rejectNote.trim()) {
      toast.warning(t('approvals.rejectNoteRequired', '请填写拒绝原因'));
      return;
    }
    setProcessingId(id);
    try {
      await rejectRequest(id, rejectNote);
      setShowRejectDialog(null);
      setRejectNote('');
      toast.success(t('approvals.rejectSuccess', '已拒绝'));
    } catch (err) {
      toast.error(t('approvals.rejectFailed', '拒绝失败，请重试'));
      console.error('Reject failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // 处理取消
  const handleCancel = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await cancelRequest(id);
      toast.success(t('approvals.cancelSuccess', '已取消'));
    } catch (err) {
      toast.error(t('approvals.cancelFailed', '取消失败，请重试'));
      console.error('Cancel failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 获取类型图标和颜色
  const getTypeConfig = (type: string) => {
    return APPROVAL_TYPE_CONFIG[type as keyof typeof APPROVAL_TYPE_CONFIG] || APPROVAL_TYPE_CONFIG.skill_publish;
  };

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  return (
    <AppShell>
      <Header
        title={t('approvals.title', '审批管理')}
        actions={
          <div className="flex items-center gap-2">
            {/* 状态过滤 */}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    status === 'all' && 'rounded-l-lg',
                    status === 'rejected' && 'rounded-r-lg',
                    statusFilter === status && 'bg-primary-50 text-primary-600 dark:bg-primary-950'
                  )}
                  style={statusFilter !== status ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {t(`approvals.status.${status}`, status === 'all' ? t('approvals.status.all') : t(`approvals.status.${status}`))}
                  <span className="ml-1 text-[10px] opacity-60">
                    {status === 'all' ? stats.total : stats[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <ClipboardCheck className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('approvals.noRequests', '暂无审批请求')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const typeConfig = getTypeConfig(request.type);
              const statusConfig = getStatusConfig(request.status);
              const payload = request.payload as Record<string, unknown> | null;
              const isProcessing = processingId === request.id;
              const isJustApproved = justApproved.has(request.id);

              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* 类型图标 */}
                      <div className={clsx('p-2 rounded-lg', typeConfig.bgColor)}>
                        <typeConfig.icon className={clsx('w-5 h-5', typeConfig.color)} />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {(payload?.skillName as string) || request.resourceType}
                          </span>
                          <Badge variant="default" className="text-[10px]">
                            {t(`approvals.type.${request.type}`, request.type)}
                          </Badge>
                          <Badge 
                            variant={request.status === 'pending' ? 'warning' : 'default'}
                            className={clsx('text-[10px]', statusConfig.bgColor, statusConfig.color)}
                          >
                            <statusConfig.icon className="w-3 h-3 mr-1" />
                            {t(`approvals.status.${request.status}`)}
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                          {request.requestNote || (payload?.description as string) || t('approvals.noDescription', '无说明')}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{formatTime(request.createdAt)}</span>
                          {request.processedAt && (
                            <span>{t('approvals.processedAt', '处理于')} {formatTime(request.processedAt)}</span>
                          )}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {request.status === 'pending' && (
                          isAdmin ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(request.id, request.resourceId || undefined)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                {t('common.approve', '通过')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowRejectDialog(request.id)}
                                disabled={isProcessing}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {t('common.reject', '拒绝')}
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancel(request.id)}
                              disabled={isProcessing}
                            >
                              {t('common.cancel', '取消')}
                            </Button>
                          )
                        )}

                        {/* 已通过的审批：显示快捷操作 */}
                        {(request.status === 'approved' || isJustApproved) && request.resourceId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/skillhub/${request.resourceId}`)}
                            className="flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t('approvals.viewSkill', '查看技能')}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 拒绝对话框 */}
                    {showRejectDialog === request.id && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder={t('approvals.rejectNotePlaceholder', '请输入拒绝原因（必填）...')}
                          className="w-full p-2 text-sm border rounded-md resize-none"
                          style={{ 
                            backgroundColor: 'var(--input-bg)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)'
                          }}
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowRejectDialog(null);
                              setRejectNote('');
                            }}
                          >
                            {t('common.cancel', '取消')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleReject(request.id)}
                            disabled={isProcessing || !rejectNote.trim()}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {t('approvals.confirmReject', '确认拒绝')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
