/**
 * 对话信道数据交互模块 - 统一执行器
 * 
 * 提供：
 * - 单一执行入口
 * - 统一的错误处理
 * - 结构化日志
 * - 自动刷新前端 Store
 */

import type { Action, ActionType, ActionResult, BatchActionResult, ExecutorOptions } from './types';
import { ErrorCode } from './types';
import { ActionError, toActionError, missingParamError } from './errors';
import { validateActionParams, ACTION_DEFINITIONS } from './actions';
import { getLogger, generateRequestId } from './logger';

// 导入 handlers（复用现有实现）
import {
  handleGetTask,
  handleUpdateTaskStatus,
  handleAddTaskComment,
  handleCreateCheckItem,
  handleCompleteCheckItem,
  handleListMyTasks,
  handleCreateTask,
} from '@/app/api/mcp/handlers/task.handler';
import {
  handleGetDocument,
  handleCreateDocument,
  handleUpdateDocument,
  handleSearchDocuments,
} from '@/app/api/mcp/handlers/document.handler';
import {
  handleGetProject,
  handleGetProjectMembers,
} from '@/app/api/mcp/handlers/project.handler';
import {
  handleUpdateStatus,
  handleSetQueue,
  handleSetDoNotDisturb,
} from '@/app/api/mcp/handlers/status.handler';
import {
  handleCreateSchedule,
  handleListSchedules,
  handleDeleteSchedule,
  handleUpdateSchedule,
} from '@/app/api/mcp/handlers/schedule.handler';

// delivery.handler 动态导入避免循环依赖
// (delivery.handler -> server-gateway-client -> chat-channel/executor -> delivery.handler)
async function getDeliveryHandlers() {
  const { handleDeliverDocument, handleReviewDelivery, handleListMyDeliveries, handleGetDelivery } = await import('@/app/api/mcp/handlers/delivery.handler');
  return { handleDeliverDocument, handleReviewDelivery, handleListMyDeliveries, handleGetDelivery };
}
import { handleRegisterMember, handleGetMcpToken } from '@/app/api/mcp/handlers/member.handler';
import {
  handleGetTemplate,
  handleListTemplates,
} from '@/app/api/mcp/handlers/template.handler';
import {
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
} from '@/app/api/mcp/handlers/sop.handler';
import {
  handleCreateMilestone,
  handleListMilestones,
  handleUpdateMilestone,
  handleDeleteMilestone,
} from '@/app/api/mcp/handlers/milestone.handler';
import {
  handleGetSopPreviousOutput,
  handleGetSopKnowledgeLayer,
} from '@/app/api/mcp/handlers/context.handler';
import {
  handleInvokeSkill,
  handleListSkills,
} from '@/app/api/mcp/handlers/skill.handler';

// 导入 Store 刷新
import { useTaskStore } from '@/domains/task';
import { useDocumentStore } from '@/domains/document';
import { useProjectStore } from '@/domains/project';
import { useMemberStore } from '@/domains/member';
import { useOpenClawStatusStore } from '@/core/gateway/openclaw.store';
import { useScheduledTaskStore } from '@/domains/schedule';
import { useDeliveryStore } from '@/domains/delivery';
import { useSOPTemplateStore } from '@/domains/sop';
import { useRenderTemplateStore } from '@/domains/render-template';
import { useMilestoneStore } from '@/domains/milestone';

// ============================================================================
// 执行器
// ============================================================================

/**
 * 执行单个 Action
 */
