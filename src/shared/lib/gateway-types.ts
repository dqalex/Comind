/**
 * Gateway 共享类型定义
 * 
 * 由 gateway-client.ts / server-gateway-client.ts / gateway-proxy.ts 共同引用
 */

/** Gateway 连接状态
 * - connected: 已连接
 * - disconnected: 未连接（可重试）
 * - connecting: 连接中
 * - error_auth: 认证失败（token 错误，需检查配置）
 * - error_connection: 连接失败（地址错误或 Gateway 未启动）
 * - error: 其他错误
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error_auth' | 'error_connection' | 'error';

/** Gateway WebSocket 消息格式 */
export type GatewayMessage = {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: unknown;
  error?: string | { code?: string; message?: string };
  event?: string;
};

/** Gateway 事件回调 */
export type GatewayEventHandler = (event: string, payload: unknown) => void;

/** agents.list 返回的 agent 列表条目 */
export interface AgentListEntry {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  isDefault?: boolean;
}
