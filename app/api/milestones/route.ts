import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { milestones, type NewMilestone, type Milestone } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { generateMilestoneId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
// VALID_MILESTONE_STATUS removed - not used
import { isValidId } from '@/lib/security';
import { withAuth } from '@/lib/with-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';
import { createMilestoneSchema, validate } from '@/lib/validation';

// 分页配置
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * 获取分页参数
 */
function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10))
  );
  return { page, limit, offset: (page - 1) * limit };
}

// GET /api/milestones - 获取里程碑列表（支持分页）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  try {
    const { page, limit, offset } = getPaginationParams(searchParams);

    // 验证 projectId 格式
    if (projectId && !isValidId(projectId)) {
      return NextResponse.json(
        { error: 'Invalid projectId format' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const whereCondition = projectId ? eq(milestones.projectId, projectId) : undefined;

    // 获取总数量
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(milestones)
      .where(whereCondition || sql`1=1`);

    // 分页查询
    const data = await db
      .select()
      .from(milestones)
      .where(whereCondition || sql`1=1`)
      .orderBy(desc(milestones.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasMore: offset + data.length < count,
      },
    });
  } catch (error) {
    console.error('[GET /api/milestones] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}

// POST /api/milestones - 创建里程碑
// v0.9.8: 需要登录才能创建
export const POST = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    // Zod schema validation
    const validation = validate(createMilestoneSchema, body);
    if (!validation.success) {
      return errorResponse(ApiErrors.badRequest(validation.error), requestId);
    }

    const data = validation.data;

    const newMilestone: NewMilestone = {
      id: generateMilestoneId(),
      title: data.title,
      description: data.description || null,
      projectId: data.projectId,
      status: data.status,
      dueDate: data.dueDate || null,
      sortOrder: data.sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(milestones).values(newMilestone);
    const [created] = await db.select().from(milestones).where(eq(milestones.id, newMilestone.id));
    eventBus.emit({ type: 'milestone_update', resourceId: newMilestone.id });
    return createdResponse(created || newMilestone);
  } catch (error) {
    console.error(`[POST /api/milestones] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create milestone'), requestId);
  }
});
