/**
 * API 性能基准测试
 * 
 * 测试所有 API 模块的响应时间和吞吐量
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PERFORMANCE_CONFIG } from './config';
import { 
  PerformanceCollector, 
  evaluatePerformance, 
  generateTestData,
  formatDuration,
  sleep,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// 测试用户认证信息
let authToken: string | null = null;
let testUserId: string | null = null;

/**
 * 获取认证 Token
 */
async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  // 尝试登录
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'perf-test@teamclaw.test',
      password: 'PerfTest123!',
    }),
  });

  if (loginResponse.ok) {
    const data = await loginResponse.json();
    authToken = data.token;
    testUserId = data.user?.id;
    return authToken!;
  }

  // 注册新用户
  const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'perf-test@teamclaw.test',
      password: 'PerfTest123!',
      name: '性能测试用户',
    }),
  });

  if (registerResponse.ok) {
    const data = await registerResponse.json();
    authToken = data.token;
    testUserId = data.user?.id;
    return authToken!;
  }

  throw new Error('无法获取认证 Token');
}

/**
 * 发送 HTTP 请求
 */
async function makeRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<{ status: number; duration: number; ok: boolean; error?: string }> {
  const token = await getAuthToken();
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;

    return {
      status: response.status,
      duration,
      ok: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      status: 0,
      duration,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

describe('API 性能基准测试', () => {
  const config = PERFORMANCE_CONFIG.baseline;
  const results: Array<{
    module: string;
    method: string;
    avgResponseTime: number;
    p95ResponseTime: number;
    passed: boolean;
    grade: string;
  }> = [];

  beforeAll(async () => {
    // 确保服务器运行
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (!response.ok) {
        throw new Error('服务器未就绪');
      }
    } catch (error) {
      console.error('请确保开发服务器正在运行: npm run dev');
      throw error;
    }

    // 获取认证
    await getAuthToken();
    console.log('✓ 认证成功');
  });

  afterAll(() => {
    // 打印性能报告
    console.log('\n' + '='.repeat(80));
    console.log('API 性能测试报告');
    console.log('='.repeat(80));
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log(`迭代次数: ${config.iterations}`);
    console.log(`预热次数: ${config.warmupIterations}`);
    console.log('-'.repeat(80));
    
    results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      console.log(
        `${status} ${result.module.padEnd(20)} ${result.method.padEnd(6)} ` +
        `avg: ${formatDuration(result.avgResponseTime).padStart(10)} ` +
        `p95: ${formatDuration(result.p95ResponseTime).padStart(10)} ` +
        `grade: ${result.grade}`
      );
    });
    
    console.log('='.repeat(80));
    
    // 统计通过率
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const passRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : '0';
    console.log(`通过率: ${passedCount}/${totalCount} (${passRate}%)`);
    console.log('='.repeat(80));
  });

  // 测试每个 API 模块
  PERFORMANCE_CONFIG.apiModules.forEach(module => {
    describe(`${module.name} API`, () => {
      module.methods.forEach(method => {
        it(`${method} ${module.path} 性能测试`, async () => {
          const collector = new PerformanceCollector();
          
          // 预热
          for (let i = 0; i < config.warmupIterations; i++) {
            await makeRequest(module.path, method, generateTestData(module.name));
          }

          // 正式测试
          collector.start();
          
          for (let i = 0; i < config.iterations; i++) {
            const result = await makeRequest(module.path, method, generateTestData(module.name));
            collector.recordResponse(result.duration, result.ok, result.error);
            
            // 避免请求过快
            await sleep(10);
          }
          
          collector.stop();
          const metrics = collector.getMetrics();

          // 评估性能
          const thresholds = method === 'GET' 
            ? PERFORMANCE_CONFIG.thresholds.api.get
            : PERFORMANCE_CONFIG.thresholds.api.mutation;
          
          const evaluation = evaluatePerformance(metrics.avgResponseTime, thresholds);

          // 记录结果
          results.push({
            module: module.name,
            method,
            avgResponseTime: metrics.avgResponseTime,
            p95ResponseTime: metrics.p95ResponseTime,
            passed: evaluation.passed,
            grade: evaluation.type,
          });

          // 断言
          expect(metrics.errorRate).toBeLessThan(PERFORMANCE_CONFIG.stress.maxErrorRate);
          expect(evaluation.passed).toBe(true);
          
          console.log(
            `  ${method} ${module.path}: ` +
            `avg=${formatDuration(metrics.avgResponseTime)}, ` +
            `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
            `grade=${evaluation.type}`
          );
        }, 30000); // 30秒超时
      });
    });
  });
});
