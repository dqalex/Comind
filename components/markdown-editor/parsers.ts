/**
 * Markdown 解析工具函数
 */

import type { Section } from './types';

/**
 * 解析可折叠章节
 * 根据标题层级构建树形结构
 */
export function parseCollapsibleSections(content: string): Section[] {
  const lines = content.split('\n');
  const root: Section[] = [];
  const stack: { level: number; section: Section }[] = [];
  let currentContent = '';
  let currentContentStartLine = 0;
  let inCodeBlock = false;

  function flushContent(target: Section[]) {
    if (currentContent.trim()) {
      target.push({ type: 'content', rawContent: currentContent, children: [], startLine: currentContentStartLine });
    }
    currentContent = '';
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // 检测代码块的开始和结束（支持 ``` 和 ```` 等）
    if (/^(`{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (!currentContent) currentContentStartLine = lineIdx;
      currentContent += line + '\n';
      continue;
    }

    // 在代码块内，不解析标题
    if (inCodeBlock) {
      currentContent += line + '\n';
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const currentParent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
      flushContent(currentParent);

      const newSection: Section = { type: 'heading', level, title, rawContent: line, children: [], startLine: lineIdx };
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
      parent.push(newSection);
      stack.push({ level, section: newSection });
    } else {
      if (!currentContent) currentContentStartLine = lineIdx;
      currentContent += line + '\n';
    }
  }

  const finalParent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
  flushContent(finalParent);
  return root;
}

/**
 * 解析 YAML frontmatter 为键值对
 * 支持 --- 包围的 frontmatter 和行首无 --- 的纯 key: value 格式
 */
export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string; bodyStartLine: number } | null {
  // 匹配 frontmatter，使用非贪婪匹配捕获内容
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) return null;

  const meta: Record<string, string> = {};
  const lines = fmMatch[1].split('\n');
  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w\s]*?):\s*(.+)$/);
    if (kvMatch) {
      meta[kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  if (Object.keys(meta).length === 0) return null;
  
  // 提取 body（frontmatter 之后的内容）
  const body = content.slice(fmMatch[0].length);
  
  // body 开始行号 = frontmatter 所占行数
  // frontmatter: --- (1行) + 内容 + --- (1行)
  // 所以 body 从第 (2 + lines.length) 行开始（0-based）
  const bodyStartLine = 2 + lines.length;
  
  return { meta, body, bodyStartLine };
}

/**
 * HTML 转义函数
 * 仅转义 HTML 结构性字符（& < >），保留 Markdown 语法字符（` " ' = /）
 * 这样后续正则可以正确匹配代码块等 Markdown 语法
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 高亮文本片段
 * className 为空表示普通文本，否则为 CSS 类名
 */
export interface HighlightSegment {
  text: string;
  className: string;
}

/**
 * 解析单行 Markdown 文本为高亮片段数组（内部使用）
 */
function parseLineSegments(line: string): HighlightSegment[] {
  if (!line) return [];

  // 定义高亮规则，顺序决定优先级
  const rules: Array<{ pattern: RegExp; className: string }> = [
    { pattern: /`[^`]+`/g, className: 'md-inline-code' },
    { pattern: /^#{1,6}\s/g, className: 'md-heading-marker' },
    { pattern: /(\*\*|__).+?\1/g, className: 'md-bold' },
    { pattern: /(?<!\*)(\*)(?!\*).+?(?<!\*)\1(?!\*)/g, className: 'md-italic' },
    { pattern: /\[\[.*?\]\]/g, className: 'md-wiki-link' },
    { pattern: /!\[.*?\]\(.*?\)/g, className: 'md-image' },
    { pattern: /\[.*?\]\(.*?\)/g, className: 'md-link' },
    { pattern: /~~.*?~~/g, className: 'md-strikethrough' },
    { pattern: /^\s*[-*+]\s/g, className: 'md-list' },
    { pattern: /^\s*\d+\.\s/g, className: 'md-list' },
    { pattern: /^>\s/g, className: 'md-blockquote' },
    { pattern: /^(---|___|\*\s*\*\s*\*[\s*]*)\s*$/g, className: 'md-hr' },
  ];

  type MatchRange = { start: number; end: number; className: string };
  const matches: MatchRange[] = [];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = matches.some(
        (existing) => start < existing.end && end > existing.start
      );
      if (!overlaps) {
        matches.push({ start, end, className: rule.className });
      }
    }
  }

  // 标题行：标记后的文本也需要高亮
  const headingMarker = matches.find((m) => m.className === 'md-heading-marker');
  if (headingMarker) {
    const restStart = headingMarker.end;
    if (restStart < line.length) {
      const overlaps = matches.some(
        (m) => m !== headingMarker && restStart < m.end && line.length > m.start
      );
      if (!overlaps) {
        matches.push({ start: restStart, end: line.length, className: 'md-heading' });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let pos = 0;

  for (const match of matches) {
    if (match.start > pos) {
      segments.push({ text: line.slice(pos, match.start), className: '' });
    }
    segments.push({ text: line.slice(match.start, match.end), className: match.className });
    pos = match.end;
  }

  if (pos < line.length) {
    segments.push({ text: line.slice(pos), className: '' });
  }

  if (segments.length === 0) {
    return [{ text: line, className: '' }];
  }

  return segments;
}

/**
 * 解析全文为连续的高亮片段数组
 * 
 * 关键设计：
 * - 返回的片段包含 \n 换行符，作为独立的无样式片段
 * - 整体构成一个连续文本流，与 textarea 中的文本完全 1:1 对应
 * - 不使用 div-per-line，避免块级元素与 textarea 内联文本的 soft wrap 差异
 * - 返回的 text 是原始字符（< > & 等），由 React textContent 自动处理
 */
export function parseFullTextHighlights(text: string): HighlightSegment[] {
  if (!text) return [];

  const lines = text.split('\n');
  const allSegments: HighlightSegment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineSegments = parseLineSegments(lines[i]);
    allSegments.push(...lineSegments);

    // 除了最后一行，每行后面加换行符
    if (i < lines.length - 1) {
      allSegments.push({ text: '\n', className: '' });
    }
  }

  // 合并相邻的无样式片段，减少 DOM 节点数量
  const merged: HighlightSegment[] = [];
  for (const seg of allSegments) {
    const last = merged[merged.length - 1];
    if (last && !last.className && !seg.className) {
      // 合并到上一个无样式片段
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

// 保留原有的单行解析函数供外部使用
export const parseLineHighlights = parseLineSegments;
