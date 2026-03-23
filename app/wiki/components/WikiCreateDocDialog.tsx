'use client';

import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@/shared/ui';
import {
  FileText, File, Globe, Eye,
  BookOpen, FileQuestion, Calendar, CheckSquare, ClipboardList,
} from 'lucide-react';
import clsx from 'clsx';
import { DOC_TEMPLATES } from '@/lib/doc-templates';
import { syncMdToHtml as directSyncMdToHtml, generatePreviewHtml } from '@/lib/slot-sync';
import { typeColors, typeOrder } from '../hooks/useWikiPage';
import type { RenderTemplate } from '@/db/schema';
import { Rss } from 'lucide-react';
import { useInlineEdit } from '@/shared/hooks/useInlineEdit';

const typeIcons: Record<string, typeof FileText> = {
  guide: BookOpen, reference: FileText, report: ClipboardList, note: BookOpen,
  decision: FileText, scheduled_task: Calendar, task_list: CheckSquare, blog: Rss, other: FileQuestion,
};

interface WikiCreateDocDialogProps {
  newDocTitle: string;
  setNewDocTitle: (v: string) => void;
  newDocSource: 'local' | 'external';
  setNewDocSource: (v: 'local' | 'external') => void;
  newDocType: string;
  setNewDocType: (v: string) => void;
  newDocProjectTags: string[];
  setNewDocProjectTags: (v: string[]) => void;
  newDocRenderTemplateId: string;
  setNewDocRenderTemplateId: (v: string) => void;
  templatePreviewMode: 'html' | 'md';
  setTemplatePreviewMode: (v: 'html' | 'md') => void;
  projects: { id: string; name: string }[];
  renderTemplates: RenderTemplate[];
  typeLabels: Record<string, string>;
  onSubmit: () => void;
  onClose: () => void;
}

