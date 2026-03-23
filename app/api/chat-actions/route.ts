/**
 * Chat Actions 执行 API（内部使用）
 * 
 * POST /api/chat-actions
 * 执行 AI 回复中的 actions 指令
 * 由客户端 useChatStream hook 调用，支持上下文注入的批量 action 执行
 * 
 * v3.0 高并发优化：
 * - 小量 actions (<5)：直接同步执行，快速响应
 * - 大量 actions (>=5)：入队异步处理，避免阻塞
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeActions, enqueueChatActions, type Action } from '@/lib/chat-channel';
import { withAuth } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/** 同步执行的阈值 */
const SYNC_THRESHOLD = 5;

/**
 * POST /api/chat-actions
 * 执行 AI 回复中的 actions
 * v0.9.8: 需要登录才能执行（actions 可操作数据库）
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { actions, memberId, sessionKey, async: forceAsync } = body as { 
      actions: Action[]; 
      memberId?: string;
      sessionKey?: string;
      async?: boolean;
    };

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: 'Invalid actions data' },
        { status: 400 }
      );
    }

    // 混合策略：根据数量决定同步/异步
    const shouldEnqueue = forceAsync || actions.length >= SYNC_THRESHOLD;

    if (shouldEnqueue) {
      // 异步入队处理
      const effectiveSessionKey = sessionKey || `chat-actions-${Date.now()}`;
      const jobId = await enqueueChatActions(effectiveSessionKey, actions, memberId);

      return NextResponse.json({
        success: true,
        message: `Actions enqueued for async processing`,
        jobId,
        queueSize: actions.length,
        mode: 'async',
      });
    }

    // 同步执行（小量 actions）
    const result = await executeActions(actions, {
      memberId,
    });

    return NextResponse.json({
      success: result.summary.failed === 0,
      message: `Execution complete: ${result.summary.success} succeeded, ${result.summary.failed} failed`,
      results: result.results,
      summary: result.summary,
      mode: 'sync',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[chat-actions] Error:', error);
    return NextResponse.json(
      { error: `Execution failed: ${error}` },
      { status: 500 }
    );
  }
});
