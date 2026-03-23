/**
 * 上下文请求 API
 * 
 * 处理 Agent 通过对话信道发送的上下文请求
 * 格式：请求上下文: - 类型: xxx - 参数: {}
 * 
 * 支持的上下文类型：
 * - task_detail: 获取任务完整详情
 * - task_comments: 获取任务评论
 * - project_detail: 获取项目详情
 * - document_content: 获取文档内容
 * - sop_previous_output: 获取 SOP 前序产出
 * - sop_knowledge_layer: 获取 SOP 知识库层级
 */
import { db } from '@/db';
import { tasks, projects, members, documents, sopTemplates, comments } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/with-auth';
import { 
  type ContextRequest, 
  type ContextType,
  generateTaskDetail,
  initContextDir,
} from '@/lib/workspace/service';
import { parseKnowHow, extractLayers } from '@/lib/knowhow-parser';
import { parseContextRequest } from '@/lib/context-request-parser';

// ============================================================================
// Handler
// ============================================================================

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body as { message: string; sessionId?: string };
    
    if (!message) {
      return NextResponse.json({ error: 'Missing required field: message' }, { status: 400 });
    }
    
    // 解析请求
    const requests = parseContextRequest(message);
    
    if (requests.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid context request found in message',
        hint: 'Expected format: 请求上下文:\\n- 类型: xxx\\n- 参数: {}',
      }, { status: 400 });
    }
    
    // 处理每个请求
    const responses: Array<{ type: ContextType; success: boolean; data?: unknown; error?: string }> = [];
    
    for (const req of requests) {
      const result = await handleContextRequest(req, sessionId);
      responses.push(result);
    }
    
    return NextResponse.json({
      type: 'context_response',
      responses,
    });
  } catch (error) {
    console.error('[context-request]', error);
    return NextResponse.json({ error: 'Context request failed' }, { status: 500 });
  }
}

/**
 * 处理单个上下文请求
 */
async function handleContextRequest(
  request: ContextRequest,
  _sessionId?: string
): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  try {
    switch (request.type) {
      case 'task_detail':
        return await handleTaskDetail(request.params);
      
      case 'task_comments':
        return await handleTaskComments(request.params);
      
      case 'project_detail':
        return await handleProjectDetail(request.params);
      
      case 'document_content':
        return await handleDocumentContent(request.params);
      
      case 'sop_previous_output':
        return await handleSOPPreviousOutput(request.params);
      
      case 'sop_knowledge_layer':
        return await handleSOPKnowledgeLayer(request.params);
      
      default:
        return {
          type: request.type,
          success: false,
          error: `Unknown context type: ${request.type}`,
        };
    }
  } catch (error) {
    return {
      type: request.type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Context Handlers
// ============================================================================

async function handleTaskDetail(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const taskId = params.task_id;
  if (!taskId) {
    return { type: 'task_detail', success: false, error: 'Missing task_id' };
  }
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    return { type: 'task_detail', success: false, error: 'Task not found' };
  }
  
  // 获取评论
  const taskComments = await db.select().from(comments).where(eq(comments.taskId, task.id));
  const allMembers = await db.select().from(members);
  
  const formattedComments = taskComments.map(c => {
    const author = allMembers.find(m => m.id === c.memberId)?.name || '未知';
    return {
      author,
      content: c.content,
      createdAt: c.createdAt ? new Date(c.createdAt).toLocaleString('zh-CN') : '',
    };
  });
  
  // 尝试生成 L2 详情文件
  try {
    await initContextDir();
    await generateTaskDetail({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? (typeof task.deadline === 'number' ? task.deadline : new Date(task.deadline).getTime()) : null,
      assignees: task.assignees as string[] | null,
      checkItems: task.checkItems,
    }, formattedComments);
  } catch (e) {
    console.warn('[context-request] Failed to generate task detail file:', e);
  }
  
  // 返回 L2 详情数据
  const checkItems = (task.checkItems as Array<{ text: string; completed: boolean }>) || [];
  
  return {
    type: 'task_detail',
    success: true,
    data: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      progress: task.progress || 0,
      deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
      assignees: (task.assignees as string[] || []).map(id => {
        const m = allMembers.find(m => m.id === id);
        return m?.name || id;
      }),
      checkItems,
      comments: formattedComments,
    },
  };
}

async function handleTaskComments(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const taskId = params.task_id;
  if (!taskId) {
    return { type: 'task_comments', success: false, error: 'Missing task_id' };
  }
  
  const taskComments = await db.select().from(comments).where(eq(comments.taskId, taskId));
  const allMembers = await db.select().from(members);
  
  const formattedComments = taskComments.map(c => {
    const author = allMembers.find(m => m.id === c.memberId)?.name || '未知';
    return {
      id: c.id,
      author,
      content: c.content,
      createdAt: c.createdAt ? new Date(c.createdAt).toLocaleString('zh-CN') : '',
    };
  });
  
  return {
    type: 'task_comments',
    success: true,
    data: { comments: formattedComments, total: formattedComments.length },
  };
}

