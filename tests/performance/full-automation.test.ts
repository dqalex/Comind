#!/usr/bin/env tsx
/**
 * 完整自动化测试脚本
 * 同时启动 Mock Gateway 和开发服务器，执行集成测试
 *
 * 用法:
 *   npx tsx scripts/test-full-automation.ts
 *
 * 此脚本会:
 *   1. 启动 Mock Gateway (如果尚未运行)
 *   2. 启动开发服务器 (如果尚未运行)
 *   3. 等待服务就绪
 *   4. 执行 WebSocket 流式响应测试
 *   5. 生成测试报告
 *   6. 清理进程
 */

import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  mockGatewayPort: 18789,
  devServerPort: 3000,
  testTimeout: 30000,
  startupTimeout: 60000,
};

// 颜色
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// 进程管理
const processes: ChildProcess[] = [];

function log(level: 'info' | 'success' | 'error' | 'warn' | 'debug', message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: c.blue,
    success: c.green,
    error: c.red,
    warn: c.yellow,
    debug: c.gray,
  };
  console.log(`${colors[level]}[${timestamp}]${c.reset} ${message}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查端口是否被占用
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 启动服务
async function startService(
  name: string,
  command: string,
  args: string[],
  readyPattern: RegExp,
  timeout: number
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    log('info', `Starting ${name}...`);

    const proc = spawn(command, args, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    processes.push(proc);
    let ready = false;

    const output: string[] = [];

    proc.stdout?.on('data', (data) => {
      const str = data.toString();
      output.push(str);

      if (!ready && readyPattern.test(str)) {
        ready = true;
        log('success', `${name} is ready`);
        resolve(proc);
      }
    });

    proc.stderr?.on('data', (data) => {
      const str = data.toString();
      output.push(str);
      // 只输出关键错误
      if (str.includes('Error') || str.includes('error')) {
        log('debug', `${name}: ${str.trim()}`);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start ${name}: ${err.message}`));
    });

    proc.on('exit', (code) => {
      if (!ready && code !== 0) {
        reject(new Error(`${name} exited with code ${code}\n${output.join('')}`));
      }
    });

    // 超时
    setTimeout(() => {
      if (!ready) {
        proc.kill();
        reject(new Error(`${name} startup timeout`));
      }
    }, timeout);
  });
}

// WebSocket 测试
interface TestResult {
  success: boolean;
  phase: string;
  receivedDeltas: number;
  receivedFinal: boolean;
  sessionKey?: string;
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
    const ws = new WebSocket(`ws://localhost:${CONFIG.mockGatewayPort}`);

    const timeout = setTimeout(() => {
      result.error = 'Test timeout (30s)';
      ws.close();
      result.duration = Date.now() - startTime;
      resolve(result);
    }, CONFIG.testTimeout);

    ws.on('open', () => {
      result.phase = 'authenticating';
      ws.send(JSON.stringify({ type: 'challenge' }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'challenge') {
          ws.send(JSON.stringify({
            type: 'connect',
            clientId: 'auto-test-' + Date.now(),
            token: 'mock-token',
            role: 'operator',
          }));
          return;
        }

        if (msg.type === 'hello-ok') {
          result.phase = 'sending_dm';
          log('info', 'Sending DM request...');
          ws.send(JSON.stringify({
            type: 'request',
            id: 'auto-test-dm',
            action: 'agent.dm',
            params: {
              agentId: 'main',
              content: '请帮我分析这个测试任务',
            },
          }));
          return;
        }

        if (msg.id === 'auto-test-dm' && msg.result?.sessionKey) {
          result.sessionKey = msg.result.sessionKey;
          result.phase = 'receiving_stream';
          log('info', 'Waiting for streaming response...');
          return;
        }

        if (msg.event === 'gateway_chat_event') {
          const payload = msg.payload?.payload || msg.payload;
          if (!payload) return;

          if (payload.state === 'delta') {
            result.receivedDeltas++;
            process.stdout.write(`${c.cyan}.${c.reset}`);
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
        log('error', `Parse error: ${err}`);
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
      clearTimeout(timeout);
      result.duration = Date.now() - startTime;
      if (!result.success) {
        result.error = result.error || 'Connection closed unexpectedly';
      }
      resolve(result);
    });
  });
}

// 生成报告
function generateReport(result: TestResult) {
  console.log('\n' + '='.repeat(70));
  console.log(`${c.bold}📊 测试报告${c.reset}`);
  console.log('='.repeat(70));

  const status = result.success
    ? `${c.green}✅ 测试通过${c.reset}`
    : `${c.red}❌ 测试失败${c.reset}`;
  console.log(`\n状态: ${status}`);
  console.log(`阶段: ${result.phase}`);
  console.log(`耗时: ${result.duration}ms`);
  console.log(`Session Key: ${result.sessionKey || 'N/A'}`);
  console.log(`接收 Delta: ${result.receivedDeltas} 个`);
  console.log(`接收 Final: ${result.receivedFinal ? '是' : '否'}`);

  if (result.error) {
    console.log(`\n${c.red}错误: ${result.error}${c.reset}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log('检查项:');
  const checks = [
    { name: '连接到 Mock Gateway', pass: result.phase !== 'connecting' },
    { name: '完成身份认证', pass: result.phase !== 'authenticating' },
    { name: '成功创建 DM 会话', pass: result.phase !== 'sending_dm' },
    { name: '接收到流式响应', pass: result.receivedDeltas > 0 },
    { name: '接收到 Final 消息', pass: result.receivedFinal },
  ];

  checks.forEach(check => {
    const icon = check.pass ? `${c.green}✓` : `${c.red}✗`;
    console.log(`  ${icon} ${check.name}${c.reset}`);
  });

  console.log('='.repeat(70) + '\n');
}

// 清理进程
function cleanup() {
  log('info', 'Cleaning up processes...');
  processes.forEach(proc => {
    if (proc.pid && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
}

// 主函数
async function main() {
  console.log(`${c.cyan}${c.bold}`);
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        TeamClaw Chat Full Automation Test                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`${c.reset}\n`);

  let mockGatewayStarted = false;
  let devServerStarted = false;

  try {
    // 1. 检查并启动 Mock Gateway
    const mockGatewayRunning = await isPortInUse(CONFIG.mockGatewayPort);
    if (!mockGatewayRunning) {
      const mockGatewayPath = path.join(__dirname, 'mock-gateway.ts');
      await startService(
        'Mock Gateway',
        'npx',
        ['tsx', mockGatewayPath],
        /Mock Gateway WebSocket running/,
        CONFIG.startupTimeout
      );
      mockGatewayStarted = true;
      await sleep(1000);
    } else {
      log('success', 'Mock Gateway is already running');
    }

    // 2. 检查并启动开发服务器
    const devServerRunning = await isPortInUse(CONFIG.devServerPort);
    if (!devServerRunning) {
      log('info', 'Please start the dev server manually in another terminal:');
      log('info', '  npm run dev');
      log('info', '');
      log('info', 'Or run this test with an already running dev server.');
      process.exit(1);
    } else {
      log('success', 'Development server is already running');
    }

    // 3. 运行测试
    log('info', 'Running WebSocket test...');
    const result = await runWebSocketTest();

    // 4. 生成报告
    generateReport(result);

    // 5. 退出
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    log('error', `Test failed: ${error}`);
    process.exit(1);
  } finally {
    if (mockGatewayStarted) {
      cleanup();
    }
  }
}

// 信号处理
process.on('SIGINT', () => {
  log('info', '\nTest interrupted');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  log('error', `Unhandled rejection: ${err}`);
  cleanup();
  process.exit(1);
});

// 运行
main();
