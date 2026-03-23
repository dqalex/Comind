/**
 * Skill 快照 API
 * 
 * GET  /api/skills/[id]/snapshots - 获取快照列表
 * POST /api/skills/[id]/snapshots - 创建新快照
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, skillSnapshots } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skills/[id]/snapshots - 获取快照列表
 * 
 * 注意：skillSnapshots 表按 agentId 索引，这里返回空数组
 * 实际的快照应该通过 Agent API 获取
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
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
    
    // skillSnapshots 按 agentId 索引，不直接关联 skill
    // 返回空数组，实际快照应通过 Agent API 查询
    return NextResponse.json({
      data: [],
      total: 0,
      message: 'Skill snapshots are indexed by agent. Use Agent API to query.',
    });
    
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/skills/[id]/snapshots - 创建新快照
 * 
 * 注意：快照创建需要指定 agentId
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { agentId } = body;
    
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
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }
    
    const skillData = skill[0];
    const now = new Date();
    
    // 创建快照记录
    const snapshotId = generateId();
    
    await db.insert(skillSnapshots).values({
      id: snapshotId,
      agentId,
      snapshotAt: now,
      skills: [{
        skillKey: skillData.skillKey,
        name: skillData.name,
        version: skillData.version || undefined,
        enabled: true,
      }],
      createdAt: now,
    });
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { snapshotId, agentId },
    });
    
    return NextResponse.json({
      data: {
        id: snapshotId,
        skillId: id,
        agentId,
        snapshotAt: now,
      },
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
