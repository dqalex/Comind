/**
 * 对话信道 - 消息队列模块
 *
 * 功能：
 * - 消息入队和出队
 * - 按 sessionKey 分组处理
 * - 自动重试机制
 * - 降级方案（Redis 不可用时使用内存队列）
 *
 * @module lib/chat-channel/queue
 */

import type { Action } from './types';
import { executeActions } from './executor';
import { getLogger, generateRequestId } from './logger';
import { eventBus } from '@/lib/event-bus';

const logger = getLogger();

/** 队列配置 */
export interface QueueConfig {
  /** Redis URL */
  redisUrl?: string;
  /** 并发处理数 */
  concurrency: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  retryDelay: number;
  /** 任务超时（毫秒） */
  timeout: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: QueueConfig = {
  concurrency: 10,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
};

/** 队列任务 */
interface QueueJob {
  id: string;
  sessionKey: string;
  actions: Action[];
  memberId?: string;
  attempt: number;
  createdAt: number;
}

/** 队列统计 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number; // 死信队列中的任务数
}

/** 死信队列任务 */
export interface DeadLetterJob extends QueueJob {
  failedAt: number;
  error?: string;
  finalAttempt: number;
}

/**
 * 内存队列实现（Redis 不可用时降级）
 */
class MemoryQueue {
  private jobs: QueueJob[] = [];
  private processing = new Set<string>();
  private completed = 0;
  private failed = 0;
  private deadLetterJobs: DeadLetterJob[] = []; // 死信队列
  private processor?: (job: QueueJob) => Promise<void>;
  private isRunning = false;

  async add(job: QueueJob): Promise<void> {
    this.jobs.push(job);
    logger.debug(generateRequestId(), `MemoryQueue: Job added ${job.id}, queue size: ${this.jobs.length}`);
  }

  async process(processor: (job: QueueJob) => Promise<void>): Promise<void> {
    this.processor = processor;
    if (!this.isRunning) {
      this.isRunning = true;
      this.runLoop();
    }
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      const job = this.jobs.shift();
      if (!job) {
        await sleep(100);
        continue;
      }

      this.processing.add(job.id);
      try {
        await this.processor?.(job);
        this.completed++;
      } catch (err) {
        this.failed++;
        logger.error(generateRequestId(), `MemoryQueue: Job failed ${job.id}`, { error: err as Error });
      } finally {
        this.processing.delete(job.id);
      }
    }
  }

  getStats(): QueueStats {
    return {
      pending: this.jobs.length,
      processing: this.processing.size,
      completed: this.completed,
      failed: this.failed,
      deadLetter: this.deadLetterJobs.length,
    };
  }

  /**
   * 将任务移至死信队列
   */
  moveToDeadLetter(job: QueueJob, error?: string): void {
    const deadLetterJob: DeadLetterJob = {
      ...job,
      failedAt: Date.now(),
      error,
      finalAttempt: job.attempt,
    };
    this.deadLetterJobs.push(deadLetterJob);
    logger.warn(generateRequestId(), `Job moved to dead letter queue: ${job.id}`, {
      data: { attempts: job.attempt, error },
    });
  }

  /**
   * 获取死信队列中的任务
   */
  getDeadLetterJobs(): DeadLetterJob[] {
    return [...this.deadLetterJobs];
  }

  /**
   * 重新处理死信队列中的任务
   */
  async retryDeadLetter(jobId: string): Promise<boolean> {
    const index = this.deadLetterJobs.findIndex(j => j.id === jobId);
    if (index === -1) return false;

    const job = this.deadLetterJobs[index];
    // 重置尝试次数并重新入队
    const retryJob: QueueJob = {
      id: job.id,
      sessionKey: job.sessionKey,
      actions: job.actions,
      memberId: job.memberId,
      attempt: 0,
      createdAt: Date.now(),
    };

    this.deadLetterJobs.splice(index, 1);
    await this.add(retryJob);

    logger.info(generateRequestId(), `Dead letter job retried: ${jobId}`);
    return true;
  }

  stop(): void {
    this.isRunning = false;
  }
}

/**
 * Chat Channel 消息队列
 *
 * 负责将 Actions 任务入队并按 sessionKey 分组处理
 */
export class ChatActionQueue {
  private static instance: ChatActionQueue | null = null;

  private config: QueueConfig;
  private memoryQueue: MemoryQueue;
  private isRedisAvailable = false;

  private constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryQueue = new MemoryQueue();

    // 尝试连接 Redis，失败时使用内存队列
    this.initRedis().catch(() => {
      logger.warn(generateRequestId(), 'Redis not available, using memory queue');
      this.isRedisAvailable = false;
    });

