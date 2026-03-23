/**
 * Gateway Task Push Slice
 */

import type { StoreGet, StoreSet } from './utils';

export const taskActions = {
  // Task push - 调用后端 API 构建推送消息，返回渲染后的消息内容
  // 不再直接 chat.send，由调用方通过 openChatWithMessage 发送（确保消息在 ChatPanel 中可见）
  pushTaskToAI: async (_set: StoreSet, _get: StoreGet, taskId: string, sessionKey: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/task-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, sessionKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || '构造推送消息失败' };
      }
      return { success: true, message: json.data.message };
    } catch (e) {
      console.error('pushTaskToAI:', e);
      return { success: false, error: e instanceof Error ? e.message : '推送失败' };
    }
  },
};

export const createTaskActions = (set: StoreSet, get: StoreGet) => ({
  pushTaskToAI: (taskId: string, sessionKey: string) => taskActions.pushTaskToAI(set, get, taskId, sessionKey),
});
