'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemberStore } from '@/domains';
import { MessageSquarePlus, Trash2, ChevronRight, ChevronLeft, StickyNote, User, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import clsx from 'clsx';
import { formatRelativeTime } from '@/hooks/useRelativeTime';

// 批注数据结构
export interface Annotation {
  id: string;        // 唯一 ID（时间戳）
  author: string;    // 用户昵称
  content: string;   // 批注内容
  lineIndex: number; // 批注在文档中的大致行位置（用于定位）
  createdAt: number; // 创建时间戳
}

// 选中文本信息（从 MarkdownEditor 传入）
export interface TextSelection {
  text: string;      // 选中的文本
  lineIndex: number; // 选中文本所在行号
}

// 从 MD 内容中解析批注：<!-- @用户名 [ID]: 内容 -->
export function parseAnnotations(content: string): Annotation[] {
  const annotations: Annotation[] = [];
  const regex = /<!--\s*@(\S+?)\s+\[(\d+)\]:\s*([\s\S]*?)\s*-->/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const author = match[1];
    const id = match[2];
    const annotationContent = match[3].trim();
    // 计算行号
    const beforeMatch = content.substring(0, match.index);
    const lineIndex = beforeMatch.split('\n').length - 1;

    annotations.push({
      id,
      author,
      content: annotationContent,
      lineIndex,
      createdAt: parseInt(id, 10),
    });
  }

  return annotations;
}

// 生成批注的 MD 注释文本
export function createAnnotationComment(author: string, content: string): string {
  const id = Date.now().toString();
  return `<!-- @${author} [${id}]: ${content} -->`;
}

// 从 MD 内容中删除指定批注
export function removeAnnotation(content: string, annotationId: string): string {
  const regex = new RegExp(`<!--\\s*@\\S+?\\s+\\[${annotationId}\\]:\\s*[\\s\\S]*?\\s*-->\\n?`, 'g');
  return content.replace(regex, '');
}

// 在指定行下方插入批注
function insertAnnotationAfterLine(content: string, lineIndex: number, comment: string): string {
  const lines = content.split('\n');
  // 确保 lineIndex 在有效范围内
  const insertAt = Math.min(Math.max(0, lineIndex + 1), lines.length);
  lines.splice(insertAt, 0, comment);
  return lines.join('\n');
}

interface AnnotationPanelProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  selection?: TextSelection | null; // 选中的文本信息
}

