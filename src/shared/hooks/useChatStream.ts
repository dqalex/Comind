'use client';

import { useRef, useCallback } from 'react';
import { useGatewayStore } from '@/core/gateway/store';
import type { ChatEventPayload } from '@/types';
import { normalizeContent } from '@/features/chat-panel/chat-utils';
import { parseChatActions, hasChatActions } from '@/shared/lib/chat-channel/client';

/**
 * 处理 ChatEvent 流式响应的核心 hook
 * 
 * 统一封装了 4 处重复的 subscribe → delta(rAF) → final(actions) 模式：
 * 1. pending 消息发送时的 subscribe
 * 2. 持久监听 Gateway session 的 chat 事件
 * 3. handleSend 中的 Gateway 流式回复
 * 4. handleGwSessionSend 中的流式回复
 * 
 * 未来多 Gateway 平台（Knot 等）只需扩展此 hook 内部实现。
 */

export interface ChatStreamCallbacks {
  /** delta 累积后的回调，用于更新 UI 显示 */
  onDelta: (accumulated: string) => void;
  /** 流结束回调（final/aborted/error） */
  onComplete: (content: string, state: 'final' | 'aborted' | 'error', errorMessage?: string) => void;
  /** 匹配到 runId 时的回调（用于 abort 支持） */
  onRunId?: (runId: string, sessionKey: string) => void;
  /** 首次匹配到 sessionKey 时的回调（用于保存 conversationId） */
  onKeyMatched?: (matchedKey: string) => void;
}

interface StreamController {
  /** 取消订阅并清理资源 */
  cleanup: () => void;
}

/**
 * 执行 chat actions（AI 回复中嵌入的操作指令）
 * 提取为独立函数避免在多处重复
 */
function executeChatActions(content: string): string {
  if (!hasChatActions(content)) return content;

  const { actions, cleanContent } = parseChatActions(content);
  if (actions.length > 0) {
    // 异步执行 actions，不阻塞 UI
    fetch('/api/chat-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    }).catch(err => {
      console.error('[useChatStream] Actions execution error:', err);
    });
    return cleanContent;
  }
  return content;
}

/**
 * 订阅 ChatEvent 流并处理 delta/final/aborted/error
 * 
 * @param expectedKey 期望匹配的 sessionKey（精确匹配或严格前缀匹配）
 * @param callbacks 回调函数集
 * @param handlerActiveRef 可选的互斥标记（避免持久监听器与发送监听器竞争）
 * @returns StreamController 控制器
 */
export function subscribeChatStream(
  expectedKey: string,
  callbacks: ChatStreamCallbacks,
  handlerActiveRef?: React.MutableRefObject<boolean>,
): StreamController {
  let matchedKey: string | null = null;
  let accumulatedContent = '';
  let rafId: number | null = null;

  const unsub = useGatewayStore.getState().onChatEvent((payload: ChatEventPayload) => {
    // 严格匹配：精确匹配 或 已确认的匹配 key
    // 注意：不再使用宽松的 `startsWith('agent:')` 匹配，避免多个会话之间的干扰
    // 使用大小写不敏感匹配，因为 Gateway 可能返回小写的 sessionKey
    const normalizedExpected = expectedKey.toLowerCase();
    const normalizedReceived = payload.sessionKey?.toLowerCase() || '';
    const isMatch = normalizedReceived === normalizedExpected
      || (matchedKey !== null && normalizedReceived === matchedKey.toLowerCase());
    
    // 调试日志（帮助排查匹配问题）
    if (process.env.NODE_ENV === 'development' && !isMatch) {
      // 只记录与预期 key 相似但不匹配的事件
      if (normalizedReceived.includes(expectedKey.split(':')[1] || '')) {
        console.log('[useChatStream] SessionKey mismatch:', {
          expected: expectedKey,
          received: payload.sessionKey,
          state: payload.state,
        });
      }
    }
    
    if (!isMatch) return;

    // 首次匹配时通知调用方
    if (!matchedKey) {
      matchedKey = payload.sessionKey;
      if (matchedKey !== expectedKey) {
        callbacks.onKeyMatched?.(matchedKey);
      }
    }

    // 通知 runId（用于 abort）
    if (payload.runId && payload.state === 'delta') {
      callbacks.onRunId?.(payload.runId, payload.sessionKey);
    }

    if (payload.state === 'delta') {
      const msg = payload.message as { content?: unknown; text?: string } | undefined;
      const delta = normalizeContent(msg?.content) || msg?.text || '';
      accumulatedContent += delta;

      // rAF 合并渲染，避免逐 token 触发 React 更新
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          callbacks.onDelta(accumulatedContent);
        });
      }
    } else if (payload.state === 'final' || payload.state === 'aborted' || payload.state === 'error') {
      // 取消 pending rAF
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (payload.state === 'final') {
        const msg = payload.message as { content?: unknown; text?: string } | undefined;
        const finalContent = normalizeContent(msg?.content) || msg?.text;
        if (finalContent) accumulatedContent = finalContent;

        // 解析并执行 actions
        accumulatedContent = executeChatActions(accumulatedContent);
      }

      const resultContent = accumulatedContent || (
        payload.state === 'final' ? '(空回复)' :
        payload.state === 'aborted' ? '(已中止)' :
        `错误: ${payload.errorMessage || '未知错误'}`
      );

      callbacks.onComplete(resultContent, payload.state as 'final' | 'aborted' | 'error', payload.errorMessage);
      unsub();
      if (handlerActiveRef) {
        handlerActiveRef.current = false;
      }
    }
  });

  // 设置 handlerActiveRef 标记，同时保存清理函数以便在组件卸载时重置
  if (handlerActiveRef) {
    handlerActiveRef.current = true;
  }

  return {
    cleanup: () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      unsub();
      if (handlerActiveRef) handlerActiveRef.current = false;
    },
  };
}

/**
 * Hook: 持久监听 Gateway session 的 chat 事件
 * 用于接收 AI 主动推送的响应（非发送触发）
 * 
 * @param sessionKey 要监听的 sessionKey
 * @param enabled 是否启用监听
 * @param callbacks 回调函数集
 * @param handlerActiveRef 互斥标记（避免与发送监听器竞争）
 */
export function usePersistentChatListener() {
  // 返回 subscribeChatStream 的封装，供 useEffect 中使用
  // 实际的 useEffect 调用由 ChatPanel 控制（因为依赖较多）
  return { subscribeChatStream };
}
