#!/usr/bin/env tsx
/**
 * Mock Gateway 压力测试
 *
 * 可调节参数：
 * - 并发连接数 (CONCURRENT_CONNECTIONS)
 * - 每连接消息速率 (MESSAGES_PER_SECOND)
 * - 测试持续时间 (DURATION_SECONDS)
 * - 消息大小 (MESSAGE_SIZE)
 *
 * 用法：
 *   npx tsx scripts/mock-gateway/stress-test.ts
 *
 * 环境变量配置：
 *   CONCURRENT_CONNECTIONS=10 MESSAGES_PER_SECOND=5 DURATION_SECONDS=10 npx tsx scripts/mock-gateway/stress-test.ts
 */

// ==================== 配置 ====================
const CONFIG = {
  // 并发 WebSocket 连接数 (默认 10)
  CONCURRENT_CONNECTIONS: parseInt(process.env.CONCURRENT_CONNECTIONS || '10'),
  // 每秒发送消息数 (默认 5)
  MESSAGES_PER_SECOND: parseInt(process.env.MESSAGES_PER_SECOND || '5'),
  // 测试持续时间 (秒, 默认 10)
  DURATION_SECONDS: parseInt(process.env.DURATION_SECONDS || '10'),
  // 模拟消息延迟 (ms, 默认 100)
  MESSAGE_DELAY_MS: parseInt(process.env.MESSAGE_DELAY_MS || '100'),
  // 是否启用详细日志
  VERBOSE: process.env.VERBOSE === 'true',
};

// ==================== 导入 ====================
import WebSocket from 'ws';
import http from 'http';

// ==================== 工具函数 ====================
const log = (type: 'info' | 'pass' | 'fail' | 'warn', msg: string, data?: unknown) => {
  const timestamp = new Date().toISOString().substr(11, 12);
  const prefix = {
    info: '\x1b[36m[I]\x1b[0m',
    pass: '\x1b[32m[PASS]\x1b[0m',
    fail: '\x1b[31m[FAIL]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
  }[type];

  console.log(`${timestamp} ${prefix} ${msg}`, data !== undefined ? JSON.stringify(data) : '');
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// WebSocket 发送并等待响应
async function wsSend(ws: WebSocket, msg: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
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

// ==================== 单个连接测试 ====================
interface ConnectionStats {
  id: number;
  connected: boolean;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  latencySum: number;
  latencyCount: number;
  startTime: number;
  endTime?: number;
}

async function testConnection(
  id: number,
  config: typeof CONFIG,
  results: ConnectionStats[]
): Promise<void> {
  const stats: ConnectionStats = {
    id,
    connected: false,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    latencySum: 0,
    latencyCount: 0,
    startTime: Date.now(),
  };
  results[id] = stats;

  const wsUrl = `ws://localhost:18789`;
  const ws = new WebSocket(wsUrl);

  try {
    // 连接
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      ws.on('message', (data) => {
        stats.messagesReceived++;
        if (config.VERBOSE) log('info', `[${id}] received`, JSON.parse(data.toString()).type || 'message');
      });
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // 认证 - Challenge
    const challengeRes = await wsSend(ws, { type: 'challenge' }) as { event?: string; challenge?: string };
    if (challengeRes.event !== 'connect.challenge' || !challengeRes.challenge) {
      throw new Error(`Invalid challenge: ${JSON.stringify(challengeRes)}`);
    }

    // 认证 - Connect
    await wsSend(ws, {
      type: 'req',
      id: 'conn-test',
      method: 'connect',
      params: { clientId: `stress-${id}`, role: 'operator', token: 'mock-token' }
    });

    stats.connected = true;
    log('info', `[${id}] Connected`);

    // 持续发送消息
    const intervalMs = 1000 / config.MESSAGES_PER_SECOND;
    const endTime = stats.startTime + (config.DURATION_SECONDS * 1000);

    while (Date.now() < endTime) {
      const msgStart = Date.now();

      try {
        // 发送聊天消息
        const response = await wsSend(ws, {
          type: 'req',
          id: `msg-${id}-${stats.messagesSent}`,
          method: 'chat.send',
          params: {
            content: `Stress test message ${stats.messagesSent} from connection ${id}`,
            sessionId: `session-${id}`
          }
        });

        stats.messagesSent++;
        stats.latencySum += Date.now() - msgStart;
        stats.latencyCount++;

        if (config.VERBOSE && stats.messagesSent % 10 === 0) {
          log('info', `[${id}] Sent ${stats.messagesSent}, received ${stats.messagesReceived}`);
        }
      } catch (e) {
        stats.errors++;
        log('warn', `[${id}] Error:`, String(e));
      }

      // 控制发送速率
      const elapsed = Date.now() - msgStart;
      if (elapsed < intervalMs) {
        await sleep(intervalMs - elapsed);
      }
    }

    stats.endTime = Date.now();
    ws.close();
  } catch (e) {
    stats.errors++;
    log('fail', `[${id}] Error:`, String(e));
  }
}

// ==================== HTTP 压力测试 ====================
async function httpStressTest(config: typeof CONFIG) {
  const results = {
    requests: 0,
    successes: 0,
    errors: 0,
    latencySum: 0,
  };

  const intervalMs = 1000 / config.MESSAGES_PER_SECOND;
  const endTime = Date.now() + (config.DURATION_SECONDS * 1000);

  log('info', 'Starting HTTP stress test...');

  while (Date.now() < endTime) {
    const msgStart = Date.now();

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 18790,
          path: '/api/health',
          method: 'GET'
        }, (res) => {
          results.requests++;
          if (res.statusCode === 200) {
            results.successes++;
          } else {
            results.errors++;
          }
          resolve();
        });
        req.on('error', (e) => {
          results.errors++;
          reject(e);
        });
        req.setTimeout(2000, () => {
          req.destroy();
          results.errors++;
          reject(new Error('HTTP timeout'));
        });
        req.end();
      });
    } catch (e) {
      // already counted
    }

    results.latencySum += Date.now() - msgStart;

    const elapsed = Date.now() - msgStart;
    if (elapsed < intervalMs) {
      await sleep(intervalMs - elapsed);
    }
  }

  return results;
}

