# TeamClaw 原子化能力完整 Review

**文档版本**: v1.0.1  
**Review 日期**: 2026-03-17  
**Review 范围**: 前端 / 后端 / MCP / API 全栈原子化能力

---

## 一、原子化能力定义与分层

### 1.1 什么是原子化能力

原子化能力是指**可复用的最小功能单元**，遵循单一职责原则，可被组合使用构建复杂功能。

```
┌─────────────────────────────────────────────────────────────────┐
│                      原子化能力分层架构                           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 业务原子能力（前端页面级）                              │
│  - 页面组件、复合 Hooks、业务逻辑封装                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: 系统原子能力（前端组件级）                              │
│  - UI 组件、基础 Hooks、工具函数                                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 服务原子能力（后端 API 级）                             │
│  - API 路由、数据处理、业务逻辑                                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 核心原子能力（MCP/数据级）                              │
│  - MCP 工具、数据模型、存储操作                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 分类标准

| 分类 | 定义 | 技术形态 | 示例 |
|------|------|----------|------|
| **前端原子能力** | 用户界面层可复用单元 | React 组件、Hooks、工具函数 | `useInlineEdit`、`DataProvider` |
| **后端原子能力** | 服务端可复用单元 | API Route、Lib 函数、Service | `data-service.ts`、`task.handler.ts` |
| **MCP 原子能力** | Agent 可调用的工具 | MCP Tool Definition + Handler | `get_task`、`update_knowledge` |
| **API 原子能力** | HTTP 接口契约 | REST API Endpoint | `GET /api/tasks`、`POST /api/mcp` |

---

## 二、MCP 原子能力盘点（37 个工具）

### 2.1 任务管理工具（9个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `get_task` | 获取任务详情 | 任务查看、状态检查 | `tasksApi.getById` |
| `list_my_tasks` | 获取任务列表 | 任务列表、工作台 | `tasksApi.getAll` |
| `update_task_status` | 更新任务状态 | 任务推进、状态流转 | `tasksApi.update` |
| `add_task_comment` | 添加任务评论 | 进度汇报、结果提交 | `commentsApi.create` |
| `create_check_item` | 创建检查项 | 子任务分解 | `checkItemsApi.create` |
| `complete_check_item` | 完成检查项 | 子任务完成 | `checkItemsApi.update` |
| `get_project` | 获取项目详情 | 项目上下文 | `projectsApi.getById` |
| `get_project_members` | 获取项目成员 | 协作上下文 | `projectAccess.getMembers` |
| `get_template` | 获取推送模板 | 任务推送准备 | `templateEngine.render` |

### 2.2 文档管理工具（5个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `get_document` | 获取文档 | 知识库读取、SOP 上下文 | `documentsApi.getById` |
| `create_document` | 创建文档 | 交付物创建、知识沉淀 | `documentsApi.create` |
| `update_document` | 更新文档 | 内容编辑、知识更新 | `documentsApi.update` |
| `search_documents` | 搜索文档 | 知识查找 | `documentsApi.search` |
| `update_knowledge` | 知识库追加 | 经验沉淀（L4） | `knowhowParser.appendToL4` |

### 2.3 状态与队列工具（4个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `update_status` | 更新状态面板 | 实时状态上报 | `membersApi.updateStatus` |
| `set_queue` | 设置任务队列 | 队列管理 | `memberStatusStore` |
| `set_do_not_disturb` | 设置免打扰 | 勿扰模式 | `memberStatusStore` |
| `register_member` | AI 成员注册 | 自注册 | `membersApi.create` |

### 2.4 定时任务工具（4个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `create_schedule` | 创建定时任务 | 定时任务创建 | `scheduledTasksApi.create` |
| `list_schedules` | 获取定时任务列表 | 任务列表 | `scheduledTasksApi.getAll` |
| `update_schedule` | 更新定时任务 | 任务编辑 | `scheduledTasksApi.update` |
| `delete_schedule` | 删除定时任务 | 任务删除 | `scheduledTasksApi.delete` |

### 2.5 交付管理工具（4个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `deliver_document` | 提交交付物 | 文档交付 | `deliveriesApi.create` |
| `list_my_deliveries` | 获取交付列表 | 交付追踪 | `deliveriesApi.getAll` |
| `get_delivery` | 获取交付详情 | 审核查看 | `deliveriesApi.getById` |
| `review_delivery` | 审核交付物 | 审核流程 | `deliveriesApi.update` |

### 2.6 里程碑工具（4个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `create_milestone` | 创建里程碑 | 里程碑管理 | `milestonesApi.create` |
| `list_milestones` | 获取里程碑列表 | 列表展示 | `milestonesApi.getAll` |
| `update_milestone` | 更新里程碑 | 里程碑编辑 | `milestonesApi.update` |
| `delete_milestone` | 删除里程碑 | 里程碑删除 | `milestonesApi.delete` |

### 2.7 SOP 引擎工具（5个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `advance_sop_stage` | 推进 SOP 阶段 | 阶段完成 | `sopHandler.advanceStage` |
| `request_sop_confirm` | 请求人工确认 | 人工审核 | `approvalHandler.create` |
| `get_sop_context` | 获取 SOP 上下文 | 阶段执行参考 | `sopHandler.getContext` |
| `save_stage_output` | 保存阶段产出 | 中间保存 | `sopHandler.saveOutput` |
| `create_sop_template` | 创建 SOP 模板 | 模板创作 | `sopTemplatesApi.create` |
| `update_sop_template` | 更新 SOP 模板 | 模板编辑 | `sopTemplatesApi.update` |

### 2.8 渲染模板工具（4个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `list_render_templates` | 获取渲染模板列表 | 模板选择 | `renderTemplatesApi.getAll` |
| `get_render_template` | 获取渲染模板详情 | 模板渲染 | `renderTemplatesApi.getById` |
| `create_render_template` | 创建渲染模板 | 模板创作 | `renderTemplatesApi.create` |
| `update_render_template` | 更新渲染模板 | 模板编辑 | `renderTemplatesApi.update` |

### 2.9 Agent Token 工具（3个）

| 工具名 | 能力描述 | 复用场景 | 依赖能力 |
|--------|----------|----------|----------|
| `get_agent_mcp_token` | 获取 MCP Token | 外部调用 | `mcpTokenService.getOrCreate` |
| `list_agent_mcp_tokens` | 列出 Token | Token 管理 | `mcpTokenService.list` |
| `revoke_agent_mcp_token` | 撤销 Token | Token 轮换 | `mcpTokenService.revoke` |

---

## 三、后端 API 原子能力盘点

### 3.1 API Route 分层

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Route 分层                              │
├─────────────────────────────────────────────────────────────────┤
│  Domain API (21个模块)                                           │
│  - tasks, projects, members, documents, milestones...           │
│  - 标准 CRUD：GET/POST + GET/PUT/DELETE                         │
├─────────────────────────────────────────────────────────────────┤
│  Action API (10+个)                                              │
│  - task-push, batch-task-push, sop-advance, chat-actions...     │
│  - 特定业务动作                                                  │
├─────────────────────────────────────────────────────────────────┤
│  MCP API (2个入口)                                               │
│  - /api/mcp (内部调用)                                           │
│  - /api/mcp/external (外部调用，Bearer Token)                   │
├─────────────────────────────────────────────────────────────────┤
│  System API (8+个)                                               │
│  - health, sse, heartbeat, gateway, debug...                    │
│  - 系统级服务                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Domain API 完整清单（21个模块）

| 模块 | 路由文件 | 原子能力 | HTTP 方法 | 复用度 |
|------|----------|----------|-----------|--------|
| **tasks** | `route.ts`, `[id]/route.ts` | CRUD + 刷新 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐⭐ |
| **projects** | `route.ts`, `[id]/route.ts` | CRUD + 成员 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐⭐ |
| **members** | `route.ts`, `[id]/route.ts` | CRUD + Token | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **documents** | `route.ts`, `[id]/route.ts` | CRUD + 搜索 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐⭐ |
| **milestones** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **deliveries** | `route.ts`, `[id]/route.ts` | CRUD + 审核 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **scheduled-tasks** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **scheduled-task-history** | `route.ts`, `[id]/route.ts` | 历史记录 | GET | ⭐⭐ |
| **comments** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **sop-templates** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **render-templates** | `route.ts`, `[id]/route.ts` | CRUD + 导入导出 | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **skills** | `route.ts`, `[id]/route.ts` | CRUD + 信任 | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **chat-sessions** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **chat-messages** | `route.ts`, `[id]/route.ts` | CRUD | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **users** | `route.ts`, `[id]/route.ts` | CRUD + 安全码 | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **openclaw-workspaces** | `route.ts`, `[id]/route.ts` | CRUD + 同步扫描 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **openclaw-files** | `route.ts`, `[id]/route.ts` | CRUD + 版本 | GET/POST/PUT/DELETE | ⭐⭐⭐⭐ |
| **openclaw-conflicts** | `route.ts`, `[id]/route.ts` | 冲突解决 | GET/POST | ⭐⭐ |
| **approval-requests** | `route.ts`, `[id]/route.ts` | 审批管理 | GET/POST/PUT/DELETE | ⭐⭐⭐ |
| **templates** | `route.ts` | 推送模板 | GET | ⭐⭐⭐⭐ |
| **task-logs** | `route.ts` | 任务日志 | GET | ⭐⭐⭐ |

### 3.3 Action API 清单

| API 路由 | 原子能力 | 业务场景 | 依赖模块 |
|----------|----------|----------|----------|
| `POST /api/task-push` | 任务推送 | 普通任务分发 | tasks, members, templates |
| `POST /api/batch-task-push` | 批量推送 | 批量任务分发 | tasks, members |
| `POST /api/tasks/[id]/sop-advance` | SOP 推进 | 阶段完成 | sop-templates, tasks |
| `POST /api/chat-actions` | Chat 执行 | 对话中执行 | chat-sessions, mcp |
| `POST /api/chat-reply` | Chat 回复 | AI 回复 | chat-messages |
| `POST /api/chat-context` | 上下文获取 | Chat 初始化 | tasks, scheduled-tasks |
| `POST /api/deliveries/[id]/review` | 交付审核 | 审核交付 | deliveries, approvals |
| `POST /api/skills/[id]/trust` | 信任 Skill | 技能信任 | skills |
| `POST /api/skills/[id]/install` | 安装 Skill | 技能安装 | skills |
| `POST /api/openclaw-files/[id]/sync` | 文件同步 | Markdown 同步 | openclaw-files |

### 3.4 MCP API 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP API 调用链                            │
├─────────────────────────────────────────────────────────────────┤
│  Entry Points                                                    │
│  ├── /api/mcp (内部调用，session cookie)                        │
│  └── /api/mcp/external (外部调用，Bearer Token)                 │
├─────────────────────────────────────────────────────────────────┤
│  Dispatcher                                                      │
│  └── executor.ts → switch(instruction.type)                     │
├─────────────────────────────────────────────────────────────────┤
│  Handlers (9个)                                                  │
│  ├── task.handler.ts (任务管理)                                  │
│  ├── document.handler.ts (文档管理)                              │
│  ├── member.handler.ts (成员管理)                                │
│  ├── schedule.handler.ts (定时任务)                              │
│  ├── status.handler.ts (状态管理)                                │
│  ├── delivery.handler.ts (交付管理)                              │
│  ├── sop.handler.ts (SOP 引擎)                                   │
│  ├── template.handler.ts (模板管理)                              │
│  └── approval.handler.ts (审批管理)                              │
├─────────────────────────────────────────────────────────────────┤
│  Core Services                                                   │
│  ├── data-service.ts (数据访问层)                                │
│  ├── gateway-client.ts (Gateway 通信)                           │
│  └── template-engine.ts (模板渲染)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、前端原子能力盘点

### 4.1 组件分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端组件分层                                │
├─────────────────────────────────────────────────────────────────┤
│  Page Components (页面级)                                        │
│  - app/tasks/page.tsx, app/projects/page.tsx...                 │
│  - 业务页面，组合多个 Feature Components                        │
├─────────────────────────────────────────────────────────────────┤
│  Feature Components (功能级)                                     │
│  - TaskBoardView, MilestoneManager, ChatPanel...                │
│  - 业务功能组件，位于 components/                               │
├─────────────────────────────────────────────────────────────────┤
│  UI Components (基础级)                                          │
│  - components/ui/ (shadcn/ui)                                   │
│  - Button, Input, Dialog, Table... (15个)                       │
├─────────────────────────────────────────────────────────────────┤
│  Custom Hooks (逻辑级)                                           │
│  - hooks/ (17个)                                                │
│  - useInlineEdit, useChatStream, useSSEConnection...            │
├─────────────────────────────────────────────────────────────────┤
│  Store (状态级)                                                  │
│  - store/ (24个)                                                │
│  - Zustand stores，按领域划分                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Store 原子能力（24个）

| Store | 能力描述 | 复用场景 | 依赖 API |
|-------|----------|----------|----------|
| `task.store.ts` | 任务状态管理 | 任务列表、详情、操作 | `tasksApi` |
| `project.store.ts` | 项目状态管理 | 项目列表、详情 | `projectsApi` |
| `member.store.ts` | 成员状态管理 | 成员列表、状态 | `membersApi` |
| `document.store.ts` | 文档状态管理 | 文档列表、编辑 | `documentsApi` |
| `milestone.store.ts` | 里程碑状态管理 | 里程碑列表 | `milestonesApi` |
| `delivery.store.ts` | 交付物状态管理 | 交付列表、审核 | `deliveriesApi` |
| `schedule.store.ts` | 定时任务状态管理 | 定时任务列表 | `scheduledTasksApi` |
| `sop-template.store.ts` | SOP 模板状态管理 | 模板列表、编辑 | `sopTemplatesApi` |
| `render-template.store.ts` | 渲染模板状态管理 | 模板列表 | `renderTemplatesApi` |
| `skill.store.ts` | Skill 状态管理 | Skill 列表、信任 | `skillsApi` |
| `chat.store.ts` | Chat 状态管理 | 对话列表、消息 | `chatSessionsApi` |
| `comment.store.ts` | 评论状态管理 | 任务评论 | `commentsApi` |
| `gateway.store.ts` | Gateway 状态管理 | 连接状态、Agent 数据 | `gatewayClient` |
| `openclaw.store.ts` | OpenClaw 状态管理 | Workspace、文件 | `openclawApi` |
| `auth.store.ts` | 认证状态管理 | 登录态、用户信息 | `authApi` |
| `ui.store.ts` | UI 状态管理 | 主题、侧边栏、加载 | - |
| `approval.store.ts` | 审批状态管理 | 待审批列表 | `approvalsApi` |
| `tasklog.store.ts` | 任务日志状态管理 | 日志查看 | `taskLogsApi` |
| `user-mcp-token.store.ts` | MCP Token 管理 | Token 列表 | `userMcpTokensApi` |

### 4.3 Hooks 原子能力（17个）

| Hook | 能力描述 | 复用场景 | 依赖 |
|------|----------|----------|------|
| `useInlineEdit.ts` | 内联编辑 | 表格编辑、快速修改 | - |
| `useChatStream.ts` | Chat 流式响应 | AI 对话 | EventSource |
| `useSSEConnection.ts` | SSE 连接管理 | 实时更新 | EventSource |
| `useDataInitializer.ts` | 数据初始化 | 应用启动加载 | 多个 stores |
| `useAutoScroll.ts` | 自动滚动 | 消息列表 | - |
| `useClickOutside.ts` | 点击外部检测 | 下拉菜单、弹窗 | - |
| `useConfirmAction.ts` | 确认操作 | 删除确认 | - |
| `useEntityData.ts` | 实体数据获取 | 详情页 | data-service |
| `useEscapeKey.ts` | ESC 键监听 | 弹窗关闭 | - |
| `useFilteredList.ts` | 列表过滤 | 搜索、筛选 | - |
| `useGatewayData.ts` | Gateway 数据 | Agent 数据获取 | gateway-client |
| `useGatewaySync.ts` | Gateway 同步 | 数据同步状态 | gateway-client |
| `useRelativeTime.ts` | 相对时间 | 时间显示 | - |
| `useSecurityCode.ts` | 安全码 | 敏感操作 | - |
| `useSlotSync.ts` | Slot 同步 | 模板编辑 | - |
| `useStaleStatusCheck.ts` | 过期状态检查 | 状态刷新 | - |
| `useTaskSOP.ts` | 任务 SOP 管理 | SOP 执行 | sop-templates |

### 4.4 Lib 原子能力（75+ 模块）

| 模块 | 能力描述 | 复用场景 | 被依赖 |
|------|----------|----------|--------|
| `data-service.ts` | API 请求封装 | 所有 API 调用 | stores, components |
| `gateway-client.ts` | Gateway WebSocket | Gateway 通信 | stores |
| `event-bus.ts` | 事件总线 | 组件通信 | API routes |
| `template-engine.ts` | 模板渲染 | 推送模板 | task-push |
| `knowhow-parser.ts` | Know-how 解析 | L4 追加 | update_knowledge |
| `i18n.ts` | 国际化 | 多语言 | components |
| `validators.ts` | 数据校验 | 表单验证 | forms |
| `sanitize.ts` | 数据脱敏 | API 响应 | API routes |
| `id.ts` | ID 生成 | 主键生成 | API routes |
| `audit-log.ts` | 审计日志 | 操作记录 | API routes |

---

## 五、原子化能力依赖矩阵

### 5.1 MCP → 后端 → 前端依赖链

```
┌─────────────────────────────────────────────────────────────────┐
│                    垂直依赖链示例                                │
│                      （以任务管理为例）                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  前端 (Layer 4)                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ TaskListView.tsx                        │                    │
│  │ - 使用 useTaskStore()                   │                    │
│  │ - 使用 useInlineEdit()                  │                    │
│  └──────────┬──────────────────────────────┘                    │
│             │                                                    │
│  前端 (Layer 3)                                                  │
│  ┌──────────▼──────────────────────────────┐                    │
│  │ task.store.ts                           │                    │
│  │ - 调用 tasksApi.getAll()                │                    │
│  │ - 调用 tasksApi.update()                │                    │
│  └──────────┬──────────────────────────────┘                    │
│             │                                                    │
│  后端 (Layer 2)                                                  │
│  ┌──────────▼──────────────────────────────┐                    │
│  │ data-service.ts                         │                    │
│  │ - fetch('/api/tasks')                   │                    │
│  │ - fetch('/api/tasks/${id}', {method:'PUT'})                    │
│  └──────────┬──────────────────────────────┘                    │
│             │                                                    │
│  后端 (Layer 1)                                                  │
│  ┌──────────▼──────────────────────────────┐                    │
│  │ app/api/tasks/route.ts                  │                    │
│  │ - GET: db.select().from(tasks)          │                    │
│  │ - PUT: db.update(tasks).set(data)       │                    │
│  └──────────┬──────────────────────────────┘                    │
│             │                                                    │
│  MCP (Agent)                                                     │
│  ┌──────────▼──────────────────────────────┐                    │
│  │ MCP Tool: update_task_status            │                    │
│  │ - 调用 /api/mcp (内部)                   │                    │
│  │ - 执行 task.handler.ts                  │                    │
│  │ - 最终调用 /api/tasks/${id}              │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 水平依赖关系（同层复用）

