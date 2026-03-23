import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawWorkspaces, openclawFiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/openclaw-workspaces/[id]/status
 * 获取同步状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 校验资源存在性
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, id));

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 获取文件统计
    const stats = await db.select({
      total: sql<number>`count(*)`,
      synced: sql<number>`sum(case when ${openclawFiles.syncStatus} = 'synced' then 1 else 0 end)`,
      pending: sql<number>`sum(case when ${openclawFiles.syncStatus} = 'pending' then 1 else 0 end)`,
      conflict: sql<number>`sum(case when ${openclawFiles.syncStatus} = 'conflict' then 1 else 0 end)`,
    })
      .from(openclawFiles)
      .where(eq(openclawFiles.workspaceId, id));

    const [stat] = stats;

    return NextResponse.json({
      status: workspace.syncStatus,
      lastSyncAt: workspace.lastSyncAt,
      lastError: workspace.lastError,
      totalFiles: stat?.total || 0,
      syncedFiles: stat?.synced || 0,
      pendingFiles: stat?.pending || 0,
      conflictFiles: stat?.conflict || 0,
    });
  } catch (error) {
    console.error('[API] GET /openclaw-workspaces/[id]/status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
