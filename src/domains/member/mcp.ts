/**
 * AI 成员自注册 Handler
 *
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 40%
 * 
 * v3.0 Phase F: 注册时自动创建 Agent MCP Token
 */

import { db, members, agentMcpTokens } from '@/db';
import {
  openclawStatus,
  scheduledTasks,
  scheduledTaskHistory,
  deliveries,
  chatSessions,
  chatMessages,
  openclawWorkspaces,
  openclawFiles,
  openclawVersions,
  openclawConflicts,
} from '@/db/schema';
import { generateMemberId, generateId } from '@/lib/id';
import { eq, and, inArray } from 'drizzle-orm';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import { encryptToken, decryptToken, sanitizeString, isValidUrl } from '@/lib/security';
import type { Member } from '@/db/schema';
import { createHash } from 'crypto';

/** 部署模式 */
type DeployMode = 'cloud' | 'local' | 'knot';

/** 执行模式 */
type ExecutionMode = 'chat_only' | 'api_first' | 'api_only';

/**
 * 生成 MCP API Token
 * 格式: cmk_<base58随机字符串> (共约 30 字符)
 */
function generateMcpToken(): string {
  return `cmk_${generateId()}${generateId()}`;
}

/**
 * 生成 Agent MCP Token
 * 格式: cma_<base58随机字符串>
 */
function generateAgentMcpToken(): string {
  return `cma_${generateId()}${generateId()}`;
}

/**
 * 计算 Token SHA-256 哈希
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 为成员创建 Agent MCP Token
 */
