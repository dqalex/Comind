import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawWorkspaces, openclawFiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { SYNC_DIRS, SYNC_ROOT_FILES } from '@/lib/openclaw/config';

/**
 * POST /api/openclaw-workspaces/[id]/scan
 * 扫描 workspace 文件
 */
export async function POST(
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

    // 检查路径是否存在
    if (!existsSync(workspace.path)) {
      return NextResponse.json({ error: 'Workspace path does not exist' }, { status: 400 });
    }

    // 扫描文件
    const files = await scanFiles(workspace.path, workspace.excludePatterns || []);

    // 获取现有文件
    const existingFiles = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.workspaceId, id));
    const existingMap = new Map(existingFiles.map(f => [f.relativePath, f]));

    // 分类统计
    const byType: Record<string, number> = {};
    const fileList: Array<{
      path: string;
      type: string;
      size: number;
      modifiedAt: Date;
      status: 'new' | 'modified' | 'synced' | 'conflict';
    }> = [];

    for (const file of files) {
      const relativePath = relative(workspace.path, file.path);
      const fileType = detectFileType(relativePath);

      byType[fileType] = (byType[fileType] || 0) + 1;

      const existing = existingMap.get(relativePath);
      let status: 'new' | 'modified' | 'synced' | 'conflict' = 'new';

      if (existing) {
        if (existing.syncStatus === 'conflict') {
          status = 'conflict';
        } else if (!existing.fileModifiedAt || file.modifiedAt > existing.fileModifiedAt) {
          // fileModifiedAt 为 null（首次同步未设置此字段）视为 modified
          status = 'modified';
        } else {
          status = 'synced';
        }
      }

      fileList.push({
        path: relativePath,
        type: fileType,
        size: file.size,
        modifiedAt: file.modifiedAt,
        status,
      });
    }

    return NextResponse.json({
      total: files.length,
      byType,
      files: fileList,
    });
  } catch (error) {
    console.error('[API] POST /openclaw-workspaces/[id]/scan error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}

/**
 * 扫描目录中的文件（仅限白名单目录，与 sync 路由保持一致）
 */
async function scanFiles(
  dir: string,
  excludePatterns: string[]
): Promise<Array<{ path: string; size: number; modifiedAt: Date }>> {
  const results: Array<{ path: string; size: number; modifiedAt: Date }> = [];

  function scanRecursive(currentDir: string) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      // 检查排除规则
      if (shouldExclude(fullPath, excludePatterns)) continue;

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        scanRecursive(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stat = statSync(fullPath);
        results.push({
          path: fullPath,
          size: stat.size,
          modifiedAt: new Date(stat.mtime),
        });
      }
    }
  }

  // 1. 扫描根目录白名单文件
  for (const fileName of SYNC_ROOT_FILES) {
    const fullPath = join(dir, fileName);
    if (existsSync(fullPath)) {
      try {
        const stat = statSync(fullPath);
        results.push({
          path: fullPath,
          size: stat.size,
          modifiedAt: new Date(stat.mtime),
        });
      } catch {
        // 跳过读取失败的文件
      }
    }
  }

  // 2. 只扫描白名单子目录
  for (const subDir of SYNC_DIRS) {
    scanRecursive(join(dir, subDir));
  }

  return results;
}

/**
 * 检查路径是否应该被排除
 */
function shouldExclude(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('**')) {
      const basePattern = pattern.replace('/**', '').replace('**/', '');
      if (path.includes(basePattern)) return true;
    } else if (path.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * 检测文件类型
 */
function detectFileType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('report')) return 'report';
  if (lower.includes('opportunity')) return 'opportunity';
  if (lower.includes('daily')) return 'daily';
  if (lower.includes('analysis')) return 'analysis';
  if (lower.includes('task')) return 'task_output';
  return 'note';
}
