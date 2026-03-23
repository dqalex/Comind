/**
 * Gateway Store 类型定义
 */

import type {
  Snapshot, HealthSummary, AgentHealthSummary,
  CronJob, CronRunLogEntry, Session, Skill, ChatEventPayload, HelloOkPayload,
} from '@/types';
import type { AgentListEntry } from '@/lib/gateway-types';

export type ChatEventHandler = (payload: ChatEventPayload) => void;

// 模块级 chat 事件处理器（避免存储在 Zustand state 中导致订阅时触发重渲染）
export let chatEventHandlersModule: ChatEventHandler[] = [];

export interface GatewayState {
  // 连接状态
  connected: boolean;
  error: string | null;
  gwUrl: string;
  connectionMode: 'server_proxy' | null;
  serverProxyConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error_auth' | 'error_connection' | 'error' | null;
  helloPayload: HelloOkPayload | null;

  // 数据
  snapshot: Snapshot | null;
  health: HealthSummary | null;
  lastChannelsRefresh: number | null;
  agentsList: AgentListEntry[];
  agentsDefaultId: string | null;
  agentsMainKey: string | null;
  agentHealthList: AgentHealthSummary[];
  cronJobs: CronJob[];
  cronRuns: Record<string, CronRunLogEntry[]>;
  sessions: Session[];
  sessionsCount: number;
  skills: Skill[];

  // Config
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configHash: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;

  // 刷新时间戳（用于节流）
  lastRefresh: {
    snapshot: number;
    health: number;
    agents: number;
    cronJobs: number;
    sessions: number;
    skills: number;
  };

  // Actions: 数据刷新
  refreshSnapshot: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshAgents: () => Promise<void>;
  refreshCronJobs: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshSkills: () => Promise<void>;

  // Actions: Chat 事件
  onChatEvent: (handler: ChatEventHandler) => () => void;
  dispatchChatEvent: (payload: ChatEventPayload) => void;

  // Actions: Cron 写操作
  toggleCronJob: (jobId: string, enabled: boolean) => Promise<void>;
  runCronJob: (jobId: string) => Promise<void>;
  deleteCronJob: (jobId: string) => Promise<void>;
  createCronJob: (job: Record<string, unknown>) => Promise<void>;
  updateCronJob: (jobId: string, patch: Record<string, unknown>) => Promise<void>;
  fetchCronRuns: (jobId: string) => Promise<void>;

  // Actions: Agent 写操作
  createAgent: (params: { name: string; workspace: string; emoji?: string }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;

  // Actions: Session 写操作
  patchSession: (sessionKey: string, updates: Record<string, unknown>) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;

  // Actions: Skill 写操作
  toggleSkill: (skillKey: string, enabled: boolean) => Promise<void>;
  installSkill: (name: string, installId: string, timeoutMs?: number) => Promise<void>;

  // Actions: Task push
  pushTaskToAI: (taskId: string, sessionKey: string) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Actions: 用户会话键
  getUserSessionKey: (userId: string) => string | null;

  // Actions: Config
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  updateConfigForm: (updater: (form: Record<string, unknown>) => Record<string, unknown>) => void;

  // Actions: 连接状态同步
  syncServerProxyStatus: () => Promise<void>;
  setConnectionInfo: (mode: 'server_proxy' | null, status: 'connected' | 'disconnected' | null, url?: string) => void;
}

// 初始状态
export const initialGatewayState = {
  connected: false,
  error: null,
  gwUrl: '',
  connectionMode: null,
  serverProxyConnected: false,
  connectionStatus: null,
  helloPayload: null,
  snapshot: null,
  health: null,
  lastChannelsRefresh: null,
  agentsList: [],
  agentsDefaultId: null,
  agentsMainKey: null,
  agentHealthList: [],
  cronJobs: [],
  cronRuns: {},
  sessions: [],
  sessionsCount: 0,
  skills: [],
  configForm: null,
  configFormOriginal: null,
  configHash: null,
  configLoading: false,
  configSaving: false,
  configDirty: false,
  lastRefresh: {
    snapshot: 0,
    health: 0,
    agents: 0,
    cronJobs: 0,
    sessions: 0,
    skills: 0,
  },
};
