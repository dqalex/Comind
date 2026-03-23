import { NextRequest, NextResponse } from 'next/server';
import { db, users, members } from '@/db';
import { eq } from 'drizzle-orm';
import { validateAuth } from '@/lib/auth';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * 获取数据库路径（与 db/index.ts 保持一致）
 */
function getDatabasePath(): string {
  if (process.env.TEAMCLAW_DB_PATH) {
    return process.env.TEAMCLAW_DB_PATH;
  }
  return join(process.cwd(), 'data', 'teamclaw.db');
}

/**
 * POST /api/admin/reset-init - 重置系统到初始化状态（仅管理员）
 * 
 * 支持两种模式：
 * - settings: 仅重置设置（删除用户和成员，保留数据库）
 * - full: 完全重置（删除数据库文件）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await validateAuth(request);
    if (!auth.valid || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 解析请求
    const body = await request.json();
    const { securityCode, mode = 'settings' } = body;

    if (!securityCode) {
      return NextResponse.json({ error: 'Security code required' }, { status: 400 });
    }

    // 验证模式参数
    if (mode !== 'settings' && mode !== 'full') {
      return NextResponse.json({ error: 'Invalid mode. Must be "settings" or "full"' }, { status: 400 });
    }

    // 验证安全码
    const [user] = await db.select({ securityCodeHash: users.securityCodeHash }).from(users).where(eq(users.id, auth.user.id));
    
    if (user?.securityCodeHash) {
      const { verifySecurityCode } = await import('@/lib/auth');
      const valid = await verifySecurityCode(securityCode, user.securityCodeHash, auth.user.id);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid security code' }, { status: 401 });
      }
    }

    if (mode === 'full') {
      // 完全重置：删除数据库文件
      const dbPath = getDatabasePath();
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      
      // 关闭数据库连接（通过删除全局引用）
      const globalDb = globalThis as unknown as Record<string, unknown>;
      delete globalDb['__teamclaw_sqlite__'];
      
      // 删除数据库文件
      try {
        if (existsSync(dbPath)) {
          unlinkSync(dbPath);
          // eslint-disable-next-line no-console
      console.log('[Admin] Database file deleted:', dbPath);
        }
        if (existsSync(walPath)) {
          unlinkSync(walPath);
        }
        if (existsSync(shmPath)) {
          unlinkSync(shmPath);
        }
      } catch (err) {
        console.error('[Admin] Failed to delete database:', err);
        return NextResponse.json({ error: 'Failed to delete database' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true, 
        mode: 'full',
        message: 'Database deleted. System will re-initialize on next startup.' 
      });
    } else {
      // 仅重置设置：删除用户和成员数据
      await db.delete(members);
      await db.delete(users);

      return NextResponse.json({ 
        success: true, 
        mode: 'settings',
        message: 'System reset to initialization state. Please refresh and go to /init to set up.' 
      });
    }
  } catch (error) {
    console.error('[Admin] Failed to reset init:', error);
    return NextResponse.json({ error: 'Failed to reset system' }, { status: 500 });
  }
}
