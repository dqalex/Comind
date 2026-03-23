/**
 * 导出 Skill 安装包 API
 * 
 * GET /api/sop-templates/[id]/export-skill
 * 返回 Skill 安装包文件结构（前端使用 JSZip 打包下载）
 * 
 * 注意：此 API 返回 JSON 格式的文件结构，前端需要使用 JSZip 或类似库
 * 将其打包为 .skill.zip 文件下载
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates } from '@/db';
import { eq } from 'drizzle-orm';
import { generateSkillPackage } from '@/lib/skill-generator';
import { createFilesFromSkillPackage } from '@/lib/skill-package';

export const dynamic = 'force-dynamic';

// GET /api/sop-templates/[id]/export-skill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 查询 SOP 模板
    const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    
    if (!template) {
      return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
    }
    
    // 检查是否有自定义阶段
    if (!template.stages || template.stages.length === 0) {
      return NextResponse.json({ 
        error: 'Cannot export: template has no stages defined' 
      }, { status: 400 });
    }
    
    // 生成 Skill 安装包
    const pkg = generateSkillPackage(template);
    
    // 转换为文件结构
    const files = createFilesFromSkillPackage(pkg);
    
    // 生成下载文件名
    const safeName = template.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${safeName}.skill.zip`;
    
    // 返回文件结构和元数据
    return NextResponse.json({
      success: true,
      filename,
      files,
      metadata: {
        id: template.id,
        name: template.name,
        version: template.version,
        category: template.category,
        stageCount: template.stages.length,
        referenceCount: (template.references || []).length,
        scriptCount: (template.scripts || []).length,
      },
    });
  } catch (error) {
    console.error('[GET /api/sop-templates/[id]/export-skill] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to export skill: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}
