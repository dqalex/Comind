#!/usr/bin/env tsx
/**
 * TeamClaw 服务测试
 * 直接测试 TeamClaw 的 API 和前端集成
 * 
 * 测试流程：
 *   1. 调用 TeamClaw /api/task-push 准备消息
 *   2. 通过 WebSocket 监听 Gateway 响应
 *   3. 验证 SSE 事件是否正确广播
 *   4. 检查前端是否能接收到事件
 */

import WebSocket from 'ws';
import http from 'http';

const TEAMCLAW_URL = 'http://localhost:3000';
const GATEWAY_URL = 'ws://localhost:18789';
const SSE_URL = 'http://localhost:3000/api/sse';

// 颜色输出
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: 'info' | 'success' | 'error' | 'warn', message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: c.blue,
    success: c.green,
    error: c.red,
    warn: c.yellow,
  };
  console.log(`${colors[level]}[${timestamp}]${c.reset} ${message}`);
}

// 步骤 1: 测试 TeamClaw API 健康检查
async function testHealthCheck(): Promise<boolean> {
  log('info', '📡 Testing TeamClaw API health...');
  try {
    const response = await fetch(`${TEAMCLAW_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      log('success', `✅ TeamClaw API is healthy: ${JSON.stringify(data)}`);
      return true;
    } else {
      log('error', `❌ TeamClaw API health check failed: ${response.status}`);
      return false;
    }
  } catch (err) {
    log('error', `❌ Failed to connect to TeamClaw: ${err}`);
    return false;
  }
}

// 步骤 2: 测试 SSE 连接
async function testSSEConnection(): Promise<{ success: boolean; events: any[] }> {
  log('info', '📡 Testing SSE connection...');
  const events: any[] = [];
  
  return new Promise((resolve) => {
    const req = http.get(SSE_URL, { headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              events.push(data);
              log('success', `📨 SSE Event received: ${data.type || 'unknown'}`);
            } catch (e) {
              // 忽略非 JSON 数据
            }
          }
        }
      });
      
      res.on('error', (err) => {
        log('error', `❌ SSE error: ${err.message}`);
        resolve({ success: false, events });
      });
      
      // 5秒后关闭连接
      setTimeout(() => {
        req.destroy();
        resolve({ success: events.length > 0, events });
      }, 5000);
    });
    
    req.on('error', (err) => {
      log('error', `❌ SSE connection failed: ${err.message}`);
      resolve({ success: false, events });
    });
    
    // 3秒超时
    setTimeout(() => {
      req.destroy();
      resolve({ success: false, events });
    }, 3000);
  });
}

// 步骤 3: 测试 WebSocket Gateway 连接
async function testGatewayConnection(): Promise<{ success: boolean; sessionKey?: string }> {
  log('info', '🔌 Testing Gateway WebSocket connection...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(GATEWAY_URL);
    let sessionKey: string | undefined;
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ success: false });
    }, 10000);
    
    ws.on('open', () => {
      log('info', 'Connected to Gateway, sending challenge...');
      ws.send(JSON.stringify({ type: 'challenge' }));
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'challenge') {
          ws.send(JSON.stringify({
            type: 'connect',
            clientId: 'teamclaw-test-' + Date.now(),
            token: 'mock-token',
            role: 'operator',
          }));
        }
        
        if (msg.type === 'hello-ok') {
          log('success', '✅ Gateway authentication successful');
          
          // 发送 DM 请求
          ws.send(JSON.stringify({
            type: 'request',
            id: 'test-dm-1',
            action: 'agent.dm',
            params: {
              agentId: 'main',
              content: 'TeamClaw service test message',
            },
          }));
        }
        
        if (msg.id === 'test-dm-1' && msg.result?.sessionKey) {
          sessionKey = msg.result.sessionKey;
          log('success', `✅ DM session created: ${sessionKey}`);
        }
        
        if (msg.event === 'gateway_chat_event') {
          const payload = msg.payload?.payload || msg.payload;
          if (payload?.state === 'final') {
            clearTimeout(timeout);
            ws.close();
            resolve({ success: true, sessionKey });
          }
        }
      } catch (err) {
        log('error', `Parse error: ${err}`);
      }
    });
    
    ws.on('error', (err) => {
      log('error', `❌ WebSocket error: ${err.message}`);
      clearTimeout(timeout);
      resolve({ success: false });
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// 步骤 4: 模拟 TeamClaw 前端流程
async function simulateTeamClawFlow(): Promise<boolean> {
  log('info', '🎭 Simulating TeamClaw frontend flow...');
  log('info', 'This tests if TeamClaw components can receive and display chat events');
  
  // 这里我们测试 TeamClaw 的 eventBus 是否能正确分发事件
  // 实际测试中需要检查 DataProvider 和 ChatPanel 的集成
  
  return new Promise((resolve) => {
    const events: string[] = [];
    
    // 创建 SSE 连接（模拟 DataProvider）
    const req = http.get(SSE_URL, { headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              events.push(data.type || 'unknown');
              log('info', `Event: ${data.type}`);
            } catch (e) {
              // 忽略
            }
          }
        }
      });
      
      // 15秒后检查
      setTimeout(() => {
        req.destroy();
        log('info', `Total events received: ${events.length}`);
        resolve(events.length > 0);
      }, 15000);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    setTimeout(() => {
      req.destroy();
      resolve(false);
    }, 16000);
  });
}

// 主测试函数
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TeamClaw Service Test');
  console.log('='.repeat(70) + '\n');
  
  const results = {
    healthCheck: false,
    gatewayConnection: false,
    sseConnection: false,
    flowSimulation: false,
  };
  
  // 测试 1: API 健康检查
  results.healthCheck = await testHealthCheck();
  
  // 测试 2: Gateway 连接
  const gatewayResult = await testGatewayConnection();
  results.gatewayConnection = gatewayResult.success;
  
  // 测试 3: SSE 连接
  const sseResult = await testSSEConnection();
  results.sseConnection = sseResult.success;
  
  // 测试 4: 流程模拟
  results.flowSimulation = await simulateTeamClawFlow();
  
  // 输出报告
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Results');
  console.log('='.repeat(70));
  
  console.log(`\n1. API Health Check: ${results.healthCheck ? c.green + '✅ PASS' : c.red + '❌ FAIL'}${c.reset}`);
  console.log(`2. Gateway Connection: ${results.gatewayConnection ? c.green + '✅ PASS' : c.red + '❌ FAIL'}${c.reset}`);
  console.log(`3. SSE Connection: ${results.sseConnection ? c.green + '✅ PASS' : c.red + '❌ FAIL'}${c.reset}`);
  console.log(`4. Flow Simulation: ${results.flowSimulation ? c.green + '✅ PASS' : c.red + '❌ FAIL'}${c.reset}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Overall: ${allPassed ? c.green + '✅ ALL TESTS PASSED' : c.red + '❌ SOME TESTS FAILED'}${c.reset}`);
  console.log('='.repeat(70) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

// 运行测试
runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
