'use client';

/**
 * SkillHub 详情页面
 * 
 * 路径: /skillhub/[id]
 * 
 * 功能:
 * - 查看技能详情
 * - 编辑技能信息（创建者/管理员）
 * - 提交审批/批准/拒绝
 * - 信任管理
 * - 链路引导（提交审批后提示、审批通过后引导信任）
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { useSkillStore, useAuthStore, useSOPTemplateStore } from '@/domains';
import { skillsApi } from '@/lib/data-service';
import type { Skill, SOPTemplate } from '@/db/schema';
import {
  ArrowLeft, Edit, Trash2, Send, Check, X, Shield, ShieldOff, AlertTriangle,
  Clock, CheckCircle2, XCircle, FileText, BarChart3, Code, Settings,
  Zap, Calendar, User, Tag, Info, ClipboardList, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pending_approval: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  active: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
};

// 信任状态颜色映射
const TRUST_COLORS: Record<string, string> = {
  trusted: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  untrusted: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

export default function SkillDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const skillId = params?.id as string;
  
  // Store
  const skills = useSkillStore((s) => s.skills);
  const deleteSkillAsync = useSkillStore((s) => s.deleteSkillAsync);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // SOP 模板 Store
  const sopTemplates = useSOPTemplateStore((s) => s.templates);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  
  // 本地状态
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // 拒绝对话框
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  // 删除确认对话框
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // 加载 SOP 模板数据（用于显示关联）
  useEffect(() => {
    if (sopTemplates.length === 0) {
      fetchSOPTemplates();
    }
  }, [sopTemplates.length, fetchSOPTemplates]);
  
  // 查找关联的 SOP 模板
  const linkedSOPTemplate = useMemo<SOPTemplate | null>(() => {
    if (!skill?.sopTemplateId) return null;
    return sopTemplates.find(t => t.id === skill.sopTemplateId) || null;
  }, [skill?.sopTemplateId, sopTemplates]);
  
  // 加载技能详情
  useEffect(() => {
    const loadSkill = async () => {
      if (!skillId) return;
      
      // 先从本地 store 查找
      const localSkill = skills.find(s => s.id === skillId);
      if (localSkill) {
        setSkill(localSkill);
        setLoading(false);
      }
      
      // 从 API 获取最新数据（仅当本地有数据或首次加载时）
      try {
        const { data, error } = await skillsApi.getById(skillId);
        if (data) {
          // API 返回成功，更新数据
          setSkill(data);
        } else if (error) {
          // API 返回错误，保留本地数据（如果有）
          console.warn('Failed to load skill from API, using local data:', error);
          if (!localSkill) {
            // 本地也没有数据，显示错误
            console.error('No local skill data available');
          }
          // 重要：如果有本地数据，保持不变
        }
      } catch (err) {
        // 网络或其他错误，保留本地数据
        console.warn('Error loading skill from API:', err);
        if (!localSkill) {
          console.error('No local skill data available');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadSkill();
  }, [skillId, skills]);
  
  // 权限判断
  const permissions = useMemo(() => {
    if (!skill || !user) return { canEdit: false, canApprove: false, canDelete: false, isCreator: false };
    
    const isCreator = skill.createdBy === user.id;
    
    return {
      canEdit: isCreator || isAdmin,
      canApprove: isAdmin,
      canDelete: (isCreator && ['draft', 'rejected'].includes(skill.status || '')) || isAdmin,
      isCreator,
    };
  }, [skill, user, isAdmin]);
  
  // 操作处理：提交审批
  const handleSubmitApproval = async () => {
    if (!skill) return;
    setActionLoading('submit');
    try {
      const { error } = await skillsApi.submitForApproval(skill.id);
      if (error) {
        toast.error(t('skillhub.detail.submitFailed', error));
      } else {
        await fetchSkills();
        setSkill({ ...skill, status: 'pending_approval' });
        toast.success(t('skillhub.detail.submitSuccess'), {
          action: {
            label: t('approvals.title'),
            onClick: () => router.push('/approvals'),
          },
        });
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  // 操作处理：通过
  const handleApprove = async () => {
    if (!skill) return;
    setActionLoading('approve');
    try {
      const { error } = await skillsApi.approve(skill.id);
      if (error) {
        toast.error(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, status: 'active' });
        // 审批通过后引导信任
        if (skill.trustStatus !== 'trusted') {
          toast.success(t('skillhub.detail.approveSuccess'), {
            duration: 5000,
            action: {
              label: t('skillhub.detail.trustNow'),
              onClick: () => handleTrust(),
            },
          });
        } else {
          toast.success(t('skillhub.detail.approveSuccess'));
        }
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  // 操作处理：拒绝（通过对话框）
  const handleReject = async () => {
    if (!skill) return;
    setActionLoading('reject');
    try {
      const { error } = await skillsApi.reject(skill.id, rejectNote || undefined);
      if (error) {
        toast.error(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, status: 'rejected' });
        setShowRejectDialog(false);
        setRejectNote('');
        toast.success(t('skillhub.detail.rejectSuccess'));
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  // 操作处理：信任
  const handleTrust = async () => {
    if (!skill) return;
    setActionLoading('trust');
    try {
      const { error } = await skillsApi.trust(skill.id);
      if (error) {
        toast.error(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, trustStatus: 'trusted' });
        toast.success(t('skillhub.detail.trustSuccess'));
      }
    } finally {
      setActionLoading(null);
    }
  };

  // 操作处理：取消信任
  const handleUntrust = async () => {
    if (!skill) return;
    setActionLoading('untrust');
    try {
      const { error } = await skillsApi.untrust(skill.id);
      if (error) {
        toast.error(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, trustStatus: 'untrusted' });
        toast.success(t('skillhub.detail.untrustSuccess', '已取消审核标记'));
      }
    } finally {
      setActionLoading(null);
    }
  };

  // 操作处理：删除
  const handleDelete = async () => {
    if (!skill) return;
    setActionLoading('delete');
    try {
      const success = await deleteSkillAsync(skill.id);
      if (success) {
        toast.success(t('skillhub.detail.deleteSuccess'));
        router.push('/skillhub');
      } else {
        toast.error(t('skillhub.detail.deleteFailed'));
      }
    } finally {
      setActionLoading(null);
      setShowDeleteConfirm(false);
    }
  };
  
  // 格式化日期
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };
  
  if (loading) {
    return (
      <AppShell>
        <Header title={t('skillhub.detail.title')} />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </main>
      </AppShell>
    );
  }
  
  if (!skill) {
    return (
      <AppShell>
        <Header title={t('skillhub.detail.title')} />
        <main className="flex-1 p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <p style={{ color: 'var(--text-tertiary)' }}>{t('common.notFound')}</p>
              <Button onClick={() => router.push('/skillhub')} className="mt-4">
                {t('common.back')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <Header 
        title={skill.name}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push('/skillhub')}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </div>
        }
      />
      
      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        {/* 状态卡片 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-14 h-14 rounded-xl flex items-center justify-center',
                  skill.status === 'active' 
                    ? 'bg-primary-50 dark:bg-primary-950' 
                    : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {skill.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={clsx('text-xs', STATUS_COLORS[skill.status || 'draft'])}>
                      {t(`skillhub.status.${skill.status}`)}
                    </Badge>
                    <Badge className={clsx('text-xs', TRUST_COLORS[skill.trustStatus || 'pending'])}>
                      {t(`skillhub.trust.${skill.trustStatus}`)}
                    </Badge>
                    {skill.isSensitive && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 草稿状态：提交审批 */}
                {skill.status === 'draft' && permissions.canEdit && (
                  <Button
                    size="sm"
                    onClick={handleSubmitApproval}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5"
                  >
                    {actionLoading === 'submit' ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {t('skillhub.detail.submitApproval', '提交审批')}
                  </Button>
                )}
                
                {/* 审批中状态：通过/拒绝 */}
                {skill.status === 'pending_approval' && permissions.canApprove && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {t('common.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      {t('common.reject')}
                    </Button>
                  </>
                )}
                
                {/* 待审核状态：标记为已审核按钮（来源不明需确认） */}
                {skill.status === 'active' && skill.trustStatus === 'pending' && isAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleTrust}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    {t('skillhub.detail.trustSkill')}
                  </Button>
                )}
                
                {/* 已信任状态：取消审核标记按钮（管理员可操作） */}
                {skill.status === 'active' && skill.trustStatus === 'trusted' && isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUntrust}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700"
                  >
                    <ShieldOff className="w-4 h-4" />
                    {t('skillhub.detail.untrust')}
                  </Button>
                )}
                
                {/* 编辑按钮 */}
                {permissions.canEdit && skill.status !== 'pending_approval' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/skillhub/${skill.id}/edit`)}
                    className="flex items-center gap-1.5"
                  >
                    <Edit className="w-4 h-4" />
                    {t('skillhub.detail.edit')}
                  </Button>
                )}
                
                {/* 删除按钮 */}
                {permissions.canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('skillhub.detail.delete')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 状态引导提示：仅 pending 状态显示（来源不明需确认） */}
        {skill.status === 'active' && skill.trustStatus === 'pending' && isAdmin && (
          <div className="mb-6 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t('skillhub.detail.trustHint')}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleTrust}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <Shield className="w-4 h-4" />
                {t('skillhub.detail.trustNow')}
              </Button>
            </div>
          </div>
        )}

        {skill.status === 'pending_approval' && (
          <div className="mb-6 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t('skillhub.detail.pendingHint')}
                </p>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/approvals')}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('approvals.title')}
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* 基本信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              {t('skillhub.detail.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.skillKey')}
                </label>
                <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.skillKey}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.version')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  v{skill.version}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.category')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {t(`skillhub.category.${skill.category || 'custom'}`)}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.source')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.source}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.createdAt')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(skill.createdAt)}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.updatedAt')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(skill.updatedAt)}
                </p>
              </div>
            </div>
            
            {skill.description && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.description')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.description}
                </p>
              </div>
            )}
            
            {skill.isSensitive && skill.sensitivityNote && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('skillhub.detail.sensitive')}</span>
                </div>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                  {skill.sensitivityNote}
                </p>
              </div>
            )}
            
            {/* SOP 模板关联 */}
            {skill.sopTemplateId && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.linkedSOP')}
                </label>
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--surface-secondary)' }}>
                  {linkedSOPTemplate ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {linkedSOPTemplate.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            v{linkedSOPTemplate.version || '1.0.0'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/sop?select=${linkedSOPTemplate.id}`)}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('common.view')}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('skillhub.detail.sopNotFound')}
                    </p>
                  )}
                  
                  {/* SOP 更新可用提示 */}
                  {skill.sopUpdateAvailable && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">{t('skillhub.sopUpdateAvailable')}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('skillhub.sopUpdateHint')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 拒绝对话框 */}
        {showRejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectDialog(false)}>
            <div className="w-full max-w-md mx-4 rounded-xl shadow-xl" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t('skillhub.detail.rejectTitle')}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.rejectDesc')}
                </p>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder={t('approvals.rejectNotePlaceholder')}
                  className="w-full p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowRejectDialog(false); setRejectNote(''); }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleReject}
                  disabled={actionLoading === 'reject'}
                  className="flex items-center gap-1.5"
                >
                  {actionLoading === 'reject' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {t('approvals.confirmReject')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认对话框 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
            <div className="w-full max-w-sm mx-4 rounded-xl shadow-xl" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('common.confirmDelete')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.deleteConfirmDesc')}
                </p>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="flex items-center gap-1.5"
                >
                  {actionLoading === 'delete' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
