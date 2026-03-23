/**
 * 项目成员单项操作 API
 * 
 * v0.9.8: 实现项目成员的更新和删除
 * 
 * 权限要求：
 * - PUT: 项目管理者（owner/admin）
 * - DELETE: 项目管理者（owner/admin），或成员自己退出
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, projectMembers, projects, type ProjectRole } from '@/db';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { checkProjectAccess, updateProjectMemberRole, removeProjectMember } from '@/lib/project-access';
import { isValidId } from '@/lib/security';
import { eventBus } from '@/lib/event-bus';

// ============================================================
// PUT /api/projects/[id]/members/[userId] - 更新成员角色
// ============================================================

export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const params = await context!.params;
    const projectId = params.id;
    const targetUserId = params.userId;
    const body = await request.json();
    
    // 校验参数格式
    if (!isValidId(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (!isValidId(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }
    
    // 检查是否有管理成员的权限
    const access = await checkProjectAccess(projectId, auth.userId!, auth.userRole!);
    if (!access.canManageMembers) {
      return NextResponse.json({ error: 'No permission to manage project members' }, { status: 403 });
    }
    
    // 检查是否是项目 owner（owner 角色不能被修改）
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId));
    
    if (project?.ownerId === targetUserId) {
      return NextResponse.json({ error: 'Owner role cannot be modified' }, { status: 400 });
    }
    
    // 校验新角色
    const { role } = body;
    const validRoles: ProjectRole[] = ['admin', 'member', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role, valid values: admin, member, viewer' }, { status: 400 });
    }
    
    // 检查成员是否存在
    const [existingMember] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, targetUserId)
      ));
    
    if (!existingMember) {
      return NextResponse.json({ error: 'User is not a project member' }, { status: 404 });
    }
    
    // 更新角色
    const result = await updateProjectMemberRole(projectId, targetUserId, role);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    // 通知项目更新
    eventBus.emit({ type: 'project_update', resourceId: projectId });
    
    return NextResponse.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    console.error('[PUT /api/projects/[id]/members/[userId]]', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
});

// ============================================================
// DELETE /api/projects/[id]/members/[userId] - 移除成员或自己退出
// ============================================================

export const DELETE = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const params = await context!.params;
    const projectId = params.id;
    const targetUserId = params.userId;
    
    // 校验参数格式
    if (!isValidId(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (!isValidId(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }
    
    // 获取项目访问权限
    const access = await checkProjectAccess(projectId, auth.userId!, auth.userRole!);
    
    // 判断操作类型：自己退出 vs 管理员移除他人
    const isSelfLeave = auth.userId === targetUserId;
    
    if (isSelfLeave) {
      // 自己退出：需要是项目成员，但不能是 owner
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'You are not a project member' }, { status: 403 });
      }
      if (access.isOwner) {
        return NextResponse.json({ error: 'Owner cannot leave project, please transfer ownership first' }, { status: 400 });
      }
    } else {
      // 移除他人：需要有管理成员的权限
      if (!access.canManageMembers) {
        return NextResponse.json({ error: 'No permission to manage project members' }, { status: 403 });
      }
      
      // 检查是否是项目 owner（owner 不能被移除）
      const [project] = await db
        .select({ ownerId: projects.ownerId })
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project?.ownerId === targetUserId) {
        return NextResponse.json({ error: 'Owner cannot be removed' }, { status: 400 });
      }
    }
    
    // 检查成员是否存在
    const [existingMember] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, targetUserId)
      ));
    
    if (!existingMember) {
      return NextResponse.json({ error: 'User is not a project member' }, { status: 404 });
    }
    
    // 移除成员
    const result = await removeProjectMember(projectId, targetUserId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    // 通知项目更新
    eventBus.emit({ type: 'project_update', resourceId: projectId });
    
    const message = isSelfLeave ? 'Left project successfully' : 'Member removed successfully';
    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('[DELETE /api/projects/[id]/members/[userId]]', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
});
