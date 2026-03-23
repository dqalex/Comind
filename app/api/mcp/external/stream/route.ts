/**
 * MCP 外部流式 API 端点 - 支持 SSE 流式响应
 *
 * 供 AI 成员直接调用，支持实时进度反馈
 *
 * 端点：POST /api/mcp/external/stream
 * 响应：text/event-stream (SSE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TEAMCLAW_TOOLS, type TeamClawToolName } from '@/core/mcp/definitions';
import { TOOL_HANDLERS, MEMBER_SCOPED_TOOLS, TEAMCLAW_VERSION } from '../../handlers/tool-registry';
import { decryptToken } from '@/lib/security';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { logMcpCall } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

// Token → memberId 内存缓存
const tokenCache = new Map<string, { memberId: string; mode: string; cachedAt: number }>();
const TOKEN_CACHE_TTL = 60_000;

interface StreamEvent {
  type: 'progress' | 'result' | 'error' | 'done';
  message?: string;
  data?: unknown;
  error?: string;
}

type StreamCallback = (event: StreamEvent) => void;

async function authenticateMember(request: NextRequest): Promise<{
  memberId: string;
  rawToken: string;
  error?: never;
} | {
  memberId?: never;
  rawToken?: never;
  error: string;
}> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing Authorization header, format: Bearer <member_api_token>' };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: 'Token cannot be empty' };
  }

  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL) {
    if (cached.mode === 'chat_only') {
      return { error: 'Member execution mode does not allow direct API calls. Please switch to api_first or api_only' };
    }
    return { memberId: cached.memberId, rawToken: token };
  }

  const allMembers = await db.select().from(members).where(eq(members.type, 'ai'));

  const member = allMembers.find(m => {
    const storedToken = m.openclawApiToken;
    if (!storedToken) return false;
    const decryptedToken = decryptToken(storedToken);
    return decryptedToken === token;
  });

  if (!member) {
    return { error: 'Invalid API Token' };
  }

  const mode = member.executionMode || 'chat_only';
  tokenCache.set(token, { memberId: member.id, mode, cachedAt: Date.now() });

  if (mode === 'chat_only') {
    return { error: 'Member execution mode does not allow direct API calls. Please switch to api_first or api_only' };
  }

  return { memberId: member.id, rawToken: token };
}

function createSSEStream(request: Request): ReadableStream {
  const encoder = new TextEncoder();
  let streamCallback: StreamCallback;

  const stream = new ReadableStream({
    start(controller) {
      streamCallback = (event: StreamEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // 发送连接成功事件
      streamCallback({ type: 'done', message: 'Stream connected' });
    },
    cancel() {
      // 清理
    },
  });

  // 将 streamCallback 附加到 request 上下文
  (request as unknown as { _streamCallback?: StreamCallback })._streamCallback = streamCallback!;

  return stream;
}

function sendSSEEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

async function executeToolStream(
  tool: string,
  parameters: Record<string, unknown>,
  memberId: string,
  sendProgress: (event: StreamEvent) => void
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!Object.keys(TEAMCLAW_TOOLS).includes(tool)) {
    return { success: false, error: `Unknown tool: ${tool}` };
  }

  if (MEMBER_SCOPED_TOOLS.includes(tool) && !parameters.member_id) {
    parameters.member_id = memberId;
  }

  const handler = TOOL_HANDLERS[tool as TeamClawToolName];
  if (!handler) {
    return { success: false, error: `Tool ${tool} is not implemented` };
  }

  // 包装 handler 以支持流式进度
  const wrappedHandler = async (params: Record<string, unknown>) => {
    // 检查 handler 是否支持流式回调（通过 _streamCallback 属性）
    const result = await handler(params);
    return result;
  };

  // 直接调用 handler（当前 handler 不支持流式回调，我们先直接执行）
  // 未来可以扩展 handler 支持流式回调
  sendProgress({ type: 'progress', message: `Executing ${tool}...` });

  try {
    const result = await handler(parameters);

    if (result.success) {
      sendProgress({ type: 'result', data: result.data });
      sendProgress({ type: 'done' });
    } else {
      sendProgress({ type: 'error', error: result.error });
      sendProgress({ type: 'done' });
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    sendProgress({ type: 'error', error: errorMsg });
    sendProgress({ type: 'done' });
    return { success: false, error: errorMsg };
  }
}

async function handlePost(request: NextRequest) {
  const encoder = new TextEncoder();

  // SSE 无法使用 withRateLimit 包装器，在此手动检查限流
  const identifier = getClientIdentifier(request);
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMITS.STANDARD);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: '请求频率过高，请稍后重试', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: StreamEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // 1. 鉴权
        sendEvent({ type: 'progress', message: 'Authenticating...' });
        const auth = await authenticateMember(request);

        if (auth.error) {
          sendEvent({ type: 'error', error: auth.error });
          sendEvent({ type: 'done' });
          controller.close();
          return;
        }

        const memberId = auth.memberId as string;
        const rawToken = auth.rawToken as string;
        sendEvent({ type: 'progress', message: 'Authenticated successfully' });

        // 2. 解析请求体
        const body = await request.json();
        const bodySize = JSON.stringify(body).length;

        if (bodySize > 1024 * 1024) {
          sendEvent({ type: 'error', error: 'Request body too large' });
          sendEvent({ type: 'done' });
          controller.close();
          return;
        }

        // 3. 执行工具调用
        if (body.batch && Array.isArray(body.batch)) {
          // 批量执行
          if (body.batch.length > 50) {
            sendEvent({ type: 'error', error: 'Batch size exceeds limit (max 50)' });
            sendEvent({ type: 'done' });
            controller.close();
            return;
          }

          const results = [];
          for (let i = 0; i < body.batch.length; i++) {
            const call = body.batch[i];
            sendEvent({ type: 'progress', message: `Executing ${i + 1}/${body.batch.length}: ${call.tool || 'unknown'}...` });

            if (!call.tool) {
              results.push({ success: false, error: 'Missing tool field' });
              continue;
            }

            const startTime = Date.now();
            const result = await executeToolStream(call.tool, call.parameters || {}, memberId, sendEvent);
            const durationMs = Date.now() - startTime;

            logMcpCall({
              source: 'mcp_external',
              action: call.tool,
              params: call.parameters,
              success: result.success,
              result: result.success ? JSON.stringify(result.data).slice(0, 500) : undefined,
              error: result.success ? undefined : result.error,
              memberId,
              apiToken: rawToken,
              durationMs,
            });

            results.push({ tool: call.tool, ...result });
          }

          sendEvent({ type: 'result', data: { results, member_id: memberId } });
          sendEvent({ type: 'done' });
        } else {
          // 单个执行
          const { tool, parameters } = body as { tool: string; parameters: Record<string, unknown> };

          if (!tool) {
            sendEvent({ type: 'error', error: 'Missing tool field' });
            sendEvent({ type: 'done' });
            controller.close();
            return;
          }

          sendEvent({ type: 'progress', message: `Executing ${tool}...` });

          const startTime = Date.now();
          const result = await executeToolStream(tool, parameters || {}, memberId, sendEvent);
          const durationMs = Date.now() - startTime;

          logMcpCall({
            source: 'mcp_external',
            action: tool,
            params: parameters,
            success: result.success,
            result: result.success ? JSON.stringify(result.data).slice(0, 500) : undefined,
            error: result.success ? undefined : result.error,
            memberId,
            apiToken: rawToken,
            durationMs,
          });

          if (!result.success) {
            sendEvent({ type: 'error', error: result.error });
          }
          sendEvent({ type: 'done' });
        }
      } catch (error) {
        console.error('[TeamClaw-v3] POST /api/mcp/external/stream error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Server error';
        sendEvent({ type: 'error', error: errorMsg });
        sendEvent({ type: 'done' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx buffer
    },
  });
}

export const POST = handlePost;

export async function GET() {
  return NextResponse.json({
    version: TEAMCLAW_VERSION,
    name: 'teamclaw-mcp-tools-stream',
    description: 'TeamClaw MCP 外部流式调用接口 - 支持 SSE 实时进度',
    endpoint: '/api/mcp/external/stream',
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <member_openclaw_api_token>',
      note: '使用 AI 成员的 openclawApiToken 作为鉴权凭证',
    },
    transport: {
      type: 'sse',
      contentType: 'text/event-stream',
      events: {
        progress: { description: '进度更新', fields: ['type', 'message'] },
        result: { description: '执行结果', fields: ['type', 'data'] },
        error: { description: '错误信息', fields: ['type', 'error'] },
        done: { description: '流结束', fields: ['type'] },
      },
    },
    example: {
      request: `curl -X POST http://localhost:3000/api/mcp/external/stream \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "get_task", "parameters": {"task_id": "xxx"}}'`,
      response: `data: {"type":"progress","message":"Authenticating..."}
data: {"type":"progress","message":"Authenticated successfully"}
data: {"type":"progress","message":"Executing get_task..."}
data: {"type":"result","data":{"success":true,"data":{...}}}
data: {"type":"done"}`,
    },
  });
}