export default function AnnotationPanel({ content, onChange, readOnly, selection }: AnnotationPanelProps) {
  const { t, i18n } = useTranslation();
  // 精确 selector 订阅
  const getHumanMembers = useMemberStore((s) => s.getHumanMembers);
  const humanMembers = getHumanMembers();
  const currentUser = humanMembers[0];

  const [isOpen, setIsOpen] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 选中文本变化时，自动打开面板并进入添加模式
  useEffect(() => {
    if (selection?.text) {
      setIsOpen(true);
      setIsAdding(true);
    }
  }, [selection?.text, selection?.lineIndex]);

  // 解析所有批注
  const annotations = useMemo(() => parseAnnotations(content), [content]);

  // 添加批注（在选中文本下方插入，或无选中时追加到文档末尾）
  const handleAddAnnotation = useCallback(() => {
    if (!newAnnotation.trim() || !currentUser) return;
    const comment = createAnnotationComment(currentUser.name, newAnnotation.trim());

    let updatedContent: string;
    if (selection?.lineIndex !== undefined && selection.lineIndex >= 0) {
      // 在选中文本的行下方插入
      updatedContent = insertAnnotationAfterLine(content, selection.lineIndex, comment);
    } else {
      // 无选中文本，追加到文档末尾
      updatedContent = content.trimEnd() + '\n\n' + comment + '\n';
    }

    onChange(updatedContent);
    setNewAnnotation('');
    setIsAdding(false);
  }, [newAnnotation, currentUser, content, onChange, selection]);

  // 删除批注
  const handleDeleteAnnotation = useCallback((annotationId: string) => {
    const updatedContent = removeAnnotation(content, annotationId);
    onChange(updatedContent);
  }, [content, onChange]);

  // 点击跳转到批注位置（滚动预览区域）
  const handleJumpToAnnotation = useCallback((annotation: Annotation) => {
    // 方式 1: 查找 data-annotation-id 属性的元素
    const highlightEl = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightEl.classList.add('annotation-flash');
      setTimeout(() => highlightEl.classList.remove('annotation-flash'), 2000);
      return;
    }

    // 方式 2: 查找预览区域中对应行号附近的元素
    const previewEl = document.querySelector('.md-preview-content');
    if (previewEl) {
      const lineEls = previewEl.querySelectorAll('[data-source-line]');
      let closestEl: Element | null = null;
      let closestDist = Infinity;
      lineEls.forEach(el => {
        const line = parseInt(el.getAttribute('data-source-line') || '0', 10);
        const dist = Math.abs(line - annotation.lineIndex);
        if (dist < closestDist) {
          closestDist = dist;
          closestEl = el;
        }
      });
      if (closestEl) {
        (closestEl as Element).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (closestEl as HTMLElement).classList.add('annotation-flash');
        setTimeout(() => (closestEl as HTMLElement).classList.remove('annotation-flash'), 2000);
      }
    }
  }, []);

  // 批注是否允许添加：即使 readOnly（openclaw非编辑模式），也允许添加批注
  // readOnly 仅控制删除按钮的显示
  const canAdd = !!currentUser;
  const canDelete = !readOnly;

  return (
    <>
      {/* 折叠触发按钮 - 固定在右侧 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 px-1.5 py-3 rounded-l-lg shadow-lg transition-all',
          'bg-amber-500 text-white hover:bg-amber-600',
          isOpen && 'right-[320px]'
        )}
        title={t('wiki.annotations', { defaultValue: '批注' })}
      >
        <StickyNote className="w-4 h-4" />
        {annotations.length > 0 && (
          <span className="text-xs font-bold">{annotations.length}</span>
        )}
        {isOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* 侧边面板 */}
      <div
        className={clsx(
          'fixed right-0 top-0 h-full w-[320px] z-20 shadow-xl transition-transform duration-300 flex flex-col',
          'bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* 面板头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('wiki.annotations', { defaultValue: '批注' })}
            </span>
            <span className="text-xs text-slate-400">({annotations.length})</span>
          </div>
          {canAdd && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAdding(!isAdding)}
              className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 新增批注输入 */}
        {isAdding && canAdd && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
              <User className="w-3 h-3" />
              <span>{currentUser?.name || '用户'}</span>
            </div>
            {/* 选中文本提示 */}
            {selection?.text && (
              <div className="mb-2 px-2 py-1.5 rounded text-xs border-l-2 border-amber-400" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 block mb-0.5">
                  {t('wiki.selectedText', { defaultValue: '选中文本' })} ({t('wiki.line', { defaultValue: '行' })} {(selection.lineIndex || 0) + 1})
                </span>
                <span className="line-clamp-2">{selection.text}</span>
              </div>
            )}
            <textarea
              value={newAnnotation}
              onChange={(e) => setNewAnnotation(e.target.value)}
              placeholder={t('wiki.annotationPlaceholder', { defaultValue: '输入批注内容...' })}
              className="w-full p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              style={{ color: 'var(--text-primary)' }}
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleAddAnnotation();
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-400">⌘+Enter {t('wiki.toSubmit', { defaultValue: '提交' })}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewAnnotation(''); }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddAnnotation}
                  disabled={!newAnnotation.trim()}
                  className="bg-amber-500 text-white hover:bg-amber-600"
                >
                  {t('wiki.addAnnotation', { defaultValue: '添加批注' })}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 批注列表 */}
        <div className="flex-1 overflow-y-auto">
          {annotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
              <StickyNote className="w-8 h-8 mb-2 opacity-30" />
              <span>{t('wiki.noAnnotations', { defaultValue: '暂无批注' })}</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="group px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => handleJumpToAnnotation(annotation)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {annotation.author}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(annotation.createdAt, i18n.language)}
                      </span>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAnnotation(annotation.id);
                          }}
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed pl-4.5" style={{ color: 'var(--text-secondary)' }}>
                    {annotation.content}
                  </p>
                  <div className="flex items-center gap-1 mt-1 pl-4.5 text-[10px] text-slate-400">
                    <ArrowRight className="w-2.5 h-2.5" />
                    <span>{t('wiki.line', { defaultValue: '行' })} {annotation.lineIndex + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
