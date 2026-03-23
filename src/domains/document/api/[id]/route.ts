import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawVersions, openclawConflicts, tasks, documents, deliveries, openclawFiles } from '@/db/schema';
import { eq, sql, inArray, and } from 'drizzle-orm';
import { normalizeId } from '@/lib/id';
import { validateEnum, VALID_DOC_TYPE, VALID_EXTERNAL_PLATFORM, VALID_SYNC_MODE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { sanitizeString } from '@/lib/security';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * 兼容查找：先用 normalizedId 查，未找到且 normalizedId !== id 时用原始 id 回退
 */
async function findDocument(id: string) {
  const normalizedId = normalizeId(id);
  let [found] = await db.select().from(documents).where(eq(documents.id, normalizedId));
  if (!found && normalizedId !== id) {
    [found] = await db.select().from(documents).where(eq(documents.id, id));
  }
  return found ?? null;
}

// GET /api/documents/[id] - 获取单个文档
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await findDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 如果是 openclaw 文档，查询对应的 openclawFileId
    let openclawFileId: string | null = null;
    let openclawFileVersion: number | null = null;
    if (doc.source === 'openclaw') {
      const [openclawFile] = await db.select()
        .from(openclawFiles)
        .where(eq(openclawFiles.documentId, doc.id));
      if (openclawFile) {
        openclawFileId = openclawFile.id;
        openclawFileVersion = openclawFile.version ?? null;
      }
    }

    return NextResponse.json({
      ...doc,
      openclawFileId,
      openclawFileVersion,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

// PUT /api/documents/[id] - 更新文档
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 内容大小限制 (10MB)
    if (body.content && typeof body.content === 'string' && body.content.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Document content exceeds size limit (10MB)' }, { status: 413 });
    }

    const existing = await findDocument(id);
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    // 枚举字段校验
    if (body.type !== undefined && !validateEnum(body.type, VALID_DOC_TYPE)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_DOC_TYPE.join('/')}` }, { status: 400 });
    }
    if (body.externalPlatform !== undefined && body.externalPlatform !== null && !validateEnum(body.externalPlatform, VALID_EXTERNAL_PLATFORM)) {
      return NextResponse.json({ error: `externalPlatform must be one of: ${VALID_EXTERNAL_PLATFORM.join('/')}` }, { status: 400 });
    }
    if (body.syncMode !== undefined && body.syncMode !== null && !validateEnum(body.syncMode, VALID_SYNC_MODE)) {
      return NextResponse.json({ error: `syncMode must be one of: ${VALID_SYNC_MODE.join('/')}` }, { status: 400 });
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    const allowedFields = [
      'title', 'content', 'projectId', 'projectTags', 'type',
      'externalPlatform', 'externalId', 'externalUrl', 'mcpServer',
      'syncMode', 'lastSync', 'links', 'backlinks',
      'renderTemplateId', 'renderMode', 'htmlContent', 'slotData'
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 字符串字段清理
        if (['title', 'content', 'externalUrl', 'mcpServer'].includes(field)) {
          updateData[field] = sanitizeString(body[field], field === 'content' ? 10 * 1024 * 1024 : 1000);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.update(documents).set(updateData).where(eq(documents.id, resolvedId)).run();

      // 当 content 变更时，自动解析 [[]] 双链并更新 links / backlinks
      if (body.content !== undefined) {
        const newContent = body.content || '';
        const linkTitles = [...newContent.matchAll(/\[\[(.+?)\]\]/g)].map((m: RegExpMatchArray) => m[1]);
        
        // 定向查询：仅查找被链接的文档（而非全表加载）
        let linkedDocs: { id: string; title: string }[] = [];
        if (linkTitles.length > 0) {
          linkedDocs = tx.select({ id: documents.id, title: documents.title })
            .from(documents)
            .where(inArray(documents.title, linkTitles))
            .all();
        }
        const titleToId = new Map(linkedDocs.map(d => [d.title, d.id]));
        const linkedIds = linkTitles.map(t => titleToId.get(t)).filter(Boolean) as string[];
        
        // 更新当前文档的 links
        tx.update(documents).set({ links: linkedIds }).where(eq(documents.id, resolvedId)).run();
        
        // 查找需要添加 backlink 的文档（被链接但还没有 backlink 指向当前文档）
        if (linkedIds.length > 0) {
          const linkedDocsWithBacklinks = tx.select({ id: documents.id, backlinks: documents.backlinks })
            .from(documents)
            .where(and(
              inArray(documents.id, linkedIds),
              sql`NOT (backlinks LIKE ${`%"${resolvedId}"%`})`,
            ))
            .all();
          for (const doc of linkedDocsWithBacklinks) {
            const currentBacklinks = Array.isArray(doc.backlinks) ? doc.backlinks : [];
            tx.update(documents)
              .set({ backlinks: [...currentBacklinks, resolvedId] })
              .where(eq(documents.id, doc.id)).run();
          }
        }
        
        // 查找需要移除 backlink 的文档（之前被链接但现在不再被链接）
        const docsWithOldBacklinks = tx.select({ id: documents.id, backlinks: documents.backlinks })
          .from(documents)
          .where(sql`backlinks LIKE ${`%"${resolvedId}"%`}`)
          .all()
          .filter(doc => doc.id !== resolvedId && !linkedIds.includes(doc.id));
        
        for (const doc of docsWithOldBacklinks) {
          const currentBacklinks = Array.isArray(doc.backlinks) ? doc.backlinks : [];
          tx.update(documents)
            .set({ backlinks: currentBacklinks.filter(b => b !== resolvedId) })
            .where(eq(documents.id, doc.id)).run();
        }
      }
    });
    
    const [updated] = await db.select().from(documents).where(eq(documents.id, resolvedId));
    
    // 当 content 变更时，尝试同步到看板（任务/定时任务/交付物）
    if (body.content !== undefined && updated?.content) {
      try {
        const syncResult = await syncMarkdownToDatabase(resolvedId, updated.content);
        if (syncResult.synced) {
          console.log(`[PUT /api/documents] 同步完成: ${resolvedId}, type=${syncResult.type}, counts=${JSON.stringify(syncResult.counts)}`);
        }
      } catch (syncError) {
        // 同步失败不影响文档保存，只记录日志
        console.error(`[PUT /api/documents] 同步失败: ${resolvedId}`, syncError);
      }
    }
    
    // 问题 #9：PUT 后通知前端刷新
    eventBus.emit({ type: 'document_update', resourceId: resolvedId });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/documents]', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

// DELETE /api/documents/[id] - 删除文档（级联清理引用）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await findDocument(id);
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      // 只查询包含目标 ID 的文档（优化 N+1）
      const docsToUpdateBacklinks = tx.select({ 
        id: documents.id, 
        backlinks: documents.backlinks
      }).from(documents)
        .where(sql`backlinks LIKE ${`%"${resolvedId}"%`}`).all();
      
      const docsToUpdateLinks = tx.select({ 
        id: documents.id, 
        links: documents.links
      }).from(documents)
        .where(sql`links LIKE ${`%"${resolvedId}"%`}`).all();
      
      // 批量更新 backlinks
      for (const doc of docsToUpdateBacklinks) {
        const bl = Array.isArray(doc.backlinks) ? doc.backlinks : [];
        if (bl.includes(resolvedId)) {
          tx.update(documents)
            .set({ backlinks: bl.filter(b => b !== resolvedId) })
            .where(eq(documents.id, doc.id)).run();
        }
      }
      
      // 批量更新 links
      for (const doc of docsToUpdateLinks) {
        const lk = Array.isArray(doc.links) ? doc.links : [];
        if (lk.includes(resolvedId)) {
          tx.update(documents)
            .set({ links: lk.filter(l => l !== resolvedId) })
            .where(eq(documents.id, doc.id)).run();
        }
      }
      
      // 更新交付记录
      tx.update(deliveries)
        .set({ documentId: null })
        .where(eq(deliveries.documentId, resolvedId)).run();
      
      // 删除由该文档同步生成的任务（sync:documentId 标记）
      tx.delete(tasks)
        .where(sql`attachments LIKE ${`%"sync:${resolvedId}"%`}`).run();
      
      // 清理其他任务中引用该文档的 doc:documentId 标记
      const tasksToUpdate = tx.select({ 
        id: tasks.id, 
        attachments: tasks.attachments 
      }).from(tasks)
        .where(sql`attachments LIKE ${`%"doc:${resolvedId}"%`}`).all();
      
      for (const tk of tasksToUpdate) {
        const atts = Array.isArray(tk.attachments) ? tk.attachments : [];
        tx.update(tasks)
          .set({ attachments: atts.filter(a => a !== `doc:${resolvedId}`), updatedAt: new Date() })
          .where(eq(tasks.id, tk.id)).run();
      }
      
      // 清理 openclawFiles 及其级联（问题 #2）
      const relatedFiles = tx.select({ id: openclawFiles.id })
        .from(openclawFiles)
        .where(eq(openclawFiles.documentId, resolvedId)).all();
      const fileIds = relatedFiles.map(f => f.id);
      if (fileIds.length > 0) {
        tx.delete(openclawConflicts).where(inArray(openclawConflicts.fileId, fileIds)).run();
        tx.delete(openclawVersions).where(inArray(openclawVersions.fileId, fileIds)).run();
        tx.delete(openclawFiles).where(eq(openclawFiles.documentId, resolvedId)).run();
      }
      
      tx.delete(documents).where(eq(documents.id, resolvedId)).run();
    });
    
    eventBus.emit({ type: 'document_update', resourceId: resolvedId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/documents]', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
