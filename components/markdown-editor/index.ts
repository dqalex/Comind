/**
 * MarkdownEditor 组件模块
 * 
 * 注意：此目录的组件通过 @/components/MarkdownEditor 统一导出
 */

// 主组件
export { default } from './MarkdownEditor';
export { default as MarkdownEditor } from './MarkdownEditor';

// 子组件（内部使用，也可外部导入）
export { default as MarkdownToolbar } from './MarkdownToolbar';
export { default as HtmlPreview } from './HtmlPreview';
export { default as MarkdownContent } from './MarkdownContent';
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as CollapsibleMarkdown } from './CollapsibleMarkdown';
export { default as FrontmatterBadges } from './FrontmatterBadges';

// 工具函数
export {
  parseCollapsibleSections,
  parseFrontmatter,
  escapeHtml,
} from './parsers';

// 类型
export type {
  EditorTextSelection,
  MarkdownEditorProps,
  ViewMode,
  Section,
  DeviceMode,
  DevicePreset,
  HtmlPreviewProps,
} from './types';
