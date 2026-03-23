/**
 * 导入 Skill 安装包 API
 * 
 * POST /api/sop-templates/import-skill
 * 从 Skill 安装包文件结构创建 SOP 模板
 * 
 * 注意：此 API 接受 JSON 格式的文件结构（前端使用 JSZip 解析后上传）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates } from '@/db';
import { eq } from 'drizzle-orm';
import { parseSkillPackageFiles } from '@/lib/skill-package';
import { eventBus } from '@/lib/event-bus';
import { generateId } from '@/lib/id';

export const dynamic = 'force-dynamic';

// POST /api/sop-templates/import-skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求格式
    if (!body.files || typeof body.files !== 'object') {
      return NextResponse.json({ 
        error: 'Invalid request: missing files object' 
      }, { status: 400 });
    }
    
    // 解析文件结构
    const parseResult = parseSkillPackageFiles(body.files);
    
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: `Parse failed: ${parseResult.error}` 
      }, { status: 400 });
    }
    
    const { template, references, scripts, manifest } = parseResult;
    
    if (!template) {
      return NextResponse.json({ 
        error: 'No template data found in package' 
      }, { status: 400 });
    }
    
    // 检查是否已存在同名模板
    const templateName = template.name || 'Imported Skill';
    const [existing] = await db
      .select()
      .from(sopTemplates)
      .where(eq(sopTemplates.name, templateName))
      .limit(1);
    
    if (existing && !body.overwrite) {
      return NextResponse.json({ 
        error: 'Template with this name already exists',
        existingId: existing.id,
        hint: 'Set overwrite=true to update existing template'
      }, { status: 409 });
    }
    
    const now = new Date();
    
    if (existing && body.overwrite) {
      // 更新现有模板
      const updateData = {
        name: templateName,
        description: template.description || '',
        category: template.category || 'custom',
        version: template.version || '1.0.0',
        stages: template.stages || [],
        references: references || [],
        scripts: scripts || [],
        status: 'draft' as const,
        updatedAt: now,
      };
      
      await db
        .update(sopTemplates)
        .set(updateData)
        .where(eq(sopTemplates.id, existing.id));
      
      // 触发事件
      eventBus.emit({ type: 'sop_template_update', resourceId: existing.id });
      
      const [updated] = await db
        .select()
        .from(sopTemplates)
        .where(eq(sopTemplates.id, existing.id));
      
      return NextResponse.json({
        success: true,
        action: 'updated',
        template: updated,
        manifest,
      });
    } else {
      // 创建新模板
      const newId = template.id || generateId();
      
      await db.insert(sopTemplates).values({
        id: newId,
        name: templateName,
        description: template.description || '',
        category: template.category || 'custom',
        icon: 'clipboard-list',
        status: 'draft',
        version: template.version || '1.0.0',
        stages: template.stages || [],
        requiredTools: [],
        systemPrompt: '',
        references: references || [],
        scripts: scripts || [],
        isBuiltin: false,
        createdBy: 'import',
        createdAt: now,
        updatedAt: now,
      });
      
      // 触发事件
      eventBus.emit({ type: 'sop_template_update', resourceId: newId });
      
      const [created] = await db
        .select()
        .from(sopTemplates)
        .where(eq(sopTemplates.id, newId));
      
      return NextResponse.json({
        success: true,
        action: 'created',
        template: created,
        manifest,
      });
    }
  } catch (error) {
    console.error('[POST /api/sop-templates/import-skill] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to import skill: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}
