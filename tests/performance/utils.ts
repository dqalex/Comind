/**
 * 性能测试工具类
 */

export interface PerformanceMetrics {
  // 基础统计
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  
  // 时间统计
  totalTime: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // 吞吐量
  requestsPerSecond: number;
  
  // 资源使用（如果有）
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  
  // 错误详情
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

export interface PerformanceTestResult {
  moduleName: string;
  testName: string;
  timestamp: string;
  duration: number;
  metrics: PerformanceMetrics;
  passed: boolean;
  threshold: {
    expected: number;
    actual: number;
    type: 'excellent' | 'good' | 'acceptable' | 'failed';
  };
}

/**
 * 性能指标收集器
 */
export class PerformanceCollector {
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;
  private totalRequests = 0;
  private successfulRequests = 0;

  start(): void {
    this.startTime = Date.now();
    this.responseTimes = [];
    this.errors.clear();
    this.totalRequests = 0;
    this.successfulRequests = 0;
  }

  recordResponse(duration: number, success: boolean, error?: string): void {
    this.responseTimes.push(duration);
    this.totalRequests++;
    
    if (success) {
      this.successfulRequests++;
    } else if (error) {
      this.errors.set(error, (this.errors.get(error) || 0) + 1);
    }
  }

  stop(): void {
    this.endTime = Date.now();
  }

  getMetrics(): PerformanceMetrics {
    const totalTime = this.endTime - this.startTime;
    const failedRequests = this.totalRequests - this.successfulRequests;
    
    if (this.responseTimes.length === 0) {
      return {
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests,
        errorRate: this.totalRequests > 0 ? failedRequests / this.totalRequests : 0,
        totalTime,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errors: [],
      };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((s, t) => s + t, 0);
    const memoryUsage = process.memoryUsage();

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests,
      errorRate: failedRequests / this.totalRequests,
      totalTime,
      avgResponseTime: Math.round(sum / sorted.length),
      minResponseTime: sorted[0],
      maxResponseTime: sorted[sorted.length - 1],
      p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)] || sorted[sorted.length - 1],
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      requestsPerSecond: (this.totalRequests / totalTime) * 1000,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      errors: Array.from(this.errors.entries()).map(([message, count]) => ({
        code: 'ERROR',
        message,
        count,
      })),
    };
  }
}

/**
 * 评估性能等级
 */
export function evaluatePerformance(
  actualValue: number,
  thresholds: { excellent: number; good: number; acceptable: number }
): { type: 'excellent' | 'good' | 'acceptable' | 'failed'; passed: boolean } {
  if (actualValue <= thresholds.excellent) {
    return { type: 'excellent', passed: true };
  } else if (actualValue <= thresholds.good) {
    return { type: 'good', passed: true };
  } else if (actualValue <= thresholds.acceptable) {
    return { type: 'acceptable', passed: true };
  } else {
    return { type: 'failed', passed: false };
  }
}

/**
 * 格式化时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 * 睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 并发执行任务
 */
export async function runConcurrently<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 生成随机数据
 */
export function generateTestData(type: string): Record<string, unknown> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  switch (type) {
    case 'task':
      return {
        title: `测试任务-${timestamp}-${random}`,
        description: '这是一个性能测试任务',
        status: 'todo',
        priority: 'medium',
      };
    case 'project':
      return {
        name: `测试项目-${timestamp}-${random}`,
        description: '这是一个性能测试项目',
        status: 'active',
      };
    case 'document':
      return {
        title: `测试文档-${timestamp}-${random}`,
        content: '# 测试文档\n\n这是性能测试生成的内容。',
        type: 'note',
      };
    case 'member':
      return {
        name: `测试成员-${random}`,
        email: `test-${random}@teamclaw.test`,
        role: 'member',
      };
    case 'chat-session':
      return {
        title: `测试会话-${timestamp}`,
        memberId: 'test-member',
        memberName: '测试成员',
      };
    case 'chat-message':
      return {
        sessionId: 'test-session',
        content: `测试消息-${timestamp}`,
        role: 'user',
      };
    default:
      return {
        name: `测试数据-${timestamp}-${random}`,
      };
  }
}
