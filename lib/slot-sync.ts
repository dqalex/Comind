/**
 * 槽位同步核心库（移植自 GrowthPilot useSync.js）
 *
 * 负责 MD ↔ HTML 的双向槽位同步：
 * - MD 中使用 <!-- @slot:name -->...<!-- @/slot --> 标记槽位
 * - HTML 中使用 data-slot="name" data-slot-type="text|richtext|image" 标记槽位
 *
 * 设计要点（来自 GrowthPilot 踩坑经验）：
 * - 使用 matchAll 而非全局正则（避免 lastIndex 不重置问题）
 * - syncLock 互斥锁防止 MD→HTML→MD 无限循环
 * - richtext 内容经 DOMPurify 清洗（XSS 防护）
 * - 模板引用分离：同步只替换 slot 内容，不修改模板结构
 */

import DOMPurify from 'dompurify';
import { renderIconsInHtml } from './icon-render';

// ===== 类型定义 =====

// content: MD 渲染（统一处理所有 MD 支持的内容类型：标题、文字、列表、表格等）
// image: 图片 URL（MD 不支持的富媒体）
// data: 数据指标（纯数值/短文本，直接 textContent 注入）
export type SlotType = 'content' | 'image' | 'data' | 'text' | 'richtext';

export interface SlotDef {
  label: string;
  type: SlotType;
  description?: string;
  placeholder?: string;
}

export interface SlotValue {
  name: string;
  type: SlotType;
  content: string | string[];  // 支持数组：同名 slot 多次使用时存为数组
}

export interface SlotSyncResult {
  html: string;
  slots: Map<string, SlotValue>;
  errors: string[];
}

// ===== 常量 =====

// MD 槽位标记：<!-- @slot:name -->content<!-- @/slot -->
// 使用非全局正则 + matchAll（GrowthPilot 踩坑：全局正则 lastIndex 不重置）
const MD_SLOT_PATTERN = /<!-- @slot:(\w+) -->([\s\S]*?)<!-- @\/slot -->/g;

// 备用模式：无结束标记时，从 @slot:name 到下一个 @slot 或文档末尾
const MD_SLOT_PATTERN_OPEN = /<!-- @slot:(\w+) -->\n?([\s\S]*?)(?=<!-- @slot:\w+ -->|$)/g;

// DOMPurify 白名单标签（richtext 允许的 HTML 标签）
const ALLOWED_TAGS = [
  'strong', 'em', 'b', 'i', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'del',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'div', 'img', 'mark', 'input',  // div: 语义图表容器, img: 图片, mark: 高亮, input: 任务列表 checkbox
];
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'class', 'data-diagram', 'data-value', 'src', 'alt', 'style', 'type', 'checked', 'disabled'];

// ===== MD → Slot 提取 =====

/**
 * 从 MD 内容中提取所有槽位值
 * 支持两种格式：
 * 1. 完整格式：<!-- @slot:name -->content<!-- @/slot -->
 * 2. 简化格式：<!-- @slot:name -->content（到下一个 slot 或文档末尾）
 */
export function extractSlotsFromMd(
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  const slots = new Map<string, SlotValue>();

  // 先尝试完整格式（有结束标记）
  const closedMatches = [...mdContent.matchAll(MD_SLOT_PATTERN)];

  if (closedMatches.length > 0) {
    // 有结束标记的完整格式
    for (const match of closedMatches) {
      const name = match[1];
      const content = match[2].trim();
      const def = slotDefs[name];
      const type = def?.type || 'content';
      
      if (slots.has(name)) {
        // 同名 slot，转为数组
        const existing = slots.get(name)!;
        if (Array.isArray(existing.content)) {
          existing.content.push(content);
        } else {
          existing.content = [existing.content as string, content];
        }
      } else {
        slots.set(name, { name, type, content });
      }
    }
  } else {
    // 降级：无结束标记的简化格式
    const openMatches = mdContent.matchAll(MD_SLOT_PATTERN_OPEN);
    for (const match of openMatches) {
      const name = match[1];
      const content = match[2].trim();
      const def = slotDefs[name];
      const type = def?.type || 'content';
      
      if (slots.has(name)) {
        // 同名 slot，转为数组
        const existing = slots.get(name)!;
        if (Array.isArray(existing.content)) {
          existing.content.push(content);
        } else {
          existing.content = [existing.content as string, content];
        }
      } else {
        slots.set(name, { name, type, content });
      }
    }
  }

  return slots;
}

/**
 * 更新 MD 中指定槽位的内容
 * 支持有结束标记和无结束标记两种格式
 */
export function updateMdSlot(
  mdContent: string,
  slotName: string,
  newContent: string
): string {
  // 先尝试完整格式（有结束标记）
  const closedPattern = new RegExp(
    `(<!-- @slot:${escapeRegex(slotName)} -->)[\\s\\S]*?(<!-- @\\/slot -->)`,
    'g'
  );
  if (closedPattern.test(mdContent)) {
    // 重置 lastIndex（全局正则 test 后 lastIndex 不为 0）
    closedPattern.lastIndex = 0;
    return mdContent.replace(closedPattern, `$1\n${newContent}\n$2`);
  }

  // 降级：无结束标记格式（替换到下一个 slot 开始或文档末尾）
  const openPattern = new RegExp(
    `(<!-- @slot:${escapeRegex(slotName)} -->)\\n?[\\s\\S]*?(?=<!-- @slot:\\w+ -->|$)`,
    'g'
  );
  return mdContent.replace(openPattern, `$1\n${newContent}\n`);
}

/**
 * 批量更新 MD 中的多个槽位
 */
export function updateMdSlots(
  mdContent: string,
  updates: Record<string, string>
): string {
  let result = mdContent;
  for (const [name, content] of Object.entries(updates)) {
    result = updateMdSlot(result, name, content);
  }
  return result;
}

// ===== HTML → Slot 提取 =====

/**
 * 从 HTML 文档中提取所有槽位值
 */
export function extractSlotsFromHtml(
  htmlContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  const slots = new Map<string, SlotValue>();

  // 使用 DOMParser 解析 HTML（比正则更可靠）
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const elements = doc.querySelectorAll('[data-slot]');

  elements.forEach((el) => {
    const name = el.getAttribute('data-slot') || '';
    const typeAttr = el.getAttribute('data-slot-type') as SlotType | null;
    const def = slotDefs[name];
    const type = typeAttr || def?.type || 'content';

    let content = '';
    switch (type) {
      case 'content':
      case 'richtext':
      case 'text':
        // 统一从 innerHTML 反解 MD（因为注入时统一用 innerHTML）
        content = htmlToSimpleMd(el.innerHTML);
        break;
      case 'image': {
        const img = el.querySelector('img');
        content = img?.getAttribute('src') || el.getAttribute('data-src') || '';
        break;
      }
      case 'data':
        content = el.getAttribute('data-value') || el.textContent || '';
        break;
    }

    slots.set(name, { name, type, content: content.trim() });
  });

  return slots;
}

