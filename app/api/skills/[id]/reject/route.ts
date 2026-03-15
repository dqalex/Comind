/**
 * Skill 审批拒绝 API
 * 
 * POST /api/skills/[id]/reject - 审批拒绝 Skill（管理员）
 * 
 * 权限：仅管理员
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, approvalRequests, approvalHistories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { generateId } from '@/lib/id';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/[id]/reject - 审批拒绝
 * 
 * 请求体:
 * {
 *   note?: string; // 拒绝原因
 * }
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    // 仅管理员可操作
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can reject skills' },
        { status: 403 }
      );
    }
    
    const { id } = await context!.params;
    const body = await request.json();
    const { note } = body || {};
    
    // 检查 Skill 是否存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skill = existing[0];
    
    // 状态检查：仅 pending_approval 状态可审批
    if (skill.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Skill is not pending approval' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    
    // 查找关联的审批请求
    const [approvalRequest] = await db
      .select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.resourceId, id),
        eq(approvalRequests.status, 'pending')
      ))
      .limit(1);
    
    // 更新 Skill 状态
    await db
      .update(skills)
      .set({
        status: 'rejected',
        updatedAt: now,
      })
      .where(eq(skills.id, id));
    
    // 更新审批请求
    if (approvalRequest) {
      await db
        .update(approvalRequests)
        .set({
          status: 'rejected',
          rejectedBy: auth.userId,
          rejectionNote: note || null,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, approvalRequest.id));
      
      // 创建审批历史（外键可能指向 members 表，容错处理）
      try {
        await db.insert(approvalHistories).values({
          id: generateId(),
          requestId: approvalRequest.id,
          action: 'rejected',
          operatorId: auth.userId!,
          previousStatus: 'pending',
          newStatus: 'rejected',
          note: note || null,
          createdAt: now,
        });
      } catch (historyErr) {
        console.warn('[Skill Reject] Failed to insert approval history:', historyErr);
      }
    }
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { status: 'rejected', reason: note },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId: id,
        status: 'rejected',
      },
      message: 'Skill rejected',
    });
    
  } catch (error) {
    console.error('Error rejecting skill:', error);
    return NextResponse.json(
      { error: 'Failed to reject skill' },
      { status: 500 }
    );
  }
});
