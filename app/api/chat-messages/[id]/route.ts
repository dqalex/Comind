import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { validateEnum, VALID_MESSAGE_STATUS } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// PUT /api/chat-messages/[id] - 更新消息（状态等）
// v0.9.8: 严格用户隔离 - 只能更新自己会话中的消息
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    const [existing] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 用户隔离：验证消息所属的会话是否属于当前用户
    const [session] = await db.select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, existing.sessionId), eq(chatSessions.userId, auth.userId!)));
    
    if (!session) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['status', 'content'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'status') {
          const validStatus = validateEnum(body.status, VALID_MESSAGE_STATUS);
          if (!validStatus) {
            return NextResponse.json({ error: `status must be one of: ${VALID_MESSAGE_STATUS.join('/')}` }, { status: 400 });
          }
          updateData.status = validStatus;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    await db.update(chatMessages).set(updateData).where(eq(chatMessages.id, id));
    const [updated] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: existing.sessionId });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/chat-messages]', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
});
