import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq, asc, and } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// GET /api/chat-sessions/[id] - 获取单个会话（含所有消息）
// v0.9.8: 严格用户隔离 - 只能访问自己的会话
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    
    // 用户隔离：只能查询自己的会话
    const [session] = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, auth.userId!)));
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({ ...session, messages });
  } catch (error) {
    console.error('[GET /api/chat-sessions]', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
});

// PUT /api/chat-sessions/[id] - 更新会话
// v0.9.8: 严格用户隔离 - 只能更新自己的会话
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    // 用户隔离：只能更新自己的会话
    const [existing] = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, auth.userId!)));
    
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = ['title', 'conversationId'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    await db.update(chatSessions).set(updateData).where(eq(chatSessions.id, id));
    const [updated] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/chat-sessions]', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
});

// DELETE /api/chat-sessions/[id] - 删除会话（级联删除消息）
// v0.9.8: 严格用户隔离 - 只能删除自己的会话
export const DELETE = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    
    // 用户隔离：只能删除自己的会话
    const [existing] = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, auth.userId!)));
    
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.delete(chatMessages).where(eq(chatMessages.sessionId, id)).run();
      tx.delete(chatSessions).where(eq(chatSessions.id, id)).run();
    });

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/chat-sessions]', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
});
