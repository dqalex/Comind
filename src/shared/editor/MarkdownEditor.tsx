'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { generateIframeScript, updateMdSlots, syncMdToHtml, htmlToSimpleMd } from '@/lib/slot-sync';
import { MD_RICHTEXT_STYLES } from '@/lib/services/sync-service';
import { renderIconsInHtml } from '@/lib/icon-render';
import MarkdownContent from './MarkdownContent';
import MarkdownToolbar from './MarkdownToolbar';
import HtmlPreview from './HtmlPreview';
import type { MarkdownEditorProps, ViewMode, DeviceMode, EditorTextSelection } from './types';

export type { EditorTextSelection };

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  readOnly,
  onSelectionChange,
  renderHtml,
  renderCss,
  slotDefs,
  editOnly,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>(editOnly ? 'edit' : (readOnly ? 'preview' : 'split'));
  const [previewSubMode, setPreviewSubMode] = useState<'md' | 'html'>('md');
  const editorViewRef = useRef<EditorView | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 属性面板
  const [elementSelection, setElementSelection] = useState<{ slotName: string; slotType: string; styles: Record<string, string>; content: string } | null>(null);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);

  // 设备模式
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('responsive');
  const [htmlScale, setHtmlScale] = useState(1);
  const [autoScale, setAutoScale] = useState(true);
  const [htmlEditMode, setHtmlEditMode] = useState(false);
  const htmlContainerRef = useRef<HTMLDivElement>(null);
  const htmlIframeRef = useRef<HTMLIFrameElement>(null);
  const splitHtmlIframeRef = useRef<HTMLIFrameElement>(null);

  // 退出编辑模式前同步 slot 值
  const handleToggleEditMode = useCallback(() => {
    if (htmlEditMode) {
      // 退出编辑模式：先收集数据，再关闭编辑模式
      const iframe = htmlIframeRef.current;
      if (iframe?.contentWindow) {
        try {
          const doc = iframe.contentWindow.document;
          const slotElements = doc.querySelectorAll('[data-slot]');
          if (slotElements.length > 0) {
            const slotValues: Record<string, string> = {};
            slotElements.forEach((el: Element) => {
              const slotName = el.getAttribute('data-slot') || '';
              const slotType = el.getAttribute('data-slot-type') || 'content';
              let content = '';
              switch (slotType) {
                case 'image': {
                  const img = el.querySelector('img');
                  content = img?.getAttribute('src') || '';
                  break;
                }
                case 'data':
                  content = el.textContent || '';
                  break;
                default:
                  // 将 HTML 内容转换回简单 MD 格式
                  content = htmlToSimpleMd(el.innerHTML);
                  break;
              }
              slotValues[slotName] = content;
            });
            const newContent = updateMdSlots(value, slotValues);
            if (newContent !== value) {
              onChange(newContent);
            }
          }
        } catch {
          // iframe 跨域或已卸载，忽略
        }
      }
      // 最后关闭编辑模式
      setHtmlEditMode(false);
    } else {
      // 进入编辑模式：直接切换
      setHtmlEditMode(true);
    }
  }, [htmlEditMode, value, onChange]);

  // 自适应缩放
  const updateAutoScale = useCallback(() => {
    if (!autoScale || deviceMode === 'responsive' || !htmlContainerRef.current) return;
    const device = deviceMode === 'pc'
      ? { width: 1920, height: 1080 }
      : { width: 375, height: 812 };
    const rect = htmlContainerRef.current.getBoundingClientRect();
    const containerWidth = rect.width - 16;
    const containerHeight = rect.height - 16;
    const scaleX = containerWidth / device.width;
    const scaleY = containerHeight / device.height;
    setHtmlScale(Math.min(scaleX, scaleY, 1));
  }, [autoScale, deviceMode]);

  useEffect(() => {
    if (!autoScale || deviceMode === 'responsive' || !htmlContainerRef.current) return;
    const observer = new ResizeObserver(() => updateAutoScale());
    observer.observe(htmlContainerRef.current);
    return () => observer.disconnect();
  }, [autoScale, deviceMode, updateAutoScale]);

  useEffect(() => {
    if (deviceMode === 'responsive') {
      setAutoScale(true);
      setHtmlScale(1);
    } else {
      setAutoScale(true);
      updateAutoScale();
    }
  }, [deviceMode, updateAutoScale]);

  // 填充 HTML slot
  const filledRenderHtml = useMemo(() => {
    if (!renderHtml || !slotDefs || !value) return '';
    const result = syncMdToHtml(value, renderHtml, slotDefs, renderCss);
    return renderIconsInHtml(result.html);
  }, [renderHtml, renderCss, slotDefs, value]);

  // 非编辑模式 HTML 预览
  const previewSrcDoc = useMemo(() => {
    const processedHtml = filledRenderHtml ? renderIconsInHtml(filledRenderHtml) : '';
    if (processedHtml) return processedHtml;
    if (!renderHtml) return '';
    const processedRenderHtml = renderIconsInHtml(renderHtml);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:auto;}${MD_RICHTEXT_STYLES}${renderCss || ''}</style></head><body>${processedRenderHtml}</body></html>`;
  }, [filledRenderHtml, renderHtml, renderCss]);

  // 编辑模式 HTML（带脚本）
  const htmlWithEditScript = useMemo(() => {
    if (!renderHtml || !htmlEditMode) return '';
    const script = generateIframeScript();
    const scriptTag = `<script data-studio-inject="true">${script}</script>`;
    const processedRenderHtml = renderIconsInHtml(renderHtml);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:auto;}${MD_RICHTEXT_STYLES}${renderCss || ''}</style></head><body>${processedRenderHtml}${scriptTag}</body></html>`;
  }, [renderHtml, renderCss, htmlEditMode]);

  // 分屏 HTML 预览（轻量选中脚本）
  const splitHtmlWithSelectScript = useMemo(() => {
    if (!renderHtml) return '';
    const baseHtml = filledRenderHtml || renderHtml;
    const baseIsFullDoc = filledRenderHtml ? true : false;
    const processedBaseHtml = renderIconsInHtml(baseHtml);
    const selectScript = `
<script>(function(){
  var selected = null;
  document.querySelectorAll('[data-slot]').forEach(function(el) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      if (selected) selected.style.outline = '';
      selected = el;
      el.style.outline = '2px solid #3b82f6';
      el.style.outlineOffset = '2px';
      window.parent.postMessage({
        type: 'splitElementSelected',
        slotName: el.getAttribute('data-slot'),
      }, '*');
    });
    el.addEventListener('mouseover', function() {
      if (el !== selected) el.style.outline = '1px dashed #93c5fd';
    });
    el.addEventListener('mouseout', function() {
      if (el !== selected) el.style.outline = '';
    });
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('[data-slot]') && selected) {
      selected.style.outline = '';
      selected = null;
    }
  });
})()</script>`;
    if (baseIsFullDoc) {
      return processedBaseHtml.replace('</body>', `${selectScript}</body>`);
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:auto;}${MD_RICHTEXT_STYLES}${renderCss || ''}</style></head><body>${processedBaseHtml}${selectScript}</body></html>`;
  }, [renderHtml, renderCss, filledRenderHtml]);

  // 分屏 HTML 点击定位到 MD (CodeMirror 版本)
  useEffect(() => {
    if (viewMode !== 'split' || previewSubMode !== 'html') return;
    const handleMessage = (e: MessageEvent) => {
      if (splitHtmlIframeRef.current && e.source !== splitHtmlIframeRef.current.contentWindow) return;
      const { type, slotName } = e.data || {};
      if (type === 'splitElementSelected' && slotName && editorViewRef.current) {
        const lines = value.split('\n');
        const slotPattern = `<!-- @slot:${slotName} -->`;
        let targetLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(slotPattern)) {
            targetLine = i;
            break;
          }
        }
        if (targetLine >= 0) {
          const view = editorViewRef.current;
          // 定位到对应行
          const lineInfo = view.state.doc.line(targetLine + 1); // CodeMirror 行号从 1 开始
          view.dispatch({
            selection: { anchor: lineInfo.from, head: lineInfo.to },
            scrollIntoView: true,
            effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
          });
          view.focus();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [viewMode, previewSubMode, value]);

  // iframe 编辑变更监听
  useEffect(() => {
    if (!htmlEditMode) return;
    const handleMessage = (e: MessageEvent) => {
      if (htmlIframeRef.current && e.source !== htmlIframeRef.current.contentWindow) return;
      const { type, slotValues, slotName, slotType, styles, content } = e.data || {};
      switch (type) {
        case 'contentChanged':
          if (slotValues && onChange) {
            const newContent = updateMdSlots(value, slotValues as Record<string, string>);
            if (newContent !== value) {
              onChange(newContent);
            }
          }
          break;
        case 'elementSelected':
          setElementSelection({
            slotName: slotName || '',
            slotType: slotType || 'content',
            styles: styles || {},
            content: content || '',
          });
          break;
        case 'elementDeselected':
          setElementSelection(null);
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [htmlEditMode, value, onChange]);

  // 属性面板回调
  const handlePropertyStyleChange = useCallback((slotName: string, styles: Record<string, string>) => {
    const iframe = htmlIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'setStyle', slotName, styles }, '*');
  }, []);

  const handlePropertyTextChange = useCallback((slotName: string, newValue: string) => {
    const iframe = htmlIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'setText', slotName, value: newValue }, '*');
  }, []);

  const handlePropertyImageReplace = useCallback((slotName: string, imageUrl: string) => {
    const iframe = htmlIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'replaceImage', slotName, value: imageUrl }, '*');
  }, []);

  // 预览区文本选中
  const handlePreviewMouseUp = useCallback(() => {
    if (!onSelectionChange) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      onSelectionChange(null);
      return;
    }
    const selectedText = sel.toString().trim();
    const fmMatch = value.match(/^---\r?\n[\s\S]*?\r?\n---/);
    const frontmatterLines = fmMatch ? fmMatch[0].split('\n').length : 0;
    const lines = value.split('\n');
    let lineIndex = -1;
    const normalizedSelected = selectedText.replace(/\s+/g, ' ').slice(0, 100);

    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = lines[i].replace(/\s+/g, ' ');
      const plainLine = normalizedLine.replace(/^#+\s+/, '').replace(/[*_~`[\]()]/g, '');
      if (plainLine && normalizedSelected.includes(plainLine.trim().slice(0, 30))) {
        lineIndex = i;
        break;
      }
      if (normalizedLine && normalizedSelected.includes(normalizedLine.trim().slice(0, 30))) {
        lineIndex = i;
        break;
      }
    }

    if (lineIndex < 0) {
      let node: Node | null = sel.anchorNode;
      while (node && node !== document) {
        if (node instanceof HTMLElement && node.dataset.sourceLine) {
          lineIndex = parseInt(node.dataset.sourceLine, 10);
          break;
        }
        node = node.parentNode;
      }
    }

    if (lineIndex < 0) lineIndex = 0;
    const contentLineIndex = Math.max(0, lineIndex - frontmatterLines);
    onSelectionChange({ text: selectedText, lineIndex: contentLineIndex });
  }, [onSelectionChange, value]);

  // 分屏 HTML 预览更新（保留 useEffect 因为 Split 模式下的 iframe 还是通过 ref 操作）
  useEffect(() => {
    if (splitHtmlIframeRef.current && viewMode === 'split' && previewSubMode === 'html') {
      splitHtmlIframeRef.current.srcdoc = splitHtmlWithSelectScript;
    }
  }, [viewMode, previewSubMode, splitHtmlWithSelectScript]);

  // 渲染
  return (
    <div className="flex flex-col h-full relative z-0">
      <MarkdownToolbar
        viewMode={viewMode}
        value={value}
        readOnly={readOnly}
        editOnly={editOnly}
        renderHtml={renderHtml}
        onViewModeChange={setViewMode}
      />

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'html' && renderHtml ? (
          <HtmlPreview
            renderHtml={renderHtml}
            renderCss={renderCss}
            slotDefs={slotDefs}
            value={value}
            deviceMode={deviceMode}
            htmlScale={htmlScale}
            autoScale={autoScale}
            htmlEditMode={htmlEditMode}
            showPropertyPanel={showPropertyPanel}
            elementSelection={elementSelection}
            htmlContainerRef={htmlContainerRef}
            htmlIframeRef={htmlIframeRef}
            srcDoc={htmlEditMode && htmlWithEditScript ? htmlWithEditScript : previewSrcDoc}
            onToggleEditMode={handleToggleEditMode}
            onDeviceModeChange={setDeviceMode}
            onScaleChange={setHtmlScale}
            onAutoScaleChange={setAutoScale}
            onShowPropertyPanelChange={setShowPropertyPanel}
            onPropertyStyleChange={handlePropertyStyleChange}
            onPropertyTextChange={handlePropertyTextChange}
            onPropertyImageReplace={handlePropertyImageReplace}
          />
        ) : (
          <>
            {(viewMode === 'edit' || viewMode === 'split') && !readOnly && (
              <div className={clsx(
                'relative overflow-hidden',
                viewMode === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-slate-700' : 'w-full'
              )}>
                {viewMode === 'split' && (
                  <div className="absolute top-0 left-0 right-0 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 z-10">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t('common.edit')}</span>
                  </div>
                )}
                <div className={clsx('h-full', viewMode === 'split' && 'pt-8')}>
                  <CodeMirror
                    value={value}
                    height="100%"
                    theme="dark"
                    placeholder={placeholder}
                    editable={!readOnly}
                    extensions={[
                      markdown({ base: markdownLanguage, codeLanguages: languages }),
                      EditorView.lineWrapping,
                    ]}
                    onChange={(val) => onChange(val)}
                    className="h-full text-sm [&>.cm-editor]:h-full [&>.cm-editor]:bg-slate-900 [&_.cm-content]:px-6 [&_.cm-content]:py-4 [&_.cm-content]:font-mono"
                    onCreateEditor={(view) => {
                      editorViewRef.current = view;
                    }}
                  />
                </div>
              </div>
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div
                className={clsx(
                  'flex flex-col h-full min-w-0',
                  viewMode === 'split' ? 'w-1/2' : 'w-full'
                )}
                onMouseUp={handlePreviewMouseUp}
              >
                {viewMode === 'split' && (
                  <div className="flex-shrink-0 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 z-10 flex items-center justify-between">
                    {renderHtml ? (
                      <div className="flex items-center gap-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded p-0.5">
                        <button
                          onClick={() => setPreviewSubMode('md')}
                          className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            previewSubMode === 'md'
                              ? 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          )}
                          type="button"
                        >
                          MD
                        </button>
                        <button
                          onClick={() => setPreviewSubMode('html')}
                          className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            previewSubMode === 'html'
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          )}
                          type="button"
                        >
                          {t('studio.templateVisualShort')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">预览</span>
                    )}
                  </div>
                )}
                {viewMode === 'split' && previewSubMode === 'html' && renderHtml ? (
                  <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                    <iframe
                      ref={splitHtmlIframeRef}
                      className="block w-full h-full"
                      style={{ border: 'none' }}
                      sandbox="allow-scripts allow-same-origin"
                      title="html-render-preview-split"
                    />
                  </div>
                ) : (
                  <div
                    ref={previewRef}
                    className="flex-1 min-h-0 overflow-y-auto p-6 prose prose-stone dark:prose-invert prose-sm max-w-none md-preview"
                  >
                    {value ? (
                      <MarkdownContent content={value} />
                    ) : (
                      <p className="text-slate-400 italic">暂无内容</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
