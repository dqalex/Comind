/**
 * POST /api/tasks/refresh
 * 手动刷新任务列表文件（TODO.md + DONE.md）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawWorkspaces, tasks } from '@/db/schema';
import { refreshTaskList } from '@/lib/openclaw/task-list-generator';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 获取所有有 memberId 的 workspace
    const workspaces = await db.select()
      .from(openclawWorkspaces);

    const results = [];
    for (const ws of workspaces) {
      if (ws.memberId) {
        const updated = await refreshTaskList(ws.id);
        results.push({ workspaceId: ws.id, updated });
      }
    }

    return NextResponse.json({
      success: true,
      refreshed: results.length,
      details: results,
    });
  } catch (error) {
    console.error('[tasks/refresh] Refresh failed:', error);
    return NextResponse.json(
      { success: false, error: 'Refresh failed' },
      { status: 500 }
    );
  }
}
