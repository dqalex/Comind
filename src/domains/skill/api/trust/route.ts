/**
 * Skill 信任 API（通过 skillKey）
 * 
 * POST /api/skills/trust - 根据 skillKey 信任 Skill（管理员）
 * 
 * 如果数据库中不存在该 Skill，会自动创建记录并信任
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, skillTrustRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/trust - 根据 skillKey 信任 Skill
 * 
 * Body:
 * - skillKey: string (required) - Gateway 技能的唯一标识
 * - name: string (optional) - 技能名称
 * - description: string (optional) - 技能描述
 * - note: string (optional) - 审核备注
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult
): Promise<NextResponse> => {
  try {
    // 仅管理员可操作
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can trust skills' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { skillKey, name, description, note } = body;
    
    if (!skillKey) {
      return NextResponse.json(
        { error: 'skillKey is required' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    
    // 查找现有 Skill 记录
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.skillKey, skillKey))
      .limit(1);
    
    let skillId: string;
    
    if (existing.length > 0) {
      // 更新现有记录
      skillId = existing[0].id;
      
      await db
        .update(skills)
        .set({
          trustStatus: 'trusted',
          source: existing[0].source === 'unknown' ? 'external' : existing[0].source,
          name: name || existing[0].name,
          description: description || existing[0].description,
          updatedAt: now,
        })
        .where(eq(skills.id, skillId));
    } else {
      // 创建新记录
      skillId = generateId();
      
      await db.insert(skills).values({
        id: skillId,
        skillKey,
        name: name || skillKey,
        description: description || null,
        source: 'external',
        trustStatus: 'trusted',
        status: 'active',
        discoveredAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // 创建信任记录
    const recordId = generateId();
    
    await db.insert(skillTrustRecords).values({
      id: recordId,
      skillId,
      agentId: 'global',
      action: 'trust',
      note: note || null,
      operatedBy: auth.userId!,
      operatedAt: now,
      createdAt: now,
    } as typeof skillTrustRecords.$inferInsert);
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: skillId,
      data: { skillKey, trustStatus: 'trusted' },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId,
        skillKey,
        trustStatus: 'trusted',
        isNew: existing.length === 0,
      },
      message: existing.length > 0 
        ? 'Skill trusted' 
        : 'Skill created and trusted',
    });
    
  } catch (error) {
    console.error('Error trusting skill:', error);
    return NextResponse.json(
      { error: 'Failed to trust skill' },
      { status: 500 }
    );
  }
});
