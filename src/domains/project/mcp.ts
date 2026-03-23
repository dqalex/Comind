/**
 * MCP Handler: 项目操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 60%
 */

import { db } from '@/db';
import { projects, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeMember } from '@/lib/sanitize';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Project } from '@/db/schema';

/**
 * Project Handler - 继承 McpHandlerBase 基类
 */
class ProjectHandler extends McpHandlerBase<Project> {
  constructor() {
    super('Project', 'project_update');
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
      case 'get':
        return this.handleGetProject(params);
      case 'get_members':
        return this.handleGetProjectMembers(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取项目详情
   */
  private async handleGetProject(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'project_id');
    if (validation) return validation;

    const { project_id } = params as { project_id: string };

    return this.withResource(
      project_id,
      async (id) => {
        const [project] = await db.select().from(projects).where(eq(projects.id, id));
        return project || null;
      },
      async (project) => this.success('Project retrieved', project)
    );
  }

  /**
   * 获取项目成员
   */
  private async handleGetProjectMembers(_params: Record<string, unknown>): Promise<HandlerResult> {
    try {
      // 当前成员不按项目分组，返回所有成员（保留参数以便后续扩展项目-成员关系）
      const allMembers = await db.select().from(members);
      return this.success('Members retrieved', allMembers.map(m => sanitizeMember(m)));
    } catch (error) {
      this.logError('Get project members', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to get project members', message);
    }
  }
}

// 导出单例
export const projectHandler = new ProjectHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleGetProject(params: Record<string, unknown>) {
  return projectHandler.execute({ ...params, action: 'get' }, {});
}

export async function handleGetProjectMembers(params: Record<string, unknown> = {}) {
  return projectHandler.execute({ ...params, action: 'get_members' }, {});
}

// 默认导出
export default projectHandler;
