/**
 * PropertyPanel — 选中元素的样式/内容编辑面板
 *
 * 功能：
 * - 显示选中 slot 元素的当前样式（字号、颜色、字重、背景等）
 * - 提供实时样式修改控件
 * - 文字内容编辑（text/richtext）
 * - 图片替换（URL 输入）
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Type, Palette, Bold, AlignLeft, AlignCenter, AlignRight, Image, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
// 元素选区类型（原从 ./HtmlPreview 导入）
interface ElementSelection {
  slotName: string;
  slotType: string;
  styles: Record<string, string>;
  content: string;
}

export interface PropertyPanelProps {
  selection: ElementSelection | null;
  onStyleChange?: (slotName: string, styles: Record<string, string>) => void;
  onTextChange?: (slotName: string, value: string) => void;
  onImageReplace?: (slotName: string, imageUrl: string) => void;
  className?: string;
}

// 常用字号预设
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px'];

// 常用字重预设
const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extrabold', value: '800' },
];

export default function PropertyPanel({
  selection,
  onStyleChange,
  onTextChange,
  onImageReplace,
  className,
}: PropertyPanelProps) {
  const { t } = useTranslation();

  // 本地样式状态（编辑中的临时值）
  const [fontSize, setFontSize] = useState('');
  const [fontWeight, setFontWeight] = useState('');
  const [color, setColor] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [textAlign, setTextAlign] = useState('');
  const [letterSpacing, setLetterSpacing] = useState('');
  const [lineHeight, setLineHeight] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // 文字编辑防抖（500ms）
  const textTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 选中元素变更时同步样式值
  useEffect(() => {
    if (!selection) return;

    setFontSize(selection.styles.fontSize || '');
    setFontWeight(selection.styles.fontWeight || '');
    setColor(rgbToHex(selection.styles.color) || '#000000');
    setBackgroundColor(rgbToHex(selection.styles.backgroundColor) || '#ffffff');
    setTextAlign(selection.styles.textAlign || 'left');
    setLetterSpacing(selection.styles.letterSpacing || '');
    setLineHeight(selection.styles.lineHeight || '');

    if (selection.slotType === 'image') {
      setImageUrl(selection.content || '');
    }
  }, [selection]);

  const applyStyle = useCallback((styles: Record<string, string>) => {
    if (!selection) return;
    onStyleChange?.(selection.slotName, styles);
  }, [selection, onStyleChange]);

  const handleFontSizeChange = useCallback((value: string) => {
    setFontSize(value);
    applyStyle({ fontSize: value });
  }, [applyStyle]);

  const handleFontWeightChange = useCallback((value: string) => {
    setFontWeight(value);
    applyStyle({ fontWeight: value });
  }, [applyStyle]);

  const handleColorChange = useCallback((value: string) => {
    setColor(value);
    applyStyle({ color: value });
  }, [applyStyle]);

  const handleBgColorChange = useCallback((value: string) => {
    setBackgroundColor(value);
    applyStyle({ backgroundColor: value });
  }, [applyStyle]);

  const handleTextAlignChange = useCallback((value: string) => {
    setTextAlign(value);
    applyStyle({ textAlign: value });
  }, [applyStyle]);

  const handleLetterSpacingChange = useCallback((value: string) => {
    setLetterSpacing(value);
    // 使用 px 而非 em（GrowthPilot 踩坑：tracking-widest 导出偏移）
    applyStyle({ letterSpacing: value });
  }, [applyStyle]);

  const handleLineHeightChange = useCallback((value: string) => {
    setLineHeight(value);
    applyStyle({ lineHeight: value });
  }, [applyStyle]);

  const handleImageReplace = useCallback(() => {
    if (!selection || !imageUrl) return;
    onImageReplace?.(selection.slotName, imageUrl);
  }, [selection, imageUrl, onImageReplace]);

  if (!selection) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm px-4 text-center">
          {t('studio.selectElement')}
        </div>
      </div>
    );
  }

  const isImage = selection.slotType === 'image';
  const isText = selection.slotType === 'content' || selection.slotType === 'text' || selection.slotType === 'richtext';

  return (
    <div className={clsx('flex flex-col h-full overflow-y-auto', className)}>
      {/* 选中元素信息 */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="text-xs font-medium text-[var(--text-primary)]">
          {selection.slotName}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)]">
          {selection.slotType}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 文字样式（仅 text/richtext） */}
        {isText && (
          <>
            {/* 字号 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
                <Type size={12} />
                {t('studio.fontSize')}
              </label>
              <select
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                className="w-full h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 字重 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
                <Bold size={12} />
                {t('studio.fontWeight')}
              </label>
              <select
                value={fontWeight}
                onChange={(e) => handleFontWeightChange(e.target.value)}
                className="w-full h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label} ({w.value})</option>
                ))}
              </select>
            </div>

            {/* 颜色 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
                <Palette size={12} />
                {t('studio.textColor')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-[var(--border)] cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="flex-1 h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
                />
              </div>
            </div>

            {/* 背景色 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
                <Palette size={12} />
                {t('studio.backgroundColor')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-[var(--border)] cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="flex-1 h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
                />
              </div>
            </div>

            {/* 对齐 */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                {t('studio.textAlign')}
              </label>
              <div className="flex gap-1">
                {[
                  { value: 'left', icon: AlignLeft },
                  { value: 'center', icon: AlignCenter },
                  { value: 'right', icon: AlignRight },
                ].map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleTextAlignChange(value)}
                    className={clsx(
                      'p-1.5 rounded transition-colors',
                      textAlign === value
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* 字间距 */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                {t('studio.letterSpacing')}
              </label>
              <input
                type="text"
                value={letterSpacing}
                onChange={(e) => handleLetterSpacingChange(e.target.value)}
                placeholder="0px"
                className="w-full h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
              />
            </div>

            {/* 行高 */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                {t('studio.lineHeight')}
              </label>
              <input
                type="text"
                value={lineHeight}
                onChange={(e) => handleLineHeightChange(e.target.value)}
                placeholder="1.5"
                className="w-full h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
              />
            </div>
          </>
        )}

        {/* 图片替换（仅 image） */}
        {isImage && (
          <div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
              <Image size={12} />
              {t('studio.imageUrl')}
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              />
              <button
                onClick={handleImageReplace}
                className="px-2 h-7 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                {t('studio.replace')}
              </button>
            </div>
            {/* 当前图片预览 */}
            {selection.content && (
              <div className="mt-2 rounded border border-[var(--border)] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selection.content}
                  alt="Current"
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        )}

        {/* 当前内容预览 */}
        {isText && selection.content && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
              {t('studio.currentContent')}
            </label>
            <div className="p-2 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] max-h-24 overflow-y-auto break-all">
              {selection.content.substring(0, 200)}
              {selection.content.length > 200 && '...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 工具函数 =====

/**
 * RGB/RGBA 颜色字符串转 HEX
 */
function rgbToHex(rgb: string | undefined): string {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb;
  if (rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';

  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}
