/**
 * 审批请求 API
 * 
 * GET  /api/approval-requests - 获取审批请求列表
 * POST /api/approval-requests - 创建审批请求
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { withAuth, type AuthResult } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import {
  successResponse,
  createdResponse,
} from '@/lib/api-route-factory';
import {
  getApprovalRequests,
  createApprovalRequest,
  type ApprovalType,
} from '@/lib/services/approval-service';

// GET /api/approval-requests - 获取审批请求列表
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as ApprovalType | null;
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | null;
  const requesterId = searchParams.get('requesterId');
  const resourceId = searchParams.get('resourceId');

  // 权限过滤：普通用户只能看自己的申请，管理员可以看全部
  const filters: Parameters<typeof getApprovalRequests>[0] = {};

  if (auth.userRole !== 'admin') {
    filters.requesterId = auth.userId!;
  }
  if (type) {
    filters.type = type;
  }
  if (status) {
    filters.status = status;
  }
  if (requesterId && isValidId(requesterId)) {
    filters.requesterId = requesterId;
  }
  if (resourceId && isValidId(resourceId)) {
    filters.resourceId = resourceId;
  }

  const result = await getApprovalRequests(filters);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return successResponse({ requests: result.data!.requests });
});

// POST /api/approval-requests - 创建审批请求
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    const body = await request.json();
    const { type, resourceType, resourceId, payload, requestNote, expiresAt } = body;

    // 参数校验
    if (!type || !resourceType || !resourceId) {
      return NextResponse.json({ error: 'Missing required fields: type, resourceType, resourceId' }, { status: 400 });
    }

    if (!isValidId(resourceId)) {
      return NextResponse.json({ error: 'Invalid resourceId format' }, { status: 400 });
    }

    const result = await createApprovalRequest({
      type,
      resourceType,
      resourceId,
      requesterId: auth.userId!,
      payload,
      requestNote,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return createdResponse({ request: result.data!.request });
  } catch (error) {
    console.error('[Approval API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
  }
});
