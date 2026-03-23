/**
 * MCP Handler: 里程碑操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 55%
 */

import { db } from '@/db';
import { milestones, tasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateMilestoneId } from '@/lib/id';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Milestone } from '@/db/schema';

/**
 * Milestone Handler - 继承 McpHandlerBase 基类
 */
class MilestoneHandler extends McpHandlerBase<Milestone> {
  constructor() {
    super('Milestone', 'milestone_update');
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
        return this.handleCreateMilestone(params);
      case 'list':
        return this.handleListMilestones(params);
      case 'update':
        return this.handleUpdateMilestone(params);
      case 'delete':
        return this.handleDeleteMilestone(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 创建里程碑
   */
  private async handleCreateMilestone(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'title', 'project_id');
    if (validation) return validation;

    const { title, description, project_id, status, due_date, sort_order } = params as {
      title: string;
      description?: string;
      project_id: string;
      status?: string;
      due_date?: string;
      sort_order?: number;
    };

    const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'] as const;
    const validStatus = validStatuses.includes(status as typeof validStatuses[number]) 
      ? status as typeof validStatuses[number] 
      : 'open';

    const now = new Date();
    const id = generateMilestoneId();

    try {
      await db.insert(milestones).values({
        id,
        title: title.trim(),
        description: description || null,
        projectId: project_id,
        status: validStatus,
        dueDate: due_date ? new Date(due_date) : null,
        sortOrder: typeof sort_order === 'number' ? sort_order : 0,
        createdAt: now,
        updatedAt: now,
      });

      const [created] = await db.select().from(milestones).where(eq(milestones.id, id));
      this.emitUpdate(id);
      this.log('Created', id);

      return this.success(`Milestone "${title}" created`, {
        id,
        title: created?.title || title,
        project_id,
        status: validStatus,
      });
    } catch (error) {
      this.logError('Create', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to create milestone', message);
    }
  }

  /**
   * 列出里程碑
   */
  private async handleListMilestones(params: Record<string, unknown>): Promise<HandlerResult> {
    const { project_id } = params as { project_id?: string };

    try {
      let results;
      if (project_id) {
        results = await db.select().from(milestones)
          .where(eq(milestones.projectId, project_id))
          .orderBy(milestones.sortOrder);
      } else {
        results = await db.select().from(milestones).orderBy(milestones.sortOrder);
      }

      const milestoneList = results.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        project_id: m.projectId,
        status: m.status,
        due_date: m.dueDate?.toISOString(),
        sort_order: m.sortOrder,
        created_at: m.createdAt?.toISOString(),
      }));

      return this.success('Milestones retrieved', {
        total: milestoneList.length,
        milestones: milestoneList,
      });
    } catch (error) {
      this.logError('List', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to query milestone list', message);
    }
  }

  /**
   * 更新里程碑
   */
  private async handleUpdateMilestone(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'milestone_id');
    if (validation) return validation;

    const { milestone_id, title, description, status, due_date, sort_order } = params as {
      milestone_id: string;
      title?: string;
      description?: string;
      status?: string;
      due_date?: string;
      sort_order?: number;
    };

    // 验证状态值
    if (status) {
      const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'] as const;
      if (!validStatuses.includes(status as typeof validStatuses[number])) {
        return this.failure(`status must be one of ${validStatuses.join('/')}`);
      }
    }

    return this.withResource(
      milestone_id,
      async (id) => {
        const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
        return existing || null;
      },
      async (existing) => {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (due_date !== undefined) updateData.dueDate = due_date ? new Date(due_date) : null;
        if (sort_order !== undefined) updateData.sortOrder = sort_order;

        await db.update(milestones).set(updateData).where(eq(milestones.id, milestone_id));
        this.emitUpdate(milestone_id);
        this.log('Updated', milestone_id);

        return this.success('Milestone updated', { milestone_id });
      }
    );
  }

  /**
   * 删除里程碑
   */
  private async handleDeleteMilestone(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'milestone_id');
    if (validation) return validation;

    const { milestone_id } = params as { milestone_id: string };

    return this.withResource(
      milestone_id,
      async (id) => {
        const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
        return existing || null;
      },
      async (existing) => {
        // 解除关联任务 + 删除里程碑
        await db.transaction((tx) => {
          tx.update(tasks)
            .set({ milestoneId: null, updatedAt: new Date() })
            .where(eq(tasks.milestoneId, milestone_id)).run();
          tx.delete(milestones).where(eq(milestones.id, milestone_id)).run();
        });

        this.emitUpdate(milestone_id);
        this.log('Deleted', milestone_id);

        return this.success(`Milestone "${existing.title}" deleted`, { milestone_id });
      }
    );
  }
}

// 导出单例
export const milestoneHandler = new MilestoneHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleCreateMilestone(params: Record<string, unknown>) {
  return milestoneHandler.execute({ ...params, action: 'create' }, {});
}

export async function handleListMilestones(params: Record<string, unknown>) {
  return milestoneHandler.execute({ ...params, action: 'list' }, {});
}

export async function handleUpdateMilestone(params: Record<string, unknown>) {
  return milestoneHandler.execute({ ...params, action: 'update' }, {});
}

export async function handleDeleteMilestone(params: Record<string, unknown>) {
  return milestoneHandler.execute({ ...params, action: 'delete' }, {});
}

// 默认导出
export default milestoneHandler;
