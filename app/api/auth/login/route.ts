/**
 * 用户登录 API
 * POST /api/auth/login
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyPassword,
  generateSessionToken,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
  getUserByEmail,
  updateLastLogin,
} from '@/lib/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// Session cookie 配置
const SESSION_COOKIE_NAME = 'cms_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // ============================================================
    // 参数校验
    // ============================================================
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // ============================================================
    // 登录限流检查（基于邮箱）
    // ============================================================
    
    const lockKey = `login:${email.toLowerCase()}`;
    const lockStatus = isLoginLocked(lockKey);
    
    if (lockStatus.locked) {
      const unlockTime = lockStatus.unlockAt ? 
        Math.ceil((lockStatus.unlockAt.getTime() - Date.now()) / 60000) : 15;
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${unlockTime} minutes` },
        { status: 429 }
      );
    }

    // ============================================================
    // 查询用户
    // ============================================================
    
    const user = await getUserByEmail(email);
    
    // 用户不存在或密码错误时返回相同错误（防止枚举攻击）
    if (!user) {
      recordLoginFailure(lockKey);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // ============================================================
    // 验证密码（绑定 userId 防止哈希复制攻击）
    // ============================================================
    
    const isValidPassword = await verifyPassword(password, user.passwordHash, user.id);
    
    if (!isValidPassword) {
      recordLoginFailure(lockKey);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // ============================================================
    // 检查账户状态
    // ============================================================
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `账户已锁定，请 ${unlockTime} 分钟后重试` },
        { status: 403 }
      );
    }

    // ============================================================
    // 登录成功，生成 session token
    // ============================================================
    
    clearLoginFailures(lockKey);
    
    const { token, expiresAt } = generateSessionToken(user.id);
    
    // 更新最后登录时间
    await updateLastLogin(user.id);

    // ============================================================
    // 设置 session cookie
    // ============================================================
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...SESSION_COOKIE_OPTIONS,
      expires: expiresAt,
    });

    // ============================================================
    // 返回用户信息（不包含敏感字段）
    // ============================================================
    
    const { passwordHash: _passwordHash, lockedUntil: _lockedUntil, ...safeUser } = user;
    
    return NextResponse.json({
      message: 'Login successful',
      user: safeUser,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('[Auth Login] Error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again later' },
      { status: 500 }
    );
  }
}
