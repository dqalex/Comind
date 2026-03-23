'use client';

import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@/shared/ui';
import DeliveryStatusCard from '@/features/wiki-editor/DeliveryStatusCard';
import AnnotationPanel from '@/features/wiki-editor/AnnotationPanel';
import type { TextSelection } from '@/features/wiki-editor/AnnotationPanel';
import type { Document, RenderTemplate } from '@/db/schema';
import dynamic from 'next/dynamic';
import {
  ExternalLink, Tag, X, Link2,
  Share2, MessageSquare, Send,
  Download, Save, Edit2, XCircle, Trash2, LayoutTemplate, FolderOpen, Plus, Wand2,
  Lock, Eye
} from 'lucide-react';
import clsx from 'clsx';
import { tagColors, typeOrder } from '../hooks/useWikiPage';
import WikiKnowledgeGraph from './WikiKnowledgeGraph';
import { useInlineEdit } from '@/shared/hooks/useInlineEdit';

const MarkdownEditor = dynamic(() => import('@/shared/editor/MarkdownEditor'), {
  ssr: false,
  loading: () => <div className="flex-1" />,
});

interface WikiDocEditorProps {
  selectedDoc: Document | undefined;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editContent: string;
  onTitleSave: () => void;
  onContentChange: (v: string) => void;
  onSaveStudioHtml: () => void;
  studioHtmlContent: string;
  // 面板
  showTagEditor: boolean;
  setShowTagEditor: (v: boolean) => void;
  showKnowledgeGraph: boolean;
  setShowKnowledgeGraph: (v: boolean) => void;
  docRelations: any;
  // OpenClaw
  isEditingOpenclaw: boolean;
  setIsEditingOpenclaw: (v: boolean) => void;
  openclawEditContent: string;
  setOpenclawEditContent: (v: string) => void;
  savingOpenclaw: boolean;
  onSaveOpenclaw: () => void;
  onCancelOpenclawEdit: () => void;
  // 操作
  onShare: () => void;
  onChat: () => void;
  onDeliver: () => void;
  onDelete: () => void;
  onExport: () => void;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  // 元数据
  projects: { id: string; name: string }[];
  renderTemplates: RenderTemplate[];
  currentRenderTemplate: RenderTemplate | null;
  typeLabels: Record<string, string>;
  onTypeChange: (type: string) => void;
  onRenderTemplateChange: (id: string) => void;
  onToggleProjectTag: (name: string) => void;
  // 批注
  textSelection: TextSelection | null;
  setTextSelection: (sel: TextSelection | null) => void;
  // 套模板
  onApplyTemplate: () => void;
  // 权限
  isAdmin?: boolean;
}

