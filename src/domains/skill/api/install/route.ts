/**
 * Skill 安装 API
 * 
 * POST /api/skills/install - 从项目文件夹安装/更新 Skill
 * 
 * 请求体:
 * {
 *   skillPath: string;      // Skill 目录路径
 *   force?: boolean;        // 强制更新（忽略版本检查）
 * }
 * 
 * 功能:
 * - 新 Skill：创建并提交审批
 * - 已存在且版本更高：更新 Skill 信息
 * - 已存在且版本相同或更低：返回错误（除非 force=true）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, approvalRequests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateIdWithPrefix } from '@/lib/id';
import { 
  validateSkillDirectory, 
  generateSkillKey, 
  extractNamespace,
  detectSensitiveContent 
} from '@/lib/skill-validator';
import { isVersionHigher, normalizeVersion } from '@/lib/version-utils';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { nanoid } from 'nanoid';
import { readFile, access, rm, cp } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { getServerGatewayClient } from '@/lib/server-gateway-client';

// Gateway 的 workspace skills 目录（OpenClaw 会扫描此目录）
const GATEWAY_WORKSPACE_SKILLS_DIR = process.env.GATEWAY_WORKSPACE_SKILLS_DIR || '/root/.openclaw/workspace/skills';

/**
 * 复制 Skill 到 Gateway workspace/skills 目录
 * 让 Gateway 能够扫描到 TeamClaw 安装的 skill
 * 
 * 注意：使用复制而非软链接，因为：
 * 1. 软链接在 Windows 上需要管理员权限
 * 2. 复制是跨平台兼容的方案
 * 
 * 冲突处理：
 * - 如果目标目录已存在同名 skill，检查是否是同一个 skill
 * - 同一个 skill（name 匹配）：允许覆盖（版本更新）
 * - 不同 skill：自动添加 `teamclaw-` 前缀避免冲突
 */
