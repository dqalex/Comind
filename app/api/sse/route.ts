/**
 * SSE 端点 - Server-Sent Events 长连接
 *
 * 前端通过 EventSource 连接此端点，实时接收数据变更事件。
 * 事件类型：openclaw_status, task_update, delivery_update, schedule_update, document_update, member_update
 *
 * v0.9.8: 需要登录才能连接（防止未授权订阅实时事件）
 * v3.1: 添加心跳机制保持连接活跃
 */

import { eventBus } from '@/lib/event-bus';
import { verifyAuth } from '@/lib/api-auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// 心跳间隔：25 秒（小于大多数代理的 30 秒超时）
const HEARTBEAT_INTERVAL_MS = 25 * 1000;

export async function GET() {
  try {
    // SSE 端点使用内联认证检查（因为需要返回 ReadableStream）
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('cms_session')?.value;

    const auth = await verifyAuth(sessionCookie || null, null);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: 'Not logged in', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    let registeredClientId: string | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
      start(controller) {
        try {
          registeredClientId = eventBus.addClient(controller);
        } catch (err) {
          // 连接数超限时关闭流
          const errMsg = err instanceof Error ? err.message : 'SSE connection rejected';
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`));
          controller.close();
          return;
        }

        const welcome = `event: connected\ndata: ${JSON.stringify({ clientId: registeredClientId, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(welcome));

        // 启动心跳定时器
        heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now(), alive: true })}\n\n`;
            controller.enqueue(encoder.encode(heartbeat));
          } catch {
            // 连接已关闭，清除定时器
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
          }
        }, HEARTBEAT_INTERVAL_MS);
      },
      cancel() {
        // 清除心跳定时器
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (registeredClientId) {
          eventBus.removeClient(registeredClientId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[SSE] GET /api/sse error:', error);
    return new Response(JSON.stringify({ error: 'SSE connection failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
