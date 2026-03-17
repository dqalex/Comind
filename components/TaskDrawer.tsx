'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useTaskStore, useMemberStore, useCommentStore, useTaskLogStore, useDocumentStore, useChatStore, useProjectStore, useOpenClawWorkspaceStore, useMilestoneStore } from '@/store';
import { useGatewayStore } from '@/store/gateway.store';
import { useAuthStore } from '@/store/auth.store';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import { useTaskSOP } from '@/hooks/useTaskSOP';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskComments from '@/components/TaskComments';
import TaskLogs from '@/components/TaskLogs';
import { Input, Select, Textarea } from '@/components/ui';
import type { Task } from '@/db/schema';
import DocumentPicker from '@/components/DocumentPicker';
import { SOPProgressBar } from '@/components/sop';
import {
  X, Trash2, MessageSquare,
  CheckSquare, Square, Plus, FileText, Link2, Send,
  History,
} from 'lucide-react';
import clsx from 'clsx';

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function TaskDrawer({ task, onClose, onDelete }: TaskDrawerProps) {
  const { t, i18n } = useTranslation();

  // 常量定义移入组件内以使用 i18n
  const PRIORITY_MAP: Record<string, { label: string; class: string }> = {
    high: { label: t('tasks.priorityHigh'), class: 'priority-high' },
    medium: { label: t('tasks.priorityMedium'), class: 'priority-medium' },
    low: { label: t('tasks.priorityLow'), class: 'priority-low' },
  };

  const STATUS_OPTIONS = [
    { key: 'todo', label: t('tasks.todo'), color: 'bg-slate-400' },
    { key: 'in_progress', label: t('tasks.inProgress'), color: 'bg-blue-500' },
    { key: 'reviewing', label: t('tasks.reviewing'), color: 'bg-amber-500' },
    { key: 'completed', label: t('tasks.completed'), color: 'bg-emerald-500' },
  ];
  const router = useRouter();
  // 精确 selector 订阅，减少不必要重渲染
  const updateTaskAsync = useTaskStore((s) => s.updateTaskAsync);
  const deleteTaskAsync = useTaskStore((s) => s.deleteTaskAsync);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  
  const members = useMemberStore((s) => s.members);
  
  const comments = useCommentStore((s) => s.comments);
  const fetchCommentsByTask = useCommentStore((s) => s.fetchCommentsByTask);
  
  const logs = useTaskLogStore((s) => s.logs);
  const fetchLogsByTask = useTaskLogStore((s) => s.fetchLogsByTask);
  
  const documents = useDocumentStore((s) => s.documents);
  
  const openChatWithMessage = useChatStore((s) => s.openChatWithMessage);
  
  const projects = useProjectStore((s) => s.projects);
  
  const workspaces = useOpenClawWorkspaceStore((s) => s.workspaces);
  const openclawFiles = useOpenClawWorkspaceStore((s) => s.files);
  
  const milestones = useMilestoneStore((s) => s.milestones);
  
  const connected = useGatewayStore((s) => s.connected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const pushTaskToAI = useGatewayStore((s) => s.pushTaskToAI);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);
  const gwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const descDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pushTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 本地状态
  const [activeTab, setActiveTab] = useState<'detail' | 'comments' | 'logs'>('detail');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const deleteConfirm = useConfirmAction<boolean>();
  const [newCheckItem, setNewCheckItem] = useState('');

  // 使用 useInlineEdit Hook 处理检查项添加的 Enter/Blur 双重提交问题
  const { handleKeyDown: handleCheckItemKeyDown, handleBlur: handleCheckItemBlur, isSaving: isAddingCheckItem } = useInlineEdit({
    onSave: async () => {
      if (newCheckItem.trim()) {
        await handleAddCheckItem();
      }
    },
  });
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 当前人类用户（从 Auth Store 获取，v3.0 多用户）
  const authUser = useAuthStore((s) => s.user);
  const currentUserId = authUser?.id;

  // SOP 相关逻辑
  const {
    activeSopTemplates,
    currentTemplate: sopTemplate,
    stageHistory,
    handleSopTemplateChange,
    handleSopAction,
    handleOpenStudio,
  } = useTaskSOP({
    task,
    currentUserId,
    onTaskUpdate: () => fetchTasks(),
    onClose,
  });

  // 评论和日志数量
  const commentsCount = useMemo(() =>
    comments.filter(c => c.taskId === task.id).length,
    [comments, task.id]
  );
  const logsCount = useMemo(() =>
    logs.filter(l => l.taskId === task.id).length,
    [logs, task.id]
  );

  const checkItems: Array<{ id: string; text: string; completed: boolean }> = useMemo(() => {
    if (!task.checkItems) return [];
    if (Array.isArray(task.checkItems)) return task.checkItems as Array<{ id: string; text: string; completed: boolean }>;
    try { return JSON.parse(task.checkItems as string); } catch { return []; }
  }, [task.checkItems]);

  // 初始加载评论和日志
  useEffect(() => {
    fetchCommentsByTask(task.id);
    fetchLogsByTask(task.id);
  }, [task.id, fetchCommentsByTask, fetchLogsByTask]);

  // 标题防抖保存
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      if (value.trim() && value !== task.title) {
        updateTaskAsync(task.id, { title: value.trim() });
      }
    }, 500);
  };

  // 描述防抖保存
  const handleDescChange = (value: string) => {
    setDescription(value);
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => {
      updateTaskAsync(task.id, { description: value });
    }, 500);
  };

  // 精确 selector 订阅
  const createLog = useTaskLogStore((s) => s.createLog);

  const handleStatusChange = async (status: string) => {
    const oldLabel = STATUS_OPTIONS.find(s => s.key === task.status)?.label || task.status;
    const newLabel = STATUS_OPTIONS.find(s => s.key === status)?.label || status;
    await updateTaskAsync(task.id, { status: status as Task['status'] });
    createLog({ taskId: task.id, action: t('tasks.statusChange'), message: `${oldLabel} → ${newLabel}` });
  };

  const handlePriorityChange = async (priority: string) => {
    const oldLabel = PRIORITY_MAP[task.priority]?.label || task.priority;
    const newLabel = PRIORITY_MAP[priority]?.label || priority;
    await updateTaskAsync(task.id, { priority: priority as Task['priority'] });
    createLog({ taskId: task.id, action: t('tasks.priorityChange'), message: `${oldLabel} → ${newLabel}` });
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    const assignees = assigneeId ? [assigneeId] : [];
    const oldName = (task.assignees as string[])?.[0] ? members.find(m => m.id === (task.assignees as string[])[0])?.name || t('tasks.unassigned') : t('tasks.unassigned');
    const newName = assigneeId ? members.find(m => m.id === assigneeId)?.name || assigneeId : t('tasks.unassigned');
    await updateTaskAsync(task.id, { assignees });
    createLog({ taskId: task.id, action: t('tasks.assigneeChange'), message: `${oldName} → ${newName}` });
  };

  const handleDeadlineChange = async (deadline: string) => {
    await updateTaskAsync(task.id, { deadline: deadline ? new Date(deadline) : null });
    createLog({ taskId: task.id, action: t('tasks.deadlineChange'), message: deadline || t('tasks.cleared') });
  };

  // 里程碑相关
  const projectMilestones = useMemo(() =>
    milestones.filter(m => m.projectId === task.projectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [milestones, task.projectId]
  );

  const handleMilestoneChange = async (milestoneId: string) => {
    const oldMs = milestones.find(m => m.id === task.milestoneId);
    const newMs = milestoneId ? milestones.find(m => m.id === milestoneId) : null;
    await updateTaskAsync(task.id, { milestoneId: milestoneId || null });
    createLog({ taskId: task.id, action: t('tasks.milestoneChange'), message: `${oldMs?.title || t('milestones.unassigned')} → ${newMs?.title || t('milestones.unassigned')}` });
  };

  const handleToggleCheckItem = async (index: number) => {
    const updated = [...checkItems];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    await updateTaskAsync(task.id, { checkItems: updated as any });
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const updated = [...checkItems, { id: crypto.randomUUID(), text: newCheckItem.trim(), completed: false }];
    await updateTaskAsync(task.id, { checkItems: updated as any });
    setNewCheckItem('');
  };

  const handleRemoveCheckItem = async (index: number) => {
    const updated = checkItems.filter((_, i) => i !== index);
    await updateTaskAsync(task.id, { checkItems: updated as any });
  };

  const handleChatAboutTask = () => {
    // v3.0 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = currentUserId ? getUserSessionKey(currentUserId) : null;

    // 获取项目信息
    const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

    // 检查是否有本地映射目录（通过关联文档）
    const mappedWorkspaces: Set<string> = new Set();
    const mappedFiles: Array<{ docId: string; docTitle: string; workspacePath: string; relativePath: string }> = [];
    
    if (attachments.length > 0) {
      attachments.forEach(docId => {
        const mappedFile = openclawFiles.find(f => f.documentId === docId);
        if (mappedFile) {
          const ws = workspaces.find(w => w.id === mappedFile.workspaceId);
          if (ws) {
            mappedWorkspaces.add(ws.path);
            const doc = documents.find(d => d.id === docId);
            mappedFiles.push({
              docId,
              docTitle: doc?.title || t('tasks.unknown'),
              workspacePath: ws.path,
              relativePath: mappedFile.relativePath,
            });
          }
        }
      });
    }

    // 构造消息：包含完整来源信息，明确告知 AI 这是引用讨论，先不要执行
    const lines = [
      '**这是一条引用讨论消息，请先不要执行任何操作，我们只需要讨论方案。**',
      '',
      '---',
      '',
      '## 来源信息',
      '- **数据来源**: TeamClaw 协作平台',
      '- **服务类型**: 本地 SQLite 数据库（通过 TeamClaw MCP 工具访问）',
      '',
      '## 引用的任务',
      `- **任务 ID**: ${task.id}`,
      `- **任务标题**: ${task.title}`,
      `- **状态**: ${STATUS_OPTIONS.find(s => s.key === task.status)?.label || task.status}`,
      `- **优先级**: ${PRIORITY_MAP[task.priority]?.label || task.priority}`,
      `- **创建时间**: ${task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '未知'}`,
      '',
    ];

    if (task.description) {
      lines.push('### 任务描述', task.description, '');
    }

    if (task.deadline) {
      lines.push(`### 截止日期: ${new Date(task.deadline).toLocaleDateString('zh-CN')}`, '');
    }

    if (project) {
      lines.push(
        '## 所属项目',
        `- **项目 ID**: ${project.id}`,
        `- **项目名称**: ${project.name}`,
        `- **项目来源**: ${project.source === 'openclaw' ? 'OpenClaw 同步' : '本地创建'}`,
        ''
      );
      if (project.description) {
        lines.push(`项目描述: ${project.description}`, '');
      }
    }

    // 本地映射目录信息
    if (mappedWorkspaces.size > 0) {
      lines.push('## 本地映射目录');
      lines.push('> 以下文档已映射到本地目录，你可以直接读取本地文件：', '');
      mappedWorkspaces.forEach(path => {
        lines.push(`- **目录路径**: ${path}`);
      });
      lines.push('', '### 映射的文档', '');
      mappedFiles.forEach(f => {
        lines.push(`- **${f.docTitle}** (${f.docId})`);
        lines.push(`  - 本地路径: ${f.workspacePath}/${f.relativePath}`);
      });
      lines.push('');
    }

    // 关联文档（非映射的）
    const nonMappedDocs = attachments.filter(docId => !openclawFiles.find(f => f.documentId === docId));
    if (nonMappedDocs.length > 0) {
      const attachedDocs = documents.filter(d => nonMappedDocs.includes(d.id));
      if (attachedDocs.length > 0) {
        lines.push('## 关联文档（TeamClaw 存储）');
        attachedDocs.forEach(doc => {
          lines.push(`- **文档 ID**: ${doc.id} - ${doc.title}`);
        });
        lines.push('');
      }
    }

    lines.push(
      '---',
      '',
      '## 访问方式',
      ''
    );

    if (mappedWorkspaces.size > 0) {
      lines.push('### 优先读取本地目录');
      mappedWorkspaces.forEach(path => {
        lines.push(`- 使用 \`read\` 工具读取: ${path}/xxx.md`);
      });
      lines.push('', '### 然后通过 MCP 了解 TeamClaw 信息');
    }

    lines.push(
      '- 任务: `get_task` 或 `list_tasks`',
      '- 项目: `get_project` 或 `list_projects`',
      '- 文档: `get_document` 或 `list_documents`',
      '',
      '**请分析这个任务，给出你的建议和执行方案，但暂时不要执行任何修改操作。**'
    );

    // v3.0 多用户：传入用户专用会话键
    openChatWithMessage(lines.join('\n'), { sessionKey: userSessionKey || undefined });
  };

  const handlePushToAI = async () => {
    // v3.0 多用户：获取用户专用会话键
    const userSessionKey = currentUserId ? getUserSessionKey(currentUserId) : null;
    
    if (!gwConnected || !userSessionKey) {
      setPushResult({ ok: false, msg: t('tasks.gatewayDisconnected') });
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => setPushResult(null), 3000);
      return;
    }
    
    // 1. 先调用后端 API 获取渲染后的推送消息
    setPushing(true);
    setPushResult(null);
    const result = await pushTaskToAI(task.id, userSessionKey);
    setPushing(false);
    
    if (!result.success || !result.message) {
      setPushResult({ ok: false, msg: result.error || t('tasks.pushFailed') });
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => setPushResult(null), 3000);
      return;
    }
    
    // 2. 通过 openChatWithMessage 打开 ChatPanel 并发送消息
    // v3.0 多用户：传入用户专用会话键
    openChatWithMessage(result.message, { sessionKey: userSessionKey });
    setPushResult({ ok: true, msg: t('tasks.pushedToAI') });
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => setPushResult(null), 3000);
  };

  const checkedCount = useMemo(() => checkItems.filter(c => c.completed).length, [checkItems]);
  const totalChecks = checkItems.length;

  const attachments: string[] = useMemo(() => {
    if (!task.attachments) return [];
    if (Array.isArray(task.attachments)) return task.attachments as string[];
    try { return JSON.parse(task.attachments as string); } catch { return []; }
  }, [task.attachments]);

  const handleToggleDoc = async (docId: string) => {
    const current = [...attachments];
    const idx = current.indexOf(docId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(docId);
    }
    await updateTaskAsync(task.id, { attachments: current as any });
  };

  const handleRemoveDoc = async (docId: string) => {
    const updated = attachments.filter(id => id !== docId);
    await updateTaskAsync(task.id, { attachments: updated as any });
  };

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />

      {/* 抽屉 */}
      <div
        className="fixed right-0 top-0 h-full z-50 shadow-float overflow-hidden flex flex-col"
        style={{ width: '520px', maxWidth: '100vw', background: 'var(--surface)' }}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 h-14 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary-500" />
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('tasks.taskDetail')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleChatAboutTask}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title={t('tasks.chatWithAI')}
            >
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--ai)' }} />
            </button>
            {gwConnected && (
              <button
                onClick={handlePushToAI}
                disabled={pushing}
                className={clsx('p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors', pushing && 'opacity-50')}
                title={t('tasks.pushToAI')}
              >
                <Send className={clsx('w-4 h-4', pushing ? 'text-slate-400 animate-pulse' : 'text-blue-500')} />
              </button>
            )}
            {pushResult && (
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', pushResult.ok ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400')}>
                {pushResult.msg}
              </span>
            )}
            <button
              onClick={() => deleteConfirm.requestConfirm(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
              <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* 标题 */}
        <div className="px-5 pt-4 pb-2">
          <Input
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            className="w-full text-lg font-semibold font-display bg-transparent outline-none"
          />
        </div>

        {/* 属性行 */}
        <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
          {/* 状态 */}
          <Select
            value={task.status}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </Select>

          {/* 优先级 */}
          <Select
            value={task.priority}
            onChange={e => handlePriorityChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            <option value="high">🔴 {t('tasks.priorityHigh')}</option>
            <option value="medium">🟡 {t('tasks.priorityMedium')}</option>
            <option value="low">🟢 {t('tasks.priorityLow')}</option>
          </Select>

          {/* 负责人 */}
          <Select
            value={(task.assignees as string[])?.[0] || ''}
            onChange={e => handleAssigneeChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            <option value="">{t('tasks.unassigned')}</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>

          {/* 截止日期 */}
          <Input
            type="date"
            value={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}
            onChange={e => handleDeadlineChange(e.target.value)}
            className="text-xs py-1 w-auto"
          />

          {/* 里程碑 */}
          {projectMilestones.length > 0 && (
            <Select
              value={task.milestoneId || ''}
              onChange={e => handleMilestoneChange(e.target.value)}
              className="text-xs py-1 w-auto"
            >
              <option value="">{t('tasks.noMilestone')}</option>
              {projectMilestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          )}

          {/* SOP 模板关联 */}
          <Select
            value={task.sopTemplateId || ''}
            onChange={e => handleSopTemplateChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            <option value="">{t('tasks.noSop')}</option>
            {activeSopTemplates.map(tpl => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </Select>
        </div>

        {/* Tab 切换 */}
        <div className="px-5 flex items-center gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
          {[
            { key: 'detail' as const, label: t('tasks.detail'), icon: FileText },
            { key: 'comments' as const, label: `${t('tasks.comments')} (${commentsCount})`, icon: MessageSquare },
            { key: 'logs' as const, label: `${t('tasks.logs')} (${logsCount})`, icon: History },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 pb-2.5 pt-1 text-xs font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent'
              )}
              style={activeTab !== tab.key ? { color: 'var(--text-tertiary)' } : undefined}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'detail' && (
            <div className="space-y-5">
              {/* 描述 */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.description')}</label>
                <Textarea
                  value={description}
                  onChange={e => handleDescChange(e.target.value)}
                  placeholder={t('tasks.addDescription')}
                  rows={5}
                  className="text-sm resize-none"
                />
              </div>

              {/* SOP 进度面板（SOP 任务时展示） */}
              {task.sopTemplateId && sopTemplate && Array.isArray(sopTemplate.stages) && sopTemplate.stages.length > 0 && (
                <SOPProgressBar
                  expanded
                  stages={sopTemplate.stages}
                  stageHistory={stageHistory}
                  currentStageId={task.currentStageId}
                  templateName={sopTemplate.name}
                  onStageAction={handleSopAction}
                  onOpenStudio={handleOpenStudio}
                />
              )}

              {/* 检查项 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {t('tasks.checkItems')} {totalChecks > 0 && `(${checkedCount}/${totalChecks})`}
                  </label>
                </div>

                {totalChecks > 0 && (
                  <div className="w-full h-1 rounded-full mb-3" style={{ background: 'var(--surface-hover)' }}>
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${totalChecks > 0 ? (checkedCount / totalChecks) * 100 : 0}%` }}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  {checkItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                      <button onClick={() => handleToggleCheckItem(index)}>
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        )}
                      </button>
                      <span
                        className={clsx('text-sm flex-1', item.completed && 'line-through')}
                        style={{ color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                      >
                        {item.text}
                      </span>
                      <button
                        onClick={() => handleRemoveCheckItem(index)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950 transition-opacity"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => handleCheckItemKeyDown(e, newCheckItem)}
                    onBlur={() => handleCheckItemBlur(newCheckItem)}
                    placeholder={t('tasks.addCheckItem')}
                    className="text-xs flex-1"
                    disabled={isAddingCheckItem.current}
                  />
                  <button
                    onClick={handleAddCheckItem}
                    disabled={!newCheckItem.trim() || isAddingCheckItem.current}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>

              {/* 关联文档 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {t('tasks.linkedDocs')} {attachments.length > 0 && `(${attachments.length})`}
                  </label>
                  <button
                    onClick={() => setShowDocPicker(true)}
                    className="flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {t('tasks.addDoc')}
                  </button>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {attachments.map((docId) => {
                      const doc = documents.find(d => d.id === docId);
                      if (!doc) return null;
                      return (
                        <div
                          key={docId}
                          className="flex items-center gap-2 p-2 rounded-lg group transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          style={{ background: 'var(--surface-hover)' }}
                        >
                          <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                          <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                            {doc.title}
                          </span>
                          <Link2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                          <button
                            onClick={() => handleRemoveDoc(docId)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950 transition-opacity"
                          >
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.noLinkedDocs')}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <TaskComments taskId={task.id} projectId={task.projectId} />
          )}

          {activeTab === 'logs' && (
            <TaskLogs taskId={task.id} />
          )}
        </div>

        {/* 删除确认 */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={deleteConfirm.cancel}
          onConfirm={() => deleteConfirm.confirm(async () => {
            await deleteTaskAsync(task.id);
            onDelete?.(task.id);
            onClose();
          })}
          title={t('tasks.deleteTask')}
          message={t('tasks.deleteConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          isLoading={deleteConfirm.isLoading}
        />

        <DocumentPicker
          open={showDocPicker}
          onClose={() => setShowDocPicker(false)}
          selectedIds={attachments}
          onToggle={handleToggleDoc}
          projectId={task.projectId}
        />
      </div>
    </>
  );
}
