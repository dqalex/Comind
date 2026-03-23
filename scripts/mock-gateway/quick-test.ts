#!/usr/bin/env tsx
/**
 * Mock Gateway 快速连接测试
 */

import WebSocket from 'ws';
import http from 'http';

const WS_URL = 'ws://localhost:18789';
const HTTP_URL = 'http://localhost:18790';

let passed = false;

async function quickTest() {
  console.log('🧪 Mock Gateway 快速测试...\n');

  // HTTP 健康检查
  try {
    const health = await new Promise<{ status: number; data: string }>((resolve, reject) => {
      http.get(`${HTTP_URL}/api/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, data }));
      }).on('error', reject);
    });

    console.log(`✅ HTTP 健康检查: ${health.status}`);
    console.log(`   ${health.data}\n`);
  } catch (e) {
    console.log(`❌ HTTP 健康检查失败: ${e}`);
  }

  // WebSocket 连接测试
  try {
    const ws = new WebSocket(WS_URL);

    await new Promise<void>((resolve, reject) => {
      let step = 0;

      ws.on('open', () => {
        console.log('✅ WebSocket 已连接');
        ws.send(JSON.stringify({ type: 'challenge' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log(`📥 [${++step}] 收到: type=${msg.type}, event=${msg.event}`);

        if (msg.event === 'connect.challenge') {
          console.log('   → 发送 connect 请求');
          ws.send(JSON.stringify({
            type: 'req',
            id: 'test-1',
            method: 'connect',
            params: { clientId: 'quick-test', role: 'operator' }
          }));
        }

        if (msg.payload?.type === 'hello-ok') {
          console.log('✅ 认证成功! hello-ok received');
          passed = true;
          resolve();
        }
      });

      ws.on('error', (e) => {
        console.log(`❌ WebSocket error: ${e}`);
        reject(e);
      });

      setTimeout(() => {
        if (!passed) {
          console.log('❌ Timeout');
          reject(new Error('Timeout'));
        }
      }, 5000);
    });

    ws.close();
  } catch (e) {
    console.log(`\n❌ WebSocket 测试失败: ${e}\n`);
    process.exit(1);
  }
}

quickTest().then(() => {
  if (passed) {
    console.log('\n🎉 Mock Gateway 测试通过!\n');
    process.exit(0);
  }
});
