/**
 * 单个审批请求 API
 * 
 * GET /api/approval-requests/[id] - 获取审批请求详情
 */

import { db } from '@/db';
import { approvalRequests, approvalHistories } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { eq, desc } from 'drizzle-orm';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';

// GET /api/approval-requests/[id] - 获取审批请求详情
export const GET = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      if (!isValidId(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
      }

      // 获取审批请求
      const [approvalRequest] = await db.select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, id));

      if (!approvalRequest) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      // 权限检查：普通用户只能看自己的申请，管理员可以看全部
      if (auth.userRole !== 'admin' && approvalRequest.requesterId !== auth.userId) {
        return NextResponse.json({ error: 'No permission to view this request' }, { status: 403 });
      }

      // 获取审批历史
      const histories = await db.select()
        .from(approvalHistories)
        .where(eq(approvalHistories.requestId, id))
        .orderBy(desc(approvalHistories.createdAt));

      return successResponse({
        request: approvalRequest,
        histories,
      });
    } catch (error) {
      console.error('[Approval API] GET by ID error:', error);
      return NextResponse.json({ error: 'Failed to fetch approval request' }, { status: 500 });
    }
  }
);
