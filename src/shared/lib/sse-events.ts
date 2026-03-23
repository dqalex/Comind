/**
 * SSE 事件集中管理
 * 
 * 统一管理所有 SSE 事件类型、处理器注册和分发逻辑
 * 消除 event-bus.ts 和 DataProvider.tsx 中的重复定义
 */

// ============================================================
// 事件类型定义
// ============================================================

/**
 * SSE 事件类型枚举
 * 
 * 命名规范：<模块>_<动作>
 * - 模块：openclaw_status, task, delivery, schedule, document, member, project, gateway 等
 * - 动作：update, create, delete, event
 */
export type SSEEventType =
  // 基础模块事件
  | 'openclaw_status'
  | 'task_update'
  | 'comment_update'
  | 'delivery_update'
  | 'schedule_update'
  | 'document_update'
  | 'member_update'
  | 'project_update'
  | 'chat_session_update'
  | 'milestone_update'
  // Gateway 服务端代理事件
  | 'gateway_event'
  | 'gateway_agent_update'
  | 'gateway_session_update'
  | 'gateway_chat_event'
  | 'gateway_cron_update'
  | 'gateway_config_update'
  | 'gateway_status_update'
  // SOP 和渲染模板事件
  | 'sop_template_update'
  | 'render_template_update'
  | 'sop_confirm_request'
  // Skill 事件
  | 'skill_update'
  | 'skill_snapshot_created'
  | 'skill_snapshots_captured'
  // 审批请求事件
  | 'approval_request_created'
  | 'approval_request_approved'
  | 'approval_request_rejected'
  // Chat channel 事件
  | 'chat:job_failed'
  | 'approval_request_cancelled'
  // 项目成员事件
  | 'project_member_joined'
  // v3.0: 增量更新事件
  | 'task:incremental'
  | 'document:incremental'
  | 'delivery:incremental';

/**
 * SSE 事件结构
 */
