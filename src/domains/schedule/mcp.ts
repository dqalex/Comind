/**
 * MCP Handler: 定时任务操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 50%
 */

import { db } from '@/db';
import { scheduledTasks, scheduledTaskHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateScheduleId } from '@/lib/id';
import { resolveAIMemberId } from '@/core/member-resolver';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { ScheduledTask } from '@/db/schema';

/** 获取 TeamClaw 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建定时任务访问链接 */
function buildScheduleUrl(scheduleId: string): string {
  return `${getBaseUrl()}/schedule?task=${scheduleId}`;
}

/**
 * Schedule Handler - 继承 McpHandlerBase 基类
 */
class ScheduleHandler extends McpHandlerBase<ScheduledTask> {
  constructor() {
    super('Schedule', 'schedule_update');
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
      case 'create':
        return this.handleCreateSchedule(params);
      case 'list':
        return this.handleListSchedules(params);
      case 'update':
        return this.handleUpdateSchedule(params);
      case 'delete':
        return this.handleDeleteSchedule(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 创建定时任务
   */
  private async handleCreateSchedule(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'title', 'task_type', 'schedule_type');
    if (validation) return validation;

    const { title, task_type, schedule_type, schedule_time, schedule_days, description, config } = params as {
      title: string;
      task_type: 'report' | 'summary' | 'backup' | 'notification' | 'custom';
      schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
      schedule_time?: string;
      schedule_days?: number[];
      description?: string;
      config?: Record<string, unknown>;
    };

    const member_id = params.member_id as string | undefined;
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    try {
      const now = new Date();
      const [hours = 0, minutes = 0] = (schedule_time || '08:00').split(':').map(Number);
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);

      const id = generateScheduleId();
      await db.insert(scheduledTasks).values({
        id,
        memberId: targetMemberId,
        title,
        description: description || null,
        taskType: task_type,
        scheduleType: schedule_type,
        scheduleTime: schedule_time || null,
        scheduleDays: schedule_days || null,
        nextRunAt: next,
        config: config || {},
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      this.emitUpdate(id);
      triggerMarkdownSync('teamclaw:schedules');
      this.log('Created', id, { title, task_type });

      return this.success(`Scheduled task "${title}" created`, {
        id,
        title,
        url: buildScheduleUrl(id),
        nextRunAt: next,
      });
    } catch (error) {
      this.logError('Create', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to create scheduled task', message);
    }
  }

  /**
   * 列出定时任务
   */
  private async handleListSchedules(params: Record<string, unknown>): Promise<HandlerResult> {
    const { member_id, enabled_only } = params as { member_id?: string; enabled_only?: boolean };

    try {
      let allTasks = await db.select().from(scheduledTasks);

      if (member_id) {
        allTasks = allTasks.filter(t => t.memberId === member_id);
      }
      if (enabled_only) {
        allTasks = allTasks.filter(t => t.enabled);
      }

      return this.success('Schedules retrieved', allTasks.map(t => ({
        id: t.id,
        title: t.title,
        taskType: t.taskType,
        scheduleType: t.scheduleType,
        scheduleTime: t.scheduleTime,
        nextRunAt: t.nextRunAt,
        enabled: t.enabled,
        url: buildScheduleUrl(t.id),
      })));
    } catch (error) {
      this.logError('List', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to list schedules', message);
    }
  }

  /**
   * 更新定时任务
   */
  private async handleUpdateSchedule(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'schedule_id');
    if (validation) return validation;

    const { schedule_id, title, schedule_time, schedule_days, enabled, description } = params as {
      schedule_id: string;
      title?: string;
      schedule_time?: string;
      schedule_days?: number[];
      enabled?: boolean;
      description?: string;
    };

    return this.withResource(
      schedule_id,
      async (id) => {
        const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
        return existing || null;
      },
      async (existing) => {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = title;
        if (schedule_time !== undefined) updateData.scheduleTime = schedule_time;
        if (schedule_days !== undefined) updateData.scheduleDays = schedule_days;
        if (enabled !== undefined) updateData.enabled = enabled;
        if (description !== undefined) updateData.description = description;

        if (schedule_time) {
          const now = new Date();
          const [hours = 0, minutes = 0] = schedule_time.split(':').map(Number);
          const next = new Date();
          next.setHours(hours, minutes, 0, 0);
          if (next <= now) next.setDate(next.getDate() + 1);
          updateData.nextRunAt = next;
        }

        await db.update(scheduledTasks).set(updateData).where(eq(scheduledTasks.id, schedule_id));

        this.emitUpdate(schedule_id);
        triggerMarkdownSync('teamclaw:schedules');
        this.log('Updated', schedule_id);

        return this.success('Scheduled task updated', { schedule_id });
      }
    );
  }

  /**
   * 删除定时任务
   */
  private async handleDeleteSchedule(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'schedule_id');
    if (validation) return validation;

    const { schedule_id } = params as { schedule_id: string };

    return this.withResource(
      schedule_id,
      async (id) => {
        const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
        return existing || null;
      },
      async () => {
        // 先删除执行历史（FK 级联）
        await db.delete(scheduledTaskHistory).where(eq(scheduledTaskHistory.scheduledTaskId, schedule_id));
        await db.delete(scheduledTasks).where(eq(scheduledTasks.id, schedule_id));

        this.emitUpdate(schedule_id);
        triggerMarkdownSync('teamclaw:schedules');
        this.log('Deleted', schedule_id);

        return this.success('Scheduled task deleted', { schedule_id });
      }
    );
  }
}

// 导出单例
export const scheduleHandler = new ScheduleHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleCreateSchedule(params: Record<string, unknown>) {
  return scheduleHandler.execute({ ...params, action: 'create' }, {});
}

export async function handleListSchedules(params: Record<string, unknown>) {
  return scheduleHandler.execute({ ...params, action: 'list' }, {});
}

export async function handleUpdateSchedule(params: Record<string, unknown>) {
  return scheduleHandler.execute({ ...params, action: 'update' }, {});
}

export async function handleDeleteSchedule(params: Record<string, unknown>) {
  return scheduleHandler.execute({ ...params, action: 'delete' }, {});
}

// 默认导出
export default scheduleHandler;
