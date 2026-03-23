/**
 * MarkdownEditor 组件
 *
 * 已重构为模块化结构，原 1000+ 行代码拆分到 components/markdown-editor/ 目录：
 *
 * 目录结构：
 * - MarkdownEditor.tsx (主组件，~400 行)
 * - CollapsibleSection.tsx (可折叠章节)
 * - MarkdownContent.tsx (Markdown 渲染)
 * - FrontmatterBadges.tsx (YAML 标签)
 * - MarkdownToolbar.tsx (工具栏)
 * - HtmlPreview.tsx (HTML 预览)
 * - parsers.ts (解析函数)
 * - types.ts (类型定义)
 * - index.ts (统一导出)
 *
 * 迁移原因：
 * - 原文件超过 1000 行，违反 "文件应小于 500 行" 的规范
 * - 单一组件职责过多，难以维护
 * - 动态导入 react-markdown 减少首屏加载 ~200KB
 */

export { default } from '@/shared/editor/MarkdownEditor';
export { default as MarkdownEditor } from '@/shared/editor/MarkdownEditor';
export type { EditorTextSelection, MarkdownEditorProps } from '@/shared/editor/types';
