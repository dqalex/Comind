/**
 * Markdown 双向同步引擎 - 共享基础设施
 * 
 * 包含 Frontmatter 解析、成员缓存、同步防循环机制
 */

import { db } from '@/db';
import { members } from '@/db/schema';
import type { Member } from '@/db/schema';

// ============================================================
// 类型定义
// ============================================================

export type SyncType = 'teamclaw:tasks' | 'teamclaw:schedules' | 'teamclaw:deliveries' | 'teamclaw:milestones' | 'task_list';

export interface Frontmatter {
  type: SyncType | string;  // 允许任意 string 以兼容未识别类型
  project?: string;
  // 交付相关字段
  delivery_id?: string;      // 关联的交付记录 ID
  delivery_status?: 'pending' | 'approved' | 'rejected' | 'revision_needed';
  delivery_assignee?: string;
  delivery_platform?: string;
  delivery_version?: number;
  delivery_reviewer?: string;
  delivery_comment?: string;
  related_tasks?: string[];
}

// ============================================================
// 防止同步死循环
// ============================================================

const _syncingDocIds = new Set<string>();

/** 检查文档是否正在被同步引擎写入（供 API 层判断是否跳过 parse） */
export function isDocumentSyncing(docId: string): boolean {
  return _syncingDocIds.has(docId);
}

/** 标记文档正在同步 */
export function markSyncing(docId: string): void {
  _syncingDocIds.add(docId);
}

/** 延迟清除同步标记 */
export function unmarkSyncingDelayed(docId: string, delayMs = 1000): void {
  setTimeout(() => _syncingDocIds.delete(docId), delayMs);
}

// ============================================================
// Frontmatter 解析
// ============================================================

export function parseFrontmatter(content: string): { frontmatter: Frontmatter | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };

  const raw = match[1];
  const body = match[2];
  const fm: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // 处理 YAML 数组简写 [a, b] → string[]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).trim();
    }
    fm[key] = val;
  }

  const isTeamclawType = fm.type && (fm.type.startsWith('teamclaw:') || fm.type === 'task_list');
  const hasDeliveryFields = !!fm.delivery_status;

  // 非 teamclaw 类型且无交付字段 → 不需要解析
  if (!isTeamclawType && !hasDeliveryFields) {
    return { frontmatter: null, body: content };
  }

  // 解析交付相关字段
  const frontmatter: Frontmatter = {
    type: fm.type as SyncType | string,
    project: fm.project,
  };

  if (fm.delivery_status) {
    frontmatter.delivery_status = fm.delivery_status as Frontmatter['delivery_status'];
  }
  if (fm.delivery_assignee) frontmatter.delivery_assignee = fm.delivery_assignee;
  if (fm.delivery_platform) frontmatter.delivery_platform = fm.delivery_platform;
  if (fm.delivery_version) frontmatter.delivery_version = parseInt(fm.delivery_version, 10) || 1;
  if (fm.delivery_reviewer) frontmatter.delivery_reviewer = fm.delivery_reviewer;
  if (fm.delivery_comment) frontmatter.delivery_comment = fm.delivery_comment;
  if (fm.related_tasks) {
    frontmatter.related_tasks = fm.related_tasks.split(',').map(s => s.trim()).filter(Boolean);
  }

  return { frontmatter, body };
}

// ============================================================
// 成员名 ↔ ID 映射（缓存）
// ============================================================

const MEMBER_CACHE_TTL = 30_000; // 30 秒缓存过期
let memberCacheTime = 0;
let memberCache: Member[] = [];

/** 清除成员缓存（在成员数据变更时调用） */
export function invalidateMemberCache(): void {
  memberCacheTime = 0;
  memberCache = [];
}

export async function getMembers(): Promise<Member[]> {
  const now = Date.now();
  if (now - memberCacheTime < MEMBER_CACHE_TTL && memberCache.length > 0) {
    return memberCache;
  }
  memberCache = await db.select().from(members);
  memberCacheTime = now;
  return memberCache;
}

export async function memberNameToId(name: string): Promise<string | null> {
  const all = await getMembers();
  const m = all.find(m => m.name === name);
  return m?.id || null;
}

export async function memberIdToName(id: string): Promise<string> {
  const all = await getMembers();
  const m = all.find(m => m.id === id);
  return m?.name || id;
}
