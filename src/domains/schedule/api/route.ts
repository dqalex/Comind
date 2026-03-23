import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { scheduledTasks, scheduledTaskHistory, tasks } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { generateScheduleId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_TYPE, VALID_SCHEDULE_TYPE } from '@/lib/validators';
import { withAuth, withAdminAuth } from '@/lib/with-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

// GET - 获取所有定时任务
// v3.0: 需要登录才能访问（只读）
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    let tasks;
    if (memberId) {
      tasks = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.memberId, memberId));
    } else {
      tasks = await db.select().from(scheduledTasks);
    }

    if (includeHistory && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const allHistory = await db
        .select()
        .from(scheduledTaskHistory)
        .where(inArray(scheduledTaskHistory.scheduledTaskId, taskIds))
        .orderBy(desc(scheduledTaskHistory.startedAt));

      const historyByTask: Record<string, typeof allHistory> = {};
      for (const h of allHistory) {
        if (!historyByTask[h.scheduledTaskId]) historyByTask[h.scheduledTaskId] = [];
        if (historyByTask[h.scheduledTaskId].length < 10) {
          historyByTask[h.scheduledTaskId].push(h);
        }
      }

      const tasksWithHistory = tasks.map(task => ({
        ...task,
        history: historyByTask[task.id] || [],
      }));
      return NextResponse.json(tasksWithHistory);
    }

    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch scheduled tasks' }, { status: 500 });
  }
});

// POST - 创建定时任务
// v3.0: Admin Only - 只有管理员可以创建定时任务
export const POST = withAdminAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    if (!body.memberId || !body.title || !body.taskType || !body.scheduleType) {
      return errorResponse(ApiErrors.badRequest('Missing required fields: memberId, title, taskType, scheduleType'), requestId);
    }

    if (!validateEnum(body.taskType, VALID_TASK_TYPE)) {
      return errorResponse(ApiErrors.badRequest(`taskType must be one of ${VALID_TASK_TYPE.join('/')}`), requestId);
    }
    if (!validateEnum(body.scheduleType, VALID_SCHEDULE_TYPE)) {
      return errorResponse(ApiErrors.badRequest(`scheduleType must be one of ${VALID_SCHEDULE_TYPE.join('/')}`), requestId);
    }

    const now = new Date();
    const allowedFields = [
      'memberId', 'title', 'description', 'taskType', 'scheduleType',
      'scheduleTime', 'scheduleDays', 'nextRunAt', 'config', 'enabled'
    ];
    const values: Record<string, unknown> = { id: generateScheduleId(), createdAt: now, updatedAt: now };
    for (const field of allowedFields) {
      if (body[field] !== undefined) values[field] = body[field];
    }

    if (values.nextRunAt && typeof values.nextRunAt === 'string') {
      values.nextRunAt = new Date(values.nextRunAt);
    }

    const [task] = await db
      .insert(scheduledTasks)
      .values(values as any)
      .returning();

    eventBus.emit({ type: 'schedule_update', resourceId: task.id });
    return createdResponse(task);
  } catch (error) {
    console.error(`[POST /api/scheduled-tasks] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create scheduled task'), requestId);
  }
});
