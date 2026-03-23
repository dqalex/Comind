/**
 * OpenClaw Gateway WebSocket 客户端（浏览器直连模式）
 * 
 * @deprecated TeamClaw 3.0 已弃用浏览器直连模式，请使用服务端代理模式：
 * - 服务端：使用 `getServerGatewayClient()` from `@/lib/server-gateway-client`
 * - 前端：使用 `getGatewayProxyClient()` from `@/lib/gateway-proxy`
 * 
 * 此文件仅保留用于：
 * 1. 向后兼容（如果有旧代码依赖）
 * 2. 未来可能需要 browser_direct 模式
 * 
 * @see lib/server-gateway-client.ts - 服务端 Gateway 客户端（推荐）
 * @see lib/gateway-proxy.ts - 前端代理客户端
 */
import type {
  CronJob, CronRunLogEntry, HealthSummary, GatewayAgentRow,
  Session, Skill, Snapshot, HelloOkPayload,
} from '../types';
import type { GatewayMessage, GatewayEventHandler, AgentListEntry } from './gateway-types';
export type { GatewayMessage, GatewayEventHandler, AgentListEntry } from './gateway-types';
import { RPC_METHODS } from './rpc-methods';
import { APP_VERSION, APP_VERSION_DISPLAY, APP_IDENTIFIER } from './version';

/** MCP 配置响应 */
export type McpConfigResponse = {
  baseUrl: string;
  apiToken: string | null;
  memberId?: string;
};

/** agents.files.list 返回的文件条目 */
export interface AgentFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
}

/** Debug logger — only prints in development */
const DEBUG = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
function gwDebug(...args: unknown[]) { if (DEBUG) console.log('[GW]', ...args); }