export default function WikiDocEditor({
  selectedDoc, editTitle, setEditTitle, editContent,
  onTitleSave, onContentChange, onSaveStudioHtml, studioHtmlContent,
  showTagEditor, setShowTagEditor,
  showKnowledgeGraph, setShowKnowledgeGraph, docRelations,
  isEditingOpenclaw, setIsEditingOpenclaw,
  openclawEditContent, setOpenclawEditContent,
  savingOpenclaw, onSaveOpenclaw, onCancelOpenclawEdit,
  onShare, onChat, onDeliver, onDelete, onExport, onSelectDoc, onNewDoc,
  projects, renderTemplates, currentRenderTemplate, typeLabels,
  onTypeChange, onRenderTemplateChange, onToggleProjectTag,
  textSelection, setTextSelection,
  onApplyTemplate,
  isAdmin = false,
}: WikiDocEditorProps) {
  const { t } = useTranslation();

  // 使用 useInlineEdit Hook 处理标题编辑的 Enter/Blur 双重提交问题
  const { handleKeyDown, handleBlur, isSaving } = useInlineEdit({
    onSave: async () => {
      await onTitleSave();
    },
  });

  // 判断是否为博客类型文档且用户非管理员（只读模式）
  const isBlogReadOnly = selectedDoc?.type === 'blog' && !isAdmin;

  if (!selectedDoc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.selectToEdit')}</p>
          <Button size="sm" className="mt-3" onClick={onNewDoc}>
            <Plus className="w-3.5 h-3.5" /> {t('wiki.newDoc')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 标题栏 */}
      <div className="px-6 py-3 border-b flex items-center justify-between gap-3 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-1">
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onBlur={() => handleBlur(editTitle)} onKeyDown={e => handleKeyDown(e, editTitle)}
            className="text-lg font-display font-bold bg-transparent border-none outline-none flex-1"
            disabled={isBlogReadOnly || isSaving.current} />
          {isBlogReadOnly && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Eye className="w-3 h-3" /> {t('wiki.readOnly')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedDoc.source === 'external' && selectedDoc.externalUrl && (
            <a href={selectedDoc.externalUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: 'var(--text-secondary)' }}>
              <ExternalLink className="w-3.5 h-3.5" /> {t('wiki.openExternal')}
            </a>
          )}
          {selectedDoc.renderTemplateId && studioHtmlContent && (
            <>
              <Button size="sm" variant="ghost" className="text-xs" onClick={onSaveStudioHtml}>
                <Save className="w-3.5 h-3.5" /> {t('common.save')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950" onClick={onExport}>
                <Download className="w-3.5 h-3.5" /> {t('studio.export')}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-xs" onClick={onShare}>
            <Share2 className="w-3.5 h-3.5" /> {t('wiki.share')}
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onChat}>
            <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ai)' }} /> {t('wiki.chatWithAI')}
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={onDeliver}>
            <Send className="w-3.5 h-3.5" /> {t('wiki.submitDelivery', { defaultValue: '提交交付' })}
          </Button>
          {selectedDoc.source === 'openclaw' && (
            isEditingOpenclaw ? (
              <>
                <Button size="sm" className="text-xs" disabled={savingOpenclaw} onClick={onSaveOpenclaw}>
                  {savingOpenclaw ? <span className="animate-spin">⏳</span> : <Save className="w-3.5 h-3.5" />}
                  {t('common.save')}
                </Button>
                <Button size="sm" variant="secondary" className="text-xs" onClick={onCancelOpenclawEdit}>
                  <XCircle className="w-3.5 h-3.5" /> {t('common.cancel')}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" className="text-xs" onClick={() => setIsEditingOpenclaw(true)}>
                <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
              </Button>
            )
          )}
          {!isBlogReadOnly && (
            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 元数据栏 */}
      <div className="px-6 py-2 border-b flex items-center gap-4 flex-wrap flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
        {/* 类型 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.type')}</span>
          {isBlogReadOnly ? (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {typeLabels[selectedDoc.type]}
            </span>
          ) : (
            <Select value={selectedDoc.type} onChange={e => onTypeChange(e.target.value)} className="text-xs bg-transparent">
              {typeOrder.map(tp => <option key={tp} value={tp}>{typeLabels[tp]}</option>)}
            </Select>
          )}
        </div>

        {/* 渲染模板 */}
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          {selectedDoc.renderTemplateId ? (
            // 已有模板：显示 Select（只读）
            <Select
              value={selectedDoc.renderTemplateId || ''}
              onChange={e => onRenderTemplateChange(e.target.value)}
              disabled
              className="text-xs bg-transparent"
              title={t('wiki.templateLocked')}
            >
              {renderTemplates.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </Select>
          ) : (
            // 普通 MD 文档：显示"套模板"按钮
            <button
              onClick={onApplyTemplate}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-600 dark:text-purple-400"
            >
              <Wand2 className="w-3 h-3" />
              {t('wiki.applyTemplate')}
            </button>
          )}
        </div>

        <div className="w-px h-4" style={{ background: 'var(--border)' }} />

        {/* 项目标签 */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <button onClick={() => setShowTagEditor(!showTagEditor)}
            className={clsx(
              'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
              showTagEditor ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            )} style={!showTagEditor ? { color: 'var(--text-tertiary)' } : undefined}>
            <Tag className="w-3 h-3" />
            {(!Array.isArray(selectedDoc.projectTags) || selectedDoc.projectTags.length === 0) && !selectedDoc.projectId
              ? t('wiki.clickToLinkProject') : t('wiki.linkedProjects')}
          </button>
          {Array.isArray(selectedDoc.projectTags) && selectedDoc.projectTags.map((tag, i) => (
            <span key={tag} className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full', tagColors[i % tagColors.length])}>
              {tag}
              <button onClick={() => onToggleProjectTag(tag)} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          {selectedDoc.projectId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
              {t('wiki.primaryProject')}: {projects.find(p => p.id === selectedDoc.projectId)?.name || t('wiki.unknownProject')}
            </span>
          )}
          {(!Array.isArray(selectedDoc.projectTags) || selectedDoc.projectTags.length === 0) && !selectedDoc.projectId && (
            <span className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.notLinked')}</span>
          )}
        </div>

        {/* 知识图谱入口 */}
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <button onClick={() => setShowKnowledgeGraph(!showKnowledgeGraph)}
          className={clsx(
            'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
            showKnowledgeGraph ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          )} style={!showKnowledgeGraph ? { color: 'var(--text-tertiary)' } : undefined}>
          <Link2 className="w-3 h-3" />
          {t('wiki.relations')}
          {docRelations && (docRelations.linkedDocs.length + docRelations.backlinkDocs.length + docRelations.relatedTasks.length) > 0 && (
            <span className="ml-0.5 px-1 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400 text-[9px]">
              {docRelations.linkedDocs.length + docRelations.backlinkDocs.length + docRelations.relatedTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* 交付状态卡片 */}
      <DeliveryStatusCard document={selectedDoc} />

      {/* 项目标签编辑面板 */}
      {showTagEditor && (
        <div className="px-6 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.clickProjectToToggle')}</div>
          <div className="flex flex-wrap gap-1.5">
            {projects.map(p => {
              const isTagged = Array.isArray(selectedDoc.projectTags) && selectedDoc.projectTags.includes(p.name);
              const isPrimary = selectedDoc.projectId === p.id;
              return (
                <button key={p.id} onClick={() => onToggleProjectTag(p.name)}
                  className={clsx(
                    'text-[11px] px-2 py-1 rounded-lg border transition-colors',
                    isTagged ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                  style={!isTagged ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                  {p.name} {isPrimary && `(${t('wiki.primaryProject')})`}
                  {isTagged && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 知识图谱面板 */}
      {showKnowledgeGraph && docRelations && (
        <WikiKnowledgeGraph docRelations={docRelations} onSelectDoc={onSelectDoc} />
      )}

      {/* 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <div className="w-full h-full">
          <MarkdownEditor
            key={selectedDoc.id}
            value={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? openclawEditContent : editContent}
            onChange={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? setOpenclawEditContent : onContentChange}
            placeholder={isBlogReadOnly ? t('wiki.readOnlyHint') : t('wiki.startWriting')}
            readOnly={(selectedDoc.source === 'openclaw' && !isEditingOpenclaw) || isBlogReadOnly}
            onSelectionChange={(sel) => setTextSelection(sel ? { text: sel.text, lineIndex: sel.lineIndex } : null)}
            renderHtml={currentRenderTemplate ? (studioHtmlContent || currentRenderTemplate.htmlTemplate || undefined) : undefined}
            renderCss={currentRenderTemplate?.cssTemplate || undefined}
            slotDefs={currentRenderTemplate?.slots as Record<string, import('@/lib/slot-sync').SlotDef> | undefined}
          />
        </div>
      </div>

      {/* 批注面板 - 所有用户都可以批注 */}
      <AnnotationPanel
        content={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? openclawEditContent : editContent}
        onChange={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? setOpenclawEditContent : onContentChange}
        readOnly={(selectedDoc.source === 'openclaw' && !isEditingOpenclaw) || isBlogReadOnly}
        selection={textSelection}
      />
    </>
  );
}