/**
 * MD 渲染的 slot 容器内 HTML 标签的默认样式表
 * 使用 [data-slot-type="content"] 限定作用域
 * 同时保留 [data-slot-type="richtext"] 向后兼容
 */
export const MD_RICHTEXT_STYLES = `
[data-slot-type="content"] h1, [data-slot-type="content"] h2,
[data-slot-type="content"] h3, [data-slot-type="content"] h4,
[data-slot-type="content"] h5, [data-slot-type="content"] h6,
[data-slot-type="richtext"] h1, [data-slot-type="richtext"] h2,
[data-slot-type="richtext"] h3, [data-slot-type="richtext"] h4,
[data-slot-type="richtext"] h5, [data-slot-type="richtext"] h6 {
  margin: 0.6em 0 0.3em; font-weight: 600; line-height: 1.4;
}
[data-slot-type="content"] h1, [data-slot-type="richtext"] h1 { font-size: 1.4em; }
[data-slot-type="content"] h2, [data-slot-type="richtext"] h2 { font-size: 1.2em; }
[data-slot-type="content"] h3, [data-slot-type="richtext"] h3 { font-size: 1.1em; }
[data-slot-type="content"] ul, [data-slot-type="content"] ol,
[data-slot-type="richtext"] ul, [data-slot-type="richtext"] ol {
  margin: 0.4em 0; padding-left: 1.6em;
}
[data-slot-type="content"] li, [data-slot-type="richtext"] li {
  margin: 0.15em 0; line-height: 1.7;
}
[data-slot-type="content"] ul, [data-slot-type="richtext"] ul { list-style-type: disc; }
[data-slot-type="content"] ol, [data-slot-type="richtext"] ol { list-style-type: decimal; }
[data-slot-type="content"] blockquote, [data-slot-type="richtext"] blockquote {
  margin: 0.5em 0; padding: 0.4em 1em;
  border-left: 3px solid currentColor; opacity: 0.85;
}
[data-slot-type="content"] hr, [data-slot-type="richtext"] hr {
  border: none; border-top: 1px solid currentColor; opacity: 0.2; margin: 0.8em 0;
}
[data-slot-type="content"] code, [data-slot-type="richtext"] code {
  padding: 0.15em 0.4em; border-radius: 3px;
  background: rgba(0,0,0,0.06); font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', monospace;
}
[data-slot-type="content"] pre, [data-slot-type="richtext"] pre {
  margin: 0.5em 0; padding: 0.8em 1em; border-radius: 6px;
  background: rgba(0,0,0,0.06); overflow-x: auto;
}
[data-slot-type="content"] pre code, [data-slot-type="richtext"] pre code {
  padding: 0; background: none; font-size: 0.85em;
}
[data-slot-type="content"] table, [data-slot-type="richtext"] table {
  width: 100%; border-collapse: collapse; margin: 0.5em 0; font-size: 0.9em;
}
[data-slot-type="content"] th, [data-slot-type="content"] td,
[data-slot-type="richtext"] th, [data-slot-type="richtext"] td {
  padding: 0.4em 0.6em; border: 1px solid rgba(0,0,0,0.1); text-align: left;
}
[data-slot-type="content"] th, [data-slot-type="richtext"] th {
  font-weight: 600; background: rgba(0,0,0,0.03);
}
[data-slot-type="content"] p, [data-slot-type="richtext"] p {
  margin: 0.3em 0; line-height: 1.7;
}
[data-slot-type="content"] a, [data-slot-type="richtext"] a {
  color: inherit; text-decoration: underline; text-underline-offset: 2px;
}
[data-slot-type="content"] del, [data-slot-type="richtext"] del {
  text-decoration: line-through; opacity: 0.6;
}
[data-slot-type="content"] strong, [data-slot-type="richtext"] strong { font-weight: 700; }
[data-slot-type="content"] em, [data-slot-type="richtext"] em { font-style: italic; }
[data-slot-type="content"] mark, [data-slot-type="richtext"] mark {
  background: rgba(255, 213, 79, 0.4); padding: 0.1em 0.2em; border-radius: 2px;
}
[data-slot-type="content"] img, [data-slot-type="richtext"] img {
  max-width: 100%; height: auto; border-radius: 4px; margin: 0.4em 0;
}
[data-slot-type="content"] input[type="checkbox"], [data-slot-type="richtext"] input[type="checkbox"] {
  margin-right: 6px; vertical-align: middle; accent-color: #3b82f6;
}
/* === 语义图表样式（flow / compare / steps）=== */
.sd-flow {
  display: flex; flex-direction: column; align-items: center;
  gap: 0; padding: 1.2em 0; margin: 0.8em 0;
}
.sd-flow-node {
  background: rgba(37,99,235,0.08); border: 1.5px solid rgba(37,99,235,0.25);
  border-radius: 8px; padding: 10px 24px; font-size: 0.9em; text-align: center;
  line-height: 1.5; color: inherit; min-width: 100px;
  box-sizing: border-box;
}
.sd-flow-box {
  background: rgba(37,99,235,0.05); border: 2px solid rgba(37,99,235,0.2);
  border-radius: 10px; padding: 14px 20px; font-size: 0.88em;
  text-align: left; max-width: 90%; line-height: 1.7; color: inherit;
}
.sd-flow-arrow {
  font-size: 1.1em; color: rgba(37,99,235,0.4); line-height: 1; padding: 4px 0;
  flex-shrink: 0;
}
.sd-flow-group {
  display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;
  padding: 8px 0;
}
.sd-flow-row {
  display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center;
  align-items: stretch; gap: 0;
}
.sd-flow-row .sd-flow-arrow {
  padding: 0 8px; font-size: 1.4em;
  display: flex; align-items: center;
}
.sd-flow-row .sd-flow-node {
  flex: 1 1 0; min-width: 0;
  display: flex; align-items: center; justify-content: center;
  text-align: center; word-break: keep-all;
}
.sd-flow-label {
  font-size: 0.82em; font-weight: 700; color: rgba(37,99,235,0.8);
  padding: 4px 14px; letter-spacing: 0.5px;
  background: rgba(37,99,235,0.06); border-radius: 4px;
  text-transform: uppercase;
}
.sd-status-success { border-color: #22c55e; background: rgba(34,197,94,0.08); }
.sd-status-error { border-color: #ef4444; background: rgba(239,68,68,0.08); }
.sd-status-warn { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
.sd-compare {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px; margin: 0.8em 0;
}
.sd-compare-col {
  border: 1px solid rgba(0,0,0,0.1); border-radius: 10px;
  overflow: hidden; background: rgba(0,0,0,0.02);
}
.sd-compare-col.sd-compare-success { border-color: rgba(34,197,94,0.3); }
.sd-compare-col.sd-compare-error { border-color: rgba(239,68,68,0.3); }
.sd-compare-col.sd-compare-warn { border-color: rgba(245,158,11,0.3); }
.sd-compare-title {
  font-weight: 700; font-size: 0.95em; padding: 10px 16px;
  background: rgba(0,0,0,0.04); border-bottom: 1px solid rgba(0,0,0,0.08);
  text-align: center;
}
.sd-compare-title.sd-status-success { background: rgba(34,197,94,0.1); color: #15803d; }
.sd-compare-title.sd-status-error { background: rgba(239,68,68,0.1); color: #b91c1c; }
.sd-compare-title.sd-status-warn { background: rgba(245,158,11,0.1); color: #b45309; }
.sd-compare-item {
  padding: 6px 16px; font-size: 0.88em; line-height: 1.6;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.sd-compare-item:last-child { border-bottom: none; }
.sd-compare-item.sd-status-success { background: rgba(34,197,94,0.06); }
.sd-compare-item.sd-status-error { background: rgba(239,68,68,0.06); }
.sd-steps {
  display: flex; align-items: flex-start; gap: 0;
  flex-wrap: wrap; justify-content: center; margin: 0.8em 0; padding: 0.5em 0;
}
.sd-step {
  display: flex; flex-direction: column; align-items: center;
  min-width: 80px; max-width: 160px; text-align: center;
}
.sd-step-num {
  width: 32px; height: 32px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; font-weight: 700;
  font-size: 0.85em; background: rgba(37,99,235,0.12); color: #2563eb;
  margin-bottom: 6px; flex-shrink: 0;
}
.sd-step-label { font-size: 0.85em; font-weight: 600; line-height: 1.4; }
.sd-step-desc { font-size: 0.78em; color: rgba(0,0,0,0.5); margin-top: 2px; line-height: 1.3; }
.sd-step-arrow {
  display: flex; align-items: center; font-size: 1.2em;
  color: rgba(37,99,235,0.4); padding: 0 8px; margin-top: 8px;
}
`.trim();

