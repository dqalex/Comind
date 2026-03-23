/**
 * Skill 卸载 API
 * 
 * POST /api/skills/[id]/uninstall - 从 Agent 卸载 Skill
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
 * POST /api/skills/[id]/uninstall - 从 Agent 卸载 Skill
 * 
 * 请求体:
 * {
 *   agentId?: string;   // 指定 Agent ID，不传则从所有已安装 Agent 卸载
 *   note?: string;      // 卸载原因
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
        { error: 'Only admin can uninstall skills' },
        { status: 403 }
      );
    }
    
    const { id } = await context!.params;
    const body = await request.json();
    const { agentId, note } = body;
    
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
    const gateway = getServerGatewayClient();
    
    // 获取要卸载的 Agent 列表
    const agentsToUninstall = agentId 
      ? [agentId] 
      : (skillData.installedAgents || []);
    
    if (agentsToUninstall.length === 0) {
      return NextResponse.json({
        data: { success: true, uninstalled: 0 },
        message: 'Skill is not installed on any agent',
      });
    }
    
    const uninstalledAgents: string[] = [];
    const failedAgents: Array<{ agentId: string; error: string }> = [];
    
    // 通过 Gateway 禁用 Skill
    if (gateway.isConnected) {
      try {
        // 使用 skills.update 禁用 Skill
        await gateway.request(RPC_METHODS.SKILLS_UPDATE, { 
          skillKey: skillData.skillKey, 
          enabled: false 
        });
        
        // 记录所有 Agent 的卸载操作
        for (const targetAgentId of agentsToUninstall) {
          const recordId = generateId();
          
          await db.insert(skillTrustRecords).values({
            id: recordId,
            skillId: id,
            agentId: targetAgentId,
            action: 'uninstall',
            note: note || 'Uninstalled by admin',
            operatedBy: auth.userId!,
            operatedAt: now,
            createdAt: now,
          } as typeof skillTrustRecords.$inferInsert);
          
          uninstalledAgents.push(targetAgentId);
        }
        
      } catch (gwError) {
        console.error('Gateway error during uninstall:', gwError);
        failedAgents.push({
          agentId: 'gateway',
          error: String(gwError),
        });
      }
    } else {
      // Gateway 未连接，仅记录数据库操作（网关未连接）
      for (const targetAgentId of agentsToUninstall) {
        const recordId = generateId();
        
        await db.insert(skillTrustRecords).values({
          id: recordId,
          skillId: id,
          agentId: targetAgentId,
          action: 'uninstall',
          note: note || 'Uninstalled by admin (offline)',
          operatedBy: auth.userId!,
          operatedAt: now,
          createdAt: now,
        } as typeof skillTrustRecords.$inferInsert);
        
        uninstalledAgents.push(targetAgentId);
      }
    }
    
    // 更新 Skill 的 installedAgents 列表
    const remainingAgents = (skillData.installedAgents || []).filter(
      aid => !uninstalledAgents.includes(aid)
    );
    
    await db
      .update(skills)
      .set({
        installedAgents: remainingAgents,
        updatedAt: now,
      })
      .where(eq(skills.id, id));
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { 
        action: 'uninstalled',
        agents: uninstalledAgents,
        remaining: remainingAgents.length,
      },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId: id,
        skillKey: skillData.skillKey,
        uninstalledAgents,
        failedAgents,
        remainingAgents,
      },
      message: `Skill uninstalled from ${uninstalledAgents.length} agent(s)`,
    });
    
  } catch (error) {
    console.error('Error uninstalling skill:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall skill' },
      { status: 500 }
    );
  }
});
