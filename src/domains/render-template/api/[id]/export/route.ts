/**
 * Render 模板导出 API
 * 
 * GET /api/render-templates/[id]/export
 * 
 * 返回 Markdown 格式的模板文件（类似 landingpage-template.md 格式）
 * 包含 HTML Template、Markdown Template、CSS 三部分
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renderTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await db.query.renderTemplates.findFirst({
      where: eq(renderTemplates.id, id),
    });

    if (!template) {
      return NextResponse.json({ error: 'Render template not found' }, { status: 404 });
    }

    // 生成 Markdown 格式的模板文件
    const mdContent = generateTemplateMarkdown(template);

    // 安全的文件名
    const safeName = template.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');

    return new NextResponse(mdContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.md"`,
      },
    });
  } catch (error) {
    console.error('[API] GET /render-templates/[id]/export error:', error);
    return NextResponse.json({ error: 'Failed to export render template' }, { status: 500 });
  }
}

/**
 * 生成类似 landingpage-template.md 格式的 Markdown 文件
 */
function generateTemplateMarkdown(template: typeof renderTemplates.$inferSelect): string {
  const slots = template.slots as Record<string, { label: string; type: string; placeholder?: string }> || {};
  const sections = template.sections as { id: string; label: string; slots: string[] }[] || [];
  const exportConfig = template.exportConfig as { formats: string[]; defaultWidth?: number; defaultScale?: number; mode?: string } || { formats: ['jpg'] };

  // 生成 YAML frontmatter
  const frontmatter = `---
name: ${JSON.stringify(template.name)}
description: ${JSON.stringify(template.description || '')}
category: ${template.category}
formats: [${exportConfig.formats.join(', ')}]
defaultWidth: ${exportConfig.defaultWidth || 800}
defaultScale: ${exportConfig.defaultScale || 2}
mode: ${exportConfig.mode || 'custom'}
---

`;

  // 生成 Slots 定义
  let slotsSection = '';
  if (Object.keys(slots).length > 0) {
    slotsSection = '## Slots Definition\n```yaml\n';
    for (const [slotId, slot] of Object.entries(slots)) {
      slotsSection += `${slotId}:\n  label: ${JSON.stringify(slot.label)}\n  type: ${slot.type}\n`;
      if (slot.placeholder) {
        slotsSection += `  placeholder: ${JSON.stringify(slot.placeholder)}\n`;
      }
    }
    slotsSection += '```\n\n';
  }

  // 生成 Sections 定义
  let sectionsSection = '';
  if (sections.length > 0) {
    sectionsSection = '## Sections\n```yaml\n';
    for (const section of sections) {
      sectionsSection += `- id: ${section.id}\n  label: ${JSON.stringify(section.label)}\n  slots: [${section.slots.join(', ')}]\n`;
    }
    sectionsSection += '```\n\n';
  }

  // HTML Template
  const htmlSection = `## HTML Template
\`\`\`html
${template.htmlTemplate || '<div class="template"></div>'}
\`\`\`

`;

  // Markdown Template
  const mdSection = `## Markdown Template
\`\`\`markdown
${template.mdTemplate || '<!-- @slot:content -->\n内容占位'}
\`\`\`

`;

  // CSS
  const cssSection = `## CSS
\`\`\`css
${template.cssTemplate || '.template { }'}
\`\`\`
`;

  return frontmatter + slotsSection + sectionsSection + htmlSection + mdSection + cssSection;
}
