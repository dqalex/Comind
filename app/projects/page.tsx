'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ProjectEditDialog } from '@/components/projects/ProjectEditDialog';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { useProjectStore, useTaskStore, useDocumentStore } from '@/domains';
import type { KnowledgeConfig } from '@/db/schema';
import { useGatewayStore } from '@/core/gateway/store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import {
  Folder, Plus, CheckSquare, FileText, Trash2, Edit2, X, Save,
  Bot, Clock, FolderSync, Home,
  Lock, Globe, Building2,
} from 'lucide-react';
import clsx from 'clsx';
import { Button, Input, Textarea, Select, Card } from '@/components/ui';

const PATROL_CRON_PREFIX = 'teamclaw-patrol:';

function buildPatrolMessage(projectName: string, _projectId: string): string {
  return `你是 TeamClaw 协作平台的 AI 成员，执行项目「${projectName}」的定时巡检。

## 巡检要求
1. 调用 list_tasks 查看项目「${projectName}」下所有未完成任务（status = todo / in_progress / reviewing）
2. 逐一检查任务进展，识别阻塞或延期风险
3. 对每个需要推进的任务，执行具体操作（更新状态、添加进展、创建文档等）
4. 生成一份简要巡检报告，通过 create_document 写入（doc_type: report）

请现在开始巡检。`;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams.get('edit');
  
  const INTERVAL_OPTIONS = [
    { label: '30 min', ms: 30 * 60 * 1000 },
    { label: '1 h', ms: 60 * 60 * 1000 },
    { label: '2 h', ms: 2 * 60 * 60 * 1000 },
    { label: '4 h', ms: 4 * 60 * 60 * 1000 },
    { label: '8 h', ms: 8 * 60 * 60 * 1000 },
    { label: '12 h', ms: 12 * 60 * 60 * 1000 },
    { label: '24 h', ms: 24 * 60 * 60 * 1000 },
  ];
  // 精确 selector 订阅
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProjectAsync = useProjectStore((s) => s.updateProjectAsync);
  const deleteProjectAsync = useProjectStore((s) => s.deleteProjectAsync);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  
  const tasks = useTaskStore((s) => s.tasks);
  const documents = useDocumentStore((s) => s.documents);
  
  const connected = useGatewayStore((s) => s.connected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const cronJobs = useGatewayStore((s) => s.cronJobs);
  const agentsList = useGatewayStore((s) => s.agentsList);
  const createCronJob = useGatewayStore((s) => s.createCronJob);
  const updateCronJob = useGatewayStore((s) => s.updateCronJob);
  const deleteCronJob = useGatewayStore((s) => s.deleteCronJob);
  const toggleCronJob = useGatewayStore((s) => s.toggleCronJob);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const gwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState<'private' | 'team' | 'public'>('private');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const deleteAction = useConfirmAction<string>();

  // 使用 useInlineEdit Hook 处理新建项目名称的 Enter/Blur 双重提交问题
  const { handleKeyDown: handleNewNameKeyDown, handleBlur: handleNewNameBlur, isSaving: isCreatingProject } = useInlineEdit({
    onSave: async () => {
      if (newName.trim()) {
        await handleCreate();
      }
    },
  });

  // 从 URL 参数打开编辑弹窗
  useEffect(() => {
    if (editIdFromUrl) {
      const project = projects.find(p => p.id === editIdFromUrl);
      if (project) {
        setEditingId(project.id);
        setEditName(project.name);
        setEditDesc(project.description || '');
        setEditVisibility(project.visibility || 'private');
        // 清除 URL 参数
        router.replace('/projects', { scroll: false });
      }
    }
  }, [editIdFromUrl, projects, router]);

  // 自动巡检配置弹窗
  const [patrolConfigId, setPatrolConfigId] = useState<string | null>(null);
  const [patrolInterval, setPatrolInterval] = useState(2 * 60 * 60 * 1000); // 默认 2 小时
  const [patrolAgentId, setPatrolAgentId] = useState('');

  // source 过滤
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'openclaw'>('all');

  // Escape key support for dialogs
  useEscapeKey(showNew, useCallback(() => setShowNew(false), []));
  useEscapeKey(!!patrolConfigId, useCallback(() => setPatrolConfigId(null), []));

  // 将 cronJobs 中属于巡检的 job 按项目 ID 映射
  const patrolJobMap = useMemo(() => {
    const map = new Map<string, typeof cronJobs[number]>();
    for (const job of cronJobs) {
      if (job.name.startsWith(PATROL_CRON_PREFIX)) {
        const pid = job.name.slice(PATROL_CRON_PREFIX.length);
        map.set(pid, job);
      }
    }
    return map;
  }, [cronJobs]);

  const projectStats = useMemo(() => {
    // 按 source 过滤项目
    const filtered = sourceFilter === 'all'
      ? projects
      : projects.filter(p => p.source === sourceFilter);

    return filtered.map(p => {
      const projectTasks = tasks.filter(t => t.projectId === p.id);
      const completed = projectTasks.filter(t => t.status === 'completed').length;
      const docCount = documents.filter(d => d.projectId === p.id).length;
      return {
        ...p,
        taskCount: projectTasks.length,
        completedCount: completed,
        docCount,
        pct: projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0,
      };
    });
  }, [projects, tasks, documents, sourceFilter]);

  // 统计各 source 数量
  const sourceCounts = useMemo(() => ({
    all: projects.length,
    local: projects.filter(p => p.source === 'local').length,
    openclaw: projects.filter(p => p.source === 'openclaw').length,
  }), [projects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const p = await createProject({ name: newName.trim(), description: newDesc.trim() || undefined });
    if (p) setCurrentProject(p.id);
    setNewName('');
    setNewDesc('');
    setShowNew(false);
  };

  const startEdit = (p: typeof projectStats[0]) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || '');
    setEditVisibility(p.visibility || 'private');
  };

  const saveEdit = async (name: string, desc: string, visibility: 'private' | 'team' | 'public', knowledgeConfig?: KnowledgeConfig) => {
    if (editingId && name.trim()) {
      await updateProjectAsync(editingId, { 
        name: name.trim(), 
        description: desc.trim() || undefined,
        visibility,
        knowledgeConfig,
      });
    }
    setEditingId(null);
  };

  // 获取可见性图标
  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'private': return <Lock className="w-3 h-3" />;
      case 'public': return <Globe className="w-3 h-3" />;
      case 'team': return <Building2 className="w-3 h-3" />;
      default: return <Lock className="w-3 h-3" />;
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProjectAsync(id);
  };

  // ===================== 自动巡检 =====================
  const handleTogglePatrol = useCallback(async (projectId: string, _projectName: string) => {
    const existingJob = patrolJobMap.get(projectId);
    if (existingJob) {
      // 已存在 → 切换启用/禁用
      await toggleCronJob(existingJob.id, !existingJob.enabled);
    } else {
      // 不存在 → 打开配置弹窗
      setPatrolConfigId(projectId);
      setPatrolInterval(2 * 60 * 60 * 1000);
      setPatrolAgentId('');
    }
  }, [patrolJobMap, toggleCronJob]);

  const handleCreatePatrol = async () => {
    if (!patrolConfigId) return;
    const project = projects.find(p => p.id === patrolConfigId);
    if (!project) return;

    await createCronJob({
      name: `${PATROL_CRON_PREFIX}${patrolConfigId}`,
      agentId: patrolAgentId || undefined,
      schedule: { kind: 'every', everyMs: patrolInterval },
      sessionTarget: 'main',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: buildPatrolMessage(project.name, project.id),
        thinking: 'low',
        timeoutSeconds: 300,
      },
      delivery: { mode: 'announce' },
    });
    await refreshCronJobs();
    setPatrolConfigId(null);
  };

  const handleUpdatePatrolInterval = async (projectId: string, newIntervalMs: number) => {
    const existingJob = patrolJobMap.get(projectId);
    if (!existingJob) return;
    await updateCronJob(existingJob.id, {
      schedule: { kind: 'every', everyMs: newIntervalMs },
    });
  };

  const handleDeletePatrol = async (projectId: string) => {
    const existingJob = patrolJobMap.get(projectId);
    if (!existingJob) return;
    await deleteCronJob(existingJob.id);
  };

  return (
    <AppShell>
      <Header
        title={t('projects.title')}
        actions={
          <div className="flex items-center gap-2">
            {/* source 过滤 */}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {([
                { key: 'all' as const, label: t('common.all'), icon: null },
                { key: 'local' as const, label: t('projects.localProjects'), icon: Home },
                { key: 'openclaw' as const, label: t('projects.syncedProjects'), icon: FolderSync },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSourceFilter(tab.key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors',
                    tab.key === 'all' && 'rounded-l-lg',
                    tab.key === 'openclaw' && 'rounded-r-lg',
                    sourceFilter === tab.key
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400'
                      : ''
                  )}
                  style={sourceFilter !== tab.key ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {tab.icon && <tab.icon className="w-3 h-3" />}
                  {tab.label}
                  <span className="text-[10px] opacity-60">{sourceCounts[tab.key]}</span>
                </button>
              ))}
            </div>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" /> {t('projects.newProject')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        {projectStats.length === 0 && !showNew ? (
          <Card className="p-12 text-center">
            <Folder className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>{t('projects.noProjects')}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('projects.noProjectsHint')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 新建表单卡片 */}
            {showNew && (
              <Card className="p-5 border-2 border-dashed" style={{ borderColor: 'var(--primary-500)' }}>
              <div className="space-y-3">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => handleNewNameKeyDown(e, newName)}
                  onBlur={() => handleNewNameBlur(newName)}
                  placeholder={t('projects.projectNamePlaceholder')}
                  className="text-sm font-medium"
                  autoFocus
                  disabled={isCreatingProject.current}
                />
                  <Textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder={t('projects.projectDescPlaceholder')}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowNew(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreatingProject.current}>
              <Save className="w-3.5 h-3.5" /> {t('common.create')}
            </Button>
                  </div>
                </div>
              </Card>
            )}

            {projectStats.map(p => {
              const patrolJob = patrolJobMap.get(p.id);
              const patrolEnabled = patrolJob?.enabled ?? false;
              const patrolMs = patrolJob?.schedule?.everyMs || 0;

              return (
                <Card key={p.id} className="p-5 group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center cursor-pointer" onClick={() => setCurrentProject(p.id)}>
                      <Folder className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setCurrentProject(p.id)}>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                        {p.source === 'openclaw' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                            {t('projects.synced')}
                          </span>
                        )}
                        {/* 项目类型标签 - 使用图标 */}
                        <span className={clsx(
                          "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1",
                          p.visibility === 'private' && "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300",
                          p.visibility === 'team' && "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300",
                          p.visibility === 'public' && "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300"
                        )}>
                          {getVisibilityIcon(p.visibility || 'private')}
                          {t(`projects.visibility${(p.visibility || 'private').charAt(0).toUpperCase() + (p.visibility || 'private').slice(1)}`)}
                        </span>
                      </div>
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>{p.description || t('projects.noDesc')}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                        <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                      <button onClick={() => deleteAction.requestConfirm(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> {p.taskCount} {t('projects.tasks')}</span>
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {p.docCount} {t('projects.docs')}</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div className="text-xs mt-1 text-right" style={{ color: 'var(--text-tertiary)' }}>
                    {p.completedCount}/{p.taskCount} {t('projects.completed')} ({p.pct}%)
                  </div>

                      {/* AI 自动巡检 */}
                      {gwConnected && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                          <button
                            onClick={() => handleTogglePatrol(p.id, p.name)}
                            className={clsx(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                              patrolEnabled
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            )}
                            style={!patrolEnabled ? { color: 'var(--text-tertiary)' } : undefined}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            {patrolJob ? (patrolEnabled ? t('projects.aiPatrolling') : t('projects.aiPatrolPaused')) : t('projects.aiPatrol')}
                          </button>

                          {patrolJob && (
                            <>
                              <Select
                                value={patrolMs}
                                onChange={e => handleUpdatePatrolInterval(p.id, Number(e.target.value))}
                                className="text-[10px] py-1 px-1.5 w-auto"
                                onClick={e => e.stopPropagation()}
                              >
                                {INTERVAL_OPTIONS.map(opt => (
                                  <option key={opt.ms} value={opt.ms}>{opt.label}</option>
                                ))}
                              </Select>
                              {patrolJob.state?.nextRunAtMs && patrolJob.state.nextRunAtMs > 0 && patrolEnabled && (
                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                  <Clock className="w-2.5 h-2.5" />
                                  {t('projects.nextRun')} {new Date(patrolJob.state.nextRunAtMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              <button
                                onClick={() => handleDeletePatrol(p.id)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t('projects.deletePatrol')}
                              >
                                <X className="w-3 h-3 text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(handleDelete)}
        title={t('projects.deleteProject')}
        message={t('projects.deleteProjectHint')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />

      {/* 编辑项目弹窗 */}
      <ProjectEditDialog
        projectId={editingId}
        projectName={editName}
        projectDesc={editDesc}
        projectVisibility={editVisibility}
        knowledgeConfig={editingId ? projects.find(p => p.id === editingId)?.knowledgeConfig : undefined}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
        onSave={saveEdit}
      />

      {/* 自动巡检配置弹窗 */}
      {patrolConfigId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-6 w-96">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{t('projects.enableAiPatrol')}</h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('projects.enableAiPatrolHint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('projects.patrolInterval')}</label>
                <Select
                  value={patrolInterval}
                  onChange={e => setPatrolInterval(Number(e.target.value))}
                >
                  {INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.ms} value={opt.ms}>{opt.label}</option>
                  ))}
                </Select>
              </div>

              {agentsList.length > 0 && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('projects.patrolAgent')}</label>
                  <Select
                    value={patrolAgentId}
                    onChange={e => setPatrolAgentId(e.target.value)}
                  >
                    <option value="">{t('projects.defaultAgent')}</option>
                    {agentsList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.identity?.name || a.name || a.id}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setPatrolConfigId(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreatePatrol}>
                <Bot className="w-3.5 h-3.5" /> {t('projects.startPatrol')}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </AppShell>
  );
}
