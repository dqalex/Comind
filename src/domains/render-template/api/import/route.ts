/**
 * Render 模板导入 API
 * 
 * POST /api/render-templates/import
 * 
 * 接收 Markdown 格式的模板文件（类似 landingpage-template.md 格式）
 * 解析 HTML Template、Markdown Template、CSS、Slots、Sections 等部分
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renderTemplates } from '@/db/schema';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import type { SlotDef, SectionDef } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

type RenderCategory = 'report' | 'card' | 'poster' | 'presentation' | 'custom';
type ExportMode = '16:9' | 'long' | 'a4' | 'custom';
type ExportConfig = {
  formats: ('jpg' | 'png' | 'html' | 'pdf')[];
  defaultWidth?: number;
  defaultScale?: number;
  mode?: ExportMode;
};

const VALID_CATEGORIES: RenderCategory[] = ['report', 'card', 'poster', 'presentation', 'custom'];
const VALID_FORMATS = ['jpg', 'png', 'html', 'pdf'];

interface ParsedTemplate {
  name: string;
  description: string;
  category: RenderCategory;
  formats: string[];
  defaultWidth: number;
  defaultScale: number;
  mode: string;
  slots: Record<string, SlotDef>;
  sections: SectionDef[];
  htmlTemplate: string;
  mdTemplate: string;
  cssTemplate: string;
}

export async function POST(request: NextRequest) {
  try {
    // 获取请求体（支持 JSON 或 text/markdown）
    const contentType = request.headers.get('content-type') || '';
    
    let mdContent: string;
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      mdContent = body.content || body.markdown || '';
    } else {
      mdContent = await request.text();
    }

    if (!mdContent || typeof mdContent !== 'string') {
      return NextResponse.json({ error: 'Missing template content' }, { status: 400 });
    }

    // 解析 Markdown 内容
    const parsed = parseTemplateMarkdown(mdContent);

    // 校验必填字段
    if (!parsed.name || !parsed.htmlTemplate) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and HTML template are required' 
      }, { status: 400 });
    }

    // 校验格式
    const validFormats = parsed.formats.filter(f => VALID_FORMATS.includes(f)) as ('jpg' | 'png' | 'html' | 'pdf')[];
    if (validFormats.length === 0) {
      validFormats.push('jpg'); // 默认格式
    }

    // 校验分类
    const finalCategory: RenderCategory = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'custom';

    const id = generateId();
    const now = new Date();

    // 创建模板
    await db.insert(renderTemplates).values({
      id,
      name: `${parsed.name}（导入）`,
      description: parsed.description,
      category: finalCategory,
      status: 'draft',
      htmlTemplate: parsed.htmlTemplate,
      cssTemplate: parsed.cssTemplate,
      mdTemplate: parsed.mdTemplate,
      slots: parsed.slots,
      sections: parsed.sections,
      exportConfig: {
        formats: validFormats,
        defaultWidth: parsed.defaultWidth,
        defaultScale: parsed.defaultScale,
        mode: parsed.mode as ExportConfig['mode'],
      },
      isBuiltin: false,
      createdBy: 'import',
      createdAt: now,
      updatedAt: now,
    });

    eventBus.emit({ type: 'render_template_update', resourceId: id });

    return NextResponse.json({
      id,
      name: `${parsed.name}（导入）`,
      status: 'draft',
      slots_count: Object.keys(parsed.slots).length,
      sections_count: parsed.sections.length,
      message: 'Render 模板已导入（draft 状态），请在管理页面确认后激活',
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/render-templates/import] Error:', error);
    return NextResponse.json({ error: 'Failed to import render template' }, { status: 500 });
  }
}

/**
 * 解析 Markdown 格式的模板文件
 */
