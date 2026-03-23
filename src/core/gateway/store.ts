/**
 * Gateway 连接状态管理
 * 对齐 openclaw-reference 协议 v3
 *
 * v3.0: 仅支持 server_proxy 模式（多用户安全要求）
 * - 服务端维护 WebSocket 连接，浏览器通过 API 代理 + SSE 获取数据
 * - 移除 browser_direct 模式（Token 存储在 localStorage 有安全风险）
 * 
 * 重构说明：
 * - 原 670+ 行代码拆分到 store/gateway/ 目录下的功能 slice
 * - 按领域分离：connection, data, chat, cron, agent, session, skill, config, task
 * - 每个 slice 独立维护，便于测试和维护
 */

import { create } from 'zustand';
import type { GatewayState } from './store/types';
import { initialGatewayState } from './store/types';
import {
  createConnectionActions,
  createDataActions,
  createChatActions,
  createCronActions,
  createAgentActions,
  createSessionActions,
  createSkillActions,
  createConfigActions,
  createTaskActions,
} from './store/index';

// Tool policy 已提取到 lib/tool-policy.ts，保持向后兼容的 re-export
export { TOOL_SECTIONS, PROFILE_OPTIONS, normalizeToolName, isAllowedByPolicy, resolveToolProfilePolicy } from '@/lib/tool-policy';

export type { ChatEventHandler } from './store/types';

// 从 openclaw.store.ts 重新导出
export { useOpenClawStatusStore } from './openclaw.store';

export const useGatewayStore = create<GatewayState>((set, get) => ({
  // 初始状态
  ...initialGatewayState,

  // 连接管理
  ...createConnectionActions(set, get),

  // 数据刷新
  ...createDataActions(set, get),

  // Chat 事件
  ...createChatActions(set, get),

  // Cron 操作
  ...createCronActions(set, get),

  // Agent 操作
  ...createAgentActions(set, get),

  // Session 操作
  ...createSessionActions(set, get),

  // Skill 操作
  ...createSkillActions(set, get),

  // Config 管理
  ...createConfigActions(set, get),

  // Task push
  ...createTaskActions(set, get),
}));
