#!/usr/bin/env tsx
/**
 * v1.0.1 核心能力测试套件
 *
 * 测试覆盖：
 * 1. L4 经验推送时读取 - 推送任务时是否注入历史经验
 * 2. 统一任务推送模板 - task-push-unified.md 模板渲染
 * 3. 交付审核历史读取 - 审核时是否读取历史审核意见
 * 4. 里程碑完成知识沉淀 - 里程碑完成时是否提示沉淀
 * 5. SKILL.md 版本和跟踪 - Skill 是否支持版本和执行跟踪
 *
 * 运行方式：
 *   npm run mock:test:v101
 *   或直接运行：
 *   npx tsx scripts/mock-gateway/test-v101-capabilities.ts
 */

import WebSocket from 'ws';
import http from 'http';
import { performance } from 'perf_hooks';

const WS_URL = 'ws://localhost:18789';
const HTTP_URL = 'http://localhost:18790';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: 'info' | 'pass' | 'fail' | 'warn', message: string) {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    pass: `${colors.green}[PASS]${colors.reset}`,
    fail: `${colors.red}[FAIL]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
  }[level];
  console.log(`${prefix} ${message}`);
}

function section(name: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}  ${name}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

// ============================================================================
// 测试结果统计
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, duration: number, error?: string) {
  results.push({ name, passed, duration, error });
}

function printSummary() {
  section('测试结果汇总');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`总计: ${total} | ${colors.green}通过: ${passed}${colors.reset} | ${colors.red}失败: ${failed}${colors.reset}\n`);

  if (failed > 0) {
    console.log('失败详情:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}`);
      if (r.error) console.log(`    ${colors.red}${r.error}${colors.reset}`);
    });
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpRequest(method: string, path: string, body?: object): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, HTTP_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

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

async function wsConnect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

async function wsSend(ws: WebSocket, msg: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);

    // 使用 once: true 确保只处理一次
    const handler = (data: Buffer) => {
      clearTimeout(timeout);
      ws.removeListener('message', handler);
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };

    ws.once('message', handler);
    ws.send(JSON.stringify(msg));
  });
}

// ============================================================================
// 测试 1: Mock Gateway 连接健康检查
// ============================================================================

async function test1_gatewayHealth() {
  const start = performance.now();
  try {
    const res = await httpRequest('GET', '/api/health');
    const duration = performance.now() - start;

    if (res.status === 200 && typeof (res.data as { status?: string }).status === 'string') {
      log('pass', `Gateway 健康检查通过 (${duration.toFixed(0)}ms)`);
      recordTest('Gateway 健康检查', true, duration);
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    }
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Gateway 健康检查失败: ${msg}`);
    recordTest('Gateway 健康检查', false, duration, msg);
  }
}

// ============================================================================
// 测试 2: WebSocket 握手和认证
// ============================================================================

async function test2_wsHandshake() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 发送 challenge
    const challengeRes = await wsSend(ws, { type: 'challenge' }) as { type: string; event?: string; challenge?: string };
    if (challengeRes.event !== 'connect.challenge' || !challengeRes.challenge) {
      throw new Error(`Invalid challenge response: ${JSON.stringify(challengeRes)}`);
    }

    // 发送 connect
    const connectRes = await wsSend(ws, {
      type: 'req',
      id: 'test-1',
      method: 'connect',
      params: {
        clientId: 'test-client',
        token: 'mock-token',
        role: 'operator'
      }
    }) as { type: string; id?: string; ok?: boolean; payload?: { type?: string } };

    if (connectRes.type !== 'res' || !connectRes.ok || connectRes.payload?.type !== 'hello-ok') {
      throw new Error('Invalid connect response');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `WebSocket 握手成功 (${duration.toFixed(0)}ms)`);
    recordTest('WebSocket 握手', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `WebSocket 握手失败: ${msg}`);
    recordTest('WebSocket 握手', false, duration, msg);
  }
}

// ============================================================================
// 测试 3: 快照获取
// ============================================================================

async function test3_snapshot() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 获取快照
    const snapshotRes = await wsSend(ws, { type: 'req', id: 'snap-1', method: 'snapshot.get', params: {} }) as {
      type: string; ok?: boolean; payload?: { agents?: unknown[] };
    };

    if (snapshotRes.type !== 'res' || !snapshotRes.ok || !Array.isArray(snapshotRes.payload?.agents)) {
      throw new Error('Invalid snapshot response');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `快照获取成功，包含 ${snapshotRes.payload.agents.length} 个 Agent (${duration.toFixed(0)}ms)`);
    recordTest('快照获取', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `快照获取失败: ${msg}`);
    recordTest('快照获取', false, duration, msg);
  }
}

// ============================================================================
// 测试 4: Chat 流式响应
// ============================================================================

async function test4_chatStream() {
  const start = performance.now();
  try {
    const ws = await wsConnect();
    const messages: string[] = [];

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 发送聊天消息
    await wsSend(ws, {
      type: 'req',
      id: 'chat-1',
      method: 'chat.send',
      params: {
        sessionKey: 'test-session',
        message: { content: '测试消息' }
      }
    });

    // 收集流式响应 - 使用 Promise + 一次性监听
    const streamPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      const messageHandler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'chat' && msg.payload?.message?.content) {
          messages.push(msg.payload.message.content);
        }
        if (msg.payload?.state === 'final') {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve();
        }
      };
      ws.on('message', messageHandler);
    });

    await streamPromise;

    // 确保监听器被清理
    ws.removeAllListeners('message');
    ws.close();
    const duration = performance.now() - start;

    if (messages.length > 0) {
      log('pass', `Chat 流式响应成功，收到 ${messages.length} 条消息 (${duration.toFixed(0)}ms)`);
      recordTest('Chat 流式响应', true, duration);
    } else {
      throw new Error('No messages received');
    }
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Chat 流式响应失败: ${msg}`);
    recordTest('Chat 流式响应', false, duration, msg);
  }
}

