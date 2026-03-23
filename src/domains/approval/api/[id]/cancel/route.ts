/**
 * 取消审批请求 API
 * 
 * POST /api/approval-requests/[id]/cancel - 取消审批请求（申请人自己取消）
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';
import {
  cancelApprovalRequest,
  getApprovalRequestById,
} from '@/lib/services/approval-service';

// POST /api/approval-requests/[id]/cancel - 取消审批请求
export const POST = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      if (!isValidId(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
      }

      // 获取审批请求以检查权限
      const getResult = await getApprovalRequestById(id);
      if (!getResult.success) {
        return NextResponse.json({ error: getResult.error }, { status: 404 });
      }

      // 权限检查：只能取消自己的申请，管理员可以取消任何人的申请
      const approvalRequest = getResult.data!.request;
      if (approvalRequest.requesterId !== auth.userId && auth.userRole !== 'admin') {
        return NextResponse.json({ error: 'Cannot cancel others request' }, { status: 403 });
      }

      const body = await request.json();
      const { note } = body;

      const result = await cancelApprovalRequest(id, auth.userId!, note);

      if (!result.success) {
        const status = result.error === 'Approval request not found' ? 404 : 400;
        return NextResponse.json({ error: result.error }, { status });
      }

      return successResponse({ success: true });
    } catch (error) {
      console.error('[Approval API] Cancel error:', error);
      return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
    }
  }
);
