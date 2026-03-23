/**
 * 生成 SKILL.md API
 * 
 * POST /api/sop-templates/[id]/generate-skill
 * 从 SOP 模板生成符合规范的 SKILL.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates } from '@/db';
import { eq } from 'drizzle-orm';
import { generateSkillFromSOP, generateSkillPackage } from '@/lib/skill-generator';

export const dynamic = 'force-dynamic';

// POST /api/sop-templates/[id]/generate-skill
export async function POST(
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
        error: 'Cannot generate skill: template has no stages defined' 
      }, { status: 400 });
    }
    
    // 解析请求参数
    let format: 'markdown' | 'package' = 'markdown';
    try {
      const body = await request.json();
      if (body.format === 'package') {
        format = 'package';
      }
    } catch {
      // 无请求体，使用默认格式
    }
    
    if (format === 'package') {
      // 返回完整安装包
      const pkg = generateSkillPackage(template);
      return NextResponse.json(pkg);
    } else {
      // 仅返回 SKILL.md 内容
      const skillMd = generateSkillFromSOP(template);
      return NextResponse.json({ 
        skillMd,
        templateId: id,
        templateName: template.name,
        version: template.version,
      });
    }
  } catch (error) {
    console.error('[POST /api/sop-templates/[id]/generate-skill] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate skill: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}
