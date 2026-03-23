/**
 * MCP 工具注册表（单一数据源）
 * 
 * 统一管理所有工具到 handler 的映射关系
 * 由 /api/mcp/route.ts 和 /api/mcp/external/route.ts 共同引用
 */

import type { TeamClawToolName } from '@/core/mcp/definitions';
import { APP_VERSION } from '@/lib/version';
import {
  handleGetTask, handleUpdateTaskStatus, handleAddTaskComment, handleCreateCheckItem, handleCompleteCheckItem, handleListMyTasks,
  handleGetProject, handleGetProjectMembers,
  handleGetDocument, handleCreateDocument, handleUpdateDocument, handleSearchDocuments,
  handleUpdateStatus, handleSetQueue, handleSetDoNotDisturb,
  handleCreateSchedule, handleListSchedules, handleDeleteSchedule, handleUpdateSchedule,
  handleDeliverDocument, handleReviewDelivery, handleListMyDeliveries, handleGetDelivery,
  handleRegisterMember,
  handleGetTemplate, handleListTemplates,
  handleCreateMilestone, handleListMilestones, handleUpdateMilestone, handleDeleteMilestone,
  // SOP 引擎相关（v3.0 新增）
  handleAdvanceSopStage, handleRequestSopConfirm, handleGetSopContext, handleSaveStageOutput, handleUpdateKnowledge,
  handleCreateSopTemplate, handleUpdateSopTemplate, handleCreateRenderTemplate, handleUpdateRenderTemplate,
  handleListRenderTemplates, handleGetRenderTemplate,
  // Agent MCP Token（v3.0 Phase F 新增）
  handleGetAgentMcpToken, handleListAgentMcpTokens, handleRevokeAgentMcpToken,
  // 上下文获取工具（v3.0 Phase F 渐进式）
  handleGetTaskDetail, handleGetProjectDetail, handleGetDocumentDetail,
  handleGetSopPreviousOutput, handleGetSopKnowledgeLayer,
  // Skill 工具（v3.0 SkillHub 集成）
  handleInvokeSkill, handleListSkills,
} from './index';

// v1.0.1: 包装 deprecated 工具，添加运行时警告
const wrapWithDeprecationWarning = <T extends Record<string, unknown>>(
  handler: (params: T) => Promise<{ success: boolean; data?: unknown; error?: string }>,
  deprecatedName: string,
  alternative: string
) => {
  return async (params: T) => {
    console.warn(`[DEPRECATED v1.0.1] ${deprecatedName} is deprecated, use ${alternative}`);
    return handler(params);
  };
};

/**
 * 工具名 → handler 映射表
 * 新增工具只需在此处添加一条映射
 */
export const TOOL_HANDLERS: Record<TeamClawToolName, (params: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>> = {
  get_task: handleGetTask,
  list_my_tasks: handleListMyTasks,
  update_task_status: handleUpdateTaskStatus,
  add_task_comment: handleAddTaskComment,
  create_check_item: handleCreateCheckItem,
  complete_check_item: handleCompleteCheckItem,
  get_project: handleGetProject,
  get_project_members: handleGetProjectMembers,
  get_document: handleGetDocument,
  create_document: handleCreateDocument,
  update_document: handleUpdateDocument,
  search_documents: handleSearchDocuments,
  update_status: handleUpdateStatus,
  set_queue: handleSetQueue,
  set_do_not_disturb: handleSetDoNotDisturb,
  create_schedule: handleCreateSchedule,
  list_schedules: handleListSchedules,
  delete_schedule: handleDeleteSchedule,
  update_schedule: handleUpdateSchedule,
  deliver_document: handleDeliverDocument,
  review_delivery: handleReviewDelivery,
  list_my_deliveries: handleListMyDeliveries,
  get_delivery: handleGetDelivery,
  register_member: handleRegisterMember,
  // v1.0.1 新增：消息模板工具
  get_message_template: handleGetTemplate,
  list_message_templates: handleListTemplates,
  // v1.0.1 Deprecated：带警告的模板工具
  get_template: wrapWithDeprecationWarning(handleGetTemplate, 'get_template', 'get_message_template'),
  list_templates: wrapWithDeprecationWarning(handleListTemplates, 'list_templates', 'list_message_templates'),
  create_milestone: handleCreateMilestone,
  list_milestones: handleListMilestones,
  update_milestone: handleUpdateMilestone,
  delete_milestone: handleDeleteMilestone,
  // SOP 引擎工具（v3.0 新增）
  advance_sop_stage: handleAdvanceSopStage,
  request_sop_confirm: handleRequestSopConfirm,
  get_sop_context: handleGetSopContext,
  save_stage_output: handleSaveStageOutput,
  update_knowledge: handleUpdateKnowledge,
  // AI 自主创作工具（v3.0 新增）
  create_sop_template: handleCreateSopTemplate,
  update_sop_template: handleUpdateSopTemplate,
  create_render_template: handleCreateRenderTemplate,
  update_render_template: handleUpdateRenderTemplate,
  // 渲染模板查询（v3.0 新增）
  list_render_templates: handleListRenderTemplates,
  get_render_template: handleGetRenderTemplate,
  // Agent MCP Token（v3.0 Phase F 新增）
  get_agent_mcp_token: handleGetAgentMcpToken,
  list_agent_mcp_tokens: handleListAgentMcpTokens,
  revoke_agent_mcp_token: handleRevokeAgentMcpToken,
  // v1.0.1 Deprecated：带警告的上下文工具
  get_task_detail: wrapWithDeprecationWarning(handleGetTaskDetail, 'get_task_detail', 'get_task with detail=true'),
  get_project_detail: wrapWithDeprecationWarning(handleGetProjectDetail, 'get_project_detail', 'get_project with detail=true'),
  get_document_detail: wrapWithDeprecationWarning(handleGetDocumentDetail, 'get_document_detail', 'get_document with detail=true'),
  get_sop_previous_output: wrapWithDeprecationWarning(handleGetSopPreviousOutput, 'get_sop_previous_output', 'get_sop_context'),
  get_sop_knowledge_layer: wrapWithDeprecationWarning(handleGetSopKnowledgeLayer, 'get_sop_knowledge_layer', 'get_sop_context'),
  // Skill 工具（v3.0 SkillHub 集成）
  invoke_skill: handleInvokeSkill,
  list_skills: handleListSkills,
};

/** 需要自动注入 member_id 的工具列表 */
export const MEMBER_SCOPED_TOOLS: string[] = [
  'update_status', 'set_queue', 'set_do_not_disturb',
  'create_schedule', 'deliver_document', 'review_delivery',
  'list_my_tasks',
];

/** TeamClaw 版本号（从 lib/version.ts 统一导出） */
export const TEAMCLAW_VERSION = APP_VERSION;
