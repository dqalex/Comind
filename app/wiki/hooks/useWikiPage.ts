'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import { useDocumentStore, useProjectStore, useMemberStore, useTaskStore, useDeliveryStore, useChatStore } from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import { useAuthStore } from '@/domains/auth';
import { useRenderTemplateStore } from '@/domains/render-template';
import { DOC_TEMPLATES } from '@/lib/doc-templates';
import { syncMdToHtml as directSyncMdToHtml } from '@/lib/slot-sync';
import type { Document } from '@/db/schema';
import type { TextSelection } from '@/features/wiki-editor/AnnotationPanel';

// --- 常量定义 ---
export const typeIcons = {
  guide: 'BookOpen', reference: 'FileText', report: 'ClipboardList', note: 'BookOpen',
  decision: 'FileText', scheduled_task: 'Calendar', task_list: 'CheckSquare', blog: 'Rss', other: 'FileQuestion',
} as const;

export const typeColors: Record<string, string> = {
  guide: 'text-teal-500', reference: 'text-sky-500', report: 'text-blue-500', note: 'text-emerald-500', decision: 'text-amber-500',
  scheduled_task: 'text-violet-500', task_list: 'text-indigo-500', blog: 'text-rose-500', other: 'text-slate-400',
};

export const tagColors = [
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
];

export const typeOrder = ['guide', 'reference', 'note', 'report', 'decision', 'scheduled_task', 'task_list', 'blog', 'other'];