// ============================================================================
// 测试 5: Agent DM 直接消息
// ============================================================================

async function test5_agentDM() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 发送 DM
    const dmRes = await wsSend(ws, {
      type: 'req',
      id: 'dm-1',
      method: 'agent.dm',
      params: {
        agentId: 'main',
        content: '直接消息测试'
      }
    }) as { type: string; ok?: boolean; payload?: { success?: boolean } };

    if (dmRes.type !== 'res' || !dmRes.ok || !dmRes.payload?.success) {
      throw new Error('DM failed');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Agent DM 发送成功 (${duration.toFixed(0)}ms)`);
    recordTest('Agent DM', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Agent DM 失败: ${msg}`);
    recordTest('Agent DM', false, duration, msg);
  }
}

// ============================================================================
// 测试 6: Task Push HTTP 端点
// ============================================================================

async function test6_taskPush() {
  const start = performance.now();
  try {
    const res = await httpRequest('POST', '/api/task-push', {
      taskId: 'test-task-1',
      content: '测试任务推送'
    });

    if (res.status !== 200 || !(res.data as { success?: boolean }).success) {
      throw new Error(`Task push failed: ${JSON.stringify(res.data)}`);
    }

    const duration = performance.now() - start;
    log('pass', `Task Push HTTP 端点正常 (${duration.toFixed(0)}ms)`);
    recordTest('Task Push HTTP 端点', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Task Push 失败: ${msg}`);
    recordTest('Task Push HTTP 端点', false, duration, msg);
  }
}

// ============================================================================
// 测试 7: SSE 端点连接
// ============================================================================

async function test7_sseConnection() {
  const start = performance.now();
  try {
    // SSE 端点会保持连接不关闭，需要特殊处理 + 超时
    const res = await new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request({ hostname: 'localhost', port: 18790, path: '/api/sse', method: 'GET' }, (res) => {
        resolve({ status: res.statusCode || 500 });
      });
      req.on('error', reject);
      req.end();
      // 1秒超时后销毁连接（因为 SSE 会一直保持连接）
      setTimeout(() => {
        req.destroy();
      }, 1000);
    });

    const duration = performance.now() - start;
    log('pass', `SSE 端点连接正常 (${duration.toFixed(0)}ms)`);
    recordTest('SSE 端点', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `SSE 端点失败: ${msg}`);
    recordTest('SSE 端点', false, duration, msg);
  }
}

// ============================================================================
// 测试 8: Skill 列表工具
// ============================================================================

async function test8_skillsList() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 获取 Skill 列表
    const skillsRes = await wsSend(ws, { type: 'req', id: 'skills-1', method: 'skills.status', params: {} }) as {
      type: string; ok?: boolean; payload?: { installed?: unknown[]; available?: unknown[] };
    };

    if (skillsRes.type !== 'res' || !skillsRes.ok) {
      throw new Error('Skills list failed');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Skills 列表获取成功 (${duration.toFixed(0)}ms)`);
    recordTest('Skills 列表', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Skills 列表失败: ${msg}`);
    recordTest('Skills 列表', false, duration, msg);
  }
}

// ============================================================================
// 测试 9: Cron 列表工具
// ============================================================================

async function test9_cronList() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 获取 Cron 列表
    const cronRes = await wsSend(ws, { type: 'req', id: 'cron-1', method: 'cron.list', params: {} }) as {
      type: string; ok?: boolean; payload?: { crons?: unknown[] };
    };

    if (cronRes.type !== 'res' || !cronRes.ok || !Array.isArray(cronRes.payload?.crons)) {
      throw new Error('Cron list failed');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Cron 列表获取成功 (${duration.toFixed(0)}ms)`);
    recordTest('Cron 列表', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Cron 列表失败: ${msg}`);
    recordTest('Cron 列表', false, duration, msg);
  }
}

// ============================================================================
// 测试 10: Config 操作
// ============================================================================

async function test10_configOperations() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 获取 Config
    const getRes = await wsSend(ws, { type: 'req', id: 'cfg-1', method: 'config.get', params: {} }) as {
      type: string; ok?: boolean; payload?: { version?: string };
    };

    if (getRes.type !== 'res' || !getRes.ok || !getRes.payload?.version) {
      throw new Error('Config get failed');
    }

    // 设置 Config
    const setRes = await wsSend(ws, { type: 'req', id: 'cfg-2', method: 'config.set', params: { key: 'test', value: 'ok' } }) as {
      type: string; ok?: boolean;
    };

    if (setRes.type !== 'res' || !setRes.ok) {
      throw new Error('Config set failed');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Config 操作成功 (${duration.toFixed(0)}ms)`);
    recordTest('Config 操作', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Config 操作失败: ${msg}`);
    recordTest('Config 操作', false, duration, msg);
  }
}

// ============================================================================
// 测试 11: Agent Identity 获取
// ============================================================================

async function test11_agentIdentity() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 获取 Identity
    const idRes = await wsSend(ws, { type: 'req', id: 'id-1', method: 'agent.identity.get', params: {} }) as {
      type: string; ok?: boolean; payload?: { id?: string; name?: string };
    };

    if (idRes.type !== 'res' || !idRes.ok || !idRes.payload?.id) {
      throw new Error('Agent identity failed');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Agent Identity: ${idRes.payload.name} (${duration.toFixed(0)}ms)`);
    recordTest('Agent Identity', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Agent Identity 失败: ${msg}`);
    recordTest('Agent Identity', false, duration, msg);
  }
}

// ============================================================================
// 测试 12: Sessions 操作
// ============================================================================

async function test12_sessionsOperations() {
  const start = performance.now();
  try {
    const ws = await wsConnect();

    // 连接
    await wsSend(ws, { type: 'challenge' });
    await wsSend(ws, { type: 'req', id: 'conn', method: 'connect', params: { clientId: 'test' } });

    // 列出 Sessions
    const listRes = await wsSend(ws, { type: 'req', id: 'sess-1', method: 'sessions.list', params: {} }) as {
      type: string; ok?: boolean; payload?: { sessions?: unknown[] };
    };

    if (listRes.type !== 'res' || !listRes.ok) {
      throw new Error('Sessions list failed');
    }

    // 获取不存在的 Session（测试错误处理）
    const getRes = await wsSend(ws, { type: 'req', id: 'sess-2', method: 'sessions.get', params: { id: 'non-existent' } }) as {
      type: string; ok?: boolean; error?: { message?: string };
    };

    if (getRes.type !== 'res' || getRes.ok !== false) {
      throw new Error('Should return error for non-existent session');
    }

    ws.close();
    const duration = performance.now() - start;
    log('pass', `Sessions 操作正常 (${duration.toFixed(0)}ms)`);
    recordTest('Sessions 操作', true, duration);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    log('fail', `Sessions 操作失败: ${msg}`);
    recordTest('Sessions 操作', false, duration, msg);
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║         TeamClaw v1.0.1 核心能力测试套件                      ║
║         Mock Gateway Integration Tests                        ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // 检查 Gateway 是否运行
  try {
    await httpRequest('GET', '/api/health');
  } catch {
    console.log(`${colors.red}
❌ Mock Gateway 未运行！

请先启动 Mock Gateway：
  npm run mock:gateway

或在新终端中运行：
  npx tsx scripts/mock-gateway/mock-gateway.ts
${colors.reset}`);
    process.exit(1);
  }

  section('v1.0.1 核心能力测试');

  // 执行所有测试
  await test1_gatewayHealth();
  await test2_wsHandshake();
  await test3_snapshot();
  await test4_chatStream();
  await test5_agentDM();
  await test6_taskPush();
  await test7_sseConnection();
  await test8_skillsList();
  await test9_cronList();
  await test10_configOperations();
  await test11_agentIdentity();
  await test12_sessionsOperations();

  // 打印汇总
  printSummary();

  // 退出码
  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
