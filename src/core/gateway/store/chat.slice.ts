/**
 * Gateway Chat 事件 Slice
 */

import type { ChatEventPayload } from '@/types';
import type { GatewayState, ChatEventHandler } from './types';
import type { StoreGet, StoreSet } from './utils';

// 模块级 chat 事件处理器（避免存储在 Zustand state 中导致订阅时触发重渲染）
let chatEventHandlersModule: ChatEventHandler[] = [];

export const chatActions = {
  // 订阅 chat 事件
  onChatEvent: (_set: StoreSet, _get: StoreGet, handler: ChatEventHandler) => {
    chatEventHandlersModule = [...chatEventHandlersModule, handler];
    return () => {
      chatEventHandlersModule = chatEventHandlersModule.filter(h => h !== handler);
    };
  },

  // server_proxy 模式下从 SSE 分发 chat 事件到 chatEventHandlers
  dispatchChatEvent: (_set: StoreSet, _get: StoreGet, payload: ChatEventPayload) => {
    const handlers = chatEventHandlersModule;
    for (const h of handlers) {
      try { h(payload); } catch (e) { console.error('chatEventHandler (server_proxy):', e); }
    }
  },

  // 获取用户专用会话键
  getUserSessionKey: (_set: StoreSet, get: StoreGet, userId: string): string | null => {
    const { agentsDefaultId } = get();
    if (!agentsDefaultId) return null;
    return `agent:${agentsDefaultId}:dm:${userId}`;
  },
};

export const createChatActions = (set: StoreSet, get: StoreGet) => ({
  onChatEvent: (handler: ChatEventHandler) => chatActions.onChatEvent(set, get, handler),
  dispatchChatEvent: (payload: ChatEventPayload) => chatActions.dispatchChatEvent(set, get, payload),
  getUserSessionKey: (userId: string) => chatActions.getUserSessionKey(set, get, userId),
});

// 导出处理器数组以便外部访问
export { chatEventHandlersModule };
