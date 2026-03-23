/**
 * MCP Handler: 任务操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 60%
 */

import { db } from '@/db';
import { tasks, comments, taskLogs, members, projects, milestones, documents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateLogId, generateCommentId, generateCheckItemId, generateTaskId } from '@/lib/id';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { eventBus } from '@/lib/event-bus';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Task, CheckItem } from '@/db/schema';

/** 获取 TeamClaw 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建任务访问链接 */
function buildTaskUrl(taskId: string): string {
  return `${getBaseUrl()}/tasks?task=${taskId}`;
}

/** 任务列表查询参数 */
interface ListMyTasksParams {
  member_id?: string;
  member_name?: string;
  status?: 'todo' | 'in_progress' | 'reviewing' | 'completed' | 'all';
  project_id?: string;
  limit?: number;
  detail?: boolean; // 渐进式上下文：是否返回完整详情
}

/**
 * Task Handler - 继承 McpHandlerBase 基类
 */
class TaskHandler extends McpHandlerBase<Task> {
  constructor() {
    super('Task', 'task_update');
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
        return this.handleGetTask(params);
      case 'create':
        return this.handleCreateTask(params);
      case 'update_status':
        return this.handleUpdateTaskStatus(params);
      case 'add_comment':
        return this.handleAddTaskComment(params);
      case 'create_check_item':
        return this.handleCreateCheckItem(params);
      case 'complete_check_item':
        return this.handleCompleteCheckItem(params);
      case 'list_my_tasks':
        return this.handleListMyTasks(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 创建任务
   * 
   * AI 可以通过对话信道创建任务，分配给人类或其他 AI
   */
  private async handleCreateTask(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'title');
    if (validation) return validation;

    const {
      title,
      description,
      project_id,
      assignees,
      priority = 'medium',
      deadline,
      milestone,
      member_id,
    } = params as {
      title: string;
      description?: string;
      project_id?: string;
      assignees?: string[];
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      deadline?: string;
      milestone?: string;
      member_id?: string;
    };

    // 验证 priority 枚举值并映射到数据库支持的值
    const priorityValidation = this.validateEnum(priority, 
      ['low', 'medium', 'high', 'urgent'] as const, 
      'priority'
    );
    if (priorityValidation) return priorityValidation;

    // 映射 priority：urgent -> high（数据库不支持 urgent）
    const dbPriority: 'low' | 'medium' | 'high' = priority === 'urgent' ? 'high' : (priority || 'medium');

    // 创建任务
    const taskId = generateTaskId();
    const newTask = {
      id: taskId,
      title,
      description: description || null,
      projectId: project_id || null,
      source: 'local' as const,
      assignees: assignees || (member_id ? [member_id] : []),
      creatorId: member_id || 'ai-agent',
      status: 'todo' as const,
      progress: 0,
      priority: dbPriority,
      deadline: deadline ? new Date(deadline) : null,
      checkItems: [],
      attachments: [],
      parentTaskId: null,
      crossProjects: [],
      sopTemplateId: null,
      currentStageId: null,
      stageHistory: [],
      sopInputs: null,
      milestoneId: milestone || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(tasks).values(newTask);
    
    // 发射事件刷新前端
    this.emitUpdate(taskId);
    triggerMarkdownSync('teamclaw:tasks');
    
    this.log('Task created', taskId, { title, assignees });

    return this.success('Task created', {
      id: taskId,
      title,
      status: 'todo',
      priority,
      assignees: newTask.assignees,
      url: buildTaskUrl(taskId),
    });
  }

  /**
   * 获取任务详情
   * 
   * 渐进式上下文设计：
   * - detail=false（默认）：返回 L1 索引（精简数据）
   * - detail=true：返回 L2 完整详情
   */
  private async handleGetTask(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id');
    if (validation) return validation;

    const { task_id, detail = false } = params as { task_id: string; detail?: boolean };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        // L1 索引：精简数据，节省上下文
        if (!detail) {
          return this.success('Task index retrieved', {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            projectId: task.projectId,
            deadline: task.deadline,
            assignees: task.assignees,
            url: buildTaskUrl(task.id),
          });
        }
        
        // L2 详情：完整数据
        return this.success('Task detail retrieved', {
          ...task,
          url: buildTaskUrl(task.id),
        });
      }
    );
  }

  /**
   * 更新任务状态
   */
  private async handleUpdateTaskStatus(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'status');
    if (validation) return validation;

    const { task_id, status, progress, message } = params as {
      task_id: string;
      status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
      progress?: number;
      message?: string;
    };

