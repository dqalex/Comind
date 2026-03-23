/**
 * Core 层统一导出
 */

// 数据库
export * from './db';

// MCP 类型
export * from './mcp/types';

// Gateway 类型（从 shared lib 导出）
export type { ConnectionStatus, GatewayMessage, GatewayEventHandler } from '@/shared/lib/gateway-types';
export type { AgentListEntry } from '@/shared/lib/gateway-types';