/**
 * 将 slot 值注入到 HTML 模板中
 * 保留模板结构，只替换 slot 元素的内容
 * content/richtext/text slot 的 MD 内容会经 simpleMdToHtml 转 HTML + DOMPurify 清洗
 * 自动注入 MD 渲染样式表
 * 
 * 支持循环区域渲染（data-slot-loop）：
 * - HTML 中用 data-slot-loop 标记循环模板，data-slot-loop-items 声明循环项包含的 slot
 * - MD 中重复使用 slot，系统按 data-slot-loop-items 定义的顺序分组，自动复制 HTML 模板
 */
export function injectSlotsToHtml(
  htmlTemplate: string,
  slots: Map<string, SlotValue>,
  cssTemplate?: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlTemplate, 'text/html');

  let hasMdContent = false;

  // ===== 第一步：处理循环区域（data-slot-loop）=====
  const loopContainers = doc.querySelectorAll('[data-slot-loop]');
  loopContainers.forEach((container) => {
    const loopItemsAttr = container.getAttribute('data-slot-loop-items') || '';
    
    if (!loopItemsAttr) return; // 没有声明循环项，跳过

    // 解析循环项包含的 slot 名称
    const loopItemSlots = loopItemsAttr.split(',').map(s => s.trim()).filter(Boolean);
    if (loopItemSlots.length === 0) return;

    // 获取第一个 slot 的数组长度（决定循环次数）
    const firstSlot = slots.get(loopItemSlots[0]);
    if (!firstSlot) return;

    const loopCount = Array.isArray(firstSlot.content) ? firstSlot.content.length : 1;
    if (loopCount <= 1) return; // 只有一项，不需要循环

    // 找到循环模板（第一个子元素）
    const templateEl = container.firstElementChild;
    if (!templateEl) return;

    // 复制模板 (loopCount - 1) 次
    for (let i = 1; i < loopCount; i++) {
      const clone = templateEl.cloneNode(true) as Element;
      container.appendChild(clone);
    }
  });

  // ===== 第二步：填充 slot 内容（包含循环后复制的元素）=====
  const elements = doc.querySelectorAll('[data-slot]');
  
  // 按 name 分组所有同名元素
  const slotElementsByName = new Map<string, Element[]>();
  elements.forEach((el) => {
    const name = el.getAttribute('data-slot') || '';
    if (!slotElementsByName.has(name)) {
      slotElementsByName.set(name, []);
    }
    slotElementsByName.get(name)!.push(el);
  });

  // 填充每个 slot
  slotElementsByName.forEach((elements, name) => {
    const slot = slots.get(name);
    if (!slot) return;

    // 将 content 转为数组处理
    const slotContents = Array.isArray(slot.content) ? slot.content : [slot.content];

    elements.forEach((el, index) => {
      const content = slotContents[index] !== undefined ? slotContents[index] : null;
      if (content === null) return;

      const type = (el.getAttribute('data-slot-type') as SlotType) || slot.type;

      switch (type) {
        case 'content':
        case 'richtext':
        case 'text':
          // 统一走 MD→HTML 渲染
          hasMdContent = true;
          el.innerHTML = sanitizeHtml(simpleMdToHtml(content));
          break;
        case 'image': {
          const img = el.querySelector('img');
          if (img) {
            img.setAttribute('src', content);
          } else if (content) {
            el.innerHTML = `<img src="${escapeAttr(content)}" alt="" style="width:100%;height:auto;" />`;
          }
          break;
        }
        case 'data':
          el.setAttribute('data-value', content);
          el.textContent = content;
          break;
      }
    });
  });

  // 注入 MD 渲染样式表（当存在 content/richtext/text slot 时）
  if (hasMdContent) {
    let mdStyleEl = doc.querySelector('style[data-md-styles]');
    if (!mdStyleEl) {
      mdStyleEl = doc.createElement('style');
      mdStyleEl.setAttribute('data-md-styles', 'true');
      doc.head.appendChild(mdStyleEl);
    }
    mdStyleEl.textContent = MD_RICHTEXT_STYLES;
  }

  // 注入自定义 CSS
  if (cssTemplate) {
    let styleEl = doc.querySelector('style[data-studio-css]');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-studio-css', 'true');
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = cssTemplate;
  }

  // 手动拼接 DOCTYPE（DOMParser 不保留 doctype，GrowthPilot 踩坑）
  const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  
  // 渲染 Lucide 图标为 SVG（将 <i data-lucide="name"></i> 替换为 SVG）
  return renderIconsInHtml(html);
}