| 能力 | 同层依赖 | 说明 |
|------|----------|------|
| `create_task` | `get_project`, `get_project_members` | 创建任务需项目上下文 |
| `deliver_document` | `create_document`, `create_delivery` | 交付需先创建文档 |
| `advance_sop_stage` | `get_sop_context`, `update_task_status` | 推进需上下文和状态更新 |
| `update_knowledge` | `get_document`, `parseKnowHow` | 追加需先读取解析 |

### 5.3 跨层调用矩阵

| 能力 | 前端 | 后端 API | MCP | 复用度 |
|------|------|----------|-----|--------|
| 任务 CRUD | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐⭐ |
| 文档 CRUD | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐⭐ |
| 项目 CRUD | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐ |
| 里程碑 CRUD | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐ |
| 交付管理 | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐ |
| 定时任务 | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐ |
| SOP 引擎 | ✅ Component | ✅ Route | ✅ Tool | ⭐⭐⭐⭐ |
| 状态管理 | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐ |
| 成员管理 | ✅ Store | ✅ Route | ✅ Tool | ⭐⭐⭐⭐ |
| 审批流程 | ✅ Store | ✅ Route | ❌ MCP | ⭐⭐⭐ |
| Chat 对话 | ✅ Store | ✅ Route | ❌ MCP | ⭐⭐⭐ |
| Gateway | ✅ Store | ✅ Route | ❌ MCP | ⭐⭐⭐⭐ |
| Workspace | ✅ Store | ✅ Route | ❌ MCP | ⭐⭐⭐⭐ |

