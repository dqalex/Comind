/**
 * 对话信道数据交互模块 - Action 定义
 * 
 * 定义所有支持的操作，包含元数据和验证规则
 */

import type { ActionDefinition, ActionType } from './types';

/**
 * 所有 Action 定义
 * 
 * 分类：
 * - query: 查询类操作，不修改数据
 * - write: 写入类操作，修改数据
 * - status: 状态类操作，更新 AI 状态
 * - schedule: 定时任务类操作
 * - extension: 扩展类操作
 */
export const ACTION_DEFINITIONS: Record<ActionType, ActionDefinition> = {
  // ============ 查询类操作 ============
  
  get_task: {
    type: 'get_task',
    name: '获取任务',
    description: '获取任务详情，包括标题、描述、状态、负责人等信息',
    category: 'query',
    requiredParams: ['task_id'],
    optionalParams: ['detail'],
    supportedInChat: false,
    requiresAuth: true,
  },
  
  list_my_tasks: {
    type: 'list_my_tasks',
    name: '获取任务列表',
    description: '获取分配给当前 AI 成员的任务列表，支持按状态筛选',
    category: 'query',
    requiredParams: [],
    optionalParams: ['status', 'project_id', 'limit', 'detail'],
    supportedInChat: false,
    requiresAuth: true,
  },
  
  get_project: {
    type: 'get_project',
    name: '获取项目',
    description: '获取项目详情，包括名称、描述、成员、任务列表等。任务推送场景下必须通过对话通道 Actions 调用此操作获取项目上下文',
    category: 'query',
    requiredParams: ['project_id'],
    optionalParams: ['detail'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  get_project_members: {
    type: 'get_project_members',
    name: '获取项目成员',
    description: '获取项目成员列表，包括人类和 AI 成员',
    category: 'query',
    requiredParams: ['project_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  get_document: {
    type: 'get_document',
    name: '获取文档',
    description: '获取 Wiki 文档内容',
    category: 'query',
    requiredParams: [],
    optionalParams: ['document_id', 'title'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  search_documents: {
    type: 'search_documents',
    name: '搜索文档',
    description: '搜索 Wiki 文档',
    category: 'query',
    requiredParams: ['query'],
    optionalParams: ['project_id'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  get_template: {
    type: 'get_template',
    name: '获取模板',
    description: '获取渲染后的模板内容，模板支持 Mustache 风格变量替换',
    category: 'query',
    requiredParams: ['template_name'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  list_templates: {
    type: 'list_templates',
    name: '列出模板',
    description: '列出所有可用的模板',
    category: 'query',
    requiredParams: [],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  list_schedules: {
    type: 'list_schedules',
    name: '列出定时任务',
    description: '获取定时任务列表',
    category: 'query',
    requiredParams: [],
    optionalParams: ['member_id', 'enabled_only'],
    supportedInChat: true,
    requiresAuth: true,
  },

  list_milestones: {
    type: 'list_milestones',
    name: '列出里程碑',
    description: '获取项目的里程碑列表',
    category: 'query',
    requiredParams: ['project_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },

  list_render_templates: {
    type: 'list_render_templates',
    name: '列出渲染模板',
    description: '获取渲染模板列表',
    category: 'query',
    requiredParams: [],
    optionalParams: ['category', 'status'],
    supportedInChat: true,
    requiresAuth: true,
  },

  get_render_template: {
    type: 'get_render_template',
    name: '获取渲染模板',
    description: '获取渲染模板详情',
    category: 'query',
    requiredParams: ['template_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },

  get_sop_previous_output: {
    type: 'get_sop_previous_output',
    name: '获取 SOP 前序产出',
    description: '获取 SOP 任务的前序阶段产出',
    category: 'query',
    requiredParams: ['task_id'],
    optionalParams: ['stage_id'],
    supportedInChat: true,
    requiresAuth: true,
  },

  get_sop_knowledge_layer: {
    type: 'get_sop_knowledge_layer',
    name: '获取 SOP 知识层',
    description: '获取 SOP 任务的知识库层（L1-L4）',
    category: 'query',
    requiredParams: ['task_id'],
    optionalParams: ['layer'],
    supportedInChat: true,
    requiresAuth: true,
  },

  list_skills: {
    type: 'list_skills',
    name: '列出 Skill',
    description: '获取可用的 Skill 列表',
    category: 'query',
    requiredParams: [],
    optionalParams: ['category', 'search', 'limit'],
    supportedInChat: true,
    requiresAuth: true,
  },

  list_my_deliveries: {
    type: 'list_my_deliveries',
    name: '列出我的交付',
    description: '获取当前 AI 成员的交付物列表',
    category: 'query',
    requiredParams: [],
    optionalParams: ['status', 'limit'],
    supportedInChat: true,
    requiresAuth: true,
  },

  get_delivery: {
    type: 'get_delivery',
    name: '获取交付详情',
    description: '获取交付物详情，包括审核意见、关联文档、关联任务等信息',
    category: 'query',
    requiredParams: ['delivery_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },

  // ============ 写入类操作 ============
  
  create_task: {
    type: 'create_task',
    name: '创建任务',
    description: '创建新任务。AI 可以通过此操作在协作中创建任务分配给人类或其他 AI',
    category: 'write',
    requiredParams: ['title'],
    optionalParams: ['description', 'project_id', 'assignees', 'priority', 'deadline', 'milestone'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  update_task_status: {
    type: 'update_task_status',
    name: '更新任务状态',
    description: '更新任务状态：todo(待办)、in_progress(进行中)、reviewing(审核中)、completed(已完成)',
    category: 'write',
    requiredParams: ['task_id', 'status'],
    optionalParams: ['progress', 'message'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  add_comment: {
    type: 'add_comment',
    name: '添加评论',
    description: '向任务添加评论，用于汇报进度、提出问题或提交结果',
    category: 'write',
    requiredParams: ['task_id', 'content'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  create_check_item: {
    type: 'create_check_item',
    name: '创建检查项',
    description: '为任务创建检查项（子任务）',
    category: 'write',
    requiredParams: ['task_id', 'text'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  complete_check_item: {
    type: 'complete_check_item',
    name: '完成检查项',
    description: '完成某个检查项',
    category: 'write',
    requiredParams: ['task_id', 'item_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  create_document: {
    type: 'create_document',
    name: '创建文档',
    description: '创建新的 Wiki 文档',
    category: 'write',
    requiredParams: ['title', 'content'],
    optionalParams: ['doc_type', 'project_id'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  update_document: {
    type: 'update_document',
    name: '更新文档',
    description: '更新 Wiki 文档内容',
    category: 'write',
    requiredParams: ['document_id', 'content'],
    optionalParams: ['doc_type'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  deliver_document: {
    type: 'deliver_document',
    name: '提交交付',
    description: '提交文档交付，支持关联内部 Wiki 文档或外部文档链接供用户审核',
    category: 'write',
    requiredParams: ['title', 'platform'],
    optionalParams: ['description', 'external_url', 'document_id', 'task_id'],
    supportedInChat: true,
    requiresAuth: true,
  },

  create_milestone: {
    type: 'create_milestone',
    name: '创建里程碑',
    description: '创建项目里程碑',
    category: 'write',
    requiredParams: ['title', 'project_id'],
    optionalParams: ['description', 'status', 'due_date', 'sort_order'],
    supportedInChat: true,
    requiresAuth: true,
  },

  update_milestone: {
    type: 'update_milestone',
    name: '更新里程碑',
    description: '更新里程碑信息',
    category: 'write',
    requiredParams: ['milestone_id'],
    optionalParams: ['title', 'description', 'status', 'due_date', 'sort_order'],
    supportedInChat: true,
    requiresAuth: true,
  },

  delete_milestone: {
    type: 'delete_milestone',
    name: '删除里程碑',
    description: '删除里程碑',
    category: 'write',
    requiredParams: ['milestone_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },

  invoke_skill: {
    type: 'invoke_skill',
    name: '调用 Skill',
    description: '调用 Skill 执行任务。Skill 是预定义的工作流程模板，可自动化完成复杂任务',
    category: 'write',
    requiredParams: ['skill_key'],
    optionalParams: ['task_id', 'parameters', 'context'],
    supportedInChat: true,
    requiresAuth: true,
  },

  review_delivery: {
    type: 'review_delivery',
    name: '审核交付',
    description: '审核文档交付，可批准、拒绝或要求修改',
    category: 'write',
    requiredParams: ['delivery_id', 'review_status'],
    optionalParams: ['review_comment'],
    supportedInChat: false,
    requiresAuth: true,
  },
  
  register_member: {
    type: 'register_member',
    name: '注册成员',
    description: 'AI 成员自注册（幂等），相同 endpoint 会更新已有记录',
    category: 'write',
    requiredParams: ['name', 'endpoint'],
    optionalParams: ['deploy_mode', 'execution_mode', 'tools', 'task_types', 'api_token'],
    supportedInChat: false,
    requiresAuth: false,
  },

  // ============ 状态类操作 ============
  
  update_status: {
    type: 'update_status',
    name: '更新状态',
    description: '更新 AI 实时状态面板，显示当前正在做什么',
    category: 'status',
    requiredParams: ['status'],
    optionalParams: ['member_id', 'current_action', 'task_id', 'progress'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  set_queue: {
    type: 'set_queue',
    name: '设置队列',
    description: '设置任务队列，显示接下来要做的任务',
    category: 'status',
    requiredParams: ['queued_tasks'],
    optionalParams: ['member_id'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  set_do_not_disturb: {
    type: 'set_do_not_disturb',
    name: '免打扰模式',
    description: '设置免打扰模式',
    category: 'status',
    requiredParams: ['interruptible'],
    optionalParams: ['member_id', 'reason'],
    supportedInChat: false,
    requiresAuth: true,
  },

  // ============ 定时任务类操作 ============
  
  create_schedule: {
    type: 'create_schedule',
    name: '创建定时任务',
    description: '创建定时任务，支持每日/每周/每月执行',
    category: 'schedule',
    requiredParams: ['title', 'task_type', 'schedule_type'],
    optionalParams: ['schedule_time', 'schedule_days', 'description', 'config'],
    supportedInChat: false,
    requiresAuth: true,
  },
  
  update_schedule: {
    type: 'update_schedule',
    name: '更新定时任务',
    description: '更新定时任务配置',
    category: 'schedule',
    requiredParams: ['schedule_id'],
    optionalParams: ['title', 'schedule_time', 'schedule_days', 'enabled', 'description'],
    supportedInChat: false,
    requiresAuth: true,
  },
  
  delete_schedule: {
    type: 'delete_schedule',
    name: '删除定时任务',
    description: '删除定时任务',
    category: 'schedule',
    requiredParams: ['schedule_id'],
    optionalParams: [],
    supportedInChat: false,
    requiresAuth: true,
  },

  // ============ SOP 类操作 ============
  
  advance_sop_stage: {
    type: 'advance_sop_stage',
    name: '推进 SOP 阶段',
    description: 'AI 完成当前 SOP 阶段，推进到下一阶段',
    category: 'sop',
    requiredParams: ['task_id'],
    optionalParams: ['stage_output'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  request_sop_confirm: {
    type: 'request_sop_confirm',
    name: '请求 SOP 确认',
    description: 'AI 请求人工确认当前 SOP 阶段产出',
    category: 'sop',
    requiredParams: ['task_id', 'confirm_message', 'stage_output'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  get_sop_context: {
    type: 'get_sop_context',
    name: '获取 SOP 上下文',
    description: '获取当前 SOP 执行上下文（阶段信息、知识库、前序产出）',
    category: 'sop',
    requiredParams: ['task_id'],
    optionalParams: [],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  save_stage_output: {
    type: 'save_stage_output',
    name: '保存阶段产出',
    description: '保存当前 SOP 阶段产出（不推进阶段）',
    category: 'sop',
    requiredParams: ['task_id', 'output'],
    optionalParams: ['output_type'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  update_knowledge: {
    type: 'update_knowledge',
    name: '更新知识库',
    description: '向 Know-how 知识库追加经验（支持 L4 分层智能追加）',
    category: 'sop',
    requiredParams: ['document_id', 'content'],
    optionalParams: ['layer'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  create_sop_template: {
    type: 'create_sop_template',
    name: '创建 SOP 模板',
    description: 'AI 自主创建 SOP 模板（draft 状态）',
    category: 'sop',
    requiredParams: ['name', 'stages'],
    optionalParams: ['category', 'system_prompt', 'required_tools', 'quality_checklist'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  update_sop_template: {
    type: 'update_sop_template',
    name: '更新 SOP 模板',
    description: 'AI 修改/优化已有 SOP 模板',
    category: 'sop',
    requiredParams: ['template_id'],
    optionalParams: ['name', 'stages', 'category', 'system_prompt'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  create_render_template: {
    type: 'create_render_template',
    name: '创建渲染模板',
    description: '创建新的渲染模板（HTML + slots）',
    category: 'sop',
    requiredParams: ['name', 'html_template'],
    optionalParams: ['category', 'slots', 'sections'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  update_render_template: {
    type: 'update_render_template',
    name: '更新渲染模板',
    description: '更新已有渲染模板',
    category: 'sop',
    requiredParams: ['template_id'],
    optionalParams: ['name', 'html_template', 'slots', 'sections'],
    supportedInChat: true,
    requiresAuth: true,
  },

  // ============ 扩展类操作 ============
  
  sync_identity: {
    type: 'sync_identity',
    name: '同步身份',
    description: '同步 AI 身份信息到 IDENTITY.md',
    category: 'extension',
    requiredParams: [],
    optionalParams: ['name', 'creature', 'vibe', 'emoji', 'avatar'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  get_mcp_token: {
    type: 'get_mcp_token',
    name: '获取 MCP Token',
    description: '获取当前 AI 成员的 MCP API Token，用于调用 /api/mcp/external 端点',
    category: 'extension',
    requiredParams: [],
    optionalParams: ['member_id'],
    supportedInChat: true,
    requiresAuth: true,
  },
  
  custom_action: {
    type: 'custom_action',
    name: '自定义操作',
    description: '自定义操作，用于扩展',
    category: 'extension',
    requiredParams: ['action_name'],
    optionalParams: ['params'],
    supportedInChat: true,
    requiresAuth: true,
  },
};

/**
 * 获取支持对话信道的操作列表
 */
export function getChatSupportedActions(): ActionType[] {
  return Object.values(ACTION_DEFINITIONS)
    .filter(def => def.supportedInChat)
    .map(def => def.type);
}

/**
 * 检查操作是否支持对话信道
 */
export function isChatSupported(type: ActionType): boolean {
  const def = ACTION_DEFINITIONS[type];
  return def?.supportedInChat ?? false;
}

/**
 * 验证操作参数
 */
export function validateActionParams(
  type: ActionType,
  params: Record<string, unknown>
): { valid: boolean; missing: string[]; error?: string } {
  const def = ACTION_DEFINITIONS[type];
  if (!def) {
    return { valid: false, missing: [], error: `未知的操作类型: ${type}` };
  }
  
  const missing: string[] = [];
  for (const param of def.requiredParams) {
    if (params[param] === undefined || params[param] === null || params[param] === '') {
      missing.push(param);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      error: `缺少必填参数: ${missing.join(', ')}`,
    };
  }
  
  return { valid: true, missing: [] };
}

/**
 * 获取操作的友好描述
 */
export function getActionDescription(type: ActionType, params: Record<string, unknown>): string {
  switch (type) {
    case 'create_task':
      return `创建任务: ${params.title}`;
    case 'update_task_status':
      return `更新任务状态: ${params.task_id} → ${params.status}`;
    case 'add_comment':
      return `添加评论到任务: ${params.task_id}`;
    case 'create_check_item':
      return `创建检查项: ${params.text}`;
    case 'complete_check_item':
      return `完成检查项: ${params.item_id}`;
    case 'create_document':
      return `创建文档: ${params.title}`;
    case 'update_document':
      return `更新文档: ${params.document_id}`;
    case 'deliver_document':
      return `提交文档交付: ${params.title}`;
    case 'update_status':
      return `更新状态: ${params.status}`;
    case 'set_queue':
      return `设置任务队列: ${(params.queued_tasks as unknown[])?.length || 0} 个任务`;
    case 'set_do_not_disturb':
      return params.interruptible ? '关闭免打扰模式' : `开启免打扰模式`;
    case 'sync_identity':
      return `同步身份信息: ${params.name || '未知'}`;
    case 'advance_sop_stage':
      return `推进 SOP 阶段: 任务 ${params.task_id}`;
    case 'request_sop_confirm':
      return `请求确认: 任务 ${params.task_id}`;
    case 'get_sop_context':
      return `获取 SOP 上下文: 任务 ${params.task_id}`;
    case 'save_stage_output':
      return `保存阶段产出: 任务 ${params.task_id}`;
    case 'update_knowledge':
      return `更新知识库: 文档 ${params.document_id}`;
    case 'create_sop_template':
      return `创建 SOP 模板: ${params.name}`;
    case 'update_sop_template':
      return `更新 SOP 模板: ${params.template_id}`;
    case 'create_render_template':
      return `创建渲染模板: ${params.name}`;
    case 'update_render_template':
      return `更新渲染模板: ${params.template_id}`;
    case 'create_milestone':
      return `创建里程碑: ${params.title}`;
    case 'update_milestone':
      return `更新里程碑: ${params.milestone_id}`;
    case 'delete_milestone':
      return `删除里程碑: ${params.milestone_id}`;
    case 'list_milestones':
      return `获取里程碑列表: 项目 ${params.project_id}`;
    case 'list_render_templates':
      return `获取渲染模板列表`;
    case 'get_render_template':
      return `获取渲染模板: ${params.template_id}`;
    case 'get_sop_previous_output':
      return `获取 SOP 前序产出: 任务 ${params.task_id}`;
    case 'get_sop_knowledge_layer':
      return `获取 SOP 知识层: 任务 ${params.task_id}`;
    case 'list_skills':
      return `获取 Skill 列表${params.category ? ` (${params.category})` : ''}`;
    case 'list_my_deliveries':
      return `获取我的交付列表${params.status ? ` (${params.status})` : ''}`;
    case 'get_delivery':
      return `获取交付详情: ${params.delivery_id}`;
    case 'invoke_skill':
      return `调用 Skill: ${params.skill_key}`;
    default:
      return `执行操作: ${type}`;
  }
}