export interface SSEEvent {
  type: SSEEventType;
  resourceId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * 所有事件类型列表（用于 SSE 监听注册）
 */
export const SSE_EVENT_TYPES: SSEEventType[] = [
  // 基础模块
  'openclaw_status',
  'task_update',
  'comment_update',
  'delivery_update',
  'schedule_update',
  'document_update',
  'member_update',
  'project_update',
  'chat_session_update',
  'milestone_update',
  // Gateway 事件
  'gateway_event',
  'gateway_agent_update',
  'gateway_session_update',
  'gateway_chat_event',
  'gateway_cron_update',
  'gateway_config_update',
  'gateway_status_update',
  // SOP 和渲染模板
  'sop_template_update',
  'render_template_update',
  'sop_confirm_request',
  // Skill
  'skill_update',
  'skill_snapshot_created',
  'skill_snapshots_captured',
  // 审批请求
  'approval_request_created',
  'approval_request_approved',
  'approval_request_rejected',
  'approval_request_cancelled',
  // 项目成员事件
  'project_member_joined',
  // v3.0: 增量更新
  'task:incremental',
  'document:incremental',
  'delivery:incremental',
  // Chat channel 事件
  'chat:job_failed',
];

/**
 * 事件分类（用于批量处理）
 */
export const SSE_EVENT_CATEGORIES = {
  basic: [
    'openclaw_status',
    'task_update',
    'comment_update',
    'delivery_update',
    'schedule_update',
    'document_update',
    'member_update',
    'project_update',
    'chat_session_update',
    'milestone_update',
  ] as SSEEventType[],
  
  gateway: [
    'gateway_event',
    'gateway_agent_update',
    'gateway_session_update',
    'gateway_chat_event',
    'gateway_cron_update',
    'gateway_config_update',
    'gateway_status_update',
  ] as SSEEventType[],
  
  sop: [
    'sop_template_update',
    'render_template_update',
    'sop_confirm_request',
  ] as SSEEventType[],
} as const;

/**
 * 事件到 Store 刷新方法的映射
 * 
 * 定义每个事件类型应该触发哪些 Store 的刷新
 */
export const SSE_EVENT_REFRESH_MAP: Record<SSEEventType, string[]> = {
  // 基础模块
  openclaw_status: ['openclawStatus'],
  task_update: ['tasks', 'projects'],
  comment_update: ['comments'],
  delivery_update: ['deliveries'],
  schedule_update: ['scheduledTasks'],
  document_update: ['documents'],
  member_update: ['members'],
  project_update: ['projects'],
  chat_session_update: ['chatSessions'],
  milestone_update: ['milestones'],
  
  // Gateway 事件
  gateway_event: ['agents', 'sessions', 'cronJobs', 'skills'],
  gateway_agent_update: ['agents'],
  gateway_session_update: ['sessions'],
  gateway_chat_event: ['sessions'], // final 状态时刷新
  gateway_cron_update: ['cronJobs'],
  gateway_config_update: ['gatewayConfig'],
  gateway_status_update: ['gatewayHealth'],
  
  // SOP 和渲染模板
  sop_template_update: ['sopTemplates'],
  render_template_update: ['renderTemplates'],
  sop_confirm_request: ['tasks'],
  
  // Skill
  skill_update: ['skills'],
  skill_snapshot_created: ['skills'],
  skill_snapshots_captured: ['skills'],
  
  // 审批请求
  approval_request_created: ['approvalRequests'],
  approval_request_approved: ['approvalRequests'],
  approval_request_rejected: ['approvalRequests'],
  approval_request_cancelled: ['approvalRequests'],
  
  // 项目成员事件
  project_member_joined: ['members', 'projects'],
  
  // v3.0: 增量更新事件
  'task:incremental': ['tasks'],
  'document:incremental': ['documents'],
  'delivery:incremental': ['deliveries'],
  // Chat channel 事件（不需要刷新 store）
  'chat:job_failed': [],
};

// ============================================================
// 事件处理器注册
// ============================================================

/**
 * 事件处理器类型
 */
export type SSEEventHandler = (data?: unknown) => void;

/**
 * 事件处理器注册表
 */
class SSEHandlerRegistry {
  private handlers = new Map<SSEEventType, SSEEventHandler>();

  /**
   * 注册事件处理器
   */
  register(type: SSEEventType, handler: SSEEventHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * 批量注册事件处理器
   */
  registerAll(handlers: Partial<Record<SSEEventType, SSEEventHandler>>): void {
    for (const [type, handler] of Object.entries(handlers)) {
      if (handler) {
        this.handlers.set(type as SSEEventType, handler);
      }
    }
  }

  /**
   * 获取事件处理器
   */
  get(type: SSEEventType): SSEEventHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * 处理事件
   */
  handle(type: SSEEventType, data?: unknown): void {
    const handler = this.handlers.get(type);
    if (handler) {
      handler(data);
    } else {
      console.warn(`[SSE] No handler registered for event: ${type}`);
    }
  }

  /**
   * 清除所有处理器
   */
  clear(): void {
    this.handlers.clear();
  }
}

export const sseHandlerRegistry = new SSEHandlerRegistry();

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析 SSE 事件数据
 */
export function parseSSEEventData(eventDataString: string): unknown {
  if (!eventDataString) return undefined;
  
  try {
    const parsed = JSON.parse(eventDataString);
    return parsed.data;
  } catch {
    return undefined;
  }
}

/**
 * 创建 SSE 事件监听器
 */
export function createSSEListener(
  eventSource: EventSource,
  onEvent: (type: SSEEventType, data?: unknown) => void
): () => void {
  const listeners: Array<() => void> = [];

  for (const type of SSE_EVENT_TYPES) {
    const listener = (event: MessageEvent) => {
      const data = parseSSEEventData(event.data);
      onEvent(type, data);
    };
    
    eventSource.addEventListener(type, listener);
    listeners.push(() => eventSource.removeEventListener(type, listener));
  }

  // 返回清理函数
  return () => {
    for (const cleanup of listeners) {
      cleanup();
    }
  };
}
