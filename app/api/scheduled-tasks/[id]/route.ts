import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTasks, scheduledTaskHistory } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { eq, desc } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_TYPE, VALID_SCHEDULE_TYPE, VALID_LAST_RUN_STATUS } from '@/lib/validators';
import { withAuth, withAdminAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';

// GET - 获取单个定时任务
// v0.9.8: 需要登录才能访问（只读）
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const [task] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, id));

    if (!task) {
      return NextResponse.json({ error: 'Scheduled task not found' }, { status: 404 });
    }

    const history = await db
      .select()
      .from(scheduledTaskHistory)
      .where(eq(scheduledTaskHistory.scheduledTaskId, id))
      .orderBy(desc(scheduledTaskHistory.startedAt))
      .limit(30);

    return NextResponse.json({ ...task, history });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scheduled task' }, { status: 500 });
  }
});

// PUT - 更新定时任务
// v0.9.8: Admin Only - 只有管理员可以修改定时任务
export const PUT = withAdminAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Scheduled task not found' }, { status: 404 });
    }

    if (body.taskType && !validateEnum(body.taskType, VALID_TASK_TYPE)) {
      return NextResponse.json({ error: `taskType must be one of ${VALID_TASK_TYPE.join('/')}` }, { status: 400 });
    }
    if (body.scheduleType && !validateEnum(body.scheduleType, VALID_SCHEDULE_TYPE)) {
      return NextResponse.json({ error: `scheduleType must be one of ${VALID_SCHEDULE_TYPE.join('/')}` }, { status: 400 });
    }
    if (body.lastRunStatus && !validateEnum(body.lastRunStatus, VALID_LAST_RUN_STATUS)) {
      return NextResponse.json({ error: `lastRunStatus must be one of ${VALID_LAST_RUN_STATUS.join('/')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = [
      'title', 'description', 'taskType', 'scheduleType',
      'scheduleTime', 'scheduleDays', 'nextRunAt', 'config',
      'enabled', 'lastRunAt', 'lastRunStatus', 'lastRunResult',
      'memberId'
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const dateFields = ['nextRunAt', 'lastRunAt'];
    for (const field of dateFields) {
      if (updateData[field] && typeof updateData[field] === 'string') {
        updateData[field] = new Date(updateData[field] as string);
      }
    }

    const [task] = await db
      .update(scheduledTasks)
      .set(updateData)
      .where(eq(scheduledTasks.id, id))
      .returning();

    eventBus.emit({ type: 'schedule_update', resourceId: task.id });
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: 'Failed to update scheduled task' }, { status: 500 });
  }
});

// DELETE - 删除定时任务
// v0.9.8: Admin Only - 只有管理员可以删除定时任务
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Scheduled task not found' }, { status: 404 });
    }
    
    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.delete(scheduledTaskHistory).where(eq(scheduledTaskHistory.scheduledTaskId, id)).run();
      tx.delete(scheduledTasks).where(eq(scheduledTasks.id, id)).run();
    });

    eventBus.emit({ type: 'schedule_update', resourceId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/scheduled-tasks]', err);
    return NextResponse.json({ error: 'Failed to delete scheduled task' }, { status: 500 });
  }
});