// ===== MD ↔ HTML 双向同步 =====

/**
 * 从 MD 内容同步到 HTML：提取 MD 槽位 → 注入到 HTML 模板
 */
export function syncMdToHtml(
  mdContent: string,
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string
): SlotSyncResult {
  const errors: string[] = [];
  const slots = extractSlotsFromMd(mdContent, slotDefs);

  // 检查是否所有 slot 都有值
  for (const [name, def] of Object.entries(slotDefs)) {
    if (!slots.has(name)) {
      errors.push(`MD 中缺少槽位 @slot:${name} (${def.label})`);
    }
  }

  const html = injectSlotsToHtml(htmlTemplate, slots, cssTemplate);
  return { html, slots, errors };
}

/**
 * 从 HTML 内容同步到 MD：提取 HTML 槽位 → 更新 MD 中对应标记
 */
export function syncHtmlToMd(
  htmlContent: string,
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): { md: string; slots: Map<string, SlotValue>; errors: string[] } {
  const errors: string[] = [];
  const slots = extractSlotsFromHtml(htmlContent, slotDefs);

  const updates: Record<string, string> = {};
  for (const [name, slot] of slots) {
    // 如果是数组，取第一个值；否则直接使用
    updates[name] = Array.isArray(slot.content) ? slot.content[0] || '' : slot.content;
  }

  const md = updateMdSlots(mdContent, updates);
  return { md, slots, errors };
}

// ===== 简易 MD ↔ HTML 转换 =====

/**
 * 内联 MD 格式转 HTML（加粗、斜体、删除线、代码、链接）
 * 先转义 HTML 实体，再处理 MD 语法
 */
function inlineMdToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 内联代码（先处理，防止内部被其他规则干扰）
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 图片（必须在链接之前处理，否则 ![alt](url) 会被链接规则匹配）
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;" />')
    // 加粗（**text** 和 __text__）
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体（*text* 和 _text_，注意：_text_ 只匹配非空格包围的）
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
    // 删除线
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // 高亮（==text==）
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 自动链接（裸 URL）
    .replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
    // Lucide 图标（:lucide:name: → <i data-lucide="name"></i>）
    .replace(/:lucide:([a-z0-9-]+):/g, '<i data-lucide="$1"></i>');
}

/**
 * MD → HTML（用于 richtext slot，支持常用 Markdown 块级和内联语法）
 *
 * 支持的块级元素：标题(h1-h6)、无序列表、有序列表、任务列表(- [x])、引用、水平线、代码块、表格
 * 支持的内联元素：加粗、斜体、删除线、高亮、内联代码、链接、图片、自动链接
 *
 *
 * 设计选择：自实现而非引入 marked/remark，因为只在 slot 注入场景使用，
 * 内容规模小、需配合 DOMPurify 清洗，无需完整解析器的复杂度和体积。
 */