export default function WikiCreateDocDialog({
  newDocTitle, setNewDocTitle,
  newDocSource, setNewDocSource,
  newDocType, setNewDocType,
  newDocProjectTags, setNewDocProjectTags,
  newDocRenderTemplateId, setNewDocRenderTemplateId,
  templatePreviewMode, setTemplatePreviewMode,
  projects, renderTemplates, typeLabels,
  onSubmit, onClose,
}: WikiCreateDocDialogProps) {
  const { t } = useTranslation();

  // 使用 useInlineEdit Hook 处理标题输入的 Enter/Blur 双重提交问题
  const { handleKeyDown, handleBlur, isSaving } = useInlineEdit({
    onSave: async () => {
      if (newDocTitle.trim()) {
        onSubmit();
      }
    },
  });

  const selectedRt = newDocRenderTemplateId ? renderTemplates.find(tpl => tpl.id === newDocRenderTemplateId) : null;
  const hasTemplate = !!selectedRt?.htmlTemplate;

  // 预览 HTML
  let previewHtml = selectedRt?.htmlTemplate || '';
  if (hasTemplate && selectedRt?.mdTemplate) {
    try {
      const result = directSyncMdToHtml(
        selectedRt.mdTemplate,
        selectedRt.htmlTemplate!,
        (selectedRt.slots || {}) as Record<string, import('@/lib/slot-sync').SlotDef>,
        selectedRt.cssTemplate || undefined,
      );
      previewHtml = result.html;
    } catch { /* 降级到原始 htmlTemplate */ }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-doc-title">
      <div className={clsx('rounded-2xl shadow-float flex', hasTemplate ? 'w-[840px] max-h-[85vh]' : 'w-96')} style={{ background: 'var(--surface)' }}>
        {/* 左侧：表单 */}
        <div className={clsx('p-6 flex flex-col', hasTemplate ? 'w-[380px] flex-shrink-0 border-r overflow-y-auto' : 'w-full')} style={hasTemplate ? { borderColor: 'var(--border)' } : undefined}>
          <h3 id="create-doc-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('wiki.createDocTitle')}</h3>
          <div className="space-y-3 flex-1">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docTitle')}</label>
              <Input value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)}
                onKeyDown={e => handleKeyDown(e, newDocTitle)} onBlur={() => handleBlur(newDocTitle)}
                placeholder={t('wiki.docTitlePlaceholder')} autoFocus disabled={isSaving.current} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.source')}</label>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" variant={newDocSource === 'local' ? 'primary' : 'secondary'} onClick={() => setNewDocSource('local')}>
                  <File className="w-3.5 h-3.5" /> {t('wiki.local')}
                </Button>
                <Button size="sm" className="flex-1" variant={newDocSource === 'external' ? 'primary' : 'secondary'} onClick={() => setNewDocSource('external')}>
                  <Globe className="w-3.5 h-3.5" /> {t('wiki.external')}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docType')}</label>
              <div className="flex flex-wrap gap-1.5">
                {typeOrder.map(tp => {
                  const Icon = typeIcons[tp];
                  return (
                    <button key={tp} onClick={() => setNewDocType(tp)}
                      className={clsx('text-xs px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors',
                        newDocType === tp
                          ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      )} style={newDocType !== tp ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                      <Icon className={clsx('w-3 h-3', typeColors[tp])} /> {typeLabels[tp]}
                    </button>
                  );
                })}
              </div>
              {DOC_TEMPLATES[newDocType] && (
                <div className="text-[10px] px-2 py-1 rounded mt-1" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                  {t('wiki.willAutoFill', { type: typeLabels[newDocType] })}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.linkProjects')}</label>
              <div className="flex flex-wrap gap-1.5">
                {projects.map(p => {
                  const selected = newDocProjectTags.includes(p.name);
                  return (
                    <button key={p.id} onClick={() => {
                      setNewDocProjectTags(selected ? newDocProjectTags.filter(n => n !== p.name) : [...newDocProjectTags, p.name]);
                    }}
                      className={clsx('text-xs px-2 py-1 rounded-lg border transition-colors',
                        selected ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      )} style={!selected ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                      {p.name} {selected && '✓'}
                    </button>
                  );
                })}
                {projects.length === 0 && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noProjects')}</span>}
              </div>
            </div>
            {renderTemplates.filter(tpl => tpl.status === 'active').length > 0 && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('studio.renderTemplate')}</label>
                <Select
                  value={newDocRenderTemplateId}
                  onChange={(e) => { setNewDocRenderTemplateId(e.target.value); setTemplatePreviewMode('html'); }}
                  className="text-xs"
                >
                  <option value="">{t('studio.noTemplate')}</option>
                  {renderTemplates.filter(tpl => tpl.status === 'active').map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.category})</option>
                  ))}
                </Select>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {newDocRenderTemplateId ? t('studio.templateWithExample') : t('studio.templateHint')}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button size="sm" variant="secondary" onClick={() => { onClose(); setNewDocProjectTags([]); setNewDocType('note'); setNewDocRenderTemplateId(''); }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={onSubmit}>{t('common.create')}</Button>
          </div>
        </div>
        {/* 右侧：模板预览 */}
        {hasTemplate && selectedRt && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <Eye className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-xs font-medium mr-2" style={{ color: 'var(--text-secondary)' }}>{t('studio.templatePreview')}</span>
              <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)] rounded-md p-0.5">
                <button onClick={() => setTemplatePreviewMode('html')}
                  className={clsx('px-2 py-0.5 rounded text-[11px] transition-colors',
                    templatePreviewMode === 'html'
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm font-medium'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  )}>
                  {t('studio.htmlView')}
                </button>
                <button onClick={() => setTemplatePreviewMode('md')}
                  className={clsx('px-2 py-0.5 rounded text-[11px] transition-colors',
                    templatePreviewMode === 'md'
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm font-medium'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  )}>
                  {t('studio.mdView')}
                </button>
              </div>
              <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                {selectedRt.slots ? `${Object.keys(selectedRt.slots).length} ${t('renderTemplate.slots')}` : ''}
              </span>
            </div>
            <div className="flex-1 overflow-auto" style={{ background: templatePreviewMode === 'html' ? '#f8fafc' : 'var(--surface)' }}>
              {templatePreviewMode === 'html' ? (
                <iframe
                  srcDoc={generatePreviewHtml(previewHtml, selectedRt.cssTemplate || undefined)}
                  className="w-full h-full"
                  style={{ border: 'none', minHeight: '400px' }}
                  sandbox="allow-same-origin"
                  title="template-preview"
                />
              ) : (
                <div className="p-4">
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {selectedRt.mdTemplate || '(无 MD 模板)'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
