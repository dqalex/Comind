'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpenClawWorkspace } from '@/db/schema';
import { useOpenClawWorkspaceStore } from '@/core/gateway/openclaw-workspace.store';
import { useMemberStore } from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import { Button, Switch, Badge } from '@/components/ui';
import { Folder, RefreshCw, Trash2, Eye, Check, Bot } from 'lucide-react';
import { formatRelativeTime } from '@/hooks/useRelativeTime';
import clsx from 'clsx';

interface WorkspaceCardProps {
  workspace: OpenClawWorkspace;
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const { t, i18n } = useTranslation();
  // 精确 selector 订阅
  const updateWorkspace = useOpenClawWorkspaceStore((s) => s.updateWorkspace);
  const deleteWorkspace = useOpenClawWorkspaceStore((s) => s.deleteWorkspace);
  const syncWorkspace = useOpenClawWorkspaceStore((s) => s.syncWorkspace);
  const scanWorkspace = useOpenClawWorkspaceStore((s) => s.scanWorkspace);
  
  const members = useMemberStore((s) => s.members);
  
  const gwUrl = useGatewayStore((s) => s.gwUrl);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // 查找绑定的 AI 成员
  const boundMember = useMemo(() => {
    if (!workspace.memberId) return null;
    return members.find(m => m.id === workspace.memberId && m.type === 'ai');
  }, [workspace.memberId, members]);

  const handleToggleSync = async () => {
    await updateWorkspace(workspace.id, { syncEnabled: !workspace.syncEnabled });
  };

  const handleToggleWatch = async () => {
    await updateWorkspace(workspace.id, { watchEnabled: !workspace.watchEnabled });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const result = await syncWorkspace(workspace.id, 'incremental');
      if (result) {
        setSyncSuccess(true);
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => setSyncSuccess(false), 2000);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanWorkspace(workspace.id);
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`${t('common.delete')} "${workspace.name}"?\n\nNote: This will not delete local files.`)) {
      await deleteWorkspace(workspace.id);
    }
  };

  const statusColor = {
    idle: 'bg-green-500',
    syncing: 'bg-blue-500',
    error: 'bg-red-500',
  }[workspace.syncStatus || 'idle'];

  return (
    <div className="card p-4">
      {/* 绑定的 AI 成员信息 */}
      {boundMember && (
        <div className="flex items-center gap-2.5 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            'bg-cyan-50 dark:bg-cyan-950'
          )}>
            {boundMember.avatar ? (
              <img src={boundMember.avatar} alt={boundMember.name} className="w-8 h-8 rounded-full" />
            ) : (
              <Bot className="w-4 h-4 text-cyan-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {boundMember.name}
              </span>
              <Badge className="text-[9px]">AI</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              <span className="truncate max-w-[140px]" title={boundMember.openclawGatewayUrl || gwUrl}>
                {boundMember.openclawGatewayUrl || gwUrl}
              </span>
              {boundMember.openclawAgentId && (
                <>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span className="truncate" title={boundMember.openclawAgentId}>
                    {boundMember.openclawAgentId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {workspace.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={clsx('w-2 h-2 rounded-full', statusColor)} title={workspace.syncStatus ?? undefined} />
          {workspace.isDefault && (
            <Badge>{t('openclaw.default')}</Badge>
          )}
        </div>
      </div>

      <div className="text-xs truncate mb-3" style={{ color: 'var(--text-tertiary)' }} title={workspace.path}>
        {workspace.path}
      </div>

      {/* 未绑定提示 */}
      {!workspace.memberId && (
        <div className="text-[11px] mb-3 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
          {t('openclaw.notBound')}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('openclaw.sync')}</span>
          <Switch checked={workspace.syncEnabled ?? true} onChange={handleToggleSync} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('openclaw.watch')}</span>
          <Switch checked={workspace.watchEnabled ?? true} onChange={handleToggleWatch} />
        </div>
      </div>

      {workspace.lastSyncAt && (
        <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('openclaw.lastSync')}: {formatRelativeTime(workspace.lastSyncAt, i18n.language)}
          {workspace.syncEnabled && workspace.syncInterval && (
            <span className="ml-2">
              · {t('openclaw.syncInterval')}: {workspace.syncInterval} min
            </span>
          )}
        </div>
      )}

      {workspace.lastError && (
        <div className="text-xs mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
          {t('openclaw.error')}: {workspace.lastError}
        </div>
      )}

      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <Button size="sm" variant={syncSuccess ? 'primary' : 'secondary'} onClick={handleSync} disabled={syncing}>
          {syncSuccess ? (
            <Check className="w-3.5 h-3.5 mr-1" />
          ) : (
            <RefreshCw className={clsx('w-3.5 h-3.5 mr-1', syncing && 'animate-spin')} />
          )}
          {syncSuccess ? t('common.success') : t('openclaw.sync')}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleScan} disabled={scanning}>
          <Eye className="w-3.5 h-3.5 mr-1" />
          {t('openclaw.scan')}
        </Button>
        <Button size="sm" variant="danger" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
