'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Input, Badge } from '@/components/ui';
import { useSOPTemplateStore, useProjectStore, useChatStore, useAuthStore, useGatewayStore } from '@/store';
import { useRenderTemplateStore } from '@/store/render-template.store';
import type { SOPTemplate, SOPCategory, SOPStage, RenderTemplate, NewRenderTemplate, ReferenceFile, ScriptFile } from '@/db/schema';
import { useFilteredList } from '@/hooks/useFilteredList';
import clsx from 'clsx';
import JSZip from 'jszip';
import {
  ClipboardList, Search, Plus, ChevronRight, Trash2, Edit2,
  FileText, BarChart2, Search as SearchIcon, Code, Calendar,
  Layers, AlertTriangle, CheckCircle2,
  Download, Upload, Palette, Eye, MessageSquare, Sparkles, Code2, SlidersHorizontal,
  Zap, Loader2,
} from 'lucide-react';
import SOPTemplateEditor from '@/components/sop/SOPTemplateEditor';
import { syncMdToHtml as directSyncMdToHtml } from '@/lib/slot-sync';
import type { SlotDef } from '@/db/schema';

type PageTab = 'sop' | 'render';

type CategoryFilter = 'all' | SOPCategory;
type StatusFilter = 'all' | 'draft' | 'active' | 'archived';

// 分类图标映射
const categoryIcons: Record<SOPCategory, typeof FileText> = {
  content: FileText,
  analysis: BarChart2,
  research: SearchIcon,
  development: Code,
  operations: Calendar,
  media: Layers,
  custom: Layers,
};

// 分类颜色映射
const categoryColors: Record<SOPCategory, string> = {
  content: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  analysis: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  research: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  development: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  operations: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
  media: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
  custom: 'bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400',
};

