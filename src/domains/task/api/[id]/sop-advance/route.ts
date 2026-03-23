/**
 * SOP 阶段推进 API（人工操作）
 * 
 * POST /api/tasks/[id]/sop-advance
 * 
 * 支持操作：
 * - confirm: 确认当前阶段（waiting_confirm → completed → 下一阶段）
 * - reject: 驳回当前阶段（回退到 rollbackStageId 或上一个 ai_ 阶段）
 * - skip: 跳过当前阶段（仅 optional=true 的阶段）
 * - start: 启动 SOP 执行（将首个阶段标记为 active）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, sopTemplates, documents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { generateId } from '@/lib/id';
import type { SOPStage, StageRecord } from '@/db/schema';

type SopAction = 'confirm' | 'reject' | 'skip' | 'start';

 
type TxOrDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 为 render 阶段自动创建 visual 文档（支持事务上下文）
 * 参考 §5.5: AI 前序阶段产出 MD → 创建 visual 文档 → 关联渲染模板
 */
async function createRenderDocument(
  tx: TxOrDb,
  taskId: string,
  taskTitle: string,
  stage: SOPStage,
  previousOutput?: string,
  projectId?: string | null,
): Promise<string | null> {
  if (stage.type !== 'render') return null;

  const docId = generateId();
  const now = new Date();

  // 使用前序阶段产出作为初始 MD 内容，如果没有则使用空模板
  const initialContent = previousOutput || `# ${stage.label}\n\n`;

  await tx.insert(documents).values({
    id: docId,
    title: `[SOP] ${taskTitle} - ${stage.label}`,
    content: initialContent,
    type: 'report',
    source: 'local',
    renderMode: 'visual',
    renderTemplateId: stage.renderTemplateId || null,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  });

  return docId;
}

/**
 * 初始化阶段记录（支持事务上下文，统一处理 render 阶段的文档创建）
 */
