'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useMemberStore, useProjectStore, useTaskStore, useAuthStore } from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Badge, Input } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useSecurityCode } from '@/hooks/useSecurityCode';
import {
  Bot, User, Trash2,
  ChevronRight, Activity, Cpu,
  Key, Copy, RefreshCw, Check, Info,
  Zap, Loader2, FolderSync, Shield,
  Lock, Eye, EyeOff,
} from 'lucide-react';
import clsx from 'clsx';

export default function MembersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // 精确 selector 订阅
  const members = useMemberStore((s) => s.members);
  const getHumanMembers = useMemberStore((s) => s.getHumanMembers);
  const deleteMemberAsync = useMemberStore((s) => s.deleteMemberAsync);
  const updateMemberAsync = useMemberStore((s) => s.updateMemberAsync);
  const createMember = useMemberStore((s) => s.createMember);
  
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  
  // 当前用户 role
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  
  const connected = useGatewayStore((s) => s.connected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const agentsList = useGatewayStore((s) => s.agentsList);
  const agentHealthList = useGatewayStore((s) => s.agentHealthList);
  const gwUrl = useGatewayStore((s) => s.gwUrl);

  const humanMembers = useMemo(() => getHumanMembers(), [members]);

  // 根据连接模式判断是否已连接
  const isGwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;

  // v3.0: 移除"添加人类成员"功能，人类成员只能通过注册系统创建
  // const [showAddDialog, setShowAddDialog] = useState(false);
  // const [addType, setAddType] = useState<'human' | 'ai'>('ai');
  // const [addName, setAddName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 删除成员前的安全码验证
  const deleteWithSecurity = useSecurityCode({
    onVerified: async () => {
      // 安全码验证通过，执行删除
      if (pendingDeleteId) {
        await deleteMemberAsync(pendingDeleteId);
        setPendingDeleteId(null);
        setShowDeleteConfirm(null);
      }
    },
  });

  // 重置密码前的安全码验证
  const resetPasswordWithSecurity = useSecurityCode({
    onVerified: async () => {
      // 安全码验证通过，执行重置密码
      await handleResetPasswordInternal();
    },
  });

  // AI 成员编辑状态
  const [editingMember, setEditingMember] = useState<{
    id: string;
    name: string;
    agentId: string;
    hasToken: boolean;
  } | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenCopyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [saving, setSaving] = useState(false);

  // 一键配置状态
  const [quickSetupLoading, setQuickSetupLoading] = useState<string | null>(null);
  const [quickSetupResult, setQuickSetupResult] = useState<{
    memberName: string;
    projectName: string;
    projectId: string;
    taskCount: number;
  } | null>(null);

  // 重置密码状态
  const [resetPasswordMember, setResetPasswordMember] = useState<{ id: string; name: string } | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ newPassword: string; memberName: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Escape key support for dialogs
  // v3.0: 移除 showAddDialog 的 escape 支持
  useEscapeKey(!!showDeleteConfirm, useCallback(() => setShowDeleteConfirm(null), []));
  useEscapeKey(!!editingMember, useCallback(() => setEditingMember(null), []));
  useEscapeKey(!!quickSetupResult, useCallback(() => setQuickSetupResult(null), []));
  useEscapeKey(!!resetPasswordMember, useCallback(() => setResetPasswordMember(null), []));
  useEscapeKey(!!resetPasswordResult, useCallback(() => setResetPasswordResult(null), []));
  useEscapeKey(!!resetPasswordWithSecurity.showDialog, useCallback(() => resetPasswordWithSecurity.cancel(), []));

  // 生成随机 Token
  const generateRandomToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  };

  // 处理生成 Token
  const handleGenerateToken = async () => {
    if (!editingMember) return;
    const token = generateRandomToken();
    setNewToken(token);
    setTokenCopied(false);
  };

  // 保存 Token
  const handleSaveToken = async () => {
    if (!editingMember || !newToken) return;
    setSaving(true);
    try {
      const success = await updateMemberAsync(editingMember.id, {
        openclawApiToken: newToken,
      });
      if (success) {
        setEditingMember(null);
        setNewToken(null);
      }
    } finally {
      setSaving(false);
    }
  };

  // 复制 Token
  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      if (tokenCopyTimerRef.current) clearTimeout(tokenCopyTimerRef.current);
      tokenCopyTimerRef.current = setTimeout(() => setTokenCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  // 获取本地 AI 成员信息（使用复合键：gwUrl + agentId 确保跨 Gateway 唯一性）
  const getLocalAIMember = (agent: { id: string; name?: string }) => {
    return members.find(m => m.type === 'ai' && m.openclawGatewayUrl === gwUrl && m.openclawAgentId === agent.id);
  };

  // 打开编辑对话框
  const handleOpenEdit = (agent: { id: string; name?: string }) => {
    const localMember = getLocalAIMember(agent);
    const memberWithToken = localMember as typeof localMember & { hasApiToken?: boolean };
    setEditingMember({
      id: localMember?.id || '',
      name: agent.name || agent.id,
      agentId: agent.id,
      hasToken: memberWithToken?.hasApiToken || !!localMember?.openclawApiToken,
    });
    setNewToken(null);
    setTokenCopied(false);
  };

  // 一键配置
  const handleQuickSetup = async (e: React.MouseEvent, agent: { id: string; name?: string }) => {
    e.stopPropagation();

    let localMember = getLocalAIMember(agent);

    // 如果没有本地成员，自动创建（Gateway 连接时应该已自动创建，这里作为兜底）
    if (!localMember) {
      try {
        const newMember = await createMember({
          name: agent.name || agent.id,
          type: 'ai',
          openclawGatewayUrl: gwUrl,
          openclawAgentId: agent.id,
        });
        if (!newMember) {
          alert('创建 AI 成员失败');
          return;
        }
        localMember = newMember;
      } catch (err) {
        console.error('Failed to create AI member:', err);
        alert('创建 AI 成员失败');
        return;
      }
    }

    setQuickSetupLoading(localMember.id);
    try {
      const res = await fetch(`/api/members/${localMember.id}/quick-setup`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        // 刷新数据后再跳转，确保新项目可见
        await Promise.all([fetchProjects(), fetchTasks()]);
        setQuickSetupResult({
          memberName: agent.name || agent.id,
          projectName: data.project.name,
          projectId: data.project.id,
          taskCount: data.tasks.length,
        });
      } else {
        alert(data.error || t('members.quickSetupFailed'));
      }
    } catch (err) {
      console.error('Quick setup failed:', err);
      alert(t('members.quickSetupFailed'));
    } finally {
      setQuickSetupLoading(null);
    }
  };

  // 重置密码（实际执行 API 调用）
  const handleResetPasswordInternal = async () => {
    if (!resetPasswordMember) return;

    setResetPasswordLoading(true);
    try {
      const res = await fetch(`/api/users/${resetPasswordMember.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setResetPasswordMember(null);
        setResetPasswordResult({
          newPassword: data.newPassword,
          memberName: resetPasswordMember.name,
        });
        setShowPassword(false);
      } else {
        alert(data.error || t('members.resetPasswordFailed'));
      }
    } catch (err) {
      console.error('Reset password failed:', err);
      alert(t('members.resetPasswordFailed'));
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // 重置密码入口（触发安全码验证）
  const handleResetPassword = () => {
    resetPasswordWithSecurity.verify();
  };

  return (
    <AppShell>
      <Header title={t('members.title')} />

      <main className="flex-1 p-6 overflow-auto max-w-5xl mx-auto space-y-8">
        {/* AI 成员 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-500" />
              <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('members.aiMembers')} ({isGwConnected ? agentsList.length : 0})
              </h2>
            </div>
            {isGwConnected && (
              <Link href="/agents" className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> {t('agents.title')} <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Gateway 连接状态提示 */}
          {isGwConnected && (
            <div className="mb-4 rounded-lg p-3 flex items-center gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('members.gatewayConnectedHint')}
              </p>
              <Link 
                href="/wiki?doc=VrihWxkCoM9Q" 
                className="text-xs text-primary-500 hover:underline ml-auto flex-shrink-0"
              >
                {t('members.viewDocs')}
              </Link>
            </div>
          )}

          {!isGwConnected ? (
            <div className="card p-8 text-center">
              <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('members.connectGateway')}</p>
              <Link href="/" className="text-xs text-primary-500 hover:text-primary-600 mt-2 inline-block">
                {t('members.goToDashboard')}
              </Link>
            </div>
          ) : agentsList.length === 0 ? (
            <div className="card p-8 text-center">
              <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('members.noAiMembers')}</p>
              <Link href="/agents" className="text-xs text-primary-500 hover:text-primary-600 mt-2 inline-block">
                {t('members.createAtAgentMgmt')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agentsList.map(agent => {
                const healthInfo = agentHealthList.find(h => h.agentId === agent.id);
                const localMember = getLocalAIMember(agent);
                const memberWithToken = localMember as typeof localMember & { hasApiToken?: boolean };
                const hasToken = memberWithToken?.hasApiToken || !!localMember?.openclawApiToken;
                const isLoading = quickSetupLoading === localMember?.id;
                return (
                  <div
                    key={agent.id}
                    className="card p-4 group"
                  >
                    {/* 上方：头像 + 信息（上下布局） */}
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => handleOpenEdit(agent)}
                    >
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                          agent.isDefault ? 'bg-primary-50 dark:bg-primary-950' : 'member-ai'
                        )}
                      >
                        <Bot className="w-5 h-5" style={{ color: agent.isDefault ? 'var(--primary-500)' : undefined }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 昵称（大字） */}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base truncate" style={{ color: 'var(--text-primary)' }}>
                            {localMember?.name || agent.name || agent.id}
                          </span>
                          {agent.isDefault && (
                            <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">{t('members.defaultAgent')}</Badge>
                          )}
                          {hasToken && (
                            <Key className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                        {/* URL 和 agentId（小字） */}
                        <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          <span className="truncate max-w-[120px]" title={gwUrl}>{gwUrl}</span>
                          <span className="text-[var(--border)]">|</span>
                          <span className="truncate" title={agent.id}>{agent.id}</span>
                        </div>
                        {/* 健康信息 */}
                        <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {healthInfo && (
                            <span className="flex items-center gap-0.5">
                              <Activity className="w-3 h-3" /> {healthInfo.sessions.count} {t('members.sessions')}
                            </span>
                          )}
                          {agent.identity?.emoji && <span>{agent.identity.emoji}</span>}
                        </div>
                      </div>
                    </div>
                    {/* 下方：操作按钮组（另起一行） */}
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      {/* 工作区目录按钮 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); router.push('/settings?tab=openclaw#agent-workspace'); }}
                        title={t('members.workspaceDir')}
                      >
                        <FolderSync className="w-3.5 h-3.5" />
                        <span className="ml-1">{t('members.workspaceDir')}</span>
                      </Button>
                      {/* 一键配置按钮 */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => handleQuickSetup(e, agent)}
                        disabled={isLoading}
                        title={!localMember ? t('members.quickSetupCreateHint') : undefined}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1">{t('members.quickSetup')}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isGwConnected && agentsList.length > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {t('members.aiManagedHint')} <Link href="/agents" className="text-primary-500 hover:underline">{t('members.agentMgmt')}</Link> {t('members.toOperate')}
            </p>
          )}
        </section>

        {/* 人类成员 */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-violet-500" />
            <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('members.humanMembers')} ({humanMembers.length})
            </h2>
          </div>

          {humanMembers.length === 0 ? (
            <div className="card p-8 text-center">
              <User className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('members.noHumanMembers')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {humanMembers.map(member => (
                <div key={member.id} className="card p-4 group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center member-human text-sm font-semibold flex-shrink-0">
                      {member.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</span>
                        {member.userRole === 'admin' && (
                          <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                            {t('members.admin')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('members.humanMember')}</div>
                    </div>
                    {/* 只有管理员能删除成员，且不能删除自己 */}
                    {isAdmin && member.userRole !== 'admin' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setResetPasswordMember({ id: member.id, name: member.name })}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                          title={t('members.resetPassword')}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setPendingDeleteId(member.id);
                            deleteWithSecurity.verify();
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* v3.0: 移除"添加成员对话框"，人类成员只能通过注册系统 (/login) 创建 */}

      {/* AI 成员编辑对话框 - MCP Token */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center member-ai flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.editAiMember')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{editingMember.name}</p>
              </div>
            </div>

            {/* MCP Token 说明 */}
            <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--surface-hover)' }}>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('members.tokenDescription')}
                </p>
              </div>
            </div>

            {/* 当前状态 */}
            <div className="mb-4">
              <label className="text-xs mb-2 block" style={{ color: 'var(--text-tertiary)' }}>
                {t('members.mcpApiToken')}
              </label>
              
              {!newToken ? (
                <div className="flex items-center justify-between rounded-lg p-3" style={{ background: 'var(--surface-hover)' }}>
                  <span className="text-sm" style={{ color: editingMember.hasToken ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                    {editingMember.hasToken ? t('members.hasToken') : t('members.noToken')}
                  </span>
                  {editingMember.hasToken && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {t('members.tokenHidden')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-hover)' }}>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono break-all" style={{ color: 'var(--text-primary)' }}>
                      {newToken}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopyToken(newToken)}
                      className="flex-shrink-0"
                    >
                      {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {t('members.tokenCopied')} - {t('members.copyToken')}
                  </p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 mb-4">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={handleGenerateToken}
                disabled={saving}
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('members.generateToken')}
              </Button>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditingMember(null); setNewToken(null); }}>
                {t('common.cancel')}
              </Button>
              {newToken && (
                <Button size="sm" onClick={handleSaveToken} disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 一键配置成功提示 */}
      {quickSetupResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.quickSetupSuccess')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {quickSetupResult.memberName}
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--surface-hover)' }}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('members.projectCreated')}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{quickSetupResult.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('members.tasksCreated')}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{quickSetupResult.taskCount} {t('members.tasksUnit')}</span>
                </div>
              </div>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('members.quickSetupHint')}
            </p>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQuickSetupResult(null)}>
                {t('common.close')}
              </Button>
              <Button size="sm" onClick={() => { setQuickSetupResult(null); router.push('/projects'); }}>
                {t('members.viewTasks')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{t('members.confirmDelete')}</h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('members.irreversible')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(null)}>{t('common.cancel')}</Button>
              <Button size="sm" variant="danger" onClick={async () => { await deleteMemberAsync(showDeleteConfirm); setShowDeleteConfirm(null); }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 安全码验证对话框 */}
      {deleteWithSecurity.showDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.securityVerification')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('members.enterSecurityCode')}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <Input
                type="password"
                placeholder={t('members.securityCodePlaceholder')}
                value={deleteWithSecurity.code}
                onChange={(e) => deleteWithSecurity.setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && deleteWithSecurity.submitCode()}
                autoFocus
              />
              {deleteWithSecurity.error && (
                <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{deleteWithSecurity.error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={deleteWithSecurity.cancel}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={deleteWithSecurity.submitCode} disabled={deleteWithSecurity.loading}>
                {deleteWithSecurity.loading ? t('members.verifying') : t('members.confirmBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码确认对话框 */}
      {resetPasswordMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.resetPassword')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {resetPasswordMember.name}
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--surface-hover)' }}>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('members.resetPasswordHint')}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setResetPasswordMember(null)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleResetPassword} disabled={resetPasswordLoading}>
                {resetPasswordLoading ? t('common.loading') : t('members.resetPassword')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码安全码验证对话框 */}
      {resetPasswordWithSecurity.showDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.securityVerification')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('members.enterSecurityCode')}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <Input
                type="password"
                placeholder={t('members.securityCodePlaceholder')}
                value={resetPasswordWithSecurity.code}
                onChange={(e) => resetPasswordWithSecurity.setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && resetPasswordWithSecurity.submitCode()}
                autoFocus
              />
              {resetPasswordWithSecurity.error && (
                <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{resetPasswordWithSecurity.error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={resetPasswordWithSecurity.cancel}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={resetPasswordWithSecurity.submitCode} disabled={resetPasswordWithSecurity.loading}>
                {resetPasswordWithSecurity.loading ? t('members.verifying') : t('members.confirmBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码成功 - 显示新密码 */}
      {resetPasswordResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members.resetPasswordSuccess')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {resetPasswordResult.memberName}
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--surface-hover)' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('members.newPassword')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(resetPasswordResult.newPassword);
                      if (tokenCopyTimerRef.current) clearTimeout(tokenCopyTimerRef.current);
                      setTokenCopied(true);
                      tokenCopyTimerRef.current = setTimeout(() => setTokenCopied(false), 2000);
                    }}
                  >
                    {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <code className="block text-sm font-mono break-all" style={{ color: 'var(--text-primary)' }}>
                {showPassword ? resetPasswordResult.newPassword : '••••••••••••'}
              </code>
            </div>

            <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
              <p className="text-xs" style={{ color: '#dc2626' }}>
                {t('members.newPasswordWarning')}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => { setResetPasswordResult(null); setShowPassword(false); }}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