/**
 * @deprecated 已弃用浏览器直连模式，请使用 ServerGatewayClient (服务端) 或 GatewayProxyClient (前端)
 * 
 * 浏览器直连模式的 WebSocket 客户端，在 v3.0 中已弃用。
 * 
 * 问题：
 * - 浏览器关闭后连接断开，任务无法继续执行
 * - 无法在服务端执行后台任务
 * 
 * 替代方案：
 * - 服务端代码：`getServerGatewayClient()` from `@/lib/server-gateway-client`
 * - 前端代码：`getGatewayProxyClient()` from `@/lib/gateway-proxy`
 */
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageId = 0;
  private connected = false;
  private eventHandlers: GatewayEventHandler[] = [];
  /** hello-ok 握手响应的完整 payload（含 policy / snapshot） */
  private _helloPayload: HelloOkPayload | null = null;
  /** Reconnect with exponential backoff */
  private reconnectAttempts = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  private static readonly BASE_RECONNECT_DELAY = 1000; // 1 second
  private static readonly MAX_RECONNECT_DELAY = 60000; // 60 seconds
  /** MCP 配置回调（用于响应 teamclaw.config.request） */
  private mcpConfigCallback: (() => Promise<McpConfigResponse | null>) | null = null;
  /** 重连成功回调（用于重新加载数据） */
  private reconnectCallback: (() => void) | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  /**
   * 设置 MCP 配置回调
   * 当 Gateway 发送 teamclaw.config.request 事件时，调用此回调获取配置并响应
   */
  setMcpConfigCallback(callback: () => Promise<McpConfigResponse | null>): void {
    this.mcpConfigCallback = callback;
  }

  /** 设置重连成功回调（用于重新加载数据） */
  setReconnectCallback(callback: () => void): void {
    this.reconnectCallback = callback;
  }

  onEvent(handler: GatewayEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== handler); };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const HANDSHAKE_TIMEOUT = 10_000;
      const CHALLENGE_WAIT = 750;

      const settle = (ok: boolean, err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        if (ok) { resolve(); } else { reject(err || new Error('连接失败')); }
      };

      const handshakeTimer = setTimeout(() => {
        console.warn('[GW] 握手超时 (10s)');
        settle(false, new Error('Gateway 握手超时'));
        this.ws?.close();
      }, HANDSHAKE_TIMEOUT);

      const sendConnectReq = () => {
        const connectId = this.generateId();
        const params: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'webchat-ui',
            displayName: APP_VERSION_DISPLAY,
            version: APP_VERSION,
            platform: 'web',
            mode: 'webchat',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
          auth: { token: this.token },
          locale: 'zh-CN',
          userAgent: `${APP_IDENTIFIER}/${APP_VERSION}`,
        };
        gwDebug('Sending connect request, id:', connectId);
        this.sendRaw({ type: 'req', id: connectId, method: 'connect', params });
      };

      let connectSent = false;
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        gwDebug('WebSocket opened, waiting for challenge...');
        setTimeout(() => {
          if (!settled && !connectSent) {
            connectSent = true;
            sendConnectReq();
          }
        }, CHALLENGE_WAIT);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as GatewayMessage;
          gwDebug('Message:', msg.type, msg.type === 'event' ? msg.event : '', msg.type === 'res' ? `ok=${msg.ok}` : '');

          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            gwDebug('Received challenge, sending connect (token auth)');
            if (!connectSent) {
              connectSent = true;
              sendConnectReq();
            }
            return;
          }

          if (msg.type === 'res' && msg.ok) {
            const payload = msg.payload as Record<string, unknown> | undefined;
            if (payload && (payload.type === 'hello-ok' || payload.protocol !== undefined || payload.server !== undefined)) {
              gwDebug('Received hello-ok, connected');
              this._helloPayload = (payload as unknown) as HelloOkPayload;
              this.connected = true;
              this.resetReconnectAttempts(); // Reset on successful connection
              settle(true);
              if (this.ws) {
                this.ws.onmessage = this.handleMessage.bind(this);
              }
              return;
            }
          }

          if (msg.type === 'res' && !msg.ok && !this.connected) {
            const errMsg = typeof msg.error === 'string' ? msg.error : (msg.error as { message?: string })?.message || '连接被拒绝';
            console.error('[GW] 连接被拒绝:', errMsg);
            settle(false, new Error(errMsg));
            return;
          }
        } catch (e) {
          console.error('[GW] 消息解析错误:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('[GW] WebSocket 错误:', e);
        settle(false, new Error('WebSocket 连接错误'));
      };
      this.ws.onclose = (e) => {
        gwDebug('WebSocket closed, code:', e.code, 'reason:', e.reason);
        this.connected = false;
        if (!settled) {
          settle(false, new Error(`WebSocket 关闭 (code: ${e.code})`));
        } else {
          this.scheduleReconnect();
        }
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg = JSON.parse(event.data) as GatewayMessage;
      
      // 处理 Gateway 主动请求（如 teamclaw.config.request）
      if (msg.type === 'req' && msg.method === 'teamclaw.config.request' && msg.id) {
        this.handleConfigRequest(msg.id);
        return;
      }
      
      if (msg.type === 'res' && msg.id) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.ok) {
            pending.resolve(msg.payload);
          } else {
            const errMsg = typeof msg.error === 'string' ? msg.error : (msg.error as { message?: string })?.message || 'Request failed';
            pending.reject(new Error(errMsg));
          }
        }
      }
      if (msg.type === 'event' && msg.event) {
        for (const handler of this.eventHandlers) {
          try { handler(msg.event, msg.payload); } catch (e) { console.error('Event handler error:', e); }
        }
      }
    } catch (e) {
      console.error('[GW] Parse error:', e);
    }
  }

  /**
   * 处理 Gateway 的配置请求
   */
  private async handleConfigRequest(requestId: string): Promise<void> {
    try {
      if (!this.mcpConfigCallback) {
        this.sendRaw({ type: 'res', id: requestId, ok: false, error: 'MCP config callback not set' });
        return;
      }
      
      const config = await this.mcpConfigCallback();
      if (!config) {
        this.sendRaw({ type: 'res', id: requestId, ok: false, error: 'No MCP config available' });
        return;
      }
      
      gwDebug('Responding to teamclaw.config.request:', config);
      this.sendRaw({ type: 'res', id: requestId, ok: true, payload: config });
    } catch (e) {
      console.error('[GW] Error handling config request:', e);
      this.sendRaw({ type: 'res', id: requestId, ok: false, error: 'Internal error' });
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    // 拒绝所有 pending requests（避免永远不 resolve 的 Promise 泄漏）
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
  }

  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.generateId();
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.sendRaw({ type: 'req', id, method, params: params || {} });
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 30000);
    });
  }

  // ===================== Snapshot =====================
  async getSnapshot(): Promise<Snapshot> {
    return this.request<Snapshot>('snapshot.get');
  }

  // ===================== Health =====================
  async getHealth(probe = false): Promise<HealthSummary> {
    return this.request<HealthSummary>('health', probe ? { probe: true } : {});
  }

  // ===================== Agents =====================
  async listAgents(): Promise<{ defaultId: string; mainKey: string; scope: string; agents: GatewayAgentRow[] }> {
    return this.request<{ defaultId: string; mainKey: string; scope: string; agents: GatewayAgentRow[] }>(RPC_METHODS.AGENTS_LIST);
  }

  async createAgent(params: { name: string; workspace: string; emoji?: string; avatar?: string }): Promise<{ ok: true; agentId: string; name: string; workspace: string }> {
    return this.request(RPC_METHODS.AGENTS_CREATE, params as Record<string, unknown>);
  }

  async updateAgent(params: { agentId: string; name?: string; workspace?: string; model?: string; avatar?: string }): Promise<{ ok: true; agentId: string }> {
    return this.request('agents.update', params as Record<string, unknown>);
  }

  async deleteAgent(agentId: string, deleteFiles = true): Promise<{ ok: true; agentId: string; removedBindings: number }> {
    return this.request(RPC_METHODS.AGENTS_DELETE, { agentId, deleteFiles });
  }

  // 获取智能体的身份信息（包括自我认知的名称）
  async getAgentIdentity(agentId: string): Promise<{ agentId: string; name: string; avatar: string; emoji?: string }> {
    return this.request('agent.identity.get', { agentId });
  }

  // Agent files
  async listAgentFiles(agentId: string): Promise<{ agentId: string; workspace: string; files: AgentFile[] }> {
    return this.request('agents.files.list', { agentId });
  }

  async getAgentFile(agentId: string, name: string): Promise<{ agentId: string; workspace: string; file: AgentFile & { content?: string } }> {
    return this.request('agents.files.get', { agentId, name });
  }

  async setAgentFile(agentId: string, name: string, content: string): Promise<{ ok: true }> {
    return this.request('agents.files.set', { agentId, name, content });
  }

  // ===================== Sessions =====================
  async listSessions(params?: Record<string, unknown>): Promise<{
    ts: number; path: string; count: number; sessions: Session[];
    defaults: { modelProvider: string | null; model: string | null; contextTokens: number | null };
  }> {
    return this.request(RPC_METHODS.SESSIONS_LIST, params || { includeGlobal: true, includeUnknown: true, includeDerivedTitles: true, includeLastMessage: true });
  }

  async patchSession(sessionKey: string, updates: Record<string, unknown>): Promise<void> {
    await this.request(RPC_METHODS.SESSIONS_PATCH, { key: sessionKey, ...updates });
  }

  async deleteSession(sessionKey: string): Promise<void> {
    await this.request(RPC_METHODS.SESSIONS_DELETE, { key: sessionKey });
  }

  // ===================== Cron =====================
  async listCronJobs(includeDisabled = true): Promise<{ jobs: CronJob[] }> {
    return this.request<{ jobs: CronJob[] }>(RPC_METHODS.CRON_LIST, { includeDisabled });
  }

  async getCronStatus(): Promise<unknown> {
    return this.request('cron.status', {});
  }

  async createCronJob(job: Record<string, unknown>): Promise<CronJob> {
    return this.request<CronJob>(RPC_METHODS.CRON_ADD, job);
  }

  async updateCronJob(jobId: string, patch: Record<string, unknown>): Promise<CronJob> {
    return this.request<CronJob>('cron.update', { id: jobId, patch });
  }

  async deleteCronJob(jobId: string): Promise<void> {
    await this.request(RPC_METHODS.CRON_REMOVE, { id: jobId });
  }

  async runCronJob(jobId: string, mode: 'due' | 'force' = 'force'): Promise<unknown> {
    return this.request('cron.run', { id: jobId, mode });
  }

  async toggleCronJob(jobId: string, enabled: boolean): Promise<CronJob> {
    return this.request<CronJob>('cron.update', { id: jobId, patch: { enabled } });
  }

  async getCronRuns(jobId: string, limit = 30): Promise<CronRunLogEntry[]> {
    const r = await this.request<{ entries: CronRunLogEntry[] }>(RPC_METHODS.CRON_RUNS, { id: jobId, limit });
    return r.entries || [];
  }

  // ===================== Skills =====================
  async listSkills(agentId?: string): Promise<{ workspaceDir: string; managedSkillsDir: string; skills: Skill[] }> {
    return this.request('skills.status', agentId ? { agentId } : {});
  }

  async updateSkill(skillKey: string, updates: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }): Promise<{ ok: true; skillKey: string }> {
    return this.request('skills.update', { skillKey, ...updates } as Record<string, unknown>);
  }

  async installSkill(name: string, installId: string, timeoutMs?: number): Promise<unknown> {
    return this.request('skills.install', { name, installId, ...(timeoutMs ? { timeoutMs } : {}) });
  }

  // ===================== Config =====================
  async getConfig(): Promise<{ config: Record<string, unknown>; raw: string; hash: string; valid?: boolean; issues?: unknown[] }> {
    return this.request('config.get', {});
  }

  async setConfig(raw: string, baseHash: string): Promise<{ ok: true }> {
    return this.request('config.set', { raw, baseHash });
  }

  async reloadConfig(): Promise<{ ok: true }> {
    return this.request('config.reload', {});
  }

  // ===================== Chat =====================
  async sendChatMessage(params: { 
    sessionKey: string; 
    message: string; 
    idempotencyKey?: string; 
    deliver?: boolean;
    thinking?: string;
    attachments?: Array<{ type: string; mimeType: string; content: string }>;
  }): Promise<void> {
    // 生成默认的 idempotencyKey（用于消息去重）
    const idempotencyKey = params.idempotencyKey || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.request(RPC_METHODS.CHAT_SEND, { ...params, idempotencyKey } as Record<string, unknown>);
  }

  async getChatHistory(sessionKey: string, limit = 200): Promise<{ messages: unknown[]; thinkingLevel?: string }> {
    return this.request<{ messages: unknown[]; thinkingLevel?: string }>(RPC_METHODS.CHAT_HISTORY, { sessionKey, limit });
  }

  async abortChat(sessionKey: string, runId?: string): Promise<void> {
    await this.request(RPC_METHODS.CHAT_ABORT, runId ? { sessionKey, runId } : { sessionKey });
  }

  get isConnected(): boolean { return this.connected; }
  get helloPayload(): HelloOkPayload | null { return this._helloPayload; }

  private generateId(): string { return `req-${++this.messageId}-${Date.now()}`; }
  private sendRaw(msg: Record<string, unknown>): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    // Check max attempts
    if (this.reconnectAttempts >= OpenClawGatewayClient.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Gateway] Max reconnect attempts reached, stopping');
      return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, ...
    const delay = Math.min(
      OpenClawGatewayClient.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      OpenClawGatewayClient.MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;
    
    gwDebug(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${OpenClawGatewayClient.MAX_RECONNECT_ATTEMPTS})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().then(() => {
        // 重连成功，触发回调刷新数据
        if (this.reconnectCallback) {
          try { this.reconnectCallback(); } catch (e) { console.error('[GW] reconnectCallback error:', e); }
        }
      }).catch(console.error);
    }, delay);
  }
  
  /** Reset reconnect attempts on successful connection */
  private resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}

let globalClient: OpenClawGatewayClient | null = null;

/**
 * @deprecated 已弃用，请使用 `getServerGatewayClient()` from `@/lib/server-gateway-client`
 */
export function createGatewayClient(url: string, token: string): OpenClawGatewayClient {
  if (globalClient) globalClient.disconnect();
  globalClient = new OpenClawGatewayClient(url, token);
  return globalClient;
}

/**
 * @deprecated 已弃用，请使用 `getServerGatewayClient()` from `@/lib/server-gateway-client`
 */
export function getGatewayClient(): OpenClawGatewayClient | null { return globalClient; }
