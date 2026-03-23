import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { comments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// GET /api/comments/[id] - 获取单条评论
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    return NextResponse.json(comment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 });
  }
}

// DELETE /api/comments/[id] - 删除评论
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(comments).where(eq(comments.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    await db.delete(comments).where(eq(comments.id, id));
    // 发出 comment_update 事件，让前端自动刷新评论
    eventBus.emit({ type: 'comment_update', resourceId: existing.taskId, data: { taskId: existing.taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