---

## 六、问题与改进建议

### 6.1 重复能力识别

| 重复能力 | 位置 | 问题 | 建议 |
|----------|------|------|------|
| **任务推送模板** | `task-push.md`, `sop-task-push.md` | 内容重复 60%+ | 提取公共模板到 `base-push.md` |
| **Chat 上下文** | `chat-task.md`, `chat-schedule.md` | 结构重复 | 使用统一模板引擎 |
| **审批状态** | `approval.handler.ts`, `delivery.handler.ts` | 审核逻辑重复 | 提取通用审批服务 |
| **数据校验** | `validators.ts`, `validation.ts` | 校验逻辑分散 | 统一校验层 |
| **ID 生成** | `id.ts`, 多处 inline | 生成逻辑不一致 | 强制使用 id.ts |

### 6.2 缺失能力识别

| 缺失能力 | 影响 | 优先级 | 建议实现 |
|----------|------|--------|----------|
| **定时任务执行推送** | 定时任务无法执行 | P0 | 新增 `schedule-push.md` + handler |
| **里程碑知识沉淀** | 里程碑经验流失 | P1 | 新增里程碑完成钩子 |
| **Chat 价值沉淀** | 对话知识流失 | P1 | 新增对话结束提示 |
| **Skill 执行跟踪** | 无法评估 Skill | P1 | 新增 skill_execution 表 |
| **批量文档操作** | 文档管理效率低 | P2 | 新增 `batch_documents` MCP 工具 |
| **任务依赖管理** | 无法表达依赖关系 | P2 | 新增 `task_dependencies` 表 + 工具 |
| **通知中心** | 通知分散 | P2 | 统一通知服务 |
| **全文搜索** | 搜索能力弱 | P2 | 集成搜索索引 |

