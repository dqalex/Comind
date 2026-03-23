import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveries, tasks, members, projects, documents, openclawFiles, openclawWorkspaces } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_DELIVERY_STATUS, VALID_DELIVERY_PLATFORM } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { renderTemplateWithContext } from '@/lib/template-engine';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// GET - 获取单个交付记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, id));

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    return NextResponse.json(delivery);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery' }, { status: 500 });
  }
}

// PUT - 更新交付记录（审核）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = [
      'title', 'description', 'platform', 'externalUrl', 'externalId', 'documentId',
      'status', 'reviewerId', 'reviewedAt', 'reviewComment', 'version'
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.status && !validateEnum(body.status, VALID_DELIVERY_STATUS)) {
      return NextResponse.json({ error: `status must be one of ${VALID_DELIVERY_STATUS.join('/')}` }, { status: 400 });
    }
    if (body.platform && !validateEnum(body.platform, VALID_DELIVERY_PLATFORM)) {
      return NextResponse.json({ error: `platform must be one of ${VALID_DELIVERY_PLATFORM.join('/')}` }, { status: 400 });
    }

    if (updateData.reviewedAt && typeof updateData.reviewedAt === 'string') {
      updateData.reviewedAt = new Date(updateData.reviewedAt);
    }

    const [delivery] = await db
      .update(deliveries)
      .set(updateData)
      .where(eq(deliveries.id, id))
      .returning();

    eventBus.emit({ type: 'delivery_update', resourceId: delivery.id });
    triggerMarkdownSync('teamclaw:deliveries');

    // 审核状态变更时，同步关联任务状态 + 构建通知消息
    const reviewStatus = body.status as string | undefined;
    const gatewaySessionKey = body._gatewaySessionKey as string | undefined;
    let notifyData: { sessionKey: string; message: string } | null = null;

    if (reviewStatus) {
      const reviewCtx: ReviewContext = {
        deliveryId: delivery.id,
        deliveryTitle: delivery.title,
        deliveryDescription: existing.description,
        memberId: existing.memberId,
        documentId: existing.documentId,
        reviewerId: body.reviewerId,
        reviewComment: body.reviewComment,
      };

      let taskForNotify: { id: string; title: string; description: string | null; priority: string; status: string; deadline: Date | null; projectId: string | null; attachments: string[] | null } | null = null;

      if (existing.taskId) {
        // 有关联任务：同步任务状态
        taskForNotify = await syncTaskStatusFromReview(existing.taskId, reviewStatus);
      }

      // 需要修改/退回时，构建通知消息返回给前端发送
      if (reviewStatus === 'revision_needed' || reviewStatus === 'rejected') {
        notifyData = await buildReviewNotification(reviewStatus, taskForNotify, reviewCtx, gatewaySessionKey);
      }
    }

    // 将通知数据附在响应中，前端负责通过 Gateway 发送
    return NextResponse.json({ ...delivery, _notifyData: notifyData });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 });
  }
}

/**
 * 审核状态 → 任务状态映射
 * approved → completed
 * revision_needed / rejected → in_progress
 * 返回任务对象供通知使用
 */
interface ReviewContext {
  deliveryId: string;
  deliveryTitle: string;
  deliveryDescription: string | null;
  memberId: string;
  documentId: string | null;
  reviewerId?: string;
  reviewComment?: string;
}

async function syncTaskStatusFromReview(
  taskId: string,
  reviewStatus: string,
): Promise<{ id: string; title: string; description: string | null; priority: string; status: string; deadline: Date | null; projectId: string | null; attachments: string[] | null } | null> {
  try {
    type TaskStatus = 'todo' | 'in_progress' | 'reviewing' | 'completed';
    const taskStatusMap: Record<string, TaskStatus> = {
      approved: 'completed',
      revision_needed: 'in_progress',
      rejected: 'in_progress',
    };
    const newTaskStatus = taskStatusMap[reviewStatus];
    if (!newTaskStatus) return null;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return null;

    await db.update(tasks).set({
      status: newTaskStatus,
      updatedAt: new Date(),
    }).where(eq(tasks.id, taskId));

    eventBus.emit({ type: 'task_update', resourceId: taskId });
    triggerMarkdownSync('teamclaw:tasks');

    return task;
  } catch (err) {
    console.error('[deliveries] syncTaskStatusFromReview error:', err);
    return null;
  }
}

/**
 * 构建审核通知消息（不直接发送）
 * 返回 sessionKey + message，由前端通过 Gateway 信道发送（兼容 browser_direct 模式）
 */
