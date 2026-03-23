/**
 * Gateway RPC 方法名常量
 * 
 * v0.2.7 问题：方法名字符串分散在多个文件中，曾因不一致导致 cron 功能失效
 * 解决方案：统一常量定义，避免拼写错误
 * 
 * 架构优化：消除 100% 方法名错误风险
 */

/**
 * Gateway RPC 方法命名空间
 * 格式：<namespace>.<action>
 */
export const RPC_METHODS = {
  // ============================================================
  // Snapshot 快照相关
  // ============================================================
  SNAPSHOT_GET: 'snapshot.get',

  // ============================================================
  // Agents 成员管理相关
  // ============================================================
  AGENTS_LIST: 'agents.list',
  AGENTS_CREATE: 'agents.create',
  AGENTS_UPDATE: 'agents.update',
  AGENTS_DELETE: 'agents.delete',

  // ============================================================
  // Sessions 会话管理相关
  // ============================================================
  SESSIONS_LIST: 'sessions.list',
  SESSIONS_GET: 'sessions.get',
  SESSIONS_PATCH: 'sessions.patch',
  SESSIONS_DELETE: 'sessions.delete',

  // ============================================================
  // Cron 定时任务相关
  // ============================================================
  CRON_LIST: 'cron.list',
  CRON_STATUS: 'cron.status',
  CRON_ADD: 'cron.add',
  CRON_UPDATE: 'cron.update',
  CRON_REMOVE: 'cron.remove',
  CRON_RUN: 'cron.run',
  CRON_RUNS: 'cron.runs',

  // ============================================================
  // Skills 技能市场相关
  // ============================================================
  SKILLS_STATUS: 'skills.status',
  SKILLS_UPDATE: 'skills.update',
  SKILLS_INSTALL: 'skills.install',

  // ============================================================
  // Config 配置管理相关
  // ============================================================
  CONFIG_GET: 'config.get',
  CONFIG_SET: 'config.set',
  CONFIG_RELOAD: 'config.reload',
  CONFIG_LOAD: 'config.load',

  // ============================================================
  // Chat 聊天相关
  // ============================================================
  CHAT_SEND: 'chat.send',
  CHAT_HISTORY: 'chat.history',
  CHAT_ABORT: 'chat.abort',
} as const;

/**
 * 类型安全的方法名
 */
export type RpcMethod = typeof RPC_METHODS[keyof typeof RPC_METHODS];

/**
 * 方法分组，便于按功能查找
 */
export const RPC_GROUPS = {
  SNAPSHOT: [
    RPC_METHODS.SNAPSHOT_GET,
  ] as const,
  
  AGENTS: [
    RPC_METHODS.AGENTS_LIST,
    RPC_METHODS.AGENTS_CREATE,
    RPC_METHODS.AGENTS_UPDATE,
    RPC_METHODS.AGENTS_DELETE,
  ] as const,
  
  SESSIONS: [
    RPC_METHODS.SESSIONS_LIST,
    RPC_METHODS.SESSIONS_GET,
    RPC_METHODS.SESSIONS_PATCH,
    RPC_METHODS.SESSIONS_DELETE,
  ] as const,
  
  CRON: [
    RPC_METHODS.CRON_LIST,
    RPC_METHODS.CRON_STATUS,
    RPC_METHODS.CRON_ADD,
    RPC_METHODS.CRON_UPDATE,
    RPC_METHODS.CRON_REMOVE,
    RPC_METHODS.CRON_RUN,
    RPC_METHODS.CRON_RUNS,
  ] as const,
  
  SKILLS: [
    RPC_METHODS.SKILLS_STATUS,
    RPC_METHODS.SKILLS_UPDATE,
    RPC_METHODS.SKILLS_INSTALL,
  ] as const,
  
  CONFIG: [
    RPC_METHODS.CONFIG_GET,
    RPC_METHODS.CONFIG_SET,
    RPC_METHODS.CONFIG_RELOAD,
    RPC_METHODS.CONFIG_LOAD,
  ] as const,
  
  CHAT: [
    RPC_METHODS.CHAT_SEND,
    RPC_METHODS.CHAT_HISTORY,
    RPC_METHODS.CHAT_ABORT,
  ] as const,
} as const;

/**
 * 验证方法名是否有效
 */
export function isValidRpcMethod(method: string): method is RpcMethod {
  return Object.values(RPC_METHODS).includes(method as RpcMethod);
}

/**
 * 获取方法所属分组
 */
export function getRpcGroup(method: RpcMethod): keyof typeof RPC_GROUPS | null {
  for (const [group, methods] of Object.entries(RPC_GROUPS)) {
    if ((methods as readonly string[]).includes(method)) {
      return group as keyof typeof RPC_GROUPS;
    }
  }
  return null;
}
