/**
 * MarkdownEditor 类型定义
 */

import type { SlotDef } from '@/lib';

// 元素选区类型（原从 @/components/studio/HtmlPreview 导入）
interface ElementSelection {
  slotName: string;
  slotType: string;
  styles: Record<string, string>;
  content: string;
}

// 选中文本信息
export interface EditorTextSelection {
  text: string;
  lineIndex: number;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  /** 渲染模板 HTML（传入时显示 HTML 渲染预览按钮） */
  renderHtml?: string;
  /** 渲染模板 CSS */
  renderCss?: string;
  /** 槽位定义（传入时 HTML 预览会自动将 MD 内容填充到模板 slot 中） */
  slotDefs?: Record<string, SlotDef>;
  /** 纯编辑模式：隐藏工具栏和预览，仅显示编辑器（用于 Content Studio 左栏） */
  editOnly?: boolean;
}

export type ViewMode = 'edit' | 'preview' | 'split' | 'html';

export interface Section {
  type: 'heading' | 'content';
  level?: number;
  title?: string;
  rawContent: string;
  children: Section[];
  startLine?: number; // 源码行号（用于批注定位）
}

export interface CollapsibleSectionProps {
  title: string;
  level: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export interface MarkdownContentProps {
  content: string;
}

export interface FrontmatterBadgesProps {
  meta: Record<string, string>;
}

export interface CollapsibleMarkdownProps {
  content: string;
}

// HTML 预览相关类型
export type DeviceMode = 'responsive' | 'pc' | 'mobile';

export interface DevicePreset {
  width: number;
  height: number;
}

export const DEVICE_PRESETS: Record<DeviceMode, DevicePreset | null> = {
  responsive: null, // 自适应
  pc: { width: 1920, height: 1080 },
  mobile: { width: 375, height: 812 },
};

export interface HtmlPreviewProps {
  renderHtml?: string;
  renderCss?: string;
  slotDefs?: Record<string, SlotDef>;
  value: string;
  deviceMode: DeviceMode;
  htmlScale: number;
  autoScale: boolean;
  htmlEditMode: boolean;
  showPropertyPanel: boolean;
  elementSelection: ElementSelection | null;
  htmlContainerRef: React.RefObject<HTMLDivElement>;
  htmlIframeRef: React.RefObject<HTMLIFrameElement>;
  srcDoc: string;  // 添加 srcDoc 属性
  onToggleEditMode: () => void;
  onDeviceModeChange: (mode: DeviceMode) => void;
  onScaleChange: (scale: number) => void;
  onAutoScaleChange: (auto: boolean) => void;
  onShowPropertyPanelChange: (show: boolean) => void;
  onPropertyStyleChange: (slotName: string, styles: Record<string, string>) => void;
  onPropertyTextChange: (slotName: string, value: string) => void;
  onPropertyImageReplace: (slotName: string, imageUrl: string) => void;
}

export interface MarkdownToolbarProps {
  viewMode: ViewMode;
  value: string;
  readOnly?: boolean;
  editOnly?: boolean;
  renderHtml?: string;
  onViewModeChange: (mode: ViewMode) => void;
}
