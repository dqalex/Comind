/**
 * Agent MCP Token Handler
 * 
 * 提供：
 * 1. Agent 自动获取 MCP Token（用于对话信道认证）
 * 2. Token 与 Agent/Member 绑定
 * 3. Token 使用统计
 */

import { db, members, agentMcpTokens, type Member } from '@/db';
import { eq, and } from 'drizzle-orm';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import { generateId } from '@/lib/id';
import { encryptToken, decryptToken } from '@/lib/security';
import { createHash, randomBytes } from 'crypto';

// Token 前缀：cma = TeamClaw Agent
const AGENT_TOKEN_PREFIX = 'cma_';

/**
 * 生成 Agent MCP Token
 * 格式: cma_<base58随机字符串>
 */
function generateAgentMcpToken(): string {
  return `${AGENT_TOKEN_PREFIX}${generateId()}${generateId()}`;
}

/**
 * 计算 Token SHA-256 哈希
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Agent Token Handler
 */
class AgentTokenHandler extends McpHandlerBase<Member> {
  constructor() {
    super('AgentToken', 'member_update');
  }

  async execute(
    params: Record<string, unknown>,
    context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string || 'get';

    switch (action) {
      case 'get':
        return this.handleGetToken(params, context);
      case 'list':
        return this.handleListTokens(params, context);
      case 'revoke':
        return this.handleRevokeToken(params, context);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取或创建 Agent 的 MCP Token
   * 
   * 权限规则：
   * - AI 成员可以获取自己的 Token
   * - 通过 external API 调用时，member_id 从 Token 推导
   * - 通过对话信道调用时，member_id 从 sessionKey 推导
   */
  private async handleGetToken(
    params: Record<string, unknown>,
    context: HandlerContext
  ): Promise<HandlerResult> {
    // 优先使用参数中的 member_id，其次从上下文获取
    let memberId = params.member_id as string | undefined;
    
    // 如果没有传 member_id，尝试从上下文获取
    if (!memberId) {
      // 从外部 API Token 推导（如果有）
      memberId = context.memberId;
    }

    if (!memberId) {
      return this.failure('Missing member_id. Please provide your AI member ID.');
    }

    return this.withResource(
      memberId,
      async (id) => {
        const [member] = await db.select().from(members).where(eq(members.id, id));
        return member || null;
      },
      async (member) => {
        // 只允许 AI 成员获取 Token
        if (member.type !== 'ai') {
          return this.failure('Only AI members can get MCP Token');
        }

        const now = new Date();

        // 查找已有的 Agent Token
        const [existingToken] = await db.select()
          .from(agentMcpTokens)
          .where(and(
            eq(agentMcpTokens.memberId, member.id),
            eq(agentMcpTokens.status, 'active')
          ))
          .limit(1);

        let decryptedToken: string;
        let isNew = false;

        if (existingToken) {
          // 返回已有 Token
          decryptedToken = decryptToken(existingToken.encryptedToken);
          
          // 更新最后使用时间
          await db.update(agentMcpTokens)
            .set({
              lastUsedAt: now,
              usageCount: (existingToken.usageCount || 0) + 1,
              updatedAt: now,
            })
            .where(eq(agentMcpTokens.id, existingToken.id));
        } else {
          // 创建新 Token
          const newToken = generateAgentMcpToken();
          const encryptedToken = encryptToken(newToken);
          
          await db.insert(agentMcpTokens).values({
            id: `amt-${generateId()}`,
            memberId: member.id,
            agentId: member.openclawAgentId || null,
            tokenHash: hashToken(newToken),
            encryptedToken,
            source: context.source === 'chat_channel' ? 'chat' : 
                    context.source === 'gateway' ? 'gateway' : 'auto',
            status: 'active',
            lastUsedAt: now,
            usageCount: 1,
            createdAt: now,
            updatedAt: now,
          });

          decryptedToken = newToken;
          isNew = true;
          this.log('Agent MCP Token created', member.id);
        }

        return this.success('Agent MCP Token retrieved', {
          memberId: member.id,
          memberName: member.name,
          token: decryptedToken,
          endpoint: '/api/mcp/external',
          isNew,
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
          hint: 'Use this token to call /api/mcp/external for MCP operations',
        });
      }
    );
  }

  /**
   * 列出 Member 的所有 Token
   */
  private async handleListTokens(
    params: Record<string, unknown>,
    context: HandlerContext
  ): Promise<HandlerResult> {
    const memberId = params.member_id as string || context.memberId;

    if (!memberId) {
      return this.failure('Missing member_id');
    }

    const tokens = await db.select({
      id: agentMcpTokens.id,
      agentId: agentMcpTokens.agentId,
      source: agentMcpTokens.source,
      status: agentMcpTokens.status,
      lastUsedAt: agentMcpTokens.lastUsedAt,
      usageCount: agentMcpTokens.usageCount,
      createdAt: agentMcpTokens.createdAt,
    })
    .from(agentMcpTokens)
    .where(eq(agentMcpTokens.memberId, memberId));

    return this.success('Tokens retrieved', {
      memberId,
      count: tokens.length,
      tokens: tokens.map(t => ({
        id: t.id,
        agentId: t.agentId,
        source: t.source,
        status: t.status,
        lastUsedAt: t.lastUsedAt?.toISOString(),
        usageCount: t.usageCount,
        createdAt: t.createdAt?.toISOString(),
      })),
    });
  }

  /**
   * 撤销 Token
   */
  private async handleRevokeToken(
    params: Record<string, unknown>,
    context: HandlerContext
  ): Promise<HandlerResult> {
    const tokenId = params.token_id as string;
    const memberId = params.member_id as string || context.memberId;

    if (!tokenId) {
      return this.failure('Missing token_id');
    }

    // 验证 Token 属于该 Member
    const [token] = await db.select()
      .from(agentMcpTokens)
      .where(and(
        eq(agentMcpTokens.id, tokenId),
        eq(agentMcpTokens.memberId, memberId || '')
      ));

    if (!token) {
      return this.failure('Token not found or not owned by member');
    }

    await db.update(agentMcpTokens)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(agentMcpTokens.id, tokenId));

    return this.success('Token revoked', { tokenId });
  }
}

// 导出单例
export const agentTokenHandler = new AgentTokenHandler();

// 兼容函数导出
export async function handleGetAgentMcpToken(params: Record<string, unknown>, context: HandlerContext = {}) {
  return agentTokenHandler.execute({ ...params, action: 'get' }, context);
}

export async function handleListAgentMcpTokens(params: Record<string, unknown>, context: HandlerContext = {}) {
  return agentTokenHandler.execute({ ...params, action: 'list' }, context);
}

export async function handleRevokeAgentMcpToken(params: Record<string, unknown>, context: HandlerContext = {}) {
  return agentTokenHandler.execute({ ...params, action: 'revoke' }, context);
}

export default agentTokenHandler;
