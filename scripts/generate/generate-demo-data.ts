/**
 * TeamClaw 演示数据生成脚本
 * 
 * 用途：生成用于截图、演示、测试的完整演示数据
 * 运行：npx tsx scripts/generate-demo-data.ts
 * 
 * 生成内容：
 * - 1 个演示项目（TeamClaw 产品研发）
 * - 4 个成员（2 人类 + 2 AI）
 * - 1 个里程碑
 * - 15 个任务（覆盖所有状态和优先级）
 * - 5 个文档（不同类型）
 * - 3 个交付物
 * - 1 个 SOP 模板
 */

import { db } from '../../db';
import { projects, members, tasks, milestones, documents, deliveries, sopTemplates, users } from '../../db/schema';
import { generateId } from '../../src/shared/lib/id';

// 演示数据 ID 前缀
const PREFIX = {
  PROJECT: 'demo_proj_',
  MEMBER: 'demo_mem_',
  TASK: 'demo_task_',
  MILESTONE: 'demo_ms_',
  DOC: 'demo_doc_',
  DELIVERY: 'demo_del_',
  SOP: 'demo_sop_',
  USER: 'demo_user_',
};

// 时间戳
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log('🚀 开始生成演示数据...\n');

  // ========== 1. 用户 ==========
  console.log('📦 创建演示用户...');
  const adminUser = {
    id: PREFIX.USER + 'admin',
    name: '张明',
    email: 'zhangming@teamclaw.ai',
    passwordHash: '$2b$10$demo_hash_not_for_production', // 仅演示用
    role: 'admin' as const,
    createdAt: daysAgo(30),
    updatedAt: now,
  };
  
  const normalUser = {
    id: PREFIX.USER + 'dev',
    name: '李华',
    email: 'lihua@teamclaw.ai',
    passwordHash: '$2b$10$demo_hash_not_for_production',
    role: 'member' as const,
    createdAt: daysAgo(25),
    updatedAt: now,
  };

  await db.insert(users).values([adminUser, normalUser]).onConflictDoNothing();
  console.log('  ✅ 创建 2 个用户\n');

  // ========== 2. 成员 ==========
  console.log('👥 创建演示成员...');
  const demoMembers = [
    {
      id: PREFIX.MEMBER + 'zhangming',
      name: '张明',
      type: 'human' as const,
      email: 'zhangming@teamclaw.ai',
      online: true,
      userId: adminUser.id,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      id: PREFIX.MEMBER + 'lihua',
      name: '李华',
      type: 'human' as const,
      email: 'lihua@teamclaw.ai',
      online: false,
      userId: normalUser.id,
      createdAt: daysAgo(25),
      updatedAt: now,
    },
    {
      id: PREFIX.MEMBER + 'claude',
      name: 'Claude',
      type: 'ai' as const,
      online: true,
      openclawDeployMode: 'cloud' as const,
      openclawModel: 'claude-3-opus',
      executionMode: 'api_first' as const,
      experienceTaskCount: 42,
      experienceTaskTypes: ['开发', '调研', '分析'],
      experienceTools: ['web_search', 'code_analysis'],
      createdAt: daysAgo(20),
      updatedAt: now,
    },
    {
      id: PREFIX.MEMBER + 'gpt4',
      name: 'GPT-4',
      type: 'ai' as const,
      online: false,
      openclawDeployMode: 'local' as const,
      openclawModel: 'gpt-4-turbo',
      executionMode: 'chat_only' as const,
      experienceTaskCount: 28,
      experienceTaskTypes: ['写作', '翻译'],
      experienceTools: ['web_search'],
      createdAt: daysAgo(15),
      updatedAt: now,
    },
  ];

  for (const member of demoMembers) {
    await db.insert(members).values(member).onConflictDoNothing();
  }
  console.log('  ✅ 创建 4 个成员\n');

  // ========== 3. 项目 ==========
  console.log('📁 创建演示项目...');
  const demoProject = {
    id: PREFIX.PROJECT + 'teamclaw_v3',
    name: 'TeamClaw V3 产品研发',
    description: 'AI Agent 管理平台 v3.0 版本开发，包含多用户认证、SOP 工作流引擎、Skill 管理系统等核心功能',
    source: 'local' as const,
    ownerId: adminUser.id,
    visibility: 'team' as const,
    createdAt: daysAgo(30),
    updatedAt: now,
  };

  await db.insert(projects).values(demoProject).onConflictDoNothing();
  console.log('  ✅ 创建 1 个项目\n');

  // ========== 4. 里程碑 ==========
  console.log('🎯 创建里程碑...');
  const demoMilestone = {
    id: PREFIX.MILESTONE + 'v3_0_beta',
    title: 'V3.0 Beta 发布',
    description: '完成核心功能开发，发布 Beta 版本供内部测试',
    projectId: demoProject.id,
    status: 'in_progress' as const,
    dueDate: daysAgo(-7), // 7 天后
    sortOrder: 0,
    createdAt: daysAgo(25),
    updatedAt: now,
  };

  await db.insert(milestones).values(demoMilestone).onConflictDoNothing();
  console.log('  ✅ 创建 1 个里程碑\n');

  // ========== 5. 任务 ==========
  console.log('📋 创建演示任务...');
  const demoTasks = [
    // 高优先级 - 待办
    {
      id: PREFIX.TASK + 'auth_system',
      title: '实现用户认证系统',
      description: '实现登录、注册、密码重置功能，集成 JWT Token 认证',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'zhangming', PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'todo' as const,
      priority: 'high' as const,
      progress: 0,
      deadline: daysAgo(-5),
      checkItems: [
        { id: generateId(), text: '设计认证流程', completed: false },
        { id: generateId(), text: '实现 JWT 工具类', completed: false },
        { id: generateId(), text: '创建登录页面', completed: false },
      ],
      createdAt: daysAgo(10),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'db_schema',
      title: '数据库 Schema 设计',
      description: '设计用户、权限、日志相关的数据库表结构',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'todo' as const,
      priority: 'high' as const,
      progress: 0,
      createdAt: daysAgo(8),
      updatedAt: now,
    },
    // 中优先级 - 进行中
    {
      id: PREFIX.TASK + 'sop_engine',
      title: 'SOP 工作流引擎开发',
      description: '实现 SOP 模板管理、阶段执行、状态流转',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'lihua', PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'lihua',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      progress: 60,
      checkItems: [
        { id: generateId(), text: 'SOP 模板 CRUD', completed: true },
        { id: generateId(), text: '阶段状态机', completed: true },
        { id: generateId(), text: 'AI 执行接口', completed: true },
        { id: generateId(), text: '人工确认流程', completed: false },
        { id: generateId(), text: '知识库集成', completed: false },
      ],
      createdAt: daysAgo(15),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'api_docs',
      title: 'API 接口文档编写',
      description: '编写 REST API 接口文档，包含请求示例和错误码说明',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'gpt4'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      progress: 30,
      createdAt: daysAgo(5),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'ui_components',
      title: 'UI 组件库搭建',
      description: '基于 shadcn/ui 搭建组件库，统一设计规范',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'lihua'],
      creatorId: PREFIX.MEMBER + 'lihua',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      progress: 45,
      createdAt: daysAgo(12),
      updatedAt: now,
    },
    // 待审核
    {
      id: PREFIX.TASK + 'test_e2e',
      title: 'E2E 测试用例编写',
      description: '编写 Playwright E2E 测试用例覆盖核心流程',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'reviewing' as const,
      priority: 'medium' as const,
      progress: 90,
      checkItems: [
        { id: generateId(), text: '登录流程测试', completed: true },
        { id: generateId(), text: '任务 CRUD 测试', completed: true },
        { id: generateId(), text: 'SOP 执行测试', completed: true },
        { id: generateId(), text: '权限控制测试', completed: false },
      ],
      createdAt: daysAgo(7),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'logo_design',
      title: 'Logo 和品牌设计',
      description: '设计 TeamClaw 产品 Logo 和品牌视觉规范',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'lihua'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'reviewing' as const,
      priority: 'low' as const,
      progress: 100,
      createdAt: daysAgo(20),
      updatedAt: now,
    },
    // 已完成
    {
      id: PREFIX.TASK + 'project_init',
      title: '项目初始化',
      description: 'Next.js 项目初始化，配置 TypeScript、ESLint、Tailwind',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'zhangming'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'completed' as const,
      priority: 'high' as const,
      progress: 100,
      checkItems: [
        { id: generateId(), text: '创建 Next.js 项目', completed: true },
        { id: generateId(), text: '配置 TypeScript', completed: true },
        { id: generateId(), text: '配置 Tailwind', completed: true },
        { id: generateId(), text: '配置 ESLint', completed: true },
      ],
      createdAt: daysAgo(30),
      updatedAt: daysAgo(28),
    },
    {
      id: PREFIX.TASK + 'db_setup',
      title: '数据库配置',
      description: 'SQLite 数据库配置，Drizzle ORM 集成',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'completed' as const,
      priority: 'high' as const,
      progress: 100,
      createdAt: daysAgo(28),
      updatedAt: daysAgo(26),
    },
    {
      id: PREFIX.TASK + 'git_workflow',
      title: 'Git 工作流配置',
      description: '配置分支策略、提交规范、CI/CD 流程',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'zhangming'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'completed' as const,
      priority: 'medium' as const,
      progress: 100,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(23),
    },
    // 低优先级
    {
      id: PREFIX.TASK + 'perf_opt',
      title: '性能优化',
      description: '前端性能优化，包括懒加载、代码分割',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'lihua'],
      creatorId: PREFIX.MEMBER + 'lihua',
      status: 'todo' as const,
      priority: 'low' as const,
      progress: 0,
      createdAt: daysAgo(3),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'i18n',
      title: '国际化支持',
      description: '添加中英文切换功能',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'gpt4'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'todo' as const,
      priority: 'low' as const,
      progress: 0,
      createdAt: daysAgo(2),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'mobile_adapt',
      title: '移动端适配',
      description: '响应式设计优化，适配移动端浏览',
      projectId: demoProject.id,
      assignees: [PREFIX.MEMBER + 'lihua'],
      creatorId: PREFIX.MEMBER + 'lihua',
      status: 'todo' as const,
      priority: 'low' as const,
      progress: 0,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
    // 更多进行中任务
    {
      id: PREFIX.TASK + 'skill_mgmt',
      title: 'Skill 管理系统',
      description: '实现 Skill 注册、审批、信任管理功能',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'claude'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'in_progress' as const,
      priority: 'high' as const,
      progress: 75,
      checkItems: [
        { id: generateId(), text: 'Skill 表设计', completed: true },
        { id: generateId(), text: '注册 API', completed: true },
        { id: generateId(), text: '审批流程', completed: true },
        { id: generateId(), text: '信任管理', completed: false },
      ],
      createdAt: daysAgo(10),
      updatedAt: now,
    },
    {
      id: PREFIX.TASK + 'approval_system',
      title: '通用审批系统',
      description: '实现多类型审批流程，支持配置化审批策略',
      projectId: demoProject.id,
      milestoneId: demoMilestone.id,
      assignees: [PREFIX.MEMBER + 'claude', PREFIX.MEMBER + 'gpt4'],
      creatorId: PREFIX.MEMBER + 'zhangming',
      status: 'in_progress' as const,
      priority: 'high' as const,
      progress: 50,
      createdAt: daysAgo(8),
      updatedAt: now,
    },
  ];

  for (const task of demoTasks) {
    await db.insert(tasks).values(task).onConflictDoNothing();
  }
  console.log('  ✅ 创建 15 个任务\n');

  // ========== 6. 文档 ==========
  console.log('📄 创建演示文档...');
  const demoDocs = [
    {
      id: PREFIX.DOC + 'prd',
      title: 'TeamClaw V3 产品需求文档',
      content: `# TeamClaw V3 产品需求文档

## 1. 产品定位

TeamClaw V3 是 AI Agent 管理平台，作为 OpenClaw Gateway 的增强型前端。

## 2. 核心功能

### 2.1 多用户认证系统
- 用户注册/登录/登出
- 角色权限控制（admin/member/viewer）
- 安全码二次验证

### 2.2 SOP 工作流引擎
- 多阶段工作流定义
- AI 自动执行 + 人工确认
- 知识库分层集成

### 2.3 Skill 管理系统
- Skill 注册与验证
- 审批流程
- 信任管理
- 快照监控

## 3. 技术栈

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **数据库**: SQLite + Drizzle ORM
- **通信**: WebSocket (Gateway) + SSE (实时推送)

## 4. 里程碑

| 版本 | 目标日期 | 状态 |
|------|---------|------|
| v3.0 Beta | 2026-03-19 | 进行中 |
| v3.0 RC | 2026-03-26 | 待开始 |
| v3.0 正式 | 2026-04-02 | 待开始 |
`,
      projectId: demoProject.id,
      type: 'reference' as const,
      projectTags: ['PRD', '核心文档'],
      createdAt: daysAgo(28),
      updatedAt: daysAgo(5),
    },
    {
      id: PREFIX.DOC + 'api_doc',
      title: 'REST API 接口文档',
      content: `# REST API 接口文档

## 认证

所有 API 需要在 Header 中携带 Authorization:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## 通用响应格式

### 成功响应
\`\`\`json
{ "id": "xxx", "field": "value" }
\`\`\`

### 错误响应
\`\`\`json
{ "error": "错误信息" }
\`\`\`

## 任务 API

### GET /api/tasks
获取任务列表

**查询参数**:
- projectId: 项目 ID
- status: 状态过滤
- assigneeId: 分配人过滤

### POST /api/tasks
创建任务

### PUT /api/tasks/[id]
更新任务

### DELETE /api/tasks/[id]
删除任务
`,
      projectId: demoProject.id,
      type: 'reference' as const,
      projectTags: ['API', '技术文档'],
      createdAt: daysAgo(25),
      updatedAt: daysAgo(3),
    },
    {
      id: PREFIX.DOC + 'dev_guide',
      title: '开发指南',
      content: `# TeamClaw V3 开发指南

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
\`\`\`

## 目录结构

\`\`\`
teamclaw-v3/
├── app/              # Next.js App Router
├── components/       # React 组件
├── lib/              # 核心库
├── db/               # 数据库层
├── store/            # Zustand Store
└── core/             # 核心业务
\`\`\`

## 编码规范

1. 所有 UI 文本必须使用 t() 国际化
2. 编辑输入必须防抖 500ms
3. PUT/DELETE 必须检查资源存在性
4. 敏感字段返回前必须脱敏
`,
      projectId: demoProject.id,
      type: 'guide' as const,
      projectTags: ['开发', '规范'],
      createdAt: daysAgo(20),
      updatedAt: daysAgo(2),
    },
    {
      id: PREFIX.DOC + 'release_notes',
      title: 'V3.0 发布说明',
      content: `# TeamClaw V3.0 发布说明

## 新功能

### 🎉 多用户认证系统
首次部署自动引导创建管理员，支持用户注册/登录，角色权限控制。

### 🔄 SOP 工作流引擎
标准化操作流程引擎，让 AI Agent 按预定义工作流执行复杂任务。

### 🔧 Skill 管理系统
完整的 Skill 生命周期管理，包含注册、审批、信任管理。

### ✅ 通用审批系统
支持多种审批场景的通用审批流程。

## 技术改进

- 数据库从 21 张表扩展到 33 张表
- 新增 18 个 API 端点
- Store 数量从 14 个增加到 18 个

## 升级指南

详见 [升级文档](/docs/upgrade-guide)
`,
      projectId: demoProject.id,
      type: 'blog' as const,
      projectTags: ['发布', 'V3.0'],
      createdAt: daysAgo(1),
      updatedAt: now,
    },
    {
      id: PREFIX.DOC + 'meeting_notes',
      title: '产品评审会议纪要 - 2026-03-10',
      content: `# 产品评审会议纪要

**日期**: 2026-03-10
**参与人**: 张明、李华、Claude

## 议题

1. V3.0 Beta 功能范围确认
2. SOP 引擎设计评审
3. 上线时间确认

## 决议

### 功能范围
- ✅ 多用户认证（已完成）
- ✅ SOP 工作流引擎（60% 进度）
- ⏳ Skill 管理系统（75% 进度）
- ⏳ 审批系统（50% 进度）

### 上线时间
- Beta 版本: 2026-03-19
- RC 版本: 2026-03-26
- 正式版本: 2026-04-02

## 待办事项

- [ ] 李华: 完成 SOP 人工确认流程
- [ ] Claude: 完成信任管理功能
- [ ] 张明: 编写部署文档
`,
      projectId: demoProject.id,
      type: 'note' as const,
      projectTags: ['会议', '评审'],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ];

  for (const doc of demoDocs) {
    await db.insert(documents).values(doc).onConflictDoNothing();
  }
  console.log('  ✅ 创建 5 个文档\n');

  // ========== 7. 交付物 ==========
  console.log('📦 创建演示交付物...');
  const demoDeliveries = [
    {
      id: PREFIX.DELIVERY + 'prd_v1',
      memberId: PREFIX.MEMBER + 'zhangming',
      documentId: PREFIX.DOC + 'prd',
      title: 'TeamClaw V3 产品需求文档 v1.0',
      description: 'V3.0 版本完整产品需求文档，包含功能规划、技术选型、里程碑',
      platform: 'local' as const,
      status: 'approved' as const,
      reviewerId: PREFIX.MEMBER + 'zhangming',
      reviewedAt: daysAgo(27),
      reviewComment: '文档结构清晰，内容完整，批准发布。',
      version: 1,
      createdAt: daysAgo(28),
      updatedAt: daysAgo(27),
    },
    {
      id: PREFIX.DELIVERY + 'api_v1',
      memberId: PREFIX.MEMBER + 'gpt4',
      documentId: PREFIX.DOC + 'api_doc',
      title: 'REST API 接口文档 v1.0',
      description: '完整的 REST API 接口文档，包含所有端点的请求示例',
      platform: 'local' as const,
      status: 'approved' as const,
      reviewerId: PREFIX.MEMBER + 'zhangming',
      reviewedAt: daysAgo(24),
      reviewComment: '接口文档详细，示例清晰，通过审核。',
      version: 1,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(24),
    },
    {
      id: PREFIX.DELIVERY + 'design_v1',
      memberId: PREFIX.MEMBER + 'lihua',
      title: 'UI 设计规范 v1.0',
      description: '产品视觉设计规范，包含配色、字体、组件规范',
      platform: 'feishu' as const,
      externalUrl: 'https://feishu.cn/doc/demo-design-spec',
      status: 'pending' as const,
      version: 1,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
  ];

  for (const delivery of demoDeliveries) {
    await db.insert(deliveries).values(delivery).onConflictDoNothing();
  }
  console.log('  ✅ 创建 3 个交付物\n');

  // ========== 8. SOP 模板 ==========
  console.log('📝 创建 SOP 模板...');
  const demoSOP = {
    id: PREFIX.SOP + 'content_prod',
    name: '内容营销 SOP',
    description: '标准化内容创作流程，从选题到发布全流程管理',
    category: 'content' as const,
    stages: [
      {
        id: 'stage_1',
        label: '选题分析',
        type: 'ai_auto' as const,
        description: 'AI 分析市场趋势和用户需求，推荐选题方向',
        promptTemplate: '请分析 {{inputs.target_audience}} 的内容需求，推荐 5 个选题方向',
        outputType: 'text' as const,
        outputLabel: '选题建议',
        estimatedMinutes: 15,
      },
      {
        id: 'stage_2',
        label: '选题确认',
        type: 'ai_with_confirm' as const,
        description: '人工确认最终选题方向',
        confirmMessage: '请确认最终选题方向，或提供修改意见',
        outputType: 'text' as const,
        estimatedMinutes: 5,
      },
      {
        id: 'stage_3',
        label: '内容创作',
        type: 'ai_auto' as const,
        description: 'AI 根据选题创作内容初稿',
        promptTemplate: '请根据选题 {{stage_2.output}} 创作一篇 {{inputs.content_type}}，目标受众：{{inputs.target_audience}}',
        outputType: 'markdown' as const,
        outputLabel: '内容初稿',
        estimatedMinutes: 30,
      },
      {
        id: 'stage_4',
        label: '内容审核',
        type: 'manual' as const,
        description: '人工审核内容质量，提出修改意见',
        outputType: 'markdown' as const,
        outputLabel: '审核后内容',
        estimatedMinutes: 20,
      },
      {
        id: 'stage_5',
        label: '最终确认',
        type: 'review' as const,
        description: '最终审核确认，准备发布',
        estimatedMinutes: 10,
      },
    ],
    inputs: [
      { id: 'target_audience', label: '目标受众', type: 'text' as const, required: true, placeholder: '如：开发者、产品经理' },
      { id: 'content_type', label: '内容类型', type: 'select' as const, required: true, options: ['文章', '案例', '教程', '报告'] },
    ],
    status: 'active' as const,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  };

  await db.insert(sopTemplates).values(demoSOP).onConflictDoNothing();
  console.log('  ✅ 创建 1 个 SOP 模板\n');

  console.log('🎉 演示数据生成完成！\n');
  console.log('📊 数据统计:');
  console.log('  - 用户: 2');
  console.log('  - 成员: 4（2 人类 + 2 AI）');
  console.log('  - 项目: 1');
  console.log('  - 里程碑: 1');
  console.log('  - 任务: 15');
  console.log('    - 待办: 5');
  console.log('    - 进行中: 5');
  console.log('    - 审核中: 2');
  console.log('    - 已完成: 3');
  console.log('  - 文档: 5');
  console.log('  - 交付物: 3');
  console.log('  - SOP 模板: 1');
  console.log('\n💡 提示: 运行 npm run dev 启动开发服务器查看演示数据');
}

main().catch((err) => {
  console.error('❌ 生成演示数据失败:', err);
  process.exit(1);
});