export function simpleMdToHtml(md: string): string {
  if (!md) return '';

  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- 空行：跳过 ---
    if (line.trim() === '') {
      i++;
      continue;
    }

    // --- 水平线：--- 或 *** 或 ___ ---
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      html.push('<hr />');
      i++;
      continue;
    }

    // --- 标题：# ~ ###### ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inlineMdToHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // --- 代码块：```...``` ---
    // 支持语义代码块：```flow（流程图）、```compare（对比框）、```steps（步骤图）
    // 其他语言标识符按普通代码块渲染
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```(\w*)/);
      const lang = langMatch?.[1] || '';
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 跳过结束 ```
      
      if (lang === 'flow') {
        // 流程图：解析 → 连接线 和节点
        html.push(parseFlowDiagram(codeLines));
      } else if (lang === 'compare') {
        // 对比框：解析左右两栏对比
        html.push(parseCompareDiagram(codeLines));
      } else if (lang === 'steps') {
        // 步骤图：解析带编号的步骤流
        html.push(parseStepsDiagram(codeLines));
      } else {
        // 普通代码块
        const escaped = codeLines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        html.push(`<pre><code>${escaped.join('\n')}</code></pre>`);
      }
      continue;
    }

    // --- 表格：| ... | ---
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: string[] = [];
      let isHeader = true;
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const row = lines[i].trim();
        // 跳过分隔行 |---|---|
        if (/^\|[\s\-:]+\|$/.test(row.replace(/\|/g, m => m).replace(/[^|\-:\s]/g, ''))) {
          i++;
          isHeader = false;
          continue;
        }
        const cells = row.slice(1, -1).split('|').map(c => inlineMdToHtml(c.trim()));
        const tag = isHeader ? 'th' : 'td';
        tableRows.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`);
        if (isHeader) isHeader = false; // 第一行后不再是 header（除非遇到分隔行才转）
        i++;
      }
      html.push(`<table>${tableRows.join('')}</table>`);
      continue;
    }

    // --- 引用块：> ... ---
    if (line.trim().startsWith('> ') || line.trim() === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${inlineMdToHtml(quoteLines.join('<br />'))}</blockquote>`);
      continue;
    }

    // --- 无序列表：- 或 * 开头（支持 - [x] / - [ ] 任务列表，支持缩进续行） ---
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      let hasCheckbox = false;
      while (i < lines.length) {
        // 新列表项
        if (/^\s*[-*]\s+/.test(lines[i])) {
          let itemText = lines[i].replace(/^\s*[-*]\s+/, '');
          i++;
          // 收集缩进续行（2+ 空格开头，非列表项）
          const contLines: string[] = [];
          while (i < lines.length && /^\s{2,}/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
            contLines.push(lines[i].trim());
            i++;
          }
          // 任务列表：- [x] / - [ ]
          const checkMatch = itemText.match(/^\[([ xX])\]\s+(.*)/);
          if (checkMatch) {
            hasCheckbox = true;
            const checked = checkMatch[1].toLowerCase() === 'x';
            const checkbox = `<input type="checkbox" ${checked ? 'checked' : ''} disabled style="margin-right:6px;vertical-align:middle;" />`;
            const content = contLines.length > 0
              ? `${checkbox}${inlineMdToHtml(checkMatch[2])}<p>${inlineMdToHtml(contLines.join(' '))}</p>`
              : `${checkbox}${inlineMdToHtml(checkMatch[2])}`;
            items.push(content);
          } else {
            // 检测 itemText 是否包含标题（## Title）— 用于 feature card 格式
            const headingMatch = itemText.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch && contLines.length > 0) {
              const level = headingMatch[1].length;
              const titleHtml = `<h${level}>${inlineMdToHtml(headingMatch[2])}</h${level}>`;
              const descHtml = `<p>${inlineMdToHtml(contLines.join(' '))}</p>`;
              items.push(`${titleHtml}\n${descHtml}`);
            } else if (contLines.length > 0) {
              items.push(`${inlineMdToHtml(itemText)}<p>${inlineMdToHtml(contLines.join(' '))}</p>`);
            } else {
              items.push(inlineMdToHtml(itemText));
            }
          }
        } else {
          break;
        }
      }
      const listStyle = hasCheckbox ? ' style="list-style:none;padding-left:0.4em;"' : '';
      html.push(`<ul${listStyle}>${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    // --- 有序列表：1. 开头 ---
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inlineMdToHtml(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      html.push(`<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    }

    // --- 普通段落：连续非空行合并为一个 <p> ---
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('|') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())) {
      paraLines.push(inlineMdToHtml(lines[i]));
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${paraLines.join('<br />')}</p>`);
    }
  }

  return html.join('\n');
}

/**
 * HTML → MD（从 richtext slot 提取 MD）
 * 反向转换 simpleMdToHtml 支持的标签，按块级→内联顺序处理
 */
export function htmlToSimpleMd(html: string): string {
  if (!html) return '';

  let md = html
    // 移除多余空白（但保留换行上下文）
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ');

  // --- 块级元素（先处理，避免被后续内联规则干扰）---

  // 语义图表反向转换（flow/compare/steps → ```flow / ```compare / ```steps）
  md = md.replace(/<div[^>]*data-diagram="flow"[^>]*>([\s\S]*?)<\/div>\s*(?=<|$)/gi, (_m, content) => {
    const nodes = content.replace(/<div[^>]*class="sd-flow-arrow"[^>]*>[\s\S]*?<\/div>/gi, '  ▼\n');
    const text = nodes.replace(/<div[^>]*class="sd-flow-[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (_m2: string, inner: string) => {
      return inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() + '\n';
    });
    return '\n```flow\n' + text.replace(/<[^>]+>/g, '').trim() + '\n```\n';
  });
  md = md.replace(/<div[^>]*data-diagram="compare"[^>]*>([\s\S]*?)<\/div>\s*(?=<|$)/gi, (_m, content) => {
    const text = content.replace(/<div[^>]*class="sd-compare-[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (_m2: string, inner: string) => {
      return inner.replace(/<[^>]+>/g, '').trim() + '\n';
    });
    return '\n```compare\n' + text.replace(/<[^>]+>/g, '').trim() + '\n```\n';
  });
  md = md.replace(/<div[^>]*data-diagram="steps"[^>]*>([\s\S]*?)<\/div>\s*(?=<|$)/gi, (_m, content) => {
    const text = content.replace(/<div[^>]*class="sd-step[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (_m2: string, inner: string) => {
      return inner.replace(/<[^>]+>/g, '').trim() + '\n';
    });
    return '\n```steps\n' + text.replace(/<[^>]+>/g, '').trim() + '\n```\n';
  });

  // 水平线
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // 标题 h1-h6
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => {
    return '\n' + '#'.repeat(parseInt(level)) + ' ' + content.trim() + '\n';
  });

  // 代码块
  md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, content) => {
    const decoded = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return '\n```\n' + decoded + '\n```\n';
  });

  // 表格
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableContent) => {
    const rows: string[][] = [];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
      const cells: string[] = [];
      const cellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      rows.push(cells);
    }
    if (rows.length === 0) return '';
    const lines: string[] = [];
    rows.forEach((row, idx) => {
      lines.push('| ' + row.join(' | ') + ' |');
      if (idx === 0) {
        lines.push('| ' + row.map(() => '---').join(' | ') + ' |');
      }
    });
    return '\n' + lines.join('\n') + '\n';
  });

  // 引用块
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content) => {
    const text = content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    return '\n' + text.split('\n').map((l: string) => '> ' + l).join('\n') + '\n';
  });

  // 有序列表
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, content) => {
    const items: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    let num = 1;
    while ((liMatch = liPattern.exec(content)) !== null) {
      items.push(`${num}. ` + liMatch[1].replace(/<[^>]+>/g, '').trim());
      num++;
    }
    return '\n' + items.join('\n') + '\n';
  });

  // 无序列表（支持任务列表 checkbox）
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, content) => {
    const items: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(content)) !== null) {
      let liContent = liMatch[1];
      // 检测 checkbox（任务列表）
      const checkedMatch = liContent.match(/<input[^>]*checked[^>]*>/i);
      const uncheckedMatch = !checkedMatch && liContent.match(/<input[^>]*type=["']checkbox["'][^>]*>/i);
      if (checkedMatch) {
        liContent = liContent.replace(/<input[^>]*>/gi, '').trim();
        items.push('- [x] ' + liContent.replace(/<[^>]+>/g, '').trim());
      } else if (uncheckedMatch) {
        liContent = liContent.replace(/<input[^>]*>/gi, '').trim();
        items.push('- [ ] ' + liContent.replace(/<[^>]+>/g, '').trim());
      } else {
        items.push('- ' + liContent.replace(/<[^>]+>/g, '').trim());
      }
    }
    return '\n' + items.join('\n') + '\n';
  });

  // --- 内联元素 ---

  // 换行
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // 图片（在移除标签之前处理）
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  // 高亮
  md = md.replace(/<mark>(.*?)<\/mark>/gi, '==$1==');
  // 加粗
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  // 斜体
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  // 删除线
  md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
  // 内联代码
  md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  // 链接
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // 段落
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  // 移除其他 HTML 标签
  md = md.replace(/<[^>]+>/g, '');
  // 解码 HTML 实体
  md = md.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 清理污染：解码后可能再次出现 <p> 标签（来自被转义的内容），需要再次移除
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  md = md.replace(/<[^>]+>/g, '');

  // 清理多余空行（最多保留 2 个连续换行）
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

// ===== 安全 =====

/**
 * HTML 内容清洗（DOMPurify）
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
  });
}

/**
 * 清理 iframe 注入的编辑属性（GrowthPilot 经验）
 * 导出/保存前必须调用
 */
