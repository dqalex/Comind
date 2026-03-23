import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { generateMessageId, generateId } from '@/lib/id';
import { VALID_CHAT_ROLE, VALID_MESSAGE_STATUS, validateEnum, validateEnumWithDefault } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// POST /api/chat-messages - 添加消息到会话
// v0.9.8: 严格用户隔离 - 只能向自己的会话添加消息
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();
    const { sessionId, role, content, status } = body;

    if (!sessionId || !role) {
      return errorResponse(ApiErrors.badRequest('sessionId and role are required'), requestId);
    }

    // 用户隔离：检查 session 是否存在且属于当前用户
    const [session] = await db.select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, auth.userId!)));
    
    if (!session) {
      return errorResponse(ApiErrors.notFound('Session'), requestId);
    }

    // content 允许空字符串（assistant 消息初始化时为空，后续通过 PUT 更新）
    if (content === undefined || content === null) {
      return errorResponse(ApiErrors.badRequest('content is required'), requestId);
    }

    if (!validateEnum(role, VALID_CHAT_ROLE)) {
      return errorResponse(ApiErrors.badRequest(`role must be one of: ${VALID_CHAT_ROLE.join('/')}`), requestId);
    }

    const validStatus = validateEnumWithDefault(status, VALID_MESSAGE_STATUS, 'sent');

    const now = new Date();
    const id = generateMessageId();

    await db.insert(chatMessages).values({
      id,
      sessionId,
      role,
      content,
      status: validStatus,
      createdAt: now,
    });

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (role === 'user') {
      // 使用 COUNT 查询替代全量查询，避免 N+1 问题
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId));
      const messageCount = Number(countResult.count);
      // 如果这是第一条用户消息，用消息内容前30字符作为会话标题
      if (messageCount <= 1) {
        updateData.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      }
    }
    await db.update(chatSessions).set(updateData).where(eq(chatSessions.id, sessionId));

    const created = await db.select().from(chatMessages).where(eq(chatMessages.id, id));

    // 发送 SSE 事件通知前端刷新对话列表（消息添加后会话 updatedAt 会更新）
    eventBus.emit({ type: 'chat_session_update', resourceId: sessionId });

    return createdResponse(created[0]);
  } catch (error) {
    console.error(`[POST /api/chat-messages] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create message'), requestId);
  }
});
