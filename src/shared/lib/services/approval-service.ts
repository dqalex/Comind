/**
 * 审批服务 - Approval Service
 * 
 * 封装所有审批相关的业务逻辑，供 API 路由和内部模块使用。
 * 提取自 app/api/approval-requests/* 路由中的重复代码。
 */

import { db } from '@/db';
import {
  approvalRequests,
  approvalHistories,
  approvalStrategies,
  skills,
  type ApprovalRequest,
  type NewApprovalRequest,
  type NewApprovalHistory,
} from '@/db/schema';
import { eq, and, desc, inArray, type SQL } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getServerGatewayClient } from '@/lib/server-gateway-client';
import { RPC_METHODS } from '@/lib/rpc-methods';
import { addProjectMember, type ProjectRole } from '@/lib/project-access';

// ============================================================
// 类型定义
// ============================================================

export type ApprovalType = 'skill_publish' | 'skill_install' | 'project_join' | 'sensitive_action';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type ApprovalAction = 'created' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'reassigned';

export interface CreateApprovalRequestInput {
  type: ApprovalType;
  resourceType: string;
  resourceId: string;
  requesterId: string;
  payload?: Record<string, unknown>;
  requestNote?: string;
  expiresAt?: Date;
}

export interface ProcessApprovalInput {
  requestId: string;
  action: 'approved' | 'rejected' | 'cancelled';
  operatorId: string;
  note?: string;
}

export interface ApprovalFilters {
  type?: ApprovalType;
  status?: ApprovalStatus;
  requesterId?: string;
  resourceId?: string;
  resourceType?: string;
}

export interface ApprovalQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ApprovalResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 查询操作
// ============================================================

/**
 * 获取审批请求列表
 */
export async function getApprovalRequests(
  filters: ApprovalFilters = {},
  options: ApprovalQueryOptions = {}
): Promise<ApprovalResult<{ requests: ApprovalRequest[]; total: number }>> {
  try {
    const { type, status, requesterId, resourceId, resourceType } = filters;
    const { limit = 100, offset = 0, orderBy = 'createdAt', orderDirection = 'desc' } = options;

    // 构建查询条件
    const conditions: SQL<unknown>[] = [];

    if (type) {
      conditions.push(eq(approvalRequests.type, type));
    }
    if (status) {
      conditions.push(eq(approvalRequests.status, status));
    }
    if (requesterId) {
      conditions.push(eq(approvalRequests.requesterId, requesterId));
    }
    if (resourceId) {
      conditions.push(eq(approvalRequests.resourceId, resourceId));
    }
    if (resourceType) {
      conditions.push(eq(approvalRequests.resourceType, resourceType));
    }

    // 执行查询
    const orderColumn = orderBy === 'updatedAt' ? approvalRequests.updatedAt : approvalRequests.createdAt;
    const requests = await db
      .select()
      .from(approvalRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection === 'asc' ? orderColumn : desc(orderColumn))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const countResult = await db
      .select({ count: db.$count(approvalRequests) })
      .from(approvalRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countResult[0]?.count || 0;

    return { success: true, data: { requests, total } };
  } catch (error) {
    console.error('[ApprovalService] getApprovalRequests error:', error);
    return { success: false, error: 'Failed to fetch approval requests' };
  }
}

/**
 * 获取单个审批请求详情
 */
export async function getApprovalRequestById(
  requestId: string
): Promise<ApprovalResult<{ request: ApprovalRequest; histories: typeof approvalHistories.$inferSelect[] }>> {
  try {
    // 获取审批请求
    const [request] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    if (!request) {
      return { success: false, error: 'Approval request not found' };
    }

    // 获取审批历史
    const histories = await db
      .select()
      .from(approvalHistories)
      .where(eq(approvalHistories.requestId, requestId))
      .orderBy(desc(approvalHistories.createdAt));

    return { success: true, data: { request, histories } };
  } catch (error) {
    console.error('[ApprovalService] getApprovalRequestById error:', error);
    return { success: false, error: 'Failed to fetch approval request' };
  }
}

/**
 * 检查用户是否有权限查看审批请求
 */
export function canViewApprovalRequest(
  request: ApprovalRequest,
  userId: string,
  userRole: string
): boolean {
  if (userRole === 'admin') return true;
  return request.requesterId === userId;
}

/**
 * 检查用户是否有权限处理审批请求
 */
export function canProcessApprovalRequest(userRole: string): boolean {
  return userRole === 'admin';
}

// ============================================================
// 创建操作
// ============================================================

/**
 * 创建审批请求
 */
export async function createApprovalRequest(
  input: CreateApprovalRequestInput
): Promise<ApprovalResult<{ request: ApprovalRequest }>> {
  try {
    const { type, resourceType, resourceId, requesterId, payload, requestNote, expiresAt } = input;

    // 获取审批策略
    const [strategyConfig] = await db
      .select()
      .from(approvalStrategies)
      .where(eq(approvalStrategies.type, type));

    if (!strategyConfig || !strategyConfig.enabled) {
      return { success: false, error: 'Approval type not supported or disabled' };
    }

    // 检查是否已有待审批的请求
    const [existing] = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.type, type),
          eq(approvalRequests.resourceId, resourceId),
          eq(approvalRequests.status, 'pending')
        )
      );

    if (existing) {
      return { success: false, error: 'Pending request already exists for this resource' };
    }

    // 创建审批请求
    const requestId = generateId();
    const now = new Date();

    const [request] = await db
      .insert(approvalRequests)
      .values({
        id: requestId,
        type,
        resourceType,
        resourceId,
        requesterId,
        payload,
        requestNote,
        status: 'pending',
        expiresAt: expiresAt || null,
        createdAt: now,
        updatedAt: now,
      } as NewApprovalRequest)
      .returning();

    // 记录历史
    await recordApprovalHistory({
      requestId,
      action: 'created',
      operatorId: requesterId,
      previousStatus: null,
      newStatus: 'pending',
      note: requestNote,
      createdAt: now,
    });

    // 触发事件
    eventBus.emit({
      type: 'approval_request_created',
      resourceId: requestId,
      data: { type, resourceType, resourceId, requesterId },
    });

    return { success: true, data: { request } };
  } catch (error) {
    console.error('[ApprovalService] createApprovalRequest error:', error);
    return { success: false, error: 'Failed to create approval request' };
  }
}

