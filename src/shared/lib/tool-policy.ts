/**
 * OpenClaw Tool Sections & Profiles
 * 工具策略配置：工具分区、预设 Profile、名称归一化、权限判断
 * 从 gateway.store.ts 提取，供 Agent 工具配置面板使用
 */

// ===================== Tool Sections (from OpenClaw reference) =====================
export const TOOL_SECTIONS = [
  {
    id: 'fs', label: 'Files', tools: [
      { id: 'read', label: 'read', description: 'Read file contents' },
      { id: 'write', label: 'write', description: 'Create or overwrite files' },
      { id: 'edit', label: 'edit', description: 'Make precise edits' },
      { id: 'apply_patch', label: 'apply_patch', description: 'Patch files (OpenAI)' },
    ],
  },
  {
    id: 'runtime', label: 'Runtime', tools: [
      { id: 'exec', label: 'exec', description: 'Run shell commands' },
      { id: 'process', label: 'process', description: 'Manage background processes' },
    ],
  },
  {
    id: 'web', label: 'Web', tools: [
      { id: 'web_search', label: 'web_search', description: 'Search the web' },
      { id: 'web_fetch', label: 'web_fetch', description: 'Fetch web content' },
    ],
  },
  {
    id: 'memory', label: 'Memory', tools: [
      { id: 'memory_search', label: 'memory_search', description: 'Semantic search' },
      { id: 'memory_get', label: 'memory_get', description: 'Read memory files' },
    ],
  },
  {
    id: 'sessions', label: 'Sessions', tools: [
      { id: 'sessions_list', label: 'sessions_list', description: 'List sessions' },
      { id: 'sessions_history', label: 'sessions_history', description: 'Session history' },
      { id: 'sessions_send', label: 'sessions_send', description: 'Send to session' },
      { id: 'sessions_spawn', label: 'sessions_spawn', description: 'Spawn sub-agent' },
      { id: 'session_status', label: 'session_status', description: 'Session status' },
    ],
  },
  {
    id: 'ui', label: 'UI', tools: [
      { id: 'browser', label: 'browser', description: 'Control web browser' },
      { id: 'canvas', label: 'canvas', description: 'Control canvases' },
    ],
  },
  {
    id: 'messaging', label: 'Messaging', tools: [
      { id: 'message', label: 'message', description: 'Send messages' },
    ],
  },
  {
    id: 'automation', label: 'Automation', tools: [
      { id: 'cron', label: 'cron', description: 'Schedule tasks' },
      { id: 'gateway', label: 'gateway', description: 'Gateway control' },
    ],
  },
  {
    id: 'nodes', label: 'Nodes', tools: [
      { id: 'nodes', label: 'nodes', description: 'Nodes + devices' },
    ],
  },
  {
    id: 'agents', label: 'Agents', tools: [
      { id: 'agents_list', label: 'agents_list', description: 'List agents' },
    ],
  },
  {
    id: 'media', label: 'Media', tools: [
      { id: 'image', label: 'image', description: 'Image understanding' },
    ],
  },
] as const;

export const PROFILE_OPTIONS = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'coding', label: 'Coding' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'full', label: 'Full' },
] as const;

// ===================== 内部常量 =====================

const TOOL_GROUPS: Record<string, string[]> = {
  'group:memory': ['memory_search', 'memory_get'],
  'group:web': ['web_search', 'web_fetch'],
  'group:fs': ['read', 'write', 'edit', 'apply_patch'],
  'group:runtime': ['exec', 'process'],
  'group:sessions': ['sessions_list', 'sessions_history', 'sessions_send', 'sessions_spawn', 'subagents', 'session_status'],
  'group:ui': ['browser', 'canvas'],
  'group:automation': ['cron', 'gateway'],
  'group:messaging': ['message'],
  'group:nodes': ['nodes'],
};

const TOOL_PROFILES: Record<string, { allow?: string[] }> = {
  minimal: { allow: ['session_status'] },
  coding: { allow: ['group:fs', 'group:runtime', 'group:sessions', 'group:memory', 'image'] },
  messaging: { allow: ['group:messaging', 'sessions_list', 'sessions_history', 'sessions_send', 'session_status'] },
  full: {},
};

const TOOL_NAME_ALIASES: Record<string, string> = { bash: 'exec', 'apply-patch': 'apply_patch' };

// ===================== 公开函数 =====================

export function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}

function expandToolGroupsList(list: string[]): string[] {
  const expanded: string[] = [];
  for (const v of list.map(n => normalizeToolName(n)).filter(Boolean)) {
    const group = TOOL_GROUPS[v];
    if (group) expanded.push(...group);
    else expanded.push(v);
  }
  return [...new Set(expanded)];
}

function matchesPatterns(name: string, patterns: string[]): boolean {
  const normalized = normalizeToolName(name);
  const expanded = expandToolGroupsList(patterns);
  for (const p of expanded) {
    if (p === '*') return true;
    if (p === normalized) return true;
    if (p.includes('*')) {
      const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*')}$`);
      if (re.test(normalized)) return true;
    }
  }
  if (normalized === 'apply_patch' && expanded.includes('exec')) return true;
  return false;
}

export function isAllowedByPolicy(name: string, policy?: { allow?: string[]; deny?: string[] }): boolean {
  if (!policy) return true;
  const normalized = normalizeToolName(name);
  if (policy.deny && matchesPatterns(normalized, policy.deny)) return false;
  if (!policy.allow || policy.allow.length === 0) return true;
  if (matchesPatterns(normalized, policy.allow)) return true;
  if (normalized === 'apply_patch' && policy.allow && matchesPatterns('exec', policy.allow)) return true;
  return false;
}

export function resolveToolProfilePolicy(profile: string): { allow?: string[]; deny?: string[] } | undefined {
  const p = TOOL_PROFILES[profile];
  if (!p) return undefined;
  if (!p.allow) return undefined;
  return { allow: [...p.allow] };
}

// ===================== 类型定义 =====================

export interface ToolInfo {
  id: string;
  label: string;
  description: string;
}

export interface ToolSection {
  id: string;
  label: string;
  tools: ToolInfo[];
}
