/**
 * Skill 拒绝 API
 * 
 * POST /api/skills/[id]/untrust - 拒绝 Skill 并可选卸载
 * 
 * 权限：仅管理员
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, skillTrustRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getServerGatewayClient } from '@/lib/server-gateway-client';
import { RPC_METHODS } from '@/lib/rpc-methods';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/[id]/untrust - 拒绝 Skill
 * 
 * 请求体:
 * {
 *   agentId?: string;   // 指定 Agent ID
 *   uninstall?: boolean; // 是否同时卸载（默认 false）
 *   note?: string;      // 拒绝原因
 * }
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    // 仅管理员可操作
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can untrust skills' },
        { status: 403 }
      );
    }
    
    const { id } = await context!.params;
    const body = await request.json();
    const { agentId, uninstall = false, note } = body;
    
    // 检查 Skill 是否存在
    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (skill.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skillData = skill[0];
    const now = new Date();
    
    // 更新 Skill 信任状态为 untrusted
    await db
      .update(skills)
      .set({
        trustStatus: 'untrusted',
        updatedAt: now,
      })
      .where(eq(skills.id, id));
    
    // 创建拒绝记录
    const recordId = generateId();
    
    await db.insert(skillTrustRecords).values({
      id: recordId,
      skillId: id,
      agentId: agentId || 'global',
      action: 'untrust',
      note: note || null,
      operatedBy: auth.userId!,
      operatedAt: now,
      createdAt: now,
    } as typeof skillTrustRecords.$inferInsert);
    
    let uninstalledFrom: string[] = [];
    
    // 如果需要卸载
    if (uninstall) {
      const gateway = getServerGatewayClient();
      const agentsToUninstall = agentId 
        ? [agentId] 
        : (skillData.installedAgents || []);
      
      if (gateway.isConnected && agentsToUninstall.length > 0) {
        try {
          // 禁用 Skill
          await gateway.request(RPC_METHODS.SKILLS_UPDATE, { 
            skillKey: skillData.skillKey, 
            enabled: false 
          });
          
          // 记录卸载操作
          for (const targetAgentId of agentsToUninstall) {
            const uninstallRecordId = generateId();
            
            await db.insert(skillTrustRecords).values({
              id: uninstallRecordId,
              skillId: id,
              agentId: targetAgentId,
              action: 'uninstall',
              note: `Auto-uninstalled due to untrust: ${note || 'No reason provided'}`,
              operatedBy: auth.userId!,
              operatedAt: now,
              createdAt: now,
            } as typeof skillTrustRecords.$inferInsert);
            
            uninstalledFrom.push(targetAgentId);
          }
          
        } catch (gwError) {
          console.error('Gateway error during uninstall:', gwError);
          // 继续处理，不中断流程
        }
      }
      
      // 更新 installedAgents 列表
      if (uninstalledFrom.length > 0) {
        const remainingAgents = (skillData.installedAgents || []).filter(
          aid => !uninstalledFrom.includes(aid)
        );
        
        await db
          .update(skills)
          .set({
            installedAgents: remainingAgents,
            updatedAt: now,
          })
          .where(eq(skills.id, id));
      }
    }
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { 
        trustStatus: 'untrusted',
        uninstalled: uninstalledFrom.length > 0,
        agents: uninstalledFrom,
      },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId: id,
        skillKey: skillData.skillKey,
        trustStatus: 'untrusted',
        uninstalledFrom,
      },
      message: uninstall && uninstalledFrom.length > 0
        ? `Skill rejected and uninstalled from ${uninstalledFrom.length} agent(s)`
        : 'Skill rejected',
    });
    
  } catch (error) {
    console.error('Error untrusting skill:', error);
    return NextResponse.json(
      { error: 'Failed to untrust skill' },
      { status: 500 }
    );
  }
});
