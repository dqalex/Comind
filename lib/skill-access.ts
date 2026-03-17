/**
 * Skill 权限检查模块
 * 
 * 实现多用户权限模型：
 * - active 状态的 Skill：系统级共享，所有用户可见
 * - 非 active 状态的 Skill：用户隔离，仅创建者和管理员可见
 * - 编辑/删除：创建者或管理员
 */

import { db } from '@/db';
import { skills } from '@/db/schema';
import { eq, or, SQL } from 'drizzle-orm';

// Skill 状态类型
export type SkillStatus = 'draft' | 'pending_approval' | 'active' | 'rejected';
export type SkillTrustStatus = 'trusted' | 'untrusted' | 'pending';

/**
 * Skill 访问权限结果
 */
export interface SkillAccessResult {
  /** 是否有访问权限 */
  hasAccess: boolean;
  /** 是否有编辑权限 */
  canEdit: boolean;
  /** 是否是创建者 */
  isCreator: boolean;
  /** 是否是管理员 */
  isAdmin: boolean;
  /** Skill 状态 */
  status: SkillStatus | null;
  /** 信任状态 */
  trustStatus: SkillTrustStatus | null;
}

/**
 * 检查用户对指定 Skill 的访问权限
 */
export async function checkSkillAccess(
  skillId: string,
  userId: string,
  userRole: string
): Promise<SkillAccessResult> {
  // 查询 Skill
  const skill = await db
    .select()
    .from(skills)
    .where(eq(skills.id, skillId))
    .limit(1);
  
  if (skill.length === 0) {
    return {
      hasAccess: false,
      canEdit: false,
      isCreator: false,
      isAdmin: false,
      status: null,
      trustStatus: null,
    };
  }
  
  const s = skill[0];
  const isCreator = s.createdBy === userId;
  const isAdmin = userRole === 'admin';
  const isActive = s.status === 'active';
  
  return {
    hasAccess: isActive || isCreator || isAdmin,
    canEdit: isCreator || isAdmin,
    isCreator,
    isAdmin,
    status: s.status as SkillStatus | null,
    trustStatus: s.trustStatus as SkillTrustStatus | null,
  };
}

/**
 * 构建用户可见的 Skill 列表过滤条件
 * 
 * 规则：
 * - Admin 用户：可见所有 Skill
 * - 普通用户：可见 active 状态 + 自己创建的任意状态
 */
export function buildSkillListFilter(
  userId: string,
  userRole: string
): SQL | undefined {
  if (userRole === 'admin') {
    // 管理员可见所有
    return undefined;
  }
  
  // 普通用户：active 或自己创建的
  return or(
    eq(skills.status, 'active'),
    eq(skills.createdBy, userId)
  );
}

/**
 * 获取用户可访问的所有 Skill ID 列表
 */
export async function getAccessibleSkillIds(
  userId: string,
  userRole: string
): Promise<string[]> {
  const filter = buildSkillListFilter(userId, userRole);
  
  const result = await db
    .select({ id: skills.id })
    .from(skills)
    .where(filter);
  
  return result.map(r => r.id);
}

/**
 * 检查用户是否可以修改 Skill 的信任状态
 * 仅管理员可以修改
 */
export function canModifyTrustStatus(userRole: string): boolean {
  return userRole === 'admin';
}

/**
 * 检查用户是否可以发布 Skill 到外部
 * 仅管理员可以发布
 */
export function canPublishExternally(userRole: string): boolean {
  return userRole === 'admin';
}

/**
 * 检查用户是否可以安装 Skill 到 Agent
 * 仅管理员可以安装
 */
export function canInstallToAgent(userRole: string): boolean {
  return userRole === 'admin';
}
