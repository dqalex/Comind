import { db } from '@/db';
import { projects, documents, type NewDocument } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, or, isNull, inArray } from 'drizzle-orm';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { generateDocId, generateId } from '@/lib/id';
import { validateEnum, VALID_DOC_SOURCE, VALID_EXTERNAL_PLATFORM, VALID_SYNC_MODE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { getAccessibleProjectIds, checkProjectAccess } from '@/lib/project-access';
import {
  createdResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';
import { createDocumentSchema, validate } from '@/lib/validation';

// GET /api/documents - 获取所有文档（列表模式不返回 content，支持分页）
// v0.9.8: 文档权限 - 继承项目权限，projectId=null 的文档为系统公开
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const source = searchParams.get('source');
  const full = searchParams.get('full') === 'true';
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    const conditions = [];
    
    // 项目权限过滤
    if (auth.userRole !== 'admin') {
      // 非 Admin 用户：只能看到 projectId=null（系统公开）或 有权限的项目的文档 或 公开项目的文档
      const accessibleProjectIds = await getAccessibleProjectIds(auth.userId!, auth.userRole!);
      
      // 获取公开项目的 ID
      const publicProjectIds = await db.select({ id: projects.id })
        .from(projects)
        .where(eq(projects.visibility, 'public'));
      
      const allAccessibleIds = [...new Set([
        ...accessibleProjectIds,
        ...publicProjectIds.map(p => p.id)
      ])];
      
      if (allAccessibleIds.length > 0) {
        conditions.push(
          or(
            isNull(documents.projectId),  // 系统公开文档
            inArray(documents.projectId, allAccessibleIds)  // 有权限的项目文档
          )
        );
      } else {
        // 用户没有任何项目权限，只能看系统公开文档
        conditions.push(isNull(documents.projectId));
      }
    }
    
    if (projectId) {
      conditions.push(eq(documents.projectId, projectId));
    }
    if (source) {
      const validSource = validateEnum(source, VALID_DOC_SOURCE);
      if (!validSource) {
        return NextResponse.json({ error: `source must be one of: ${VALID_DOC_SOURCE.join('/')}` }, { status: 400 });
      }
      conditions.push(eq(documents.source, validSource));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const selectFields = full 
        ? db.select().from(documents)
        : db.select({
            id: documents.id, title: documents.title, projectId: documents.projectId,
            projectTags: documents.projectTags, source: documents.source, type: documents.type,
            externalPlatform: documents.externalPlatform, externalId: documents.externalId,
            externalUrl: documents.externalUrl, mcpServer: documents.mcpServer,
            lastSync: documents.lastSync, syncMode: documents.syncMode,
            links: documents.links, backlinks: documents.backlinks,
            renderTemplateId: documents.renderTemplateId, renderMode: documents.renderMode,
            createdAt: documents.createdAt, updatedAt: documents.updatedAt,
          }).from(documents);
      
      const result = await (selectFields as any).where(whereClause).limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    let result;
    if (full) {
      result = await db.select().from(documents).where(whereClause);
    } else {
      result = await db.select({
        id: documents.id,
        title: documents.title,
        projectId: documents.projectId,
        projectTags: documents.projectTags,
        source: documents.source,
        type: documents.type,
        externalPlatform: documents.externalPlatform,
        externalId: documents.externalId,
        externalUrl: documents.externalUrl,
        mcpServer: documents.mcpServer,
        lastSync: documents.lastSync,
        syncMode: documents.syncMode,
        links: documents.links,
        backlinks: documents.backlinks,
        renderTemplateId: documents.renderTemplateId,
        renderMode: documents.renderMode,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      }).from(documents).where(whereClause);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
});

// POST /api/documents - 创建新文档
// v0.9.8: 如果指定了 projectId，需要校验项目权限
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    // Zod schema validation
    const validation = validate(createDocumentSchema, body);
    if (!validation.success) {
      return errorResponse(ApiErrors.badRequest(validation.error), requestId);
    }

    const data = validation.data;

    // 如果指定了 projectId，需要校验项目编辑权限
    if (data.projectId) {
      const access = await checkProjectAccess(data.projectId, auth.userId!, auth.userRole!);
      if (!access.hasAccess) {
        return errorResponse(ApiErrors.notFound('Project'), requestId);
      }
      if (!access.canEdit) {
        return errorResponse(ApiErrors.forbidden('No permission to create document in this project'), requestId);
      }
    }

    // 验证外部平台字段
    if (body.externalPlatform && !validateEnum(body.externalPlatform, VALID_EXTERNAL_PLATFORM)) {
      return errorResponse(ApiErrors.badRequest(`externalPlatform must be one of: ${VALID_EXTERNAL_PLATFORM.join('/')}`), requestId);
    }
    if (body.syncMode && !validateEnum(body.syncMode, VALID_SYNC_MODE)) {
      return errorResponse(ApiErrors.badRequest(`syncMode must be one of: ${VALID_SYNC_MODE.join('/')}`), requestId);
    }

    const newDocument: NewDocument = {
      id: generateDocId(),
      title: data.title,
      content: data.content || null,
      projectId: data.projectId || null,
      projectTags: data.projectTags || [],
      source: data.source,
      type: data.type,
      externalPlatform: body.externalPlatform || null,
      externalId: body.externalId || null,
      externalUrl: body.externalUrl || null,
      mcpServer: body.mcpServer || null,
      syncMode: body.syncMode || null,
      lastSync: null,
      links: [],
      backlinks: [],
      renderTemplateId: data.renderTemplateId || null,
      renderMode: data.renderMode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(documents).values(newDocument);
    
    // 如果有 content，尝试同步到看板（任务/定时任务/交付物）
    if (newDocument.content) {
      try {
        const syncResult = await syncMarkdownToDatabase(newDocument.id, newDocument.content);
        if (syncResult.synced) {
          console.log(`[POST /api/documents] 同步完成: ${newDocument.id}, type=${syncResult.type}, counts=${JSON.stringify(syncResult.counts)}`);
        }
      } catch (syncError) {
        // 同步失败不影响文档保存，只记录日志
        console.error(`[POST /api/documents] 同步失败: ${newDocument.id}`, syncError);
      }
    }
    
    // 问题 #8：POST 后通知前端刷新
    eventBus.emit({ type: 'document_update', resourceId: newDocument.id });
    // 返回数据库中的完整数据（而非内存构造的对象）
    const [created] = await db.select().from(documents).where(eq(documents.id, newDocument.id));
    return createdResponse(created || newDocument);
  } catch (error) {
    console.error(`[POST /api/documents] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create document'), requestId);
  }
});
