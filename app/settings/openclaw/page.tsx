'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@/lib/i18n';
import { useOpenClawWorkspaceStore } from '@/core/gateway/openclaw-workspace.store';
import { WorkspaceCard } from '@/features/skill-manager/WorkspaceCard';
import { WorkspaceForm } from '@/features/skill-manager/WorkspaceForm';
import { GatewayConfigPanel } from '@/features/settings/GatewayConfigPanel';
import { Button } from '@/shared/ui';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Plus, RefreshCw, ArrowLeft, FolderSync } from 'lucide-react';
import clsx from 'clsx';

export default function OpenClawSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // 精确 selector 订阅
  const workspaces = useOpenClawWorkspaceStore((s) => s.workspaces);
  const loading = useOpenClawWorkspaceStore((s) => s.loading);
  const error = useOpenClawWorkspaceStore((s) => s.error);
  const fetchWorkspaces = useOpenClawWorkspaceStore((s) => s.fetchWorkspaces);
  const createWorkspace = useOpenClawWorkspaceStore((s) => s.createWorkspace);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <AppShell>
      <Header title={t('openclaw.title')} />
      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push('/settings')}
          className="flex items-center gap-1.5 text-xs mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('openclaw.backToSettings')}
        </button>

        {/* 标题区域 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-hover)' }}>
              <FolderSync className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('openclaw.title')}
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('openclaw.desc')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fetchWorkspaces()} disabled={loading}>
              <RefreshCw className={clsx('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
              {t('openclaw.refresh')}
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t('openclaw.add')}
            </Button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Gateway 连接模式配置 */}
        <div className="mb-6">
          <GatewayConfigPanel />
        </div>

        {/* Workspace 区域标题 */}
        <div className="flex items-center gap-2 mb-4">
          <FolderSync className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            OpenClaw Workspaces
          </span>
        </div>

        {/* 内容区域 */}
        {loading && workspaces.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('common.loading')}</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-hover)' }}>
              <FolderSync className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{t('openclaw.noWorkspace')}</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
              {t('openclaw.noWorkspaceHint')}
            </p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t('openclaw.createFirst')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}

        {/* 创建表单弹窗 */}
        {showForm && (
          <WorkspaceForm
            onClose={() => setShowForm(false)}
            onSubmit={async (data) => {
              const result = await createWorkspace({
                ...data,
                memberId: data.memberId ?? undefined,
              });
              if (result) {
                setShowForm(false);
              }
            }}
          />
        )}
      </main>
    </AppShell>
  );
}
