#!/usr/bin/env tsx
/**
 * 本地测试任务推送流程
 * 直接在 Mock Gateway 中创建模拟会话并发送聊天消息
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:18789';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTaskPush() {
  console.log('🧪 Testing task push with Mock Gateway...\n');
  console.log('This test will:');
  console.log('1. Connect to Mock Gateway');
  console.log('2. Send agent.dm request');
  console.log('3. Receive streaming response (delta + final)');
  console.log('');

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Mock Gateway');
    console.log('📤 Sending challenge request...');
    ws.send(JSON.stringify({ type: 'challenge' }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('📥 Received:', msg.type || msg.event || msg.id);

      // Handle challenge response
      if (msg.type === 'challenge') {
        console.log('📤 Sending connect request...');
        ws.send(JSON.stringify({
          type: 'connect',
          clientId: 'test-client-' + Date.now(),
          token: 'mock-token',
          role: 'operator'
        }));
      }

      // Handle hello-ok
      if (msg.type === 'hello-ok') {
        console.log('✅ Authenticated, clientId:', msg.clientId);
        console.log('');
        console.log('📤 Sending agent.dm request (simulating task push)...');
        ws.send(JSON.stringify({
          type: 'request',
          id: 'req-1',
          action: 'agent.dm',
          params: {
            agentId: 'main',
            content: '请帮我分析这个任务：创建一个测试功能'
          }
        }));
      }

      // Handle DM response
      if (msg.id === 'req-1' && msg.result) {
        console.log('✅ DM created, sessionKey:', msg.result.sessionKey);
        console.log('');
        console.log('⏳ Waiting for streaming response...\n');
      }

      // Handle chat events
      if (msg.event === 'gateway_chat_event') {
        const payload = msg.payload?.payload;
        if (payload) {
          const prefix = payload.state === 'delta' ? '🟡 [delta]' : '🟢 [final]';
          console.log(`${prefix} ${payload.content.substring(0, 50)}${payload.content.length > 50 ? '...' : ''}`);

          if (payload.state === 'final') {
            console.log('\n✅ Test completed! Streaming response received successfully.');
            console.log('');
            console.log('Session Key:', payload.sessionKey?.substring(0, 8) + '***');
            console.log('Full Content:', payload.content);
            ws.close();
            process.exit(0);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
    console.log('\n💡 Make sure Mock Gateway is running:');
    console.log('   npm run mock:gateway');
    process.exit(1);
  });

  ws.on('close', () => {
    console.log('\n🔌 Connection closed');
  });

  // Timeout after 30 seconds
  setTimeout(() => {
    console.error('\n❌ Test timed out after 30 seconds');
    ws.close();
    process.exit(1);
  }, 30000);
}

testTaskPush();
