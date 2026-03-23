/**
 * 项目成员管理 API
 * 
 * v0.9.8: 实现项目协作者的增删改查
 * 
 * 权限要求：
 * - GET: 项目可访问者（owner/admin/member/viewer/public）
 * - POST: 项目管理者（owner/admin）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, projectMembers, users, projects, type ProjectRole } from '@/db';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { checkProjectAccess, addProjectMember } from '@/lib/project-access';
import { isValidId } from '@/lib/security';
import { eventBus } from '@/lib/event-bus';

// ============================================================
// GET /api/projects/[id]/members - 获取项目成员列表
// ============================================================

export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const { id: projectId } = await context!.params;
    
    // 校验 projectId 格式
    if (!isValidId(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    
    // 检查项目访问权限
    const access = await checkProjectAccess(projectId, auth.userId!, auth.userRole!);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'No access to this project' }, { status: 403 });
    }
    
    // 查询项目成员及用户信息
    const members = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        createdAt: projectMembers.createdAt,
        // 关联用户信息
        userName: users.name,
        userEmail: users.email,
        userAvatar: users.avatar,
      })
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));
    
    // 获取项目 owner 信息（不在 projectMembers 表中的情况）
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId));
    
    // 如果 owner 不在成员列表中，添加 owner 信息
    let result = members;
    if (project?.ownerId && !members.some(m => m.userId === project.ownerId)) {
      const [owner] = await db
        .select({ id: users.id, name: users.name, email: users.email, avatar: users.avatar })
        .from(users)
        .where(eq(users.id, project.ownerId));
      
      if (owner) {
        result = [
          {
            id: `owner-${projectId}`,
            userId: owner.id,
            role: 'owner' as ProjectRole,
            createdAt: null as unknown as Date,
            userName: owner.name,
            userEmail: owner.email,
            userAvatar: owner.avatar,
          },
          ...members,
        ];
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/projects/[id]/members]', error);
    return NextResponse.json({ error: 'Failed to get project members' }, { status: 500 });
  }
});

// ============================================================
// POST /api/projects/[id]/members - 添加项目成员
// ============================================================

export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const { id: projectId } = await context!.params;
    const body = await request.json();
    
    // 校验 projectId 格式
    if (!isValidId(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    
    // 检查是否有管理成员的权限
    const access = await checkProjectAccess(projectId, auth.userId!, auth.userRole!);
    if (!access.canManageMembers) {
      return NextResponse.json({ error: 'No permission to manage project members' }, { status: 403 });
    }
    
    // 校验请求参数
    const { userId, role } = body;
    
    if (!userId || !isValidId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }
    
    // 校验角色（不能添加 owner，owner 只能通过创建项目或转让）
    const validRoles: ProjectRole[] = ['admin', 'member', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role, valid values: admin, member, viewer' }, { status: 400 });
    }
    
    // 检查用户是否存在
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // 检查是否是项目 owner（owner 不能被重复添加）
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId));
    
    if (project?.ownerId === userId) {
      return NextResponse.json({ error: 'User is already project owner' }, { status: 400 });
    }
    
    // 添加成员
    const result = await addProjectMember(projectId, userId, role);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    // 通知项目更新
    eventBus.emit({ type: 'project_update', resourceId: projectId });
    
    return NextResponse.json({ success: true, message: 'Member added successfully' }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/[id]/members]', error);
    return NextResponse.json({ error: 'Failed to add project member' }, { status: 500 });
  }
});
