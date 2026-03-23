/**
 * 端到端测试：验证 Mock Gateway -> TeamClaw -> SSE 完整流程
 */

import http from 'http';

console.log('🧪 开始端到端测试\n');

// 1. 连接到 TeamClaw SSE
console.log('🔗 1. 连接到 TeamClaw SSE...');
const req = http.get('http://localhost:3000/api/sse', {
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
}, (res) => {
  console.log(`   SSE 状态: ${res.statusCode}`);
  
  if (res.statusCode !== 200) {
    console.error('   ❌ SSE 连接失败');
    process.exit(1);
  }
  
  console.log('   ✅ SSE 连接成功\n');
  
  let messageCount = 0;
  let buffer = '';
  
  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          messageCount++;
          console.log(`\n📨 收到消息 #${messageCount}:`);
          console.log(JSON.stringify(data, null, 2));
          
          if (data.type === 'gateway_chat_event') {
            console.log('   ✅ 收到 Gateway Chat 事件！');
          }
        } catch (e) {
          console.log(`📨 原始: ${line.slice(6)}`);
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n❌ SSE 连接关闭');
    console.log(`\n总计收到 ${messageCount} 条消息`);
  });
  
  // 2. SSE 连接成功后，发送任务推送
  setTimeout(() => {
    console.log('📤 2. 发送任务推送...\n');
    
    const postData = JSON.stringify({
      sessionId: 'e2e-test-001',
      content: '端到端测试消息',
      source: 'e2e-test'
    });
    
    const pushReq = http.request({
      hostname: 'localhost',
      port: 18790,
      path: '/api/task-push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (pushRes) => {
      let data = '';
      pushRes.on('data', chunk => data += chunk);
      pushRes.on('end', () => {
        console.log('   ✅ 任务推送响应:', data);
      });
    });
    
    pushReq.on('error', (err) => {
      console.error('   ❌ 推送失败:', err.message);
    });
    
    pushReq.write(postData);
    pushReq.end();
  }, 1000);
  
  // 3. 等待一段时间后退出
  setTimeout(() => {
    console.log('\n⏱️  测试完成，关闭连接');
    req.destroy();
    process.exit(0);
  }, 8000);
});

req.on('error', (err) => {
  console.error('❌ 请求错误:', err.message);
  process.exit(1);
});
