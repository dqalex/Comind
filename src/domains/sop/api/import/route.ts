/**
 * SOP 模板导入 API
 * 
 * POST /api/sop-templates/import
 * 
 * 支持 JSON 和 Markdown (SKILL) 两种格式
 * - JSON: 完整的模板定义
 * - MD: 人类可读的 SKILL 格式，复用 parseSkillToTemplate 逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sopTemplates } from '@/db/schema';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import type { SOPStage, SOPCategory, KnowledgeConfig } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 合法阶段类型
const VALID_STAGE_TYPES = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
const VALID_CATEGORIES: SOPCategory[] = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'];

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown>;
    let rawText: string | null = null;

    // 支持两种内容类型
    if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
      rawText = await request.text();
      body = {};
    } else {
      body = await request.json();
      // 如果 body 有 content 或 markdown 字段，说明是 MD 格式
      if (body.content || body.markdown) {
        rawText = (body.content || body.markdown) as string;
      }
    }

    // 判断格式
    if (rawText && (rawText.trim().startsWith('---') || rawText.includes('## '))) {
      // Markdown (SKILL) 格式
      return await importFromMarkdown(rawText);
    } else if (body._format === 'teamclaw-sop-template') {
      // JSON 格式（完整模板定义）
      return await importFromJson(body);
    } else {
      return NextResponse.json({ 
        error: 'Invalid import format. Expected JSON with _format="teamclaw-sop-template" or Markdown (SKILL) format.' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[POST /api/sop-templates/import] Error:', error);
    return NextResponse.json({ error: 'Failed to import SOP template' }, { status: 500 });
  }
}

/**
 * 从 Markdown (SKILL) 格式导入（复用 parseSkillToTemplate 逻辑）
 */
