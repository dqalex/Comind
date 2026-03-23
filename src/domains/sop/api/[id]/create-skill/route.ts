/**
 * 从 SOP 模板创建 Skill API
 *
 * POST /api/sop-templates/[id]/create-skill
 *
 * 流程：
 * 1. 生成 SKILL.md 文件
 * 2. 写入 skills 目录
 * 3. 复制到 Gateway skills 目录
 * 4. 调用 Gateway 安装
 * 5. 创建数据库记录（status: pending_approval）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates, skills } from '@/db';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { generateSkillFromSOP } from '@/lib/skill-generator';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// 技能目录配置
const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.cwd(), 'skills');
const GATEWAY_SKILLS_DIR = process.env.GATEWAY_SKILLS_DIR || '/root/.openclaw/workspace/skills';

// POST /api/sop-templates/[id]/create-skill
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

    // 检查是否有阶段定义
    if (!template.stages || template.stages.length === 0) {
      return NextResponse.json({
        error: 'Cannot create skill: template has no stages defined'
      }, { status: 400 });
    }

    // 解析请求参数
    let autoSubmit = true; // 默认自动提交审批
    try {
      const body = await request.json();
      autoSubmit = body.autoSubmit !== false;
    } catch {
      // 无请求体，使用默认值
    }

    // 生成 skillKey
    const skillKey = `teamclaw.sop.${template.id}`;

    // 技能目录名（取 skillKey 最后一段作为目录名）
    const skillDirName = template.id;
    const skillDir = path.join(SKILLS_DIR, skillDirName);

    // 1. 生成 SKILL.md 内容
    const skillMd = generateSkillFromSOP(template);

    // 2. 写入本地 skills 目录
    if (!existsSync(skillDir)) {
      await mkdir(skillDir, { recursive: true });
    }
    await writeFile(path.join(skillDir, 'SKILL.md'), skillMd, 'utf-8');
    console.log(`[create-skill] Wrote SKILL.md to ${skillDir}`);

    // 3. 复制到 Gateway skills 目录（如果是生产环境）
    if (process.env.NODE_ENV === 'production' || process.env.DEPLOY_SERVER) {
      try {
        const gatewaySkillDir = path.join(GATEWAY_SKILLS_DIR, skillDirName);

        // 创建目录
        await execAsync(`mkdir -p "${gatewaySkillDir}"`);

        // 复制文件
        await execAsync(`cp "${path.join(skillDir, 'SKILL.md')}" "${gatewaySkillDir}/"`);

        console.log(`[create-skill] Copied to Gateway: ${gatewaySkillDir}`);
      } catch (copyError) {
        console.warn('[create-skill] Failed to copy to Gateway:', copyError);
        // 不阻止流程继续
      }
    }

    // 4. 检查是否已存在数据库记录
    const [existing] = await db.select().from(skills).where(eq(skills.skillKey, skillKey));

    if (existing) {
      // 更新现有记录
      const [updated] = await db.update(skills)
        .set({
          name: template.name,
          description: template.description || '',
          version: template.version || '1.0.0',
          category: template.category as 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom',
          sopTemplateVersion: template.version,
          sopUpdateAvailable: false,
          skillPath: skillDir,
          skillMd: skillMd,
          status: autoSubmit ? 'pending_approval' : existing.status,
          updatedAt: new Date(),
        })
        .where(eq(skills.id, existing.id))
        .returning();

      // 触发 SSE 事件
      eventBus.emit({ type: 'skill_update', resourceId: updated.id });

      return NextResponse.json({
        skill: updated,
        action: 'updated',
        message: 'Skill updated successfully',
      });
    }

    // 5. 创建新 Skill 记录（status: pending_approval，等待审核）
    const skillId = `sk_${Date.now().toString(36)}`;
    const now = new Date();

    const [newSkill] = await db.insert(skills).values({
      id: skillId,
      skillKey,
      name: template.name,
      description: template.description || '',
      version: template.version || '1.0.0',
      category: template.category as 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom',
      source: 'teamclaw',
      sopTemplateId: template.id,
      sopTemplateVersion: template.version,
      sopUpdateAvailable: false,
      status: 'pending_approval', // 等待审核
      trustStatus: 'pending',
      isSensitive: false,
      skillPath: skillDir,
      skillMd: skillMd,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
    }).returning();

    // 触发 SSE 事件
    eventBus.emit({ type: 'skill_update', resourceId: newSkill.id });

    return NextResponse.json({
      skill: newSkill,
      action: 'created',
      skillPath: skillDir,
      message: 'Skill created and submitted for approval. Admin needs to review in SkillHub.',
    });
  } catch (error) {
    console.error('[POST /api/sop-templates/[id]/create-skill] Error:', error);
    return NextResponse.json({
      error: 'Failed to create skill: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}
