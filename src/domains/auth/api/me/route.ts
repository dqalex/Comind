/**
 * 获取当前登录用户信息 API
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getUserById } from '@/lib/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, auth) => {
  try {
    // 查询用户完整信息
    const user = await getUserById(auth.userId!);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 返回用户信息（不包含敏感字段）
    const { passwordHash, lockedUntil, ...safeUser } = user;
    
    return NextResponse.json({ user: safeUser });

  } catch (error) {
    console.error('[Auth Me] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user information' },
      { status: 500 }
    );
  }
});