async function handleProjectDetail(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const projectId = params.project_id;
  if (!projectId) {
    return { type: 'project_detail', success: false, error: 'Missing project_id' };
  }
  
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    return { type: 'project_detail', success: false, error: 'Project not found' };
  }
  
  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const allMembers = await db.select().from(members);
  
  const taskSummary = {
    total: projectTasks.length,
    todo: projectTasks.filter(t => t.status === 'todo').length,
    in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
    reviewing: projectTasks.filter(t => t.status === 'reviewing').length,
    completed: projectTasks.filter(t => t.status === 'completed').length,
  };
  
  const assigneeIds = new Set(projectTasks.flatMap(t => t.assignees as string[] || []));
  const projectMembers = allMembers.filter(m => assigneeIds.has(m.id));
  
  return {
    type: 'project_detail',
    success: true,
    data: {
      id: project.id,
      name: project.name,
      description: project.description,
      source: project.source,
      taskSummary,
      members: projectMembers.map(m => ({ id: m.id, name: m.name, type: m.type })),
    },
  };
}

async function handleDocumentContent(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const documentId = params.document_id;
  const title = params.title;
  
  let doc;
  if (documentId) {
    [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  } else if (title) {
    [doc] = await db.select().from(documents).where(eq(documents.title, title));
  }
  
  if (!doc) {
    return { type: 'document_content', success: false, error: 'Document not found' };
  }
  
  return {
    type: 'document_content',
    success: true,
    data: {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      docType: doc.type,
      projectId: doc.projectId,
    },
  };
}

async function handleSOPPreviousOutput(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const taskId = params.task_id;
  if (!taskId) {
    return { type: 'sop_previous_output', success: false, error: 'Missing task_id' };
  }
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || !task.sopTemplateId) {
    return { type: 'sop_previous_output', success: false, error: 'Task not found or not a SOP task' };
  }
  
  const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, task.sopTemplateId));
  if (!template) {
    return { type: 'sop_previous_output', success: false, error: 'SOP template not found' };
  }
  
  const stages = (template.stages || []) as Array<{ id: string; label: string }>;
  const stageHistory = (task.stageHistory || []) as Array<{ stageId: string; status: string; output?: string }>;
  
  const previousOutputs: Array<{ stageId: string; stageLabel: string; output: string }> = [];
  
  for (const stage of stages) {
    if (stage.id === task.currentStageId) break;
    const record = stageHistory.find(r => r.stageId === stage.id);
    if (record?.output) {
      previousOutputs.push({
        stageId: stage.id,
        stageLabel: stage.label,
        output: record.output,
      });
    }
  }
  
  return {
    type: 'sop_previous_output',
    success: true,
    data: { outputs: previousOutputs, total: previousOutputs.length },
  };
}

async function handleSOPKnowledgeLayer(params: Record<string, string>): Promise<{ type: ContextType; success: boolean; data?: unknown; error?: string }> {
  const taskId = params.task_id;
  const layer = (params.layer as 'L1' | 'L2' | 'L3' | 'L4' | 'L5') || 'L1';
  
  if (!taskId) {
    return { type: 'sop_knowledge_layer', success: false, error: 'Missing task_id' };
  }
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || !task.sopTemplateId) {
    return { type: 'sop_knowledge_layer', success: false, error: 'Task not found or not a SOP task' };
  }
  
  const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, task.sopTemplateId));
  if (!template || !template.knowledgeConfig) {
    return { type: 'sop_knowledge_layer', success: false, error: 'No knowledge config found' };
  }
  
  const config = template.knowledgeConfig as { documentId?: string };
  if (!config.documentId) {
    return { type: 'sop_knowledge_layer', success: false, error: 'No knowledge document configured' };
  }
  
  const [knowDoc] = await db.select().from(documents).where(eq(documents.id, config.documentId));
  if (!knowDoc?.content || typeof knowDoc.content !== 'string') {
    return { type: 'sop_knowledge_layer', success: false, error: 'Knowledge document content not found' };
  }
  
  const parsed = parseKnowHow(knowDoc.content);
  const content = extractLayers(parsed, [layer]);
  
  return {
    type: 'sop_knowledge_layer',
    success: true,
    data: { layer, content },
  };
}

// ============================================================================
// Export
// ============================================================================

export const POST = withAuth(handlePost);

/**
 * GET: 返回 API 说明
 */
export async function GET() {
  return NextResponse.json({
    name: 'Context Request API',
    description: '处理 Agent 通过对话信道发送的上下文请求',
    supportedTypes: [
      { type: 'task_detail', params: ['task_id'], description: '获取任务完整详情' },
      { type: 'task_comments', params: ['task_id'], description: '获取任务评论' },
      { type: 'project_detail', params: ['project_id'], description: '获取项目详情' },
      { type: 'document_content', params: ['document_id or title'], description: '获取文档内容' },
      { type: 'sop_previous_output', params: ['task_id'], description: '获取 SOP 前序产出' },
      { type: 'sop_knowledge_layer', params: ['task_id', 'layer (L1-L5)'], description: '获取 SOP 知识库层级' },
    ],
    requestFormat: '请求上下文:\\n- 类型: xxx\\n- 参数: {}',
    responseFormat: { type: 'context_response', responses: 'Array<{ type, success, data?, error? }>' },
  });
}
