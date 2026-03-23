import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts, openclawStatus, chatSessions, chatMessages, members, deliveries, users, scheduledTasks, scheduledTaskHistory } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { normalizeId } from '@/lib/id';
import { sanitizeMember } from '@/lib/sanitize';
import { encryptToken } from '@/lib/security';
import { validateEnum, VALID_DEPLOY_MODE, VALID_CONNECTION_STATUS, VALID_CONFIG_SOURCE, VALID_EXECUTION_MODE } from '@/lib/validators';
import { invalidateMemberCache } from '@/lib/markdown-sync';
import { eventBus } from '@/lib/event-bus';
import { withAuth, withAdminAuth } from '@/lib/with-auth';

/**
 * 兼容查找：先用 normalizedId 查，未找到且 normalizedId !== id 时用原始 id 回退
 */
async function findMember(id: string) {
  const normalizedId = normalizeId(id);
  let [found] = await db.select().from(members).where(eq(members.id, normalizedId));
  if (!found && normalizedId !== id) {
    [found] = await db.select().from(members).where(eq(members.id, id));
  }
  return found ?? null;
}

// GET /api/members/[id] - 获取单个成员
// v3.0: 需要登录才能访问（AI 成员是系统级共享，所有用户可见）
export const GET = withAuth(async (
  request: NextRequest,
  auth,
  context
) => {
  try {
    const { id } = await context!.params;
    const member = await findMember(id);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    return NextResponse.json(sanitizeMember(member));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 });
  }
});

// PUT /api/members/[id] - 更新成员
// v3.0: 需要管理员权限（AI 成员是系统级资源）
export const PUT = withAdminAuth(async (
  request: NextRequest,
  auth,
  context
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    const existing = await findMember(id);
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const resolvedId = existing.id;
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    const allowedFields = [
      'name', 'email', 'online', 'avatar',
      'openclawName', 'openclawDeployMode', 'openclawEndpoint', 
      'openclawConnectionStatus', 'openclawLastHeartbeat',
      'openclawAgentId', 'openclawApiToken', 'openclawModel',
      'openclawEnableWebSearch', 'openclawTemperature',
      'configSource', 'executionMode',
      'experienceTaskCount', 'experienceTaskTypes', 'experienceTools'
    ];
    
    const enumValidation: Record<string, readonly string[]> = {
      openclawDeployMode: VALID_DEPLOY_MODE,
      openclawConnectionStatus: VALID_CONNECTION_STATUS,
      configSource: VALID_CONFIG_SOURCE,
      executionMode: VALID_EXECUTION_MODE,
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'openclawApiToken' && typeof body[field] === 'string' && body[field].startsWith('***')) {
          continue;
        }
        if (enumValidation[field] && body[field] !== null) {
          if (!validateEnum(body[field], enumValidation[field] as readonly string[])) {
            return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 });
          }
        }
        // Token 加密存储
        if (field === 'openclawApiToken' && typeof body[field] === 'string') {
          updateData[field] = encryptToken(body[field]);
        } else if (field === 'openclawTemperature' && typeof body[field] === 'number') {
          // temperature 范围校验：0.0-2.0
          updateData[field] = Math.min(2.0, Math.max(0, body[field]));
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (updateData.openclawLastHeartbeat && typeof updateData.openclawLastHeartbeat === 'string') {
      updateData.openclawLastHeartbeat = new Date(updateData.openclawLastHeartbeat);
    }

    await db.update(members).set(updateData).where(eq(members.id, resolvedId));
    
    // 清除成员缓存
    invalidateMemberCache();
    
    const [updated] = await db.select().from(members).where(eq(members.id, resolvedId));
    // 问题 #11：PUT 后通知前端刷新
    eventBus.emit({ type: 'member_update', resourceId: resolvedId });
    return NextResponse.json(sanitizeMember(updated));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
});

// DELETE /api/members/[id] - 删除成员（级联清理关联数据）
// v3.0: 需要管理员权限（AI 成员是系统级资源）
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  auth,
  context
) => {
  try {
    const { id } = await context!.params;
    const existing = await findMember(id);
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    // v3.0: 禁止删除关联 admin 角色用户的成员
    if (existing.userId) {
      const [linkedUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, existing.userId));
      if (linkedUser?.role === 'admin') {
        return NextResponse.json({ error: 'Cannot delete admin member' }, { status: 403 });
      }
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      // 清理定时任务及其历史
      const memberScheduledTasks = tx
        .select({ id: scheduledTasks.id })
        .from(scheduledTasks)
        .where(eq(scheduledTasks.memberId, resolvedId))
        .all();
      
      const stIds = memberScheduledTasks.map(st => st.id);
      
      if (stIds.length > 0) {
        tx.delete(scheduledTaskHistory).where(inArray(scheduledTaskHistory.scheduledTaskId, stIds)).run();
      }
      
      tx.delete(scheduledTasks).where(eq(scheduledTasks.memberId, resolvedId)).run();
      tx.delete(openclawStatus).where(eq(openclawStatus.memberId, resolvedId)).run();

      // 清理 deliveries.reviewerId 引用（问题 #1）
      tx.update(deliveries)
        .set({ reviewerId: null })
        .where(eq(deliveries.reviewerId, resolvedId)).run();
      tx.delete(deliveries).where(eq(deliveries.memberId, resolvedId)).run();

      // 清理 openclawWorkspaces 及其级联（问题 #1）
      const memberWorkspaces = tx
        .select({ id: openclawWorkspaces.id })
        .from(openclawWorkspaces)
        .where(eq(openclawWorkspaces.memberId, resolvedId))
        .all();
      
      const wsIds = memberWorkspaces.map(w => w.id);
      if (wsIds.length > 0) {
        const wsFileIds = tx
          .select({ id: openclawFiles.id })
          .from(openclawFiles)
          .where(inArray(openclawFiles.workspaceId, wsIds))
          .all()
          .map(f => f.id);
        
        if (wsFileIds.length > 0) {
          tx.delete(openclawConflicts).where(inArray(openclawConflicts.fileId, wsFileIds)).run();
          tx.delete(openclawVersions).where(inArray(openclawVersions.fileId, wsFileIds)).run();
          tx.delete(openclawFiles).where(inArray(openclawFiles.workspaceId, wsIds)).run();
        }
        tx.delete(openclawWorkspaces).where(inArray(openclawWorkspaces.id, wsIds)).run();
      }

      // 清理 chatSessions（问题 #25）
      const memberSessions = tx
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.memberId, resolvedId))
        .all();
      const sessionIds = memberSessions.map(s => s.id);
      if (sessionIds.length > 0) {
        tx.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds)).run();
        tx.delete(chatSessions).where(eq(chatSessions.memberId, resolvedId)).run();
      }

      tx.delete(members).where(eq(members.id, resolvedId)).run();
    });
    
    // 清除成员缓存
    invalidateMemberCache();
    
    // 通知前端刷新（问题 #12）
    eventBus.emit({ type: 'member_update', resourceId: resolvedId });
    eventBus.emit({ type: 'schedule_update' });
    eventBus.emit({ type: 'delivery_update' });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/members]', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
});
