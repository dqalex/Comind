/**
 * 简单性能测试脚本
 * 直接测试 API、数据库、MCP 性能
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, inArray } from 'drizzle-orm';
import { tasks, projects, documents } from '../../db/schema';
import { generateId } from '../../src/shared/lib/id';

const BASE_URL = 'http://localhost:3000';

// Cookie 存储
let sessionCookie: string | null = null;

async function getAuthCookie(): Promise<string> {
  if (sessionCookie) return sessionCookie;

  // 尝试登录
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'perf-test@teamclaw.test',
      password: 'PerfTest123!',
    }),
  });

  if (loginRes.ok) {
    // 从 Set-Cookie header 提取 cookie
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      // 提取 cms_session 值
      const match = setCookie.match(/cms_session=([^;]+)/);
      if (match) {
        sessionCookie = `cms_session=${match[1]}`;
        return sessionCookie!;
      }
    }
  }

  // 注册新用户
  await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'perf-test@teamclaw.test',
      password: 'PerfTest123!',
      name: '性能测试用户',
    }),
  });

  // 再次尝试登录
  const retryLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'perf-test@teamclaw.test',
      password: 'PerfTest123!',
    }),
  });

  if (retryLoginRes.ok) {
    const setCookie = retryLoginRes.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/cms_session=([^;]+)/);
      if (match) {
        sessionCookie = `cms_session=${match[1]}`;
        return sessionCookie!;
      }
    }
  }

  throw new Error('无法获取认证 Cookie');
}

interface TestResult {
  name: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  success: boolean;
  errorRate: number;
}

async function testApiEndpoint(
  path: string,
  method: string,
  iterations: number = 50
): Promise<TestResult> {
  const times: number[] = [];
  let errors = 0;

  // 获取认证
  const cookie = await getAuthCookie();
  const headers: Record<string, string> = { Cookie: cookie };
  if (method !== 'GET') headers['Content-Type'] = 'application/json';

  // 预热
  for (let i = 0; i < 3; i++) {
    try {
      await fetch(`${BASE_URL}${path}`, { method, headers });
    } catch {}
  }

  // 正式测试
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify({ title: `test-${i}` }) : undefined,
      });
      if (!res.ok) errors++;
    } catch {
      errors++;
    }
    times.push(Date.now() - start);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((s, t) => s + t, 0);

  return {
    name: `${method} ${path}`,
    avgMs: Math.round(sum / times.length),
    minMs: times[0],
    maxMs: times[times.length - 1],
    p95Ms: times[Math.floor(times.length * 0.95)] || times[times.length - 1],
    success: errors < iterations * 0.5,
    errorRate: errors / iterations,
  };
}

async function testDatabaseRead(db: ReturnType<typeof drizzle>, iterations: number = 100): Promise<TestResult> {
  const times: number[] = [];
  let errors = 0;
  const now = new Date();

  // 创建测试数据
  const testTasks = await db.insert(tasks).values(
    Array.from({ length: 50 }, (_, i) => ({
      id: generateId(),
      title: `性能测试任务 ${i}`,
      status: 'todo' as const,
      priority: 'medium' as const,
      source: 'local' as const,
      creatorId: 'perf-test',
      createdAt: now,
      updatedAt: now,
    }))
  ).returning();

  const testIds = testTasks.map(t => t.id);

  // 测试
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const randomId = testIds[Math.floor(Math.random() * testIds.length)];
      await db.select().from(tasks).where(eq(tasks.id, randomId)).limit(1);
    } catch {
      errors++;
    }
    times.push(Date.now() - start);
  }

  // 清理
  await db.delete(tasks).where(inArray(tasks.id, testIds));

  times.sort((a, b) => a - b);
  const sum = times.reduce((s, t) => s + t, 0);

  return {
    name: 'DB 单条查询',
    avgMs: Math.round(sum / times.length),
    minMs: times[0],
    maxMs: times[times.length - 1],
    p95Ms: times[Math.floor(times.length * 0.95)] || times[times.length - 1],
    success: errors === 0,
    errorRate: errors / iterations,
  };
}

async function testDatabaseWrite(db: ReturnType<typeof drizzle>, iterations: number = 50): Promise<TestResult> {
  const times: number[] = [];
  const insertedIds: string[] = [];
  let errors = 0;
  const now = new Date();

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const result = await db.insert(tasks).values({
        id: generateId(),
        title: `写入测试 ${i}`,
        status: 'todo' as const,
        priority: 'medium' as const,
        source: 'local' as const,
        creatorId: 'perf-test',
        createdAt: now,
        updatedAt: now,
      }).returning({ id: tasks.id });
      insertedIds.push(result[0].id);
    } catch {
      errors++;
    }
    times.push(Date.now() - start);
  }

  // 清理
  if (insertedIds.length > 0) {
    await db.delete(tasks).where(inArray(tasks.id, insertedIds));
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((s, t) => s + t, 0);

  return {
    name: 'DB 单条写入',
    avgMs: Math.round(sum / times.length),
    minMs: times[0],
    maxMs: times[times.length - 1],
    p95Ms: times[Math.floor(times.length * 0.95)] || times[times.length - 1],
    success: errors === 0,
    errorRate: errors / iterations,
  };
}

async function testDatabaseBatchRead(db: ReturnType<typeof drizzle>, iterations: number = 50): Promise<TestResult> {
  const times: number[] = [];
  let errors = 0;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await db.select().from(tasks).limit(50).offset(i * 10);
    } catch {
      errors++;
    }
    times.push(Date.now() - start);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((s, t) => s + t, 0);

  return {
    name: 'DB 批量查询(50条)',
    avgMs: Math.round(sum / times.length),
    minMs: times[0],
    maxMs: times[times.length - 1],
    p95Ms: times[Math.floor(times.length * 0.95)] || times[times.length - 1],
    success: errors === 0,
    errorRate: errors / iterations,
  };
}

function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(1)}ms` : `${ms}ms`;
}

function getGrade(avgMs: number, thresholds: [number, number, number]): string {
  if (avgMs <= thresholds[0]) return '🟢 优秀';
  if (avgMs <= thresholds[1]) return '🟡 良好';
  if (avgMs <= thresholds[2]) return '🟠 可接受';
  return '🔴 需优化';
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TeamClaw 性能测试报告');
  console.log('测试时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(70) + '\n');

  const results: TestResult[] = [];

  // 1. API 性能测试
  console.log('📊 API 性能测试\n');
  console.log('端点                          平均      最小      最大      P95      等级');
  console.log('-'.repeat(70));

  const apiTests = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/tasks', method: 'GET' },
    { path: '/api/projects', method: 'GET' },
    { path: '/api/documents', method: 'GET' },
    { path: '/api/members', method: 'GET' },
  ];

  for (const test of apiTests) {
    const result = await testApiEndpoint(test.path, test.method);
    results.push(result);
    const grade = getGrade(result.avgMs, [100, 300, 1000]);
    console.log(
      `${result.name.padEnd(30)} ` +
      `${formatMs(result.avgMs).padStart(8)} ` +
      `${formatMs(result.minMs).padStart(8)} ` +
      `${formatMs(result.maxMs).padStart(8)} ` +
      `${formatMs(result.p95Ms).padStart(8)} ` +
      `  ${grade}`
    );
  }

  // 2. 数据库性能测试
  console.log('\n📊 数据库性能测试\n');
  console.log('操作                          平均      最小      最大      P95      等级');
  console.log('-'.repeat(70));

  const sqlite = new Database('./data/teamclaw.db');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite);

  const dbReadResult = await testDatabaseRead(db);
  results.push(dbReadResult);
  console.log(
    `${dbReadResult.name.padEnd(30)} ` +
    `${formatMs(dbReadResult.avgMs).padStart(8)} ` +
    `${formatMs(dbReadResult.minMs).padStart(8)} ` +
    `${formatMs(dbReadResult.maxMs).padStart(8)} ` +
    `${formatMs(dbReadResult.p95Ms).padStart(8)} ` +
    `  ${getGrade(dbReadResult.avgMs, [10, 50, 200])}`
  );

  const dbBatchResult = await testDatabaseBatchRead(db);
  results.push(dbBatchResult);
  console.log(
    `${dbBatchResult.name.padEnd(30)} ` +
    `${formatMs(dbBatchResult.avgMs).padStart(8)} ` +
    `${formatMs(dbBatchResult.minMs).padStart(8)} ` +
    `${formatMs(dbBatchResult.maxMs).padStart(8)} ` +
    `${formatMs(dbBatchResult.p95Ms).padStart(8)} ` +
    `  ${getGrade(dbBatchResult.avgMs, [100, 500, 2000])}`
  );

  const dbWriteResult = await testDatabaseWrite(db);
  results.push(dbWriteResult);
  console.log(
    `${dbWriteResult.name.padEnd(30)} ` +
    `${formatMs(dbWriteResult.avgMs).padStart(8)} ` +
    `${formatMs(dbWriteResult.minMs).padStart(8)} ` +
    `${formatMs(dbWriteResult.maxMs).padStart(8)} ` +
    `${formatMs(dbWriteResult.p95Ms).padStart(8)} ` +
    `  ${getGrade(dbWriteResult.avgMs, [20, 100, 500])}`
  );

  sqlite.close();

  // 3. 并发测试
  console.log('\n📊 并发性能测试\n');
  console.log('并发数    操作              总时间    平均/请求    成功率');
  console.log('-'.repeat(70));

  const cookie = await getAuthCookie();
  const concurrencyTests = [10, 20, 50];
  for (const concurrency of concurrencyTests) {
    const start = Date.now();
    const promises = Array.from({ length: concurrency }, async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/tasks?limit=20`, {
          headers: { Cookie: cookie },
        });
        return res.ok;
      } catch {
        return false;
      }
    });
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    const successCount = results.filter(Boolean).length;
    console.log(
      `${String(concurrency).padStart(4)} 并发  ` +
      `API 读取          ` +
      `${formatMs(duration).padStart(8)} ` +
      `${formatMs(duration / concurrency).padStart(10)} ` +
      `  ${(successCount / concurrency * 100).toFixed(0)}%`
    );
  }

  // 4. 总结
  console.log('\n' + '='.repeat(70));
  console.log('测试总结');
  console.log('='.repeat(70));

  const passedCount = results.filter(r => r.success && r.errorRate === 0).length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log(`\n通过率: ${passedCount}/${totalCount} (${passRate}%)`);
  console.log(`平均响应时间: ${formatMs(results.reduce((s, r) => s + r.avgMs, 0) / results.length)}`);
  console.log(`最大响应时间: ${formatMs(Math.max(...results.map(r => r.maxMs)))}`);

  const excellentCount = results.filter(r => r.avgMs < 100).length;
  const goodCount = results.filter(r => r.avgMs >= 100 && r.avgMs < 500).length;
  const acceptableCount = results.filter(r => r.avgMs >= 500 && r.avgMs < 1000).length;
  const needsOptimization = results.filter(r => r.avgMs >= 1000).length;

  console.log(`\n性能分布:`);
  console.log(`  🟢 优秀 (< 100ms):    ${excellentCount} 个`);
  console.log(`  🟡 良好 (100-500ms):  ${goodCount} 个`);
  console.log(`  🟠 可接受 (500-1000ms): ${acceptableCount} 个`);
  console.log(`  🔴 需优化 (> 1000ms): ${needsOptimization} 个`);

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(console.error);
