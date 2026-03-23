/**
 * MCP Handler: 文档操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 45%
 */

import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq, sql, or, and, inArray } from 'drizzle-orm';
import { generateDocId } from '@/lib/id';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Document } from '@/db/schema';

/** 获取 TeamClaw 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建文档访问链接 */
function buildDocumentUrl(docId: string): string {
  return `${getBaseUrl()}/wiki?doc=${docId}`;
}

/** 有效的文档类型 */
const VALID_DOC_TYPES = ['guide', 'reference', 'note', 'report', 'decision', 'scheduled_task', 'task_list', 'other'] as const;

/**
 * Document Handler - 继承 McpHandlerBase 基类
 */
class DocumentHandler extends McpHandlerBase<Document> {
  constructor() {
    super('Document', 'document_update');
  }

  /**
   * 主入口 - 调度各个具体处理方法
   */
  async execute(
    params: Record<string, unknown>,
    _context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string;

    switch (action) {
      case 'get':
        return this.handleGetDocument(params);
      case 'create':
        return this.handleCreateDocument(params);
      case 'update':
        return this.handleUpdateDocument(params);
      case 'search':
        return this.handleSearchDocuments(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取文档
   * 
   * 渐进式上下文设计：
   * - detail=false（默认）：返回 L1 索引（元信息）
   * - detail=true：返回 L2 完整内容
   */
  private async handleGetDocument(params: Record<string, unknown>): Promise<HandlerResult> {
    const { document_id, title, detail = false } = params as { document_id?: string; title?: string; detail?: boolean };

    if (!document_id && !title) {
      return this.failure('Either document_id or title is required');
    }

    try {
      let doc: Document | undefined;
      if (document_id) {
        const [found] = await db.select().from(documents).where(eq(documents.id, document_id));
        doc = found;
      } else if (title) {
        const [found] = await db.select().from(documents).where(sql`lower(${documents.title}) = ${title.toLowerCase()}`);
        doc = found;
      }

      if (!doc) {
        return this.failure('Document not found');
      }

      // L1 索引：仅返回元信息
      const l1Data = {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        url: buildDocumentUrl(doc.id),
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        // L1 包含内容摘要（前 200 字符）
        contentSnippet: doc.content ? doc.content.slice(0, 200) + (doc.content.length > 200 ? '...' : '') : undefined,
      };

      // L2 详情：返回完整内容
      if (detail) {
        return this.success('Document detail retrieved', {
          ...l1Data,
          content: doc.content,
          links: doc.links,
          backlinks: doc.backlinks,
          updatedAt: doc.updatedAt,
        });
      }

      return this.success('Document index retrieved', l1Data);
    } catch (error) {
      this.logError('Get document', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to get document', message);
    }
  }

  /**
   * 创建文档
   */
  private async handleCreateDocument(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'title', 'content');
    if (validation) return validation;

    const { title, content, project_id, doc_type, tags, render_mode, render_template_id } = params as {
      title: string;
      content: string;
      project_id?: string;
      doc_type?: string;
      tags?: string[];
      render_mode?: 'markdown' | 'visual';
      render_template_id?: string;
    };

    // 校验 doc_type
    const resolvedType = (doc_type && VALID_DOC_TYPES.includes(doc_type as typeof VALID_DOC_TYPES[number])) 
      ? doc_type as typeof VALID_DOC_TYPES[number] 
      : 'note';

    try {
      // 解析 [[ ]] 双链（定向查询，避免全表加载）
      const linkTitles = [...(content || '').matchAll(/\[\[(.+?)\]\]/g)].map((m: RegExpMatchArray) => m[1]);
      let linkedDocs: { id: string; title: string; backlinks: string[] | null }[] = [];
      if (linkTitles.length > 0) {
        linkedDocs = await db.select({ id: documents.id, title: documents.title, backlinks: documents.backlinks })
          .from(documents)
          .where(inArray(documents.title, linkTitles));
      }
      const titleToId = new Map(linkedDocs.map(d => [d.title, d.id]));
      const linkedIds = linkTitles.map(t => titleToId.get(t)).filter(Boolean) as string[];

      const now = new Date();
      const newDoc = {
        id: generateDocId(),
        title,
        content,
        projectId: project_id || null,
        projectTags: tags || [],
        source: 'local' as const,
        links: linkedIds,
        backlinks: [] as string[],
        type: resolvedType,
        externalPlatform: null,
        externalId: null,
        externalUrl: null,
        mcpServer: null,
        syncMode: null,
        lastSync: null,
        renderMode: render_mode || 'markdown',
        renderTemplateId: render_template_id || null,
        htmlContent: null,
        slotData: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(documents).values(newDoc);

      // 更新被引用文档的 backlinks
      for (const targetDoc of linkedDocs) {
        const currentBacklinks = Array.isArray(targetDoc.backlinks) ? targetDoc.backlinks : [];
        if (!currentBacklinks.includes(newDoc.id)) {
          await db.update(documents).set({ backlinks: [...currentBacklinks, newDoc.id] }).where(eq(documents.id, targetDoc.id));
        }
      }

      this.emitUpdate(newDoc.id);
      this.log('Created', newDoc.id, { title, type: resolvedType });

      let syncResult = null;
      if (content) {
        syncResult = await syncMarkdownToDatabase(newDoc.id, content);
      }

      return this.success('Document created', {
        id: newDoc.id,
        documentId: newDoc.id,
        title: newDoc.title,
        type: resolvedType,
        docType: resolvedType,
        url: buildDocumentUrl(newDoc.id),
        createdAt: now.toISOString(),
        tags: tags || [],
        renderMode: newDoc.renderMode,
        renderTemplateId: newDoc.renderTemplateId,
        _sync: syncResult,
      });
    } catch (error) {
      this.logError('Create document', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to create document', message);
    }
  }

  /**
   * 更新文档
   */
  private async handleUpdateDocument(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'document_id', 'content');
    if (validation) return validation;

    const { document_id, content, doc_type } = params as {
      document_id: string;
      content: string;
      doc_type?: string;
    };

    return this.withResource(
      document_id,
      async (id) => {
        const [doc] = await db.select().from(documents).where(eq(documents.id, id));
        return doc || null;
      },
      async (doc) => {
        const now = new Date();
        const updateData: Record<string, unknown> = { content, updatedAt: now };

        // 如果传入了有效的 doc_type，更新类型
        if (doc_type && VALID_DOC_TYPES.includes(doc_type as typeof VALID_DOC_TYPES[number])) {
          updateData.type = doc_type;
        }

        await db.update(documents).set(updateData).where(eq(documents.id, document_id));

        // 自动解析 [[ ]] 双链并更新 links / backlinks
        await this.updateDocumentLinks(document_id, content);

        this.emitUpdate(document_id);
        this.log('Updated', document_id);

        const syncResult = await syncMarkdownToDatabase(document_id, content);

        return this.success('Document updated', {
          id: document_id,
          documentId: document_id,
          title: doc.title,
          url: buildDocumentUrl(document_id),
          updatedAt: now.toISOString(),
          _sync: syncResult.synced ? syncResult : undefined,
        });
      }
    );
  }

  /**
   * 更新文档的双向链接
   */
  private async updateDocumentLinks(documentId: string, content: string): Promise<void> {
    const linkTitles = [...(content || '').matchAll(/\[\[(.+?)\]\]/g)].map((m: RegExpMatchArray) => m[1]);
    let linkedDocs: { id: string; title: string; backlinks: string[] | null }[] = [];
    if (linkTitles.length > 0) {
      linkedDocs = await db.select({ id: documents.id, title: documents.title, backlinks: documents.backlinks })
        .from(documents)
        .where(inArray(documents.title, linkTitles));
    }
    const titleToId = new Map(linkedDocs.map(d => [d.title, d.id]));
    const linkedIds = linkTitles.map(t => titleToId.get(t)).filter(Boolean) as string[];

    await db.update(documents).set({ links: linkedIds }).where(eq(documents.id, documentId));

    // 添加 backlinks
    if (linkedIds.length > 0) {
      const docsNeedBacklink = await db.select({ id: documents.id, backlinks: documents.backlinks })
        .from(documents)
        .where(and(
          inArray(documents.id, linkedIds),
          sql`NOT (backlinks LIKE ${`%"${documentId}"%`})`,
        ));
      for (const targetDoc of docsNeedBacklink) {
        const currentBacklinks = Array.isArray(targetDoc.backlinks) ? targetDoc.backlinks : [];
        await db.update(documents).set({ backlinks: [...currentBacklinks, documentId] }).where(eq(documents.id, targetDoc.id));
      }
    }

    // 移除旧的 backlinks
    const docsWithOldBacklinks = await db.select({ id: documents.id, backlinks: documents.backlinks })
      .from(documents)
      .where(sql`backlinks LIKE ${`%"${documentId}"%`}`);
    for (const oldDoc of docsWithOldBacklinks) {
      if (oldDoc.id === documentId || linkedIds.includes(oldDoc.id)) continue;
      const currentBacklinks = Array.isArray(oldDoc.backlinks) ? oldDoc.backlinks : [];
      await db.update(documents).set({ backlinks: currentBacklinks.filter(b => b !== documentId) }).where(eq(documents.id, oldDoc.id));
    }
  }

  /**
   * 搜索文档
   */
  private async handleSearchDocuments(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'query');
    if (validation) return validation;

    const { query, project_id } = params as { query: string; project_id?: string };

    try {
      // Escape LIKE wildcards to prevent pattern injection
      const escapedQuery = query.replace(/[%_]/g, '\\$&');
      const likePattern = `%${escapedQuery}%`;

      // Build conditions using Drizzle's type-safe operators
      const searchConditions = or(
        sql`lower(${documents.title}) LIKE lower(${likePattern}) ESCAPE '\\'`,
        sql`lower(${documents.content}) LIKE lower(${likePattern}) ESCAPE '\\'`
      );

      const whereCondition = project_id
        ? and(searchConditions, eq(documents.projectId, project_id))
        : searchConditions;

      const results = await db
        .select({ id: documents.id, title: documents.title, type: documents.type, createdAt: documents.createdAt })
        .from(documents)
        .where(whereCondition)
        .limit(50);

      // 为每个结果添加访问链接，标题匹配的排在前面
      const lowerQuery = query.toLowerCase();
      const resultsWithUrl = results.map(r => ({
        ...r,
        url: buildDocumentUrl(r.id),
      })).sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
        const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
        return aTitle - bTitle;
      });

      return this.success('Documents searched', resultsWithUrl);
    } catch (error) {
      this.logError('Search documents', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to search documents', message);
    }
  }
}

// 导出单例
export const documentHandler = new DocumentHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleGetDocument(params: Record<string, unknown>) {
  return documentHandler.execute({ ...params, action: 'get' }, {});
}

export async function handleCreateDocument(params: Record<string, unknown>) {
  return documentHandler.execute({ ...params, action: 'create' }, {});
}

export async function handleUpdateDocument(params: Record<string, unknown>) {
  return documentHandler.execute({ ...params, action: 'update' }, {});
}

export async function handleSearchDocuments(params: Record<string, unknown>) {
  return documentHandler.execute({ ...params, action: 'search' }, {});
}

// 默认导出
export default documentHandler;