    // 验证 status 枚举值
    const statusValidation = this.validateEnum(status,
      ['todo', 'in_progress', 'reviewing', 'completed'] as const,
      'status'
    );
    if (statusValidation) return statusValidation;

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
        if (progress !== undefined) {
          updateData.progress = progress;
        }
        await db.update(tasks).set(updateData).where(eq(tasks.id, task_id));

        // 添加日志
        if (message) {
          await db.insert(taskLogs).values({
            id: generateLogId(),
            taskId: task_id,
            action: `status_change:${status}`,
            message,
            timestamp: new Date(),
          });
        }

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Status updated', task_id, { status, progress });

        // v1.0.1: 任务完成时，增强知识结晶提示
        let v1_0_1_hint = null;
        if (status === 'completed') {
          v1_0_1_hint = await this.buildV101KnowledgeHint(task);
        }

        return this.success('Status updated', {
          task_id,
          status,
          progress,
          message,
          ...(v1_0_1_hint && { _v1_0_1_hint: v1_0_1_hint }),
        });
      }
    );
  }

  /**
   * 构建知识结晶提示 - 复用现有知识库机制
   * 当任务完成时，提示 Agent 将经验沉淀到项目/里程碑知识库
   */
  private async buildV101KnowledgeHint(task: Task): Promise<Record<string, unknown> | null> {
    const hints: string[] = [];
    const targets: Array<{ type: 'project' | 'milestone'; name: string; docId: string }> = [];

    // 检查项目知识库
    if (task.projectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
      if (project?.knowledgeConfig?.documentId) {
        const [doc] = await db.select().from(documents).where(eq(documents.id, project.knowledgeConfig.documentId));
        if (doc) {
          targets.push({ type: 'project', name: project.name, docId: doc.id });
          hints.push(`项目「${project.name}」知识库: document_id="${doc.id}"`);
        }
      }
    }

    // 检查里程碑知识库
    if (task.milestoneId) {
      const [milestone] = await db.select().from(milestones).where(eq(milestones.id, task.milestoneId));
      if (milestone?.knowledgeConfig?.documentId) {
        const [doc] = await db.select().from(documents).where(eq(documents.id, milestone.knowledgeConfig.documentId));
        if (doc) {
          targets.push({ type: 'milestone', name: milestone.title, docId: doc.id });
          hints.push(`里程碑「${milestone.title}」知识库: document_id="${doc.id}"`);
        }
      }
    }

    if (targets.length === 0) return null;

    return {
      message: '💡 任务已完成！执行过程中遇到的坑点、解决方案、关键决策，建议沉淀到知识库 L4 层（经验记录）供后续任务参考。',
      why: '知识库采用分层设计：L1 核心规则（推送时自动植入）、L2 详细标准、L3 案例库、L4 经验记录（动态增长）、L5 维护日志。将经验写入 L4，后续执行类似任务的 AI 可以读取这些经验避免重复踩坑。',
      instruction: '使用 update_knowledge 工具，将经验追加到对应知识库的 L4 层',
      available_targets: targets,
      hint_text: hints.join('\n'),
      example: `// 将本次任务的经验沉淀到知识库
{"actions": [{"type": "update_knowledge", "document_id": "${targets[0]?.docId}", "content": "踩坑点：xxx\\n解决方案：yyy\\n关键决策：zzz"}]}`,
      tips: [
        '经验要简洁，聚焦「坑点 + 解决方案」',
        '如果有多个经验，可以多次调用 update_knowledge',
        'L4 层会动态增长，定期由人类整理归档到 L2/L3',
      ],
    };
  }

  /**
   * 添加任务评论
   */
  private async handleAddTaskComment(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'content');
    if (validation) return validation;

    const { task_id, content, member_id } = params as { 
      task_id: string; 
      content: string; 
      member_id?: string;
    };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        // 优先使用调用方提供的 member_id，否则回退到 'ai-agent'
        const commentMemberId = member_id || 'ai-agent';
        const comment = {
          id: generateCommentId(),
          taskId: task_id,
          memberId: commentMemberId,
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.insert(comments).values(comment);

        // 发射 task_update 事件（刷新任务列表）
        this.emitUpdate(task_id);
        // 发射 comment_update 事件（刷新评论列表）
        eventBus.emit({
          type: 'comment_update',
          resourceId: comment.id,
          data: { taskId: task_id },
        });
        this.log('Comment added', task_id);

        return this.success('Comment added', { comment });
      }
    );
  }

  /**
   * 创建检查项
   */
  private async handleCreateCheckItem(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'text');
    if (validation) return validation;

    const { task_id, text } = params as { task_id: string; text: string };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const newItem: CheckItem = { 
          id: generateCheckItemId(), 
          text, 
          completed: false,
          source: 'manual'
        };
        const checkItems = task.checkItems || [];
        await db.update(tasks).set({
          checkItems: [...checkItems, newItem],
          updatedAt: new Date()
        }).where(eq(tasks.id, task_id));

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Check item created', task_id, { itemId: newItem.id });

        return this.success('Check item created', { item: newItem });
      }
    );
  }

  /**
   * 完成检查项
   */
  private async handleCompleteCheckItem(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'item_id');
    if (validation) return validation;

    const { task_id, item_id } = params as { task_id: string; item_id: string };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const checkItems = task.checkItems || [];
        const itemExists = checkItems.some(item => item.id === item_id);
        
        if (!itemExists) {
          return this.failure(`Check item not found: ${item_id}`);
        }

        const updatedItems = checkItems.map(item =>
          item.id === item_id ? { ...item, completed: true } : item
        );
        await db.update(tasks).set({
          checkItems: updatedItems,
          updatedAt: new Date()
        }).where(eq(tasks.id, task_id));

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Check item completed', task_id, { itemId: item_id });

        return this.success('Check item completed', { item_id });
      }
    );
  }

  /**
   * 获取分配给当前成员的任务列表
   * 
   * 渐进式上下文设计：
   * - detail=false（默认）：返回 L1 索引（精简数据）
   * - detail=true：返回 L2 完整详情
   */
  private async handleListMyTasks(params: Record<string, unknown>): Promise<HandlerResult> {
    const { member_id, member_name, status, project_id, limit = 20, detail = false } = params as ListMyTasksParams;

    // 解析成员身份：优先 member_id，其次 member_name（按昵称查找）
    let resolvedMemberId = member_id;
    if (!resolvedMemberId && member_name) {
      const allMembers = await db.select({ id: members.id, name: members.name })
        .from(members);
      const matched = allMembers.find(m => m.name === member_name);
      if (matched) {
        resolvedMemberId = matched.id;
      } else {
        return this.failure(`Member "${member_name}" not found`);
      }
    }

    try {
      // 获取所有任务后在内存中过滤（因为 assignees 是 JSON 数组）
      const allTasks = await db.select().from(tasks);

      let filteredTasks = allTasks;

      // 按成员过滤（如果提供了 member_id 或 member_name 解析结果）
      if (resolvedMemberId) {
        filteredTasks = filteredTasks.filter(t => {
          const assignees = t.assignees || [];
          return assignees.includes(resolvedMemberId!);
        });
      }

      // 按状态过滤
      if (status && status !== 'all') {
        const statusValidation = this.validateEnum(status,
          ['todo', 'in_progress', 'reviewing', 'completed'] as const,
          'status'
        );
        if (statusValidation) return statusValidation;
        filteredTasks = filteredTasks.filter(t => t.status === status);
      }

      // 按项目过滤
      if (project_id) {
        filteredTasks = filteredTasks.filter(t => t.projectId === project_id);
      }

      // 排序：优先级高的在前，同优先级按创建时间排序
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filteredTasks.sort((a, b) => {
        const pa = priorityOrder[a.priority || 'medium'] ?? 1;
        const pb = priorityOrder[b.priority || 'medium'] ?? 1;
        if (pa !== pb) return pa - pb;
        return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      });

      // 限制返回数量
      const limitedTasks = filteredTasks.slice(0, limit as number);

      // 格式化返回数据（根据 detail 参数分层）
      const result = limitedTasks.map(t => {
        // L1 索引：精简数据
        const l1Data = {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          projectId: t.projectId,
          deadline: t.deadline,
          url: buildTaskUrl(t.id),
        };
        
        // L2 详情：完整数据
        if (detail) {
          return {
            ...l1Data,
            description: t.description,
            assignees: t.assignees,
            checkItems: t.checkItems,
            progress: t.progress,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          };
        }
        
        return l1Data;
      });

      this.log('Listed tasks', undefined, { 
        total: filteredTasks.length, 
        returned: result.length,
        memberId: resolvedMemberId 
      });

      return this.success('Tasks retrieved', {
        tasks: result,
        total: filteredTasks.length,
        returned: result.length,
      });
    } catch (error) {
      this.logError('List tasks', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to list tasks', message);
    }
  }
}

// 导出单例
export const taskHandler = new TaskHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleGetTask(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'get' }, {});
}

export async function handleUpdateTaskStatus(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'update_status' }, {});
}

export async function handleAddTaskComment(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'add_comment' }, {});
}

export async function handleCreateCheckItem(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'create_check_item' }, {});
}

export async function handleCompleteCheckItem(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'complete_check_item' }, {});
}

export async function handleListMyTasks(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'list_my_tasks' }, {});
}

export async function handleCreateTask(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'create' }, {});
}
