/**
 * Chat 工具函数
 * 
 * 从 ChatPanel.tsx 提取的纯函数和常量
 */

import { useGatewayStore } from '@/core/gateway/store';
import { getGatewayProxyClient } from '@/lib/gateway-proxy';

// Thinking levels matching OpenClaw
export const THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];

/**
 * 获取当前可用的 Gateway client
 * v3.0: 仅支持 server_proxy 模式
 */
export function getActiveGwClient() {
  const state = useGatewayStore.getState();
  if (state.serverProxyConnected) {
    return getGatewayProxyClient();
  }
  return null;
}

/**
 * Normalize message content to string
 * Handles various content formats from OpenClaw:
 * - string -> string
 * - {type: 'text', text: '...'} -> '...'
 * - [{type: 'text', text: '...'}, ...] -> '......'
 */
export function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  
  if (Array.isArray(content)) {
    return content
      .map((block: unknown) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as Record<string, unknown>).text);
        }
        return '';
      })
      .join('');
  }
  
  if (typeof content === 'object' && 'text' in content) {
    return String((content as Record<string, unknown>).text);
  }
  
  return '';
}

/**
 * 从 Gateway 历史消息中规范化内容
 * 多处使用相同的历史解析逻辑，提取为公共函数
 */
export function normalizeHistoryMessages(
  messages: unknown[]
): { role: string; content: string }[] {
  return messages.map((m: unknown) => {
    const msg = m as { role?: string; content?: unknown; text?: string };
    const raw = msg.content;
    let content: string;
    if (typeof raw === 'string') {
      content = raw;
    } else if (Array.isArray(raw)) {
      content = raw.map((b: unknown) => {
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object' && 'text' in b) return String((b as Record<string, unknown>).text);
        return '';
      }).join('');
    } else if (raw && typeof raw === 'object' && 'text' in raw) {
      content = String((raw as Record<string, unknown>).text);
    } else {
      content = msg.text || '';
    }
    return { role: msg.role || 'assistant', content };
  });
}
