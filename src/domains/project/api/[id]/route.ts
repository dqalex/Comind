import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chatSessions, chatMessages, tasks, projects, documents, deliveries, milestones, comments, taskLogs, openclawStatus, projectMembers } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { eq, inArray, sql } from 'drizzle-orm';
import { normalizeId } from '@/lib/id';
import { sanitizeString } from '@/lib/security';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { checkProjectAccess } from '@/lib/project-access';

/**
 * 兼容查找：先用 normalizedId 查，未找到且 normalizedId !== id 时用原始 id 回退
 */
async function findProject(id: string) {
  const normalizedId = normalizeId(id);
  let [found] = await db.select().from(projects).where(eq(projects.id, normalizedId));
  if (!found && normalizedId !== id) {
    [found] = await db.select().from(projects).where(eq(projects.id, id));
  }
  return found ?? null;
}

// GET /api/projects/[id] - 获取单个项目
// v3.0: 项目权限校验 - 只能访问有权限的项目
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const project = await findProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 权限校验
    const access = await checkProjectAccess(project.id, auth.userId!, auth.userRole!);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
});

// PUT /api/projects/[id] - 更新项目
// v3.0: 项目权限校验 - 只有 owner/admin/member 可编辑
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    const existing = await findProject(id);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    // 权限校验
    const access = await checkProjectAccess(resolvedId, auth.userId!, auth.userRole!);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!access.canEdit) {
      return NextResponse.json({ error: 'No edit permission' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = ['name', 'description', 'visibility', 'knowledgeConfig'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'visibility') {
          const validVisibility = ['private', 'team', 'public'];
          if (validVisibility.includes(body.visibility)) {
            updateData.visibility = body.visibility;
          }
        } else if (field === 'knowledgeConfig') {
          // v3.1: 知识库配置（复用 SOP 的 KnowledgeConfig 结构）
          updateData.knowledge_config = body.knowledgeConfig;
        } else {
          updateData[field] = sanitizeString(body[field], field === 'description' ? 10000 : 200);
        }
      }
    }

    await db.update(projects).set(updateData).where(eq(projects.id, resolvedId));
    
    const [updated] = await db.select().from(projects).where(eq(projects.id, resolvedId));
    // 项目更新后通知前端刷新
    eventBus.emit({ type: 'project_update', resourceId: resolvedId });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
});

// DELETE /api/projects/[id] - 删除项目（级联清理关联数据）
// v3.0: 项目权限校验 - 只有 owner/admin 可删除
export const DELETE = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context!.params;
    const existing = await findProject(id);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    // 权限校验
    const access = await checkProjectAccess(resolvedId, auth.userId!, auth.userRole!);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!access.canDelete) {
      return NextResponse.json({ error: 'No delete permission' }, { status: 403 });
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      const projectTasks = tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, resolvedId)).all();
      const taskIds = projectTasks.map(tk => tk.id);
      
      if (taskIds.length > 0) {
        // 清理引用了这些 task 的 openclaw_status 记录
        for (const taskId of taskIds) {
          tx.update(openclawStatus)
            .set({ currentTaskId: null, currentTaskTitle: null })
            .where(eq(openclawStatus.currentTaskId, taskId)).run();
          tx.update(openclawStatus)
            .set({ nextTaskId: null, nextTaskTitle: null })
            .where(eq(openclawStatus.nextTaskId, taskId)).run();
        }
        
        tx.delete(taskLogs).where(inArray(taskLogs.taskId, taskIds)).run();
        tx.delete(comments).where(inArray(comments.taskId, taskIds)).run();
        tx.delete(deliveries).where(inArray(deliveries.taskId, taskIds)).run();
        // 问题 #27：清理子任务的 parentTaskId 引用
        tx.update(tasks)
          .set({ parentTaskId: null, updatedAt: new Date() })
          .where(inArray(tasks.parentTaskId, taskIds)).run();
        // 问题 #25：清理关联的 chatSessions（task entity）
        const taskSessionList = tx
          .select({ id: chatSessions.id })
          .from(chatSessions)
          .where(inArray(chatSessions.entityId, taskIds))
          .all();
        const taskSessionIds = taskSessionList.map(s => s.id);
        if (taskSessionIds.length > 0) {
          tx.delete(chatMessages).where(inArray(chatMessages.sessionId, taskSessionIds)).run();
          tx.delete(chatSessions).where(inArray(chatSessions.id, taskSessionIds)).run();
        }
      }
      
      tx.delete(tasks).where(eq(tasks.projectId, resolvedId)).run();

      // 删除项目关联的里程碑
      tx.delete(milestones).where(eq(milestones.projectId, resolvedId)).run();

      // 删除项目成员关系
      tx.delete(projectMembers).where(eq(projectMembers.projectId, resolvedId)).run();

      // 问题 #25：清理 project entity 的 chatSessions
      const projectSessions = tx
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.entityId, resolvedId))
        .all();
      const projSessionIds = projectSessions.map(s => s.id);
      if (projSessionIds.length > 0) {
        tx.delete(chatMessages).where(inArray(chatMessages.sessionId, projSessionIds)).run();
        tx.delete(chatSessions).where(inArray(chatSessions.id, projSessionIds)).run();
      }

      tx.update(documents)
        .set({ projectId: null, updatedAt: new Date() })
        .where(eq(documents.projectId, resolvedId)).run();
      
      // 问题 #28：只查询包含该项目 ID 的文档（避免全表扫描）
      const taggedDocs = tx.select({ id: documents.id, projectTags: documents.projectTags })
        .from(documents)
        .where(sql`project_tags LIKE ${`%"${resolvedId}"%`}`)
        .all();
      
      for (const doc of taggedDocs) {
        const tags = doc.projectTags as string[] | null;
        if (tags && tags.includes(resolvedId)) {
          const newTags = tags.filter(tg => tg !== resolvedId);
          tx.update(documents)
            .set({ projectTags: newTags, updatedAt: new Date() })
            .where(eq(documents.id, doc.id)).run();
        }
      }
      
      tx.delete(projects).where(eq(projects.id, resolvedId)).run();
    });

    // 发送 SSE 事件通知前端刷新
    eventBus.emit({ type: 'project_update', resourceId: resolvedId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/projects]', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
});
