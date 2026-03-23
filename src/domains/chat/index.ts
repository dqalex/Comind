/**
 * Chat 领域模块
 */

// Store
export { useChatStore } from './store';

// 类型 - 从 store 导出运行时使用的类型（与数据库 schema 不完全相同）
export type { ChatSession, ChatMessage, ChatEntity, ChatEntityType } from './store';
export type { NewChatSession, NewChatMessage } from '@/db/schema';