export default function SOPPage() {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const templates = useSOPTemplateStore((s) => s.templates);
  const loading = useSOPTemplateStore((s) => s.loading);
  const error = useSOPTemplateStore((s) => s.error);
  const deleteTemplateAsync = useSOPTemplateStore((s) => s.deleteTemplateAsync);
  
  const projects = useProjectStore((s) => s.projects);
  
  const renderTemplates = useRenderTemplateStore((s) => s.templates);
  const rtLoading = useRenderTemplateStore((s) => s.loading);
  const deleteRenderTemplate = useRenderTemplateStore((s) => s.deleteTemplateAsync);
  const fetchRenderTemplates = useRenderTemplateStore((s) => s.fetchTemplates);
  
  const [pageTab, setPageTab] = useState<PageTab>('sop');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOPTemplate | null>(null);
  
  const deleteConfirm = useConfirmAction<string>();
  const [importLoading, setImportLoading] = useState(false);
  
  // 生成 Skill 状态
  const [generatingSkillId, setGeneratingSkillId] = useState<string | null>(null);
  
  // 从 SOP 模板生成 Skill
  const handleGenerateSkill = useCallback(async (templateId: string) => {
    setGeneratingSkillId(templateId);
    try {
      const res = await fetch(`/api/sop-templates/${templateId}/create-skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSubmit: true }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create skill' }));
        alert(err.error || t('sop.generateSkillError'));
        return;
      }
      
      const data = await res.json();
      alert(data.message || t('sop.generateSkillSuccess'));
    } catch (err) {
      console.error('Generate skill error:', err);
      alert(t('sop.generateSkillError'));
    } finally {
      setGeneratingSkillId(null);
    }
  }, [t]);
  
  // 导出模板
  const handleExport = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/sop-templates/${templateId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sop-${data.name || templateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    }
  }, []);
  
  // 导入模板（支持 JSON 和 ZIP 格式）
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportLoading(true);
      try {
        if (file.name.endsWith('.zip')) {
          // ZIP 格式：解压并解析 Skill 包结构
          const zip = await JSZip.loadAsync(file);
          
          // 1. 查找 SKILL.md 或 README.md
          const skillFile = zip.file('SKILL.md') || zip.file('skill.md') || 
                           Object.keys(zip.files).find(f => f.endsWith('/SKILL.md') || f.endsWith('/skill.md'));
          const skillContent = skillFile ? 
            await (typeof skillFile === 'string' ? (zip.file(skillFile) as JSZip.JSZipObject) : skillFile).async('string') : '';
          
          if (!skillContent) {
            alert('ZIP 包中未找到 SKILL.md 文件');
            setImportLoading(false);
            return;
          }
          
          // 2. 解析 SKILL.md 的 frontmatter
          const frontmatter: Record<string, string> = {};
          let body = skillContent;
          const fmMatch = skillContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
          if (fmMatch) {
            const fmLines = fmMatch[1].split('\n');
            for (const line of fmLines) {
              const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
              if (m) frontmatter[m[1].trim()] = m[2].trim();
            }
            body = fmMatch[2];
          }
          
          // 3. 解析 references/ 目录
          const references: ReferenceFile[] = [];
          const refsDir = zip.folder('references') || 
                         Object.keys(zip.files).find(f => f.includes('/references/'));
          if (refsDir) {
            // refsDir 可能是 JSZip folder 对象或字符串路径
            const refFiles = typeof refsDir === 'string' ? 
              Object.keys(zip.files).filter(f => f.startsWith(refsDir) && !f.endsWith('/')) :
              Object.keys(zip.files).filter(f => f.startsWith('references/') && !f.endsWith('/'));
            for (const refPath of refFiles) {
              const refFile = zip.file(refPath);
              if (refFile) {
                const content = await refFile.async('string');
                const filename = refPath.split('/').pop() || refPath;
                references.push({
                  id: Math.random().toString(36).slice(2, 10),
                  filename,
                  title: filename.replace(/\.(md|txt|json)$/i, ''),
                  content,
                  type: 'doc',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
          
          // 4. 解析 scripts/ 目录
          const scripts: ScriptFile[] = [];
          const scriptsDir = zip.folder('scripts') ||
                            Object.keys(zip.files).find(f => f.includes('/scripts/'));
          if (scriptsDir) {
            const scriptFiles = typeof scriptsDir === 'string' ?
              Object.keys(zip.files).filter(f => 
                f.startsWith(scriptsDir) && !f.endsWith('/') && !zip.files[f].dir) :
              Object.keys(zip.files).filter(f => 
                f.startsWith('scripts/') && !f.endsWith('/') && !zip.files[f].dir);
            for (const scriptPath of scriptFiles) {
              const scriptFile = zip.file(scriptPath);
              if (scriptFile) {
                const content = await scriptFile.async('string');
                const filename = scriptPath.split('/').pop() || scriptPath;
                const ext = filename.split('.').pop()?.toLowerCase() || '';
                const scriptType: ScriptFile['type'] = 
                  ext === 'sh' ? 'bash' :
                  ext === 'py' ? 'python' :
                  ext === 'js' || ext === 'ts' ? 'node' : 'other';
                scripts.push({
                  id: Math.random().toString(36).slice(2, 10),
                  filename,
                  description: '',
                  content,
                  type: scriptType,
                  executable: ext === 'sh',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
          
          // 5. 解析阶段（## 标题）
          const sectionRegex = /^##\s+(.+)$/gm;
          const sections: { label: string; content: string; startIdx: number }[] = [];
          let match;
          while ((match = sectionRegex.exec(body)) !== null) {
            sections.push({ label: match[1].trim(), content: '', startIdx: match.index + match[0].length });
          }
          for (let i = 0; i < sections.length; i++) {
            const end = i + 1 < sections.length ? body.lastIndexOf('\n##', sections[i + 1].startIdx) : body.length;
            sections[i].content = body.slice(sections[i].startIdx, end).trim();
          }
          
          const stages: SOPStage[] = sections.map((sec) => {
            let type: SOPStage['type'] = 'ai_auto';
            let prompt = sec.content;
            const typeMatch = sec.content.match(/[-*]\s*type\s*[:：]\s*(\w+)/i);
            if (typeMatch) {
              const rawType = typeMatch[1].toLowerCase();
              if (['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'].includes(rawType)) {
                type = rawType as SOPStage['type'];
              }
              prompt = sec.content.replace(typeMatch[0], '').trim();
            }
            return {
              id: Math.random().toString(36).slice(2, 10),
              label: sec.label,
              description: '',
              type,
              promptTemplate: type.startsWith('ai') ? prompt : '',
              outputType: 'markdown' as const,
              outputLabel: '',
            };
          });
          
          // 6. 构建完整模板数据
          const templateData = {
            name: frontmatter.name || frontmatter['name'] || file.name.replace(/\.zip$/i, ''),
            description: frontmatter.description || frontmatter['description'] || '',
            category: (frontmatter.category || 'custom') as SOPCategory,
            status: 'active' as const,
            icon: 'clipboard-list',
            systemPrompt: body.match(/^([^#][\s\S]*?)(?=\n##|\n$)/)?.[1]?.trim() || '',
            stages,
            references,
            scripts,
            qualityChecklist: [],
            requiredTools: [],
            isBuiltin: false,
            createdBy: 'user',
          };
          
          const res = await fetch('/api/sop-templates/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData),
          });
          
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '导入失败' }));
            alert(err.error || t('sop.importError'));
          } else {
            useSOPTemplateStore.getState().fetchTemplates();
          }
        } else {
          // JSON 格式：直接解析
          const text = await file.text();
          const data = JSON.parse(text);
          const res = await fetch('/api/sop-templates/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '导入失败' }));
            alert(err.error || t('sop.importError'));
          } else {
            useSOPTemplateStore.getState().fetchTemplates();
          }
        }
      } catch (err) {
        console.error('Import error:', err);
        alert(t('sop.importError'));
      } finally {
        setImportLoading(false);
      }
    };
    input.click();
  }, [t]);
  
  // ESC 关闭编辑器
  useEscapeKey(showEditor, useCallback(() => setShowEditor(false), []));
  
  // 分类选项
  const categories: { key: CategoryFilter; label: string }[] = useMemo(() => [
    { key: 'all', label: t('sop.all') },
    { key: 'content', label: t('sop.content') },
    { key: 'analysis', label: t('sop.analysis') },
    { key: 'research', label: t('sop.research') },
    { key: 'development', label: t('sop.development') },
    { key: 'operations', label: t('sop.operations') },
    { key: 'media', label: t('sop.media') },
    { key: 'custom', label: t('sop.custom') },
  ], [t]);
  
  // 状态选项
  const statuses: { key: StatusFilter; label: string }[] = useMemo(() => [
    { key: 'all', label: t('sop.all') },
    { key: 'active', label: t('sop.active') },
    { key: 'draft', label: t('sop.draft') },
    { key: 'archived', label: t('sop.archived') },
  ], [t]);
  
  // 使用 useFilteredList 替代手动筛选
  const {
    filteredItems: filteredTemplates,
    searchQuery: search,
    setSearchQuery: setSearch,
    activeFilters,
    toggleFilter,
  } = useFilteredList<SOPTemplate>({
    items: templates,
    config: {
      searchFields: ['name', 'description'],
      filters: {
        content: (t) => t.category === 'content',
        analysis: (t) => t.category === 'analysis',
        research: (t) => t.category === 'research',
        development: (t) => t.category === 'development',
        operations: (t) => t.category === 'operations',
        media: (t) => t.category === 'media',
        custom: (t) => t.category === 'custom',
        draft: (t) => t.status === 'draft',
        active: (t) => t.status === 'active',
        archived: (t) => t.status === 'archived',
      },
    },
  });

  // 计算当前筛选状态用于 UI 显示
  const categoryFilter: CategoryFilter = (activeFilters.find(f =>
    ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'].includes(f)
  ) as CategoryFilter) || 'all';

  const statusFilter: StatusFilter = (activeFilters.find(f =>
    ['draft', 'active', 'archived'].includes(f)
  ) as StatusFilter) || 'all';

  // 设置筛选器（兼容原有 UI）
  const setCategoryFilter = (filter: CategoryFilter) => {
    // 清除现有分类筛选
    ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'].forEach(f => {
      if (activeFilters.includes(f)) toggleFilter(f);
    });
    if (filter !== 'all') toggleFilter(filter);
  };

  const setStatusFilter = (filter: StatusFilter) => {
    // 清除现有状态筛选
    ['draft', 'active', 'archived'].forEach(f => {
      if (activeFilters.includes(f)) toggleFilter(f);
    });
    if (filter !== 'all') toggleFilter(filter);
  };
  
  // 获取项目名称
  const getProjectName = useCallback((projectId: string | null) => {
    if (!projectId) return t('sop.global');
    const project = projects.find(p => p.id === projectId);
    return project?.name || t('sop.global');
  }, [projects, t]);
  
  // 打开新建/编辑
  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    setShowEditor(true);
  }, []);
  
  const handleEdit = useCallback((template: SOPTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  }, []);
  
  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
    setEditingTemplate(null);
  }, []);
  
  // 删除模板
  const handleDelete = useCallback(async (id: string) => {
    const success = await deleteTemplateAsync(id);
    if (success && selectedTemplateId === id) {
      setSelectedTemplateId(null);
    }
  }, [deleteTemplateAsync, selectedTemplateId]);
  
  // === 渲染模板 ===
  const [selectedRtId, setSelectedRtId] = useState<string | null>(null);
  const rtDeleteConfirm = useConfirmAction<string>();
  type RtDetailTab = 'preview' | 'code' | 'slots';
  const [rtDetailTab, setRtDetailTab] = useState<RtDetailTab>('preview');
  // AI 创建渲染模板
  const [showAiCreateRt, setShowAiCreateRt] = useState(false);
  const [aiCreateRtPrompt, setAiCreateRtPrompt] = useState('');
  const [aiCreateRtSending, setAiCreateRtSending] = useState(false);
  const aiCreateRtTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const openChatWithMessage = useChatStore((s) => s.openChatWithMessage);

  // v3.0 多用户：获取用户专用会话键（注意：不在组件级别缓存，而是在函数调用时实时计算）
  const authUser = useAuthStore((s) => s.user);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);
  
  const selectedRt = useMemo(() => 
    renderTemplates.find(t => t.id === selectedRtId) || null,
    [renderTemplates, selectedRtId]
  );
  
  const handleDeleteRt = useCallback(async (id: string) => {
    const success = await deleteRenderTemplate(id);
    if (success && selectedRtId === id) setSelectedRtId(null);
  }, [deleteRenderTemplate, selectedRtId]);
  
  // 切换到渲染模板标签时加载数据
  useEffect(() => {
    if (pageTab === 'render' && renderTemplates.length === 0) fetchRenderTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTab]);
  
  // 新建渲染模板
  const handleCreateRenderTemplate = useCallback(() => {
    const name = prompt(t('sop.templateName'));
    if (!name) return;
    const defaultHtml = [
      '<div style="max-width:800px;margin:0 auto;padding:48px;font-family:sans-serif;color:#1a1a2e;background:#fff;">',
      '  <h1 data-slot="title">标题</h1>',
      '  <div data-slot="body">正文内容</div>',
      '</div>',
    ].join('\n');
    const defaultMd = '<!-- @slot:title -->\n# 标题\n\n<!-- @slot:body -->\n正文内容';
    useRenderTemplateStore.getState().createTemplate({
      name,
      description: '',
      category: 'custom',
      status: 'active',
      htmlTemplate: defaultHtml,
      mdTemplate: defaultMd,
      cssTemplate: '',
      slots: { title: { label: '标题', type: 'text', placeholder: '输入标题' }, body: { label: '正文', type: 'richtext', placeholder: '输入正文' } } as Record<string, unknown>,
      sections: [{ id: 'main', label: '主体', slots: ['title', 'body'] }],
      exportConfig: { formats: ['jpg', 'html'] },
      thumbnail: null,
      isBuiltin: false,
      createdBy: 'user',
    } as Omit<NewRenderTemplate, 'id' | 'createdAt' | 'updatedAt'>);
  }, [t]);
  
  // 导入渲染模板（支持 JSON 或 MD 文件）
  const [rtImportLoading, setRtImportLoading] = useState(false);
  const handleImportRenderTemplate = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.markdown';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setRtImportLoading(true);
      try {
        const text = await file.text();
        const fileName = file.name.replace(/\.(json|md|markdown)$/i, '');
        
        if (file.name.endsWith('.json')) {
          // JSON 格式：完整的模板定义
          const data = JSON.parse(text);
          await useRenderTemplateStore.getState().createTemplate({
            name: data.name || fileName,
            description: data.description || '',
            category: data.category || 'custom',
            status: data.status || 'draft',
            htmlTemplate: data.htmlTemplate || '',
            mdTemplate: data.mdTemplate || '',
            cssTemplate: data.cssTemplate || '',
            slots: data.slots || {},
            sections: data.sections || [],
            exportConfig: data.exportConfig || { formats: ['jpg', 'html'] },
            thumbnail: data.thumbnail || null,
            isBuiltin: false,
            createdBy: 'user',
          } as Omit<NewRenderTemplate, 'id' | 'createdAt' | 'updatedAt'>);
        } else {
          // MD 格式：只包含 mdTemplate，需要用户后续补充 HTML
          // 解析 frontmatter 获取模板元信息
          const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
          let name = fileName;
          let description = '';
          let category = 'custom';
          
          if (fmMatch) {
            const fm = fmMatch[1];
            const body = fmMatch[2];
            
            // 解析 frontmatter
            fm.split('\n').forEach(line => {
              const m = line.match(/^(\w+):\s*(.+)$/);
              if (m) {
                if (m[1] === 'name') name = m[2].trim();
                if (m[1] === 'description') description = m[2].trim();
                if (m[1] === 'category') category = m[2].trim();
              }
            });
            
            // 从 MD 中提取 slot 定义
            const slots: Record<string, { label: string; type: string; placeholder?: string }> = {};
            const slotPattern = /<!--\s*@slot:(\w+)\s*(?:label=["'](.+?)["'])?\s*(?:type=["'](\w+)["'])?\s*(?:placeholder=["'](.+?)["'])?\s*-->/g;
            let match;
            while ((match = slotPattern.exec(body)) !== null) {
              slots[match[1]] = {
                label: match[2] || match[1],
                type: match[3] || 'richtext',
                placeholder: match[4],
              };
            }
            
            await useRenderTemplateStore.getState().createTemplate({
              name,
              description,
              category,
              status: 'draft', // MD 导入默认为草稿，需要补充 HTML
              htmlTemplate: '', // MD 导入时为空，需要后续补充
              mdTemplate: body,
              cssTemplate: '',
              slots,
              sections: Object.keys(slots).map(slot => ({ id: slot, label: slots[slot].label, slots: [slot] })),
              exportConfig: { formats: ['jpg', 'html'] },
              thumbnail: null,
              isBuiltin: false,
              createdBy: 'user',
            } as Omit<NewRenderTemplate, 'id' | 'createdAt' | 'updatedAt'>);
          } else {
            // 无 frontmatter，直接使用整个内容作为 mdTemplate
            await useRenderTemplateStore.getState().createTemplate({
              name,
              description: '',
              category: 'custom',
              status: 'draft',
              htmlTemplate: '',
              mdTemplate: text,
              cssTemplate: '',
              slots: {},
              sections: [],
              exportConfig: { formats: ['jpg', 'html'] },
              thumbnail: null,
              isBuiltin: false,
              createdBy: 'user',
            } as Omit<NewRenderTemplate, 'id' | 'createdAt' | 'updatedAt'>);
          }
        }
        
        // 刷新列表
        fetchRenderTemplates();
      } catch (err) {
        console.error('导入渲染模板失败:', err);
        alert(t('sop.importError'));
      } finally {
        setRtImportLoading(false);
      }
    };
    input.click();
  }, [t, fetchRenderTemplates]);

  // AI 创建渲染模板：通过聊天信道发送需求给 Agent
  const handleAiCreateRt = useCallback(() => {
    if (!aiCreateRtPrompt.trim() || aiCreateRtSending) return;
    setAiCreateRtSending(true);

    // v3.0 多用户：在函数内部实时计算用户专用会话键（确保 agentsDefaultId 已加载）
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;

    const message = `请为 TeamClaw 创建一个 HTML 渲染模板，需求如下：

${aiCreateRtPrompt.trim()}

## 模板规范

渲染模板由以下部分组成：
1. **htmlTemplate** — HTML 结构，动态数据位置用 \`data-slot="slotName"\` 属性标记
2. **mdTemplate** — 对应的 Markdown 模板，用 \`<!-- @slot:slotName -->\` 标记每个槽位
3. **cssTemplate** — 可选的自定义 CSS
4. **slots** — 每个 data-slot 的定义：\`{ label, type: 'text'|'richtext'|'image'|'data', placeholder }\`
5. **sections** — 区块分组定义：\`{ id, label, slots: string[] }\`

## 安全约束
- 禁止 <script>、on* 事件属性、javascript: 协议、<iframe>
- 所有样式用 inline style 或 cssTemplate

请使用 MCP 工具 \`create_render_template\` 创建模板。创建后模板为 draft 状态。`;

    // v3.0 多用户：传入用户专用会话键
    openChatWithMessage(message, { sessionKey: userSessionKey || undefined });
    if (aiCreateRtTimerRef.current) clearTimeout(aiCreateRtTimerRef.current);
    aiCreateRtTimerRef.current = setTimeout(() => {
      setAiCreateRtSending(false);
      setAiCreateRtPrompt('');
      setShowAiCreateRt(false);
    }, 500);
  }, [aiCreateRtPrompt, aiCreateRtSending, openChatWithMessage, authUser, getUserSessionKey]);

  // 渲染模板分类颜色
  const rtCategoryColors: Record<string, string> = useMemo(() => ({
    report: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    card: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    poster: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    presentation: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
    custom: 'bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400',
  }), []);
  
  // 选中的模板
  const selectedTemplate = useMemo(() => 
    filteredTemplates.find(t => t.id === selectedTemplateId) || null,
    [filteredTemplates, selectedTemplateId]
  );
  
  // 阶段类型标签
  const getStageTypeLabel = useCallback((type: SOPStage['type']) => {
    const labels: Record<SOPStage['type'], string> = {
      input: t('sop.stageTypeInput'),
      ai_auto: t('sop.stageTypeAiAuto'),
      ai_with_confirm: t('sop.stageTypeAiConfirm'),
      manual: t('sop.stageTypeManual'),
      render: t('sop.stageTypeRender'),
      export: t('sop.stageTypeExport'),
      review: t('sop.stageTypeReview'),
    };
    return labels[type] || type;
  }, [t]);
  
  // 阶段类型颜色
  const getStageTypeColor = useCallback((type: SOPStage['type']) => {
    const colors: Record<SOPStage['type'], string> = {
      input: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      ai_auto: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
      ai_with_confirm: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      manual: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
      render: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
      export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
      review: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  }, []);

  return (
    <AppShell>
      <Header title={t('sop.title')} />
      
      <div className="p-6">
        {/* 页面标签切换 */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setPageTab('sop')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              pageTab === 'sop'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
            style={{ color: pageTab === 'sop' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            <ClipboardList className="w-4 h-4" />
            {t('sop.title')}
          </button>
          <button
            onClick={() => setPageTab('render')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              pageTab === 'render'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
            style={{ color: pageTab === 'render' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            <Palette className="w-4 h-4" />
            {t('sop.renderTemplatesTab')}
          </button>
        </div>

        {pageTab === 'sop' ? (
          <>
            {/* SOP 工具栏 */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('sop.search')}
                    className="pl-9 w-64"
                  />
                </div>
                
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCategoryFilter(cat.key)}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                        categoryFilter === cat.key
                          ? 'bg-white dark:bg-slate-700 shadow-sm'
                          : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
                      )}
                      style={{ color: categoryFilter === cat.key ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {statuses.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleImport} disabled={importLoading}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  {importLoading ? '...' : t('sop.importTemplate')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/examples/skill-creator-template.zip';
                  link.download = 'skill-creator-template.zip';
                  link.click();
                }}>
                  <Download className="w-4 h-4 mr-1.5" />
                  {t('sop.downloadExample')}
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('sop.newTemplate')}
                </Button>
              </div>
            </div>
            
            {/* SOP 主内容区：左侧列表 + 右侧详情 */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
                  {loading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                      {t('common.loading')}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="p-8 text-center">
                      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('sop.noTemplates')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('sop.noTemplatesHint')}
                      </p>
                    </div>
                  ) : (
                    filteredTemplates.map(template => {
                      const CategoryIcon = categoryIcons[template.category as SOPCategory] || Layers;
                      const isSelected = selectedTemplateId === template.id;
                      
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={clsx(
                            'p-4 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                            isSelected && 'bg-blue-50/50 dark:bg-blue-950/30'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              categoryColors[template.category as SOPCategory] || categoryColors.custom
                            )}>
                              <CategoryIcon className="w-5 h-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {template.name}
                                </span>
                                {template.isBuiltin && (
                                  <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                    {t('sop.builtin')}
                                  </Badge>
                                )}
                                {template.status === 'draft' && (
                                  <Badge className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-800">
                                    {t('sop.draft')}
                                  </Badge>
                                )}
                                {template.status === 'archived' && (
                                  <Badge className="text-[9px] bg-red-50 text-red-500 dark:bg-red-950">
                                    {t('sop.archived')}
                                  </Badge>
                                )}
                              </div>
                              
                              {template.description && (
                                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                                  {template.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {Array.isArray(template.stages) ? template.stages.length : 0} {t('sop.stages')}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {getProjectName(template.projectId)}
                                </span>
                              </div>
                            </div>
                            
                            <ChevronRight 
                              className={clsx('w-4 h-4 flex-shrink-0 transition-transform', isSelected && 'rotate-90')} 
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* SOP 模板详情 */}
              <div className="col-span-7">
                {selectedTemplate ? (
                  <div className="card p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-14 h-14 rounded-xl flex items-center justify-center',
                          categoryColors[selectedTemplate.category as SOPCategory] || categoryColors.custom
                        )}>
                          {(() => {
                            const Icon = categoryIcons[selectedTemplate.category as SOPCategory] || Layers;
                            return <Icon className="w-7 h-7" />;
                          })()}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedTemplate.name}
                          </h2>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {selectedTemplate.description || t('sop.descriptionPlaceholder')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleGenerateSkill(selectedTemplate.id)}
                          disabled={generatingSkillId === selectedTemplate.id}
                          className="flex items-center gap-1"
                        >
                          {generatingSkillId === selectedTemplate.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {t('sop.generateSkill')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleExport(selectedTemplate.id)}>
                          <Download className="w-3.5 h-3.5 mr-1" />
                          {t('sop.exportTemplate')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(selectedTemplate)}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          {t('common.edit')}
                        </Button>
                        {!selectedTemplate.isBuiltin && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => deleteConfirm.requestConfirm(selectedTemplate.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.category')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`sop.${selectedTemplate.category}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.status')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`sop.${selectedTemplate.status}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.linkedProject')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {getProjectName(selectedTemplate.projectId)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                        {t('sop.stagesTitle')} ({Array.isArray(selectedTemplate.stages) ? selectedTemplate.stages.length : 0})
                      </h3>
                      
                      {!Array.isArray(selectedTemplate.stages) || selectedTemplate.stages.length === 0 ? (
                        <div className="p-4 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            {t('sop.noStages')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTemplate.stages.map((stage, index) => (
                            <div 
                              key={stage.id} 
                              className="flex items-center gap-3 p-3 rounded-lg border"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                              >
                                {index + 1}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {stage.label}
                                  </span>
                                  <span className={clsx('px-1.5 py-0.5 text-[10px] font-medium rounded', getStageTypeColor(stage.type))}>
                                    {getStageTypeLabel(stage.type)}
                                  </span>
                                  {stage.optional && (
                                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                                  )}
                                </div>
                                {stage.description && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                                    {stage.description}
                                  </p>
                                )}
                              </div>
                              
                              {stage.outputType && (
                                <Badge className="text-[9px]">
                                  {stage.outputType}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {Array.isArray(selectedTemplate.qualityChecklist) && selectedTemplate.qualityChecklist.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.qualityChecklist')} ({selectedTemplate.qualityChecklist.length})
                        </h3>
                        <div className="space-y-1.5">
                          {selectedTemplate.qualityChecklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card p-12 text-center">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('agents.selectAgent').replace('Agent', 'SOP')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 渲染模板标签页 */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('renderTemplate.subtitle')}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleImportRenderTemplate}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  {t('sop.importTemplate')}
                </Button>
                <Button variant="secondary" onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/examples/landingpage-template.md';
                  link.download = 'landingpage-template.md';
                  link.click();
                }}>
                  <Download className="w-4 h-4 mr-1.5" />
                  {t('sop.downloadExample')}
                </Button>
                <Button variant="secondary" onClick={() => setShowAiCreateRt(!showAiCreateRt)}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('renderTemplate.aiCreate')}
                </Button>
              </div>
            </div>
            
            {/* AI 创建渲染模板弹出面板 */}
            {showAiCreateRt && (
              <div className="mb-6 card p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('renderTemplate.aiCreate')}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('renderTemplate.aiCreateHint')}</span>
                </div>
                <textarea
                  value={aiCreateRtPrompt}
                  onChange={(e) => setAiCreateRtPrompt(e.target.value)}
                  placeholder={t('renderTemplate.aiCreatePlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none mb-3"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowAiCreateRt(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={handleAiCreateRt} disabled={!aiCreateRtPrompt.trim() || aiCreateRtSending}>
                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    {aiCreateRtSending ? t('renderTemplate.aiCreateSending') : t('renderTemplate.aiCreate')}
                  </Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-12 gap-6">
              {/* 渲染模板列表 */}
              <div className="col-span-5">
                <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
                  {rtLoading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                      {t('common.loading')}
                    </div>
                  ) : renderTemplates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('renderTemplate.noTemplates')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('renderTemplate.noTemplatesHint')}
                      </p>
                    </div>
                  ) : (
                    renderTemplates.map(rt => {
                      const isSelected = selectedRtId === rt.id;
                      const catColor = rtCategoryColors[rt.category] || rtCategoryColors.custom;
                      
                      return (
                        <div
                          key={rt.id}
                          onClick={() => setSelectedRtId(rt.id)}
                          className={clsx(
                            'p-4 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                            isSelected && 'bg-purple-50/50 dark:bg-purple-950/30'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              catColor
                            )}>
                              <Palette className="w-5 h-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {rt.name}
                                </span>
                                {rt.isBuiltin && (
                                  <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                    {t('sop.builtin')}
                                  </Badge>
                                )}
                                <Badge className={clsx('text-[9px]', catColor)}>
                                  {t(`renderTemplate.${rt.category}`)}
                                </Badge>
                              </div>
                              
                              {rt.description && (
                                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                                  {rt.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {rt.status === 'active' ? t('sop.active') : rt.status === 'draft' ? t('sop.draft') : t('sop.archived')}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {Object.keys(rt.slots || {}).length} {t('renderTemplate.slots', 'slots')}
                                </span>
                              </div>
                            </div>
                            
                            <ChevronRight 
                              className={clsx('w-4 h-4 flex-shrink-0 transition-transform', isSelected && 'rotate-90')} 
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* 渲染模板详情 */}
              <div className="col-span-7">
                {selectedRt ? (
                  <div className="card p-6">
                    {/* 头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-14 h-14 rounded-xl flex items-center justify-center',
                          rtCategoryColors[selectedRt.category] || rtCategoryColors.custom
                        )}>
                          <Palette className="w-7 h-7" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedRt.name}
                          </h2>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {selectedRt.description || t('renderTemplate.noTemplatesHint')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!selectedRt.isBuiltin && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => rtDeleteConfirm.requestConfirm(selectedRt.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* 元信息 */}
                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.category')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`renderTemplate.${selectedRt.category}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.status')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {selectedRt.status === 'active' ? t('sop.active') : selectedRt.status === 'draft' ? t('sop.draft') : t('sop.archived')}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('renderTemplate.subtitle')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {selectedRt.isBuiltin ? t('sop.builtin') : t('sop.custom')}
                        </p>
                      </div>
                    </div>
                    
                    {/* 详情 Tab 切换 */}
                    <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      {([
                        { key: 'preview' as RtDetailTab, icon: Eye, label: t('renderTemplate.previewTab') },
                        { key: 'code' as RtDetailTab, icon: Code2, label: t('renderTemplate.codeTab') },
                        { key: 'slots' as RtDetailTab, icon: SlidersHorizontal, label: t('renderTemplate.slotsTab') },
                      ]).map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setRtDetailTab(tab.key)}
                          className={clsx(
                            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            rtDetailTab === tab.key
                              ? 'bg-white dark:bg-slate-700 shadow-sm'
                              : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
                          )}
                          style={{ color: rtDetailTab === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* 预览 Tab */}
                    {rtDetailTab === 'preview' && (
                      <div className="rounded-lg overflow-hidden border flex-1 min-h-0" style={{ borderColor: 'var(--border)' }}>
                        {selectedRt.htmlTemplate ? (() => {
                          // 将 mdTemplate 示例内容注入到 HTML 骨架中，用于预览
                          let injectedHtml = selectedRt.htmlTemplate;
                          if (selectedRt.mdTemplate) {
                            try {
                              const result = directSyncMdToHtml(
                                selectedRt.mdTemplate,
                                selectedRt.htmlTemplate,
                                (selectedRt.slots || {}) as Record<string, SlotDef>,
                                selectedRt.cssTemplate || undefined,
                              );
                              injectedHtml = result.html;
                            } catch { /* 降级到原始 htmlTemplate */ }
                          }
                          const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#f8fafc;}${selectedRt.cssTemplate || ''}</style></head><body>${injectedHtml}</body></html>`;
                          return (
                            <iframe
                              srcDoc={previewHtml}
                              className="w-full"
                              style={{ height: 'calc(100vh - 400px)', minHeight: '500px', border: 'none' }}
                              sandbox="allow-same-origin"
                              title="rt-preview"
                            />
                          );
                        })() : (
                          <div className="p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                            {t('studio.noContent')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 代码 Tab */}
                    {rtDetailTab === 'code' && (
                      <div className="space-y-4">
                        {selectedRt.htmlTemplate && (
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                              HTML Template
                            </h3>
                            <pre className="text-xs p-4 rounded-lg overflow-auto max-h-60 font-mono"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                            >
                              {selectedRt.htmlTemplate}
                            </pre>
                          </div>
                        )}
                        {selectedRt.mdTemplate && (
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                              Markdown Template
                            </h3>
                            <pre className="text-xs p-4 rounded-lg overflow-auto max-h-40 font-mono"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                            >
                              {selectedRt.mdTemplate}
                            </pre>
                          </div>
                        )}
                        {selectedRt.cssTemplate && (
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                              CSS
                            </h3>
                            <pre className="text-xs p-4 rounded-lg overflow-auto max-h-40 font-mono"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                            >
                              {selectedRt.cssTemplate}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 槽位 Tab */}
                    {rtDetailTab === 'slots' && (
                      <div className="space-y-4">
                        {/* 槽位定义 */}
                        {selectedRt.slots && Object.keys(selectedRt.slots).length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                              Slots ({Object.keys(selectedRt.slots).length})
                            </h3>
                            <div className="space-y-2">
                              {Object.entries(selectedRt.slots).map(([key, slot]) => (
                                <div 
                                  key={key} 
                                  className="flex items-center gap-3 p-3 rounded-lg border"
                                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                                >
                                  <code className="text-xs font-mono px-2 py-0.5 rounded" 
                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)' }}>
                                    {key}
                                  </code>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                      {String((slot as Record<string, unknown>)?.label || key)}
                                    </span>
                                    {typeof (slot as Record<string, unknown>)?.type === 'string' && (
                                      <Badge className="text-[9px] ml-2">
                                        {String((slot as Record<string, unknown>).type)}
                                      </Badge>
                                    )}
                                  </div>
                                  {typeof (slot as Record<string, unknown>)?.placeholder === 'string' && (
                                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                      {String((slot as Record<string, unknown>).placeholder)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 区块定义 */}
                        {Array.isArray(selectedRt.sections) && selectedRt.sections.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                              Sections ({selectedRt.sections.length})
                            </h3>
                            <div className="space-y-2">
                              {selectedRt.sections.map((section, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg border"
                                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                                >
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                      {String((section as Record<string, unknown>)?.label || `Section ${idx + 1}`)}
                                    </span>
                                    {Boolean((section as Record<string, unknown>)?.repeatable) && (
                                      <Badge className="text-[9px] ml-2 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                        repeatable
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card p-12 text-center">
                    <Palette className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('renderTemplate.noTemplatesHint')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 编辑器弹窗 */}
      {showEditor && (
        <SOPTemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
        />
      )}
      
      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('sop.deleteTemplate')}
        message={t('sop.deleteConfirm')}
        onConfirm={() => {
          if (deleteConfirm.target) handleDelete(deleteConfirm.target);
          deleteConfirm.cancel();
        }}
        onClose={deleteConfirm.cancel}
      />
      
      {/* 渲染模板删除确认 */}
      <ConfirmDialog
        isOpen={rtDeleteConfirm.isOpen}
        title={t('sop.deleteTemplate')}
        message={t('sop.deleteConfirm')}
        onConfirm={() => {
          if (rtDeleteConfirm.target) handleDeleteRt(rtDeleteConfirm.target);
          rtDeleteConfirm.cancel();
        }}
        onClose={rtDeleteConfirm.cancel}
      />
    </AppShell>
  );
}
