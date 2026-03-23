import { db } from '@/db';
import { tasks, type Task, type NewTask } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq, and, sql, or, inArray } from 'drizzle-orm';
import { generateTaskId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { isValidId } from '@/lib/security';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { checkProjectAccess, getAccessibleProjectIds } from '@/lib/project-access';
import { createTaskSchema, validate } from '@/lib/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';

// GET /api/tasks - 获取所有任务（支持 source 过滤 + 分页）
// v0.9.8: 需要登录才能访问，任务权限继承项目权限
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const memberId = searchParams.get('memberId');
  const source = searchParams.get('source');
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    let result: Task[];

    // 构建查询条件
    const conditions = [];
    
    // v0.9.8: 如果指定了 projectId，需要检查权限
    if (projectId) {
      // 校验 projectId 格式
      if (!isValidId(projectId)) {
        return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
      }
      
      // 检查用户对该项目的访问权限
      const access = await checkProjectAccess(projectId, auth.userId!, auth.userRole!);
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'No permission to access tasks in this project' }, { status: 403 });
      }
      
      conditions.push(eq(tasks.projectId, projectId));
    } else if (auth.userRole !== 'admin') {
      // 非 admin 用户：只能看到有权限的项目的任务 + 无项目的任务
      const accessibleProjectIds = await getAccessibleProjectIds(auth.userId!, auth.userRole!);
      
      if (accessibleProjectIds.length > 0) {
        // 有权限的项目任务 OR 无项目任务
        conditions.push(
          or(
            inArray(tasks.projectId, accessibleProjectIds),
            sql`${tasks.projectId} IS NULL`
          )
        );
      } else {
        // 没有任何项目权限，只能看无项目的任务
        conditions.push(sql`${tasks.projectId} IS NULL`);
      }
    }
    // admin 用户不需要项目过滤，可以看到所有任务
    
    // 使用参数化查询防止 SQL 注入
    if (memberId) {
      if (!isValidId(memberId)) {
        return NextResponse.json({ error: 'Invalid memberId format' }, { status: 400 });
      }
      // 安全的参数化：将 memberId 包裹后作为独立参数传入
      const likePattern = `%"${memberId}"%`;
      conditions.push(sql`assignees LIKE ${likePattern}`);
    }
    // source 过滤
    if (source === 'local' || source === 'openclaw') {
      conditions.push(eq(tasks.source, source));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 支持分页：传入 page 和 limit 时返回分页数据
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      result = await db.select().from(tasks).where(whereClause).limit(limit).offset(offset);
      // 获取总数
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    if (conditions.length > 0) {
      result = await db.select().from(tasks).where(whereClause);
    } else {
      result = await db.select().from(tasks);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
});

// POST /api/tasks - 创建任务
// v0.9.8: 需要登录才能创建，如果指定项目需要有编辑权限
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    // 使用 Zod Schema 验证输入
    const validationResult = validate(createTaskSchema, body);
    if (!validationResult.success) {
      console.error(`[POST /api/tasks] ${requestId} Validation failed:`, validationResult.error);
      return errorResponse(ApiErrors.badRequest(validationResult.error), requestId);
    }
    const validatedData = validationResult.data;

    // v0.9.8: 如果指定了 projectId，检查用户是否有编辑权限
    if (validatedData.projectId) {
      if (!isValidId(validatedData.projectId)) {
        return errorResponse(ApiErrors.badRequest('Invalid projectId format'), requestId);
      }
      
      const access = await checkProjectAccess(validatedData.projectId, auth.userId!, auth.userRole!);
      if (!access.canEdit) {
        return errorResponse(ApiErrors.forbidden('No permission to create tasks in this project'), requestId);
      }
    }
    
    const newTask: NewTask = {
      id: generateTaskId(),
      title: validatedData.title,
      description: validatedData.description || null,
      projectId: validatedData.projectId || null,
      source: 'local',
      assignees: validatedData.assignees,
      creatorId: auth.userId || 'system',
      status: validatedData.status,
      progress: 0,
      priority: validatedData.priority,
      deadline: validatedData.deadline || null,
      checkItems: validatedData.checkItems,
      attachments: validatedData.attachments,
      parentTaskId: null,
      crossProjects: [],
      // SOP 字段（可选）
      sopTemplateId: validatedData.sopTemplateId || null,
      currentStageId: null,
      stageHistory: [],
      sopInputs: validatedData.sopInputs || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(tasks).values(newTask);
    // 返回数据库中完整数据（确保 source 等默认字段正确）
    const [created] = await db.select().from(tasks).where(eq(tasks.id, newTask.id));
    eventBus.emit({ type: 'task_update', resourceId: newTask.id });
    triggerMarkdownSync('teamclaw:tasks');
    return createdResponse(created || newTask);
  } catch (error) {
    console.error(`[POST /api/tasks] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create task'), requestId);
  }
});