export function cleanEditorAttributes(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 移除编辑相关属性（用 DOMParser 操作 classList，不用正则 — GrowthPilot 踩坑）
  doc.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });
  doc.querySelectorAll('[data-editable]').forEach((el) => {
    el.removeAttribute('data-editable');
  });
  doc.querySelectorAll('.element-selected, .element-hover').forEach((el) => {
    el.classList.remove('element-selected', 'element-hover');
  });

  // 清理空 class 属性（GrowthPilot 踩坑：清理后产生 class="" 空属性）
  doc.querySelectorAll('[class=""]').forEach((el) => {
    el.removeAttribute('class');
  });

  // 移除注入的脚本
  doc.querySelectorAll('script[data-studio-inject]').forEach((el) => {
    el.remove();
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// ===== 模板生成 =====

/**
 * 从渲染模板生成初始 MD 内容（含 slot 标记）
 */
export function generateMdFromTemplate(
  mdTemplate: string,
  slotDefs: Record<string, SlotDef>
): string {
  if (mdTemplate) return mdTemplate;

  // 无 MD 模板时，自动生成骨架
  const lines: string[] = [];
  for (const [name, def] of Object.entries(slotDefs)) {
    lines.push(`<!-- @slot:${name} -->`);
    lines.push(def.placeholder || `[${def.label}]`);
    lines.push(`<!-- @/slot -->`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 生成 iframe 注入脚本（用于 HtmlPreview 组件）
 * 处理：元素选中、内容编辑、样式修改、图片替换
 */
export function generateIframeScript(): string {
  return `
(function() {
  'use strict';

  let selectedElement = null;
  let editMode = false;
  const DEBOUNCE_MS = 100;
  let notifyTimer = null;

  // 初始化：为所有 slot 元素绑定事件
  function initElements() {
    const elements = document.querySelectorAll('[data-slot]');
    elements.forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', handleClick);
      el.addEventListener('dblclick', handleDblClick);
      el.addEventListener('mouseover', handleMouseOver);
      el.addEventListener('mouseout', handleMouseOut);

      // 图片容器子元素统一设 pointerEvents: none（GrowthPilot 踩坑）
      const slotType = el.getAttribute('data-slot-type');
      if (slotType === 'image') {
        Array.from(el.children).forEach(child => {
          child.style.pointerEvents = 'none';
        });
      }
    });
  }

  function handleClick(e) {
    e.stopPropagation();
    const el = e.currentTarget;

    // 如果当前元素正在编辑中，不处理点击（避免干扰编辑）
    if (el.getAttribute('contenteditable') === 'true') return;

    // 取消之前的选中
    deselectElement();

    // 选中当前元素
    selectedElement = el;
    el.classList.add('element-selected');

    window.parent.postMessage({
      type: 'elementSelected',
      slotName: el.getAttribute('data-slot'),
      slotType: el.getAttribute('data-slot-type') || 'content',
      styles: getComputedStyles(el),
      content: getSlotContent(el),
    }, '*');
  }

  function handleDblClick(e) {
    e.stopPropagation();
    if (!editMode) return;

    const el = e.currentTarget;
    const slotType = el.getAttribute('data-slot-type') || 'content';

    if (slotType === 'image') {
      // 图片：通知父窗口弹出替换对话框
      window.parent.postMessage({
        type: 'requestImageReplace',
        slotName: el.getAttribute('data-slot'),
      }, '*');
      return;
    }

    // 文字编辑：判断是否含块级子元素（GrowthPilot 踩坑：编辑块级容器会破坏 DOM 结构）
    const hasBlockChildren = el.querySelector('div,p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote');
    if (hasBlockChildren) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-editable', 'true');
    el.focus();

    // 实时同步编辑内容（input 事件，每次击键都通知父窗口）
    const onInput = () => {
      notifyChange();
    };
    el.addEventListener('input', onInput);

    // 监听编辑完成
    const onFinish = () => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-editable');
      el.removeEventListener('blur', onFinish);
      el.removeEventListener('focusout', onFinish); // Safari 兼容
      el.removeEventListener('input', onInput);
      notifyChange();
    };
    el.addEventListener('blur', onFinish);
    el.addEventListener('focusout', onFinish);
  }

  function handleMouseOver(e) {
    if (selectedElement === e.currentTarget) return;
    e.currentTarget.classList.add('element-hover');
  }

  function handleMouseOut(e) {
    e.currentTarget.classList.remove('element-hover');
  }

  function deselectElement() {
    if (selectedElement) {
      selectedElement.classList.remove('element-selected');
      selectedElement = null;
      window.parent.postMessage({ type: 'elementDeselected' }, '*');
    }
  }

  function getSlotContent(el) {
    const type = el.getAttribute('data-slot-type') || 'content';
    switch (type) {
      case 'content':
      case 'richtext':
      case 'text':
        return el.innerHTML;
      case 'image': {
        const img = el.querySelector('img');
        return img ? img.src : '';
      }
      default: return el.innerHTML;
    }
  }

  function getComputedStyles(el) {
    const cs = window.getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      textAlign: cs.textAlign,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
    };
  }

  // 通知父窗口内容变更（防抖 100ms — GrowthPilot 经验）
  function notifyChange() {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      // 收集所有 slot 当前值（支持循环区域的同名 slot）
      const slotValues = {};
      const slotCounters = {};
      document.querySelectorAll('[data-slot]').forEach(el => {
        const slotName = el.getAttribute('data-slot');
        // 检查是否在循环区域内
        const isInLoop = el.closest('[data-slot-loop]') !== null;
        if (isInLoop) {
          // 循环区域内的 slot，使用索引后缀
          slotCounters[slotName] = (slotCounters[slotName] || 0) + 1;
          const uniqueKey = slotName + '_' + slotCounters[slotName];
          slotValues[uniqueKey] = getSlotContent(el);
        } else {
          // 普通 slot，直接使用名称
          slotValues[slotName] = getSlotContent(el);
        }
      });
      window.parent.postMessage({ type: 'contentChanged', slotValues, hasLoopSlots: Object.keys(slotCounters).length > 0 }, '*');
    }, DEBOUNCE_MS);
  }

  // 接收父窗口指令
  window.addEventListener('message', (e) => {
    const { type, slotName, value, styles } = e.data || {};

    switch (type) {
      case 'setStyle': {
        const el = slotName ? document.querySelector('[data-slot="' + slotName + '"]') : selectedElement;
        if (!el || !styles) return;
        Object.entries(styles).forEach(([prop, val]) => {
          el.style[prop] = val;
        });
        notifyChange();
        break;
      }
      case 'setText': {
        const el = document.querySelector('[data-slot="' + slotName + '"]');
        if (!el) return;
        const slotType = el.getAttribute('data-slot-type') || 'content';
        if (slotType === 'data') {
          el.textContent = value;
        } else {
          el.innerHTML = value;
        }
        notifyChange();
        break;
      }
      case 'replaceImage': {
        const el = document.querySelector('[data-slot="' + slotName + '"]');
        if (!el) return;
        const img = el.querySelector('img');
        if (img) {
          img.src = value;
        } else {
          el.innerHTML = '<img src="' + value + '" alt="" style="width:100%;height:auto;" />';
        }
        notifyChange();
        break;
      }
      case 'toggleEditMode':
        editMode = !!value;
        document.body.classList.toggle('studio-edit-mode', editMode);
        break;
      case 'deselectAll':
        deselectElement();
        break;
    }
  });

  // 点击空白区域取消选中
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-slot]')) {
      deselectElement();
    }
  });

  // 注入选中/悬停样式
  const style = document.createElement('style');
  style.setAttribute('data-studio-inject', 'true');
  style.textContent = \`
    .element-selected {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px;
    }
    .element-hover {
      outline: 1px dashed #93c5fd !important;
      outline-offset: 1px;
    }
    .studio-edit-mode [data-slot] {
      cursor: text !important;
    }
    .studio-edit-mode [data-slot][data-slot-type="image"] {
      cursor: pointer !important;
    }
    [contenteditable="true"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px;
    }
  \`;
  document.head.appendChild(style);

  // 初始化
  function init() {
    initElements();
    // 脚本只在编辑模式下注入，所以初始化后直接进入编辑模式
    editMode = true;
    document.body.classList.add('studio-edit-mode');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
  `.trim();
}

// ===== 语义代码块解析器 =====
// 支持三种语义：flow（流程图）、compare（对比框）、steps（步骤图）
// 在 MD 中用 ```flow / ```compare / ```steps 标记，simpleMdToHtml 渲染为可视化 HTML

/**
 * 解析流程图代码块
 * 
 * 语法规则：
 * - 普通行 = 流程节点
 * - 以 → / -> / ▼ / │ / ▶ 开头的行 = 连接线（渲染为箭头）
 * - 以 ✅ / ❌ / ⚠️ 开头的行 = 带状态的节点
 * - 空行 = 分隔
 * - ┌ └ │ ─ 等盒子绘制字符的行 = 盒子内容（合并为一个节点）
 */
function parseFlowDiagram(lines: string[]): string {
  // 按空行分割成段落组
  const groups: string[][] = [];
  let current: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (current.length > 0) { groups.push(current); current = []; }
    } else {
      current.push(trimmed);
    }
  }
  if (current.length > 0) groups.push(current);
  
  // 如果只有一个组，按原逻辑解析
  if (groups.length <= 1) {
    return `<div class="sd-flow" data-diagram="flow">${parseFlowGroup(groups[0] || [])}</div>`;
  }
  
  // 多组：每组渲染为一个 flow-group，组间用 ▼ 分隔
  const rendered: string[] = [];
  for (let g = 0; g < groups.length; g++) {
    if (g > 0) rendered.push('<div class="sd-flow-arrow">▼</div>');
    rendered.push(`<div class="sd-flow-group">${parseFlowGroup(groups[g])}</div>`);
  }
  return `<div class="sd-flow" data-diagram="flow">${rendered.join('\n')}</div>`;
}

/** 解析单个流程组（可能含标题行+横向流程行） */
function parseFlowGroup(lines: string[]): string {
  const items: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i];

    // 盒子结构：以 ┌ 开始，收集到 └ 结束
    if (trimmed.startsWith('┌')) {
      const boxLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('└')) {
        const boxLine = lines[i].replace(/^│\s*/, '').replace(/\s*│$/, '');
        if (boxLine) boxLines.push(escapeHtmlText(boxLine));
        i++;
      }
      if (i < lines.length) i++; // 跳过 └
      items.push(`<div class="sd-flow-box">${boxLines.join('<br/>')}</div>`);
      continue;
    }

    // 连接线 / 箭头（独占一行的 → ▼ │ ▶ -> ↓）
    if (/^[→▼│▶\-|↓]$/.test(trimmed) || /^->$/.test(trimmed)) {
      items.push('<div class="sd-flow-arrow">▼</div>');
      i++;
      continue;
    }

    // 带状态的节点
    if (/^[✅❌⚠️]/.test(trimmed)) {
      const statusMatch = trimmed.match(/^(✅|❌|⚠️)\s*(.*)/);
      if (statusMatch) {
        const cls = statusMatch[1] === '✅' ? 'success' : statusMatch[1] === '❌' ? 'error' : 'warn';
        items.push(`<div class="sd-flow-node sd-status-${cls}">${escapeHtmlText(statusMatch[2])}</div>`);
      }
      i++;
      continue;
    }

    // 带 → 分隔的多节点行：拆分为 节点 → 节点 → 节点（横向）
    if (trimmed.includes('→') && trimmed.split('→').length > 1) {
      const rowItems: string[] = [];
      const parts = trimmed.split('→').map(p => p.trim()).filter(Boolean);
      parts.forEach((part, idx) => {
        rowItems.push(`<div class="sd-flow-node">${escapeHtmlText(part)}</div>`);
        if (idx < parts.length - 1) {
          rowItems.push('<div class="sd-flow-arrow">→</div>');
        }
      });
      items.push(`<div class="sd-flow-row">${rowItems.join('')}</div>`);
      i++;
      continue;
    }

    // 普通文本行：作为标签/标题
    items.push(`<div class="sd-flow-label">${escapeHtmlText(trimmed)}</div>`);
    i++;
  }

  return items.join('\n');
}

