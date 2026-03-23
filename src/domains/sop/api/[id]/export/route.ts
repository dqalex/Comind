/**
 * SOP 模板导出 API
 * 
 * GET /api/sop-templates/[id]/export?format=json|md
 * 
 * 返回 JSON 或 Markdown (SKILL) 格式的模板数据
 * - JSON: 完整的模板定义，包含所有字段
 * - MD (SKILL): 人类可读的格式，适合分享和版本控制
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sopTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SOPStage } from '@/db/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const template = await db.query.sopTemplates.findFirst({
      where: eq(sopTemplates.id, id),
    });

    if (!template) {
      return NextResponse.json({ error: 'SOP template not found' }, { status: 404 });
    }

    // 安全的文件名
    const safeName = template.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');

    if (format === 'md' || format === 'markdown') {
      // Markdown (SKILL) 格式
      const mdContent = generateSkillMarkdown(template);
      return new NextResponse(mdContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}.md"`,
        },
      });
    }

    // JSON 格式（默认）
    const exportData = {
      _format: 'teamclaw-sop-template',
      _version: '1.0',
      _exportedAt: new Date().toISOString(),
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      stages: template.stages,
      requiredTools: template.requiredTools,
      systemPrompt: template.systemPrompt,
      knowledgeConfig: template.knowledgeConfig,
      outputConfig: template.outputConfig,
      qualityChecklist: template.qualityChecklist,
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="${safeName}.json"`,
      },
    });
  } catch (error) {
    console.error('[API] GET /sop-templates/[id]/export error:', error);
    return NextResponse.json({ error: 'Failed to export SOP template' }, { status: 500 });
  }
}

/**
 * 生成 SKILL 格式的 Markdown（与 SOPTemplateEditor.generateMarkdown 一致）
 */
function generateSkillMarkdown(template: typeof sopTemplates.$inferSelect): string {
  const lines: string[] = [];
  
  // Frontmatter
  lines.push('---');
  lines.push(`name: ${template.name}`);
  if (template.description) lines.push(`description: ${template.description}`);
  if (template.category && template.category !== 'custom') {
    lines.push(`category: ${template.category}`);
  }
  if (template.icon) lines.push(`icon: ${template.icon}`);
  lines.push('---');
  lines.push('');

  // System Prompt（第一段非标题文本）
  if (template.systemPrompt) {
    lines.push(template.systemPrompt);
    lines.push('');
  }

  // Stages（## 标题格式）
  const stages = template.stages as SOPStage[] || [];
  for (const stage of stages) {
    lines.push(`## ${stage.label || '未命名阶段'}`);
    lines.push(`- type: ${stage.type}`);
    if (stage.promptTemplate) {
      lines.push(`- prompt: ${stage.promptTemplate}`);
    }
    if (stage.outputType && stage.outputType !== 'text') {
      lines.push(`- outputType: ${stage.outputType}`);
    }
    if (stage.requiredInputs && stage.requiredInputs.length > 0) {
      lines.push(`- inputs: ${stage.requiredInputs.map(i => i.label || i.id).join(', ')}`);
    }
    if (stage.estimatedMinutes) {
      lines.push(`- estimatedMinutes: ${stage.estimatedMinutes}`);
    }
    lines.push('');
  }

  // Quality Checklist（可选）
  const checklist = template.qualityChecklist as string[] || [];
  if (checklist.length > 0) {
    lines.push('## Quality Checklist');
    for (const item of checklist) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
