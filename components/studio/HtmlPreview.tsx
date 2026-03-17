/**
 * HtmlPreview — iframe 可视化预览/编辑组件
 *
 * 功能：
 * - 使用 srcdoc 渲染 HTML（非 blob URL — GrowthPilot 经验）
 * - 注入交互脚本，支持元素选中/双击编辑/图片替换
 * - postMessage 通信：父窗口 ↔ iframe 双向消息
 * - 预览/编辑双模式切换
 * - 设备模拟（PC/Mobile）+ ResizeObserver 自适应缩放
 */

'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, Edit3, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import clsx from 'clsx';
import { generateIframeScript, renderIconsInHtml } from '@/lib';

// ===== 类型定义 =====

export interface ElementSelection {
  slotName: string;
  slotType: string;
  content: string;
  styles: Record<string, string>;
}

export interface HtmlPreviewProps {
  htmlContent: string;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  onElementSelected?: (selection: ElementSelection | null) => void;
  onContentChanged?: (slotValues: Record<string, string>) => void;
  onImageReplaceRequest?: (slotName: string) => void;
  className?: string;
}

type DeviceMode = 'pc' | 'mobile';

// 设备尺寸预设
const DEVICE_PRESETS: Record<DeviceMode, { width: number; height: number }> = {
  pc: { width: 1920, height: 1080 },
  mobile: { width: 1024, height: 1366 },
};

export default function HtmlPreview({
  htmlContent,
  editMode = false,
  onEditModeChange,
  onElementSelected,
  onContentChanged,
  onImageReplaceRequest,
  className,
}: HtmlPreviewProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);

  const [deviceMode, setDeviceMode] = useState<DeviceMode>('pc');
  const [scale, setScale] = useState(1);
  const [autoScale, setAutoScale] = useState(true);

  const device = DEVICE_PRESETS[deviceMode];

  // 注入交互脚本和 Lucide 图标渲染到 HTML 内容中
  const htmlWithScript = useMemo(() => {
    if (!htmlContent) return '';

    // 先渲染 Lucide 图标为 SVG（React 端预处理）
    const htmlWithIcons = renderIconsInHtml(htmlContent);

    const script = generateIframeScript();
    // 在 </body> 前注入脚本
    const scriptTag = `<script data-studio-inject="true">${script}</script>`;

    if (htmlWithIcons.includes('</body>')) {
      return htmlWithIcons.replace('</body>', `${scriptTag}</body>`);
    }
    // 如果没有 body 标签，包装成完整 HTML
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlWithIcons}${scriptTag}</body></html>`;
  }, [htmlContent]);

  // 监听 iframe 消息
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // 安全检查：只接受来自自身 iframe 的消息
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

      const { type, slotName, slotType, styles, content, slotValues } = e.data || {};

      switch (type) {
        case 'elementSelected':
          onElementSelected?.({ slotName, slotType, content, styles });
          break;
        case 'elementDeselected':
          onElementSelected?.(null);
          break;
        case 'contentChanged':
          isInternalChangeRef.current = true;
          onContentChanged?.(slotValues);
          // 100ms 后重置标记（GrowthPilot 经验）
          setTimeout(() => { isInternalChangeRef.current = false; }, 100);
          break;
        case 'requestImageReplace':
          onImageReplaceRequest?.(slotName);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected, onContentChanged, onImageReplaceRequest]);

  // 同步编辑模式到 iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'toggleEditMode', value: editMode },
      '*'
    );
  }, [editMode]);

  // 自适应缩放（ResizeObserver — GrowthPilot 沿用）
  useEffect(() => {
    if (!autoScale || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width - 32; // padding
        const containerHeight = entry.contentRect.height - 32;
        const scaleX = containerWidth / device.width;
        const scaleY = containerHeight / device.height;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoScale, device.width, device.height]);

  // 向 iframe 发送样式修改指令
  const sendStyleCommand = useCallback((slotName: string, styles: Record<string, string>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'setStyle', slotName, styles },
      '*'
    );
  }, []);

  // 向 iframe 发送文本修改指令
  const sendTextCommand = useCallback((slotName: string, value: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'setText', slotName, value },
      '*'
    );
  }, []);

  // 向 iframe 发送图片替换指令
  const sendImageCommand = useCallback((slotName: string, imageUrl: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'replaceImage', slotName, value: imageUrl },
      '*'
    );
  }, []);

  const handleZoomIn = useCallback(() => {
    setAutoScale(false);
    setScale(s => Math.min(s + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setAutoScale(false);
    setScale(s => Math.max(s - 0.1, 0.2));
  }, []);

  const handleResetZoom = useCallback(() => {
    setAutoScale(true);
  }, []);

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        {/* 编辑/预览模式切换 */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-md p-0.5">
          <button
            onClick={() => onEditModeChange?.(false)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              !editMode
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Eye size={12} />
            {t('studio.preview')}
          </button>
          <button
            onClick={() => onEditModeChange?.(true)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              editMode
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Edit3 size={12} />
            {t('studio.edit')}
          </button>
        </div>

        {/* 设备切换：仅编辑模式下显示 */}
        {editMode && (
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-md p-0.5">
            <button
              onClick={() => setDeviceMode('pc')}
              className={clsx(
                'p-1 rounded transition-colors',
                deviceMode === 'pc'
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              title="PC (1920×1080)"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={clsx(
                'p-1 rounded transition-colors',
                deviceMode === 'mobile'
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              title="Mobile (1024×1366)"
            >
              <Smartphone size={14} />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* 缩放控制 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={t('studio.fitToWindow')}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* iframe 容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[var(--bg-tertiary)] flex items-start justify-center p-4"
      >
        {htmlContent ? (
          <div
            style={{
              width: device.width,
              height: device.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              flexShrink: 0,
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={htmlWithScript}
              className="w-full h-full border-0 bg-white rounded shadow-lg"
              sandbox="allow-scripts allow-same-origin"
              title="Content Studio Preview"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
            {t('studio.noContent')}
          </div>
        )}
      </div>
    </div>
  );
}

// 导出辅助类型和方法
export { type ElementSelection as StudioElementSelection };
export type HtmlPreviewRef = {
  sendStyleCommand: (slotName: string, styles: Record<string, string>) => void;
  sendTextCommand: (slotName: string, value: string) => void;
  sendImageCommand: (slotName: string, imageUrl: string) => void;
};
