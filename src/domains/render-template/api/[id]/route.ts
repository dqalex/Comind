import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { documents, renderTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 有效的渲染模板分类
const VALID_RENDER_CATEGORY = ['report', 'card', 'poster', 'presentation', 'custom'] as const;
// 有效的状态
const VALID_RENDER_STATUS = ['draft', 'active', 'archived'] as const;

// 允许 PUT 更新的字段
const allowedFields = [
  'name', 'description', 'category', 'status',
  'htmlTemplate', 'mdTemplate', 'cssTemplate',
  'slots', 'sections', 'exportConfig', 'thumbnail'
] as const;

// GET /api/render-templates/[id] - 获取单个渲染模板
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [template] = await db.select().from(renderTemplates).where(eq(renderTemplates.id, id));
    
    if (!template) {
      return NextResponse.json({ error: 'Render template not found' }, { status: 404 });
    }
    
    return NextResponse.json(template);
  } catch (error) {
    console.error('[GET /api/render-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch render template' }, { status: 500 });
  }
}

// PUT /api/render-templates/[id] - 更新渲染模板
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查模板是否存在
    const [existing] = await db.select().from(renderTemplates).where(eq(renderTemplates.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Render template not found' }, { status: 404 });
    }
    
    // 内置模板不允许修改
    if (existing.isBuiltin) {
      return NextResponse.json({ error: 'Built-in template cannot be modified' }, { status: 403 });
    }
    
    const body = await request.json();
    
    // 白名单过滤更新字段
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 枚举校验
        if (field === 'category' && body[field] !== null) {
          if (!VALID_RENDER_CATEGORY.includes(body[field])) {
            return NextResponse.json({ error: `category must be one of ${VALID_RENDER_CATEGORY.join('/')}` }, { status: 400 });
          }
        }
        if (field === 'status' && body[field] !== null) {
          if (!VALID_RENDER_STATUS.includes(body[field])) {
            return NextResponse.json({ error: `status must be one of ${VALID_RENDER_STATUS.join('/')}` }, { status: 400 });
          }
        }
        updates[field] = body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    // 添加更新时间戳
    updates.updatedAt = new Date();
    
    await db.update(renderTemplates).set(updates).where(eq(renderTemplates.id, id));
    
    // 返回更新后的数据
    const [updated] = await db.select().from(renderTemplates).where(eq(renderTemplates.id, id));
    
    // 触发事件通知
    eventBus.emit({ type: 'render_template_update', resourceId: id });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/render-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update render template' }, { status: 500 });
  }
}

// DELETE /api/render-templates/[id] - 删除渲染模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查模板是否存在
    const [existing] = await db.select().from(renderTemplates).where(eq(renderTemplates.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Render template not found' }, { status: 404 });
    }
    
    // 内置模板不允许删除
    if (existing.isBuiltin) {
      return NextResponse.json({ error: 'Built-in template cannot be deleted' }, { status: 403 });
    }
    
    // 检查是否有文档引用此渲染模板
    const [docRef] = await db.select({ id: documents.id }).from(documents).where(eq(documents.renderTemplateId, id)).limit(1);
    if (docRef) {
      return NextResponse.json({ error: 'Cannot delete: template is in use by documents' }, { status: 409 });
    }
    
    await db.delete(renderTemplates).where(eq(renderTemplates.id, id));
    
    // 触发事件通知
    eventBus.emit({ type: 'render_template_update', resourceId: id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/render-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete render template' }, { status: 500 });
  }
}
