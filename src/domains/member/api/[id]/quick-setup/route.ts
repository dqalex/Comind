/**
 * 一键配置 API - 为 OpenClaw Agent 创建 MCP 联调项目及任务
 * 
 * 功能：
 * 1. 创建项目「联调 TeamClaw MCP」
 * 2. 创建多个分步骤任务
 * 3. 自动分配给指定的 AI 成员
 */
import { NextRequest, NextResponse } from 'next/server';
import { db, projects, tasks, members, type NewProject, type NewTask } from '@/db';
import { eq } from 'drizzle-orm';
import { generateProjectId, generateTaskId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { isValidId } from '@/lib/security';
import { readFileSync } from 'fs';
import { join } from 'path';

// 读取系统环境信息
function getSystemInfo(): { version: string; skillDir: string } {
  // 从 package.json 读取版本号
  let version = 'unknown';
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    version = pkg.version || 'unknown';
  } catch {
    console.warn('[quick-setup] 读取 package.json 版本号失败');
  }

  // Skill 目录：使用部署路径下的 skills 目录
  const skillDir = join(process.cwd(), 'skills');

  return { version, skillDir };
}

// 任务模板（动态生成，包含系统环境信息）
function buildSetupTasks() {
  const { version, skillDir } = getSystemInfo();
  
  return [
    {
      title: '安装 TeamClaw Skill',
      description: `## 任务目标
安装最新版本的 TeamClaw Skill 到 OpenClaw Agent。

## 执行步骤
1. 检查当前已安装的 Skill 版本（所在目录 ${skillDir}）
2. 安装最新版本 TeamClaw Skill（最新版本是 V${version}）
3. 记录安装信息：
   - Skill 版本号
   - Skill 安装目录
   - 安装时间

## 完成标准
- Skill 安装成功
- 版本信息已记录在任务评论中`,
      priority: 'high' as const,
      checkItems: [
        { id: 'check-1', text: '检查现有 Skill 版本', completed: false },
        { id: 'check-2', text: '安装最新 TeamClaw Skill', completed: false },
        { id: 'check-3', text: '记录版本号和安装目录', completed: false },
      ],
    },
  {
    title: '获取 MCP Token 并配置',
    description: `## 任务目标
根据 TeamClaw Skill 文档获取 MCP API Token 并完成配置联调。

## 执行步骤
1. 阅读 TeamClaw Skill 文档中的 MCP 配置说明
2. 选择 Token 获取方式：
   - 方式一（推荐）：通过 WebSocket 发送 \`teamclaw.config.request\` 事件自动获取
   - 方式二：在 TeamClaw 成员管理页面手动生成 Token
3. 配置 OpenClaw 环境变量：
   - \`TEAMCLAW_BASE_URL\`：TeamClaw 实例地址
   - \`TEAMCLAW_API_TOKEN\`：获取到的 Token
4. 测试 MCP 连接

## 完成标准
- MCP Token 配置成功
- 能够成功调用 TeamClaw MCP 工具`,
    priority: 'high' as const,
    checkItems: [
      { id: 'check-1', text: '阅读 Skill 文档', completed: false },
      { id: 'check-2', text: '获取 MCP Token', completed: false },
      { id: 'check-3', text: '配置环境变量', completed: false },
      { id: 'check-4', text: '测试 MCP 连接', completed: false },
    ],
  },
  {
    title: '测试 MCP 功能并生成报告',
    description: `## 任务目标
测试 TeamClaw MCP 工具功能并生成测试报告推送到文档交付中心。

## 测试项目
1. **任务管理测试**
   - \`list_my_tasks\`：列出我的任务
   - \`get_task\`：获取任务详情

2. **项目信息测试**
   - \`get_project\`：获取项目信息
   - \`get_project_members\`：获取项目成员

3. **文档操作测试**
   - \`get_document\`：获取文档
   - \`search_documents\`：搜索文档

4. **状态更新测试**
   - \`update_status\`：更新 AI 状态

## 执行步骤
1. 逐一测试上述 MCP 工具
2. 记录每个工具的调用结果
3. 生成测试报告（Markdown 格式）
4. 使用 \`deliver_document\` 推送到文档交付中心

## 完成标准
- 所有测试项目已执行
- 测试报告已生成并推送`,
    priority: 'medium' as const,
    checkItems: [
      { id: 'check-1', text: '测试任务管理工具', completed: false },
      { id: 'check-2', text: '测试项目信息工具', completed: false },
      { id: 'check-3', text: '测试文档操作工具', completed: false },
      { id: 'check-4', text: '生成测试报告', completed: false },
      { id: 'check-5', text: '推送到文档交付中心', completed: false },
    ],
  },
];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;

    // 校验 ID 格式
    if (!isValidId(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID format' }, { status: 400 });
    }

    // 查询成员
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (member.type !== 'ai') {
      return NextResponse.json({ error: 'Only AI members support quick setup' }, { status: 400 });
    }

    // 检查是否已存在同名项目
    const existingProjects = await db.select().from(projects);
    const existingProject = existingProjects.find(
      p => p.name === '联调 TeamClaw MCP' || p.name === 'TeamClaw MCP Integration'
    );

    let projectId: string;

    if (existingProject) {
      // 使用现有项目
      projectId = existingProject.id;
    } else {
      // 创建新项目
      const newProject: NewProject = {
        id: generateProjectId(),
        name: '联调 TeamClaw MCP',
        description: `## 项目说明
本项目用于 OpenClaw Agent 与 TeamClaw MCP 系统的联调测试。

### 目标
1. 安装并配置 TeamClaw Skill
2. 获取 MCP API Token 并完成鉴权配置
3. 测试 MCP 工具功能
4. 生成测试报告

### 相关资源
- TeamClaw 文档：查看 Skill 文档了解 MCP 配置方法
- 成员管理：在 TeamClaw 成员管理页面管理 API Token`,
        source: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(projects).values(newProject);
      projectId = newProject.id;
      eventBus.emit({ type: 'task_update', resourceId: projectId });
    }

    // 动态生成任务模板（包含系统环境信息）
    const setupTasks = buildSetupTasks();

    // 创建任务
    const createdTasks: NewTask[] = [];
    const now = new Date();

    for (let i = 0; i < setupTasks.length; i++) {
      const taskTemplate = setupTasks[i];
      const newTask: NewTask = {
        id: generateTaskId(),
        title: taskTemplate.title,
        description: taskTemplate.description,
        projectId: projectId,
        source: 'local',
        assignees: [memberId], // 分配给当前 AI 成员
        creatorId: 'quick-setup',
        status: i === 0 ? 'todo' : 'todo', // 第一个任务为待办
        progress: 0,
        priority: taskTemplate.priority,
        deadline: null,
        checkItems: taskTemplate.checkItems,
        attachments: [],
        parentTaskId: null,
        crossProjects: [],
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(tasks).values(newTask);
      createdTasks.push(newTask);
      eventBus.emit({ type: 'task_update', resourceId: newTask.id });
    }

    // 触发同步
    triggerMarkdownSync('teamclaw:tasks');

    return NextResponse.json({
      success: true,
      project: { id: projectId, name: '联调 TeamClaw MCP' },
      tasks: createdTasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
      message: '已创建联调项目和 3 个任务，请前往任务面板查看执行进度',
    });
  } catch (error) {
    console.error('[quick-setup] Creation failed:', error);
    return NextResponse.json({ error: 'Creation failed' }, { status: 500 });
  }
}