async function importFromMarkdown(raw: string): Promise<NextResponse> {
  // 1. 解析 frontmatter
  const frontmatter: Record<string, string> = {};
  let body = raw;
  
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (m) frontmatter[m[1].trim()] = m[2].trim();
    }
    body = fmMatch[2];
  }

  // 2. 提取基本信息
  const name = frontmatter.name || 'Imported Template';
  const description = frontmatter.description || '';
  const category: SOPCategory = VALID_CATEGORIES.includes(frontmatter.category as SOPCategory)
    ? (frontmatter.category as SOPCategory)
    : 'custom';
  const icon = frontmatter.icon || 'clipboard-list';

  // 3. 解析 ## 标题 → 阶段（复用 parseSkillToTemplate 逻辑）
  const sectionRegex = /^##\s+(.+)$/gm;
  const sections: { label: string; content: string; startIdx: number }[] = [];
  let match;
  
  while ((match = sectionRegex.exec(body)) !== null) {
    sections.push({ label: match[1].trim(), content: '', startIdx: match.index + match[0].length });
  }
  
  for (let i = 0; i < sections.length; i++) {
    const end = i + 1 < sections.length ? body.lastIndexOf('\n##', sections[i + 1].startIdx) : body.length;
    sections[i].content = body.slice(sections[i].startIdx, end).trim();
  }

  // 4. 构建阶段
  const stages: SOPStage[] = [];
  let qualityChecklist: string[] = [];
  
  for (const sec of sections) {
    // Quality Checklist 特殊处理
    if (sec.label.toLowerCase() === 'quality checklist') {
      const checkItems = sec.content.match(/[-*]\s*\[?\s*\]?\s*(.+)/g);
      if (checkItems) {
        qualityChecklist = checkItems.map(item => item.replace(/[-*]\s*\[?\s*\]?\s*/, '').trim());
      }
      continue;
    }

    // 解析阶段类型和提示词
    let type: SOPStage['type'] = 'ai_auto';
    let prompt = sec.content;
    let outputType: SOPStage['outputType'] = 'markdown';
    let requiredInputs: SOPStage['requiredInputs'] = [];
    let estimatedMinutes: number | undefined;

    // 提取 type
    const typeMatch = sec.content.match(/[-*]\s*type\s*[:：]\s*(\w+)/i);
    if (typeMatch) {
      const rawType = typeMatch[1].toLowerCase();
      if (VALID_STAGE_TYPES.includes(rawType)) {
        type = rawType as SOPStage['type'];
      }
      prompt = prompt.replace(typeMatch[0], '').trim();
    }

    // 提取 prompt
    const promptMatch = prompt.match(/[-*]\s*prompt\s*[:：]\s*([\s\S]+?)(?=\n[-*]|\n##|$)/i);
    if (promptMatch) {
      prompt = promptMatch[1].trim();
    }

    // 提取 outputType
    const outputMatch = sec.content.match(/[-*]\s*outputType\s*[:：]\s*(\w+)/i);
    if (outputMatch) {
      outputType = outputMatch[1] as SOPStage['outputType'];
    }

    // 提取 inputs
    const inputsMatch = sec.content.match(/[-*]\s*inputs\s*[:：]\s*(.+)/i);
    if (inputsMatch) {
      const inputLabels = inputsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      requiredInputs = inputLabels.map(label => ({
        id: `input-${generateId()}`,
        label,
        type: 'text' as const,
        required: true,
      }));
    }

    // 提取 estimatedMinutes
    const estMatch = sec.content.match(/[-*]\s*estimatedMinutes\s*[:：]\s*(\d+)/i);
    if (estMatch) {
      estimatedMinutes = parseInt(estMatch[1], 10);
    }

    stages.push({
      id: `stage-${generateId()}`,
      label: sec.label,
      description: '',
      type,
      promptTemplate: type.startsWith('ai') || type === 'manual' ? prompt : '',
      outputType,
      outputLabel: '',
      requiredInputs: requiredInputs.length > 0 ? requiredInputs : undefined,
      estimatedMinutes,
    });
  }

  // 5. 第一段非标题文本作为 systemPrompt
  let systemPrompt = '';
  const firstPara = body.match(/^([^#][\s\S]*?)(?=\n##|\n$)/);
  if (firstPara && firstPara[1].trim()) {
    systemPrompt = firstPara[1].trim();
  }

  // 6. 创建模板
  const id = generateId();
  const now = new Date();

  await db.insert(sopTemplates).values({
    id,
    name: `${name}（导入）`,
    description,
    category,
    icon,
    status: 'draft',
    stages,
    requiredTools: [],
    systemPrompt,
    knowledgeConfig: null,
    outputConfig: null,
    qualityChecklist,
    isBuiltin: false,
    createdBy: 'import',
    createdAt: now,
    updatedAt: now,
  });

  eventBus.emit({ type: 'sop_template_update', resourceId: id });

  return NextResponse.json({
    id,
    name: `${name}（导入）`,
    status: 'draft',
    format: 'md',
    stages_count: stages.length,
    message: 'SOP 模板已导入（draft 状态）',
  }, { status: 201 });
}

/**
 * 从 JSON 格式导入（完整模板定义）
 */
async function importFromJson(body: Record<string, unknown>): Promise<NextResponse> {
  const name = body.name as string | undefined;
  const description = (body.description as string) || '';
  const category = body.category as string | undefined;
  const icon = (body.icon as string) || 'clipboard-list';
  const stages = body.stages;
  const requiredTools = body.requiredTools;
  const systemPrompt = (body.systemPrompt as string) || '';
  const knowledgeConfig = body.knowledgeConfig as KnowledgeConfig | null;
  const outputConfig = body.outputConfig as Record<string, unknown> | null;
  const qualityChecklist = body.qualityChecklist;

  // 校验必填字段
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing template name (name)' }, { status: 400 });
  }

  if (!Array.isArray(stages) || stages.length === 0) {
    return NextResponse.json({ error: 'Missing stage definition (stages), at least 1 stage required' }, { status: 400 });
  }

  // 校验阶段
  for (const stage of stages as SOPStage[]) {
    if (!stage.id || !stage.label || !stage.type) {
      return NextResponse.json({ error: 'Each stage must contain id, label, type' }, { status: 400 });
    }
    if (!VALID_STAGE_TYPES.includes(stage.type)) {
      return NextResponse.json({ error: `Invalid stage type: ${stage.type}` }, { status: 400 });
    }
  }

  // 校验分类
  const finalCategory: SOPCategory = VALID_CATEGORIES.includes(category as SOPCategory)
    ? (category as SOPCategory)
    : 'custom';

  // 为每个阶段生成新的 ID（避免 ID 冲突）
  const idMap = new Map<string, string>();
  const newStages = (stages as SOPStage[]).map(stage => {
    const newId = `stage-${generateId()}`;
    idMap.set(stage.id, newId);
    return { ...stage, id: newId };
  });

  // 更新 rollbackStageId 引用
  for (const stage of newStages) {
    if (stage.rollbackStageId) {
      if (idMap.has(stage.rollbackStageId)) {
        stage.rollbackStageId = idMap.get(stage.rollbackStageId);
      } else {
        stage.rollbackStageId = undefined;
      }
    }
  }

  const id = generateId();
  const now = new Date();

  await db.insert(sopTemplates).values({
    id,
    name: `${name}（导入）`,
    description,
    category: finalCategory,
    icon,
    status: 'draft' as const,
    stages: newStages,
    requiredTools: Array.isArray(requiredTools) ? requiredTools as string[] : [],
    systemPrompt,
    knowledgeConfig: knowledgeConfig || null,
    outputConfig: outputConfig as import('@/db/schema').OutputConfig | null,
    qualityChecklist: Array.isArray(qualityChecklist) ? qualityChecklist as string[] : [],
    isBuiltin: false,
    createdBy: 'import',
    createdAt: now,
    updatedAt: now,
  });

  eventBus.emit({ type: 'sop_template_update', resourceId: id });

  return NextResponse.json({
    id,
    name: `${name}（导入）`,
    status: 'draft',
    format: 'json',
    stages_count: newStages.length,
    message: 'SOP 模板已导入（draft 状态），请在管理页面确认后激活',
  }, { status: 201 });
}
