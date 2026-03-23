import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { openclawStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateStatusId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_OPENCLAW_STATUS } from '@/lib/validators';
import { withAuth } from '@/lib/with-auth';

// GET - 获取所有 OpenClaw 状态
export async function GET() {
  try {
    const status = await db.select().from(openclawStatus);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

// POST - 创建或更新状态
// v0.9.8: 需要登录才能操作
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { memberId, ...data } = body;

    if (!memberId) {
      return NextResponse.json({ error: 'Missing required field: memberId' }, { status: 400 });
    }

    if (data.status !== undefined) {
      if (!validateEnum(data.status, VALID_OPENCLAW_STATUS)) {
        return NextResponse.json({ error: `status must be one of ${VALID_OPENCLAW_STATUS.join('/')}` }, { status: 400 });
      }
    }

    const allowedFields = [
      'status', 'currentTaskId', 'currentTaskTitle', 'currentAction',
      'progress', 'startedAt', 'estimatedEndAt', 'nextTaskId',
      'nextTaskTitle', 'queuedTasks', 'interruptible', 'doNotDisturbReason', 'lastHeartbeat'
    ];
    const safeData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        // progress 范围校验：0-100
        if (field === 'progress' && typeof data[field] === 'number') {
          safeData[field] = Math.min(100, Math.max(0, data[field]));
        } else {
          safeData[field] = data[field];
        }
      }
    }

    const dateFields = ['startedAt', 'estimatedEndAt', 'lastHeartbeat'];
    for (const field of dateFields) {
      if (safeData[field] && typeof safeData[field] === 'string') {
        safeData[field] = new Date(safeData[field] as string);
      }
    }

    const existing = await db
      .select()
      .from(openclawStatus)
      .where(eq(openclawStatus.memberId, memberId))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      const [updated] = await db
        .update(openclawStatus)
        .set({
          ...safeData,
          updatedAt: now,
        })
        .where(eq(openclawStatus.memberId, memberId))
        .returning();
      eventBus.emit({ type: 'openclaw_status', resourceId: memberId });
      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(openclawStatus)
        .values({
          id: generateStatusId(),
          memberId,
          ...safeData,
          createdAt: now,
          updatedAt: now,
        } as any)
        .returning();
      eventBus.emit({ type: 'openclaw_status', resourceId: memberId });
      return NextResponse.json(created);
    }
  } catch {
    return NextResponse.json({ error: 'Failed to create/update status' }, { status: 500 });
  }
});
