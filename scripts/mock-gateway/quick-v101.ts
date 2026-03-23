#!/usr/bin/env tsx
/**
 * Mock Gateway 快速测试 - 验证核心连接
 */

import WebSocket from 'ws';
import http from 'http';

const WS_URL = 'ws://localhost:18789';
const HTTP_URL = 'http://localhost:18790';

const results: { name: string; passed: boolean; error?: string }[] = [];

function log(passed: boolean, name: string, detail?: string) {
  results.push({ name, passed, error: detail });
  const icon = passed ? '✅' : '❌';
  const msg = detail ? ` - ${detail}` : '';
  console.log(`${icon} ${name}${msg}`);
}

async function httpRequest(method: string, path: string, body?: object) {
  return new Promise<{ status: number; data: unknown }>((resolve, reject) => {
    const options = { hostname: 'localhost', port: 18790, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 500, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function wsSend(ws: WebSocket, msg: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
    ws.once('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
    ws.send(JSON.stringify(msg));
  });
}

async function main() {
  console.log('\n🧪 Mock Gateway 快速测试\n');

  // 1. HTTP 健康检查
  try {
    const res = await httpRequest('GET', '/api/health');
    log(res.status === 200, 'HTTP 健康检查', `状态: ${res.status}`);
  } catch (e) {
    log(false, 'HTTP 健康检查', String(e));
  }

  // 2. WebSocket 连接
  let ws: WebSocket;
  try {
    ws = new WebSocket(WS_URL);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    log(true, 'WebSocket 连接');
  } catch (e) {
    log(false, 'WebSocket 连接', String(e));
    process.exit(1);
  }

  // 3. Challenge
  try {
    const res = await wsSend(ws, { type: 'challenge' }) as { event?: string };
    log(res.event === 'connect.challenge', 'Challenge 响应');
  } catch (e) {
    log(false, 'Challenge 响应', String(e));
  }

  // 4. Connect
  try {
    const res = await wsSend(ws, { type: 'req', id: 'c1', method: 'connect', params: { clientId: 'test' } }) as { type?: string; ok?: boolean };
    log(res.type === 'res' && !!res.ok, 'Connect 认证');
  } catch (e) {
    log(false, 'Connect 认证', String(e));
  }

  // 5. Snapshot
  try {
    const res = await wsSend(ws, { type: 'req', id: 's1', method: 'snapshot.get', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Snapshot 获取');
  } catch (e) {
    log(false, 'Snapshot 获取', String(e));
  }

  // 6. Config get
  try {
    const res = await wsSend(ws, { type: 'req', id: 'cfg1', method: 'config.get', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Config.get');
  } catch (e) {
    log(false, 'Config.get', String(e));
  }

  // 7. Skills status
  try {
    const res = await wsSend(ws, { type: 'req', id: 'sk1', method: 'skills.status', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Skills.status');
  } catch (e) {
    log(false, 'Skills.status', String(e));
  }

  // 8. Cron list
  try {
    const res = await wsSend(ws, { type: 'req', id: 'cr1', method: 'cron.list', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Cron.list');
  } catch (e) {
    log(false, 'Cron.list', String(e));
  }

  // 9. Sessions list
  try {
    const res = await wsSend(ws, { type: 'req', id: 'ss1', method: 'sessions.list', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Sessions.list');
  } catch (e) {
    log(false, 'Sessions.list', String(e));
  }

  // 10. Agent identity
  try {
    const res = await wsSend(ws, { type: 'req', id: 'id1', method: 'agent.identity.get', params: {} }) as { ok?: boolean };
    log(!!res.ok, 'Agent.identity.get');
  } catch (e) {
    log(false, 'Agent.identity.get', String(e));
  }

  // 11. Agent DM
  try {
    const res = await wsSend(ws, { type: 'req', id: 'dm1', method: 'agent.dm', params: { agentId: 'main', content: 'test' } }) as { ok?: boolean; payload?: { success?: boolean } };
    log(!!res.ok && !!res.payload?.success, 'Agent.dm');
  } catch (e) {
    log(false, 'Agent.dm', String(e));
  }

  // 12. Task Push HTTP
  try {
    const res = await httpRequest('POST', '/api/task-push', { taskId: 'test', content: 'test' });
    const data = res.data as { success?: boolean };
    log(data.success === true, 'Task Push HTTP');
  } catch (e) {
    log(false, 'Task Push HTTP', String(e));
  }

  ws.close();

  // 汇总
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`结果: ${passed} 通过, ${failed} 失败`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});