function parseTemplateMarkdown(content: string): ParsedTemplate {
  const result: ParsedTemplate = {
    name: 'Unnamed Template',
    description: '',
    category: 'custom',
    formats: ['jpg'],
    defaultWidth: 800,
    defaultScale: 2,
    mode: 'custom',
    slots: {},
    sections: [],
    htmlTemplate: '',
    mdTemplate: '',
    cssTemplate: '',
  };

  // 1. 解析 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    
    // 简单的 YAML 解析
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      result.name = parseYamlValue(nameMatch[1]);
    }
    
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      result.description = parseYamlValue(descMatch[1]);
    }
    
    const categoryMatch = frontmatter.match(/^category:\s*(\w+)/m);
    if (categoryMatch && VALID_CATEGORIES.includes(categoryMatch[1] as RenderCategory)) {
      result.category = categoryMatch[1] as RenderCategory;
    }
    
    const formatsMatch = frontmatter.match(/^formats:\s*\[([^\]]+)\]/m);
    if (formatsMatch) {
      result.formats = formatsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
    }
    
    const widthMatch = frontmatter.match(/^defaultWidth:\s*(\d+)/m);
    if (widthMatch) {
      result.defaultWidth = parseInt(widthMatch[1], 10);
    }
    
    const scaleMatch = frontmatter.match(/^defaultScale:\s*(\d+)/m);
    if (scaleMatch) {
      result.defaultScale = parseInt(scaleMatch[1], 10);
    }
    
    const modeMatch = frontmatter.match(/^mode:\s*(\S+)/m);
    if (modeMatch) {
      result.mode = modeMatch[1];
    }
  }

  // 2. 解析 Slots Definition (YAML 格式)
  const slotsMatch = content.match(/##\s*Slots\s*Definition\s*```yaml\n([\s\S]*?)```/i);
  if (slotsMatch) {
    result.slots = parseSlotsYaml(slotsMatch[1]);
  }

  // 3. 解析 Sections
  const sectionsMatch = content.match(/##\s*Sections\s*```yaml\n([\s\S]*?)```/i);
  if (sectionsMatch) {
    result.sections = parseSectionsYaml(sectionsMatch[1]);
  }

  // 4. 解析 HTML Template
  const htmlMatch = content.match(/##\s*HTML\s*Template\s*```html\n([\s\S]*?)```/i);
  if (htmlMatch) {
    result.htmlTemplate = htmlMatch[1].trim();
  }

  // 5. 解析 Markdown Template
  const mdMatch = content.match(/##\s*Markdown\s*Template\s*```markdown\n([\s\S]*?)```/i);
  if (mdMatch) {
    result.mdTemplate = mdMatch[1].trim();
  }

  // 6. 解析 CSS
  const cssMatch = content.match(/##\s*CSS\s*```css\n([\s\S]*?)```/i);
  if (cssMatch) {
    result.cssTemplate = cssMatch[1].trim();
  }

  // 如果没有解析到 slots，从 HTML 模板中提取 data-slot 属性
  if (Object.keys(result.slots).length === 0 && result.htmlTemplate) {
    result.slots = extractSlotsFromHtml(result.htmlTemplate);
  }

  return result;
}

/**
 * 解析 YAML 值（处理引号）
 */
function parseYamlValue(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * 解析 Slots YAML
 */
function parseSlotsYaml(yaml: string): Record<string, SlotDef> {
  const slots: Record<string, SlotDef> = {};
  const lines = yaml.split('\n');
  let currentSlot = '';

  for (const line of lines) {
    // 新 slot 开始（不带空格开头）
    const slotMatch = line.match(/^(\w+):$/);
    if (slotMatch) {
      currentSlot = slotMatch[1];
      slots[currentSlot] = { label: currentSlot, type: 'content' };
      continue;
    }

    // slot 属性（以空格开头）
    if (currentSlot && line.startsWith('  ')) {
      const labelMatch = line.match(/^\s+label:\s*(.+)$/);
      if (labelMatch) {
        slots[currentSlot].label = parseYamlValue(labelMatch[1]);
      }

      const typeMatch = line.match(/^\s+type:\s*(\w+)$/);
      if (typeMatch) {
        slots[currentSlot].type = typeMatch[1] as SlotDef['type'];
      }

      const placeholderMatch = line.match(/^\s+placeholder:\s*(.+)$/);
      if (placeholderMatch) {
        slots[currentSlot].placeholder = parseYamlValue(placeholderMatch[1]);
      }
    }
  }

  return slots;
}

/**
 * 解析 Sections YAML
 */
function parseSectionsYaml(yaml: string): SectionDef[] {
  const sections: SectionDef[] = [];
  const lines = yaml.split('\n');
  let currentSection: Partial<SectionDef> | null = null;

  for (const line of lines) {
    // 新 section 开始
    if (line.startsWith('- id:')) {
      if (currentSection && currentSection.id) {
        sections.push({
          id: currentSection.id,
          label: currentSection.label || currentSection.id,
          slots: currentSection.slots || [],
        });
      }
      currentSection = { id: line.replace('- id:', '').trim() };
      continue;
    }

    if (currentSection) {
      const labelMatch = line.match(/^\s+label:\s*(.+)$/);
      if (labelMatch) {
        currentSection.label = parseYamlValue(labelMatch[1]);
      }

      const slotsMatch = line.match(/^\s+slots:\s*\[([^\]]+)\]/);
      if (slotsMatch) {
        currentSection.slots = slotsMatch[1].split(',').map(s => s.trim());
      }
    }
  }

  // 添加最后一个 section
  if (currentSection && currentSection.id) {
    sections.push({
      id: currentSection.id,
      label: currentSection.label || currentSection.id,
      slots: currentSection.slots || [],
    });
  }

  return sections;
}

/**
 * 从 HTML 模板中提取 data-slot 属性
 */
function extractSlotsFromHtml(html: string): Record<string, SlotDef> {
  const slots: Record<string, SlotDef> = {};
  const slotRegex = /data-slot="([^"]+)"/g;
  let match;

  while ((match = slotRegex.exec(html)) !== null) {
    const slotId = match[1];
    if (!slots[slotId]) {
      slots[slotId] = {
        label: slotId,
        type: 'content',
      };
    }
  }

  return slots;
}