### 6.3 能力边界模糊

| 模糊边界 | 当前状态 | 问题 | 建议 |
|----------|----------|------|------|
| **MCP vs API** | 部分功能两边都有 | 维护成本高 | MCP 专注 Agent，API 专注前端 |
| **Store vs Component** | 部分组件直接调用 API | 状态不一致 | 强制通过 Store |
| **Handler vs Service** | Handler 包含业务逻辑 | 难以复用 | Handler 只转发，Service 处理 |
| **Sync vs Async** | 同步逻辑分散 | 难以追踪 | 统一同步服务 |

### 6.4 改进路线图

```
┌─────────────────────────────────────────────────────────────────┐
│                      改进路线图                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  v1.0.1 (立即)                                                   │
│  ├── 提取推送模板公共部分                                        │
│  ├── 统一数据校验层                                              │
│  └── 强制 ID 生成使用 id.ts                                      │
│                                                                  │
│  v1.1.0 (短期)                                                   │
│  ├── 新增定时任务推送能力                                        │
│  ├── 新增里程碑知识沉淀                                          │
│  ├── 新增 Skill 执行跟踪                                         │
│  └── 提取通用审批服务                                            │
│                                                                  │
│  v1.2.0 (中期)                                                   │
│  ├── 新增批量文档操作 MCP 工具                                   │
│  ├── 新增任务依赖管理                                            │
│  ├── 统一通知服务                                                │
│  └── 重构 Handler-Service 分层                                   │
│                                                                  │
│  v0.0.0 (长期)                                                   │
│  ├── MCP 与 API 职责清晰分离                                     │
│  ├── 前端 Store 架构优化                                         │
│  ├── 全文搜索集成                                                │
│  └── 能力市场 (Skill Store)                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、总结

### 7.1 原子化能力统计

| 层级 | 类型 | 数量 | 健康度 |
|------|------|------|--------|
| **MCP** | 工具 | 37个 | ⭐⭐⭐⭐ |
| **后端 API** | Domain API | 21个模块 | ⭐⭐⭐⭐⭐ |
| **后端 API** | Action API | 10+个 | ⭐⭐⭐⭐ |
| **前端** | Store | 19个 | ⭐⭐⭐⭐ |
| **前端** | Hooks | 17个 | ⭐⭐⭐⭐ |
| **前端** | Lib 模块 | 75+ | ⭐⭐⭐⭐ |
| **前端** | UI 组件 | 15个 | ⭐⭐⭐⭐⭐ |
| **前端** | Feature 组件 | 30+ | ⭐⭐⭐ |

### 7.2 核心优势

1. **MCP 工具完整**：37个工具覆盖所有业务域
2. **API 分层清晰**：Domain/Action/MCP/System 四层架构
3. **前端 Store 规范**：Zustand 统一状态管理
4. **复用度高**：data-service、template-engine 等核心能力复用充分

### 7.3 关键问题

1. **定时任务闭环缺失**：有管理无执行
2. **里程碑经验流失**：完成无沉淀
3. **模板重复度高**：维护成本高
4. **Skill 无跟踪**：无法评估效果

### 7.4 行动建议优先级

| 优先级 | 行动项 | 预计工作量 |
|--------|--------|------------|
| P0 | 定时任务推送闭环 | 2天 |
| P1 | 推送模板重构 | 1天 |
| P1 | 里程碑知识沉淀 | 1天 |
| P1 | Skill 执行跟踪 | 2天 |
| P2 | 统一审批服务 | 3天 |
| P2 | Handler-Service 分层 | 5天 |

---

**文档版本历史**
- v0.9.7 (2026-03-17): 初始版本，完整盘点前端/后端/MCP/API 原子化能力
