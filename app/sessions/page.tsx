'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGatewayStore } from '@/store/gateway.store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import GatewayRequired from '@/components/GatewayRequired';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useFilteredList } from '@/hooks/useFilteredList';
import type { Session, ThinkingLevel, VerboseLevel, ReasoningLevel, SessionKind } from '@/types';
import {
  MessageSquare, User, Trash2, Edit2, X, Save,
  Search, Hash, Globe, HelpCircle, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const VERBOSE_LEVELS: VerboseLevel[] = ['inherit', 'off', 'on', 'full'];
const REASONING_LEVELS: ReasoningLevel[] = ['off', 'on', 'stream'];

const kindIcons: Record<SessionKind, typeof Hash> = {
  direct: User,
  group: MessageSquare,
  global: Globe,
  unknown: HelpCircle,
};

export default function SessionsPage() {
  const { t } = useTranslation();
  const kindLabels: Record<SessionKind, string> = {
    direct: t('sessions.direct'),
    group: t('sessions.group'),
    global: t('sessions.global'),
    unknown: t('sessions.unknown'),
  };
  // 精确 selector 订阅
  const sessions = useGatewayStore((s) => s.sessions);
  const sessionsCount = useGatewayStore((s) => s.sessionsCount);
  const patchSession = useGatewayStore((s) => s.patchSession);
  const deleteSession = useGatewayStore((s) => s.deleteSession);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: '',
    thinkingLevel: '' as ThinkingLevel | '',
    verboseLevel: '' as VerboseLevel | '',
    reasoningLevel: '' as ReasoningLevel | '',
  });
  const deleteAction = useConfirmAction<string>();

  // 使用 useFilteredList 统一筛选逻辑
  const {
    filteredItems: filteredSessions,
    searchQuery: search,
    setSearchQuery: setSearch,
    activeFilters,
    toggleFilter,
  } = useFilteredList({
    items: sessions,
    config: {
      searchFields: ['key', 'label', 'displayName', 'derivedTitle', 'channel'],
      filters: {
        direct: (s) => s.kind === 'direct',
        group: (s) => s.kind === 'group',
        global: (s) => s.kind === 'global',
        unknown: (s) => s.kind === 'unknown',
      },
    },
  });

  // 将 activeFilters 转换为 kindFilter 用于 UI 显示
  const kindFilter: SessionKind | 'all' = activeFilters.length === 1 
    ? (activeFilters[0] as SessionKind) 
    : 'all';
  const setKindFilter = (kind: SessionKind | 'all') => {
    // 清除所有筛选并设置新的
    activeFilters.forEach(f => toggleFilter(f as string));
    if (kind !== 'all') {
      toggleFilter(kind);
    }
  };

  const handleStartEdit = (session: Session) => {
    setEditingKey(session.key);
    setEditForm({
      label: session.label || '',
      thinkingLevel: (session.thinkingLevel as ThinkingLevel) || '',
      verboseLevel: (session.verboseLevel as VerboseLevel) || '',
      reasoningLevel: (session.reasoningLevel as ReasoningLevel) || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    const updates: Record<string, unknown> = {};
    if (editForm.label) updates.label = editForm.label;
    if (editForm.thinkingLevel) updates.thinkingLevel = editForm.thinkingLevel;
    if (editForm.verboseLevel) updates.verboseLevel = editForm.verboseLevel;
    if (editForm.reasoningLevel) updates.reasoningLevel = editForm.reasoningLevel;
    await patchSession(editingKey, updates);
    setEditingKey(null);
  };

  const handleDelete = async (sessionKey: string) => {
    await deleteSession(sessionKey);
  };

  return (
    <AppShell>
      <Header title={t('sessions.title')} />

      <main className="flex-1 p-6 overflow-auto max-w-5xl mx-auto">
        <GatewayRequired feature={t('sessions.title')}>
            {/* 筛选栏 */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  icon={<Search className="w-4 h-4" />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('sessions.searchPlaceholder')}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'direct', 'group', 'global', 'unknown'] as const).map(kind => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={kindFilter === kind ? 'primary' : 'ghost'}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    onClick={() => setKindFilter(kind)}
                  >
                    {kind === 'all' ? t('sessions.all') : kindLabels[kind]}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="flex items-center gap-1.5"
                onClick={() => refreshSessions()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('sessions.refresh')}
              </Button>
            </div>

            {/* 统计 */}
            <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              {sessionsCount > sessions.length
                ? t('sessions.totalWithAll', { count: filteredSessions.length, total: sessionsCount })
                : t('sessions.totalSessions', { count: filteredSessions.length })}
            </div>

            {/* 会话列表 */}
            {filteredSessions.length === 0 ? (
              <div className="card p-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ color: 'var(--text-tertiary)' }}>{t('sessions.noMatchingSessions')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map(session => {
                  const KindIcon = kindIcons[session.kind || 'unknown'] || HelpCircle;
                  const isEditing = editingKey === session.key;

                  return (
                    <div key={session.key} className="card p-4 group">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                              {session.key}
                            </span>
                            <button onClick={() => setEditingKey(null)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5">
                              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>{t('sessions.label')}</label>
                              <Input
                                value={editForm.label}
                                onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                className="text-xs"
                                placeholder={t('sessions.sessionLabel')}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Thinking Level</label>
                              <Select
                                value={editForm.thinkingLevel}
                                onChange={e => setEditForm({ ...editForm, thinkingLevel: e.target.value as ThinkingLevel })}
                                className="text-xs"
                              >
                                <option value="">{t('sessions.noChange')}</option>
                                {THINKING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </Select>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Verbose Level</label>
                              <Select
                                value={editForm.verboseLevel}
                                onChange={e => setEditForm({ ...editForm, verboseLevel: e.target.value as VerboseLevel })}
                                className="text-xs"
                              >
                                <option value="">{t('sessions.noChange')}</option>
                                {VERBOSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </Select>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Reasoning Level</label>
                              <Select
                                value={editForm.reasoningLevel}
                                onChange={e => setEditForm({ ...editForm, reasoningLevel: e.target.value as ReasoningLevel })}
                                className="text-xs"
                              >
                                <option value="">{t('sessions.noChange')}</option>
                                {REASONING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setEditingKey(null)}>{t('sessions.cancel')}</Button>
                            <Button size="sm" className="flex items-center gap-1.5" onClick={handleSaveEdit}>
                              <Save className="w-3 h-3" /> {t('sessions.save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={clsx(
                              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                              session.kind === 'global' ? 'bg-emerald-50 dark:bg-emerald-950' :
                              session.kind === 'direct' ? 'bg-blue-50 dark:bg-blue-950' :
                              'bg-slate-100 dark:bg-slate-800'
                            )}>
                              <KindIcon className={clsx(
                                'w-4 h-4',
                                session.kind === 'global' ? 'text-emerald-500' :
                                session.kind === 'direct' ? 'text-blue-500' :
                                'text-slate-400'
                              )} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {session.displayName || session.derivedTitle || session.label || session.key}
                                </span>
                                <Badge className="text-[10px]">
                                  {kindLabels[session.kind || 'unknown']}
                                </Badge>
                                {session.channel && (
                                  <Badge className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    {session.channel}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                <span className="font-mono">{session.key}</span>
                                {session.model && <span>{session.model}</span>}
                                {session.totalTokens != null && (
                                  <span>{(session.totalTokens / 1000).toFixed(1)}k tokens</span>
                                )}
                                {session.updatedAt && (
                                  <span>
                                    {new Date(session.updatedAt).toLocaleString(undefined, {
                                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                              {session.lastMessagePreview && (
                                <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                                  {session.lastMessagePreview}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(session)}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                              title={t('sessions.edit')}
                            >
                              <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                            <button
                              onClick={() => deleteAction.requestConfirm(session.key)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                              title={t('sessions.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

        {/* 删除确认 */}
        <ConfirmDialog
          isOpen={deleteAction.isOpen}
          onClose={deleteAction.cancel}
          onConfirm={() => deleteAction.confirm(handleDelete)}
          title={t('sessions.deleteSession')}
          message={t('sessions.irreversible')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          isLoading={deleteAction.isLoading}
        />
        </GatewayRequired>
      </main>
    </AppShell>
  );
}
