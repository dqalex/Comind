'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSOPTemplateStore, useProjectStore } from '@/domains';
import { useRenderTemplateStore } from '@/domains/render-template';
import { Button, Input, Badge } from '@/components/ui';
import type { SOPTemplate, SOPStage, SOPCategory, StageType, StageOutputType, ReferenceFile, ScriptFile } from '@/db/schema';
import ReferencesPanel from './ReferencesPanel';
import ScriptsPanel from './ScriptsPanel';
import clsx from 'clsx';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, GripVertical,
  FileText, Upload, Code, FolderOpen, Terminal,
} from 'lucide-react';

interface SOPTemplateEditorProps {
  template: SOPTemplate | null;  // null = 新建
  onClose: () => void;
}

// 生成唯一 ID
const generateId = () => Math.random().toString(36).slice(2, 10);

// 阶段类型选项
const stageTypeOptions: { value: StageType; label: string }[] = [
  { value: 'input', label: 'stageTypeInput' },
  { value: 'ai_auto', label: 'stageTypeAiAuto' },
  { value: 'ai_with_confirm', label: 'stageTypeAiConfirm' },
  { value: 'manual', label: 'stageTypeManual' },
  { value: 'render', label: 'stageTypeRender' },
  { value: 'export', label: 'stageTypeExport' },
  { value: 'review', label: 'stageTypeReview' },
];

// 产出类型选项
const outputTypeOptions: StageOutputType[] = ['text', 'markdown', 'html', 'data', 'file'];

// 分类选项
const categoryOptions: SOPCategory[] = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'];

