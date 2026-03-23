import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates, tasks, skills } from '@/db';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { isVersionHigher, normalizeVersion } from '@/lib/version-utils';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 有效的 SOP 分类
const VALID_SOP_CATEGORY = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'] as const;
// 有效的 SOP 状态
const VALID_SOP_STATUS = ['draft', 'active', 'archived'] as const;

// 允许 PUT 更新的字段
const allowedFields = [
  'name', 'description', 'category', 'icon', 'status', 'version',
  'stages', 'requiredTools', 'systemPrompt', 'knowledgeConfig',
  'outputConfig', 'qualityChecklist', 'projectId',
  'references', 'scripts'  // v3.1 新增
] as const;

// GET /api/sop-templates/[id] - 获取单个 SOP 模板
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    
    if (!template) {
      return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
    }
    
    return NextResponse.json(template);
  } catch (error) {
    console.error('[GET /api/sop-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to get SOP template' }, { status: 500 });
  }
}

// PUT /api/sop-templates/[id] - 更新 SOP 模板
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查模板是否存在
    const [existing] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
    }
    
    // 内置模板不允许修改
    if (existing.isBuiltin) {
      return NextResponse.json({ error: 'Builtin template cannot be modified' }, { status: 403 });
    }
    
    const body = await request.json();
    
    // 白名单过滤更新字段
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 枚举校验
        if (field === 'category' && body[field] !== null) {
          if (!VALID_SOP_CATEGORY.includes(body[field])) {
            return NextResponse.json({ error: `category must be one of ${VALID_SOP_CATEGORY.join('/')}` }, { status: 400 });
          }
        }
        if (field === 'status' && body[field] !== null) {
          if (!VALID_SOP_STATUS.includes(body[field])) {
            return NextResponse.json({ error: `status must be one of ${VALID_SOP_STATUS.join('/')}` }, { status: 400 });
          }
        }
        // stages 数组校验
        if (field === 'stages' && body[field] !== null && !Array.isArray(body[field])) {
          return NextResponse.json({ error: 'stages must be an array' }, { status: 400 });
        }
        updates[field] = body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    // 添加更新时间戳
    updates.updatedAt = new Date();
    
    // 检查版本是否更新
    const oldVersion = normalizeVersion(existing.version || '1.0.0');
    const newVersion = normalizeVersion((body.version as string) || oldVersion);
    const isVersionBumped = isVersionHigher(newVersion, oldVersion);
    
    await db.update(sopTemplates).set(updates).where(eq(sopTemplates.id, id));
    
    // 如果版本更新，检查关联的 Skill 并标记需要更新
    let skillsNeedingUpdate: Array<{ id: string; skillKey: string }> = [];
    if (isVersionBumped) {
      const relatedSkills = await db
        .select()
        .from(skills)
        .where(eq(skills.sopTemplateId, id));
      
      for (const skill of relatedSkills) {
        const skillSopVersion = skill.sopTemplateVersion || '1.0.0';
        if (isVersionHigher(newVersion, skillSopVersion)) {
          // 标记 Skill 需要更新
          await db
            .update(skills)
            .set({ 
              sopUpdateAvailable: true,
              updatedAt: new Date(),
            })
            .where(eq(skills.id, skill.id));
          
          skillsNeedingUpdate.push({ id: skill.id, skillKey: skill.skillKey });
        }
      }
    }
    
    // 返回更新后的数据
    const [updated] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    
    // 触发事件通知
    eventBus.emit({ type: 'sop_template_update', resourceId: id });
    
    // 如果有 Skill 需要更新，也发送 Skill 更新事件
    for (const skill of skillsNeedingUpdate) {
      eventBus.emit({ 
        type: 'skill_update', 
        resourceId: skill.id,
        data: { 
          reason: 'sop_version_bumped',
          sopTemplateId: id,
          newSopVersion: newVersion,
        },
      });
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/sop-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update SOP template' }, { status: 500 });
  }
}

// DELETE /api/sop-templates/[id] - 删除 SOP 模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查模板是否存在
    const [existing] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
    }
    
    // 内置模板不允许删除
    if (existing.isBuiltin) {
      return NextResponse.json({ error: 'Builtin template cannot be deleted' }, { status: 403 });
    }
    
    // 检查是否有任务引用此模板
    const [taskRef] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.sopTemplateId, id)).limit(1);
    if (taskRef) {
      return NextResponse.json({ error: 'Cannot delete: template is being used by tasks' }, { status: 409 });
    }
    
    await db.delete(sopTemplates).where(eq(sopTemplates.id, id));
    
    // 触发事件通知
    eventBus.emit({ type: 'sop_template_update', resourceId: id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/sop-templates/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete SOP template' }, { status: 500 });
  }
}
