/**
 * 用户注册 API
 * POST /api/auth/register
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db, users, members } from '@/db';
import { hashPassword, getUserByEmail } from '@/lib/auth';
import { generateId, generateMemberId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 邮箱格式校验
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 密码强度要求：至少 8 位，包含数字和字母
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

// v3.0: 注册速率限制（内存缓存，生产环境建议使用 Redis）
const registerAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_REGISTER_ATTEMPTS = 5;      // 每个 IP 最多 5 次注册尝试
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 小时窗口

function getClientIp(headersList: Headers): string {
  // 优先从代理头获取真实 IP
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

function isRegisterLimited(ip: string): { limited: boolean; retryAfter?: number } {
  const record = registerAttempts.get(ip);
  if (!record) return { limited: false };
  
  const now = Date.now();
  
  // 超出窗口期，重置记录
  if (now - record.firstAttempt > REGISTER_WINDOW_MS) {
    registerAttempts.delete(ip);
    return { limited: false };
  }
  
  if (record.count >= MAX_REGISTER_ATTEMPTS) {
    const retryAfter = Math.ceil((record.firstAttempt + REGISTER_WINDOW_MS - now) / 60000);
    return { limited: true, retryAfter };
  }
  
  return { limited: false };
}

function recordRegisterAttempt(ip: string): void {
  const now = Date.now();
  const record = registerAttempts.get(ip);
  
  if (!record || now - record.firstAttempt > REGISTER_WINDOW_MS) {
    registerAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

export async function POST(request: Request) {
  try {
    // ============================================================
    // 速率限制检查（基于 IP）
    // ============================================================
    
    const headersList = await headers();
    const clientIp = getClientIp(headersList);
    const limitStatus = isRegisterLimited(clientIp);
    
    if (limitStatus.limited) {
      return NextResponse.json(
        { error: `注册尝试过多，请 ${limitStatus.retryAfter} 分钟后重试` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    // ============================================================
    // 参数校验
    // ============================================================
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain both letters and numbers' },
        { status: 400 }
      );
    }
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    if (name.trim().length > 50) {
      return NextResponse.json({ error: 'Name cannot exceed 50 characters' }, { status: 400 });
    }

    // ============================================================
    // 检查邮箱是否已注册
    // ============================================================
    
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // ============================================================
    // 检查是否为首个用户（首个用户自动成为 admin）
    // ============================================================
    
    const userCount = await db.select({ id: users.id }).from(users).limit(1);
    const isFirstUser = userCount.length === 0;

    // ============================================================
    // 创建用户
    // ============================================================
    
    const now = new Date();
    const userId = generateId();
    const passwordHash = await hashPassword(password, userId);
    
    const newUser = {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: isFirstUser ? 'admin' as const : 'member' as const,
      passwordHash,
      emailVerified: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(users).values(newUser);
    
    // ============================================================
    // v3.0: 同步创建团队成员记录
    // ============================================================
    
    const memberId = generateMemberId();
    const newMember = {
      id: memberId,
      userId: userId,  // v3.0: 关联认证用户
      name: name.trim(),
      type: 'human' as const,
      email: email.toLowerCase().trim(),
      online: false,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(members).values(newMember);
    
    // 通知前端刷新成员列表
    eventBus.emit({ type: 'member_update', resourceId: memberId });
    
    // 记录成功注册（也计入限流计数，防止同 IP 批量注册）
    recordRegisterAttempt(clientIp);

    // ============================================================
    // 返回结果（不包含敏感字段）
    // ============================================================
    
    const { passwordHash: _, ...safeUser } = newUser;
    
    return NextResponse.json({
      message: 'Registration successful',
      user: safeUser,
    }, { status: 201 });

  } catch (error) {
    console.error('[Auth Register] Error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again later' },
      { status: 500 }
    );
  }
}
