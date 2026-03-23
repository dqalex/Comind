import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { generateSessionId, generateId } from '@/lib/id';
import { validateEnum, VALID_ENTITY_TYPE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';
import { createChatSessionSchema, validate } from '@/lib/validation';

// GET /api/chat-sessions - 获取所有会话（支持分页）
// v0.9.8: 严格用户隔离 - 只返回当前用户的聊天记录
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
    const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

    // 用户隔离条件：只查询当前用户的会话
    const userFilter = eq(chatSessions.userId, auth.userId!);

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(chatSessions)
        .where(userFilter)
        .orderBy(desc(chatSessions.updatedAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(chatSessions)
        .where(userFilter);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    const sessions = await db.select().from(chatSessions)
      .where(userFilter)
      .orderBy(desc(chatSessions.updatedAt));
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('[GET /api/chat-sessions]', error);
    return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 });
  }
});

// POST /api/chat-sessions - 创建新会话
// v0.9.8: 严格用户隔离 - 强制绑定当前用户
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    // Zod schema validation
    const validation = validate(createChatSessionSchema, body);
    if (!validation.success) {
      return errorResponse(ApiErrors.badRequest(validation.error), requestId);
    }

    const data = validation.data;

    const now = new Date();
    const id = generateSessionId();

    await db.insert(chatSessions).values({
      id,
      memberId: data.memberId,
      memberName: data.memberName,
      userId: auth.userId!, // 强制绑定当前用户
      title: data.title || '新对话',
      entityType: data.entity?.type ? (validateEnum(data.entity.type, VALID_ENTITY_TYPE) || null) : null,
      entityId: data.entity?.id || null,
      entityTitle: data.entity?.title || null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db.select().from(chatSessions).where(eq(chatSessions.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return createdResponse(created[0]);
  } catch (error) {
    console.error(`[POST /api/chat-sessions] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create chat session'), requestId);
  }
});
