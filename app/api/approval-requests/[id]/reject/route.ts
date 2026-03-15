/**
 * 拒绝审批请求 API
 * 
 * POST /api/approval-requests/[id]/reject - 拒绝审批请求
 */

import { db } from '@/db';
import { approvalRequests, approvalHistories } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';

// POST /api/approval-requests/[id]/reject - 拒绝审批请求
export const POST = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      // 权限检查：仅管理员可拒绝
      if (auth.userRole !== 'admin') {
        return NextResponse.json({ error: 'Only admin can reject requests' }, { status: 403 });
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
          status: 'rejected',
          rejectedBy: auth.userId!,
          rejectionNote: note,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, id));

      // 记录历史（外键可能指向 members 表，容错处理）
      try {
        await db.insert(approvalHistories).values({
          id: generateId(),
          requestId: id,
          action: 'rejected',
          operatorId: auth.userId!,
          previousStatus: 'pending',
          newStatus: 'rejected',
          note,
          createdAt: now,
        });
      } catch (historyErr) {
        console.warn('[Approval API] Failed to insert rejection history:', historyErr);
      }

      // 触发 SSE 事件
      eventBus.emit({
        type: 'approval_request_rejected',
        resourceId: id,
        data: {
          type: approvalRequest.type,
          resourceId: approvalRequest.resourceId,
          requesterId: approvalRequest.requesterId,
        },
      });

      return successResponse({ success: true });
    } catch (error) {
      console.error('[Approval API] Reject error:', error);
      return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }
  }
);
