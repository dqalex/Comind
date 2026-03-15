/**
 * 批准审批请求 API
 * 
 * POST /api/approval-requests/[id]/approve - 批准审批请求
 */

import { db } from '@/db';
import { approvalRequests, approvalHistories, skills } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';
import { getServerGatewayClient } from '@/lib/server-gateway-client';
import { RPC_METHODS } from '@/lib/rpc-methods';

// POST /api/approval-requests/[id]/approve - 批准审批请求
export const POST = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      // 权限检查：仅管理员可批准
      if (auth.userRole !== 'admin') {
        return NextResponse.json({ error: 'Only admin can approve requests' }, { status: 403 });
      }

      if (!isValidId(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
      }

      const body = await request.json();
      const { note } = body;

      // 获取审批请求
      const [approvalRequest] = await db.select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, id));

      if (!approvalRequest) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      if (approvalRequest.status !== 'pending') {
        return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
      }

      const now = new Date();

      // 更新审批请求状态
      await db.update(approvalRequests)
        .set({
          status: 'approved',
          approvedBy: auth.userId!,
          approvalNote: note,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, id));

      // 记录历史（外键可能指向 members 表，容错处理）
      try {
        await db.insert(approvalHistories).values({
          id: generateId(),
          requestId: id,
          action: 'approved',
          operatorId: auth.userId!,
          previousStatus: 'pending',
          newStatus: 'approved',
          note,
          createdAt: now,
        });
      } catch (historyErr) {
        // 历史记录插入失败（如外键约束）不应阻断主流程
        console.warn('[Approval API] Failed to insert approval history:', historyErr);
      }

      // 执行审批通过后的业务逻辑
      await executeApprovalAction(approvalRequest);

      // 触发 SSE 事件
      eventBus.emit({
        type: 'approval_request_approved',
        resourceId: id,
        data: {
          type: approvalRequest.type,
          resourceId: approvalRequest.resourceId,
          requesterId: approvalRequest.requesterId,
        },
      });

      return successResponse({ success: true });
    } catch (error) {
      console.error('[Approval API] Approve error:', error);
      return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
    }
  }
);

/**
 * 执行审批通过后的业务逻辑
 */
async function executeApprovalAction(request: typeof approvalRequests.$inferSelect): Promise<void> {
  switch (request.type) {
    case 'skill_publish': {
      // 检查 skill 是否存在
      const [skill] = await db.select()
        .from(skills)
        .where(eq(skills.id, request.resourceId));
      
      if (skill) {
        // 更新 Skill 状态为 active
        await db.update(skills)
          .set({
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(skills.id, request.resourceId));
      } else {
        console.warn(`[Approval] Skill not found: ${request.resourceId}, skipping status update`);
      }
      break;
    }
    
    case 'skill_install': {
      // 获取 Skill 信息
      const [skill] = await db.select()
        .from(skills)
        .where(eq(skills.id, request.resourceId));
      
      if (!skill) {
        throw new Error(`Skill not found: ${request.resourceId}`);
      }
      
      // 调用 Gateway 安装 Skill
      const payload = request.payload as { agentId?: string } | null;
      const agentId = payload?.agentId;
      if (!agentId) {
        throw new Error('agentId is required for skill_install');
      }
      
      const gatewayClient = getServerGatewayClient();
      if (gatewayClient.isConnected) {
        await gatewayClient.request(RPC_METHODS.SKILLS_INSTALL, { 
          name: agentId, 
          installId: skill.skillKey 
        });
      } else {
        console.warn('[Approval] Gateway client not connected, skipping skill installation');
      }
      
      // 更新 Skill 的 installedAgents 列表
      const currentAgents = skill.installedAgents || [];
      const updatedAgents = [...new Set([...currentAgents, agentId])];
      
      await db.update(skills)
        .set({
          installedAgents: updatedAgents,
          updatedAt: new Date(),
        })
        .where(eq(skills.id, request.resourceId));
      
      break;
    }
    
    case 'project_join': {
      // TODO: 实现项目成员添加逻辑
      console.log('[Approval] project_join not implemented yet');
      break;
    }
    
    default:
      console.warn(`[Approval] Unknown approval type: ${request.type}`);
  }
}
