/**
 * Gateway Store 模块
 * 
 * 将原 670+ 行的 gateway.store.ts 拆分为按功能领域组织的小文件：
 * 
 * 目录结构：
 * - types.ts: 类型定义和初始状态
 * - utils.ts: 工具类型和函数
 * - connection.slice.ts: 连接状态管理
 * - data.slice.ts: 数据刷新（snapshot, health, agents 等）
 * - chat.slice.ts: Chat 事件处理
 * - cron.slice.ts: Cron 任务操作
 * - agent.slice.ts: Agent 操作
 * - session.slice.ts: Session 操作
 * - skill.slice.ts: Skill 操作
 * - config.slice.ts: Config 管理
 * - task.slice.ts: Task push 功能
 * 
 * 主 store 在 ../gateway.store.ts 中组合这些 slice
 */

// 类型
export type { GatewayState, ChatEventHandler } from './types';
export { initialGatewayState } from './types';

// Slice creators
export { createConnectionActions } from './connection.slice';
export { createDataActions } from './data.slice';
export { createChatActions, chatEventHandlersModule } from './chat.slice';
export { createCronActions } from './cron.slice';
export { createAgentActions } from './agent.slice';
export { createSessionActions } from './session.slice';
export { createSkillActions } from './skill.slice';
export { createConfigActions } from './config.slice';
export { createTaskActions } from './task.slice';

// 工具
export type { StoreSet, StoreGet } from './utils';
