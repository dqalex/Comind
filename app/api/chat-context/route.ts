/**
 * 聊天上下文 API
 * 
 * 为 AI 对话注入系统上下文，支持：
 * - project: 项目讨论上下文
 * - task: 任务讨论上下文  
 * - schedule: 定时任务讨论上下文
 * 
 * GET /api/chat-context?type=project&id=xxx  — 获取指定类型的聊天上下文
 * 
 * v0.9.8: 需要登录才能获取上下文（可能包含敏感业务数据）
 */
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { db, tasks, projects, members, scheduledTasks, documents, comments } from '@/db';
import { eq } from 'drizzle-orm';
import { renderTemplateWithContext } from '@/lib/template-engine';
import { withAuth } from '@/lib/with-auth';

// GET /api/chat-context - 获取聊天上下文
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'project' | 'task' | 'schedule' | null;
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ 
        error: 'Missing required parameters: type (project/task/schedule) and id' 
      }, { status: 400 });
    }

    let context: string;

    switch (type) {
      case 'project':
        context = await buildProjectContext(id);
        break;
      case 'task':
        context = await buildTaskContext(id);
        break;
      case 'schedule':
        context = await buildScheduleContext(id);
        break;
      default:
        return NextResponse.json({ 
          error: `Unsupported context type: ${type}` 
        }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        type, 
        id, 
        context,
        message: `${type} context generated`
      } 
    });
  } catch (error) {
    console.error('[chat-context]', error);
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 });
  }
});

/**
 * 构建项目聊天上下文
 */
async function buildProjectContext(projectId: string): Promise<string> {
  // 获取项目
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    throw new Error('项目不存在');
  }

  // 获取项目任务
  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  
  // 统计任务状态
  const taskStats = {
    total: projectTasks.length,
    todo: projectTasks.filter(t => t.status === 'todo').length,
    in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
    reviewing: projectTasks.filter(t => t.status === 'reviewing').length,
    completed: projectTasks.filter(t => t.status === 'completed').length,
  };

  // 获取项目成员
  const allMembers = await db.select().from(members);
  const assigneeIds = new Set(projectTasks.flatMap(t => t.assignees || []));
  const projectMembers = allMembers.filter(m => assigneeIds.has(m.id));

  // 获取项目文档
  const projectDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  // 构建任务列表文本
  const taskListText = projectTasks.slice(0, 20).map(t => {
    const statusEmoji = { todo: '⏳', in_progress: '🔄', reviewing: '👀', completed: '✅' }[t.status] || '❓';
    return `- ${statusEmoji} **${t.title}** (${t.priority})`;
  }).join('\n');

  // 渲染模板
  const context = await renderTemplateWithContext('chat-project', {
    project_id: project.id,
    project_name: project.name,
    project_description: project.description,
    project_created_at: project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : '未知',
    task_total: taskStats.total,
    task_todo: taskStats.todo,
    task_in_progress: taskStats.in_progress,
    task_reviewing: taskStats.reviewing,
    task_completed: taskStats.completed,
    task_list_text: taskListText || '（暂无任务）',
    has_project_members: projectMembers.length > 0,
    project_members_text: projectMembers.map(m => `- ${m.name}${m.type === 'ai' ? ' (AI)' : ''}`).join('\n'),
    has_project_documents: projectDocs.length > 0,
    project_documents_text: projectDocs.slice(0, 10).map(d => `- [[${d.title}]]`).join('\n'),
    execution_instructions: '如有需要，可通过 MCP 工具操作任务或文档。',
  });

  return context || '';
}

/**
 * 构建任务聊天上下文
 */
async function buildTaskContext(taskId: string): Promise<string> {
  // 获取任务
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    throw new Error('任务不存在');
  }

  // 获取项目信息
  let projectName = '未分类';
  let projectDescription = '';
  if (task.projectId) {
    const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
    if (project) {
      projectName = project.name;
      projectDescription = project.description || '';
    }
  }

  // 获取负责人
  const allMembers = await db.select().from(members);
  const assigneeNames = (task.assignees || [])
    .map(id => allMembers.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  // 获取检查项
  const checkItems = (task.checkItems as { text: string; completed: boolean }[]) || [];
  const checkItemsText = checkItems.map(item => 
    `- [${item.completed ? 'x' : ' '}] ${item.text}`
  ).join('\n');

  // 获取评论
  const taskComments = await db.select().from(comments).where(eq(comments.taskId, task.id));
  const commentsText = taskComments.map(c => {
    const author = allMembers.find(m => m.id === c.memberId)?.name || '未知';
    return `- **${author}**: ${c.content}`;
  }).join('\n');

  // 渲染模板
  const context = await renderTemplateWithContext('chat-task', {
    task_id: task.id,
    task_title: task.title,
    task_description: task.description || '无描述',
    task_status: task.status,
    task_priority: task.priority,
    task_progress: task.progress || 0,
    task_deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
    task_assignees: assigneeNames || '未指定',
    project_name: projectName,
    project_description: projectDescription,
    has_check_items: checkItems.length > 0,
    check_items_text: checkItemsText || '（无检查项）',
    has_comments: taskComments.length > 0,
    comments_text: commentsText || '（无评论）',
    execution_instructions: '可通过 MCP 工具更新任务状态、添加评论或检查项。',
  });

  return context || '';
}

/**
 * 构建定时任务聊天上下文
 */
async function buildScheduleContext(scheduleId: string): Promise<string> {
  // 获取定时任务
  const [schedule] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, scheduleId));
  if (!schedule) {
    throw new Error('定时任务不存在');
  }

  // 获取关联成员
  const allMembers = await db.select().from(members);
  const memberName = schedule.memberId 
    ? allMembers.find(m => m.id === schedule.memberId)?.name || '未指定'
    : '未指定';

  // 渲染模板
  const context = await renderTemplateWithContext('chat-schedule', {
    schedule_id: schedule.id,
    schedule_title: schedule.title,
    schedule_type: schedule.scheduleType,
    schedule_time: schedule.scheduleTime || '未指定',
    schedule_days: schedule.scheduleDays ? JSON.stringify(schedule.scheduleDays) : null,
    schedule_enabled: schedule.enabled,
    task_type: schedule.taskType,
    member_name: memberName,
    description: schedule.description || '无描述',
    last_run: schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString('zh-CN') : '从未执行',
    next_run: calculateNextRun(schedule),
    execution_instructions: '可通过 MCP 工具更新定时任务配置。',
  });

  return context || '';
}

/**
 * 计算下次执行时间
 */
function calculateNextRun(schedule: { scheduleType: string; scheduleTime: string | null; scheduleDays: number[] | null }): string {
  // 简化实现：返回预计时间
  if (!schedule.scheduleTime) return '未配置';
  
  switch (schedule.scheduleType) {
    case 'daily':
      return `每天 ${schedule.scheduleTime}`;
    case 'weekly': {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const scheduleDays = schedule.scheduleDays || [1, 2, 3, 4, 5];
      return `每 ${scheduleDays.map(d => days[d]).join('、')} ${schedule.scheduleTime}`;
    }
    case 'monthly':
      return `每月 ${schedule.scheduleDays?.join('、') || '1'} 日 ${schedule.scheduleTime}`;
    default:
      return schedule.scheduleTime;
  }
}
