#!/usr/bin/env tsx
/**
 * 管理员密码重置脚本
 * 直接在服务器上执行，重置指定用户的密码
 * 
 * 用法:
 *   npx tsx scripts/reset-admin-password.ts <userId> [newPassword]
 */

import * as argon2 from 'argon2';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * 生成随机密码
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 25)];
  password += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 25)];
  password += '23456789'[Math.floor(Math.random() * 7)];
  for (let i = 3; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 哈希密码（使用 argon2id，绑定 userId）
 */
async function hashPassword(password: string, userId: string): Promise<string> {
  const salt = `user:${userId}`;
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    salt: Buffer.from(salt),
    raw: false,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const userId = args[0];
  let newPassword = args[1];

  if (!userId) {
    console.error('❌ 请提供用户 ID');
    console.log('用法: npx tsx scripts/reset-admin-password.ts <userId> [newPassword]');
    process.exit(1);
  }

  // 如果没有提供密码，生成随机密码
  if (!newPassword) {
    newPassword = generateRandomPassword();
    console.log('🎲 已生成随机密码');
  }

  try {
    // 检查用户是否存在
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]) {
      console.error('❌ 用户不存在:', userId);
      process.exit(1);
    }

    console.log('👤 用户:', user[0].email, `(${user[0].role})`);

    // 生成新密码哈希
    const passwordHash = await hashPassword(newPassword, userId);

    // 更新数据库
    await db.update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    console.log('✅ 密码重置成功！');
    console.log('');
    console.error('═══════════════════════════════════════');
    console.error('📧 邮箱:', user[0].email);
    console.error('🔑 新密码: [已设置，请检查命令行参数或重新运行]');
    console.error('═══════════════════════════════════════');
    console.error('');
    console.error('⚠️  安全提示：');
    console.error('   1. 如果使用了随机密码，请重新运行并指定密码');
    console.error('   2. 建议登录后立即修改密码');

  } catch (error) {
    console.error('❌ 重置失败:', error);
    process.exit(1);
  }
}

main();
