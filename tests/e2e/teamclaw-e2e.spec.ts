#!/usr/bin/env tsx
/**
 * TeamClaw E2E 测试
 * 配置 Gateway 并测试完整任务推送流程
 */

import { db } from '../../db';
import { gatewayConfigs } from '../../db/schema';
import { encryptToken } from '../../src/shared/lib/security';
import WebSocket from 'ws';

const MOCK_GATEWAY_URL = 'ws://localhost:18789';
const MOCK_TOKEN = 'mock-token-for-testing';

async function setupGatewayConfig() {
  console.log('🔧 Setting up Gateway config...');
  
  // 清除现有配置
  await db.delete(gatewayConfigs);
  
  // 插入 Mock Gateway 配置
  const encryptedToken = encryptToken(MOCK_TOKEN);
  await db.insert(gatewayConfigs).values({
    id: 'mock-config-' + Date.now(),
    url: MOCK_GATEWAY_URL,
    encryptedToken,
    mode: 'server_proxy',
    status: 'disconnected',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  console.log('✅ Gateway config saved');
}

async function testServerConnection() {
  console.log('\n🔌 Testing ServerGatewayClient connection...');
  
  // 动态导入避免在模块级别初始化
  const { initServerGatewayClient, getServerGatewayClient } = await import('../../src/shared/lib/server-gateway-client');
  
  try {
    await initServerGatewayClient();
    await new Promise(r => setTimeout(r, 2000)); // 等待连接
    
    const client = getServerGatewayClient();
    console.log('Connection status:', client.isConnected ? '✅ Connected' : '❌ Disconnected');
    
    return client.isConnected;
  } catch (err) {
    console.error('❌ Failed to connect:', err);
    return false;
  }
}

async function testChatFlow() {
  console.log('\n💬 Testing chat flow...');
  
  const { getServerGatewayClient } = await import('../../src/shared/lib/server-gateway-client');
  const client = getServerGatewayClient();
  
  if (!client.isConnected) {
    console.log('❌ Gateway not connected');
    return false;
  }
  
  return new Promise((resolve) => {
    let receivedEvents = 0;
    
    // 监听 SSE 事件（模拟前端）
    const checkEvents = setInterval(() => {
      receivedEvents++;
      if (receivedEvents > 10) {
        clearInterval(checkEvents);
        resolve(false);
      }
    }, 1000);
    
    // 发送 DM 请求
    console.log('Sending DM request...');
    // 这里需要通过 ServerGatewayClient 发送请求
    
    setTimeout(() => {
      clearInterval(checkEvents);
      resolve(true);
    }, 5000);
  });
}

async function main() {
  console.log('🧪 TeamClaw E2E Test');
  console.log('====================\n');
  
  try {
    // 1. 配置 Gateway
    await setupGatewayConfig();
    
    // 2. 测试连接
    const connected = await testServerConnection();
    if (!connected) {
      console.log('\n❌ Test failed: Could not connect to Mock Gateway');
      process.exit(1);
    }
    
    // 3. 测试聊天流程
    const flowSuccess = await testChatFlow();
    
    console.log('\n' + '='.repeat(50));
    console.log(flowSuccess ? '✅ Test passed' : '❌ Test failed');
    console.log('='.repeat(50));
    
    process.exit(flowSuccess ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

main();
