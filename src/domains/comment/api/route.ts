import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { comments, tasks } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { generateCommentId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

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

// GET /api/comments - 获取评论（按任务ID过滤，支持分页）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  try {
    const { page, limit, offset } = getPaginationParams(searchParams);

    // 构建查询条件
    const whereCondition = taskId ? eq(comments.taskId, taskId) : undefined;

    // 获取总数量
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(whereCondition || sql`1=1`);

    // 分页查询
    const data = await db
      .select()
      .from(comments)
      .where(whereCondition || sql`1=1`)
      .orderBy(desc(comments.createdAt))
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
    console.error('[GET /api/comments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments - 创建评论
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();
    const { taskId, memberId, content } = body;

    if (!taskId || !content) {
      return errorResponse(ApiErrors.badRequest('taskId and content are required'), requestId);
    }

    // 校验 taskId 存在
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return errorResponse(ApiErrors.notFound('Related task'), requestId);
    }

    const now = new Date();
    const newComment = {
      id: generateCommentId(),
      taskId,
      memberId: memberId || 'system',
      content,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(comments).values(newComment);
    // 发出 comment_update 事件，让前端自动刷新评论
    eventBus.emit({ type: 'comment_update', resourceId: taskId, data: { taskId } });
    triggerMarkdownSync('teamclaw:tasks');
    return createdResponse(newComment);
  } catch (error) {
    console.error(`[POST /api/comments] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create comment'), requestId);
  }
}
