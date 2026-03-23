/**
 * MCP Handler: OpenClaw 状态操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 50%
 */

import { db } from '@/db';
import { openclawStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateStatusId } from '@/lib/id';
import { resolveAIMemberId } from '@/core/member-resolver';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { OpenClawStatus } from '@/db/schema';

/**
 * Status Handler - 继承 McpHandlerBase 基类
 */
class StatusHandler extends McpHandlerBase<OpenClawStatus> {
  constructor() {
    super('Status', 'openclaw_status');
  }

  /**
   * 主入口 - 调度各个具体处理方法
   */
  async execute(
    params: Record<string, unknown>,
    _context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string;

    switch (action) {
      case 'update':
        return this.handleUpdateStatus(params);
      case 'set_queue':
        return this.handleSetQueue(params);
      case 'set_do_not_disturb':
        return this.handleSetDoNotDisturb(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 更新状态
   */
  private async handleUpdateStatus(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'status');
    if (validation) return validation;

    const { member_id, status, current_action, task_id, progress } = params as {
      member_id?: string;
      status: 'idle' | 'working' | 'waiting' | 'offline';
      current_action?: string;
      task_id?: string;
      progress?: number;
    };

    // 验证状态枚举值
    const validStatuses = ['idle', 'working', 'waiting', 'offline'] as const;
    const statusValidation = this.validateEnum(status, validStatuses, 'status');
    if (statusValidation) return statusValidation;

    // 解析成员 ID
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    try {
      const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
      const now = new Date();

      if (existing) {
        const updateData: Record<string, unknown> = { 
          status, 
          updatedAt: now, 
          lastHeartbeat: now 
        };
        if (current_action !== undefined) updateData.currentAction = current_action;
        if (task_id !== undefined) updateData.currentTaskId = task_id;
        if (progress !== undefined) updateData.progress = progress;
        await db.update(openclawStatus).set(updateData).where(eq(openclawStatus.id, existing.id));
      } else {
        await db.insert(openclawStatus).values({
          id: generateStatusId(),
          memberId: targetMemberId,
          status,
          currentAction: current_action || null,
          currentTaskId: task_id || null,
          progress: progress ?? 0,
          interruptible: true,
          createdAt: now,
          updatedAt: now,
          lastHeartbeat: now,
        });
      }

      this.emitUpdate(targetMemberId);
      this.log('Status updated', targetMemberId, { status, progress });

      return this.success('Status updated', { 
        member_id: targetMemberId, 
        status 
      });
    } catch (error) {
      this.logError('Update status', error, targetMemberId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to update status', message);
    }
  }

  /**
   * 设置任务队列
   */
  private async handleSetQueue(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'queued_tasks');
    if (validation) return validation;

    const { member_id, queued_tasks } = params as {
      member_id?: string;
      queued_tasks: Array<{ id: string; title: string }>;
    };

    // 解析成员 ID
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    try {
      const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
      const now = new Date();

      if (existing) {
        await db.update(openclawStatus)
          .set({ queuedTasks: queued_tasks, updatedAt: now })
          .where(eq(openclawStatus.id, existing.id));
      } else {
        await db.insert(openclawStatus).values({
          id: generateStatusId(),
          memberId: targetMemberId,
          status: 'idle',
          queuedTasks: queued_tasks,
          interruptible: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      this.emitUpdate(targetMemberId);
      this.log('Queue set', targetMemberId, { taskCount: queued_tasks.length });

      return this.success(`Task queue set (${queued_tasks.length} tasks)`, {
        member_id: targetMemberId,
        task_count: queued_tasks.length,
      });
    } catch (error) {
      this.logError('Set queue', error, targetMemberId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to set queue', message);
    }
  }

  /**
   * 设置勿扰模式
   */
  private async handleSetDoNotDisturb(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'interruptible');
    if (validation) return validation;

    const { member_id, interruptible, reason } = params as {
      member_id?: string;
      interruptible: boolean;
      reason?: string;
    };

    // 解析成员 ID
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    try {
      const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
      const now = new Date();

      if (existing) {
        await db.update(openclawStatus).set({
          interruptible,
          doNotDisturbReason: reason || null,
          updatedAt: now,
        }).where(eq(openclawStatus.id, existing.id));
      } else {
        await db.insert(openclawStatus).values({
          id: generateStatusId(),
          memberId: targetMemberId,
          status: 'idle',
          interruptible,
          doNotDisturbReason: reason || null,
          createdAt: now,
          updatedAt: now,
        });
      }

      this.emitUpdate(targetMemberId);
      this.log('Do not disturb set', targetMemberId, { interruptible, reason });

      const message = interruptible 
        ? 'Do not disturb mode disabled' 
        : `Do not disturb mode enabled: ${reason || 'performing critical operation'}`;

      return this.success(message, { member_id: targetMemberId, interruptible });
    } catch (error) {
      this.logError('Set do not disturb', error, targetMemberId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to set do not disturb', message);
    }
  }
}

// 导出单例
export const statusHandler = new StatusHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleUpdateStatus(params: Record<string, unknown>) {
  return statusHandler.execute({ ...params, action: 'update' }, {});
}

export async function handleSetQueue(params: Record<string, unknown>) {
  return statusHandler.execute({ ...params, action: 'set_queue' }, {});
}

export async function handleSetDoNotDisturb(params: Record<string, unknown>) {
  return statusHandler.execute({ ...params, action: 'set_do_not_disturb' }, {});
}

// 默认导出
export default statusHandler;