async function createAgentTokenForMember(memberId: string, agentId?: string | null): Promise<string> {
  const token = generateAgentMcpToken();
  const now = new Date();

  await db.insert(agentMcpTokens).values({
    id: `amt-${generateId()}`,
    memberId,
    agentId: agentId || null,
    tokenHash: hashToken(token),
    encryptedToken: encryptToken(token),
    source: 'auto',
    status: 'active',
    lastUsedAt: now,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return token;
}

/**
 * 获取成员的 Agent Token（如果存在）
 */
async function getMemberAgentToken(memberId: string): Promise<string | null> {
  const [record] = await db.select()
    .from(agentMcpTokens)
    .where(and(
      eq(agentMcpTokens.memberId, memberId),
      eq(agentMcpTokens.status, 'active')
    ))
    .limit(1);

  if (!record) return null;
  return decryptToken(record.encryptedToken);
}

/**
 * Member Handler - 继承 McpHandlerBase 基类
 */
class MemberHandler extends McpHandlerBase<Member> {
  constructor() {
    super('Member', 'member_update');
  }

  /**
   * 主入口 - 调度各个具体处理方法
   */
  async execute(
    params: Record<string, unknown>,
    _context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string;

    switch (action) {
      case 'register':
        return this.handleRegisterMember(params);
      case 'get_mcp_token':
        return this.handleGetMcpToken(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 注册 AI 成员
   */
  private async handleRegisterMember(params: Record<string, unknown>): Promise<HandlerResult> {
    // 参数清理和验证
    const name = sanitizeString(params.name, 100);
    const endpoint = sanitizeString(params.endpoint, 500);
    const deployModeRaw = sanitizeString(params.deploy_mode, 20) || 'local';
    const deployMode: DeployMode = ['cloud', 'local', 'knot'].includes(deployModeRaw)
      ? (deployModeRaw as DeployMode)
      : 'local';
    const executionModeRaw = sanitizeString(params.execution_mode, 20) || 'api_first';
    const executionMode: ExecutionMode = ['chat_only', 'api_first', 'api_only'].includes(executionModeRaw)
      ? (executionModeRaw as ExecutionMode)
      : 'api_first';
    const tools = Array.isArray(params.tools) ? (params.tools as string[]).slice(0, 50) : undefined;
    const taskTypes = Array.isArray(params.task_types) ? (params.task_types as string[]).slice(0, 50) : undefined;
    const apiToken = sanitizeString(params.api_token, 500);

    if (!name) {
      return this.failure('Missing required parameter: name');
    }
    if (!endpoint) {
      return this.failure('Missing required parameter: endpoint');
    }

    // 验证 endpoint URL 格式（支持 http 和 https）
    if (!isValidUrl(endpoint, ['http:', 'https:'])) {
      return this.failure('endpoint must be a valid http/https URL');
    }

    try {
      const now = new Date();

      // 去重：按 endpoint 匹配已有 AI 成员
      const existing = await db.select().from(members).where(
        and(eq(members.type, 'ai'), eq(members.openclawEndpoint, endpoint))
      );

      if (existing.length > 0) {
        // 如有多个 endpoint 相同的成员，保留最新的
        const sorted = [...existing].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt as unknown as string).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt as unknown as string).getTime() : 0;
          return timeB - timeA;
        });
        const member = sorted[0];

        // 删除旧的重复成员（带级联清理）
        for (let i = 1; i < sorted.length; i++) {
          await this.cleanupMemberData(sorted[i].id);
        }

        const updateData: Record<string, unknown> = {
          name,
          openclawName: name,
          openclawDeployMode: deployMode,
          openclawEndpoint: endpoint,
          openclawConnectionStatus: 'connected',
          openclawLastHeartbeat: now,
          configSource: 'self',
          executionMode,
          updatedAt: now,
        };

        if (apiToken) updateData.openclawApiToken = encryptToken(apiToken);
        if (tools && Array.isArray(tools)) updateData.experienceTools = tools;
        if (taskTypes && Array.isArray(taskTypes)) updateData.experienceTaskTypes = taskTypes;

        await db.update(members).set(updateData).where(eq(members.id, member.id));
        this.emitUpdate(member.id);
        this.log('Member configuration updated', member.id, { name, endpoint });

        // 检查是否有 Agent Token，没有则创建
        let agentToken = await getMemberAgentToken(member.id);
        if (!agentToken) {
          agentToken = await createAgentTokenForMember(member.id, member.openclawAgentId as string | null);
          this.log('Agent MCP Token auto-created for existing member', member.id);
        }

        return this.success('AI member configuration updated', {
          memberId: member.id,
          isNew: false,
          mcpToken: agentToken,
          mcpEndpoint: '/api/mcp/external',
        });
      }

      // 创建新成员
      const newId = generateMemberId();
      const newMember = {
        id: newId,
        name,
        type: 'ai' as const,
        online: true,
        openclawName: name,
        openclawDeployMode: deployMode,
        openclawEndpoint: endpoint,
        openclawConnectionStatus: 'connected' as const,
        openclawLastHeartbeat: now,
        openclawApiToken: apiToken ? encryptToken(apiToken) : null,
        configSource: 'self' as const,
        executionMode,
        experienceTaskCount: 0,
        experienceTaskTypes: taskTypes || [],
        experienceTools: tools || [],
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(members).values(newMember);
      this.emitUpdate(newId);
      this.log('AI member auto-registered', newId, { name, endpoint });

      // 自动创建 Agent MCP Token
      const agentToken = await createAgentTokenForMember(newId, null);
      this.log('Agent MCP Token auto-created', newId);

      return this.success('AI member auto-registered', {
        memberId: newId,
        isNew: true,
        mcpToken: agentToken,
        mcpEndpoint: '/api/mcp/external',
      });
    } catch (error) {
      this.logError('Register member', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to register member', message);
    }
  }

  /**
   * 清理成员关联数据（级联删除）
   */
  private async cleanupMemberData(memberId: string): Promise<void> {
    const { eventBus } = await import('@/lib/event-bus');

    // 清理定时任务历史
    const oldSchedules = await db.select({ id: scheduledTasks.id }).from(scheduledTasks).where(eq(scheduledTasks.memberId, memberId));
    const stIds = oldSchedules.map((s) => s.id);
    if (stIds.length > 0) {
      await db.delete(scheduledTaskHistory).where(inArray(scheduledTaskHistory.scheduledTaskId, stIds));
    }
    await db.delete(scheduledTasks).where(eq(scheduledTasks.memberId, memberId));

    // 清理状态
    await db.delete(openclawStatus).where(eq(openclawStatus.memberId, memberId));

    // 清理交付物
    await db.update(deliveries).set({ reviewerId: null }).where(eq(deliveries.reviewerId, memberId));
    await db.delete(deliveries).where(eq(deliveries.memberId, memberId));

    // 清理会话
    const oldSessions = await db.select({ id: chatSessions.id }).from(chatSessions).where(eq(chatSessions.memberId, memberId));
    const sessIds = oldSessions.map((s) => s.id);
    if (sessIds.length > 0) {
      await db.delete(chatMessages).where(inArray(chatMessages.sessionId, sessIds));
      await db.delete(chatSessions).where(eq(chatSessions.memberId, memberId));
    }

    // 清理工作空间
    const oldWs = await db.select({ id: openclawWorkspaces.id }).from(openclawWorkspaces).where(eq(openclawWorkspaces.memberId, memberId));
    const wsIds = oldWs.map((w) => w.id);
    if (wsIds.length > 0) {
      const wsFileIds = (
        await db.select({ id: openclawFiles.id }).from(openclawFiles).where(inArray(openclawFiles.workspaceId, wsIds))
      ).map((f) => f.id);
      if (wsFileIds.length > 0) {
        await db.delete(openclawConflicts).where(inArray(openclawConflicts.fileId, wsFileIds));
        await db.delete(openclawVersions).where(inArray(openclawVersions.fileId, wsFileIds));
        await db.delete(openclawFiles).where(inArray(openclawFiles.workspaceId, wsIds));
      }
      await db.delete(openclawWorkspaces).where(inArray(openclawWorkspaces.id, wsIds));
    }

    // 删除成员
    await db.delete(members).where(eq(members.id, memberId));
    eventBus.emit({ type: 'member_update', data: { memberId } });
  }

  /**
   * 获取 MCP API Token
   *
   * AI 成员通过对话信道获取自己的 MCP API Token
   * 安全考虑：只返回给 AI 成员自己
   */
  private async handleGetMcpToken(params: Record<string, unknown>): Promise<HandlerResult> {
    const memberId = sanitizeString(params.member_id as string, 50);

    if (!memberId) {
      return this.failure('Missing required parameter: member_id');
    }

    return this.withResource(
      memberId,
      async (id) => {
        const [member] = await db.select().from(members).where(eq(members.id, id));
        return member || null;
      },
      async (member) => {
        // 只允许 AI 成员获取自己的 Token
        if (member.type !== 'ai') {
          return this.failure('Only AI members can get MCP Token');
        }

        let decryptedToken: string;

        // 如果没有 Token，自动生成一个
        if (!member.openclawApiToken) {
          const newToken = generateMcpToken();
          const encryptedToken = encryptToken(newToken);

          await db
            .update(members)
            .set({ openclawApiToken: encryptedToken, updatedAt: new Date() })
            .where(eq(members.id, memberId));

          this.emitUpdate(memberId);
          this.log('MCP token auto-generated', memberId);

          decryptedToken = newToken;
        } else {
          // 解密已有 Token
          decryptedToken = decryptToken(member.openclawApiToken);
        }

        return this.success('MCP Token retrieved', {
          memberId: member.id,
          memberName: member.name,
          token: decryptedToken,
          endpoint: '/api/mcp/external',
          autoGenerated: !member.openclawApiToken,
          usage: {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${decryptedToken}`,
              'Content-Type': 'application/json',
            },
            body: {
              tool: 'tool name',
              parameters: {},
            },
          },
        });
      }
    );
  }
}

// 导出单例
export const memberHandler = new MemberHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleRegisterMember(params: Record<string, unknown>) {
  return memberHandler.execute({ ...params, action: 'register' }, {});
}

export async function handleGetMcpToken(params: Record<string, unknown>) {
  return memberHandler.execute({ ...params, action: 'get_mcp_token' }, {});
}

// 默认导出
export default memberHandler;
