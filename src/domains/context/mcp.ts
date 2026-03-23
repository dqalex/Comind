/**
 * 上下文获取 Handler（v3.0 Phase F 渐进式上下文）
 *
 * 提供 L2/L3 层级的上下文获取能力：
 * - get_task_detail: 获取任务完整详情
 * - get_project_detail: 获取项目完整详情
 * - get_document_detail: 获取文档完整内容
 * - get_sop_previous_output: 获取 SOP 前序产出
 * - get_sop_knowledge_layer: 获取 SOP 知识库层级
 */

import { db, tasks, projects, documents, comments, members, sopTemplates } from '@/db';
import { eq } from 'drizzle-orm';
import { McpHandlerBase, type HandlerResult } from '@/core/mcp/handler-base';
import { parseKnowHow, extractLayers } from '@/lib/knowhow-parser';

/**
 * 上下文获取 Handler
 */
export class ContextHandler extends McpHandlerBase<void> {
  constructor() {
    super('Context', 'task_update');
  }

  async execute(
    _params: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<HandlerResult> {
    // 这个 handler 不直接调用，通过子方法调用
    return this.failure('Direct execution not supported');
  }
}

const handler = new ContextHandler();

// ==================== 任务详情 ====================

export async function handleGetTaskDetail(params: Record<string, unknown>): Promise<HandlerResult> {
  const taskId = params.task_id as string;
  const include = (params.include as string[]) || [];

  if (!taskId) {
    return { success: false, message: 'Missing task_id' };
  }

  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const result: Record<string, unknown> = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      progress: task.progress || 0,
      deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
      assignees: task.assignees,
    };

    // 可选：包含评论
    if (include.includes('comments')) {
      const taskComments = await db
        .select()
        .from(comments)
        .where(eq(comments.taskId, taskId));
      result.comments = taskComments;
    }

    return { success: true, data: result, message: 'Task detail retrieved' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== 项目详情 ====================

export async function handleGetProjectDetail(params: Record<string, unknown>): Promise<HandlerResult> {
  const projectId = params.project_id as string;
  const include = (params.include as string[]) || [];

  if (!projectId) {
    return { success: false, message: 'Missing project_id' };
  }

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return { success: false, message: 'Project not found' };
    }

    const result: Record<string, unknown> = {
      id: project.id,
      name: project.name,
      description: project.description,
      source: project.source,
      ownerId: project.ownerId,
      visibility: project.visibility,
      createdAt: project.createdAt?.toISOString(),
      updatedAt: project.updatedAt?.toISOString(),
    };

    // 获取项目任务
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

    // 任务统计
    result.taskSummary = {
      total: projectTasks.length,
      todo: projectTasks.filter(t => t.status === 'todo').length,
      in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
      reviewing: projectTasks.filter(t => t.status === 'reviewing').length,
      completed: projectTasks.filter(t => t.status === 'completed').length,
    };

    // 可选：包含成员
    if (include.includes('members')) {
      const allMembers = await db.select().from(members);
      const assigneeIds = new Set(projectTasks.flatMap(t => t.assignees as string[] || []));
      result.members = allMembers
        .filter(m => assigneeIds.has(m.id))
        .map(m => ({ id: m.id, name: m.name, type: m.type }));
    }

    // 可选：包含任务列表
    if (include.includes('tasks')) {
      result.tasks = projectTasks.slice(0, 50).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      }));
    }

    // 可选：包含文档
    if (include.includes('documents')) {
      const projectDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));
      result.documents = projectDocs.slice(0, 20).map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
      }));
    }

    return { success: true, data: result, message: 'Project detail retrieved' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== 文档详情 ====================

export async function handleGetDocumentDetail(params: Record<string, unknown>): Promise<HandlerResult> {
  const documentId = params.document_id as string;
  const title = params.title as string;

  try {
    let doc;
    if (documentId) {
      [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    } else if (title) {
      [doc] = await db.select().from(documents).where(eq(documents.title, title));
    }

    if (!doc) {
      return { success: false, message: 'Document not found' };
    }

    return {
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        type: doc.type,
        projectId: doc.projectId,
        createdAt: doc.createdAt?.toISOString(),
        updatedAt: doc.updatedAt?.toISOString(),
      },
      message: 'Document detail retrieved',
    };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== SOP 前序产出 ====================

export async function handleGetSopPreviousOutput(params: Record<string, unknown>): Promise<HandlerResult> {
  const taskId = params.task_id as string;
  const stageId = params.stage_id as string;

  if (!taskId) {
    return { success: false, message: 'Missing task_id' };
  }

  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task || !task.sopTemplateId) {
      return { success: false, message: 'Task not found or not a SOP task' };
    }

    const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, task.sopTemplateId));
    if (!template) {
      return { success: false, message: 'SOP template not found' };
    }

    const stages = (template.stages || []) as Array<{ id: string; label: string }>;
    const stageHistory = (task.stageHistory || []) as Array<{ stageId: string; status: string; output?: string }>;

    const outputs: Array<{ stageId: string; stageLabel: string; output: string }> = [];

    // 如果指定了 stageId，只返回该阶段的产出
    const targetStageId = stageId || task.currentStageId;

    for (const stage of stages) {
      // 如果已经到了目标阶段，停止
      if (stage.id === targetStageId) break;

      const record = stageHistory.find(r => r.stageId === stage.id);
      if (record?.output) {
        outputs.push({
          stageId: stage.id,
          stageLabel: stage.label,
          output: record.output,
        });
      }
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        templateName: template.name,
        outputs,
        count: outputs.length,
      },
      message: 'SOP previous outputs retrieved',
    };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== SOP 知识库层级 ====================

export async function handleGetSopKnowledgeLayer(params: Record<string, unknown>): Promise<HandlerResult> {
  const taskId = params.task_id as string;
  const layer = (params.layer as 'L1' | 'L2' | 'L3' | 'L4' | 'L5') || 'L1';

  if (!taskId) {
    return { success: false, message: 'Missing task_id' };
  }

  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task || !task.sopTemplateId) {
      return { success: false, message: 'Task not found or not a SOP task' };
    }

    const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, task.sopTemplateId));
    if (!template || !template.knowledgeConfig) {
      return { success: false, message: 'No knowledge config found' };
    }

    const config = template.knowledgeConfig as { documentId?: string };
    if (!config.documentId) {
      return { success: false, message: 'No knowledge document configured' };
    }

    const [knowDoc] = await db.select().from(documents).where(eq(documents.id, config.documentId));
    if (!knowDoc?.content || typeof knowDoc.content !== 'string') {
      return { success: false, message: 'Knowledge document content not found' };
    }

    const parsed = parseKnowHow(knowDoc.content);
    const content = extractLayers(parsed, [layer]);

    return {
      success: true,
      data: {
        taskId: task.id,
        layer,
        content,
        documentId: config.documentId,
        documentTitle: knowDoc.title,
      },
      message: 'SOP knowledge layer retrieved',
    };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export default handler;
