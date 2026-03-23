/**
 * Gateway API 代理服务
 * 
 * 在 server_proxy 模式下，前端通过此服务调用 /api/gateway/request 代理请求
 * 接口与 lib/gateway-client.ts 的 OpenClawGatewayClient 保持一致
 */

import type {
  CronJob, CronRunLogEntry, HealthSummary, GatewayAgentRow,
  Session, Skill, Snapshot,
} from '../types';
import type { AgentListEntry } from './gateway-types';
export type { AgentListEntry } from './gateway-types';
import { RPC_METHODS } from './rpc-methods';

/**
 * 发送 Gateway 请求
 */
async function gatewayRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/gateway/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  
  if (data.error) {
    throw new Error(data.error);
  }

  return data.data as T;
}

/**
 * Gateway API 代理客户端
 * 
 * 在 server_proxy 模式下使用，通过 HTTP API 代理请求到 Gateway
 */
export class GatewayProxyClient {
  private _connected = true;

  /** 是否已连接（始终返回 true，因为连接由服务端维护） */
  get isConnected(): boolean {
    return this._connected;
  }

  // ===================== Snapshot =====================
  async getSnapshot(): Promise<Snapshot> {
    return gatewayRequest<Snapshot>('snapshot.get');
  }

  // ===================== Health =====================
  async getHealth(probe = false): Promise<HealthSummary> {
    return gatewayRequest<HealthSummary>('health', probe ? { probe: true } : {});
  }

  // ===================== Agents =====================
  async listAgents(): Promise<{ defaultId: string; mainKey: string; scope: string; agents: GatewayAgentRow[] }> {
    return gatewayRequest<{ defaultId: string; mainKey: string; scope: string; agents: GatewayAgentRow[] }>(RPC_METHODS.AGENTS_LIST);
  }

  async createAgent(params: { name: string; workspace: string; emoji?: string; avatar?: string }): Promise<{ ok: true; agentId: string; name: string; workspace: string }> {
    return gatewayRequest(RPC_METHODS.AGENTS_CREATE, params as Record<string, unknown>);
  }

  async deleteAgent(agentId: string): Promise<void> {
    await gatewayRequest(RPC_METHODS.AGENTS_DELETE, { agentId });
  }

  async getAgentFiles(agentId: string): Promise<{ files: { name: string; path: string; missing: boolean; size?: number; updatedAtMs?: number }[] }> {
    return gatewayRequest('agents.files.list', { agentId });
  }

  async getAgentFile(agentId: string, name: string): Promise<{ agentId: string; workspace: string; file: { name: string; path: string; missing: boolean; content: string; size?: number; updatedAtMs?: number } }> {
    return gatewayRequest('agents.files.get', { agentId, name });
  }

  async setAgentFile(agentId: string, name: string, content: string): Promise<{ ok: true }> {
    return gatewayRequest('agents.files.set', { agentId, name, content });
  }

  async getAgentIdentity(agentId: string): Promise<{ name: string; theme?: string; emoji?: string; avatar?: string }> {
    return gatewayRequest('agent.identity.get', { agentId });
  }

  // ===================== Sessions =====================
  async listSessions(params?: Record<string, unknown>): Promise<{
    ts: number; path: string; count: number; sessions: Session[];
    defaults: { modelProvider: string | null; model: string | null; contextTokens: number | null };
  }> {
    return gatewayRequest(RPC_METHODS.SESSIONS_LIST, params || { includeGlobal: true, includeUnknown: true, includeDerivedTitles: true, includeLastMessage: true });
  }

  async getSession(sessionKey: string): Promise<Session> {
    return gatewayRequest('sessions.get', { key: sessionKey });
  }

  async deleteSession(sessionKey: string): Promise<void> {
    await gatewayRequest(RPC_METHODS.SESSIONS_DELETE, { key: sessionKey });
  }

