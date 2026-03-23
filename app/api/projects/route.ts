import { db } from '@/db';
import { projects, projectMembers, type NewProject } from '@/db/schema';
import { NextRequest } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq, sql } from 'drizzle-orm';
import { generateProjectId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { buildProjectAccessFilter } from '@/lib/project-access';
import { createProjectSchema, validate } from '@/lib/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';

// GET /api/projects - 获取所有项目（支持 source 过滤）
// v0.9.8: 项目权限过滤 - 只返回用户可访问的项目
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();

  try {
    const source = request.nextUrl.searchParams.get('source');
    const accessFilter = buildProjectAccessFilter(auth.userId!, auth.userRole!);

    let result;
    if (source === 'local' || source === 'openclaw') {
      result = await db.select().from(projects)
        .where(sql`${eq(projects.source, source)} AND ${accessFilter}`);
    } else {
      result = await db.select().from(projects)
        .where(accessFilter);
    }

    return successResponse(result);
  } catch (error) {
    console.error(`[GET /api/projects] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to fetch projects'), requestId);
  }
});

// POST /api/projects - 创建新项目
// v0.9.8: 自动设置当前用户为 Owner
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();

  try {
    const body = await request.json();

    // 使用 Zod Schema 验证输入
    const validationResult = validate(createProjectSchema, body);
    if (!validationResult.success) {
      console.error(`[POST /api/projects] ${requestId} Validation failed:`, validationResult.error);
      return errorResponse(ApiErrors.badRequest(validationResult.error), requestId);
    }
    const validatedData = validationResult.data;

    const projectId = generateProjectId();
    const now = new Date();

    const newProject: NewProject = {
      id: projectId,
      name: validatedData.name,
      description: validatedData.description || null,
      source: validatedData.source,
      ownerId: auth.userId!, // 强制设置当前用户为 Owner
      visibility: validatedData.visibility,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(projects).values(newProject);
    
    // 同时在 project_members 中创建 owner 记录
    await db.insert(projectMembers).values({
      id: generateId(),
      projectId,
      userId: auth.userId!,
      role: 'owner',
      createdAt: now,
    });

    // 用 API 返回数据库中的完整数据
    const [created] = await db.select().from(projects).where(eq(projects.id, projectId));
    eventBus.emit({ type: 'project_update', resourceId: projectId });
    return createdResponse(created || newProject);
  } catch (error) {
    console.error(`[POST /api/projects] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create project'), requestId);
  }
});
