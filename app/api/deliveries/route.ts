import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { deliveries } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateDeliveryId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_DELIVERY_STATUS } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { withAuth } from '@/lib/with-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';
import { createDeliverySchema, validate } from '@/lib/validation';

// GET - 获取所有交付记录（支持分页）
// v0.9.8: 需要登录才能访问
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const status = searchParams.get('status');
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
    const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

    const conditions = [];
    if (memberId) {
      conditions.push(eq(deliveries.memberId, memberId));
    }
    if (status) {
      const validStatus = validateEnum(status, VALID_DELIVERY_STATUS);
      if (!validStatus) {
        return NextResponse.json({ error: `status must be one of ${VALID_DELIVERY_STATUS.join('/')}` }, { status: 400 });
      }
      conditions.push(eq(deliveries.status, validStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(deliveries)
        .where(whereClause)
        .orderBy(desc(deliveries.createdAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(deliveries).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    const allDeliveries = await db
      .select()
      .from(deliveries)
      .where(whereClause)
      .orderBy(desc(deliveries.createdAt));

    return NextResponse.json(allDeliveries);
  } catch (error) {
    console.error('[API] deliveries GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
});

// POST - 创建交付记录
// v0.9.8: 需要登录才能创建
export const POST = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    // Zod schema validation
    const validation = validate(createDeliverySchema, body);
    if (!validation.success) {
      return errorResponse(ApiErrors.badRequest(validation.error), requestId);
    }

    const data = validation.data;

    // 业务逻辑验证：local 平台需要 documentId
    if (data.platform === 'local' && !data.documentId) {
      return errorResponse(ApiErrors.badRequest('Local document delivery requires a documentId'), requestId);
    }
    // 业务逻辑验证：外部平台需要 externalUrl
    if (data.platform !== 'local' && !data.externalUrl) {
      return errorResponse(ApiErrors.badRequest('External document delivery requires an externalUrl'), requestId);
    }

    const now = new Date();
    const newDelivery = {
      id: generateDeliveryId(),
      memberId: data.memberId,
      taskId: data.taskId || null,
      documentId: data.documentId || null,
      title: data.title,
      description: data.description || null,
      platform: data.platform,
      externalUrl: data.externalUrl || null,
      externalId: data.externalId || null,
      status: data.status,
      reviewerId: data.reviewerId || null,
      reviewedAt: data.reviewedAt || null,
      reviewComment: data.reviewComment || null,
      version: data.version,
      previousDeliveryId: data.previousDeliveryId || null,
      createdAt: now,
      updatedAt: now,
    };

    const [delivery] = await db
      .insert(deliveries)
      .values(newDelivery as any)
      .returning();

    eventBus.emit({ type: 'delivery_update', resourceId: delivery.id });
    triggerMarkdownSync('teamclaw:deliveries');
    return createdResponse(delivery);
  } catch (error) {
    console.error(`[POST /api/deliveries] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create delivery'), requestId);
  }
});
