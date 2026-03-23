import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTaskHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateEnum, VALID_HISTORY_STATUS } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// PUT /api/scheduled-task-history/[id] - 更新执行历史
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(scheduledTaskHistory).where(eq(scheduledTaskHistory.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['completedAt', 'status', 'result', 'error', 'deliverableType', 'deliverableUrl', 'deliverableTitle'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (updateData.status) {
      const validStatus = validateEnum(updateData.status, VALID_HISTORY_STATUS);
      if (!validStatus) {
        return NextResponse.json({ error: `status must be one of: ${VALID_HISTORY_STATUS.join('/')}` }, { status: 400 });
      }
      updateData.status = validStatus;
    }

    await db.update(scheduledTaskHistory).set(updateData).where(eq(scheduledTaskHistory.id, id));
    const [updated] = await db.select().from(scheduledTaskHistory).where(eq(scheduledTaskHistory.id, id));
    // 问题 #20：更新历史后通知前端刷新
    eventBus.emit({ type: 'schedule_update', resourceId: existing.scheduledTaskId });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update execution history' }, { status: 500 });
  }
}

// DELETE /api/scheduled-task-history/[id] - 删除单条执行历史
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(scheduledTaskHistory).where(eq(scheduledTaskHistory.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    await db.delete(scheduledTaskHistory).where(eq(scheduledTaskHistory.id, id));
    // 问题 #20：删除历史后通知前端刷新
    eventBus.emit({ type: 'schedule_update', resourceId: existing.scheduledTaskId });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete execution history' }, { status: 500 });
  }
}
