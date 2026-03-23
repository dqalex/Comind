/**
 * 初始化 Mock Gateway 配置
 * 
 * 用途：为本地测试创建 Gateway 配置，连接到 Mock Gateway
 * 绕过 API 权限检查，直接操作数据库
 */

import { db } from '../../db';
import { gatewayConfigs } from '../../db/schema';
import { encryptToken } from '../../src/shared/lib/security';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';

const MOCK_GATEWAY_URL = 'ws://localhost:18789';
const MOCK_TOKEN = 'mock-token-for-local-testing';

async function initMockGatewayConfig() {
  console.log('🔄 初始化 Mock Gateway 配置...\n');

  try {
    // 检查是否已有配置
    const existing = await db.select().from(gatewayConfigs);
    
    if (existing.length > 0) {
      console.log('⚠️  已有 Gateway 配置:');
      existing.forEach(c => {
        console.log(`   - ID: ${c.id}`);
        console.log(`   - URL: ${c.url}`);
        console.log(`   - Status: ${c.status}`);
        console.log(`   - Mode: ${c.mode}`);
      });
      
      // 询问是否覆盖
      console.log('\n📌 如需重新创建，请先删除现有配置:');
      console.log(`   npx tsx scripts/clear-gateway-config.ts`);
      return;
    }

    // 创建新配置
    const id = randomBytes(8).toString('hex');
    const encryptedToken = encryptToken(MOCK_TOKEN);
    const now = new Date();

    await db.insert(gatewayConfigs).values({
      id,
      name: 'mock-gateway',
      url: MOCK_GATEWAY_URL,
      encryptedToken,
      mode: 'server_proxy',
      status: 'disconnected',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ Mock Gateway 配置创建成功!\n');
    console.log('配置信息:');
    console.log(`   ID: ${id}`);
    console.log(`   URL: ${MOCK_GATEWAY_URL}`);
    console.log(`   Mode: server_proxy`);
    console.log(`   Status: disconnected`);
    console.log('\n📝 下一步:');
    console.log('   1. 启动 Mock Gateway: npm run mock:gateway');
    console.log('   2. 重启 TeamClaw: npm run dev');
    console.log('   3. TeamClaw 会自动连接到 Mock Gateway');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

initMockGatewayConfig();