async function copySkillToGateway(
  skillPath: string, 
  skillKey: string,
  skillName: string
): Promise<{ success: boolean; error?: string; actualSkillKey?: string }> {
  try {
    let targetDir = path.join(GATEWAY_WORKSPACE_SKILLS_DIR, skillKey);
    let actualSkillKey = skillKey;
    
    // 确保 Gateway workspace skills 目录存在
    const { mkdir } = await import('fs/promises');
    await mkdir(GATEWAY_WORKSPACE_SKILLS_DIR, { recursive: true });
    
    // 检查目标目录是否已存在
    try {
      await access(targetDir, constants.F_OK);
      
      // 目标已存在，检查是否是同一个 skill
      const targetSkillMdPath = path.join(targetDir, 'SKILL.md');
      try {
        const targetContent = await readFile(targetSkillMdPath, 'utf-8');
        // 提取目标 skill 的 name
        const nameMatch = targetContent.match(/^name:\s*(.+)$/m);
        const targetName = nameMatch ? nameMatch[1].trim() : null;
        
        if (targetName && targetName !== skillName) {
          // 名称不同，说明是不同的 skill，使用 teamclaw- 前缀
          actualSkillKey = `teamclaw-${skillKey}`;
          targetDir = path.join(GATEWAY_WORKSPACE_SKILLS_DIR, actualSkillKey);
          console.log(`[Skill Install] Conflict detected: "${skillKey}" contains different skill "${targetName}". Using "${actualSkillKey}" instead.`);
          
          // 检查新目录是否也存在
          try {
            await access(targetDir, constants.F_OK);
            // 新目录也存在，先删除
            await rm(targetDir, { recursive: true, force: true });
            console.log(`[Skill Install] Removed existing directory: ${targetDir}`);
          } catch {
            // 新目录不存在，直接使用
          }
        } else {
          // 名称相同，是同一个 skill 的更新版本，允许覆盖
          console.log(`[Skill Install] Updating existing skill: ${skillName}`);
          await rm(targetDir, { recursive: true, force: true });
          console.log(`[Skill Install] Removed existing skill directory: ${targetDir}`);
        }
      } catch {
        // 目标目录没有 SKILL.md，可能是损坏的目录，允许覆盖
        console.log(`[Skill Install] Target directory has no SKILL.md, will overwrite`);
        await rm(targetDir, { recursive: true, force: true });
      }
    } catch {
      // 目标不存在，直接复制
    }
    
    // 复制整个 skill 目录到 Gateway 扫描目录
    await cp(skillPath, targetDir, { recursive: true });
    console.log(`[Skill Install] Copied skill to Gateway: ${skillPath} -> ${targetDir}`);
    return { success: true, actualSkillKey };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Skill Install] Failed to copy skill to Gateway:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * POST /api/skills/install - 安装或更新 Skill
 * 权限要求：管理员
 */
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    // 权限检查：仅管理员可安装/更新 Skill
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permission required to install skills' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { skillPath, force = false } = body;
    
    if (!skillPath) {
      return NextResponse.json(
        { error: 'skillPath is required' },
        { status: 400 }
      );
    }
    
    // 1. 验证 Skill 目录
    const validation = await validateSkillDirectory(skillPath);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Skill validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }
    
    if (!validation.skill) {
      return NextResponse.json(
        { error: 'Skill structure not found' },
        { status: 400 }
      );
    }
    
    const skillData = validation.skill;
    const newVersion = normalizeVersion(skillData.version || '1.0.0');
    
    // 2. 读取 SKILL.md 内容
    let skillMdContent: string | null = null;
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      skillMdContent = await readFile(skillMdPath, 'utf-8');
    } catch (err) {
      console.warn('Failed to read SKILL.md content:', err);
      // 不阻止安装，只是不存储原始内容
    }
    
    // 3. 生成 Skill Key - 使用目录名（与 Gateway 保持一致）
    const namespace = extractNamespace(skillPath);
    // Gateway 使用目录名作为 skillKey，例如 "teamclaw"
    const skillKey = namespace;
    
    // 4. 检查是否已存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.skillKey, skillKey))
      .limit(1);
    
    // 5. 敏感内容检测
    const sensitiveDetection = detectSensitiveContent(
      `${skillData.name}\n${skillData.description}\n${skillData.objective || ''}\n${skillData.workflow || ''}`
    );
    
    const now = new Date();

    // 情况 A: 新 Skill - 创建
    if (existing.length === 0) {
      const skillId = generateIdWithPrefix('skill');

      await db.insert(skills).values({
        id: skillId,
        skillKey,
        name: skillData.name,
        description: skillData.description || '',
        version: newVersion,
        category: skillData.category || 'custom',
        source: 'teamclaw',
        sopTemplateId: null,
        createdBy: auth.userId!,
        // TeamClaw 安装的技能默认信任（但仍需审批才能激活）
        trustStatus: 'trusted',
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityNote: sensitiveDetection.isSensitive 
          ? sensitiveDetection.reasons.join('; ')
          : null,
        status: 'draft',
        skillPath,
        skillMd: skillMdContent,
        createdAt: now,
        updatedAt: now,
      });
      
      // 创建审批请求
      const approvalId = nanoid(12);
      
      await db.insert(approvalRequests).values({
        id: approvalId,
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: skillId,
        requesterId: auth.userId!,
        payload: {
          skillKey,
          skillName: skillData.name,
          category: skillData.category,
          isSensitive: sensitiveDetection.isSensitive,
          validationWarnings: validation.warnings,
        } as Record<string, unknown>,
        requestNote: `Install skill from project folder: ${skillData.name}`,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      
      // 发送 SSE 事件
      eventBus.emit({ 
        type: 'skill_update',
        resourceId: skillId,
        data: { 
          skillKey, 
          approvalId,
          isSensitive: sensitiveDetection.isSensitive,
        },
      });
      
      // 调用 Gateway 安装技能
      try {
        const gatewayClient = getServerGatewayClient();
        if (gatewayClient?.isConnected) {
          // 1. 先复制 skill 到 Gateway workspace/skills 目录
          const copyResult = await copySkillToGateway(skillPath, skillKey, skillData.name);
          if (!copyResult.success) {
            console.warn('[Skill Install] Failed to copy skill to Gateway:', copyResult.error);
          }
          
          // 2. 再调用 Gateway skills.install API（使用实际的 skillKey）
          const installSkillKey = copyResult.actualSkillKey || skillKey;
          await gatewayClient.request('skills.install', { 
            name: installSkillKey, 
            installId: `install-${skillId}` 
          });
          console.log(`[Skill Install] Successfully installed to Gateway: ${installSkillKey}`);
        }
      } catch (gatewayError) {
        console.warn('[Skill Install] Gateway install failed:', gatewayError);
        // Gateway 安装失败不阻止本地记录创建
      }
      
      return NextResponse.json({
        data: {
          id: skillId,
          skillKey,
          name: skillData.name,
          version: newVersion,
          status: 'draft',
          approvalId,
          action: 'created',
          isSensitive: sensitiveDetection.isSensitive,
          sensitivityReasons: sensitiveDetection.reasons,
          validationWarnings: validation.warnings,
        },
        message: sensitiveDetection.isSensitive 
          ? 'Skill installed with sensitive content detected. Approval required.'
          : 'Skill installed successfully. Waiting for approval.',
      }, { status: 201 });
    }
    
    // 情况 B: 已存在 - 检查是否需要更新
    const existingSkill = existing[0];
    const isUpdateAvailable = isVersionHigher(newVersion, existingSkill.version || '1.0.0');
    
    if (!isUpdateAvailable && !force) {
      return NextResponse.json({
        data: {
          id: existingSkill.id,
          skillKey,
          name: existingSkill.name,
          installedVersion: existingSkill.version,
          newVersion,
          action: 'no_update',
        },
        message: `Skill "${skillData.name}" is already installed with version ${existingSkill.version}. New version (${newVersion}) is not higher. Use force=true to override.`,
      }, { status: 200 });
    }
    
    // 情况 C: 更新现有 Skill
    // 权限已在入口处检查（仅管理员）
    
    // 更新 Skill
    await db
      .update(skills)
      .set({
        name: skillData.name,
        description: skillData.description || existingSkill.description,
        version: newVersion,
        category: skillData.category || existingSkill.category,
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityNote: sensitiveDetection.isSensitive 
          ? sensitiveDetection.reasons.join('; ')
          : null,
        skillPath,
        skillMd: skillMdContent,
        updatedAt: now,
      })
      .where(eq(skills.id, existingSkill.id));
    
    // 发送 SSE 事件
    eventBus.emit({ 
      type: 'skill_update',
      resourceId: existingSkill.id,
      data: { 
        skillKey,
        previousVersion: existingSkill.version,
        newVersion,
      },
    });
    
    // 调用 Gateway 安装技能
    try {
      const gatewayClient = getServerGatewayClient();
      if (gatewayClient?.isConnected) {
        // 1. 先复制到 Gateway workspace/skills 目录
        const copyResult = await copySkillToGateway(skillPath, skillKey, skillData.name);
        if (!copyResult.success) {
          console.warn('[Skill Install] Failed to copy skill to Gateway:', copyResult.error);
        }
        
        // 2. 调用 Gateway skills.install API（使用实际的 skillKey）
        const installSkillKey = copyResult.actualSkillKey || skillKey;
        await gatewayClient.request('skills.install', { 
          name: installSkillKey, 
          installId: `install-${existingSkill.id}` 
        });
        console.log(`[Skill Install] Successfully updated in Gateway: ${installSkillKey}`);
      }
    } catch (gatewayError) {
      console.warn('[Skill Install] Gateway install failed:', gatewayError);
    }
    
    return NextResponse.json({
      data: {
        id: existingSkill.id,
        skillKey,
        name: skillData.name,
        previousVersion: existingSkill.version,
        newVersion,
        action: 'updated',
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityReasons: sensitiveDetection.reasons,
        validationWarnings: validation.warnings,
      },
      message: `Skill "${skillData.name}" updated from version ${existingSkill.version} to ${newVersion}.`,
    });
    
  } catch (error) {
    console.error('Error installing skill:', error);
    return NextResponse.json(
      { error: 'Failed to install skill' },
      { status: 500 }
    );
  }
});
