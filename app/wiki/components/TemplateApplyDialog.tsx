'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { Button, Select } from '@/shared/ui';
import type { Document, RenderTemplate } from '@/db/schema';
import { syncMdToHtml } from '@/lib/slot-sync';
import { X, Loader2, FileText, Folder, Wand2 } from 'lucide-react';
import clsx from 'clsx';

interface TemplateApplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDoc: Document;
  renderTemplates: RenderTemplate[];
  projects: { id: string; name: string }[];
  onSubmit: (data: { templateId: string; projectId: string }) => Promise<void>;
}

export function TemplateApplyDialog({
  isOpen,
  onClose,
  sourceDoc,
  renderTemplates,
  projects,
  onSubmit,
}: TemplateApplyDialogProps) {
  const { t } = useTranslation();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  
  // 过滤掉首页模板
  const availableTemplates = useMemo(() => 
    renderTemplates.filter(rt => !rt.id.includes('landing')),
    [renderTemplates]
  );
  
  // 获取选中的模板
  const selectedTemplate = useMemo(() => 
    availableTemplates.find(rt => rt.id === selectedTemplateId),
    [availableTemplates, selectedTemplateId]
  );
  
  // 生成预览（DOMPurify 清洗防止 XSS）
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setPreviewHtml('');
      return;
    }
    
    const template = availableTemplates.find(rt => rt.id === templateId);
    if (template && sourceDoc.content) {
      // 使用文档内容预览模板效果
      const result = syncMdToHtml(
        sourceDoc.content,
        template.htmlTemplate || '',
        template.slots as Record<string, import('@/lib/slot-sync').SlotDef>,
        template.cssTemplate || ''
      );
      // 清洗 HTML 防止 XSS 攻击
      setPreviewHtml(DOMPurify.sanitize(result.html));
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedTemplateId || !selectedProjectId) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        templateId: selectedTemplateId,
        projectId: selectedProjectId,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 对话框主体 */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--surface)' }}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t('wiki.applyTemplate')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('wiki.applyTemplateDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：源文档信息 + 配置 */}
          <div className="w-80 border-r flex flex-col" style={{ borderColor: 'var(--border)' }}>
            {/* 源文档 */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {t('wiki.sourceDocument')}
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {sourceDoc.title}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {sourceDoc.content?.length || 0} {t('wiki.characters')}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 模板选择 */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {t('wiki.selectTemplate')}
              </div>
              <Select
                value={selectedTemplateId}
                onChange={e => handleTemplateChange(e.target.value)}
                className="w-full text-sm"
              >
                <option value="">{t('wiki.pleaseSelect')}</option>
                {availableTemplates.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </Select>
            </div>
            
            {/* 项目选择 */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {t('wiki.selectProject')}
              </div>
              <Select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full text-sm"
              >
                <option value="">{t('wiki.pleaseSelect')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            
            {/* 模板信息 */}
            {selectedTemplate && (
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {t('wiki.templateInfo')}
                </div>
                <div className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
                  {selectedTemplate.description && (
                    <p>{selectedTemplate.description}</p>
                  )}
                  {selectedTemplate.slots && (
                    <div>
                      <span className="font-medium">{t('wiki.slotCount')}:</span>{' '}
                      {Object.keys(selectedTemplate.slots).length}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* 右侧：模板预览 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b text-[10px] font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
              {t('wiki.templatePreview')}
            </div>
            <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--surface-hover)' }}>
              {previewHtml ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Wand2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('wiki.selectTemplateToPreview')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('wiki.applyTemplateHint')}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedTemplateId || !selectedProjectId || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-1.5" />
                  {t('wiki.generateAndSend')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
