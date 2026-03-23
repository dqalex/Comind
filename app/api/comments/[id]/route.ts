import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { comments, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { checkProjectAccess } from '@/shared/lib/project-access';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// GET /api/comments/[id] - 获取单条评论
// v0.9.8: 添加权限校验
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
) => {
  try {
    const { id } = await context!.params;
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // 权限校验：检查项目访问权限（通过关联任务）
    if (comment.taskId) {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, comment.taskId));
      if (task?.projectId) {
        const access = await checkProjectAccess(task.projectId, auth.userId!, auth.userRole!);
        if (!access.hasAccess) {
          return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }
      }
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error('[GET /api/comments]', error);
    return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 });
  }
});

// DELETE /api/comments/[id] - 删除评论
// 需要登录，只能删除自己的评论或管理员可删除任意评论
export const DELETE = withAuth(async (
  _request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
) => {
  try {
    const { id } = await context!.params;
    const [existing] = await db.select().from(comments).where(eq(comments.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // 权限检查：只能删除自己的评论或管理员可删除任意评论
    if (existing.memberId !== auth.userId && auth.userRole !== 'admin') {
      return NextResponse.json({ error: 'No permission to delete this comment' }, { status: 403 });
    }

    await db.delete(comments).where(eq(comments.id, id));
    // 发出 comment_update 事件，让前端自动刷新评论
    eventBus.emit({ type: 'comment_update', resourceId: existing.taskId, data: { taskId: existing.taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/comments]', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
});
