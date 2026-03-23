/**
 * 拒绝审批请求 API
 * 
 * POST /api/approval-requests/[id]/reject - 拒绝审批请求
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';
import { rejectApprovalRequest, canProcessApprovalRequest } from '@/lib/services/approval-service';

// POST /api/approval-requests/[id]/reject - 拒绝审批请求
export const POST = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      // 权限检查：仅管理员可拒绝
      if (!auth.userRole || !canProcessApprovalRequest(auth.userRole)) {
        return NextResponse.json({ error: 'Only admin can reject requests' }, { status: 403 });
      }

      if (!isValidId(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
      }

      const body = await request.json();
      const { note } = body;

      const result = await rejectApprovalRequest(id, auth.userId!, note);

      if (!result.success) {
        const status = result.error === 'Approval request not found' ? 404 : 400;
        return NextResponse.json({ error: result.error }, { status });
      }

      return successResponse({ success: true });
    } catch (error) {
      console.error('[Approval API] Reject error:', error);
      return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }
  }
);
