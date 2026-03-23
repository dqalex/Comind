import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { scheduledTaskHistory, scheduledTasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateScheduleHistoryId } from '@/lib/id';
import { validateEnum, VALID_HISTORY_STATUS, VALID_DELIVERABLE_TYPE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';

// GET /api/scheduled-task-history - 获取执行历史
// v0.9.8: 需要登录才能访问
export const GET = withAuth(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const scheduledTaskId = searchParams.get('scheduledTaskId');
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 200) : 50;

  try {
    let result;
    if (scheduledTaskId) {
      result = await db.select().from(scheduledTaskHistory)
        .where(eq(scheduledTaskHistory.scheduledTaskId, scheduledTaskId))
        .orderBy(desc(scheduledTaskHistory.startedAt))
        .limit(limit);
    } else {
      result = await db.select().from(scheduledTaskHistory)
        .orderBy(desc(scheduledTaskHistory.startedAt))
        .limit(limit);
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch execution history' }, { status: 500 });
  }
});

// POST /api/scheduled-task-history - 创建执行历史记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduledTaskId, status, result, error: errorMsg, deliverableType, deliverableUrl, deliverableTitle } = body;

    if (!scheduledTaskId || !status) {
      return NextResponse.json({ error: 'scheduledTaskId and status are required' }, { status: 400 });
    }

    // 外键校验：检查定时任务是否存在
    const [task] = await db.select({ id: scheduledTasks.id }).from(scheduledTasks).where(eq(scheduledTasks.id, scheduledTaskId));
    if (!task) {
      return NextResponse.json({ error: 'Related scheduled task not found' }, { status: 404 });
    }

    if (!validateEnum(status, VALID_HISTORY_STATUS)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_HISTORY_STATUS.join('/')}` }, { status: 400 });
    }

    const newHistory = {
      id: generateScheduleHistoryId(),
      scheduledTaskId,
      startedAt: new Date(),
      completedAt: status !== 'running' ? new Date() : null,
      status,
      result: result || null,
      error: errorMsg || null,
      deliverableType: deliverableType ? (validateEnum(deliverableType, VALID_DELIVERABLE_TYPE) || null) : null,
      deliverableUrl: deliverableUrl || null,
      deliverableTitle: deliverableTitle || null,
      createdAt: new Date(),
    };

    await db.insert(scheduledTaskHistory).values(newHistory);
    // 问题 #20：创建历史后通知前端刷新
    eventBus.emit({ type: 'schedule_update', resourceId: scheduledTaskId });
    return NextResponse.json(newHistory, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create execution history' }, { status: 500 });
  }
}
