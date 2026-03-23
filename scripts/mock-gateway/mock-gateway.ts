#!/usr/bin/env tsx
/**
 * Mock OpenClaw Gateway for local testing
 * 模拟任务推送和聊天响应流程
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const WS_PORT = 18789;
const HTTP_PORT = 18790;
const clients = new Map<string, WebSocket>();

// 模拟聊天响应流
const mockResponses = [
  { type: 'delta', content: '我来' },
  { type: 'delta', content: '帮您' },
  { type: 'delta', content: '分析' },
  { type: 'delta', content: '这个' },
  { type: 'delta', content: '任务' },
  { type: 'delta', content: '...\n\n' },
  { type: 'delta', content: '任务分析完成：' },
  { type: 'delta', content: '需要创建' },
  { type: 'delta', content: ' 3 ' },
  { type: 'delta', content: '个子任务' },
  { type: 'delta', content: '。' },
  { type: 'final', content: '我来帮您分析这个任务...\n\n任务分析完成：需要创建 3 个子任务。' },
];

function generateChallenge(): string {
  return 'mock-challenge-' + Date.now();
}

function createResponse(id: string, result: unknown) {
  return JSON.stringify({ id, result });
}

function createEvent(event: string, payload: unknown) {
  return JSON.stringify({ type: 'event', event, payload });
}

// ==================== WebSocket Gateway ====================

const wsServer = new WebSocketServer({ port: WS_PORT });

console.log(`🚀 Mock Gateway WebSocket running on ws://localhost:${WS_PORT}`);

wsServer.on('connection', (ws) => {
  let clientId: string | null = null;

  console.log('[Mock] New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[Mock] Received:', msg.type || msg.action);

      // 处理 challenge 请求 (TeamClaw 格式: type: 'challenge')
      if (msg.type === 'challenge') {
        const challenge = generateChallenge();
        ws.send(JSON.stringify({ type: 'event', event: 'connect.challenge', challenge }));
        return;
      }

      // 处理 connect 请求 (旧格式: type: 'connect')
      if (msg.type === 'connect') {
        clientId = msg.clientId || 'mock-client-' + Date.now();
        if (clientId) {
          clients.set(clientId, ws);
        }
        console.log('[Mock] Client connected:', clientId, 'role:', msg.role);
        ws.send(JSON.stringify({ type: 'event', event: 'hello-ok', clientId }));
        return;
      }

      // 处理 req + method: 'connect' 格式 (TeamClaw 实际使用的格式)
      if (msg.type === 'req' && msg.method === 'connect') {
        clientId = msg.params?.clientId || 'mock-client-' + Date.now();
        if (clientId) {
          clients.set(clientId, ws);
        }
        console.log('[Mock] Client connected:', clientId, 'role:', msg.params?.role);

        // 发送 res 响应 (TeamClaw 期望的格式，必须包含 payload.type === 'hello-ok')
        ws.send(JSON.stringify({
          type: 'res',
          id: msg.id,
          ok: true,
          payload: { type: 'hello-ok', clientId, protocol: 'v1' },
          result: { clientId, status: 'connected' }
        }));

        // 发送快照（模拟）- 格式改为 event/ok 响应
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'event',
            event: 'snapshot',
            payload: {
              agents: [{ id: 'main', name: 'Main Agent', status: 'online' }],
              sessions: [],
              crons: [],
              skills: []
            }
          }));
        }, 100);
        return;
      }

      // 处理 request（RPC 调用）- 旧格式 type: 'request' + action
      if (msg.type === 'request' && msg.action) {
        const { id, action, params } = msg;

        switch (action) {
          case 'snapshot':
            ws.send(createResponse(id, {
              agents: [{ id: 'main', name: 'Main Agent', status: 'online' }],
              sessions: [],
              crons: [],
              skills: []
            }));
            break;

          case 'agent.chat':
            handleChat(ws, id, params);
            break;

          case 'agent.dm':
            handleDM(ws, id, params);
            break;

          case 'session.list':
            ws.send(createResponse(id, { sessions: [] }));
            break;

          default:
            console.log('[Mock] Unknown action:', action);
            ws.send(createResponse(id, { error: 'Unknown action: ' + action }));
        }
        return;
      }

      // 处理 req + method（TeamClaw 使用的格式）
      if (msg.type === 'req' && msg.method) {
        const { id, method, params } = msg;
        console.log('[Mock] RPC request:', method);

        switch (method) {
          case 'snapshot.get':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: {
                agents: [{ 
                  id: 'main', 
                  name: 'Main Agent', 
                  status: 'online',
                  identity: { name: 'Main Agent', emoji: '🤖' }
                }],
                sessions: [],
                crons: [],
                skills: []
              }
            }));
            break;

          case 'config.get':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: {
                version: 'mock-1.0',
                features: ['chat', 'agents']
              }
            }));
            break;

          case 'agents.list':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: {
                agents: [{ 
                  id: 'main', 
                  name: 'Main Agent', 
                  status: 'online',
                  identity: { name: 'Main Agent', emoji: '🤖' }
                }],
                defaultId: 'main',
                mainKey: 'agent:main:dm',
                scope: 'global'
              }
            }));
            break;

          case 'chat.send': {
            const sessionKey = params?.sessionKey || `session-${Date.now()}`;
            // 先返回 ack
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: { success: true, messageId: 'msg-' + Date.now() }
            }));
            // 然后触发流式响应
            handleChat(ws, 'stream-' + Date.now(), { sessionKey, content: params?.message?.content || 'Mock response' });
            break;
          }

          case 'agent.dm':
            handleDM(ws, id, params);
            break;

          case 'agent.identity.get':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: {
                id: 'mock-agent',
                name: 'Mock Agent',
                role: 'assistant'
              }
            }));
            break;

          case 'sessions.list':
          case 'session.list':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: { sessions: [] }
            }));
            break;

          case 'skills.status':
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: true,
              payload: { installed: [], available: [] }
            }));
            break;

          // Cron 相关
          case 'cron.list':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { crons: [] } }));
            break;
          case 'cron.status':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { status: 'idle' } }));
            break;

          // Config 相关
          case 'config.set':
          case 'config.reload':
          case 'config.load':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { success: true } }));
            break;

          // Chat 相关
          case 'chat.history':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { messages: [] } }));
            break;
          case 'chat.abort':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { success: true } }));
            break;

          // Sessions 相关
          case 'sessions.get':
            ws.send(JSON.stringify({ type: 'res', id, ok: false, error: { message: 'Session not found' } }));
            break;
          case 'sessions.patch':
          case 'sessions.delete':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { success: true } }));
            break;

          // Agents 相关
          case 'agents.create':
          case 'agents.update':
          case 'agents.delete':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { success: true } }));
            break;

          // Skills 相关
          case 'skills.update':
          case 'skills.install':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { success: true } }));
            break;

          // 心跳
          case 'health':
            ws.send(JSON.stringify({ type: 'res', id, ok: true, payload: { status: 'ok' } }));
            break;

          default:
            console.log('[Mock] Unknown method:', method);
            ws.send(JSON.stringify({
              type: 'res',
              id,
              ok: false,
              error: { message: 'Unknown method: ' + method }
            }));
        }
        return;
      }

    } catch (err) {
      console.error('[Mock] Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (clientId) {
      clients.delete(clientId);
      console.log('[Mock] Client disconnected:', clientId);
    }
  });

  ws.on('error', (err) => {
    console.error('[Mock] WebSocket error:', err);
  });
});

// 处理聊天消息 - 发送流式响应
function handleChat(ws: WebSocket, requestId: string, params: unknown) {
  const { sessionKey, content } = params as { sessionKey: string; content: string };
  console.log('[Mock] Chat request:', { sessionKey, content: content?.substring(0, 50) });

  // 立即发送 ack
  ws.send(createResponse(requestId, { success: true, sessionKey }));

  // 模拟流式响应
  let delay = 200;
  mockResponses.forEach((resp) => {
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const eventPayload = {
          sessionKey,
          state: resp.type === 'delta' ? 'delta' : 'final',
          message: { content: resp.content, text: resp.content },
          timestamp: Date.now(),
        };
        console.log(`[Mock] Sending ${resp.type}:`, resp.content.substring(0, 30));
        // TeamClaw 期望 event: 'chat'，会被映射为 gateway_chat_event
        ws.send(createEvent('chat', eventPayload));
      }
    }, delay);
    delay += resp.type === 'final' ? 100 : 300 + Math.random() * 200;
  });
}

// 处理 DM（直接消息）
function handleDM(ws: WebSocket, requestId: string, params: unknown) {
  const { agentId, content } = params as { agentId: string; content: string };
  const sessionKey = `agent:${agentId}:dm:mock-${Date.now()}`;
  console.log('[Mock] DM request:', { agentId, content: content?.substring(0, 50) });

  // 返回 RPC 格式响应
  ws.send(JSON.stringify({
    type: 'res',
    id: requestId,
    ok: true,
    payload: { success: true, sessionKey }
  }));

  // 模拟流式响应
  let delay = 300;
  mockResponses.forEach((resp) => {
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const eventPayload = {
          sessionKey,
          state: resp.type === 'delta' ? 'delta' : 'final',
          message: { content: resp.content, text: resp.content },
          timestamp: Date.now(),
        };
        ws.send(createEvent('chat', eventPayload));
      }
    }, delay);
    delay += resp.type === 'final' ? 100 : 300 + Math.random() * 200;
  });
}

// ==================== HTTP API + SSE ====================

// SSE 客户端列表
const sseClients = new Map<string, http.ServerResponse>();

function broadcastSSE(data: unknown) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  let count = 0;
  sseClients.forEach((client) => {
    try {
      client.write(message);
      count++;
    } catch (err) {
      console.error('[Mock] SSE broadcast error:', err);
    }
  });
  console.log(`[Mock] Broadcasted to ${count} SSE clients`);
}

const httpServer = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint
  if (req.url === '/api/sse' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const clientId = 'sse-' + Date.now();
    sseClients.set(clientId, res);
    console.log('[Mock] SSE client connected:', clientId);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientId);
      console.log('[Mock] SSE client disconnected:', clientId);
    });
    return;
  }

  // Task push endpoint
  if (req.url === '/api/task-push' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('[Mock] Task push received:', data);

        const taskId = 'task-' + Date.now();
        const sessionKey = `task:${taskId}`;
        
        // 向所有 WebSocket 客户端（TeamClaw）发送 chat 事件
        clients.forEach((ws, clientId) => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log(`[Mock] Sending chat event to TeamClaw client: ${clientId}`);
            
            // 模拟 delta 消息流
            const deltas = [
              '收到',
              '任务',
              '请求',
              '...\n',
              '正在',
              '处理',
              '：',
              data.content,
              '\n\n✅ 任务分析完成'
            ];
            
            let delay = 100;
            deltas.forEach((delta, i) => {
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'event',
                  event: 'chat',
                  payload: {
                    sessionKey,
                    state: 'delta',
                    message: { content: delta, text: delta },
                    timestamp: Date.now(),
                  }
                }));
              }, delay);
              delay += 100;
            });
            
            // 发送 final 消息
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'event',
                event: 'chat',
                payload: {
                  sessionKey,
                  state: 'final',
                  message: { 
                    content: `任务分析完成：${data.content}`, 
                    text: `任务分析完成：${data.content}` 
                  },
                  timestamp: Date.now(),
                }
              }));
            }, delay + 200);
          }
        });

        // 广播 SSE 事件（给浏览器客户端）
        broadcastSSE({
          type: 'task-push',
          taskId,
          sessionKey,
          content: data.content,
          timestamp: Date.now(),
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, taskId, sessionKey }));
      } catch (err) {
        console.error('[Mock] Task push error:', err);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Health check
  if (req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', mock: true, wsClients: clients.size, sseClients: sseClients.size }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`🚀 Mock Gateway HTTP running on http://localhost:${HTTP_PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${HTTP_PORT}/api/sse`);
  console.log(`📬 Task push: http://localhost:${HTTP_PORT}/api/task-push`);
});

// 保持进程运行
process.on('SIGINT', () => {
  console.log('\n[Mock] Shutting down...');
  wsServer.close();
  httpServer.close();
  process.exit(0);
});

console.log('[Mock] Press Ctrl+C to stop');
