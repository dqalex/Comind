#!/usr/bin/env tsx
/**
 * 聊天功能集成测试
 * 自动启动 Mock Gateway 和开发服务器，测试任务推送流式响应
 *
 * 用法:
 *   npx tsx scripts/test-chat-integration.ts
 *
 * 测试流程:
 *   1. 启动 Mock Gateway (ws://localhost:18789)
 *   2. 检查 TeamClaw 开发服务器 (http://localhost:3000)
 *   3. 连接 Gateway 并发送测试消息
 *   4. 验证流式响应接收
 *   5. 生成测试报告
 */

import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import http from 'http';
import path from 'path';

// 测试配置
const CONFIG = {
  mockGatewayPort: 18789,
  devServerPort: 3000,
  timeout: 30000, // 30秒超时
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: 'info' | 'success' | 'error' | 'warn', message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  };
  console.log(`${colorMap[level]}[${timestamp}]${colors.reset} ${message}`);
}

// 等待指定时间
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查端口是否可用
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// 等待服务就绪
async function waitForService(port: number, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return true;
    } catch {
      // 服务尚未就绪
    }
    await sleep(1000);
  }
  return false;
}

// 启动 Mock Gateway
function startMockGateway(): Promise<{ process: ChildProcess; ready: boolean }> {
  return new Promise((resolve, reject) => {
    log('info', 'Starting Mock Gateway...');

    const mockGatewayPath = path.join(__dirname, 'mock-gateway.ts');
    const proc = spawn('npx', ['tsx', mockGatewayPath], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
    });

    let output = '';
    let ready = false;

    proc.stdout?.on('data', (data) => {
      const str = data.toString();
      output += str;

      if (str.includes('Mock Gateway WebSocket running')) {
        ready = true;
        log('success', 'Mock Gateway started successfully');
        resolve({ process: proc, ready: true });
      }
    });

    proc.stderr?.on('data', (data) => {
      log('warn', `Mock Gateway: ${data.toString().trim()}`);
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Mock Gateway: ${err.message}`));
    });

    // 超时处理
    setTimeout(() => {
      if (!ready) {
        proc.kill();
        reject(new Error('Mock Gateway startup timeout'));
      }
    }, 10000);
  });
}

// 检查开发服务器
async function checkDevServer(): Promise<boolean> {
  log('info', 'Checking development server...');

  const isAvailable = await isPortAvailable(CONFIG.devServerPort);
  if (isAvailable) {
    log('error', `Port ${CONFIG.devServerPort} is available, dev server not running`);
    log('info', 'Please start the dev server first: npm run dev');
    return false;
  }

  const ready = await waitForService(CONFIG.devServerPort, 5);
  if (ready) {
    log('success', 'Development server is running');
    return true;
  }

  log('error', 'Development server is not responding');
  return false;
}

// WebSocket 测试
interface TestResult {
  success: boolean;
  phase: string;
  receivedDeltas: number;
  receivedFinal: boolean;
  error?: string;
  duration: number;
}

async function runWebSocketTest(): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    success: false,
    phase: 'connecting',
    receivedDeltas: 0,
    receivedFinal: false,
    duration: 0,
  };

  return new Promise((resolve) => {
    log('info', 'Connecting to Mock Gateway...');

    const ws = new WebSocket(`ws://localhost:${CONFIG.mockGatewayPort}`);
    const timeout = setTimeout(() => {
      result.error = 'Test timeout';
      ws.close();
      result.duration = Date.now() - startTime;
      resolve(result);
    }, CONFIG.timeout);

    ws.on('open', () => {
      result.phase = 'authenticating';
      log('info', 'WebSocket connected, sending challenge...');
      ws.send(JSON.stringify({ type: 'challenge' }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 处理 challenge 响应
        if (msg.type === 'challenge') {
          log('info', 'Challenge received, authenticating...');
          ws.send(JSON.stringify({
            type: 'connect',
            clientId: 'test-client-' + Date.now(),
            token: 'mock-token',
            role: 'operator',
          }));
          return;
        }

        // 处理认证成功
        if (msg.type === 'hello-ok') {
          result.phase = 'sending_dm';
          log('info', 'Authenticated, sending DM request...');
          ws.send(JSON.stringify({
            type: 'request',
            id: 'test-dm-1',
            action: 'agent.dm',
            params: {
              agentId: 'main',
              content: '请帮我分析这个测试任务',
            },
          }));
          return;
        }

        // 处理 DM 响应
        if (msg.id === 'test-dm-1' && msg.result?.sessionKey) {
          result.phase = 'receiving_stream';
          log('info', `DM created, sessionKey: ${msg.result.sessionKey}`);
          log('info', 'Waiting for streaming response...');
          return;
        }

        // 处理流式响应
        if (msg.event === 'gateway_chat_event') {
          const payload = msg.payload?.payload || msg.payload;
          if (!payload) return;

          if (payload.state === 'delta') {
            result.receivedDeltas++;
            process.stdout.write(`${colors.cyan}.${colors.reset}`);
          } else if (payload.state === 'final') {
            result.receivedFinal = true;
            result.success = true;
            result.phase = 'completed';
            clearTimeout(timeout);
            ws.close();
            result.duration = Date.now() - startTime;
            resolve(result);
          }
        }
      } catch (err) {
        log('error', `Error parsing message: ${err}`);
      }
    });

    ws.on('error', (err) => {
      result.error = `WebSocket error: ${err.message}`;
      clearTimeout(timeout);
      ws.close();
      result.duration = Date.now() - startTime;
      resolve(result);
    });

    ws.on('close', () => {
      if (!result.success && !result.error) {
        result.error = 'Connection closed unexpectedly';
      }
      clearTimeout(timeout);
      result.duration = Date.now() - startTime;
      resolve(result);
    });
  });
}

// 生成测试报告
function generateReport(result: TestResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}测试报告${colors.reset}`);
  console.log('='.repeat(60));

  console.log(`\n状态: ${result.success ? colors.green + '✅ 通过' : colors.red + '❌ 失败'}${colors.reset}`);
  console.log(`阶段: ${result.phase}`);
  console.log(`耗时: ${result.duration}ms`);
  console.log(`接收 Delta: ${result.receivedDeltas} 个`);
  console.log(`接收 Final: ${result.receivedFinal ? '是' : '否'}`);

  if (result.error) {
    console.log(`${colors.red}错误: ${result.error}${colors.reset}`);
  }

  console.log('\n检查项:');
  const checks = [
    { name: '连接到 Mock Gateway', pass: result.phase !== 'connecting' },
    { name: '完成身份认证', pass: result.phase !== 'authenticating' },
    { name: '成功创建 DM 会话', pass: result.phase !== 'sending_dm' },
    { name: '接收到流式响应', pass: result.receivedDeltas > 0 },
    { name: '接收到 Final 消息', pass: result.receivedFinal },
  ];

  checks.forEach(check => {
    const icon = check.pass ? colors.green + '✓' : colors.red + '✗';
    console.log(`  ${icon} ${check.name}${colors.reset}`);
  });

  console.log('\n' + '='.repeat(60));
}

// 主函数
async function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     TeamClaw Chat Integration Test                     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  let mockGateway: ChildProcess | null = null;

  try {
    // 1. 检查开发服务器
    const devServerRunning = await checkDevServer();
    if (!devServerRunning) {
      log('error', 'Development server is not running. Please start it first:');
      log('info', '  npm run dev');
      process.exit(1);
    }

    // 2. 启动 Mock Gateway
    const { process: mgProc } = await startMockGateway();
    mockGateway = mgProc;

    // 等待 Gateway 完全启动
    await sleep(1000);

    // 3. 运行 WebSocket 测试
    log('info', 'Starting WebSocket test...');
    const result = await runWebSocketTest();

    // 4. 生成报告
    generateReport(result);

    // 5. 退出码
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    log('error', `Test failed: ${error}`);
    process.exit(1);
  } finally {
    // 清理
    if (mockGateway) {
      log('info', 'Shutting down Mock Gateway...');
      mockGateway.kill();
    }
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (err) => {
  log('error', `Unhandled rejection: ${err}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  log('info', '\nTest interrupted by user');
  process.exit(0);
});

// 运行主函数
main();
