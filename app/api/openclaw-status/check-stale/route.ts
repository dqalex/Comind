import { NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawStatus } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 心跳超时阈值：5 分钟没有心跳就认为 Agent 已离线
const STALE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * POST - 检查并重置超时的 working 状态
 * 将 lastHeartbeat 超过阈值且状态为 working/waiting 的记录重置为 offline
 */
export async function POST() {
  try {
    const cutoff = new Date(Date.now() - STALE_TIMEOUT_MS);
    
    // 查找所有 working/waiting 且心跳超时的记录
    const staleRecords = await db
      .select({ id: openclawStatus.id, memberId: openclawStatus.memberId, status: openclawStatus.status, lastHeartbeat: openclawStatus.lastHeartbeat })
      .from(openclawStatus)
      .where(
        and(
          inArray(openclawStatus.status, ['working', 'waiting']),
        )
      );
    
    // 在应用层过滤：lastHeartbeat 为 null 或早于 cutoff
    const toReset = staleRecords.filter(r => {
      if (!r.lastHeartbeat) return true; // 没有心跳记录，视为超时
      return r.lastHeartbeat < cutoff;
    });
    
    if (toReset.length === 0) {
      return NextResponse.json({ reset: 0 });
    }
    
    const now = new Date();
    const resetIds: string[] = [];
    
    for (const record of toReset) {
      await db
        .update(openclawStatus)
        .set({
          status: 'offline',
          currentAction: null,
          progress: 0,
          updatedAt: now,
        })
        .where(eq(openclawStatus.id, record.id));
      resetIds.push(record.memberId);
    }
    
    // 广播状态变更
    for (const memberId of resetIds) {
      eventBus.emit({ type: 'openclaw_status', resourceId: memberId });
    }
    
    console.log(`[check-stale] 重置 ${resetIds.length} 个超时状态: ${resetIds.join(', ')}`);
    return NextResponse.json({ reset: resetIds.length, memberIds: resetIds });
  } catch (error) {
    console.error('[check-stale] Check failed:', error);
    return NextResponse.json({ error: 'Failed to check stale status' }, { status: 500 });
  }
}
