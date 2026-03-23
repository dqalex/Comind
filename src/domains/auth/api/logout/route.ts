/**
 * 用户登出 API
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'cms_session';

export async function POST() {
  try {
    // 清除 session cookie
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);

    return NextResponse.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('[Auth Logout] Error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
