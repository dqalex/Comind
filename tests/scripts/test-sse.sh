#!/bin/bash
# 测试 SSE 连接

echo "测试 TeamClaw SSE 连接..."
echo ""

# 启动 SSE 监听 (5秒后自动断开)
timeout 5 curl -s -N http://localhost:3000/api/sse &
SSE_PID=$!

sleep 1

# 发送任务推送
echo "发送任务推送..."
curl -s -X POST http://localhost:18790/api/task-push \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sse-test-123",
    "content": "SSE 测试消息",
    "source": "test-script"
  }' | jq .

echo ""
echo "等待 SSE 消息..."
sleep 3

# 清理
kill $SSE_PID 2>/dev/null

echo ""
echo "测试完成"
