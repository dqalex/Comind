/**
 * Gateway WebSocket 性能测试
 * 
 * 测试 OpenClaw Gateway 的 WebSocket 连接性能
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import WebSocket from 'ws';
import { PERFORMANCE_CONFIG } from './config';
import { PerformanceCollector, evaluatePerformance, formatDuration, sleep } from './utils';

const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || 'test-token';

interface WebSocketMessage {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface WebSocketResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * WebSocket 客户端包装
 */
class GatewayClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: WebSocketResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isConnected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GATEWAY_URL);
      
      this.ws.on('open', async () => {
        // 发送连接请求
        this.send('connect', {
          token: GATEWAY_TOKEN,
          role: 'operator',
        });
        
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString()) as WebSocketResponse;
          const pending = this.pendingRequests.get(response.id);
          
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);
            
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response);
            }
          }
          
          // 检查连接成功消息
          if ((response as any).method === 'hello-ok') {
            this.isConnected = true;
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        reject(error);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
      });
    });
  }

  async request(method: string, params?: Record<string, unknown>): Promise<WebSocketResponse> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.messageId;
    const message: WebSocketMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      this.ws!.send(JSON.stringify(message));
    });
  }

  private send(method: string, params?: Record<string, unknown>): void {
    if (!this.ws) return;
    
    const id = ++this.messageId;
    const message: WebSocketMessage = { id, method, params };
    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.ws !== null;
  }
}

describe('Gateway WebSocket 性能测试', () => {
  let client: GatewayClient;

  beforeAll(async () => {
    client = new GatewayClient();
    
    try {
      await client.connect();
      console.log('✓ Gateway 连接成功');
      
      // 等待连接确认
      await sleep(1000);
    } catch (error) {
      console.warn('⚠ Gateway 连接失败，跳过 Gateway 性能测试:', error);
    }
  });

  afterAll(() => {
    client.disconnect();
  });

  it('快照请求性能', async () => {
    if (!client.isReady()) {
      console.log('  跳过：Gateway 未连接');
      return;
    }

    const collector = new PerformanceCollector();
    const iterations = 50;

    collector.start();

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await client.request('snapshot');
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, true);
      } catch (error) {
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
      }

      await sleep(50);
    }

    collector.stop();
    const metrics = collector.getMetrics();

    console.log(
      `  快照请求: avg=${formatDuration(metrics.avgResponseTime)}, ` +
      `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
      `success=${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`
    );

    expect(metrics.errorRate).toBeLessThan(0.1);
  });

  it('Agent 列表请求性能', async () => {
    if (!client.isReady()) {
      console.log('  跳过：Gateway 未连接');
      return;
    }

    const collector = new PerformanceCollector();
    const iterations = 50;

    collector.start();

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await client.request('list_agents');
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, true);
      } catch (error) {
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
      }

      await sleep(50);
    }

    collector.stop();
    const metrics = collector.getMetrics();

    console.log(
      `  Agent列表: avg=${formatDuration(metrics.avgResponseTime)}, ` +
      `p95=${formatDuration(metrics.p95ResponseTime)}`
    );

    expect(metrics.errorRate).toBeLessThan(0.1);
  });

  it('Session 列表请求性能', async () => {
    if (!client.isReady()) {
      console.log('  跳过：Gateway 未连接');
      return;
    }

    const collector = new PerformanceCollector();
    const iterations = 50;

    collector.start();

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await client.request('list_sessions');
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, true);
      } catch (error) {
        const duration = Date.now() - startTime;
        collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
      }

      await sleep(50);
    }

    collector.stop();
    const metrics = collector.getMetrics();

    console.log(
      `  Session列表: avg=${formatDuration(metrics.avgResponseTime)}, ` +
      `p95=${formatDuration(metrics.p95ResponseTime)}`
    );

    expect(metrics.errorRate).toBeLessThan(0.1);
  });

  it('并发请求性能', async () => {
    if (!client.isReady()) {
      console.log('  跳过：Gateway 未连接');
      return;
    }

    const concurrencyLevels = [5, 10, 20];

    for (const concurrency of concurrencyLevels) {
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrency }, () =>
        client.request('snapshot').catch(() => null)
      );
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const avgTime = duration / concurrency;
      
      console.log(`  ${concurrency} 并发请求: 总时间=${formatDuration(duration)}, 平均=${formatDuration(avgTime)}`);
    }
  });

  it('连接稳定性测试', async () => {
    if (!client.isReady()) {
      console.log('  跳过：Gateway 未连接');
      return;
    }

    const duration = 10000; // 10秒
    const interval = 500;   // 每500ms发送一次
    const iterations = Math.floor(duration / interval);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        await client.request('snapshot');
        successCount++;
      } catch (error) {
        failCount++;
      }
      
      await sleep(interval);
    }

    const successRate = successCount / iterations;
    console.log(`  连接稳定性: 成功率=${(successRate * 100).toFixed(1)}% (${successCount}/${iterations})`);
    
    expect(successRate).toBeGreaterThan(0.9);
  });
});
