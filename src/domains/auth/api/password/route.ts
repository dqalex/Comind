/**
 * 修改密码 API
 * PUT /api/auth/password
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/with-auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  getUserById,
  verifyPassword,
  hashPassword,
} from '@/lib/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 密码强度要求：至少 8 位，包含数字和字母
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

export const PUT = withAuth(async (request, auth) => {
  try {
    // ============================================================
    // 参数校验
    // ============================================================
    
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }
    
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }
    
    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain both letters and numbers' },
        { status: 400 }
      );
    }
    
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password cannot be the same as current password' },
        { status: 400 }
      );
    }

    // ============================================================
    // 查询用户
    // ============================================================
    
    const user = await getUserById(auth.userId!);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ============================================================
    // 验证当前密码
    // ============================================================

    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash, user.id);

    if (!isValidPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // ============================================================
    // 更新密码
    // ============================================================
    
    const newPasswordHash = await hashPassword(newPassword, user.id);
    
    await db.update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('[Auth Password] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update password. Please try again later' },
      { status: 500 }
    );
  }
});
