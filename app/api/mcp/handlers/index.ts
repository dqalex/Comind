/**
 * MCP Handlers 统一导出
 * 
 * 直接从各领域 mcp.ts 导入（服务器端专用）
 */

// Task
export {
  handleGetTask,
  handleUpdateTaskStatus,
  handleAddTaskComment,
  handleCreateCheckItem,
  handleCompleteCheckItem,
  handleListMyTasks,
  handleCreateTask,
} from '@/domains/task/mcp';

// Project
export {
  handleGetProject,
  handleGetProjectMembers,
} from '@/domains/project/mcp';

// Document
export {
  handleGetDocument,
  handleCreateDocument,
  handleUpdateDocument,
  handleSearchDocuments,
} from '@/domains/document/mcp';

// Approval (Status)
export {
  handleUpdateStatus,
  handleSetQueue,
  handleSetDoNotDisturb,
} from '@/domains/approval/mcp';

// Schedule
export {
  handleCreateSchedule,
  handleListSchedules,
  handleDeleteSchedule,
  handleUpdateSchedule,
} from '@/domains/schedule/mcp';

// Delivery
export {
  handleDeliverDocument,
  handleReviewDelivery,
  handleListMyDeliveries,
  handleGetDelivery,
} from '@/domains/delivery/mcp';

// Milestone
export {
  handleCreateMilestone,
  handleListMilestones,
  handleUpdateMilestone,
  handleDeleteMilestone,
} from '@/domains/milestone/mcp';

// Member
export {
  handleRegisterMember,
  handleGetMcpToken,
} from '@/domains/member/mcp';

// Render Template
export {
  handleGetTemplate,
  handleListTemplates,
} from '@/domains/render-template/mcp';

// SOP 引擎相关（v3.0 新增）
export {
  handleAdvanceSopStage,
  handleRequestSopConfirm,
  handleGetSopContext,
  handleSaveStageOutput,
  handleUpdateKnowledge,
  handleCreateSopTemplate,
  handleUpdateSopTemplate,
  handleCreateRenderTemplate,
  handleUpdateRenderTemplate,
  handleListRenderTemplates,
  handleGetRenderTemplate,
} from '@/domains/sop/mcp';

// Agent MCP Token（v3.0 Phase F 新增）
export {
  handleGetAgentMcpToken,
  handleListAgentMcpTokens,
  handleRevokeAgentMcpToken,
} from '@/domains/auth/mcp';

// 上下文获取工具（v3.0 Phase F 渐进式）
export {
  handleGetTaskDetail,
  handleGetProjectDetail,
  handleGetDocumentDetail,
  handleGetSopPreviousOutput,
  handleGetSopKnowledgeLayer,
} from '@/domains/context/mcp';

// Skill 工具（v3.0 SkillHub 集成）
export {
  handleInvokeSkill,
  handleListSkills,
} from '@/domains/skill/mcp';
