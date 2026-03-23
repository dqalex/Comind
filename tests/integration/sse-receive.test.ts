/**
 * 测试 SSE 接收 Gateway 消息
 */

import http from 'http';

console.log('🔗 连接到 TeamClaw SSE...\n');

const req = http.get('http://localhost:3000/api/sse', {
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
}, (res) => {
  console.log(`SSE 状态: ${res.statusCode}`);
  
  if (res.statusCode !== 200) {
    console.error('❌ 连接失败');
    process.exit(1);
  }
  
  console.log('✅ SSE 连接成功，等待消息...\n');
  
  let buffer = '';
  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          console.log('📨 收到消息:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('📨 原始数据:', line.slice(6));
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n❌ SSE 连接关闭');
  });
});

req.on('error', (err) => {
  console.error('❌ 请求错误:', err.message);
});

// 10 秒后自动退出
setTimeout(() => {
  console.log('\n⏱️  测试超时，退出');
  process.exit(0);
}, 10000);