// ============================================================
// 处理操作
// ============================================================

/**
 * 处理审批请求（批准/拒绝/取消）
 */
export async function processApprovalRequest(
  input: ProcessApprovalInput
): Promise<ApprovalResult<{ request: ApprovalRequest }>> {
  try {
    const { requestId, action, operatorId, note } = input;

    // 获取审批请求
    const [request] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    if (!request) {
      return { success: false, error: 'Approval request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Request already processed' };
    }

    const now = new Date();
    const newStatus: ApprovalStatus = action;

    // 更新审批请求状态
    const updateData: Partial<typeof approvalRequests.$inferInsert> = {
      status: newStatus,
      updatedAt: now,
      processedAt: now,
    };

    if (action === 'approved') {
      updateData.approvedBy = operatorId;
      updateData.approvalNote = note;
    } else if (action === 'rejected') {
      updateData.rejectedBy = operatorId;
      updateData.rejectionNote = note;
    }
    // Note: cancelled 状态只在 history 中记录，不修改 approvalRequests 表

    await db.update(approvalRequests).set(updateData).where(eq(approvalRequests.id, requestId));

    // 记录历史
    await recordApprovalHistory({
      requestId,
      action,
      operatorId,
      previousStatus: 'pending',
      newStatus,
      note,
      createdAt: now,
    });

    // 执行审批后的业务逻辑
    if (action === 'approved') {
      const executeResult = await executeApprovalAction(request);
      if (!executeResult.success) {
        console.warn('[ApprovalService] Execute approval action failed:', executeResult.error);
      }
    }

    // 触发事件
    eventBus.emit({
      type: `approval_request_${action}`,
      resourceId: requestId,
      data: {
        type: request.type,
        resourceId: request.resourceId,
        requesterId: request.requesterId,
      },
    });

    // 返回更新后的请求
    const [updatedRequest] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    return { success: true, data: { request: updatedRequest } };
  } catch (error) {
    console.error('[ApprovalService] processApprovalRequest error:', error);
    return { success: false, error: 'Failed to process approval request' };
  }
}

/**
 * 批准审批请求（快捷方法）
 */
export async function approveApprovalRequest(
  requestId: string,
  operatorId: string,
  note?: string
): Promise<ApprovalResult<{ request: ApprovalRequest }>> {
  return processApprovalRequest({ requestId, action: 'approved', operatorId, note });
}

/**
 * 拒绝审批请求（快捷方法）
 */
export async function rejectApprovalRequest(
  requestId: string,
  operatorId: string,
  note?: string
): Promise<ApprovalResult<{ request: ApprovalRequest }>> {
  return processApprovalRequest({ requestId, action: 'rejected', operatorId, note });
}

/**
 * 取消审批请求（快捷方法）
 */
export async function cancelApprovalRequest(
  requestId: string,
  operatorId: string,
  note?: string
): Promise<ApprovalResult<{ request: ApprovalRequest }>> {
  return processApprovalRequest({ requestId, action: 'cancelled', operatorId, note });
}

// ============================================================
// 业务逻辑执行
// ============================================================