// --- 主 Hook ---
export function useWikiPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const typeLabels: Record<string, string> = {
    guide: t('wiki.guide'), reference: t('wiki.reference'),
    report: t('wiki.report'), note: t('wiki.note'), decision: t('wiki.decision'),
    scheduled_task: t('wiki.scheduledTask'), task_list: t('wiki.taskList'),
    blog: t('wiki.blog'), other: t('wiki.other'),
  };

  // Store 数据
  const { documents, createDocument, updateDocumentAsync, deleteDocumentAsync } = useDocumentStore();
  const { projects, currentProjectId } = useProjectStore();
  const { members } = useMemberStore();
  const { tasks } = useTaskStore();
  const { deliveries, fetchDeliveries, createDelivery } = useDeliveryStore();
  const { openChatWithMessage } = useChatStore();
  const { templates: renderTemplates } = useRenderTemplateStore();
  
  // v0.9.8 多用户：获取用户专用会话键（注意：不在组件级别缓存，而是在函数调用时实时计算）
  const authUser = useAuthStore((s) => s.user);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);

  // 文档选择/搜索/过滤
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [filterType, setFilterType] = useState('all');
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  // 编辑状态
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const titleSavingRef = useRef(false);

  // 新建文档
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocSource, setNewDocSource] = useState<'local' | 'external'>('local');
  const [newDocType, setNewDocType] = useState('note');
  const [newDocProjectTags, setNewDocProjectTags] = useState<string[]>([]);
  const [newDocRenderTemplateId, setNewDocRenderTemplateId] = useState('');
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'html' | 'md'>('html');

  // 删除确认
  const deleteAction = useConfirmAction<boolean>();

  // 面板切换
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // OpenClaw 文档编辑
  const [isEditingOpenclaw, setIsEditingOpenclaw] = useState(false);
  const [openclawFileId, setOpenclawFileId] = useState<string | null>(null);
  const [openclawFileVersion, setOpenclawFileVersion] = useState<number | null>(null);
  const [openclawEditContent, setOpenclawEditContent] = useState('');
  const [savingOpenclaw, setSavingOpenclaw] = useState(false);

  // 交付
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [deliverReviewerId, setDeliverReviewerId] = useState('');
  const [deliverDescription, setDeliverDescription] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // 文本选中（批注）
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);

  // 渲染模板
  const [showExportModal, setShowExportModal] = useState(false);
  const [studioHtmlContent, setStudioHtmlContent] = useState('');

  // 套模板对话框
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);

  // Escape key
  useEscapeKey(showNewDocDialog, useCallback(() => setShowNewDocDialog(false), []));

  // --- 派生数据 ---
  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const currentProject = projects.find(p => p.id === currentProjectId);

  const currentRenderTemplate = useMemo(() => {
    if (!selectedDoc?.renderTemplateId) return null;
    return renderTemplates.find(t => t.id === selectedDoc.renderTemplateId) || null;
  }, [selectedDoc?.renderTemplateId, renderTemplates]);

  const filteredDocs = useMemo(() => {
    // 所有文档类型都在 wiki 中显示
    let docs = documents;
    if (currentProjectId && currentProject) {
      docs = docs.filter(d =>
        d.projectId === currentProjectId ||
        (Array.isArray(d.projectTags) && (
          d.projectTags.includes(currentProjectId) || d.projectTags.includes(currentProject.name)
        ))
      );
    }
    if (filterType !== 'all') docs = docs.filter(d => d.type === filterType);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(d => d.title.toLowerCase().includes(term));
    }
    return docs;
  }, [documents, currentProjectId, currentProject, searchTerm, filterType]);

  const docsByType = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    for (const tp of typeOrder) {
      const typed = filteredDocs.filter(d => d.type === tp);
      if (typed.length > 0) groups[tp] = typed;
    }
    return groups;
  }, [filteredDocs]);

  const docRelations = useMemo(() => {
    if (!selectedDoc) return null;
    const content = typeof editContent === 'string' ? editContent : String(editContent || '');
    const docRefs = [...content.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
    const linkedDocs = docRefs.map(title => documents.find(d => d.title === title)).filter(Boolean);
    const backlinkIds = Array.isArray(selectedDoc.backlinks) ? selectedDoc.backlinks : [];
    const backlinkDocs = backlinkIds.map(id => documents.find(d => d.id === id)).filter(Boolean) as typeof documents;
    const relatedProjects = projects.filter(p =>
      selectedDoc.projectId === p.id ||
      (Array.isArray(selectedDoc.projectTags) && (selectedDoc.projectTags.includes(p.name) || selectedDoc.projectTags.includes(p.id)))
    );
    const mentionedNames = [...content.matchAll(/@(\S+)/g)].map(m => m[1]);
    const relatedMembers = mentionedNames.map(name => members.find(m => m.name === name)).filter(Boolean);
    const relatedTasks = tasks.filter(task =>
      Array.isArray(task.attachments) && (task.attachments as string[]).includes(selectedDoc.id)
    );
    return { linkedDocs, backlinkDocs, relatedProjects, relatedMembers, relatedTasks };
  }, [selectedDoc, editContent, documents, projects, members, tasks]);

  // --- Effects ---
  // MD→HTML 同步（有渲染模板时）
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!currentRenderTemplate || !editContent) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      try {
        const result = directSyncMdToHtml(
          editContent,
          currentRenderTemplate.htmlTemplate || '',
          (currentRenderTemplate.slots || {}) as Record<string, import('@/lib/slot-sync').SlotDef>,
          currentRenderTemplate.cssTemplate || undefined,
        );
        if (result.html) setStudioHtmlContent(result.html);
      } catch (err) {
        console.error('[wiki] MD→HTML 同步失败:', err);
      }
    }, 300);
    return () => { if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current); };
  }, [editContent, currentRenderTemplate]);

  // 切换文档时初始化 HTML
  useEffect(() => {
    if (selectedDoc?.htmlContent && currentRenderTemplate) {
      setStudioHtmlContent(selectedDoc.htmlContent);
    } else if (currentRenderTemplate && editContent) {
      try {
        const result = directSyncMdToHtml(
          editContent,
          currentRenderTemplate.htmlTemplate || '',
          (currentRenderTemplate.slots || {}) as Record<string, import('@/lib/slot-sync').SlotDef>,
          currentRenderTemplate.cssTemplate || undefined,
        );
        if (result.html) setStudioHtmlContent(result.html);
      } catch (err) {
        console.error('[wiki] 初始化 HTML 失败:', err);
      }
    } else {
      setStudioHtmlContent('');
    }
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL 参数自动选中
  useEffect(() => {
    const docIdFromUrl = searchParams.get('doc');
    if (docIdFromUrl && !selectedDocId) {
      const doc = documents.find(d => d.id === docIdFromUrl);
      if (doc) setSelectedDocId(docIdFromUrl);
    }
  }, [searchParams, documents, selectedDocId]);

  // 确保交付物已加载
  useEffect(() => {
    if (deliveries.length === 0) fetchDeliveries();
  }, [deliveries.length, fetchDeliveries]);

  // 清理 timer refs
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // 文档选中时加载完整内容
  useEffect(() => {
    if (!selectedDocId) return;
    if (selectedDoc) setEditTitle(selectedDoc.title);
    setIsEditingOpenclaw(false);
    setOpenclawFileId(null);
    setOpenclawFileVersion(null);
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/documents/${selectedDocId}`, { signal: controller.signal });
        if (res.ok) {
          const fullDoc = await res.json();
          setEditContent(fullDoc.content || '');
          setEditTitle(fullDoc.title || '');
          if (fullDoc.source === 'openclaw') {
            setOpenclawFileId(fullDoc.openclawFileId || null);
            setOpenclawFileVersion(fullDoc.openclawFileVersion ?? null);
            setOpenclawEditContent(fullDoc.content || '');
          }
        } else {
          setEditContent(selectedDoc?.content || '');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setEditContent(selectedDoc?.content || '');
      }
    })();
    return () => controller.abort();
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 事件处理 ---
  const handleContentChange = useCallback((value: string) => {
    setEditContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (selectedDocId) updateDocumentAsync(selectedDocId, { content: value });
    }, 500);
  }, [selectedDocId, updateDocumentAsync]);

  const handleSaveStudioHtml = useCallback(async () => {
    if (!selectedDocId || !studioHtmlContent) return;
    await updateDocumentAsync(selectedDocId, { htmlContent: studioHtmlContent });
  }, [selectedDocId, studioHtmlContent, updateDocumentAsync]);

  const handleTitleSave = useCallback(() => {
    if (titleSavingRef.current) return;
    titleSavingRef.current = true;
    if (selectedDocId && editTitle.trim()) updateDocumentAsync(selectedDocId, { title: editTitle.trim() });
    setTimeout(() => { titleSavingRef.current = false; }, 100);
  }, [selectedDocId, editTitle, updateDocumentAsync]);

  const handleCreateDoc = useCallback(async () => {
    if (!newDocTitle.trim()) return;
    let template = DOC_TEMPLATES[newDocType] || '';
    if (newDocRenderTemplateId) {
      const rt = renderTemplates.find(t => t.id === newDocRenderTemplateId);
      if (rt?.mdTemplate) template = rt.mdTemplate;
    }
    const doc = await createDocument({
      title: newDocTitle.trim(),
      content: template,
      source: newDocSource,
      type: newDocType as any,
      projectId: currentProjectId || undefined,
      projectTags: newDocProjectTags,
      renderTemplateId: newDocRenderTemplateId || undefined,
    });
    if (doc) {
      setSelectedDocId(doc.id);
      setEditContent(template);
    }
    setNewDocTitle('');
    setNewDocType('note');
    setNewDocProjectTags([]);
    setShowNewDocDialog(false);
  }, [newDocTitle, newDocType, newDocSource, newDocProjectTags, newDocRenderTemplateId, currentProjectId, createDocument, renderTemplates]);

  const handleDelete = useCallback(async () => {
    if (selectedDocId) {
      await deleteDocumentAsync(selectedDocId);
      setSelectedDocId(null);
    }
  }, [selectedDocId, deleteDocumentAsync]);

  const handleSaveOpenclaw = useCallback(async () => {
    if (!openclawFileId) return;
    setSavingOpenclaw(true);
    try {
      const res = await fetch(`/api/openclaw-files/${openclawFileId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: openclawEditContent, expectedVersion: openclawFileVersion }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditContent(openclawEditContent);
        setOpenclawFileVersion(data.data?.version ?? openclawFileVersion);
        setIsEditingOpenclaw(false);
        if (selectedDocId) await updateDocumentAsync(selectedDocId, { content: openclawEditContent });
      } else {
        const err = await res.json();
        if (err.error === 'CONFLICT') {
          alert(t('wiki.conflictError') || '文件已被其他程序修改，请刷新后重试');
        } else {
          alert(err.error || '保存失败');
        }
      }
    } catch (e) {
      console.error('Save openclaw error:', e);
      alert('保存失败');
    } finally {
      setSavingOpenclaw(false);
    }
  }, [openclawFileId, openclawFileVersion, openclawEditContent, selectedDocId, updateDocumentAsync, t]);

  const handleCancelOpenclawEdit = useCallback(() => {
    setOpenclawEditContent(editContent);
    setIsEditingOpenclaw(false);
  }, [editContent]);

  const handleChatAboutDoc = useCallback(() => {
    if (!selectedDoc) return;

    // v0.9.8 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;

    const project = selectedDoc.projectId ? projects.find(p => p.id === selectedDoc.projectId) : null;
    const contentPreview = editContent ? editContent.slice(0, 500) + (editContent.length > 500 ? '\n...(内容已截断)' : '') : '';
    const lines = [
      '**这是一条引用讨论消息，请先不要执行任何操作，我们只需要讨论方案。**', '', '---', '',
      '## 来源信息', '- **数据来源**: TeamClaw 协作平台', '- **服务类型**: 本地 SQLite 数据库（通过 TeamClaw MCP 工具访问）', '',
      '## 引用的文档',
      `- **文档 ID**: ${selectedDoc.id}`,
      `- **文档标题**: ${selectedDoc.title}`,
      `- **文档类型**: ${typeLabels[selectedDoc.type] || selectedDoc.type}`,
      `- **来源**: ${selectedDoc.source === 'openclaw' ? 'OpenClaw 同步' : selectedDoc.source === 'external' ? '外部链接' : '本地创建'}`,
      `- **创建时间**: ${selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleString('zh-CN') : '未知'}`,
      '',
    ];
    if (project) lines.push('## 所属项目', `- **项目名称**: ${project.name}`, '');
    if (contentPreview) lines.push('### 文档内容预览', '```', contentPreview, '```', '');
    lines.push('---', '', '## 访问方式', '- 文档: `get_document` 或 `list_documents`', '- 任务: `get_task` 或 `list_tasks`', '', '**请分析这篇文档，给出你的建议，但暂时不要执行任何修改操作。**');
    // v0.9.8 多用户：传入用户专用会话键
    openChatWithMessage(lines.join('\n'), { sessionKey: userSessionKey || undefined });
  }, [selectedDoc, editContent, projects, typeLabels, openChatWithMessage, authUser, getUserSessionKey]);

  const handleToggleProjectTag = useCallback(async (projectName: string) => {
    if (!selectedDoc) return;
    const tags = Array.isArray(selectedDoc.projectTags) ? [...selectedDoc.projectTags] : [];
    const idx = tags.indexOf(projectName);
    if (idx >= 0) tags.splice(idx, 1); else tags.push(projectName);
    await updateDocumentAsync(selectedDoc.id, { projectTags: tags });
  }, [selectedDoc, updateDocumentAsync]);

  const handleTypeChange = useCallback(async (newType: string) => {
    if (!selectedDoc || selectedDoc.type === newType) return;
    await updateDocumentAsync(selectedDoc.id, { type: newType as any });
  }, [selectedDoc, updateDocumentAsync]);

  const handleRenderTemplateChange = useCallback(async (templateId: string) => {
    if (!selectedDoc) return;
    const newTemplateId = templateId || null;
    const updates: Record<string, unknown> = { renderTemplateId: newTemplateId };
    if (!newTemplateId) { updates.htmlContent = null; updates.slotData = null; }
    await updateDocumentAsync(selectedDoc.id, updates as any);
  }, [selectedDoc, updateDocumentAsync]);

  const handleSubmitDelivery = useCallback(async () => {
    if (!selectedDoc || !deliverReviewerId || submittingDelivery) return;
    setSubmittingDelivery(true);
    try {
      await createDelivery({
        memberId: members.find(m => m.type === 'human')?.id || 'member-default',
        title: selectedDoc.title,
        description: deliverDescription || null,
        platform: 'local' as const,
        documentId: selectedDoc.id,
        status: 'pending' as const,
        reviewerId: deliverReviewerId,
      });
      setShowDeliverDialog(false);
      setDeliverReviewerId('');
      setDeliverDescription('');
    } catch {
      // 错误由 store 处理
    } finally {
      setSubmittingDelivery(false);
    }
  }, [selectedDoc, deliverReviewerId, deliverDescription, submittingDelivery, createDelivery, members]);

  const toggleCollapse = useCallback((type: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type); } else { next.add(type); }
      return next;
    });
  }, []);

  const getShareUrl = useCallback(() => {
    if (!selectedDocId) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/wiki?doc=${selectedDocId}`;
  }, [selectedDocId]);

  const handleCopyLink = useCallback(async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      navigator.clipboard.writeText(url);
      document.body.removeChild(textArea);
      setCopySuccess(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [getShareUrl]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchTerm(value), 300);
  }, []);

  // 套模板：创建任务并推送给 AI
  const handleApplyTemplate = useCallback(async (data: { templateId: string; projectId: string }) => {
    if (!selectedDoc) return;

    // v0.9.8 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;

    // 获取当前用户及其关联的成员
    const { useAuthStore } = await import('@/domains/auth');
    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.id) {
      console.error('[useWikiPage] 未登录');
      return;
    }
    
    // 从 memberStore 获取当前用户关联的成员
    const currentMember = useMemberStore.getState().members.find(m => m.userId === currentUser.id);
    if (!currentMember) {
      console.error('[useWikiPage] 当前用户无关联成员');
      return;
    }
    
    // 创建任务
    const task = await useTaskStore.getState().createTask({
      title: `基于《${selectedDoc.title}》生成套模板文档`,
      description: `根据源文档内容，使用模板生成新文档。\n\n源文档: ${selectedDoc.title}\n模板ID: ${data.templateId}`,
      projectId: data.projectId,
      creatorId: currentMember.id, // 当前登录用户关联的成员
      attachments: [selectedDoc.id],
      sopInputs: {
        type: 'template_apply',
        sourceDocId: selectedDoc.id,
        sourceDocTitle: selectedDoc.title,
        templateId: data.templateId,
      } as Record<string, unknown>,
    });
    
    if (task) {
      // 推送任务给 AI
      const res = await fetch('/api/task-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, sessionKey: userSessionKey || undefined }),
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.message) {
          // 打开聊天窗口并发送消息
          // v0.9.8 多用户：传入用户专用会话键
          openChatWithMessage(result.data.message, { sessionKey: userSessionKey || undefined });
        }
      }
    }
  }, [selectedDoc, openChatWithMessage, authUser, getUserSessionKey]);

  return {
    t, typeLabels,
    // Store 数据
    documents, projects, members, renderTemplates, currentProjectId,
    // 文档选择/筛选
    selectedDoc, selectedDocId, setSelectedDocId,
    searchInput, handleSearchInput,
    filterType, setFilterType,
    filteredDocs, docsByType,
    collapsedTypes, toggleCollapse,
    // 编辑
    editTitle, setEditTitle, editContent,
    handleContentChange, handleTitleSave, handleSaveStudioHtml,
    // 新建文档
    showNewDocDialog, setShowNewDocDialog,
    newDocTitle, setNewDocTitle,
    newDocSource, setNewDocSource,
    newDocType, setNewDocType,
    newDocProjectTags, setNewDocProjectTags,
    newDocRenderTemplateId, setNewDocRenderTemplateId,
    templatePreviewMode, setTemplatePreviewMode,
    handleCreateDoc,
    // 删除
    deleteAction, handleDelete,
    // 面板
    showTagEditor, setShowTagEditor,
    showKnowledgeGraph, setShowKnowledgeGraph,
    docRelations,
    showShareDialog, setShowShareDialog,
    copySuccess, setCopySuccess,
    getShareUrl, handleCopyLink,
    // OpenClaw
    isEditingOpenclaw, setIsEditingOpenclaw,
    openclawEditContent, setOpenclawEditContent,
    savingOpenclaw, handleSaveOpenclaw, handleCancelOpenclawEdit,
    // 交付
    showDeliverDialog, setShowDeliverDialog,
    deliverReviewerId, setDeliverReviewerId,
    deliverDescription, setDeliverDescription,
    submittingDelivery, handleSubmitDelivery,
    // 批注
    textSelection, setTextSelection,
    // 渲染模板
    currentRenderTemplate, studioHtmlContent,
    showExportModal, setShowExportModal,
    // 套模板
    showApplyTemplateDialog, setShowApplyTemplateDialog,
    handleApplyTemplate,
    // 文档操作
    handleToggleProjectTag, handleTypeChange, handleRenderTemplateChange,
    handleChatAboutDoc,
  };
}