    // 启动内存队列处理
    this.memoryQueue.process(this.processJob.bind(this));
  }

  static getInstance(config?: Partial<QueueConfig>): ChatActionQueue {
    if (!ChatActionQueue.instance) {
      ChatActionQueue.instance = new ChatActionQueue(config);
    }
    return ChatActionQueue.instance;
  }

  static reset(): void {
    if (ChatActionQueue.instance) {
      ChatActionQueue.instance.destroy();
      ChatActionQueue.instance = null;
    }
  }

  /**
   * 初始化 Redis 连接
   *
   * 注意：当前版本使用内存队列作为完整的实现方案。
   * Redis 连接为预留接口，用于未来需要持久化队列、多实例部署时的扩展。
   * 当需要 Redis 支持时，需要：
   * 1. 添加 redis 依赖 (如 ioredis 或 @redis/client)
   * 2. 实现基于 Redis 的队列存储
   * 3. 添加 Redis 连接配置
   */
  private async initRedis(): Promise<void> {
    // 当前版本：内存队列已满足需求，Redis 为未来扩展预留
    throw new Error('Redis implementation reserved for future scaling');
  }

  /**
   * 将 Actions 任务入队
   *
   * @param sessionKey 会话键
   * @param actions Actions 数组
   * @param memberId 成员 ID
   * @returns 任务 ID
   */
  async enqueue(
    sessionKey: string,
    actions: Action[],
    memberId?: string
  ): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const job: QueueJob = {
      id: jobId,
      sessionKey,
      actions,
      memberId,
      attempt: 0,
      createdAt: Date.now(),
    };

    await this.memoryQueue.add(job);

    logger.info(generateRequestId(), `Job enqueued: ${jobId}`, {
      data: {
        sessionKey,
        actionCount: actions.length,
      }
    });

    return jobId;
  }

  /**
   * 处理队列任务
   */
  private async processJob(job: QueueJob): Promise<void> {
    logger.debug(generateRequestId(), `Processing job: ${job.id}`, {
      data: {
        sessionKey: job.sessionKey,
        attempt: job.attempt,
      }
    });

    try {
      // 按 sessionKey 分组，同一会话的 Action 一起执行
      const result = await executeActions(job.actions, {
        memberId: job.memberId,
        requestId: job.id,
      });

      if (result.summary.failed > 0) {
        logger.warn(generateRequestId(), `Job partial failure: ${job.id}`, {
          data: {
            success: result.summary.success,
            failed: result.summary.failed,
          }
        });
      }

      logger.info(generateRequestId(), `Job completed: ${job.id}`);
    } catch (err) {
      logger.error(generateRequestId(), `Job failed: ${job.id}`, { error: err as Error });

      // 重试逻辑
      if (job.attempt < this.config.maxRetries) {
        job.attempt++;
        const delay = this.config.retryDelay * Math.pow(2, job.attempt - 1);

        logger.info(generateRequestId(), `Retrying job: ${job.id} (attempt ${job.attempt}/${this.config.maxRetries})`);

        await sleep(delay);
        await this.memoryQueue.add(job);
      } else {
        logger.error(generateRequestId(), `Job max retries exceeded: ${job.id}`);
        // 将任务移至死信队列，便于后续人工干预或分析
        this.memoryQueue.moveToDeadLetter(job, err instanceof Error ? err.message : String(err));

        // 发送任务失败事件，可用于通知管理员或记录监控
        this.emitJobFailedEvent(job, err instanceof Error ? err.message : String(err));
      }
    }
  }

  /**
   * 获取队列统计
   */
  getStats(): QueueStats {
    return this.memoryQueue.getStats();
  }

  /**
   * 获取死信队列中的任务列表
   */
  getDeadLetterJobs(): DeadLetterJob[] {
    return this.memoryQueue.getDeadLetterJobs();
  }

  /**
   * 重新处理死信队列中的任务
   */
  async retryDeadLetterJob(jobId: string): Promise<boolean> {
    return this.memoryQueue.retryDeadLetter(jobId);
  }

  /**
   * 销毁队列
   */
  destroy(): void {
    this.memoryQueue.stop();
    logger.info(generateRequestId(), 'ChatActionQueue destroyed');
  }

  /**
   * 发送任务失败事件
   * 可用于通知管理员或记录到监控系统
   */
  private emitJobFailedEvent(job: QueueJob, error: string): void {
    // 通过 eventBus 发送事件
    try {
      eventBus.emit({
        type: 'chat:job_failed',
        data: {
          jobId: job.id,
          sessionKey: job.sessionKey,
          memberId: job.memberId,
          error,
        },
      });
    } catch {
      // event-bus 不可用，仅记录日志
      logger.warn(generateRequestId(), 'Failed to emit job failed event: event-bus not available');
    }
  }
}

/**
 * 工具函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 全局队列实例 */
export const chatQueue = ChatActionQueue.getInstance();

/**
 * 快速入队函数
 */
export async function enqueueChatActions(
  sessionKey: string,
  actions: Action[],
  memberId?: string
): Promise<string> {
  return chatQueue.enqueue(sessionKey, actions, memberId);
}

/**
 * 批量入队（相同 sessionKey 的 Actions 合并）
 */
export async function enqueueBatchActions(
  items: Array<{ sessionKey: string; actions: Action[]; memberId?: string }>
): Promise<string[]> {
  // 按 sessionKey 分组合并
  const grouped = new Map<string, { sessionKey: string; actions: Action[]; memberId?: string }>();

  for (const item of items) {
    const existing = grouped.get(item.sessionKey);
    if (existing) {
      existing.actions.push(...item.actions);
    } else {
      grouped.set(item.sessionKey, { ...item });
    }
  }

  // 批量入队
  const jobIds: string[] = [];
  for (const item of grouped.values()) {
    const jobId = await chatQueue.enqueue(item.sessionKey, item.actions, item.memberId);
    jobIds.push(jobId);
  }

  logger.info(generateRequestId(), `Batch enqueue: ${items.length} items -> ${jobIds.length} jobs`);
  return jobIds;
}

/**
 * 获取队列统计
 */
export function getQueueStats(): QueueStats {
  return chatQueue.getStats();
}
