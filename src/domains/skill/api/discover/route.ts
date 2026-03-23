/**
 * Skill 发现 API
 * 
 * GET /api/skills/discover - 扫描项目 skills 文件夹，发现可安装的 Skill
 * 
 * 返回:
 * - 发现的 Skill 列表（包含版本信息）
 * - 安装状态（未安装/已安装/可更新）
 * - Gateway 实际状态（与数据库状态对比，检测不一致）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { discoverSkills, compareWithInstalledSkills, type DiscoveredSkill } from '@/lib/skill-discovery';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { getServerGatewayClient } from '@/lib/server-gateway-client';

/**
 * 与 Gateway 实际状态同步
 * 检查数据库中标记为 active 的 skill 是否真的在 Gateway 中可用
 * 如果不一致，标记 gatewayStatus 字段
 */
async function syncWithGatewayStatus(
  discoveredSkills: DiscoveredSkill[]
): Promise<DiscoveredSkill[]> {
  const gatewayClient = getServerGatewayClient();
  
  // 如果 Gateway 未连接，直接返回（不检查 Gateway 状态）
  if (!gatewayClient?.isConnected) {
    console.log('[Skill Discover] Gateway not connected, skipping Gateway status sync');
    return discoveredSkills.map(skill => ({
      ...skill,
      gatewayStatus: 'unknown' as const,
    }));
  }
  
  try {
    // 获取 Gateway 中实际的 skills 列表
    const gatewaySkills = await gatewayClient.request<{
      workspaceDir: string;
      managedSkillsDir: string;
      skills: Array<{ skillKey: string }>;
    }>('skills.status', {});
    
    const gatewaySkillKeys = new Set<string>(
      (gatewaySkills?.skills || []).map(s => s.skillKey)
    );
    
    console.log('[Skill Discover] Gateway skills:', Array.from(gatewaySkillKeys));
    
    // 对比并标记状态
    return discoveredSkills.map(skill => {
      // 只有本地状态是 active 的才需要检查 Gateway
      if (skill.localStatus !== 'active') {
        return {
          ...skill,
          gatewayStatus: 'not_applicable' as const,
        };
      }
      
      // 检查 Gateway 中是否存在
      // 注意：skillKey 可能被改为 teamclaw-xxx 格式
      const originalKey = skill.skillKey;
      const teamclawKey = `teamclaw-${skill.skillKey}`;
      
      const inGateway = gatewaySkillKeys.has(originalKey) || gatewaySkillKeys.has(teamclawKey);
      
      if (inGateway) {
        return {
          ...skill,
          gatewayStatus: 'installed' as const,
        };
      } else {
        // 状态不一致：数据库标记为 active，但 Gateway 中不存在
        console.warn(`[Skill Discover] Status mismatch: ${skill.skillKey} is active in DB but not in Gateway`);
        return {
          ...skill,
          gatewayStatus: 'not_installed' as const,
          // 标记为需要重新安装
          installStatus: 'not_installed' as const,
        };
      }
    });
  } catch (error) {
    console.error('[Skill Discover] Failed to sync with Gateway:', error);
    return discoveredSkills.map(skill => ({
      ...skill,
      gatewayStatus: 'error' as const,
    }));
  }
}

/**
 * GET /api/skills/discover - 发现项目内可安装的 Skill
 * 权限要求：管理员
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    // 权限检查：仅管理员可发现/安装 Skill
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permission required to discover skills' },
        { status: 403 }
      );
    }
    
    // 1. 扫描 skills 文件夹
    const discoveryResult = await discoverSkills();
    
    // 2. 获取已安装的 Skill（包括 draft/pending_approval/active 状态）
    // draft = 已发现未激活, pending_approval = 待审批, active = 已激活
    // 都不应该显示为"未安装"
    const installedSkills = await db
      .select({
        id: skills.id,
        skillKey: skills.skillKey,
        version: skills.version,
        status: skills.status,
      })
      .from(skills)
      .where(inArray(skills.status, ['draft', 'pending_approval', 'active']));
    
    // 3. 对比发现的 Skill 与已安装的
    let skillsWithStatus = compareWithInstalledSkills(
      discoveryResult.skills,
      installedSkills
    );
    
    // 4. 与 Gateway 实际状态同步
    skillsWithStatus = await syncWithGatewayStatus(skillsWithStatus);
    
    // 5. 分类统计（按本地状态）
    const stats = {
      total: skillsWithStatus.length,
      valid: skillsWithStatus.filter(s => s.valid).length,
      notRecorded: skillsWithStatus.filter(s => s.localStatus === 'not_recorded').length,
      draft: skillsWithStatus.filter(s => s.localStatus === 'draft').length,
      pendingApproval: skillsWithStatus.filter(s => s.localStatus === 'pending_approval').length,
      active: skillsWithStatus.filter(s => s.localStatus === 'active').length,
      // Gateway 状态不一致的数量
      gatewayMismatch: skillsWithStatus.filter(s => s.gatewayStatus === 'not_installed').length,
      updateAvailable: skillsWithStatus.filter(s => s.localStatus === 'active' && s.installStatus === 'update_available').length,
    };
    
    return NextResponse.json({
      skills: skillsWithStatus,
      stats,
      skillsFolderPath: discoveryResult.skillsFolderPath,
      errors: discoveryResult.errors.length > 0 ? discoveryResult.errors : undefined,
    });
    
  } catch (error) {
    console.error('Error discovering skills:', error);
    return NextResponse.json(
      { error: 'Failed to discover skills' },
      { status: 500 }
    );
  }
});