async function initStageRecord(
  tx: TxOrDb,
  stage: SOPStage,
  taskId: string,
  taskTitle: string,
  nowStr: string,
  stageHistory: StageRecord[],
  projectId?: string | null,
): Promise<StageRecord> {
  // 获取前序阶段产出（最后一个 completed 的 output）
  const lastCompleted = [...stageHistory]
    .reverse()
    .find(r => r.status === 'completed' && r.output);

  const initialStatus = stage.type === 'input' ? 'waiting_input' : 'active';

  const record: StageRecord = {
    stageId: stage.id,
    status: initialStatus,
    startedAt: nowStr,
  };

  // render 阶段：自动创建 visual 文档
  if (stage.type === 'render') {
    const docId = await createRenderDocument(
      tx, taskId, taskTitle, stage, lastCompleted?.output, projectId,
    );
    if (docId) {
      record.renderDocumentId = docId;
    }
  }

  return record;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const { action, confirmedBy, sopInputs } = body as { action?: SopAction; confirmedBy?: string; sopInputs?: Record<string, string> };

  if (!action || !['confirm', 'reject', 'skip', 'start'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action, supported: confirm, reject, skip, start' }, { status: 400 });
  }

  // 查询任务
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!task.sopTemplateId) {
    return NextResponse.json({ error: 'Task is not bound to a SOP template' }, { status: 400 });
  }

  // 获取 SOP 模板
  const template = await db.query.sopTemplates.findFirst({
    where: eq(sopTemplates.id, task.sopTemplateId),
  });

  if (!template) {
    return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
  }

  const stages = template.stages as SOPStage[];
  const stageHistory = [...(task.stageHistory || [])] as StageRecord[];
  const now = new Date();
  const nowStr = now.toISOString();

  // === start: 启动 SOP ===
  if (action === 'start') {
    if (task.currentStageId && stageHistory.some(r => r.status === 'active' || r.status === 'waiting_input' || r.status === 'waiting_confirm')) {
      return NextResponse.json({ error: 'SOP is already in progress' }, { status: 400 });
    }

    const firstStage = stages[0];
    if (!firstStage) {
      return NextResponse.json({ error: 'SOP template has no stages' }, { status: 400 });
    }

    // 初始化第一阶段（事务保证文档创建+任务更新的原子性）
    let firstStageRecord: StageRecord = { stageId: firstStage.id, status: 'active', startedAt: nowStr };
    await db.transaction(async (tx) => {
      firstStageRecord = await initStageRecord(
        tx, firstStage, id, task.title, nowStr, stageHistory, task.projectId,
      );
      stageHistory.push(firstStageRecord);

      await tx.update(tasks).set({
        currentStageId: firstStage.id,
        stageHistory,
        status: task.status === 'todo' ? 'in_progress' : task.status,
        updatedAt: now,
      }).where(eq(tasks.id, id));
    });

    // 事务成功后发送事件
    if (firstStageRecord.renderDocumentId) {
      eventBus.emit({ type: 'document_update', resourceId: firstStageRecord.renderDocumentId });
    }
    eventBus.emit({ type: 'task_update', resourceId: id });

    return NextResponse.json({
      task_id: id,
      action: 'start',
      current_stage: firstStage.id,
      stage_status: firstStageRecord.status,
      render_document_id: firstStageRecord.renderDocumentId || null,
    });
  }

  // 后续操作都需要 currentStageId
  if (!task.currentStageId) {
    return NextResponse.json({ error: 'SOP has not started, please call start first' }, { status: 400 });
  }

  const currentIndex = stages.findIndex(s => s.id === task.currentStageId);
  if (currentIndex === -1) {
    return NextResponse.json({ error: 'Current stage does not exist in template' }, { status: 400 });
  }

  const currentStage = stages[currentIndex];
  const currentRecordIndex = stageHistory.findIndex(r => r.stageId === task.currentStageId);

  // === confirm: 确认当前阶段 ===
  if (action === 'confirm') {
    // input 阶段：保存用户输入到 sopInputs（合并已有数据）
    const mergedSopInputs = sopInputs
      ? { ...(task.sopInputs as Record<string, unknown> || {}), ...sopInputs }
      : (task.sopInputs || undefined);

    // 完成当前阶段（input 阶段将用户输入作为 output）
    const inputOutputText = sopInputs
      ? Object.entries(sopInputs).map(([k, v]) => `${k}: ${v}`).join('\n')
      : undefined;
    const completedRecord: StageRecord = {
      ...(currentRecordIndex >= 0 ? stageHistory[currentRecordIndex] : { stageId: task.currentStageId! }),
      status: 'completed',
      completedAt: nowStr,
      confirmedBy: confirmedBy || 'human',
      ...(inputOutputText ? { output: inputOutputText, outputType: 'text' } : {}),
    };

    if (currentRecordIndex >= 0) {
      stageHistory[currentRecordIndex] = completedRecord;
    } else {
      stageHistory.push(completedRecord);
    }

    // 推进到下一阶段
    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= stages.length;
    const nextStageId = isCompleted ? null : stages[nextIndex].id;

    // 初始化下一阶段记录（事务保证文档创建+任务更新的原子性）
    let nextRenderDocId: string | null = null;
    await db.transaction(async (tx) => {
      if (!isCompleted && nextStageId) {
        const nextStage = stages[nextIndex];
        const nextRecord = await initStageRecord(
          tx, nextStage, id, task.title, nowStr, stageHistory, task.projectId,
        );
        stageHistory.push(nextRecord);
        nextRenderDocId = nextRecord.renderDocumentId || null;
      }

      await tx.update(tasks).set({
        currentStageId: nextStageId,
        stageHistory,
        ...(mergedSopInputs ? { sopInputs: mergedSopInputs } : {}),
        status: isCompleted ? 'reviewing' : task.status === 'todo' ? 'in_progress' : task.status,
        progress: Math.round(((currentIndex + 1) / stages.length) * 100),
        updatedAt: now,
      }).where(eq(tasks.id, id));
    });

    // 事务成功后发送事件
    if (nextRenderDocId) {
      eventBus.emit({ type: 'document_update', resourceId: nextRenderDocId });
    }
    eventBus.emit({ type: 'task_update', resourceId: id });

    return NextResponse.json({
      task_id: id,
      action: 'confirm',
      completed_stage: task.currentStageId,
      next_stage: nextStageId,
      is_sop_completed: isCompleted,
      progress: Math.round(((currentIndex + 1) / stages.length) * 100),
      render_document_id: nextRenderDocId,
    });
  }

  // === reject: 驳回当前阶段 ===
  if (action === 'reject') {
    // 确定回退目标
    const rollbackTargetId = currentStage.rollbackStageId || findPreviousAiStageId(stages, currentIndex);

    if (!rollbackTargetId) {
      return NextResponse.json({ error: 'Cannot rollback: no stages available to rollback to' }, { status: 400 });
    }

    const rollbackIndex = stages.findIndex(s => s.id === rollbackTargetId);
    if (rollbackIndex === -1) {
      return NextResponse.json({ error: 'Rollback target stage does not exist' }, { status: 400 });
    }

    // 标记当前阶段为失败
    if (currentRecordIndex >= 0) {
      stageHistory[currentRecordIndex] = {
        ...stageHistory[currentRecordIndex],
        status: 'failed',
        completedAt: nowStr,
      };
    }

    // 重置回退目标及之后的阶段状态
    for (let i = 0; i < stageHistory.length; i++) {
      const stageIdx = stages.findIndex(s => s.id === stageHistory[i].stageId);
      if (stageIdx >= rollbackIndex && stageHistory[i].stageId !== task.currentStageId) {
        stageHistory[i] = {
          ...stageHistory[i],
          status: 'pending',
          completedAt: undefined,
          confirmedBy: undefined,
          retryCount: (stageHistory[i].retryCount || 0) + 1,
        };
      }
    }

    // 设置回退目标为 active（input 阶段设为 waiting_input）
    const rollbackStage = stages[rollbackIndex];
    const rollbackStatus = rollbackStage.type === 'input' ? 'waiting_input' : 'active';
    const rollbackRecordIndex = stageHistory.findIndex(r => r.stageId === rollbackTargetId);
    if (rollbackRecordIndex >= 0) {
      stageHistory[rollbackRecordIndex] = {
        ...stageHistory[rollbackRecordIndex],
        status: rollbackStatus,
        startedAt: nowStr,
        completedAt: undefined,
      };
    } else {
      stageHistory.push({
        stageId: rollbackTargetId,
        status: rollbackStatus,
        startedAt: nowStr,
      });
    }

    await db.update(tasks).set({
      currentStageId: rollbackTargetId,
      stageHistory,
      status: 'in_progress',
      progress: Math.round((rollbackIndex / stages.length) * 100),
      updatedAt: now,
    }).where(eq(tasks.id, id));

    eventBus.emit({ type: 'task_update', resourceId: id });

    return NextResponse.json({
      task_id: id,
      action: 'reject',
      rejected_stage: task.currentStageId,
      rollback_to: rollbackTargetId,
      progress: Math.round((rollbackIndex / stages.length) * 100),
    });
  }

  // === skip: 跳过当前阶段 ===
  if (action === 'skip') {
    if (!currentStage.optional) {
      return NextResponse.json({ error: 'This stage cannot be skipped' }, { status: 400 });
    }

    // 标记为 skipped
    const skippedRecord: StageRecord = {
      ...(currentRecordIndex >= 0 ? stageHistory[currentRecordIndex] : { stageId: task.currentStageId! }),
      status: 'skipped',
      completedAt: nowStr,
    };

    if (currentRecordIndex >= 0) {
      stageHistory[currentRecordIndex] = skippedRecord;
    } else {
      stageHistory.push(skippedRecord);
    }

    // 推进到下一阶段
    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= stages.length;
    const nextStageId = isCompleted ? null : stages[nextIndex].id;

    // 推进到下一阶段（事务保证文档创建+任务更新的原子性）
    let skipNextRenderDocId: string | null = null;
    await db.transaction(async (tx) => {
      if (!isCompleted && nextStageId) {
        const nextStage = stages[nextIndex];
        const nextRecord = await initStageRecord(
          tx, nextStage, id, task.title, nowStr, stageHistory, task.projectId,
        );
        stageHistory.push(nextRecord);
        skipNextRenderDocId = nextRecord.renderDocumentId || null;
      }

      await tx.update(tasks).set({
        currentStageId: nextStageId,
        stageHistory,
        status: isCompleted ? 'reviewing' : task.status,
        progress: Math.round(((currentIndex + 1) / stages.length) * 100),
        updatedAt: now,
      }).where(eq(tasks.id, id));
    });

    // 事务成功后发送事件
    if (skipNextRenderDocId) {
      eventBus.emit({ type: 'document_update', resourceId: skipNextRenderDocId });
    }
    eventBus.emit({ type: 'task_update', resourceId: id });

    return NextResponse.json({
      task_id: id,
      action: 'skip',
      skipped_stage: task.currentStageId,
      next_stage: nextStageId,
      is_sop_completed: isCompleted,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[POST /api/tasks/[id]/sop-advance] Error:', error);
    return NextResponse.json({ error: 'SOP stage operation failed' }, { status: 500 });
  }
}

/**
 * 查找当前阶段之前最近的 AI 阶段 ID（用于驳回回退）
 */
function findPreviousAiStageId(stages: SOPStage[], currentIndex: number): string | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (stages[i].type === 'ai_auto' || stages[i].type === 'ai_with_confirm') {
      return stages[i].id;
    }
  }
  // 如果没找到 AI 阶段，回退到上一个阶段
  return currentIndex > 0 ? stages[currentIndex - 1].id : null;
}