export default function SOPTemplateEditor({ template, onClose }: SOPTemplateEditorProps) {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const createTemplate = useSOPTemplateStore((s) => s.createTemplate);
  const updateTemplateAsync = useSOPTemplateStore((s) => s.updateTemplateAsync);
  
  const projects = useProjectStore((s) => s.projects);
  
  const renderTemplates = useRenderTemplateStore((s) => s.templates);
  
  const isEditing = template !== null;
  const [saving, setSaving] = useState(false);
  
  // 表单状态
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<SOPCategory>(template?.category as SOPCategory || 'custom');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(template?.status as 'draft' | 'active' | 'archived' || 'active');
  const [icon, setIcon] = useState(template?.icon || 'clipboard-list');
  const [projectId, setProjectId] = useState<string | null>(template?.projectId || null);
  const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt || '');
  const [requiredTools, setRequiredTools] = useState<string[]>(template?.requiredTools || []);
  const [qualityChecklist, setQualityChecklist] = useState<string[]>(template?.qualityChecklist || []);
  
  // v3.1 新增：外挂文件
  const [references, setReferences] = useState<ReferenceFile[]>(() => {
    if (template?.references && Array.isArray(template.references)) {
      return template.references;
    }
    return [];
  });
  const [scripts, setScripts] = useState<ScriptFile[]>(() => {
    if (template?.scripts && Array.isArray(template.scripts)) {
      return template.scripts;
    }
    return [];
  });
  
  // 阶段列表
  const [stages, setStages] = useState<SOPStage[]>(() => {
    if (template?.stages && Array.isArray(template.stages)) {
      return template.stages;
    }
    return [];
  });
  
  // 编辑模式：表单 vs Markdown
  type EditMode = 'form' | 'markdown';
  const [editMode, setEditMode] = useState<EditMode>('form');
  const [mdContent, setMdContent] = useState('');
  const [showImportSkill, setShowImportSkill] = useState(false);
  const [importSkillContent, setImportSkillContent] = useState('');

  // 将 Skill YAML+Markdown 解析为 SOP 模板字段
  const parseSkillToTemplate = useCallback((raw: string): boolean => {
    try {
      const frontmatter: Record<string, string> = {};
      let body = raw;
      // 解析 --- frontmatter ---
      const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (fmMatch) {
        const fmLines = fmMatch[1].split('\n');
        for (const line of fmLines) {
          const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
          if (m) frontmatter[m[1].trim()] = m[2].trim();
        }
        body = fmMatch[2];
      }
      // 从 frontmatter 提取基本信息
      if (frontmatter.name) setName(frontmatter.name);
      if (frontmatter.description) setDescription(frontmatter.description);
      // 解析 ## 标题 → 阶段
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
      if (sections.length > 0) {
        const parsedStages: SOPStage[] = sections.map((sec) => {
          // 尝试从内容中提取 type 和 prompt
          let type: StageType = 'ai_auto';
          let prompt = sec.content;
          const typeMatch = sec.content.match(/[-*]\s*type\s*[:：]\s*(\w+)/i);
          if (typeMatch) {
            const rawType = typeMatch[1].toLowerCase();
            if (['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'].includes(rawType)) {
              type = rawType as StageType;
            }
            prompt = sec.content.replace(typeMatch[0], '').trim();
          }
          const promptMatch = prompt.match(/[-*]\s*prompt\s*[:：]\s*([\s\S]+?)(?=\n[-*]|\n##|$)/i);
          if (promptMatch) prompt = promptMatch[1].trim();
          return {
            id: generateId(),
            label: sec.label,
            description: '',
            type,
            promptTemplate: type.startsWith('ai') ? prompt : '',
            outputType: 'markdown' as const,
            outputLabel: '',
          };
        });
        setStages(parsedStages);
      }
      // 第一段非标题文本作为 systemPrompt
      const firstPara = body.match(/^([^#][\s\S]*?)(?=\n##|\n$)/);
      if (firstPara && firstPara[1].trim()) {
        setSystemPrompt(firstPara[1].trim());
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // 从表单字段生成 Markdown（用于切换到 MD 编辑模式时）
  const generateMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push('---');
    if (name) lines.push(`name: ${name}`);
    if (description) lines.push(`description: ${description}`);
    if (category !== 'custom') lines.push(`category: ${category}`);
    lines.push('---');
    lines.push('');
    if (systemPrompt) { lines.push(systemPrompt); lines.push(''); }
    for (const stage of stages) {
      lines.push(`## ${stage.label || '未命名阶段'}`);
      lines.push(`- type: ${stage.type}`);
      if (stage.promptTemplate) lines.push(`- prompt: ${stage.promptTemplate}`);
      if (stage.outputType && stage.outputType !== 'text') lines.push(`- outputType: ${stage.outputType}`);
      lines.push('');
    }
    return lines.join('\n');
  }, [name, description, category, systemPrompt, stages]);

  // 展开的阶段
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  
  // 新增质量检查项输入
  const [newCheckItem, setNewCheckItem] = useState('');
  
  // 添加阶段
  const handleAddStage = useCallback(() => {
    const newStage: SOPStage = {
      id: generateId(),
      label: '',
      description: '',
      type: 'ai_auto',
      promptTemplate: '',
      outputType: 'text',
      outputLabel: '',
    };
    setStages(prev => [...prev, newStage]);
    setExpandedStageId(newStage.id);
  }, []);
  
  // 更新阶段
  const handleUpdateStage = useCallback((id: string, updates: Partial<SOPStage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);
  
  // 删除阶段
  const handleDeleteStage = useCallback((id: string) => {
    setStages(prev => prev.filter(s => s.id !== id));
    if (expandedStageId === id) {
      setExpandedStageId(null);
    }
  }, [expandedStageId]);
  
  // 移动阶段
  const handleMoveStage = useCallback((id: string, direction: 'up' | 'down') => {
    setStages(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      
      const newStages = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newStages[idx], newStages[targetIdx]] = [newStages[targetIdx], newStages[idx]];
      return newStages;
    });
  }, []);
  
  // 拖拽排序状态
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  
  const handleDragStart = useCallback((e: React.DragEvent, stageId: string) => {
    setDragStageId(stageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stageId);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (stageId !== dragStageId) {
      setDragOverStageId(stageId);
    }
  }, [dragStageId]);
  
  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetStageId) {
      setDragStageId(null);
      setDragOverStageId(null);
      return;
    }
    setStages(prev => {
      const sourceIdx = prev.findIndex(s => s.id === sourceId);
      const targetIdx = prev.findIndex(s => s.id === targetStageId);
      if (sourceIdx < 0 || targetIdx < 0) return prev;
      const newStages = [...prev];
      const [removed] = newStages.splice(sourceIdx, 1);
      newStages.splice(targetIdx, 0, removed);
      return newStages;
    });
    setDragStageId(null);
    setDragOverStageId(null);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDragStageId(null);
    setDragOverStageId(null);
  }, []);
  
  // 添加质量检查项
  const handleAddCheckItem = useCallback(() => {
    if (!newCheckItem.trim()) return;
    setQualityChecklist(prev => [...prev, newCheckItem.trim()]);
    setNewCheckItem('');
  }, [newCheckItem]);
  
  // 删除质量检查项
  const handleDeleteCheckItem = useCallback((index: number) => {
    setQualityChecklist(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // 保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      if (isEditing && template) {
        await updateTemplateAsync(template.id, {
          name: name.trim(),
          description: description.trim(),
          category,
          status,
          icon,
          projectId,
          systemPrompt,
          requiredTools,
          qualityChecklist,
          stages,
          references,
          scripts,
        });
      } else {
        await createTemplate({
          name: name.trim(),
          description: description.trim(),
          category,
          status,
          icon,
          projectId,
          systemPrompt,
          requiredTools,
          qualityChecklist,
          stages,
          references,
          scripts,
          isBuiltin: false,
          createdBy: 'user',
        });
      }
      onClose();
    } catch (err) {
      console.error('Save template error:', err);
    } finally {
      setSaving(false);
    }
  }, [
    name, description, category, status, icon, projectId, 
    systemPrompt, requiredTools, qualityChecklist, stages,
    references, scripts,
    isEditing, template, createTemplate, updateTemplateAsync, onClose
  ]);
  
  // 表单验证
  const isValid = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 弹窗 */}
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? t('sop.editTemplate') : t('sop.createTemplate')}
          </h2>
          <div className="flex items-center gap-2">
            {/* 编辑模式切换 */}
            <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <button
                onClick={() => {
                  if (editMode === 'markdown') {
                    // 从 MD 模式切回表单模式时，解析 MD 内容
                    if (mdContent.trim()) parseSkillToTemplate(mdContent);
                  }
                  setEditMode('form');
                }}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  editMode === 'form' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''
                )}
                style={{ color: editMode === 'form' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                <CheckCircle2 className="w-3 h-3" />
                {t('sopEditor.formEditMode')}
              </button>
              <button
                onClick={() => {
                  if (editMode === 'form') {
                    // 从表单模式切到 MD 模式时，生成 MD
                    setMdContent(generateMarkdown());
                  }
                  setEditMode('markdown');
                }}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  editMode === 'markdown' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''
                )}
                style={{ color: editMode === 'markdown' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                <Code className="w-3 h-3" />
                {t('sopEditor.mdEditMode')}
              </button>
            </div>
            {/* 导入 Skill 按钮 */}
            <button
              onClick={() => setShowImportSkill(!showImportSkill)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Upload className="w-3.5 h-3.5" />
              {t('sopEditor.importSkill')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Skill 导入面板 */}
          {showImportSkill && (
            <div className="card p-4 border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('sopEditor.importSkill')}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('sopEditor.importSkillHint')}</span>
              </div>
              <textarea
                value={importSkillContent}
                onChange={(e) => setImportSkillContent(e.target.value)}
                placeholder={t('sopEditor.importSkillPlaceholder')}
                rows={8}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono mb-3"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setShowImportSkill(false); setImportSkillContent(''); }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!importSkillContent.trim()}
                  onClick={() => {
                    const ok = parseSkillToTemplate(importSkillContent);
                    if (ok) {
                      setShowImportSkill(false);
                      setImportSkillContent('');
                    } else {
                      alert(t('sopEditor.parseError'));
                    }
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  {t('sopEditor.parseSkill')}
                </Button>
              </div>
            </div>
          )}

          {/* Markdown 编辑模式 */}
          {editMode === 'markdown' ? (
            <div>
              <textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                placeholder={t('sopEditor.mdPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border text-sm resize-none font-mono leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  minHeight: '400px',
                }}
              />
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                支持 Skill 标准语法：--- frontmatter ---（name/description/category）+ ## 阶段标题 + - type: ai_auto + - prompt: ...
              </p>
            </div>
          ) : (
          <>
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.templateName')} *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('sop.templateNamePlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SOPCategory)}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{t(`sop.${cat}`)}</option>
                ))}
              </select>
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('sop.descriptionPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="active">{t('sop.active')}</option>
                <option value="draft">{t('sop.draft')}</option>
                <option value="archived">{t('sop.archived')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.linkedProject')}
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('sop.noProject')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* AI 配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('sop.aiConfig')}
            </h3>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.systemPrompt')}
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('sop.systemPromptPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none font-mono"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          
          {/* 阶段配置 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('sop.stagesTitle')} ({stages.length})
              </h3>
              <Button variant="secondary" size="sm" onClick={handleAddStage}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t('sop.addStage')}
              </Button>
            </div>
            
            {stages.length === 0 ? (
              <div 
                className="p-6 text-center rounded-lg border-2 border-dashed cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={handleAddStage}
              >
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('sop.noStages')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stages.map((stage, index) => {
                  const isExpanded = expandedStageId === stage.id;
                  
                  return (
                    <div
                      key={stage.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, stage.id)}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      onDragEnd={handleDragEnd}
                      className={clsx(
                        'border rounded-lg overflow-hidden transition-all',
                        dragStageId === stage.id && 'opacity-40',
                        dragOverStageId === stage.id && 'ring-2 ring-blue-400 dark:ring-blue-600',
                      )}
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      {/* 阶段头部 */}
                      <div 
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                      >
                        {/* 拖拽手柄 */}
                        <div 
                          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveStage(stage.id, 'up'); }}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveStage(stage.id, 'down'); }}
                            disabled={index === stages.length - 1}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                        >
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {stage.label || `Stage ${index + 1}`}
                          </span>
                          <Badge className="ml-2 text-[9px]">{t(`sop.${stageTypeOptions.find(o => o.value === stage.type)?.label || 'stageTypeAiAuto'}`)}</Badge>
                        </div>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id); }}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                        
                        <ChevronDown 
                          className={clsx('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
                          style={{ color: 'var(--text-tertiary)' }}
                        />
                      </div>
                      
                      {/* 阶段详情 */}
                      {isExpanded && (
                        <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.stageLabel')} *
                              </label>
                              <Input
                                value={stage.label}
                                onChange={(e) => handleUpdateStage(stage.id, { label: e.target.value })}
                                placeholder={t('sop.stageLabelPlaceholder')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.stageType')}
                              </label>
                              <select
                                value={stage.type}
                                onChange={(e) => handleUpdateStage(stage.id, { type: e.target.value as StageType })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {stageTypeOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{t(`sop.${opt.label}`)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                              {t('sop.stageDesc')}
                            </label>
                            <Input
                              value={stage.description}
                              onChange={(e) => handleUpdateStage(stage.id, { description: e.target.value })}
                              placeholder={t('sop.stageDescPlaceholder')}
                            />
                          </div>
                          
                          {/* AI 阶段显示 Prompt 模板 */}
                          {(stage.type === 'ai_auto' || stage.type === 'ai_with_confirm') && (
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.promptTemplate')}
                              </label>
                              <textarea
                                value={stage.promptTemplate || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { promptTemplate: e.target.value })}
                                placeholder={t('sop.promptTemplatePlaceholder')}
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none font-mono"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              />
                            </div>
                          )}

                          {/* render 阶段显示渲染模板选择器 */}
                          {stage.type === 'render' && (
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('studio.renderTemplate')}
                              </label>
                              <select
                                value={stage.renderTemplateId || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { renderTemplateId: e.target.value || undefined })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">{t('studio.noTemplate')}</option>
                                {renderTemplates.map(tpl => (
                                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                                ))}
                              </select>
                              <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                {t('studio.templateHint')}
                              </p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.outputType')}
                              </label>
                              <select
                                value={stage.outputType || 'text'}
                                onChange={(e) => handleUpdateStage(stage.id, { outputType: e.target.value as StageOutputType })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {outputTypeOptions.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.outputLabel')}
                              </label>
                              <Input
                                value={stage.outputLabel || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { outputLabel: e.target.value })}
                                placeholder="e.g., Analysis Result"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* 质量检查项 */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('sop.qualityChecklist')} ({qualityChecklist.length})
            </h3>
            
            <div className="space-y-2 mb-3">
              {qualityChecklist.map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{item}</span>
                  <button
                    onClick={() => handleDeleteCheckItem(idx)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <Input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                placeholder={t('sop.addCheckItem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCheckItem();
                  }
                }}
              />
              <Button variant="secondary" size="sm" onClick={handleAddCheckItem} disabled={!newCheckItem.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          {/* 参考文档面板 (v3.1) */}
          <ReferencesPanel
            references={references}
            onChange={setReferences}
          />
          
          {/* 脚本面板 (v3.1) */}
          <ScriptsPanel
            scripts={scripts}
            onChange={setScripts}
          />
          </>
          )}
        </div>
        
        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('sop.cancel')}
          </Button>
          <Button onClick={() => {
            // 如果在 MD 模式，先解析回表单字段
            if (editMode === 'markdown' && mdContent.trim()) {
              parseSkillToTemplate(mdContent);
            }
            handleSave();
          }} disabled={!isValid || saving}>
            {saving ? t('common.loading') : t('sop.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
