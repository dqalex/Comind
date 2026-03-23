/**
 * TeamClaw 领域层统一导出（客户端安全）
 * 
 * 注意：此文件只导出客户端可以安全使用的模块
 * MCP 处理器等服务器专用模块请直接从具体路径导入
 */

// Approval 领域
export { useApprovalStore } from './approval/store';

// Auth 领域
export { useAuthStore } from './auth/store';

// Gateway Store（从 core 层导出）
export { useGatewayStore, useOpenClawStatusStore } from '@/core/gateway/store';
export { useOpenClawWorkspaceStore } from '@/core/gateway/openclaw-workspace.store';

// Chat 领域
export { useChatStore } from './chat/store';

// Comment 领域
export { useCommentStore } from './comment/store';

// Context 领域 (暂无 Store)

// Delivery 领域
export { useDeliveryStore } from './delivery/store';

// Document 领域
export { useDocumentStore } from './document/store';

// Member 领域
export { useMemberStore } from './member/store';

// Milestone 领域
export { useMilestoneStore } from './milestone/store';

// Project 领域
export { useProjectStore } from './project/store';

// RenderTemplate 领域
export { useRenderTemplateStore } from './render-template/store';

// Schedule 领域
export { useScheduledTaskStore } from './schedule/store';

// Skill 领域
export { useSkillStore } from './skill/store';

// SOP 领域
export { useSOPTemplateStore } from './sop/store';

// Task 领域
export { useTaskStore } from './task/store';
export { useTaskLogStore } from './task/taskLog.store';

// UI 领域
export { useUIStore } from './ui/store';

// 注意：hooks 请直接从 @/shared/hooks 导入，避免循环依赖

// 类型统一从 db/schema 导出
export type {
  // Approval
  ApprovalRequest,
  NewApprovalRequest,
  // Auth
  User,
  NewUser,
  // Chat
  ChatSession,
  NewChatSession,
  ChatMessage,
  NewChatMessage,
  // Comment
  Comment,
  NewComment,

  // Delivery
  Delivery,
  NewDelivery,
  // Document
  Document,
  NewDocument,
  // Member
  Member,
  NewMember,
  // Milestone
  Milestone,
  NewMilestone,
  // Project
  Project,
  NewProject,
  // Schedule
  ScheduledTask,
  NewScheduledTask,
  // Skill
  Skill,
  NewSkill,
  // SOP
  SOPTemplate,
  NewSOPTemplate,
  // Task
  Task,
  NewTask,
  TaskLog,
  NewTaskLog,
} from '@/db/schema';
