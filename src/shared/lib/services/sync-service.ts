/**
 * 同步服务 - Sync Service
 * 
 * 封装槽位同步相关的业务逻辑，提供更高级的同步操作接口。
 * 基于 lib/slot-sync.ts 的核心功能，添加业务层封装。
 */

import {
  type SlotDef,
  type SlotValue,
  type SlotSyncResult,
  extractSlotsFromMd,
  extractSlotsFromHtml,
  updateMdSlot,
  updateMdSlots,
  injectSlotsToHtml,
  syncMdToHtml,
  syncHtmlToMd,
  generateMdFromTemplate,
  generatePreviewHtml,
  generateIframeScript,
  sanitizeHtml,
  cleanEditorAttributes,
  MD_RICHTEXT_STYLES,
  type SlotType,
} from '@/lib/slot-sync';

// 重新导出核心类型，方便服务使用者
export type { SlotDef, SlotValue, SlotSyncResult, SlotType };
export { MD_RICHTEXT_STYLES };

// ============================================================
// 类型定义
// ============================================================

export interface SyncResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface DocumentSyncState {
  mdContent: string;
  htmlContent: string;
  slots: Map<string, SlotValue>;
  lastSyncAt?: Date;
  syncErrors: string[];
}

export interface BatchSyncInput {
  mdContent: string;
  htmlTemplate: string;
  slotDefs: Record<string, SlotDef>;
  cssTemplate?: string;
}

export interface BatchSyncOutput {
  html: string;
  md: string;
  slots: Map<string, SlotValue>;
  errors: string[];
}

// ============================================================
// Markdown 操作
// ============================================================

/**
 * 从 Markdown 提取槽位值
 * 
 * @param mdContent - Markdown 内容
 * @param slotDefs - 槽位定义
 * @returns 槽位值 Map
 */
export function extractSlotsFromMarkdown(
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  return extractSlotsFromMd(mdContent, slotDefs);
}

/**
 * 更新 Markdown 中的单个槽位
 * 
 * @param mdContent - 原始 Markdown 内容
 * @param slotName - 槽位名称
 * @param newContent - 新内容
 * @returns 更新后的 Markdown
 */
export function updateMarkdownSlot(
  mdContent: string,
  slotName: string,
  newContent: string
): string {
  return updateMdSlot(mdContent, slotName, newContent);
}

/**
 * 批量更新 Markdown 中的多个槽位
 * 
 * @param mdContent - 原始 Markdown 内容
 * @param updates - 更新映射 { slotName: newContent }
 * @returns 更新后的 Markdown
 */
export function updateMarkdownSlots(
  mdContent: string,
  updates: Record<string, string>
): string {
  return updateMdSlots(mdContent, updates);
}

/**
 * 生成 Markdown 模板内容
 * 
 * @param mdTemplate - 可选的 Markdown 模板
 * @param slotDefs - 槽位定义
 * @returns 生成的 Markdown 内容
 */
export function generateMarkdownFromTemplate(
  mdTemplate: string,
  slotDefs: Record<string, SlotDef>
): string {
  return generateMdFromTemplate(mdTemplate, slotDefs);
}

// ============================================================
// HTML 操作
// ============================================================

/**
 * 从 HTML 提取槽位值
 * 
 * @param htmlContent - HTML 内容
 * @param slotDefs - 槽位定义
 * @returns 槽位值 Map
 */
export function extractSlotsFromHTML(
  htmlContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  return extractSlotsFromHtml(htmlContent, slotDefs);
}

/**
 * 将槽位值注入到 HTML 模板
 * 
 * @param htmlTemplate - HTML 模板
 * @param slots - 槽位值
 * @param cssTemplate - 可选的 CSS 样式
 * @returns 注入后的 HTML
 */
export function injectSlotsToHTML(
  htmlTemplate: string,
  slots: Map<string, SlotValue>,
  cssTemplate?: string
): string {
  return injectSlotsToHtml(htmlTemplate, slots, cssTemplate);
}

/**
 * 生成完整的预览 HTML（用于 iframe）
 * 
 * @param injectedHtml - 已注入槽位的 HTML
 * @param cssTemplate - 可选的 CSS 样式
 * @returns 完整的 HTML 文档
 */
export function generatePreviewHTML(
  injectedHtml: string,
  cssTemplate?: string
): string {
  return generatePreviewHtml(injectedHtml, cssTemplate);
}

/**
 * 生成 iframe 注入脚本
 * 
 * @returns 脚本代码字符串
 */
export function generateIframeInjectionScript(): string {
  return generateIframeScript();
}

/**
 * 清理编辑器属性
 * 
 * 导出/保存前必须调用，移除编辑相关的临时属性
 * 
 * @param html - 原始 HTML
 * @returns 清理后的 HTML
 */
export function cleanEditorAttrs(html: string): string {
  return cleanEditorAttributes(html);
}

// ============================================================
// 双向同步
// ============================================================

/**
 * Markdown 到 HTML 的同步
 * 
 * @param mdContent - Markdown 内容
 * @param htmlTemplate - HTML 模板
 * @param slotDefs - 槽位定义
 * @param cssTemplate - 可选的 CSS 样式
 * @returns 同步结果
 */
export function syncMarkdownToHTML(
  mdContent: string,
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string
): SlotSyncResult {
  return syncMdToHtml(mdContent, htmlTemplate, slotDefs, cssTemplate);
}

