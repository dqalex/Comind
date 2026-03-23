/**
 * 项目访问控制辅助函数
 * 
 * v3.0: 实现项目级权限控制
 * 
 * 访问规则：
 * - Admin 用户：可访问所有项目
 * - 普通用户：可访问自己拥有的项目 + 被邀请协作的项目 + 公开项目
 * 
 * 项目可见性：
 * - private: 仅 Owner 和协作者可见
 * - team: 团队成员可见（预留）
 * - public: 所有人可见
 */

import { db, projects, projectMembers, type ProjectRole } from '@/db';
import { eq, or, and, inArray, sql } from 'drizzle-orm';

// ============================================================
// 类型定义
// ============================================================

// 重新导出 ProjectRole 类型
export type { ProjectRole };

export interface ProjectAccessInfo {
  hasAccess: boolean;
  role: ProjectRole | 'public' | null;  // 用户在项目中的角色，public 表示通过公开访问
  isOwner: boolean;
  canEdit: boolean;   // 可编辑（owner/admin/member）
  canDelete: boolean; // 可删除（owner/admin）
  canManageMembers: boolean; // 可管理成员（owner/admin）
}

// ============================================================
// 核心权限检查函数
// ============================================================

/**
 * 检查用户对单个项目的访问权限
 */
export async function checkProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<ProjectAccessInfo> {
  // Admin 用户拥有所有权限
  if (userRole === 'admin') {
    return {
      hasAccess: true,
      role: 'admin',
      isOwner: false,  // Admin 不一定是 Owner
      canEdit: true,
      canDelete: true,
      canManageMembers: true,
    };
  }

  // 查询项目信息
  const [project] = await db.select({
    id: projects.id,
    ownerId: projects.ownerId,
    visibility: projects.visibility,
  }).from(projects).where(eq(projects.id, projectId));

  if (!project) {
    return {
      hasAccess: false,
      role: null,
      isOwner: false,
      canEdit: false,
      canDelete: false,
      canManageMembers: false,
    };
  }

  // 检查是否是 Owner
  if (project.ownerId === userId) {
    return {
      hasAccess: true,
      role: 'owner',
      isOwner: true,
      canEdit: true,
      canDelete: true,
      canManageMembers: true,
    };
  }

  // 检查是否是协作成员
  const [membership] = await db.select({
    role: projectMembers.role,
  }).from(projectMembers).where(
    and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))
  );

  if (membership) {
    const memberRole = membership.role as ProjectRole;
    return {
      hasAccess: true,
      role: memberRole,
      isOwner: false,
      canEdit: ['owner', 'admin', 'member'].includes(memberRole),
      canDelete: ['owner', 'admin'].includes(memberRole),
      canManageMembers: ['owner', 'admin'].includes(memberRole),
    };
  }

  // 检查是否是公开项目
  if (project.visibility === 'public') {
    return {
      hasAccess: true,
      role: 'public',
      isOwner: false,
      canEdit: false,  // 公开访问只读
      canDelete: false,
      canManageMembers: false,
    };
  }

  // 无访问权限
  return {
    hasAccess: false,
    role: null,
    isOwner: false,
    canEdit: false,
    canDelete: false,
    canManageMembers: false,
  };
}

/**
 * 获取用户可访问的项目 ID 列表
 */
export async function getAccessibleProjectIds(
  userId: string,
  userRole: string
): Promise<string[]> {
  // Admin 用户可以访问所有项目
  if (userRole === 'admin') {
    const allProjects = await db.select({ id: projects.id }).from(projects);
    return allProjects.map(p => p.id);
  }

  // 1. 获取用户拥有的项目
  const ownedProjects = await db.select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, userId));

  // 2. 获取用户协作的项目
  const collaboratingProjects = await db.select({ id: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  // 3. 获取公开项目
  const publicProjects = await db.select({ id: projects.id })
    .from(projects)
    .where(eq(projects.visibility, 'public'));

  // 合并去重
  const projectIds = new Set([
    ...ownedProjects.map(p => p.id),
    ...collaboratingProjects.map(p => p.id),
    ...publicProjects.map(p => p.id),
  ]);

  return Array.from(projectIds);
}

/**
 * 构建项目访问过滤条件（用于 Drizzle 查询）
 * 返回 SQL 条件，可直接用于 .where()
 */
export function buildProjectAccessFilter(userId: string, userRole: string) {
  // Admin 用户无需过滤
  if (userRole === 'admin') {
    return sql`1=1`;
  }

  // 普通用户：自己拥有的 OR 协作的 OR 公开的
  return or(
    eq(projects.ownerId, userId),
    eq(projects.visibility, 'public'),
    sql`${projects.id} IN (
      SELECT project_id FROM project_members WHERE user_id = ${userId}
    )`
  );
}

// ============================================================
// 项目成员管理
// ============================================================

/**
 * 添加项目成员
 */
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const id = `pm-${projectId.slice(-6)}-${userId.slice(-6)}-${Date.now().toString(36)}`;
    await db.insert(projectMembers).values({
      id,
      projectId,
      userId,
      role,
      createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    // UNIQUE 约束冲突
    if ((error as Error).message?.includes('UNIQUE')) {
      return { success: false, error: '该用户已是项目成员' };
    }
    return { success: false, error: '添加成员失败' };
  }
}

/**
 * 移除项目成员
 */
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db.delete(projectMembers).where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: '移除成员失败' };
  }
}

/**
 * 更新项目成员角色
 */
export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  newRole: ProjectRole
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(projectMembers)
      .set({ role: newRole })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    return { success: true };
  } catch (error) {
    return { success: false, error: '更新角色失败' };
  }
}

/**
 * 获取项目所有成员
 */
export async function getProjectMembers(projectId: string) {
  return db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
}
