/**
 * Skill API - 列表与注册
 * 
 * GET  /api/skills - 获取 Skill 列表（需要登录）
 * POST /api/skills - 注册新 Skill（需要登录）
 * 
 * 权限规则：
 * - active 状态的 Skill：所有用户可见
 * - 非 active 状态的 Skill：仅创建者和管理员可见
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, approvalRequests } from '@/db/schema';
import { desc, eq, and, or, like, SQL } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { 
  validateSkillDirectory, 
  generateSkillKey, 
  extractNamespace,
  detectSensitiveContent 
} from '@/lib/skill-validator';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * 构建用户可见的 Skill 过滤条件
 */
function buildSkillAccessFilter(userId: string | undefined, userRole: string): SQL | undefined {
  if (userRole === 'admin') {
    return undefined;
  }

  if (!userId) {
    return eq(skills.status, 'active');
  }

  // viewer（观察者）只能看到 active 状态的 Skill
  if (userRole === 'viewer') {
    return eq(skills.status, 'active');
  }

  // member 可以看到 active + 自己创建的
  return or(
    eq(skills.status, 'active'),
    eq(skills.createdBy, userId)
  );
}

/**
 * GET /api/skills - 获取 Skill 列表
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult): Promise<NextResponse> => {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const trustStatus = searchParams.get('trustStatus');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const conditions: SQL[] = [];
    
    const accessFilter = buildSkillAccessFilter(auth.userId, auth.userRole || 'member');
    if (accessFilter) {
      conditions.push(accessFilter);
    }
    
    if (status) {
      conditions.push(eq(skills.status, status as typeof skills.$inferSelect.status));
    }
    
    if (category) {
      conditions.push(eq(skills.category, category as 'custom' | 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media'));
    }
    
    if (trustStatus) {
      conditions.push(eq(skills.trustStatus, trustStatus as typeof skills.$inferSelect.trustStatus));
    }
    
    if (source) {
      conditions.push(eq(skills.source, source as typeof skills.$inferSelect.source));
    }
    
    if (search) {
      conditions.push(
        or(
          like(skills.name, `%${search}%`),
          like(skills.description, `%${search}%`)
        )!
      );
    }
    
    const result = await db
      .select()
      .from(skills)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(skills.createdAt))
      .limit(limit)
      .offset(offset);
    
    const countResult = await db
      .select({ count: skills.id })
      .from(skills)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return NextResponse.json({
      data: result,
      total: countResult.length,
      limit,
      offset,
    });
    
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/skills - 注册新 Skill
 */
export const POST = withAuth(async (request: NextRequest, auth: AuthResult): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { skillPath, sopTemplateId } = body;
    
    if (!skillPath) {
      return NextResponse.json(
        { error: 'skillPath is required' },
        { status: 400 }
      );
    }
    
    // 验证 Skill 目录
    const validation = await validateSkillDirectory(skillPath);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Skill validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }
    
    if (!validation.skill) {
      return NextResponse.json(
        { error: 'Skill structure not found' },
        { status: 400 }
      );
    }
    
    const skillData = validation.skill;
    
    // 生成 Skill Key
    const namespace = extractNamespace(skillPath);
    const skillKey = generateSkillKey(
      namespace,
      skillData.category || 'custom',
      skillData.name
    );
    
    // 检查是否已存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.skillKey, skillKey))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Skill with key "${skillKey}" already exists` },
        { status: 409 }
      );
    }
    
    // 敏感内容检测
    const sensitiveDetection = detectSensitiveContent(
      `${skillData.name}\n${skillData.description}\n${skillData.objective || ''}\n${skillData.workflow || ''}`
    );
    
    // 创建 Skill 记录
    const skillId = generateId();
    const now = new Date();
    
    await db.insert(skills).values({
      id: skillId,
      skillKey,
      name: skillData.name,
      description: skillData.description || '',
      version: skillData.version || '1.0.0',
      category: skillData.category || 'custom',
      source: 'teamclaw',
      sopTemplateId: sopTemplateId || null,
      createdBy: auth.userId!,
      trustStatus: 'pending',
      isSensitive: sensitiveDetection.isSensitive,
      sensitivityNote: sensitiveDetection.isSensitive 
        ? sensitiveDetection.reasons.join('; ')
        : null,
      status: 'draft',
      skillPath,
      createdAt: now,
      updatedAt: now,
    });
    
    // 创建审批请求
    const approvalId = generateId();
    
    await db.insert(approvalRequests).values({
      id: approvalId,
      type: 'skill_publish',
      resourceType: 'skill',
      resourceId: skillId,
      requesterId: auth.userId!,
      payload: {
        skillKey,
        skillName: skillData.name,
        category: skillData.category,
        isSensitive: sensitiveDetection.isSensitive,
        validationWarnings: validation.warnings,
      },
      requestNote: `Register new skill: ${skillData.name}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: skillId,
      data: { 
        skillKey, 
        approvalId,
        isSensitive: sensitiveDetection.isSensitive,
      },
    });
    
    return NextResponse.json({
      data: {
        id: skillId,
        skillKey,
        name: skillData.name,
        status: 'draft',
        approvalId,
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityReasons: sensitiveDetection.reasons,
        validationWarnings: validation.warnings,
      },
      message: sensitiveDetection.isSensitive 
        ? 'Skill registered with sensitive content detected. Approval required.'
        : 'Skill registered successfully. Waiting for approval.',
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error registering skill:', error);
    return NextResponse.json(
      { error: 'Failed to register skill' },
      { status: 500 }
    );
  }
});