export async function executeAction(
  action: Action,
  options: ExecutorOptions = {}
): Promise<ActionResult> {
  const requestId = options.requestId || generateRequestId();
  const logger = getLogger();
  const startTime = logger.actionStart(requestId, action.type, action as unknown as Record<string, unknown>);

  try {
    // 1. 验证操作类型
    const def = ACTION_DEFINITIONS[action.type];
    if (!def) {
      throw new ActionError(
        ErrorCode.INVALID_TYPE,
        `未知的操作类型: ${action.type}`,
        { type: action.type }
      );
    }

    // 2. 验证参数
    const validation = validateActionParams(action.type, action as unknown as Record<string, unknown>);
    if (!validation.valid) {
      throw missingParamError(validation.missing[0], action.type);
    }

    // 3. 执行操作
    const result = await executeHandler(action, options);

    // 4. 记录日志
    logger.actionEnd(requestId, action.type, startTime, result.success, result.message);

    // 5. 添加请求 ID
    result.requestId = requestId;

    return result;
  } catch (error) {
    const actionError = toActionError(error, action.type);
    logger.actionEnd(requestId, action.type, startTime, false, actionError.message);
    
    return actionError.toResult(action.type, requestId);
  }
}

/**
 * 批量执行 Actions
 * 
 * 支持返回值传递：前序 action 的返回值可传递给后续 action
 * 例如：create_document 返回 document_id → deliver_document 使用
 * 
 * v3.0 优化：延迟刷新，批量更新 Store
 */
export async function executeActions(
  actions: Action[],
  options: ExecutorOptions = {}
): Promise<BatchActionResult> {
  const requestId = options.requestId || generateRequestId();
  const logger = getLogger();
  
  logger.info(requestId, `开始批量执行 ${actions.length} 个操作`);

  const results: ActionResult[] = [];
  // v3.0: 收集需要刷新的 Store 类型
  const storesToRefresh = new Set<StoreType>();
  
  // 执行上下文：存储前序 action 的返回值
  const context: {
    lastDocumentId?: string;
    lastDocumentTitle?: string;
    lastTaskId?: string;
    lastDeliveryId?: string;
  } = {};
  
  for (const action of actions) {
    // 注入上下文值
    const enrichedAction = injectContext(action, context);
    
    // v3.0: 延迟刷新，批量更新
    const result = await executeAction(enrichedAction, { 
      ...options, 
      requestId,
      triggerRefresh: false, // 延迟刷新
    });
    results.push(result);
    
    // 更新上下文
    if (result.success && result.data) {
      updateContext(context, action.type, result.data);
    }
    
    // v3.0: 记录需要刷新的 Store
    if (result.success) {
      const storeType = getStoreType(action.type);
      if (storeType) {
        storesToRefresh.add(storeType);
      }
    }
    
    // 记录失败但继续执行
    if (!result.success) {
      logger.warn(requestId, `操作 ${action.type} 执行失败: ${result.message}`, {
        action: action.type,
        data: { errorCode: result.errorCode },
      });
    }
  }
  
  // v3.0: 批量并行刷新 Store
  if (options.triggerRefresh !== false && storesToRefresh.size > 0) {
    await batchRefreshStores(Array.from(storesToRefresh), requestId);
  }

  // 汇总
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  logger.info(requestId, `批量执行完成: ${successCount} 成功, ${failedCount} 失败, 刷新 ${storesToRefresh.size} 个 Store`);

  return {
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount,
    },
    requestId,
  };
}

// v3.0: Store 类型映射
type StoreType = 'tasks' | 'documents' | 'projects' | 'members' | 'deliveries' | 'schedules' | 'status' | 'sop' | 'render';

/**
 * 根据 action 类型获取 Store 类型
 */
function getStoreType(actionType: ActionType): StoreType | null {
  const map: Record<string, StoreType> = {
    // 任务相关
    create_task: 'tasks',
    update_task_status: 'tasks',
    add_comment: 'tasks',
    create_check_item: 'tasks',
    complete_check_item: 'tasks',
    advance_sop_stage: 'tasks',
    request_sop_confirm: 'tasks',
    save_stage_output: 'tasks',
    
    // 文档相关
    create_document: 'documents',
    update_document: 'documents',
    update_knowledge: 'documents',
    
    // 交付相关
    deliver_document: 'deliveries',
    review_delivery: 'deliveries',
    
    // 项目相关
    create_project: 'projects',
    update_project: 'projects',
    
    // 成员相关
    register_member: 'members',
    
    // 日程相关
    create_schedule: 'schedules',
    update_schedule: 'schedules',
    delete_schedule: 'schedules',
    
    // 状态相关
    update_status: 'status',
    set_queue: 'status',
    set_do_not_disturb: 'status',
    
    // SOP 相关
    create_sop_template: 'sop',
    update_sop_template: 'sop',
    
    // 渲染模板相关
    create_render_template: 'render',
    update_render_template: 'render',
  };
  
  return map[actionType] || null;
}

