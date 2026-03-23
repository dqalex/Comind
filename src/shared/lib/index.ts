/**
 * Lib 公开 API 统一出口
 * 
 * 原则：
 * 1. Components 只能通过此文件访问 lib 能力
 * 2. 内部模块不从此文件导入（避免循环依赖）
 * 3. 每个导出都应该是稳定的公开 API
 */

// ============================================================
// 渲染模板相关（slot-sync + icon-render）
// ============================================================
export {
  // 核心同步函数
  extractSlotsFromMd,
  syncMdToHtml,
  syncHtmlToMd,
  generateIframeScript,
  updateMdSlots,
  cleanEditorAttributes,
  injectSlotsToHtml,
  generateMdFromTemplate,
  htmlToSimpleMd,
  // 类型
  type SlotDef,
  type SlotValue,
  type SlotType,
  type SlotSyncResult,
} from './slot-sync';

// 避免重复导出 SlotDef 等类型（已从 slot-sync 导出）
export { renderIconsInHtml } from './icon-render';

// ============================================================
// SOP 配置
// ============================================================
export {
  SOP_STAGE_CONFIG,
  getStageConfig,
  type SOPStageStatus,
  type StageStatusConfig,
} from './sop-config';

// ============================================================
// SSE 事件管理
// ============================================================
export {
  sseHandlerRegistry,
  type SSEEventType,
  type SSEEvent,
  type SSEEventHandler,
} from './sse-events';

// ============================================================
// 日志工具
// ============================================================
export { logger, dataLogger } from './logger';

// ============================================================
// 工具策略配置
// ============================================================
export {
  TOOL_SECTIONS,
  PROFILE_OPTIONS,
  normalizeToolName,
  isAllowedByPolicy,
  resolveToolProfilePolicy,
  type ToolSection,
  type ToolInfo,
} from './tool-policy';

// ============================================================
// 审批服务
// ============================================================
export {
  // 查询
  getApprovalRequests,
  getApprovalRequestById,
  canViewApprovalRequest,
  canProcessApprovalRequest,
  hasPendingApprovalRequest,
  getResourceApprovalStatus,
  // 创建
  createApprovalRequest,
  // 处理
  processApprovalRequest,
  approveApprovalRequest,
  rejectApprovalRequest,
  cancelApprovalRequest,
  // 类型
  type ApprovalType,
  type ApprovalStatus,
  type ApprovalAction,
  type CreateApprovalRequestInput,
  type ProcessApprovalInput,
  type ApprovalFilters,
  type ApprovalQueryOptions,
  type ApprovalResult,
} from '@/lib/services/approval-service';

// ============================================================
// 同步服务
// ============================================================
export {
  // Markdown 操作
  extractSlotsFromMarkdown,
  updateMarkdownSlot,
  updateMarkdownSlots,
  generateMarkdownFromTemplate,
  // HTML 操作
  extractSlotsFromHTML,
  injectSlotsToHTML,
  generatePreviewHTML,
  generateIframeInjectionScript,
  cleanEditorAttrs,
  // 双向同步
  syncMarkdownToHTML,
  syncHTMLToMarkdown,
  fullSync,
  syncEditBackToMarkdown,
  // 槽位验证
  validateSlots,
  getSlotsSummary,
  // 安全处理
  sanitizeHTML,
  // 文档状态管理
  createSyncState,
  updateSyncStateFromMarkdown,
  updateSyncStateFromHTML,
  // 类型（SlotDef, SlotValue, SlotSyncResult, SlotType 已从 slot-sync 导出）
  type SyncResult,
  type DocumentSyncState,
  type BatchSyncInput,
  type BatchSyncOutput,
  // 常量
  MD_RICHTEXT_STYLES,
} from '@/lib/services/sync-service';
