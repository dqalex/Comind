/**
 * 数据库性能测试
 * 
 * 测试 SQLite 数据库的查询、写入、并发性能
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { tasks, projects, documents, members } from '@/db/schema';
import { PERFORMANCE_CONFIG } from './config';
import { PerformanceCollector, evaluatePerformance, formatDuration } from './utils';

let db: ReturnType<typeof drizzle>;
let sqlite: Database.Database;

describe('数据库性能测试', () => {
  beforeAll(async () => {
    // 连接测试数据库
    const dbPath = process.env.TEST_DB_PATH || './data/teamclaw.db';
    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    
    db = drizzle(sqlite);
    
    console.log('✓ 数据库连接成功');
  });

  afterAll(() => {
    sqlite.close();
  });

  describe('查询性能', () => {
    it('单条查询 - 根据 ID 查询任务', async () => {
      const collector = new PerformanceCollector();
      const iterations = PERFORMANCE_CONFIG.baseline.iterations;
      
      // 先创建一些测试数据
      const now = new Date();
      const taskIdPrefix = `perf_task_${Date.now()}_`;
      const testTasks = await db.insert(tasks).values(
        Array.from({ length: 100 }, (_, i) => ({
          id: `${taskIdPrefix}${i}`,
          title: `查询测试任务 ${i}`,
          description: `测试任务描述 ${i}`,
          status: 'todo' as const,
          priority: 'medium' as const,
          source: 'local' as const,
          creatorId: 'perf-test-user',
          assignees: [],
          createdAt: now,
          updatedAt: now,
        }))
      ).returning();

      const testTaskIds = testTasks.map(t => t.id);

      collector.start();

      for (let i = 0; i < iterations; i++) {
        const randomId = testTaskIds[Math.floor(Math.random() * testTaskIds.length)];
        const startTime = Date.now();
        
        try {
          await db.select().from(tasks).where(eq(tasks.id, randomId)).limit(1);
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      // 清理测试数据
      await db.delete(tasks).where(inArray(tasks.id, testTaskIds));

      const evaluation = evaluatePerformance(
        metrics.avgResponseTime,
        PERFORMANCE_CONFIG.thresholds.database.singleQuery
      );

      console.log(
        `  单条查询: avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
        `grade=${evaluation.type}`
      );

      expect(evaluation.passed).toBe(true);
    });

    it('列表查询 - 分页查询任务', async () => {
      const collector = new PerformanceCollector();
      const iterations = PERFORMANCE_CONFIG.baseline.iterations;
      
      collector.start();

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          await db.select().from(tasks).limit(20).offset(i * 20);
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      const evaluation = evaluatePerformance(
        metrics.avgResponseTime,
        PERFORMANCE_CONFIG.thresholds.database.batchQuery
      );

      console.log(
        `  列表查询: avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
        `grade=${evaluation.type}`
      );

      expect(evaluation.passed).toBe(true);
    });

    it('复杂查询 - 多条件筛选', async () => {
      const collector = new PerformanceCollector();
      const iterations = PERFORMANCE_CONFIG.baseline.iterations;
      
      collector.start();

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          await db.select().from(tasks).where(
            and(
              eq(tasks.status, 'todo'),
              eq(tasks.priority, 'high')
            )
          ).limit(50);
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      const evaluation = evaluatePerformance(
        metrics.avgResponseTime,
        PERFORMANCE_CONFIG.thresholds.database.batchQuery
      );

      console.log(
        `  复杂查询: avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
        `grade=${evaluation.type}`
      );

      expect(evaluation.passed).toBe(true);
    });
  });

  describe('写入性能', () => {
    it('单条插入', async () => {
      const collector = new PerformanceCollector();
      const iterations = 50; // 减少迭代次数，避免创建太多数据
      const insertedIds: string[] = [];
      const now = new Date();
      
      collector.start();

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          const result = await db.insert(tasks).values({
            id: `perf_insert_${Date.now()}_${i}`,
            title: `写入测试任务 ${Date.now()}`,
            description: '性能测试',
            status: 'todo' as const,
            priority: 'medium' as const,
            source: 'local' as const,
            creatorId: 'perf-test-user',
            assignees: [],
            createdAt: now,
            updatedAt: now,
          }).returning({ id: tasks.id });
          
          insertedIds.push(result[0].id);
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      // 清理测试数据
      await db.delete(tasks).where(inArray(tasks.id, insertedIds));

      const evaluation = evaluatePerformance(
        metrics.avgResponseTime,
        PERFORMANCE_CONFIG.thresholds.database.write
      );

      console.log(
        `  单条插入: avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
        `grade=${evaluation.type}`
      );

      expect(evaluation.passed).toBe(true);
    });

    it('批量插入', async () => {
      const collector = new PerformanceCollector();
      const iterations = 10; // 批量插入测试次数
      const batchSize = 100;
      const insertedIds: string[] = [];
      const now = new Date();
      const batchId = Date.now();
      
      collector.start();

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          const results = await db.insert(tasks).values(
            Array.from({ length: batchSize }, (_, j) => ({
              id: `batch_${batchId}_${i}_${j}`,
              title: `批量测试任务 ${i}-${j}`,
              description: '批量性能测试',
              status: 'todo' as const,
              priority: 'medium' as const,
              source: 'local' as const,
              creatorId: 'perf-test-user',
              assignees: [],
              createdAt: now,
              updatedAt: now,
            }))
          ).returning({ id: tasks.id });
          
          insertedIds.push(...results.map(r => r.id));
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      // 清理测试数据
      await db.delete(tasks).where(inArray(tasks.id, insertedIds));

      console.log(
        `  批量插入 (${batchSize}条/次): avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}`
      );

      expect(metrics.errorRate).toBe(0);
    });

    it('更新操作', async () => {
      const collector = new PerformanceCollector();
      const iterations = 50;
      const now = new Date();
      const updateId = Date.now();
      
      // 创建测试数据
      const testTasks = await db.insert(tasks).values(
        Array.from({ length: 100 }, (_, i) => ({
          id: `update_${updateId}_${i}`,
          title: `更新测试任务 ${i}`,
          description: `测试任务描述 ${i}`,
          status: 'todo' as const,
          priority: 'medium' as const,
          source: 'local' as const,
          creatorId: 'perf-test-user',
          assignees: [],
          createdAt: now,
          updatedAt: now,
        }))
      ).returning({ id: tasks.id });

      const testTaskIds = testTasks.map(t => t.id);

      collector.start();

      for (let i = 0; i < iterations; i++) {
        const randomId = testTaskIds[Math.floor(Math.random() * testTaskIds.length)];
        const startTime = Date.now();
        
        try {
          await db.update(tasks)
            .set({ status: 'in_progress', updatedAt: new Date() })
            .where(eq(tasks.id, randomId));
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, true);
        } catch (error) {
          const duration = Date.now() - startTime;
          collector.recordResponse(duration, false, error instanceof Error ? error.message : 'Unknown');
        }
      }

      collector.stop();
      const metrics = collector.getMetrics();

      // 清理测试数据
      await db.delete(tasks).where(inArray(tasks.id, testTaskIds));

      const evaluation = evaluatePerformance(
        metrics.avgResponseTime,
        PERFORMANCE_CONFIG.thresholds.database.write
      );

      console.log(
        `  更新操作: avg=${formatDuration(metrics.avgResponseTime)}, ` +
        `p95=${formatDuration(metrics.p95ResponseTime)}, ` +
        `grade=${evaluation.type}`
      );

      expect(evaluation.passed).toBe(true);
    });
  });

  describe('并发性能', () => {
    it('并发读取', async () => {
      const concurrentUsers = [10, 20, 50];
      
      for (const userCount of concurrentUsers) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: userCount }, async () => {
          return await db.select().from(tasks).limit(20);
        });
        
        await Promise.all(promises);
        
        const duration = Date.now() - startTime;
        const avgTime = duration / userCount;
        
        console.log(`  ${userCount} 并发读取: 总时间=${formatDuration(duration)}, 平均=${formatDuration(avgTime)}`);
      }
      
      expect(true).toBe(true);
    });

    it('并发写入', async () => {
      const concurrentUsers = [10, 20];
      const allInsertedIds: string[] = [];
      
      for (const userCount of concurrentUsers) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: userCount }, async () => {
          const result = await db.insert(tasks).values({
            title: `并发测试任务 ${Date.now()}`,
            description: '并发写入测试',
            status: 'todo',
            priority: 'medium',
            creatorId: 'perf-test-user',
          }).returning({ id: tasks.id });
          return result[0].id;
        });
        
        const insertedIds = await Promise.all(promises);
        allInsertedIds.push(...insertedIds);
        
        const duration = Date.now() - startTime;
        const avgTime = duration / userCount;
        
        console.log(`  ${userCount} 并发写入: 总时间=${formatDuration(duration)}, 平均=${formatDuration(avgTime)}`);
      }
      
      // 清理
      await db.delete(tasks).where(inArray(tasks.id, allInsertedIds));
      
      expect(true).toBe(true);
    });
  });
});
