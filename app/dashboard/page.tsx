'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { useProjectStore, useTaskStore, useMemberStore, useDocumentStore, useDeliveryStore, useOpenClawStatusStore } from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import { RelativeTimeDisplay } from '@/shared/components/RelativeTimeDisplay';
import Link from 'next/link';
import clsx from 'clsx';
import {
  CheckSquare, FileText, Users, Send, Clock, Bot, FolderKanban,
  AlertCircle, Wifi, WifiOff, Cpu, HardDrive, Activity,
  Zap, MessageSquare, Monitor, Shield, Radio, Heart, Database,
  RefreshCw, ChevronDown, CheckCircle, XCircle, ArrowUpRight, Settings,
} from 'lucide-react';
import { Button, Card, Badge } from '@/shared/ui';

export default function DashboardPage() {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const members = useMemberStore((s) => s.members);
  const getAIMembers = useMemberStore((s) => s.getAIMembers);
  const getHumanMembers = useMemberStore((s) => s.getHumanMembers);
  const documents = useDocumentStore((s) => s.documents);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const statusList = useOpenClawStatusStore((s) => s.statusList);
  const getByMemberId = useOpenClawStatusStore((s) => s.getByMemberId);
  
  const connected = useGatewayStore((s) => s.connected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);
  const gwError = useGatewayStore((s) => s.error);
  const snapshot = useGatewayStore((s) => s.snapshot);
  const health = useGatewayStore((s) => s.health);
  const sessions = useGatewayStore((s) => s.sessions);
  const sessionsCount = useGatewayStore((s) => s.sessionsCount);
  const cronJobs = useGatewayStore((s) => s.cronJobs);
  const agentsList = useGatewayStore((s) => s.agentsList);
  const agentHealthList = useGatewayStore((s) => s.agentHealthList);
  const gwUrl = useGatewayStore((s) => s.gwUrl);
  const refreshSnapshot = useGatewayStore((s) => s.refreshSnapshot);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const skills = useGatewayStore((s) => s.skills);
  const helloPayload = useGatewayStore((s) => s.helloPayload);
  const lastChannelsRefresh = useGatewayStore((s) => s.lastChannelsRefresh);

  const isGwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;

  const DEFAULT_GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:18789';
  const [showChannels, setShowChannels] = useState(false);

  const aiMembers = useMemo(() => getAIMembers(), [getAIMembers, members]);
  const humanMembers = useMemo(() => getHumanMembers(), [getHumanMembers, members]);

  const stats = useMemo(() => {
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const reviewing = tasks.filter(t => t.status === 'reviewing').length;
    const pendingDeliveries = deliveries.filter(d => d.status === 'pending').length;
    const workingAI = aiMembers.filter(m => {
      const s = getByMemberId(m.id);
      return s?.status === 'working';
    }).length;
    return { totalTasks: tasks.length, inProgress, reviewing, totalProjects: projects.length, totalDocs: documents.length, pendingDeliveries, totalMembers: members.length, aiCount: aiMembers.length, humanCount: humanMembers.length, workingAI };
  }, [tasks, projects, documents, deliveries, members, aiMembers, humanMembers, statusList, getByMemberId]);

  const statCards = [
    { label: t('tasks.inProgress'), value: stats.inProgress, icon: CheckSquare, color: 'text-indigo-500', bg: 'stat-gradient-blue', iconBg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { label: t('tasks.reviewing'), value: stats.reviewing, icon: AlertCircle, color: 'text-amber-500', bg: 'stat-gradient-amber', iconBg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: t('deliveries.pending'), value: stats.pendingDeliveries, icon: Send, color: 'text-violet-500', bg: 'stat-gradient-violet', iconBg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: t('members.working'), value: stats.workingAI, icon: Bot, color: 'text-cyan-500', bg: 'stat-gradient-cyan', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  ];

  const quickLinks = [
    { href: '/tasks', label: t('tasks.title'), icon: CheckSquare, desc: `${stats.totalTasks} ${t('projects.tasks')}`, color: 'from-indigo-500 to-blue-500' },
    { href: '/wiki', label: t('wiki.title'), icon: FileText, desc: `${stats.totalDocs} ${t('projects.docs')}`, color: 'from-emerald-500 to-teal-500' },
    { href: '/members', label: t('members.title'), icon: Users, desc: `${stats.totalMembers} ${t('nav.members')}`, color: 'from-violet-500 to-purple-500' },
    { href: '/deliveries', label: t('deliveries.title'), icon: Send, desc: `${stats.pendingDeliveries} ${t('deliveries.pending')}`, color: 'from-amber-500 to-orange-500' },
    { href: '/projects', label: t('projects.title'), icon: FolderKanban, desc: `${stats.totalProjects} ${t('nav.projects')}`, color: 'from-pink-500 to-rose-500' },
    { href: '/agents', label: t('agents.title'), icon: Bot, desc: `${agentsList.length} Agent`, color: 'from-cyan-500 to-blue-500' },
    { href: '/schedule', label: t('scheduler.title'), icon: Clock, desc: `${cronJobs.length} ${t('scheduler.jobs')}`, color: 'from-slate-500 to-gray-600' },
  ];

  const handleRefresh = () => {
    refreshSnapshot();
    refreshHealth();
  };

  const formatUptime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <AppShell>
      <Header title={t('dashboard.title')} />
      <div className="p-8 lg:p-12 max-w-[1400px] mx-auto space-y-10">
        {/* Gateway 连接 */}
        <Card className="p-8 overflow-hidden relative border-none shadow-2xl shadow-indigo-500/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
          {/* 已连接时显示微妙的渐变背景 */}
          {isGwConnected && (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-cyan-500/[0.03] dark:from-emerald-500/[0.05] dark:to-cyan-500/[0.05]" />
          )}
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner',
                  isGwConnected ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                )}>
                  {isGwConnected ? (
                    <Wifi className="w-6 h-6 animate-pulse" />
                  ) : (
                    <WifiOff className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    OpenClaw Gateway
                  </h2>
                  {isGwConnected ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-breathe" />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {t('dashboard.connected')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t('dashboard.disconnected')}
                    </span>
                  )}
                </div>
              </div>
              {isGwConnected && (
                <Button variant="ghost" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="w-3.5 h-3.5" /> {t('dashboard.refresh')}
                </Button>
              )}
            </div>

            {!isGwConnected && (
              <div className="mt-4 p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <div className="flex items-center gap-3">
                  {connectionStatus?.startsWith('error_') ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Settings className="w-5 h-5 text-amber-500" />
                  )}
                  <div className="flex-1">
                    {connectionStatus === 'error_auth' ? (
                      <>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          Gateway 认证失败
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          Token 无效或已过期，请在设置中检查 Gateway 配置
                        </p>
                      </>
                    ) : connectionStatus === 'error_connection' ? (
                      <>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          Gateway 连接失败
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          无法连接到 Gateway，请检查地址是否正确或 Gateway 是否已启动
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t('dashboard.configureGateway')}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {t('dashboard.configureGatewayDesc')}
                        </p>
                      </>
                    )}
                  </div>
                  <Link href="/settings?tab=gateway" className="ml-auto">
                    <Button size="sm">
                      <Settings className="w-3.5 h-3.5" /> {t('dashboard.goToSettings')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            {gwError && <p className="text-xs text-red-500 mt-2 font-medium">{gwError}</p>}

            {isGwConnected && (
              <>
                {/* Snapshot 核心指标 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <Wifi className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.status')}</div>
                      <div className="text-sm font-bold font-display text-emerald-600 dark:text-emerald-400">OK</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.uptime')}</div>
                      <div className="text-sm font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                        {snapshot?.uptimeMs ? formatUptime(snapshot.uptimeMs) : '--'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary-500" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Tick Interval</div>
                      <div className="text-sm font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                        {(helloPayload?.policy?.tickIntervalMs ?? snapshot?.policy?.tickIntervalMs)
                          ? `${helloPayload?.policy?.tickIntervalMs ?? snapshot?.policy?.tickIntervalMs}ms`
                          : '--'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.channelRefresh')}</div>
                      <div className="text-sm font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                        <RelativeTimeDisplay timestamp={lastChannelsRefresh} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instances / Sessions / Cron */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="rounded-xl p-4 border transition-all duration-200 hover:shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>Instances</span>
                    </div>
                    <div className="text-2xl font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>
                      {snapshot?.presence?.length ?? 0}
                    </div>
                    <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.onlineInstances')}</div>
                  </div>
                  <div className="rounded-xl p-4 border transition-all duration-200 hover:shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>Sessions</span>
                    </div>
                    <div className="text-2xl font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>
                      {sessionsCount || sessions.length}
                    </div>
                    <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.activeSessions')}</div>
                  </div>
                  <div className="rounded-xl p-4 border transition-all duration-200 hover:shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>Cron</span>
                    </div>
                    <div className="text-2xl font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>
                      {cronJobs.length > 0
                        ? (cronJobs.some(j => j.enabled) ? t('dashboard.enabled') : t('dashboard.disabled'))
                        : '--'}
                    </div>
                    <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {(() => {
                        const enabledJobs = cronJobs.filter(j => j.enabled);
                        if (enabledJobs.length === 0) return t('dashboard.tasks', { count: cronJobs.length });
                        const nextJob = enabledJobs
                          .filter(j => j.state?.nextRunAtMs)
                          .sort((a, b) => (a.state?.nextRunAtMs ?? 0) - (b.state?.nextRunAtMs ?? 0))[0];
                        if (nextJob?.state?.nextRunAtMs) {
                          return <RelativeTimeDisplay timestamp={nextJob.state.nextRunAtMs} />;
                        }
                        return t('dashboard.enabledOfTotal', { enabled: enabledJobs.length, total: cronJobs.length });
                      })()}
                    </div>
                  </div>
                </div>

                {/* 补充信息行 */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="rounded-xl p-3 border flex items-center gap-2.5 transition-all duration-200" style={{ borderColor: 'var(--border)' }}>
                    <Shield className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.authMode')}</div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{snapshot?.authMode || 'none'}</div>
                    </div>
                  </div>
                  {health && (
                    <div className="rounded-xl p-3 border flex items-center gap-2.5 transition-all duration-200" style={{ borderColor: 'var(--border)' }}>
                      <Heart className="w-4 h-4 text-pink-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('dashboard.heartbeatInterval')}</div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{health.heartbeatSeconds}s</div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl p-3 border flex items-center gap-2.5 transition-all duration-200" style={{ borderColor: 'var(--border)' }}>
                    <Bot className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Agents</div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{agentsList.length}</div>
                    </div>
                  </div>
                  <div className="rounded-xl p-3 border flex items-center gap-2.5 transition-all duration-200" style={{ borderColor: 'var(--border)' }}>
                    <Database className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Skills</div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{skills.length}</div>
                    </div>
                  </div>
                </div>

                {/* 频道状态 */}
                {health && health.channels && Object.keys(health.channels).length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowChannels(!showChannels)}
                      className="flex items-center gap-2 text-xs font-semibold mb-3 transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      {t('dashboard.channelStatus')} ({Object.keys(health.channels).length})
                      <ChevronDown className={clsx('w-3 h-3 transition-transform duration-200', showChannels && 'rotate-180')} />
                    </button>
                    {showChannels && (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 animate-fadeIn">
                        {(health.channelOrder || Object.keys(health.channels)).map(name => {
                          const ch = health.channels[name];
                          if (!ch) return null;
                          const label = health.channelLabels?.[name] || name;
                          const isOk = ch.configured && ch.linked;
                          return (
                            <div key={name} className="rounded-xl p-3 border flex items-center gap-2.5 transition-all duration-200 hover:shadow-sm" style={{ borderColor: 'var(--border)' }}>
                              {isOk ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
                                ch.configured ? <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" /> :
                                <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{label}</div>
                                <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                                  {ch.configured ? (ch.linked ? t('dashboard.configuredLinked') : t('dashboard.configuredNotLinked')) : t('dashboard.notConfigured')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Agent 健康状态 */}
                {agentHealthList.length > 0 && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {t('dashboard.agentStatus')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {agentHealthList.map(agent => (
                        <div key={agent.agentId} className="rounded-xl p-3.5 border flex items-center gap-3 transition-all duration-200 hover:shadow-sm" style={{ borderColor: 'var(--border)' }}>
                          <div className={clsx(
                            'w-9 h-9 rounded-xl flex items-center justify-center',
                            agent.isDefault ? 'bg-primary-50 dark:bg-primary-500/10' : 'bg-slate-50 dark:bg-white/5'
                          )}>
                            <Bot className="w-4 h-4" style={{ color: agent.isDefault ? 'var(--brand)' : 'var(--text-tertiary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {agent.name || agent.agentId}
                              </span>
                              {agent.isDefault && <span className="tag text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">{t('dashboard.defaultLabel')}</span>}
                            </div>
                            <div className="text-[11px] flex items-center gap-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                              <span>{agent.sessions.count} {t('dashboard.sessions')}</span>
                              <span>{t('dashboard.heartbeat')} {agent.heartbeat.enabled ? agent.heartbeat.every : t('dashboard.off')}</span>
                              {agent.heartbeat.model && <span>{agent.heartbeat.model}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className={clsx('p-8 border-none hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 animate-fadeIn bg-gradient-to-br', card.bg)} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg', card.iconBg)}>
                  <Icon className={clsx('w-7 h-7', card.color)} />
                </div>
                <div className="text-5xl font-extrabold font-display tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>{card.value}</div>
                <div className="text-[15px] font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-primary)' }}>{card.label}</div>
              </Card>
            );
          })}
        </div>

        {/* 快速入口 */}
        <div>
          <h2 className="section-title mb-6 px-1 tracking-[0.2em]">{t('dashboard.quickAccess')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {quickLinks.map((link, i) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="card card-interactive p-6 flex items-center gap-5 group animate-fadeIn border-none shadow-xl shadow-slate-200/20 dark:shadow-black/20"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={clsx('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-lg', link.color)}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{link.label}</div>
                    <div className="text-xs font-medium opacity-50" style={{ color: 'var(--text-primary)' }}>{link.desc}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" style={{ color: 'var(--text-tertiary)' }} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* AI 成员状态 */}
        {aiMembers.length > 0 && (
          <div>
            <h2 className="font-display text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.aiMemberStatus')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiMembers.map((member) => {
                const status = getByMemberId(member.id);
                const isWorking = status?.status === 'working';
                return (
                  <Card key={member.id} className={clsx('p-4 transition-all duration-300', isWorking && 'ai-glow')}>
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
                        isWorking
                          ? 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-sm'
                          : 'bg-slate-100 dark:bg-white/5'
                      )}>
                        <Bot className={clsx('w-5 h-5', isWorking ? 'text-white' : 'text-slate-400')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={clsx(
                            'w-1.5 h-1.5 rounded-full transition-all',
                            isWorking ? 'bg-cyan-400 animate-breathe' : 'bg-slate-300 dark:bg-slate-600'
                          )} />
                          <span className="text-[11px] font-medium" style={{ color: isWorking ? 'var(--ai)' : 'var(--text-tertiary)' }}>
                            {isWorking ? t('dashboard.working') : t('dashboard.idle')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {status?.currentTaskId && (
                      <div className="mt-3 text-[11px] truncate font-mono px-2 py-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}>
                        {t('dashboard.currentTask')}: {status.currentTaskId.slice(0, 8)}...
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 项目概览 */}
        {projects.length > 0 && (
          <div>
            <h2 className="font-display text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.projectOverview')}</h2>
            <div className="space-y-2.5">
              {projects.map((project) => {
                const projectTasks = tasks.filter(t => t.projectId === project.id);
                const completed = projectTasks.filter(t => t.status === 'completed').length;
                const total = projectTasks.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <Card key={project.id} className="p-4 hover:shadow-sm transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{completed}/{total} {t('dashboard.completed')}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? 'var(--success)' : 'var(--gradient-brand)',
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
