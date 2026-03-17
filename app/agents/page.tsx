'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import GatewayRequired from '@/components/GatewayRequired';
import { Button, Badge } from '@/components/ui';
import { useGatewayStore } from '@/core/gateway/store';
import clsx from 'clsx';
import {
  Bot, Eye, FolderOpen, Zap, Radio, Clock,
  Star, Hash, Plus, RefreshCw, Trash2, MessageSquare, Wrench,
} from 'lucide-react';
import {
  CreateAgentDialog,
  OverviewPanel,
  SkillsPanel,
  ChannelsPanel,
  CronPanel,
  FilesPanel,
  ToolsPanel,
  SessionsPanel,
} from '@/components/agents';

type AgentsPanel = 'overview' | 'files' | 'tools' | 'skills' | 'channels' | 'cron' | 'sessions';

export default function AgentsPage() {
  const { t } = useTranslation();

  const PANEL_TABS: { key: AgentsPanel; label: string; icon: typeof Eye }[] = [
    { key: 'overview', label: t('agents.overview'), icon: Eye },
    { key: 'files', label: t('agents.files'), icon: FolderOpen },
    { key: 'tools', label: t('agents.tools'), icon: Wrench },
    { key: 'skills', label: t('agents.skills'), icon: Zap },
    { key: 'channels', label: t('agents.channels'), icon: Radio },
    { key: 'cron', label: t('agents.cron'), icon: Clock },
    { key: 'sessions', label: t('agents.sessionsTab'), icon: MessageSquare },
  ];

  // 精确 selector 订阅
  const agentsList = useGatewayStore((s) => s.agentsList);
  const agentsDefaultId = useGatewayStore((s) => s.agentsDefaultId);
  const health = useGatewayStore((s) => s.health);
  const agentHealthList = useGatewayStore((s) => s.agentHealthList);
  const cronJobs = useGatewayStore((s) => s.cronJobs);
  const skills = useGatewayStore((s) => s.skills);
  const gwSessions = useGatewayStore((s) => s.sessions);
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const toggleCronJob = useGatewayStore((s) => s.toggleCronJob);
  const runCronJob = useGatewayStore((s) => s.runCronJob);
  const deleteCronJob = useGatewayStore((s) => s.deleteCronJob);
  const toggleSkill = useGatewayStore((s) => s.toggleSkill);
  const installSkill = useGatewayStore((s) => s.installSkill);
  const createAgent = useGatewayStore((s) => s.createAgent);
  const deleteAgent = useGatewayStore((s) => s.deleteAgent);
  const configForm = useGatewayStore((s) => s.configForm);
  const configLoading = useGatewayStore((s) => s.configLoading);
  const configSaving = useGatewayStore((s) => s.configSaving);
  const configDirty = useGatewayStore((s) => s.configDirty);
  const loadConfig = useGatewayStore((s) => s.loadConfig);
  const saveConfig = useGatewayStore((s) => s.saveConfig);
  const reloadConfig = useGatewayStore((s) => s.reloadConfig);
  const updateConfigForm = useGatewayStore((s) => s.updateConfigForm);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<AgentsPanel>('overview');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const deleteConfirm = useConfirmAction<string>();

  // Escape key support for dialogs
  useEscapeKey(showCreateDialog, useCallback(() => setShowCreateDialog(false), []));

  useEffect(() => {
    if (!selectedAgentId && agentsList.length > 0) {
      setSelectedAgentId(agentsDefaultId || agentsList[0].id);
    }
  }, [agentsList, agentsDefaultId, selectedAgentId]);

  const selectedAgent = useMemo(
    () => agentsList.find(a => a.id === selectedAgentId) || null,
    [agentsList, selectedAgentId]
  );

  const selectedAgentHealth = useMemo(
    () => agentHealthList.find(a => a.agentId === selectedAgentId) || null,
    [agentHealthList, selectedAgentId]
  );

  const agentCronJobs = useMemo(
    () => cronJobs.filter(j => j.agentId === selectedAgentId),
    [cronJobs, selectedAgentId]
  );

  const agentSessions = useMemo(
    () => gwSessions.filter(s => {
      if (!selectedAgentId) return false;
      return s.key?.includes(selectedAgentId);
    }),
    [gwSessions, selectedAgentId]
  );

  // Pre-build Map for O(1) health lookup instead of O(N×M) find()
  const healthByAgentId = useMemo(() => {
    const map = new Map<string, typeof agentHealthList[number]>();
    for (const h of agentHealthList) map.set(h.agentId, h);
    return map;
  }, [agentHealthList]);

  const handleDelete = async (agentId: string) => {
    await deleteAgent(agentId);
    if (selectedAgentId === agentId) {
      setSelectedAgentId(agentsList.find(a => a.id !== agentId)?.id || null);
    }
  };

  return (
    <AppShell>
      <GatewayRequired feature={t('agents.title')}>
      <Header title={t('agents.title')} actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex items-center gap-1.5 text-xs"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('agents.newAgent')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-1.5 text-xs"
            onClick={() => { refreshAgents(); refreshHealth(); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('agents.refresh')}
          </Button>
        </div>
      } />
      <div className="flex h-[calc(100vh-49px)]">
        {/* 左侧 Agent 列表 */}
        <div className="w-56 border-r flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Agents ({agentsList.length})
            </div>
            <div className="space-y-0.5">
              {agentsList.map(agent => {
                const agentHealth = healthByAgentId.get(agent.id);
                const isSelected = selectedAgentId === agent.id;
                const isDefault = agent.isDefault || agent.id === agentsDefaultId;
                const displayName = agent.identity?.name || agent.name || agent.id;
                const emoji = agent.identity?.emoji;
                return (
                  <button
                    key={agent.id}
                    onClick={() => { setSelectedAgentId(agent.id); setActivePanel('overview'); }}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left',
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-950'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0',
                      isSelected
                        ? 'bg-primary-100 dark:bg-primary-900'
                        : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                      {emoji || <Bot className="w-4 h-4" style={{ color: isSelected ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={clsx('text-[13px] font-medium truncate', isSelected && 'text-primary-700 dark:text-primary-300')} style={!isSelected ? { color: 'var(--text-primary)' } : undefined}>
                          {displayName}
                        </span>
                        {isDefault && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      </div>
                      <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="truncate">
                          {agentHealth ? `${agentHealth.sessions.count} ${t('agents.sessions')}` : agent.id}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {agentsList.length === 0 && (
                <div className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
                  {t('agents.noAgents')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧详情区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedAgent ? (
            <>
              {/* Agent Header */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-lg">
                    {selectedAgent.identity?.emoji || <Bot className="w-5 h-5 text-primary-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {selectedAgent.identity?.name || selectedAgent.name || selectedAgent.id}
                      </h2>
                      {(selectedAgent.isDefault || selectedAgent.id === agentsDefaultId) && (
                        <Badge className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">{t('agents.default')}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{selectedAgent.id}</span>
                      {selectedAgentHealth && (
                        <>
                          <span>{selectedAgentHealth.sessions.count} {t('agents.sessions')}</span>
                          <span>{t('agents.heartbeatLabel')} {selectedAgentHealth.heartbeat.enabled ? selectedAgentHealth.heartbeat.every : t('agents.disabled')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    className="flex items-center gap-1 text-xs"
                    onClick={() => deleteConfirm.requestConfirm(selectedAgent.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b flex gap-0.5" style={{ borderColor: 'var(--border)' }}>
                {PANEL_TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activePanel === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActivePanel(tab.key)}
                      className={clsx(
                        'px-3 py-2.5 text-[13px] font-medium flex items-center gap-1.5 border-b-2 transition-colors',
                        isActive
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent hover:text-primary-500'
                      )}
                      style={!isActive ? { color: 'var(--text-secondary)' } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activePanel === 'overview' && (
                  <OverviewPanel agent={selectedAgent} agentHealth={selectedAgentHealth} />
                )}
                {activePanel === 'skills' && (
                  <SkillsPanel skills={skills} onToggle={toggleSkill} onInstall={installSkill} />
                )}
                {activePanel === 'tools' && (
                  <ToolsPanel
                    agentId={selectedAgentId!}
                    configForm={configForm}
                    configLoading={configLoading}
                    configSaving={configSaving}
                    configDirty={configDirty}
                    onConfigReload={reloadConfig}
                    onConfigSave={saveConfig}
                    onConfigLoad={loadConfig}
                    onConfigUpdate={updateConfigForm}
                  />
                )}
                {activePanel === 'channels' && (
                  <ChannelsPanel health={health} />
                )}
                {activePanel === 'cron' && (
                  <CronPanel
                    jobs={agentCronJobs}
                    allJobs={cronJobs}
                    agentId={selectedAgentId!}
                    onToggle={toggleCronJob}
                    onRun={runCronJob}
                    onDelete={deleteCronJob}
                  />
                )}
                {activePanel === 'files' && (
                  <FilesPanel agentId={selectedAgentId!} />
                )}
                {activePanel === 'sessions' && (
                  <SessionsPanel sessions={agentSessions} allSessions={gwSessions} agentId={selectedAgentId!} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
              <Bot className="w-12 h-12 mb-3" />
              <p className="text-sm">{t('agents.selectAgent')}</p>
            </div>
          )}
        </div>
      </div>

      {/* 新建 Agent 对话框 */}
      {showCreateDialog && (
        <CreateAgentDialog
          onCreate={createAgent}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.cancel}
        onConfirm={() => deleteConfirm.confirm(handleDelete)}
        title={t('agents.deleteAgent')}
        message={t('agents.deleteAgentDesc')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteConfirm.isLoading}
      />
      </GatewayRequired>
    </AppShell>
  );
}


