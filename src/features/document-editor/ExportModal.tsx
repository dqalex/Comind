/**
 * ExportModal — 导出对话框（JPG/PNG/HTML）
 *
 * 基于 GrowthPilot ExportModal.jsx 经验：
 * - 使用 html-to-image 而非 html2canvas（CSS 还原度更高，体积仅 50KB）
 * - 等待 document.fonts.ready + 图片 onload（替代硬等待 2500ms）
 * - 长图高度取 scrollHeight/offsetHeight/clientHeight 最大值，兜底 800px
 * - 导出前清理编辑属性（contenteditable、element-selected 等）
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X, Image, FileCode, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { cleanEditorAttributes } from '@/shared/lib/slot-sync';

export type ExportFormat = 'jpg' | 'png' | 'html';

export interface ExportConfig {
  formats: ExportFormat[];
  defaultWidth?: number;
  defaultScale?: number;
  mode?: '16:9' | 'long' | 'a4' | 'custom';
}

export interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
  exportConfig?: ExportConfig;
  fileName?: string;
}

// 预设尺寸
const MODE_DIMENSIONS: Record<string, { width: number; height?: number }> = {
  '16:9': { width: 1920, height: 1080 },
  'a4': { width: 794, height: 1123 },  // A4 @96dpi
  'long': { width: 1080 },
  'custom': { width: 1920 },
};

// 缩放倍率选项
const SCALE_OPTIONS = [1, 2, 3, 4];

export default function ExportModal({
  open,
  onClose,
  htmlContent,
  exportConfig,
  fileName = 'content-studio-export',
}: ExportModalProps) {
  const { t } = useTranslation();

  const [format, setFormat] = useState<ExportFormat>(exportConfig?.formats?.[0] || 'jpg');
  const [scale, setScale] = useState(exportConfig?.defaultScale || 2);
  const [width, setWidth] = useState(exportConfig?.defaultWidth || MODE_DIMENSIONS[exportConfig?.mode || '16:9']?.width || 1920);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  const availableFormats = exportConfig?.formats || ['jpg', 'png', 'html'];

  const handleExport = useCallback(async () => {
    if (!htmlContent) return;

    setExporting(true);

    try {
      if (format === 'html') {
        // HTML 导出：直接下载清理后的 HTML
        setProgress(t('studio.exportCleaningHtml'));
        const cleanHtml = cleanEditorAttributes(htmlContent);
        downloadBlob(new Blob([cleanHtml], { type: 'text/html' }), `${fileName}.html`);
        setProgress('');
        onClose();
        return;
      }

      // 图片导出（JPG/PNG）
      setProgress(t('studio.exportPreparingFrame'));

      // 动态导入 html-to-image（仅在需要时加载）
      const htmlToImage = await import('html-to-image');

      // 清理编辑属性
      const cleanHtml = cleanEditorAttributes(htmlContent);

      // 从完整 HTML 文档中提取 <style> 和 <body> 内容
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(cleanHtml, 'text/html');
      const styles = Array.from(parsedDoc.querySelectorAll('style')).map(s => s.outerHTML).join('\n');
      const bodyContent = parsedDoc.body.innerHTML;

      // 提取 body 的背景样式（优先用模板自身的背景）
      const bodyBg = parsedDoc.body.style.background || parsedDoc.body.style.backgroundColor || '';

      // 创建截图用的 div
      // 重要：使用 opacity:0 + pointer-events:none 隐藏，而非 left:-99999px
      // html-to-image 对视口外的元素截图会产生纯黑图片
      const captureDiv = document.createElement('div');
      captureDiv.style.position = 'fixed';
      captureDiv.style.top = '0';
      captureDiv.style.left = '0';
      captureDiv.style.width = `${width}px`;
      captureDiv.style.opacity = '0';
      captureDiv.style.pointerEvents = 'none';
      captureDiv.style.zIndex = '-9999';
      captureDiv.style.overflow = 'hidden';
      // 不强制白色背景 — 让模板自身的 CSS 决定背景色
      if (bodyBg) {
        captureDiv.style.background = bodyBg;
      }
      captureDiv.innerHTML = `${styles}<div>${bodyContent}</div>`;
      document.body.appendChild(captureDiv);

      try {
        // 等待字体和图片加载
        setProgress(t('studio.exportWaitingResources'));
        await waitForResources(document);

        // 额外等待截图 div 中的图片
        const imgs = captureDiv.querySelectorAll('img');
        if (imgs.length > 0) {
          await Promise.race([
            Promise.all(Array.from(imgs).map(img =>
              img.complete ? Promise.resolve() : new Promise<void>(r => {
                img.onload = () => r();
                img.onerror = () => r();
              })
            )),
            new Promise(r => setTimeout(r, 5000)),
          ]);
        }

        // 等待重排
        await new Promise(resolve => setTimeout(resolve, 300));

        const captureHeight = Math.max(captureDiv.scrollHeight || 0, captureDiv.offsetHeight || 0, 800);

        setProgress(t('studio.exportGeneratingImage'));

        // 截图前临时设为可见（html-to-image 需要节点可见来正确渲染）
        captureDiv.style.opacity = '1';

        const exportFn = format === 'png' ? htmlToImage.toPng : htmlToImage.toJpeg;
        const options = {
          width: width * scale,
          height: captureHeight * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${width}px`,
            height: `${captureHeight}px`,
          },
          quality: format === 'jpg' ? 0.95 : undefined,
          cacheBust: true,
        };

        const dataUrl = await exportFn(captureDiv, options);

        // 下载
        const ext = format === 'png' ? 'png' : 'jpg';
        const blob = dataURLToBlob(dataUrl);
        downloadBlob(blob, `${fileName}.${ext}`);

        setProgress('');
        onClose();
      } finally {
        document.body.removeChild(captureDiv);
      }
    } catch (err) {
      console.error('[ExportModal] 导出失败:', err);
      setProgress(t('studio.exportFailed'));
      setTimeout(() => setProgress(''), 3000);
    } finally {
      setExporting(false);
    }
  }, [htmlContent, format, scale, width, fileName, onClose, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative w-[400px] bg-[var(--bg-primary)] rounded-lg shadow-xl border border-[var(--border)]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {t('studio.export')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 格式选择 */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2 block">
              {t('studio.exportFormat')}
            </label>
            <div className="flex gap-2">
              {availableFormats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs transition-colors',
                    format === f
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                  )}
                >
                  {f === 'html' ? <FileCode size={14} /> : <Image size={14} />}
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 图片倍率（仅图片格式） */}
          {format !== 'html' && (
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">
                {t('studio.exportScale')}
              </label>
              <div className="flex gap-2">
                {SCALE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md border text-xs transition-colors',
                      scale === s
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                {t('studio.exportResolution')}: {width * scale} × auto
              </div>
            </div>
          )}

          {/* 宽度设置 */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2 block">
              {t('studio.exportWidth')}
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value, 10) || 1920)}
              className="w-full h-8 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
            />
          </div>

          {/* 导出状态 */}
          {progress && (
            <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400">
              <Loader2 size={14} className="animate-spin" />
              {progress}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !htmlContent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t('studio.exportNow')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 工具函数 =====

/**
 * 等待文档中的字体和图片加载完成
 * 替代 GrowthPilot 的硬等待 setTimeout(2500)
 */
async function waitForResources(doc: Document): Promise<void> {
  const timeout = 10000; // 最大等待 10s

  const fontReady = doc.fonts?.ready || Promise.resolve();

  const imagePromises: Promise<void>[] = [];
  doc.querySelectorAll('img').forEach((img) => {
    if (!img.complete) {
      imagePromises.push(
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
      );
    }
  });

  await Promise.race([
    Promise.all([fontReady, ...imagePromises]),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

/**
 * Data URL 转 Blob
 */
function dataURLToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 下载 Blob 文件
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，确保浏览器有时间启动下载
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