/**
 * HTML 到 Markdown 的同步
 * 
 * @param htmlContent - HTML 内容
 * @param mdContent - Markdown 内容
 * @param slotDefs - 槽位定义
 * @returns 同步结果
 */
export function syncHTMLToMarkdown(
  htmlContent: string,
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): { md: string; slots: Map<string, SlotValue>; errors: string[] } {
  return syncHtmlToMd(htmlContent, mdContent, slotDefs);
}

// ============================================================
// 高级同步操作
// ============================================================

/**
 * 完整的双向同步流程
 * 
 * 1. 从 Markdown 提取槽位
 * 2. 注入到 HTML 模板
 * 3. 生成预览 HTML
 * 
 * @param input - 同步输入
 * @returns 同步输出
 */
export function fullSync(input: BatchSyncInput): SyncResult<BatchSyncOutput> {
  try {
    const { mdContent, htmlTemplate, slotDefs, cssTemplate } = input;

    // 1. 从 MD 提取槽位
    const slots = extractSlotsFromMd(mdContent, slotDefs);

    // 2. 检查缺失的槽位
    const errors: string[] = [];
    for (const [name, def] of Object.entries(slotDefs)) {
      if (!slots.has(name)) {
        errors.push(`Missing slot: ${name} (${def.label})`);
      }
    }

    // 3. 注入到 HTML
    const html = injectSlotsToHtml(htmlTemplate, slots, cssTemplate);

    // 4. 返回结果
    return {
      success: true,
      data: {
        html,
        md: mdContent,
        slots,
        errors,
      },
      warnings: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[SyncService] fullSync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * 从 HTML 编辑回写到 Markdown
 * 
 * @param htmlContent - 编辑后的 HTML
 * @param mdContent - 原始 Markdown
 * @param slotDefs - 槽位定义
 * @returns 更新后的 Markdown
 */
export function syncEditBackToMarkdown(
  htmlContent: string,
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): SyncResult<{ md: string; slots: Map<string, SlotValue> }> {
  try {
    const result = syncHtmlToMd(htmlContent, mdContent, slotDefs);

    return {
      success: true,
      data: {
        md: result.md,
        slots: result.slots,
      },
      warnings: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (error) {
    console.error('[SyncService] syncEditBackToMarkdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// ============================================================
// 槽位验证
// ============================================================

/**
 * 验证槽位是否完整
 * 
 * @param slots - 当前槽位值
 * @param slotDefs - 槽位定义
 * @returns 验证结果
 */
export function validateSlots(
  slots: Map<string, SlotValue>,
  slotDefs: Record<string, SlotDef>
): { valid: boolean; missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const [name, def] of Object.entries(slotDefs)) {
    const slot = slots.get(name);

    if (!slot) {
      missing.push(name);
      continue;
    }

    const content = Array.isArray(slot.content) ? slot.content[0] : slot.content;
    if (!content || content.trim() === '') {
      empty.push(name);
    }
  }

  return {
    valid: missing.length === 0 && empty.length === 0,
    missing,
    empty,
  };
}

/**
 * 获取槽位摘要（用于调试和日志）
 * 
 * @param slots - 槽位值
 * @returns 摘要信息
 */
export function getSlotsSummary(slots: Map<string, SlotValue>): {
  count: number;
  names: string[];
  types: Record<string, number>;
} {
  const names: string[] = [];
  const types: Record<string, number> = {};

  for (const [name, slot] of slots) {
    names.push(name);
    types[slot.type] = (types[slot.type] || 0) + 1;
  }

  return {
    count: slots.size,
    names,
    types,
  };
}

// ============================================================
// 安全处理
// ============================================================

/**
 * 清洗 HTML 内容（XSS 防护）
 * 
 * @param html - 原始 HTML
 * @returns 清洗后的 HTML
 */
export function sanitizeHTML(html: string): string {
  return sanitizeHtml(html);
}

// ============================================================
// 文档状态管理
// ============================================================

/**
 * 创建新的文档同步状态
 */
export function createSyncState(
  mdContent: string,
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string
): DocumentSyncState {
  const result = syncMdToHtml(mdContent, htmlTemplate, slotDefs, cssTemplate);

  return {
    mdContent,
    htmlContent: result.html,
    slots: result.slots,
    lastSyncAt: new Date(),
    syncErrors: result.errors,
  };
}

/**
 * 更新文档同步状态（MD 变更时）
 */
export function updateSyncStateFromMarkdown(
  state: DocumentSyncState,
  newMdContent: string,
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string
): DocumentSyncState {
  const result = syncMdToHtml(newMdContent, htmlTemplate, slotDefs, cssTemplate);

  return {
    mdContent: newMdContent,
    htmlContent: result.html,
    slots: result.slots,
    lastSyncAt: new Date(),
    syncErrors: result.errors,
  };
}

/**
 * 更新文档同步状态（HTML 编辑回写时）
 */
export function updateSyncStateFromHTML(
  state: DocumentSyncState,
  newHtmlContent: string,
  slotDefs: Record<string, SlotDef>
): DocumentSyncState {
  const result = syncHtmlToMd(newHtmlContent, state.mdContent, slotDefs);

  return {
    mdContent: result.md,
    htmlContent: newHtmlContent,
    slots: result.slots,
    lastSyncAt: new Date(),
    syncErrors: result.errors,
  };
}