async function buildReviewNotification(
  reviewStatus: string,
  task: { id: string; title: string; description: string | null; priority: string; status: string; deadline: Date | null; projectId: string | null; attachments: string[] | null } | null,
  ctx: ReviewContext,
  overrideSessionKey?: string,
): Promise<{ sessionKey: string; message: string } | null> {
  try {
    // 优先使用前端传入的 Gateway sessionKey（来自 agents.list 的 mainKey，如 agent:main:main）
    // 如果前端未传，fallback 到从 DB 中 AI 成员信息拼接（可能不准确）
    let sessionKey = overrideSessionKey || '';

    if (!sessionKey) {
      // 查找提交者（AI 成员），如果 memberId 不是 AI，查找项目中的 AI 成员
      const aiMember = await findAiMemberForNotification(ctx.memberId, task?.projectId || null);
      if (!aiMember) return null;

      const agentId = aiMember.openclawAgentId || aiMember.openclawName;
      if (!agentId) return null;

      sessionKey = `agent:${agentId}`;
    }
    const statusLabel = reviewStatus === 'revision_needed' ? '需要修改' : '退回';

    // 获取审核人名称
    let reviewerName = '用户';
    if (ctx.reviewerId) {
      const [reviewer] = await db.select().from(members).where(eq(members.id, ctx.reviewerId));
      if (reviewer) reviewerName = reviewer.name;
    }

    // 获取项目信息
    let projectContext: { project_id: string; project_name: string; project_description: string | null; project_source: string } | null = null;
    if (task?.projectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
      if (project) {
        projectContext = {
          project_id: project.id,
          project_name: project.name,
          project_description: project.description,
          project_source: project.source,
        };
      }
    }

    // 获取交付文档信息
    let documentContext: { document_id: string; document_title: string } | null = null;
    if (ctx.documentId) {
      const [doc] = await db.select().from(documents).where(eq(documents.id, ctx.documentId));
      if (doc) {
        documentContext = { document_id: doc.id, document_title: doc.title };
      }
    }

    // 获取关联文件
    const attachmentIds = task?.attachments || [];
    let filesSection = '';
    if (attachmentIds.length > 0) {
      const attachedDocs = await db.select().from(documents).where(inArray(documents.id, attachmentIds));
      if (attachedDocs.length > 0) {
        const docIds = attachedDocs.map(d => d.id);
        const mappedFiles = await db.select().from(openclawFiles).where(inArray(openclawFiles.documentId, docIds));
        const workspaceIds = [...new Set(mappedFiles.map(f => f.workspaceId).filter(Boolean))] as string[];
        const workspaces = workspaceIds.length > 0
          ? await db.select().from(openclawWorkspaces).where(inArray(openclawWorkspaces.id, workspaceIds))
          : [];
        const workspaceMap = new Map(workspaces.map(w => [w.id, w]));

        const fileList = [
          ...mappedFiles
            .map(mf => {
              const ws = workspaceMap.get(mf.workspaceId);
              const doc = attachedDocs.find(d => d.id === mf.documentId);
              return ws && doc ? `- **${doc.title}** [映射目录: ${ws.path}] - ${mf.relativePath}` : null;
            })
            .filter(Boolean),
          ...attachedDocs
            .filter(d => !mappedFiles.find(mf => mf.documentId === d.id))
            .map(doc => `- **${doc.title}** [TeamClaw 存储] - doc:${doc.id}`),
        ].join('\n');

        if (fileList) {
          filesSection = `## 关联文件\n${fileList}`;
        }
      }
    }

    // 使用模板引擎渲染
    const message = await renderTemplateWithContext('delivery-review-result', {
      timestamp: new Date().toLocaleString('zh-CN'),
      delivery_id: ctx.deliveryId,
      delivery_title: ctx.deliveryTitle,
      delivery_description: ctx.deliveryDescription,
      review_status_label: statusLabel,
      review_comment: ctx.reviewComment || null,
      reviewer_name: reviewerName,
      task_id: task?.id || null,
      task_title: task?.title || null,
      task_description: task?.description || null,
      task_priority: task?.priority || null,
      task_deadline: task?.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
      project_id: projectContext?.project_id || null,
      project_name: projectContext?.project_name || null,
      project_description: projectContext?.project_description || null,
      project_source: projectContext?.project_source || null,
      document_id: documentContext?.document_id || null,
      document_title: documentContext?.document_title || null,
      files_section: filesSection || null,
    });

    const finalMessage = message || `[TeamClaw 审核通知] 你提交的文档「${ctx.deliveryTitle}」审核结果: ${statusLabel}。${ctx.reviewComment ? `\n审核意见: ${ctx.reviewComment}` : ''}\n请根据审核意见修改后重新提交。`;

    return { sessionKey, message: finalMessage };
  } catch (err) {
    console.error('[deliveries] buildReviewNotification error:', err);
    return null;
  }
}

/**
 * 查找需要通知的 AI 成员
 * 优先查 memberId 是否为 AI，否则查项目内的 AI 成员
 */
async function findAiMemberForNotification(
  memberId: string,
  projectId: string | null,
): Promise<{ id: string; openclawAgentId: string | null; openclawName: string | null } | null> {
  // 1. 先检查 memberId 本身是否为 AI 成员
  const [member] = await db.select().from(members).where(
    and(eq(members.id, memberId), eq(members.type, 'ai'))
  );
  if (member) return member;

  // 2. 如果 memberId 是人类用户，查找项目中的 AI 成员
  if (projectId) {
    const aiMembers = await db.select().from(members).where(eq(members.type, 'ai'));
    // 返回第一个有 agentId 的 AI 成员（项目级匹配可在后续细化）
    const withAgent = aiMembers.find(m => m.openclawAgentId || m.openclawName);
    if (withAgent) return withAgent;
  }

  // 3. 回退：查找任意可用的 AI 成员
  const aiMembers = await db.select().from(members).where(eq(members.type, 'ai'));
  return aiMembers.find(m => m.openclawAgentId || m.openclawName) || null;
}

// DELETE - 删除交付记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existingDel] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    if (!existingDel) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    await db.delete(deliveries).where(eq(deliveries.id, id));

    eventBus.emit({ type: 'delivery_update', resourceId: id });
    triggerMarkdownSync('teamclaw:deliveries');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete delivery' }, { status: 500 });
  }
}