  async patchSession(sessionKey: string, updates: Record<string, unknown>): Promise<void> {
    await gatewayRequest(RPC_METHODS.SESSIONS_PATCH, { key: sessionKey, ...updates });
  }

  // ===================== Cron =====================
  async listCronJobs(includeDisabled = true): Promise<{ jobs: CronJob[] }> {
    return gatewayRequest<{ jobs: CronJob[] }>(RPC_METHODS.CRON_LIST, { includeDisabled });
  }

  async getCronStatus(): Promise<unknown> {
    return gatewayRequest('cron.status', {});
  }

  async createCronJob(params: Record<string, unknown>): Promise<{ ok: true; id: string }> {
    return gatewayRequest(RPC_METHODS.CRON_ADD, params);
  }

  async updateCronJob(jobId: string, patch: Record<string, unknown>): Promise<CronJob> {
    return gatewayRequest<CronJob>('cron.update', { id: jobId, patch });
  }

  async deleteCronJob(id: string): Promise<void> {
    await gatewayRequest(RPC_METHODS.CRON_REMOVE, { id });
  }

  async getCronRuns(jobId: string, limit = 50): Promise<CronRunLogEntry[]> {
    const r = await gatewayRequest<{ entries: CronRunLogEntry[] }>(RPC_METHODS.CRON_RUNS, { id: jobId, limit });
    return r.entries || [];
  }

  async runCronJob(jobId: string, mode: 'due' | 'force' = 'force'): Promise<unknown> {
    return gatewayRequest('cron.run', { id: jobId, mode });
  }

  async toggleCronJob(jobId: string, enabled: boolean): Promise<CronJob> {
    return gatewayRequest<CronJob>('cron.update', { id: jobId, patch: { enabled } });
  }

  // ===================== Skills =====================
  async listSkills(agentId?: string): Promise<{ workspaceDir: string; managedSkillsDir: string; skills: Skill[] }> {
    return gatewayRequest('skills.status', agentId ? { agentId } : {});
  }

  async updateSkill(skillKey: string, updates: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }): Promise<{ ok: true; skillKey: string }> {
    return gatewayRequest('skills.update', { skillKey, ...updates } as Record<string, unknown>);
  }

  async installSkill(name: string, installId: string, timeoutMs?: number): Promise<unknown> {
    return gatewayRequest('skills.install', { name, installId, ...(timeoutMs ? { timeoutMs } : {}) });
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
    const idempotencyKey = params.idempotencyKey || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await gatewayRequest('chat.send', { ...params, idempotencyKey } as Record<string, unknown>);
  }

  async getChatHistory(sessionKey: string, limit = 200): Promise<{ messages: unknown[]; thinkingLevel?: string }> {
    return gatewayRequest<{ messages: unknown[]; thinkingLevel?: string }>('chat.history', { sessionKey, limit });
  }

  async abortChat(sessionKey: string, runId?: string): Promise<void> {
    await gatewayRequest('chat.abort', runId ? { sessionKey, runId } : { sessionKey });
  }

  // ===================== Config =====================
  async loadConfig(): Promise<Record<string, unknown>> {
    return gatewayRequest('config.load', {});
  }

  async getConfig(): Promise<{ config: Record<string, unknown>; raw: string; hash: string; valid?: boolean; issues?: unknown[] }> {
    return gatewayRequest('config.get', {});
  }

  async setConfig(raw: string, baseHash: string): Promise<{ ok: true }> {
    return gatewayRequest('config.set', { raw, baseHash });
  }

  // ===================== 事件处理（server_proxy 模式下通过 SSE 接收，此处为空实现） =====================
  onEvent(): () => void {
    // server_proxy 模式下事件通过 SSE 接收，此处返回空清理函数
    return () => {};
  }
}

// 单例
let proxyClient: GatewayProxyClient | null = null;

export function getGatewayProxyClient(): GatewayProxyClient {
  if (!proxyClient) {
    proxyClient = new GatewayProxyClient();
  }
  return proxyClient;
}
