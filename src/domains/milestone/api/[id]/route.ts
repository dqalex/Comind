import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { milestones, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_MILESTONE_STATUS } from '@/lib/validators';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// GET /api/milestones/[id] - 获取单个里程碑
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id));
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    return NextResponse.json(milestone);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch milestone' }, { status: 500 });
  }
}

// PUT /api/milestones/[id] - 更新里程碑
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    if (body.status && !validateEnum(body.status, VALID_MILESTONE_STATUS)) {
      return NextResponse.json({ error: `status must be one of ${VALID_MILESTONE_STATUS.join('/')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = ['title', 'description', 'status', 'dueDate', 'sortOrder', 'knowledgeConfig'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'knowledgeConfig') {
          updateData.knowledge_config = body.knowledgeConfig;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (updateData.dueDate && typeof updateData.dueDate === 'string') {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    await db.update(milestones).set(updateData).where(eq(milestones.id, id));
    const [updated] = await db.select().from(milestones).where(eq(milestones.id, id));
    eventBus.emit({ type: 'milestone_update', resourceId: id });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

// DELETE /api/milestones/[id] - 删除里程碑（解除关联任务）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // 解除关联任务的 milestoneId
    db.transaction((tx) => {
      tx.update(tasks)
        .set({ milestoneId: null, updatedAt: new Date() })
        .where(eq(tasks.milestoneId, id)).run();
      tx.delete(milestones).where(eq(milestones.id, id)).run();
    });

    eventBus.emit({ type: 'milestone_update', resourceId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/milestones]', error);
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}