/**
 * 执行审批通过后的业务逻辑
 */
async function executeApprovalAction(
  request: ApprovalRequest
): Promise<ApprovalResult> {
  try {
    switch (request.type) {
      case 'skill_publish': {
        return await executeSkillPublishAction(request);
      }

      case 'skill_install': {
        return await executeSkillInstallAction(request);
      }

      case 'project_join': {
        // 项目加入审批通过：将申请人添加为项目成员
        const projectId = request.resourceId;
        const userId = request.requesterId;
        // 从 payload 获取角色，默认为 member
        const role = (request.payload?.role as ProjectRole) || 'member';

        if (!projectId || !userId) {
          return { success: false, error: 'Missing projectId or userId' };
        }

        const result = await addProjectMember(projectId, userId, role);

        if (result.success) {
          // 发送成员加入事件
          eventBus.emit({ type: 'project_member_joined', resourceId: projectId, data: { userId, role } });
          return { success: true };
        } else {
          return { success: false, error: result.error || 'Failed to add member' };
        }
      }

      default:
        console.warn(`[ApprovalService] Unknown approval type: ${request.type}`);
        return { success: false, error: `Unknown approval type: ${request.type}` };
    }
  } catch (error) {
    console.error('[ApprovalService] executeApprovalAction error:', error);
    return { success: false, error: 'Failed to execute approval action' };
  }
}

/**
 * 执行 Skill 发布审批通过后的逻辑
 */
async function executeSkillPublishAction(request: ApprovalRequest): Promise<ApprovalResult> {
  try {
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, request.resourceId));

    if (!skill) {
      console.warn(`[ApprovalService] Skill not found: ${request.resourceId}`);
      return { success: false, error: 'Skill not found' };
    }

    // 更新 Skill 状态为 active
    await db
      .update(skills)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(skills.id, request.resourceId));

    return { success: true };
  } catch (error) {
    console.error('[ApprovalService] executeSkillPublishAction error:', error);
    return { success: false, error: 'Failed to publish skill' };
  }
}

/**
 * 执行 Skill 安装审批通过后的逻辑
 */
async function executeSkillInstallAction(request: ApprovalRequest): Promise<ApprovalResult> {
  try {
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, request.resourceId));

    if (!skill) {
      return { success: false, error: `Skill not found: ${request.resourceId}` };
    }

    // 获取 agentId
    const payload = request.payload as { agentId?: string } | null;
    const agentId = payload?.agentId;

    if (!agentId) {
      return { success: false, error: 'agentId is required for skill_install' };
    }

    // 调用 Gateway 安装 Skill
    const gatewayClient = getServerGatewayClient();
    if (gatewayClient.isConnected) {
      await gatewayClient.request(RPC_METHODS.SKILLS_INSTALL, {
        name: agentId,
        installId: skill.skillKey,
      });
    } else {
      console.warn('[ApprovalService] Gateway client not connected, skipping skill installation');
    }

    // 更新 Skill 的 installedAgents 列表
    const currentAgents = skill.installedAgents || [];
    const updatedAgents = [...new Set([...currentAgents, agentId])];

    await db
      .update(skills)
      .set({
        installedAgents: updatedAgents,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, request.resourceId));

    return { success: true };
  } catch (error) {
    console.error('[ApprovalService] executeSkillInstallAction error:', error);
    return { success: false, error: 'Failed to install skill' };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 记录审批历史
 */
async function recordApprovalHistory(history: Omit<NewApprovalHistory, 'id'>): Promise<void> {
  try {
    await db.insert(approvalHistories).values({
      id: generateId(),
      ...history,
    });
  } catch (error) {
    // 历史记录插入失败不应阻断主流程
    console.warn('[ApprovalService] Failed to insert approval history:', error);
  }
}

/**
 * 检查资源是否有待审批的请求
 */
export async function hasPendingApprovalRequest(
  type: ApprovalType,
  resourceId: string
): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.type, type),
          eq(approvalRequests.resourceId, resourceId),
          eq(approvalRequests.status, 'pending')
        )
      );
    return !!existing;
  } catch (error) {
    console.error('[ApprovalService] hasPendingApprovalRequest error:', error);
    return false;
  }
}

/**
 * 获取资源的审批状态
 */
export async function getResourceApprovalStatus(
  type: ApprovalType,
  resourceId: string
): Promise<ApprovalStatus | null> {
  try {
    const [request] = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.type, type),
          eq(approvalRequests.resourceId, resourceId)
        )
      )
      .orderBy(desc(approvalRequests.createdAt))
      .limit(1);

    return request?.status || null;
  } catch (error) {
    console.error('[ApprovalService] getResourceApprovalStatus error:', error);
    return null;
  }
}