/**
 * v3.0: 批量并行刷新 Store
 */
async function batchRefreshStores(
  storeTypes: StoreType[],
  requestId: string
): Promise<void> {
  const logger = getLogger();
  const startTime = Date.now();
  
  // 去重
  const uniqueStores = [...new Set(storeTypes)];
  
  logger.info(requestId, `批量刷新 ${uniqueStores.length} 个 Store`, { data: { stores: uniqueStores } });
  
  // 并行刷新
  const refreshers: Promise<void>[] = [];
  
  if (uniqueStores.includes('tasks')) {
    refreshers.push(
      useTaskStore.getState().fetchTasks().catch(err => {
        logger.error(requestId, '刷新 tasks 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('documents')) {
    refreshers.push(
      useDocumentStore.getState().fetchDocuments().catch(err => {
        logger.error(requestId, '刷新 documents 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('projects')) {
    refreshers.push(
      useProjectStore.getState().fetchProjects().catch(err => {
        logger.error(requestId, '刷新 projects 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('members')) {
    refreshers.push(
      useMemberStore.getState().fetchMembers().catch(err => {
        logger.error(requestId, '刷新 members 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('deliveries')) {
    refreshers.push(
      useDeliveryStore.getState().fetchDeliveries().catch(err => {
        logger.error(requestId, '刷新 deliveries 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('schedules')) {
    refreshers.push(
      useScheduledTaskStore.getState().fetchTasks().catch(err => {
        logger.error(requestId, '刷新 schedules 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('status')) {
    refreshers.push(
      useOpenClawStatusStore.getState().fetchStatus().catch(err => {
        logger.error(requestId, '刷新 status 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('sop')) {
    refreshers.push(
      useSOPTemplateStore.getState().fetchTemplates().catch(err => {
        logger.error(requestId, '刷新 sop 失败', err);
      })
    );
  }
  
  if (uniqueStores.includes('render')) {
    refreshers.push(
      useRenderTemplateStore.getState().fetchTemplates().catch(err => {
        logger.error(requestId, '刷新 render 失败', err);
      })
    );
  }
  
  await Promise.all(refreshers);
  
  const duration = Date.now() - startTime;
  logger.info(requestId, `批量刷新完成，耗时 ${duration}ms`);
}

/**
 * 注入上下文值到 action
 * 解决 create_document → deliver_document 的 ID 传递问题
 */
function injectContext(action: Action, context: { lastDocumentId?: string; lastDocumentTitle?: string }): Action {
  // deliver_document 缺少 document_id 时，使用最近创建的文档
  if (action.type === 'deliver_document') {
    if (!action.document_id && context.lastDocumentId) {
      console.log('[chat-channel] 自动注入 document_id:', context.lastDocumentId);
      return { ...action, document_id: context.lastDocumentId };
    }
    // 如果 title 匹配，也注入
    if (!action.document_id && action.title && context.lastDocumentTitle === action.title && context.lastDocumentId) {
      return { ...action, document_id: context.lastDocumentId };
    }
  }
  return action;
}

/**
 * 更新执行上下文
 */
function updateContext(
  context: { lastDocumentId?: string; lastDocumentTitle?: string; lastTaskId?: string; lastDeliveryId?: string },
  actionType: string,
  data: Record<string, unknown>
): void {
  switch (actionType) {
    case 'create_document':
      if (data.id) {
        context.lastDocumentId = data.id as string;
        context.lastDocumentTitle = data.title as string;
      }
      break;
    case 'update_task_status':
      if (data.taskId) {
        context.lastTaskId = data.taskId as string;
      }
      break;
    case 'deliver_document':
      if (data.id) {
        context.lastDeliveryId = data.id as string;
      }
      break;
  }
}

// ============================================================================
// Handler 分发
// ============================================================================

/**
 * 执行 Handler
 */
async function executeHandler(
  action: Action,
  options: ExecutorOptions
): Promise<ActionResult> {
  let result: { success: boolean; data?: unknown; error?: string; message?: string };

  switch (action.type) {
    // ============ 查询类 ============
    
    case 'get_task':
      result = await handleGetTask({ task_id: action.task_id });
      break;
    
    case 'list_my_tasks':
      result = await handleListMyTasks({
        member_id: action.member_id || options.memberId,
        status: action.status,
        project_id: action.project_id,
        limit: action.limit,
      });
      break;
    
    case 'get_project':
      result = await handleGetProject({ project_id: action.project_id });
      break;
    
    case 'get_project_members':
      result = await handleGetProjectMembers({});
      break;
    
    case 'get_document':
      result = await handleGetDocument({
        document_id: action.document_id,
        title: action.title,
      });
      break;
    
    case 'search_documents':
      result = await handleSearchDocuments({
        query: action.query,
        project_id: action.project_id,
      });
      break;
    
    case 'get_template':
      result = await handleGetTemplate({ template_name: action.template_name });
      break;
    
    case 'list_templates':
      result = await handleListTemplates();
      break;
    
    case 'list_schedules':
      result = await handleListSchedules({
        member_id: action.member_id,
        enabled_only: action.enabled_only,
      });
      break;

    case 'list_milestones':
      result = await handleListMilestones({ project_id: action.project_id });
      break;

    case 'list_render_templates':
      result = await handleListRenderTemplates({
        category: action.category,
        status: action.status || 'active',
      });
      break;

    case 'get_render_template':
      result = await handleGetRenderTemplate({ template_id: action.template_id });
      break;

    case 'get_sop_previous_output':
      result = await handleGetSopPreviousOutput({
        task_id: action.task_id,
        stage_id: action.stage_id,
      });
      break;

    case 'get_sop_knowledge_layer':
      result = await handleGetSopKnowledgeLayer({
        task_id: action.task_id,
        layer: action.layer || 'L1',
      });
      break;

    case 'list_skills':
      result = await handleListSkills({
        category: action.category,
        search: action.search,
        limit: action.limit || 20,
      });
      break;

    case 'list_my_deliveries': {
      const { handleListMyDeliveries: listDeliveries } = await getDeliveryHandlers();
      result = await listDeliveries({
        status: action.delivery_status || 'all',
        limit: action.limit || 20,
        member_id: options.memberId,
      });
      break;
    }

    case 'get_delivery': {
      const { handleGetDelivery: getDelivery } = await getDeliveryHandlers();
      result = await getDelivery({
        delivery_id: action.delivery_id,
      });
      break;
    }

    // ============ 写入类 ============
    
    case 'create_task':
      result = await handleCreateTask({
        title: action.title,
        description: action.description,
        project_id: action.project_id,
        assignees: action.assignees,
        priority: action.priority,
        deadline: action.deadline,
        milestone: action.milestone,
        member_id: options.memberId,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
        await useProjectStore.getState().fetchProjects();
      }
      break;
    
    case 'update_task_status':
      result = await handleUpdateTaskStatus({
        task_id: action.task_id,
        status: action.status,
        progress: action.progress,
        message: action.message,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'add_comment':
      result = await handleAddTaskComment({
        task_id: action.task_id,
        content: action.content,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'create_check_item':
      result = await handleCreateCheckItem({
        task_id: action.task_id,
        text: action.text,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'complete_check_item':
      result = await handleCompleteCheckItem({
        task_id: action.task_id,
        item_id: action.item_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'create_document':
      result = await handleCreateDocument({
        title: action.title,
        content: action.content,
        doc_type: action.doc_type,
        project_id: action.project_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDocumentStore.getState().fetchDocuments();
      }
      break;
    
    case 'update_document':
      result = await handleUpdateDocument({
        document_id: action.document_id,
        content: action.content,
        doc_type: action.doc_type,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDocumentStore.getState().fetchDocuments();
      }
      break;
    
    case 'deliver_document': {
      const { handleDeliverDocument } = await getDeliveryHandlers();
      result = await handleDeliverDocument({
        title: action.title,
        description: action.content,
        platform: action.platform,
        external_url: action.external_url,
        document_id: action.document_id,
        task_id: action.task_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDeliveryStore.getState().fetchDeliveries();
      }
      break;
    }

    case 'create_milestone':
      result = await handleCreateMilestone({
        title: action.title,
        project_id: action.project_id,
        description: action.description,
        status: action.status,
        due_date: action.due_date,
        sort_order: action.sort_order,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useMilestoneStore.getState().fetchMilestones();
      }
      break;

    case 'update_milestone':
      result = await handleUpdateMilestone({
        milestone_id: action.milestone_id,
        title: action.title,
        description: action.description,
        status: action.status,
        due_date: action.due_date,
        sort_order: action.sort_order,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useMilestoneStore.getState().fetchMilestones();
      }
      break;

    case 'delete_milestone':
      result = await handleDeleteMilestone({ milestone_id: action.milestone_id });
      if (result.success && options.triggerRefresh !== false) {
        await useMilestoneStore.getState().fetchMilestones();
        await useTaskStore.getState().fetchTasks();
      }
      break;

    case 'invoke_skill':
      result = await handleInvokeSkill({
        skill_key: action.skill_key,
        task_id: action.task_id,
        parameters: action.parameters,
        context: action.context,
        member_id: options.memberId,
      });
      // Skill 执行可能产生多种结果，刷新相关 store
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
        await useDocumentStore.getState().fetchDocuments();
        await useDeliveryStore.getState().fetchDeliveries();
      }
      break;

    case 'review_delivery': {
      const { handleReviewDelivery } = await getDeliveryHandlers();
      result = await handleReviewDelivery({
        delivery_id: action.delivery_id,
        status: action.review_status,
        comment: action.review_comment,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDeliveryStore.getState().fetchDeliveries();
      }
      break;
    }
    
    case 'register_member':
      result = await handleRegisterMember({
        name: action.name,
        endpoint: action.endpoint,
        deploy_mode: action.deploy_mode,
        execution_mode: action.execution_mode,
        tools: action.tools,
        task_types: action.task_types,
        api_token: action.api_token,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useMemberStore.getState().fetchMembers();
      }
      break;

    // ============ 状态类 ============
    
    case 'update_status':
      result = await handleUpdateStatus({
        member_id: action.member_id || options.memberId,
        status: action.status,
        current_action: action.current_action,
        task_id: action.task_id,
        progress: action.progress,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;
    
    case 'set_queue':
      result = await handleSetQueue({
        member_id: action.member_id || options.memberId,
        queued_tasks: action.queued_tasks,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;
    
    case 'set_do_not_disturb':
      result = await handleSetDoNotDisturb({
        member_id: action.member_id || options.memberId,
        interruptible: action.interruptible,
        reason: action.reason,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;

    // ============ 定时任务类 ============
    
    case 'create_schedule':
      result = await handleCreateSchedule({
        title: action.title,
        task_type: action.task_type,
        schedule_type: action.schedule_type,
        schedule_time: action.schedule_time,
        schedule_days: action.schedule_days,
        description: action.description,
        config: action.config,
        member_id: action.member_id || options.memberId,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'update_schedule':
      result = await handleUpdateSchedule({
        schedule_id: action.schedule_id,
        title: action.title,
        schedule_time: action.schedule_time,
        schedule_days: action.schedule_days,
        enabled: action.enabled,
        description: action.description,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'delete_schedule':
      result = await handleDeleteSchedule({
        schedule_id: action.schedule_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;

    // ============ 扩展类 ============
    
    case 'sync_identity':
      result = await handleSyncIdentity({
        name: action.name,
        creature: action.creature,
        vibe: action.vibe,
        emoji: action.emoji,
        avatar: action.avatar,
      });
      break;
    
    case 'get_mcp_token':
      // [F3] member_id 优先用 action 参数，其次用 options.memberId（由服务端从 sessionKey 推导）
      result = await handleGetMcpToken({
        member_id: action.member_id || options.memberId,
      });
      break;

    // ============ SOP 类 ============
    
    case 'advance_sop_stage':
      result = await handleAdvanceSopStage({
        task_id: action.task_id,
        stage_output: action.stage_output,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'request_sop_confirm':
      result = await handleRequestSopConfirm({
        task_id: action.task_id,
        confirm_message: action.confirm_message,
        stage_output: action.stage_output,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'get_sop_context':
      result = await handleGetSopContext({
        task_id: action.task_id,
      });
      break;
    
    case 'save_stage_output':
      result = await handleSaveStageOutput({
        task_id: action.task_id,
        output: action.output,
        output_type: action.output_type,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'update_knowledge':
      result = await handleUpdateKnowledge({
        document_id: action.document_id,
        content: action.content,
        layer: action.layer,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDocumentStore.getState().fetchDocuments();
      }
      break;
    
    case 'create_sop_template':
      result = await handleCreateSopTemplate({
        name: action.name,
        stages: action.stages,
        category: action.category,
        system_prompt: action.system_prompt,
        required_tools: action.required_tools,
        quality_checklist: action.quality_checklist,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useSOPTemplateStore.getState().fetchTemplates();
      }
      break;
    
    case 'update_sop_template':
      result = await handleUpdateSopTemplate({
        template_id: action.template_id,
        name: action.name,
        stages: action.stages,
        category: action.category,
        system_prompt: action.system_prompt,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useSOPTemplateStore.getState().fetchTemplates();
      }
      break;
    
    case 'create_render_template':
      result = await handleCreateRenderTemplate({
        name: action.name,
        html_template: action.html_template,
        category: action.category,
        slots: action.slots,
        sections: action.sections,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useRenderTemplateStore.getState().fetchTemplates();
      }
      break;
    
    case 'update_render_template':
      result = await handleUpdateRenderTemplate({
        template_id: action.template_id,
        name: action.name,
        html_template: action.html_template,
        slots: action.slots,
        sections: action.sections,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useRenderTemplateStore.getState().fetchTemplates();
      }
      break;
    
    case 'custom_action':
      // 自定义操作需要注册 handler
      result = {
        success: false,
        error: `自定义操作 ${action.action_name} 未注册 handler`,
      };
      break;

    default:
      result = {
        success: false,
        error: `未实现的操作类型: ${(action as Action).type}`,
      };
  }

  return {
    type: action.type,
    success: result.success,
    message: result.success
      ? (result.message || '操作成功')
      : (result.error || '操作失败'),
    data: result.data as Record<string, unknown> | undefined,
    timestamp: new Date(),
    requestId: options.requestId,
  };
}

// ============================================================================
// 扩展 Handler（身份同步等）
// ============================================================================

/**
 * 身份同步 Handler
 */
async function handleSyncIdentity(params: Record<string, unknown>): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}> {
  // 这个功能需要 Gateway 支持，暂时返回成功
  // TODO: 实现与 Gateway 的身份同步
  
  const { name, creature, vibe, emoji, avatar } = params;
  
  return {
    success: true,
    data: { name, creature, vibe, emoji, avatar },
    message: '身份信息已同步',
  };
}

// ============================================================================
// 自定义 Handler 注册
// ============================================================================

type CustomHandler = (params: Record<string, unknown>, options: ExecutorOptions) => Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}>;

const customHandlers = new Map<string, CustomHandler>();

/**
 * 注册自定义 Handler
 */
export function registerCustomHandler(actionName: string, handler: CustomHandler): void {
  customHandlers.set(actionName, handler);
}

/**
 * 获取自定义 Handler
 */
export function getCustomHandler(actionName: string): CustomHandler | undefined {
  return customHandlers.get(actionName);
}

// ============================================================================
// 导出
// ============================================================================

export { generateRequestId } from './logger';