// ==================== 主测试 ====================
async function main() {
  console.log('\n');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', '       Mock Gateway 压力测试');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', '', {
    并发连接数: CONFIG.CONCURRENT_CONNECTIONS,
    '每连接消息速率': `${CONFIG.MESSAGES_PER_SECOND} msg/s`,
    '测试持续时间': `${CONFIG.DURATION_SECONDS} 秒`,
    '消息延迟': `${CONFIG.MESSAGE_DELAY_MS} ms`,
    详细日志: CONFIG.VERBOSE,
  });
  log('info', '═══════════════════════════════════════════════════════\n');

  // 检查 Gateway 是否运行
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request({ hostname: 'localhost', port: 18790, path: '/api/health', method: 'GET' }, (res) => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`Status ${res.statusCode}`));
      });
      req.on('error', reject);
      req.setTimeout(2000, () => { req.destroy(); reject(new Error('Health check timeout')); });
      req.end();
    });
    log('info', '✅ Mock Gateway 运行中\n');
  } catch {
    log('fail', '❌ Mock Gateway 未运行！请先运行: npm run mock:gateway\n');
    process.exit(1);
  }

  // ==================== WebSocket 压力测试 ====================
  log('info', '▶ 开始 WebSocket 压力测试...');
  const connectionResults: ConnectionStats[] = [];
  const wsStartTime = Date.now();

  // 并发启动所有连接
  const promises: Promise<void>[] = [];
  for (let i = 0; i < CONFIG.CONCURRENT_CONNECTIONS; i++) {
    promises.push(testConnection(i, CONFIG, connectionResults));
  }
  await Promise.all(promises);

  const wsDuration = Date.now() - wsStartTime;

  // ==================== HTTP 压力测试 ====================
  log('info', '▶ 开始 HTTP 压力测试...');
  const httpResults = await httpStressTest(CONFIG);

  // ==================== 结果汇总 ====================
  console.log('\n');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', '       测试结果汇总');
  log('info', '═══════════════════════════════════════════════════════');

  // WebSocket 统计
  const connectedCount = connectionResults.filter(c => c.connected).length;
  const totalMessagesSent = connectionResults.reduce((sum, c) => sum + c.messagesSent, 0);
  const totalMessagesReceived = connectionResults.reduce((sum, c) => sum + c.messagesReceived, 0);
  const totalErrors = connectionResults.reduce((sum, c) => sum + c.errors, 0);
  const avgLatency = connectionResults.reduce((sum, c) => sum + c.latencySum, 0) /
                     Math.max(1, connectionResults.reduce((sum, c) => sum + c.latencyCount, 0));
  const throughput = (totalMessagesSent / (wsDuration / 1000)).toFixed(2);

  log('info', 'WebSocket 测试:');
  log('info', `  连接数: ${connectedCount}/${CONFIG.CONCURRENT_CONNECTIONS} 成功`, { 成功率: `${((connectedCount / CONFIG.CONCURRENT_CONNECTIONS) * 100).toFixed(1)}%` });
  log('info', `  消息: ${totalMessagesSent} 发送 / ${totalMessagesReceived} 接收`);
  log('info', `  错误: ${totalErrors}`);
  log('info', `  平均延迟: ${avgLatency.toFixed(2)} ms`);
  log('info', `  吞吐量: ${throughput} msg/s`);

  // HTTP 统计
  const httpAvgLatency = httpResults.latencySum / Math.max(1, httpResults.requests);
  const httpThroughput = (httpResults.requests / CONFIG.DURATION_SECONDS).toFixed(2);

  log('info', 'HTTP 测试:');
  log('info', `  请求数: ${httpResults.requests}`, { 成功: httpResults.successes, 失败: httpResults.errors });
  log('info', `  平均延迟: ${httpAvgLatency.toFixed(2)} ms`);
  log('info', `  吞吐量: ${httpThroughput} req/s`);

  // 总体评分
  const wsSuccessRate = (connectedCount / CONFIG.CONCURRENT_CONNECTIONS) * 100;
  const httpSuccessRate = (httpResults.successes / Math.max(1, httpResults.requests)) * 100;

  console.log('\n');
  log('info', '═══════════════════════════════════════════════════════');

  if (wsSuccessRate >= 95 && httpSuccessRate >= 95) {
    log('pass', `✅ 压力测试通过! (WS: ${wsSuccessRate.toFixed(1)}%, HTTP: ${httpSuccessRate.toFixed(1)}%)`);
  } else if (wsSuccessRate >= 80 && httpSuccessRate >= 80) {
    log('warn', `⚠️ 压力测试一般 (WS: ${wsSuccessRate.toFixed(1)}%, HTTP: ${httpSuccessRate.toFixed(1)}%)`);
  } else {
    log('fail', `❌ 压力测试失败 (WS: ${wsSuccessRate.toFixed(1)}%, HTTP: ${httpSuccessRate.toFixed(1)}%)`);
  }

  log('info', '═══════════════════════════════════════════════════════\n');

  // 详细连接报告
  if (CONFIG.VERBOSE) {
    console.log('各连接详情:');
    connectionResults.forEach(c => {
      const status = c.connected ? '✅' : '❌';
      const avgLat = c.latencyCount > 0 ? (c.latencySum / c.latencyCount).toFixed(2) : 'N/A';
      console.log(`  ${status} [${c.id}] sent=${c.messagesSent} recv=${c.messagesReceived} errors=${c.errors} avg_lat=${avgLat}ms`);
    });
  }

  // 提示如何调整
  console.log('\n📊 调整压力参数:');
  console.log('  CONCURRENT_CONNECTIONS=50    # 增加并发连接');
  console.log('  MESSAGES_PER_SECOND=10       # 增加每连接消息速率');
  console.log('  DURATION_SECONDS=30          # 增加测试持续时间');
  console.log('  VERBOSE=true                 # 启用详细日志\n');
}

main().catch(e => {
  log('fail', 'Fatal error:', String(e));
  process.exit(1);
});