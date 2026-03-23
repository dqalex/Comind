import { db } from '@/db';
import { members, users, type NewMember } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq, sql } from 'drizzle-orm';
import { generateMemberId, generateId } from '@/lib/id';
import { sanitizeMember } from '@/lib/sanitize';
import { validateEnumWithDefault, validateEnum, VALID_MEMBER_TYPE, VALID_DEPLOY_MODE } from '@/lib/validators';
import { encryptToken } from '@/lib/security';
import { invalidateMemberCache } from '@/lib/markdown-sync';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { eventBus } from '@/lib/event-bus';
import { withAuth, withAdminAuth } from '@/lib/with-auth';
import {
  successResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';
import { createMemberSchema, validate } from '@/lib/validation';

// GET /api/members - 获取所有成员（包含关联用户的角色信息）
// v0.9.8: 需要登录才能访问（AI 成员是系统级共享，所有用户可见）
export const GET = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    // LEFT JOIN users 获取人类成员的角色信息
    const allMembers = await db
      .select({
        id: members.id,
        name: members.name,
        type: members.type,
        email: members.email,
        avatar: members.avatar,
        online: members.online,
        userId: members.userId,
        // 获取关联用户的角色（admin/member/viewer）
        userRole: sql<string | null>`${users.role}`.as('userRole'),
        // OpenClaw 相关字段
        openclawName: members.openclawName,
        openclawDeployMode: members.openclawDeployMode,
        openclawEndpoint: members.openclawEndpoint,
        openclawConnectionStatus: members.openclawConnectionStatus,
        openclawLastHeartbeat: members.openclawLastHeartbeat,
        openclawGatewayUrl: members.openclawGatewayUrl,
        openclawAgentId: members.openclawAgentId,
        openclawApiToken: members.openclawApiToken,
        openclawModel: members.openclawModel,
        openclawEnableWebSearch: members.openclawEnableWebSearch,
        openclawTemperature: members.openclawTemperature,
        configSource: members.configSource,
        executionMode: members.executionMode,
        experienceTaskCount: members.experienceTaskCount,
        experienceTaskTypes: members.experienceTaskTypes,
        experienceTools: members.experienceTools,
        createdAt: members.createdAt,
        updatedAt: members.updatedAt,
      })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id));
    
    return successResponse(allMembers.map(sanitizeMember));
  } catch (error) {
    console.error(`[GET /api/members] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to fetch members'), requestId);
  }
});

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();

    // Zod schema validation
    const validation = validate(createMemberSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;

    // 验证部署模式
    if (body.openclawDeployMode && !validateEnum(body.openclawDeployMode, VALID_DEPLOY_MODE)) {
      return NextResponse.json({ error: `openclawDeployMode must be one of ${VALID_DEPLOY_MODE.join('/')}` }, { status: 400 });
    }

    // 加密 Token 存储
    const encryptedToken = body.openclawApiToken ? encryptToken(body.openclawApiToken) : null;

    const newMember: NewMember = {
      id: generateMemberId(),
      name: data.name,
      type: data.type,
      email: data.email || null,
      online: false,
      openclawName: data.openclawName || null,
      openclawDeployMode: data.openclawDeployMode || null,
      openclawEndpoint: data.openclawEndpoint || null,
      openclawGatewayUrl: body.openclawGatewayUrl || null,
      openclawConnectionStatus: 'disconnected',
      openclawAgentId: body.openclawAgentId || null,
      openclawApiToken: encryptedToken,
      openclawModel: data.openclawModel || null,
      openclawEnableWebSearch: data.openclawEnableWebSearch ?? false,
      openclawTemperature: typeof body.openclawTemperature === 'number' ? Math.min(2.0, Math.max(0, body.openclawTemperature)) : null,
      experienceTaskCount: 0,
      experienceTaskTypes: [],
      experienceTools: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(members).values(newMember);
    
    // 清除成员缓存
    invalidateMemberCache();
    
    // 问题 #10：POST 后通知前端刷新
    eventBus.emit({ type: 'member_update', resourceId: newMember.id });
    
    // 返回数据库中的完整数据（而非内存构造的对象）
    const [created] = await db.select().from(members).where(eq(members.id, newMember.id));
    return NextResponse.json(sanitizeMember(created || newMember), { status: 201 });
  } catch (error) {
    console.error('[POST /api/members]', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}

// 应用限流 + 认证
// v0.9.8: 创建成员需要管理员权限（AI 成员是系统级资源）
export const POST = withAdminAuth(withRateLimit(handlePost, RATE_LIMITS.CREATE));
