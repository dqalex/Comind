'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Monitor, Smartphone, ZoomIn, ZoomOut, Edit3, PanelRightOpen, PanelRightClose } from 'lucide-react';
import clsx from 'clsx';
import PropertyPanel from '@/components/studio/PropertyPanel';
import type { HtmlPreviewProps, DeviceMode } from './types';
import { DEVICE_PRESETS } from './types';

function HtmlPreview({
  renderHtml,
  renderCss,
  value,
  deviceMode,
  htmlScale,
  autoScale,
  htmlEditMode,
  showPropertyPanel,
  elementSelection,
  htmlContainerRef,
  htmlIframeRef,
  srcDoc,
  onToggleEditMode,
  onDeviceModeChange,
  onScaleChange,
  onAutoScaleChange,
  onShowPropertyPanelChange,
  onPropertyStyleChange,
  onPropertyTextChange,
  onPropertyImageReplace,
}: HtmlPreviewProps) {
  const { t } = useTranslation();
  const device = DEVICE_PRESETS[deviceMode];

  // 生成预览用的 srcDoc（简化版，实际内容通过父组件传入）
  // 这里只渲染工具栏和设备控制

  return (
    <div className="flex flex-col h-full w-full min-w-0">
      {/* 设备模式工具栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
        <div className="flex items-center gap-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded p-0.5">
          <button
            onClick={() => onDeviceModeChange('responsive')}
            className={clsx(
              'p-1 rounded transition-colors',
              deviceMode === 'responsive'
                ? 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            )}
            title="Responsive"
            type="button"
            aria-label="Responsive"
          >
            <Globe size={14} />
          </button>
          <button
            onClick={() => onDeviceModeChange('pc')}
            className={clsx(
              'p-1 rounded transition-colors',
              deviceMode === 'pc'
                ? 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            )}
            title="PC (1920×1080)"
            type="button"
            aria-label="PC (1920×1080)"
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => onDeviceModeChange('mobile')}
            className={clsx(
              'p-1 rounded transition-colors',
              deviceMode === 'mobile'
                ? 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            )}
            title="Mobile (375×812)"
            type="button"
            aria-label="Mobile (375×812)"
          >
            <Smartphone size={14} />
          </button>
        </div>

        {/* 可视化编辑切换 - TD-022: 功能有问题，暂时隐藏 */}
        {/* <button
          onClick={onToggleEditMode}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
            htmlEditMode
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
          )}
          title={t('studio.visualEdit')}
          type="button"
        >
          <Edit3 size={12} />
          {t('studio.visualEdit')}
        </button> */}

        <div className="flex-1" />

        {/* 缩放控制（仅设备模式下显示） */}
        {device && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onAutoScaleChange(false); onScaleChange(Math.max(htmlScale - 0.1, 0.2)); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              type="button"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => { onAutoScaleChange(true); }}
              className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={t('studio.fitToWindow')}
              type="button"
            >
              {Math.round(htmlScale * 100)}%
            </button>
            <button
              onClick={() => { onAutoScaleChange(false); onScaleChange(Math.min(htmlScale + 0.1, 2)); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              type="button"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        )}

        {/* 属性面板切换（仅编辑模式下可用） */}
        {htmlEditMode && (
          <button
            onClick={() => onShowPropertyPanelChange(!showPropertyPanel)}
            className={clsx(
              'p-1 rounded transition-colors',
              showPropertyPanel
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            )}
            title={t('studio.propertyPanel')}
            type="button"
            aria-label={t('studio.propertyPanel')}
          >
            {showPropertyPanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        )}
      </div>

      {/* iframe 预览区 + 属性面板 */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={htmlContainerRef}
          className={clsx(
            'flex-1 min-w-0 overflow-auto',
            device ? 'flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900' : ''
          )}
        >
          {device ? (
            <div
              style={{
                width: device.width * htmlScale,
                height: device.height * htmlScale,
                flexShrink: 0,
              }}
            >
              <iframe
                key={`device-${htmlEditMode ? 'edit' : 'view'}`}
                ref={htmlIframeRef}
                className="border-0 bg-white rounded shadow-lg"
                style={{
                  border: 'none',
                  width: device.width,
                  height: device.height,
                  transform: `scale(${htmlScale})`,
                  transformOrigin: 'top left',
                }}
                srcDoc={srcDoc}
                sandbox={htmlEditMode ? 'allow-scripts allow-same-origin' : 'allow-same-origin'}
                title="template-visual-preview"
              />
            </div>
          ) : (
            <iframe
              key={`responsive-${htmlEditMode ? 'edit' : 'view'}`}
              ref={htmlIframeRef}
              className="block w-full h-full"
              style={{ border: 'none' }}
              srcDoc={srcDoc}
              sandbox={htmlEditMode ? 'allow-scripts allow-same-origin' : 'allow-same-origin'}
              title="template-visual-preview"
            />
          )}
        </div>

        {/* 属性面板（编辑模式 + 面板开启时显示） */}
        {htmlEditMode && showPropertyPanel && (
          <div className="w-64 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-800">
            <PropertyPanel
              selection={elementSelection}
              onStyleChange={onPropertyStyleChange}
              onTextChange={onPropertyTextChange}
              onImageReplace={onPropertyImageReplace}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(HtmlPreview);