/**
 * 解析对比框代码块
 * 
 * 语法规则：
 * - 两个并列的盒子（┌...└）自动识别为左右对比
 * - 非盒子的行作为对比标题或分隔
 * - 也支持简单的「标签: 内容」格式
 */
function parseCompareDiagram(lines: string[]): string {
  const boxes: { title: string; items: string[] }[] = [];
  let currentTitle = '';
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // 空行跳过
    if (trimmed === '') { i++; continue; }

    // 盒子结构：┌ 标题 或 ┌──标题──┐
    if (trimmed.startsWith('┌')) {
      // 从 ┌ 行提取标题（去掉 ┌└┐─│ 等盒子字符）
      const boxTitle = trimmed.replace(/[┌┐─]/g, '').trim();
      const boxItems: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('└')) {
        const boxLine = lines[i].trim().replace(/^│\s*/, '').replace(/\s*│$/, '');
        if (boxLine) boxItems.push(boxLine);
        i++;
      }
      if (i < lines.length) i++; // 跳过 └
      
      // 标题优先级：┌ 行文本 > currentTitle > boxItems 第一行
      const title = boxTitle || currentTitle || (boxItems.length > 0 ? boxItems[0] : '');
      // 如果标题来自 boxItems 第一行，则内容从第二行开始
      const content = (!boxTitle && !currentTitle && boxItems.length > 0)
        ? boxItems.slice(1) : boxItems;
      boxes.push({ title: escapeHtmlText(title), items: content.map(escapeHtmlText) });
      continue;
    }

    // 标题行（非盒子、非空行）
    if (!headerMatch(trimmed)) {
      currentTitle = trimmed;
    }
    i++;
  }

  // 如果没有解析到盒子，尝试简单的行解析：每行一个条目
  if (boxes.length === 0) {
    const leftItems: string[] = [];
    const rightItems: string[] = [];
    let leftTitle = '';
    let rightTitle = '';
    let phase: 'left' | 'gap' | 'right' = 'left';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        if (phase === 'left' && leftItems.length > 0) phase = 'gap';
        continue;
      }
      // 检测大量空格分隔的左右两栏
      const twoColMatch = line.match(/^(.{15,}?)\s{4,}(.+)$/);
      if (twoColMatch) {
        leftItems.push(escapeHtmlText(twoColMatch[1].trim()));
        rightItems.push(escapeHtmlText(twoColMatch[2].trim()));
        continue;
      }
      if (phase === 'left' || phase === 'gap') {
        if (leftItems.length === 0 && !trimmed.startsWith('✅') && !trimmed.startsWith('❌')) {
          leftTitle = trimmed;
        } else {
          leftItems.push(escapeHtmlText(trimmed));
        }
        if (phase === 'gap') phase = 'right';
      } else {
        if (rightItems.length === 0 && !trimmed.startsWith('✅') && !trimmed.startsWith('❌')) {
          rightTitle = trimmed;
        } else {
          rightItems.push(escapeHtmlText(trimmed));
        }
      }
    }
    
    if (leftItems.length > 0 || rightItems.length > 0) {
      boxes.push({ title: leftTitle || '方案 A', items: leftItems });
      boxes.push({ title: rightTitle || '方案 B', items: rightItems });
    }
  }

  const boxesHtml = boxes.map(box => {
    const itemsHtml = box.items.map(item => {
      const cls = item.startsWith('✅') ? 'sd-status-success' : item.startsWith('❌') ? 'sd-status-error' : item.startsWith('⚠️') ? 'sd-status-warn' : '';
      return `<div class="sd-compare-item ${cls}">${item}</div>`;
    }).join('\n');
    const titleCls = box.title.startsWith('✅') ? 'sd-status-success' : box.title.startsWith('❌') ? 'sd-status-error' : box.title.startsWith('⚠️') ? 'sd-status-warn' : '';
    return `<div class="sd-compare-col${titleCls ? ' sd-compare-' + titleCls.replace('sd-status-', '') : ''}"><div class="sd-compare-title ${titleCls}">${box.title}</div>${itemsHtml}</div>`;
  }).join('\n');

  return `<div class="sd-compare" data-diagram="compare">${boxesHtml}</div>`;
}

