/**
 * Gateway 配置数据库 CRUD
 * 
 * 管理 Gateway 连接配置的持久化
 * 从 server-gateway-client.ts 提取
 */

import 'server-only';
import { db } from '@/db';
import { gatewayConfigs } from '@/db/schema';
import { encryptToken } from '@/lib/security';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { logger } from './gateway-logger';
import type { ConnectionStatus } from './gateway-types';

/**
 * 保存 Gateway 配置到数据库
 */
export async function saveGatewayConfig(config: {
  url: string;
  token: string;
  mode: 'server_proxy' | 'browser_direct';
}): Promise<string> {
  const id = randomBytes(8).toString('hex');
  const encryptedToken = encryptToken(config.token);
  const now = new Date();

  await db.insert(gatewayConfigs).values({
    id,
    name: 'default',
    url: config.url,
    encryptedToken,
    mode: config.mode,
    status: 'disconnected',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });

  // 清除旧的默认配置
  await db.update(gatewayConfigs)
    .set({ isDefault: false })
    .where(eq(gatewayConfigs.isDefault, true));

  // 设置新配置为默认
  await db.update(gatewayConfigs)
    .set({ isDefault: true })
    .where(eq(gatewayConfigs.id, id));

  logger.info('config_saved', { id, mode: config.mode });

  return id;
}

/**
 * 获取当前 Gateway 配置
 */
export async function getGatewayConfig(): Promise<{
  id: string;
  url: string;
  mode: 'server_proxy' | 'browser_direct';
  status: ConnectionStatus;
} | null> {
  const configs = await db.select()
    .from(gatewayConfigs)
    .where(eq(gatewayConfigs.isDefault, true))
    .limit(1);

  if (configs.length === 0) {
    return null;
  }

  const config = configs[0];
  return {
    id: config.id,
    url: config.url,
    mode: config.mode as 'server_proxy' | 'browser_direct',
    status: config.status as ConnectionStatus,
  };
}

/**
 * 删除 Gateway 配置
 */
export async function deleteGatewayConfig(id: string): Promise<void> {
  await db.delete(gatewayConfigs).where(eq(gatewayConfigs.id, id));
  logger.info('config_deleted', { id });
}
