/**
 * Skill API - 单个 Skill 操作
 * 
 * GET  /api/skills/[id] - 获取 Skill 详情（需要登录）
 * PUT  /api/skills/[id] - 更新 Skill 信息（创建者或管理员）
 * DELETE /api/skills/[id] - 删除 Skill（创建者或管理员）
 * 
 * 权限规则：
 * - active 状态的 Skill：所有用户可查看
 * - 非 active 状态的 Skill：仅创建者和管理员可查看
 * - 更新/删除：创建者或管理员
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, skillTrustRecords } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * 检查用户对 Skill 的访问权限
 */
function checkSkillAccess(
  skill: typeof skills.$inferSelect,
  userId: string | undefined,
  userRole: string
): { hasAccess: boolean; canEdit: boolean; isCreator: boolean } {
  const isCreator = skill.createdBy === userId;
  const isAdmin = userRole === 'admin';
  const isActive = skill.status === 'active';
  
  return {
    hasAccess: isActive || isCreator || isAdmin,
    canEdit: isCreator || isAdmin,
    isCreator,
  };
}

/**
 * GET /api/skills/[id] - 获取 Skill 详情
 */
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    const { id } = await context!.params;
    
    // 查询 Skill 详情
    const skillResult = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (skillResult.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skill = skillResult[0];
    
    // 权限检查
    const access = checkSkillAccess(skill, auth.userId, auth.userRole || 'member');
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    // 查询信任记录
    const trustRecords = await db
      .select()
      .from(skillTrustRecords)
      .where(eq(skillTrustRecords.skillId, id))
      .orderBy(desc(skillTrustRecords.operatedAt))
      .limit(10);
    
    return NextResponse.json({
      data: {
        ...skill,
        trustRecords,
        _access: access,
      },
    });
    
  } catch (error) {
    console.error('Error fetching skill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/skills/[id] - 更新 Skill 信息
 * 
 * 允许更新的字段:
 * - name, description, version, category（创建者或管理员）
 * - trustStatus（仅管理员）
 */
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    
    // 检查 Skill 是否存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skill = existing[0];
    
    // 权限检查
    const access = checkSkillAccess(skill, auth.userId, auth.userRole || 'member');
    if (!access.canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this skill' },
        { status: 403 }
      );
    }
    
    // 普通字段：创建者和管理员都可修改
    const normalFields = ['name', 'description', 'version', 'category'];
    // 敏感字段：仅管理员可修改
    const adminOnlyFields = ['trustStatus', 'externalPublished', 'externalUrl', 'status'];
    
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    for (const field of normalFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    // 管理员专属字段
    if (auth.userRole === 'admin') {
      for (const field of adminOnlyFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }
    } else if (adminOnlyFields.some(f => body[f] !== undefined)) {
      return NextResponse.json(
        { error: 'Only admin can modify trust status or publication settings' },
        { status: 403 }
      );
    }
    
    // 执行更新
    const result = await db
      .update(skills)
      .set(updates)
      .where(eq(skills.id, id))
      .returning();
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { updates },
    });
    
    return NextResponse.json({ data: result[0] });
    
  } catch (error) {
    console.error('Error updating skill:', error);
    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/skills/[id] - 删除 Skill
 * 
 * 仅允许创建者或管理员删除 draft 或 rejected 状态的 Skill
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    const { id } = await context!.params;
    
    // 检查 Skill 是否存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skill = existing[0];
    
    // 权限检查
    const access = checkSkillAccess(skill, auth.userId, auth.userRole || 'member');
    if (!access.canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this skill' },
        { status: 403 }
      );
    }
    
    // 状态检查：仅允许删除 draft 或 rejected
    if (!['draft', 'rejected'].includes(skill.status || '')) {
      return NextResponse.json(
        { error: 'Cannot delete skill in current status. Only draft or rejected skills can be deleted.' },
        { status: 400 }
      );
    }
    
    // 删除信任记录
    await db
      .delete(skillTrustRecords)
      .where(eq(skillTrustRecords.skillId, id));
    
    // 删除 Skill
    await db
      .delete(skills)
      .where(eq(skills.id, id));
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { deleted: true, skillKey: skill.skillKey },
    });
    
    return NextResponse.json({
      message: 'Skill deleted successfully',
      data: { id, skillKey: skill.skillKey },
    });
    
  } catch (error) {
    console.error('Error deleting skill:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
});