// 辅助：判断是否是盒子框线字符行
function headerMatch(s: string): boolean {
  return /^[┌┐└┘│─┬┴├┤╔╗╚╝║═]/.test(s);
}

/**
 * 解析步骤图代码块
 * 
 * 语法规则：
 * - ① ② ③... 或 1. 2. 3. 开头的行 = 步骤节点
 * - │ / ▼ / → 行 = 连接箭头
 * - 普通行 = 步骤描述
 */
function parseStepsDiagram(lines: string[]): string {
  const steps: { num: string; label: string; desc: string }[] = [];
  let currentDesc: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    // 连接线跳过
    if (/^[│▼→↓\-|]+$/.test(trimmed)) continue;

    // 带圆圈数字的步骤：① ② ③...
    const circleMatch = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)/);
    if (circleMatch) {
      if (currentDesc.length > 0 && steps.length > 0) {
        steps[steps.length - 1].desc = currentDesc.join(' ');
        currentDesc = [];
      }
      const numMap: Record<string, string> = { '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10' };
      steps.push({ num: numMap[circleMatch[1]] || circleMatch[1], label: escapeHtmlText(circleMatch[2]), desc: '' });
      continue;
    }

    // 数字编号步骤：1. 2. 3.
    const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)/);
    if (numMatch) {
      if (currentDesc.length > 0 && steps.length > 0) {
        steps[steps.length - 1].desc = currentDesc.join(' ');
        currentDesc = [];
      }
      steps.push({ num: numMatch[1], label: escapeHtmlText(numMatch[2]), desc: '' });
      continue;
    }

    // 描述行
    if (steps.length > 0) {
      currentDesc.push(escapeHtmlText(trimmed));
    } else {
      // 第一个步骤前的文字作为第一步
      steps.push({ num: '1', label: escapeHtmlText(trimmed), desc: '' });
    }
  }

  // 收尾
  if (currentDesc.length > 0 && steps.length > 0) {
    steps[steps.length - 1].desc = currentDesc.join(' ');
  }

  const stepsHtml = steps.map((step, idx) => {
    const descHtml = step.desc ? `<div class="sd-step-desc">${step.desc}</div>` : '';
    const arrow = idx < steps.length - 1 ? '<div class="sd-step-arrow">→</div>' : '';
    return `<div class="sd-step"><div class="sd-step-num">${step.num}</div><div class="sd-step-label">${step.label}</div>${descHtml}</div>${arrow}`;
  }).join('\n');

  return `<div class="sd-steps" data-diagram="steps">${stepsHtml}</div>`;
}

// HTML 文本转义辅助函数
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== 工具函数 =====

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== 预览生成 =====

/**
 * 生成完整的预览 HTML（用于 iframe 预览）
 * 将注入后的 HTML 包装成完整的 HTML 文档
 */
export function generatePreviewHtml(injectedHtml: string, cssTemplate?: string): string {
  // 渲染 Lucide 图标为 SVG
  const htmlWithIcons = renderIconsInHtml(injectedHtml);
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* 基础样式重置 */
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    /* MD 渲染样式 */
    ${MD_RICHTEXT_STYLES}
    /* 自定义模板样式 */
    ${cssTemplate || ''}
  </style>
</head>
<body>
  ${htmlWithIcons}
</body>
</html>`;
}
