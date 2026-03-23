/**
 * MCP 执行性能测试
 * 
 * 测试 MCP 工具调用的响应时间和吞吐量
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PERFORMANCE_CONFIG } from './config';
import { PerformanceCollector, evaluatePerformance, formatDuration, sleep } from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let authToken: string | null = null;

// MCP 工具定义
const MCP_TOOLS = [
  // 任务相关
  { name: 'create_task', category: 'task' },
  { name: 'update_task', category: 'task' },
  { name: 'delete_task', category: 'task' },
  { name: 'list_tasks', category: 'task' },
  { name: 'get_task', category: 'task' },
  
  // 文档相关
  { name: 'create_document', category: 'document' },
  { name: 'update_document', category: 'document' },
  { name: 'delete_document', category: 'document' },
  { name: 'list_documents', category: 'document' },
  { name: 'get_document', category: 'document' },
  
  // 项目相关
  { name: 'create_project', category: 'project' },
  { name: 'update_project', category: 'project' },
  { name: 'delete_project', category: 'project' },
  { name: 'list_projects', category: 'project' },
  { name: 'get_project', category: 'project' },
  
  // 成员相关
  { name: 'create_member', category: 'member' },
  { name: 'update_member', category: 'member' },
  { name: 'delete_member', category: 'member' },
  { name: 'list_members', category: 'member' },
  
  // 日程相关
  { name: 'create_schedule', category: 'schedule' },
  { name: 'list_schedules', category: 'schedule' },
  
  // 里程碑相关
  { name: 'create_milestone', category: 'milestone' },
  { name: 'list_milestones', category: 'milestone' },
  
  // 模板相关
  { name: 'create_template', category: 'template' },
  { name: 'list_templates', category: 'template' },
  
  // SOP 相关
  { name: 'create_sop', category: 'sop' },
  { name: 'list_sops', category: 'sop' },
];

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

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
    return authToken!;
  }

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
    return authToken!;
  }

  throw new Error('无法获取认证 Token');
}

async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; duration: number; error?: string }> {
  const token = await getAuthToken();
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: toolName,
        params: args,
        id: Date.now(),
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        duration,
        error: `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        duration,
        error: result.error.message || 'MCP error',
      };
    }

    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

describe('MCP 执行性能测试', () => {
  const results: Array<{
    tool: string;
    category: string;
    avgResponseTime: number;
    p95ResponseTime: number;
    passed: boolean;
    grade: string;
  }> = [];

  beforeAll(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (!response.ok) {
        throw new Error('服务器未就绪');
      }
    } catch (error) {
      console.error('请确保开发服务器正在运行: npm run dev');
      throw error;
    }

    await getAuthToken();
    console.log('✓ 认证成功');
  });

  afterAll(() => {
    console.log('\n' + '='.repeat(80));
    console.log('MCP 性能测试报告');
    console.log('='.repeat(80));
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log('-'.repeat(80));

    // 按类别分组
    const groupedResults = new Map<string, typeof results>();
    results.forEach(r => {
      if (!groupedResults.has(r.category)) {
        groupedResults.set(r.category, []);
      }
      groupedResults.get(r.category)!.push(r);
    });

    groupedResults.forEach((categoryResults, category) => {
      console.log(`\n[${category.toUpperCase()}]`);
      categoryResults.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        console.log(
          `  ${status} ${result.tool.padEnd(20)} ` +
          `avg: ${formatDuration(result.avgResponseTime).padStart(10)} ` +
          `p95: ${formatDuration(result.p95ResponseTime).padStart(10)} ` +
          `grade: ${result.grade}`
        );
      });
    });

    console.log('\n' + '='.repeat(80));
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const passRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : '0';
    console.log(`通过率: ${passedCount}/${totalCount} (${passRate}%)`);
    console.log('='.repeat(80));
  });

  // 测试读取类工具
  describe('读取类工具', () => {
    const readTools = MCP_TOOLS.filter(t => 
      t.name.startsWith('list_') || t.name.startsWith('get_')
    );

    readTools.forEach(tool => {
      it(`${tool.name} 性能测试`, async () => {
        const collector = new PerformanceCollector();
        const iterations = PERFORMANCE_CONFIG.baseline.iterations;

        collector.start();

        for (let i = 0; i < iterations; i++) {
          let args = {};
          
          // 根据工具类型设置参数
          if (tool.name.startsWith('get_')) {
            args = { id: 'test-id' };
          } else if (tool.name === 'list_tasks') {
            args = { limit: 20, offset: 0 };
          } else {
            args = { limit: 20 };
          }

          const result = await callMCPTool(tool.name, args);
          collector.recordResponse(result.duration, result.success, result.error);
          await sleep(10);
        }

        collector.stop();
        const metrics = collector.getMetrics();

        const evaluation = evaluatePerformance(
          metrics.avgResponseTime,
          PERFORMANCE_CONFIG.thresholds.api.get
        );

        results.push({
          tool: tool.name,
          category: tool.category,
          avgResponseTime: metrics.avgResponseTime,
          p95ResponseTime: metrics.p95ResponseTime,
          passed: evaluation.passed,
          grade: evaluation.type,
        });

        console.log(
          `  ${tool.name}: avg=${formatDuration(metrics.avgResponseTime)}, ` +
          `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
          `grade=${evaluation.type}`
        );

        // 读取类工具应该有较高的性能要求
        expect(metrics.errorRate).toBeLessThan(0.1); // 允许 10% 错误率（部分工具可能不存在）
      }, 30000);
    });
  });

  // 测试写入类工具
  describe('写入类工具', () => {
    const writeTools = MCP_TOOLS.filter(t => 
      t.name.startsWith('create_') || t.name.startsWith('update_') || t.name.startsWith('delete_')
    );

    // 只测试部分写入工具，避免创建太多数据
    const sampledTools = writeTools.filter(t => t.name.startsWith('create_'));

    sampledTools.forEach(tool => {
      it(`${tool.name} 性能测试`, async () => {
        const collector = new PerformanceCollector();
        const iterations = 30; // 减少迭代次数

        collector.start();

        for (let i = 0; i < iterations; i++) {
          let args = {};
          
          // 根据工具类型设置参数
          if (tool.name === 'create_task') {
            args = {
              title: `MCP测试任务-${Date.now()}`,
              description: '性能测试',
              status: 'todo',
              priority: 'medium',
            };
          } else if (tool.name === 'create_document') {
            args = {
              title: `MCP测试文档-${Date.now()}`,
              content: '# 测试',
              type: 'note',
            };
          } else if (tool.name === 'create_project') {
            args = {
              name: `MCP测试项目-${Date.now()}`,
              description: '性能测试',
            };
          } else if (tool.name === 'create_member') {
            args = {
              name: `测试成员-${Date.now()}`,
              email: `test-${Date.now()}@test.com`,
              role: 'member',
            };
          }

          const result = await callMCPTool(tool.name, args);
          collector.recordResponse(result.duration, result.success, result.error);
          await sleep(20);
        }

        collector.stop();
        const metrics = collector.getMetrics();

        const evaluation = evaluatePerformance(
          metrics.avgResponseTime,
          PERFORMANCE_CONFIG.thresholds.api.mutation
        );

        results.push({
          tool: tool.name,
          category: tool.category,
          avgResponseTime: metrics.avgResponseTime,
          p95ResponseTime: metrics.p95ResponseTime,
          passed: evaluation.passed,
          grade: evaluation.type,
        });

        console.log(
          `  ${tool.name}: avg=${formatDuration(metrics.avgResponseTime)}, ` +
          `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
          `grade=${evaluation.type}`
        );

        expect(metrics.errorRate).toBeLessThan(0.15);
      }, 30000);
    });
  });

  // 测试 MCP 批量操作
  describe('MCP 批量操作', () => {
    it('批量创建任务', async () => {
      const collector = new PerformanceCollector();
      const batchSize = 10;
      const iterations = 5;

      collector.start();

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          // 并发创建多个任务
          const promises = Array.from({ length: batchSize }, () => 
            callMCPTool('create_task', {
              title: `批量测试任务-${Date.now()}`,
              description: '批量性能测试',
              status: 'todo',
              priority: 'medium',
            })
          );
          
          const results = await Promise.all(promises);
          const duration = Date.now() - startTime;
          
          const successCount = results.filter(r => r.success).length;
          collector.recordResponse(duration, successCount === batchSize);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      console.log(
        `  批量创建任务 (${batchSize}个/批次): ` +
        `avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}`
      );

      expect(metrics.errorRate).toBeLessThan(0.2);
    });
  });
});
