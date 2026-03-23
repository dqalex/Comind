/**
 * TeamClaw 源代码入口
 * 
 * 新的目录结构：
 * - src/core/     - 基础设施（db, mcp, gateway）
 * - src/shared/   - 共享层（ui, hooks, lib, services, types, layout, editor）
 * - src/domains/  - 领域层（task, project, document, member, skill, chat, etc.）
 * - src/features/ - 功能层（task-board, chat-panel, sop-engine, etc.）
 */

// 核心层
export * from './core/db';
export * from './core/mcp/types';
export type { ConnectionStatus, GatewayMessage, GatewayEventHandler } from '@/shared/lib/gateway-types';
export type { AgentListEntry } from '@/shared/lib/gateway-types';

// 共享层
export * from './shared/ui';
export * from './shared/hooks';
// Note: lib/services 内容通过 @/lib 路径访问，不从此处导出以避免命名冲突
// export * from './shared/services';
// Note: types 从根目录 types/index.ts 直接导入，避免与 db schema 类型冲突
// export * from './shared/types';
export * from './shared/layout';
