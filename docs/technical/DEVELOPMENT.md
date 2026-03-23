# TeamClaw 开发文档

> **读者**：开发者
> **最后更新**：2026-03-23
> **当前版本**：v1.0.1

---

## 目录

1. [项目定位](#1-项目定位)
2. [架构概览](#2-架构概览)
3. [项目结构](#3-项目结构)
4. [Gateway 客户端](#4-gateway-客户端)
5. [核心模块说明](#5-核心模块说明)
6. [数据库层](#6-数据库层)
7. [REST API 规范](#7-rest-api-规范)
8. [MCP 指令系统](#8-mcp-指令系统)
9. [Skill 开发指南](#9-skill-开发指南)
10. [开发规范](#10-开发规范)
11. [测试指南](#11-测试指南)
12. [部署指南](#12-部署指南)

---

## 1. 项目定位

TeamClaw 是 **AI Agent 管理平台**，作为 **OpenClaw Gateway 的增强型前端**，提供完整的人机协作能力。

```
人类 ←→ TeamClaw 平台 ←→ OpenClaw 智能体
                    ↘
                      任务、文档、状态、定时任务
```

**核心用户**：OpenClaw 智能体（AI Agent），其次是人类用户。

| 方面 | TeamClaw | OpenClaw |
|------|--------|----------|
| 角色 | 管理平台 | 智能体运行时 |
| 数据 | SQLite（项目数据）+ Gateway（智能体数据） | 智能体状态、会话、技能 |
| 通信 | WebSocket 连接 Gateway | 提供 WebSocket 服务 |
| 核心 | 任务、文档、成员管理 | AI 推理、工具调用、记忆 |

---

## 2. 架构概览

### 2.1 双数据源架构

```
┌─────────────────────────────────────────────────────────┐
│                      TeamClaw 前端                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   SQLite 数据                    Gateway 数据           │
│   ├─ tasks                      ├─ agents              │
│   ├─ projects                   ├─ sessions            │
│   ├─ documents                  ├─ cron jobs           │
│   ├─ members                    ├─ skills              │
│   └─ deliveries                 └─ config              │
│                                                         │
│   ↓ Drizzle ORM                 ↓ WebSocket (v3)       │
│                                                         │
│   本地数据库                     OpenClaw Gateway        │
│   data/teamclaw.db                ws://localhost:18789   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流（4 条路径）

1. **用户 → SQLite**：React 组件 → Zustand Store → `@/shared/lib/data-service.ts`（fetch）→ API Route → Drizzle ORM → SQLite
2. **用户 → Gateway**：React 组件 → Zustand Store → `@/shared/lib/gateway-client.ts`（WebSocket）→ OpenClaw Gateway
3. **实时推送**：API 写操作 → `eventBus.emit()`（`@/shared/lib/event-bus.ts`）→ SSE `/api/sse` → `DataProvider` 自动刷新 Store
4. **AI MCP**：Agent → `/api/mcp`（或 `/api/mcp/external` + Bearer Token）→ `src/core/mcp/` 执行器 → DB 写入 + SSE 广播 → 前端刷新

### 2.3 关键设计决策

| 决策 | 说明 |
|------|------|
| Base58 ID | 主键使用 Base58 短 ID（~11 字符），由 API 层生成，非 UUID |
| 服务端/客户端分离 | 涉及 `db`、`fs` 的模块不能在客户端导入 |
| 实时推送 | 所有写操作通过 SSE 广播，前端自动刷新 |
| MCP 协议 | AI 智能体通过 MCP Tools 操作平台数据 |
| Gateway 双模式 | `browser_direct`（浏览器直连 WS）/ `server_proxy`（服务端代理） |

---

## 3. 项目结构

```
teamclaw/
├── app/                          # Next.js 14 App Router（19 个页面路由）
│   ├── page.tsx                  # 首页
│   ├── layout.tsx                # 根布局
│   ├── globals.css               # 全局样式
│   ├── dashboard/page.tsx        # 工作台
│   ├── tasks/page.tsx            # 任务看板
│   ├── projects/page.tsx         # 项目管理
│   ├── wiki/page.tsx             # 文档 Wiki
│   ├── agents/page.tsx           # Agent 管理
│   ├── sessions/page.tsx         # 会话管理
│   ├── skills/page.tsx           # 技能市场
│   ├── schedule/page.tsx         # 定时任务
│   ├── scheduler/page.tsx        # 调度器
│   ├── deliveries/page.tsx       # 文档交付
│   ├── members/page.tsx          # 成员管理
│   ├── settings/page.tsx         # 系统设置
│   ├── users/page.tsx            # 用户管理
│   ├── init/page.tsx             # 初始化页面
│   ├── blog/page.tsx             # 博客页面
│   ├── skills-management/page.tsx # Skill 管理
│   ├── approvals/page.tsx        # 审批系统
│   └── api/                      # REST API 路由（50+ 目录）
│
├── src/                          # 源码目录（v1.0.1 新架构）
│   ├── core/                     # 核心模块
│   │   ├── db/                   # 数据库层
│   │   ├── gateway/              # Gateway 客户端
│   │   ├── mcp/                  # MCP 指令系统
│   │   └── member-resolver.ts
│   │
│   ├── domains/                  # 领域模块（16 个领域）
│   │   ├── task/                 # 任务领域
│   │   ├── project/              # 项目领域
│   │   ├── member/              # 成员领域
│   │   ├── document/            # 文档领域
│   │   ├── delivery/            # 交付领域
│   │   ├── schedule/            # 调度领域
│   │   ├── comment/             # 评论领域
│   │   ├── chat/                # 聊天领域
│   │   ├── milestone/           # 里程碑领域
│   │   ├── sop/                 # SOP 领域
│   │   ├── render-template/     # 渲染模板领域
│   │   ├── skill/               # 技能领域
│   │   ├── approval/            # 审批领域
│   │   ├── auth/                # 认证领域
│   │   ├── context/             # 上下文领域
│   │   └── ui/                  # UI 状态领域
│   │
│   ├── features/                 # 功能模块（10 个功能）
│   │   ├── agent-manager/       # Agent 管理面板
│   │   ├── chat-panel/          # 聊天面板
│   │   ├── document-editor/     # 文档编辑器
│   │   ├── sop-engine/          # SOP 引擎
│   │   ├── task-board/          # 任务看板
│   │   ├── wiki-editor/         # Wiki 编辑器
│   │   ├── skill-manager/       # 技能管理
│   │   ├── milestone-tracker/   # 里程碑追踪
│   │   ├── settings/            # 设置面板
│   │   └── landing/             # 着陆页
│   │
│   ├── shared/                   # 共享模块
│   │   ├── lib/                 # 工具函数（70+ 个文件）
│   │   ├── components/          # 共享组件
│   │   ├── layout/              # 布局组件
│   │   ├── editor/              # 编辑器组件
│   │   ├── hooks/               # 共享 Hooks（15 个）
│   │   ├── types/               # 类型定义
│   │   └── ui/                  # shadcn/ui 基础组件
│   │
│   └── server/                   # 服务端模块
│
├── db/                           # 数据库层
├── public/                        # 静态资源
├── middleware.ts                  # API 中间件
└── CODING_STANDARDS.md          # 编码规范
```

---

## 4. Gateway 客户端

### 4.1 WebSocket 协议

**文件**：`src/shared/lib/gateway-client.ts`

**帧格式**：

```typescript
// 请求
{ type: "req", id: "req-1-xxx", method: "cron.list", params: {} }

// 响应
{ type: "res", id: "req-1-xxx", ok: true, payload: { ... } }

// 事件（服务端推送）
{ type: "event", event: "snapshot", payload: { ... }, seq: 42 }
```

**握手流程**：

```
Client                          Gateway
  |-------- WebSocket Open ------->|
  |<-- connect.challenge (nonce) --|
  |-- connect (protocol:3,        |
  |    role:operator,              |
  |    scopes:[read,write],       |
  |    auth:{token:"xxx"}) ------>|
  |<----- hello-ok (policy) ------|
```

### 4.2 双模式连接

| 模式 | 连接方式 | 状态字段 | 数据获取 |
|------|----------|----------|---------|
| `browser_direct` | 浏览器直连 Gateway WS | `connected` | WebSocket 客户端 |
| `server_proxy` | 服务端代理连接 | `serverProxyConnected` | API 代理 + SSE |

**正确的连接判断**：

```tsx
const { connected, connectionMode, serverProxyConnected } = useGatewayStore();

const isConnected = connectionMode === 'server_proxy'
  ? serverProxyConnected
  : connected;

if (!isConnected) return <GatewayRequired />;
```

> ⚠️ 只检查 `connected` 在 `server_proxy` 模式下永远是 `false`

### 4.3 已实现的 API 方法

| 方法 | OpenClaw API | 说明 |
|------|-------------|------|
| `listCronJobs()` | `cron.list` | 获取定时任务列表 |
| `createCronJob(job)` | `cron.add` | 创建定时任务 |
| `deleteCronJob(jobId)` | `cron.remove` | 删除定时任务 |
| `runCronJob(jobId)` | `cron.run` | 手动触发执行 |
| `toggleCronJob(jobId, enabled)` | `cron.toggle` | 启用/禁用任务 |
| `getCronRuns(jobId)` | `cron.runs` | 获取执行历史 |
| `listAgents()` | `agent.list` | 获取 Agent 列表 |
| `listSessions()` | `session.list` | 获取会话列表 |
| `patchSession(key, patch)` | `session.patch` | 修改会话参数 |
| `deleteSession(key)` | `session.delete` | 删除会话 |
| `listSkills()` | `skill.list` | 获取技能列表 |
| `toggleSkill(skillKey, enabled)` | `skill.toggle` | 启用/禁用技能 |
| `saveSkillKey(skillKey, value)` | `skill.save-key` | 保存 API Key |
| `installSkill(skillKey, name, id)` | `skill.install` | 安装技能依赖 |
| `getSnapshot()` | `snapshot.get` | 获取系统快照 |

---

## 5. 核心模块说明

### 5.1 对话信道 `src/shared/lib/chat-channel/`

统一 AI 对话中的数据交互。

**入口分离**：
- `src/shared/lib/chat-channel/index.ts` — 服务端入口（完整功能）
- `src/shared/lib/chat-channel/client.ts` — 客户端入口（仅解析器）

**支持的 Actions**：
- 写入类：`update_task_status`, `add_comment`, `create_document`, `deliver_document` 等
- 状态类：`update_status`, `set_queue`
- SOP 类：`advance_sop_stage`, `request_sop_confirm`, `get_sop_context`, `save_stage_output`, `update_knowledge`, `create_sop_template`, `update_sop_template`, `create_render_template`, `update_render_template`
- 扩展类：`sync_identity`, `get_mcp_token`

**不支持**（需用 MCP API）：
- 查询类：`get_task`, `list_my_tasks`, `search_documents`
- 定时类：`create_schedule`, `update_schedule`, `delete_schedule`
- 配置类：`set_do_not_disturb`, `register_member`

### 5.2 OpenClaw 同步 `src/shared/lib/openclaw/`

Markdown 文件与 TeamClaw 数据双向同步。

**同步规则**：
- `teamclaw:tasks` — 批量创建/更新任务
- `teamclaw:deliveries` — 批量提交交付物
- `teamclaw:schedules` — 管理定时调度
- `teamclaw:milestones` — 管理里程碑

### 5.3 MCP 工具 `src/core/mcp/`

定义和执行 AI 可用的工具（37 个）。

**调用方式**：
- 内部：`POST /api/mcp`
- 外部：`POST /api/mcp/external` + Bearer Token

**新增 MCP 工具步骤**：
1. 在 `definitions.ts` 注册 JSON Schema 定义
2. 在 `src/domains/*/mcp.ts` 添加领域处理器
3. 在 `executor.ts` 添加 switch-case 分发

### 5.4 数据同步 `src/shared/lib/sync/`

| 文件 | 功能 |
|------|------|
| `task-sync.ts` | 任务数据同步 |
| `delivery-sync.ts` | 交付物同步 |
| `schedule-sync.ts` | 定时任务同步 |
| `milestone-sync.ts` | 里程碑数据同步 |
| `shared.ts` | 共用同步工具 |

### 5.5 Lucide 图标库 `src/shared/lib/icon-render.ts`

**为什么内置图标库？**

1. **CSP 安全约束**：生产环境 CSP 策略禁止外部 CDN 脚本
2. **渲染一致性**：React 组件使用 `lucide-react`；`dangerouslySetInnerHTML` 场景使用 `renderIconsInHtml()` 预渲染 SVG
3. **模板支持**：Markdown 模板使用 `:lucide:name:` 语法

**图标渲染流程**：

```
MD 模板 :lucide:check-square:
        ↓ simpleMdToHtml()
HTML <i data-lucide="check-square"></i>
        ↓ renderIconsInHtml()
SVG <svg>...</svg>（最终渲染）
```

---

## 6. 数据库层

**文件**：`src/core/db/schema.ts`（33 张表）+ `src/core/db/index.ts`（连接管理）

### 6.1 表结构概览

| 表名 | 用途 |
|------|------|
| `projects` | 项目 |
| `members` | 成员（人类+AI） |
| `tasks` | 任务（含 SOP 字段） |
| `task_logs` | 任务操作日志 |
| `comments` | 任务评论 |
| `documents` | Wiki 文档 |
| `milestones` | 里程碑 |
| `openclaw_status` | AI Agent 状态 |
| `scheduled_tasks` | 定时任务（本地） |
| `scheduled_task_history` | 定时任务执行历史 |
| `deliveries` | 文档交付 |
| `chat_sessions` | 聊天会话 |
| `chat_messages` | 聊天消息 |
| `openclaw_workspaces` | OpenClaw 工作区 |
| `openclaw_files` | OpenClaw 文件 |
| `openclaw_versions` | OpenClaw 版本 |
| `openclaw_conflicts` | OpenClaw 冲突 |
| `gateway_configs` | Gateway 配置 |
| `audit_logs` | 审计日志 |
| `sop_templates` | SOP 模板 |
| `render_templates` | 渲染模板 |
| `users` | 用户（v3.0 多用户认证） |
| `user_mcp_tokens` | 用户 MCP Token（v3.0） |
| `sop_stage_records` | SOP 阶段执行记录（v3.0） |
| `activity_logs` | 活动日志（v3.0） |
| `project_members` | 项目成员（v3.0） |
| `skills` | Skill 注册与管理（v3.0） |
| `skillSnapshots` | Agent Skill 快照（v3.0） |
| `skillTrustRecords` | Skill 信任记录（v3.0） |
| `approvalRequests` | 审批请求（v3.0） |
| `approvalHistories` | 审批历史（v3.0） |
| `approvalStrategies` | 审批策略（v3.0） |
| `landing_pages` | 首页内容 |

### 6.2 字段约定

| 约定 | 说明 |
|------|------|
| 主键 | Base58 短 ID（~11 字符），API 层生成 |
| 时间戳 | `integer` + `mode: 'timestamp'` |
| JSON 字段 | `text` + `mode: 'json'` + `$type<T>()` |
| 枚举 | `text` + `enum: [...]` |

### 6.3 连接配置

```typescript
// src/core/db/index.ts
const db = new Database('./data/teamclaw.db');
db.pragma('journal_mode = WAL');        // WAL 模式
db.pragma('foreign_keys = ON');          // 外键启用
db.pragma('cache_size = -64000');        // 64MB 缓存
db.pragma('busy_timeout = 5000');        // 5s 忙超时
```

### 6.4 自动迁移

`src/core/db/index.ts` 检测缺失的表/列并增量添加，无需手动编辑数据库文件。

---

## 7. REST API 规范

### 7.1 通用规范

#### 请求格式

```typescript
// Content-Type: application/json
{
  "field1": "value1",
  "field2": "value2"
}
```

#### 响应格式

```typescript
// 成功响应 — GET 列表端点返回裸数组
[{ "id": "xxx", ... }, ...]

// 成功响应 — GET 分页端点（传 page/limit 参数时）
{ "data": [...], "total": 100, "page": 1, "limit": 20 }

// 成功响应 — 单资源 GET/PUT/POST
{ "id": "xxx", "field": "value", ... }

// 错误响应
{ "error": "Error message" }
```

#### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 409 | 冲突（版本不匹配） |
| 500 | 服务器错误 |

### 7.2 API 设计规范

| 规范 | 说明 |
|------|------|
| RESTful | 集合 GET/POST，单体 GET/PUT/DELETE |
| 存在性校验 | PUT/DELETE **必须**校验资源存在性，不存在返回 404 |
| 敏感字段脱敏 | 敏感字段（如 openclawApiToken）响应前必须经 `@/shared/lib/sanitize` 脱敏 |
| 错误消息 | API 错误消息**必须使用英文**，前端通过 i18n `t()` 翻译展示 |
| PUT 白名单 | PUT 用 `allowedFields` 白名单过滤 |
| 级联删除 | 级联删除用 `db.transaction()` |

### 7.3 动态路由参数

```typescript
// 正确写法
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

---

## 8. MCP 指令系统

### 8.1 概述

MCP (Model Context Protocol) 指令系统提供标准化的 AI 操作接口，支持 AI 成员通过结构化指令操作平台数据。

**版本信息**：
- TeamClaw MCP Tools: v1.0.1
- 工具数量: 37 个
- 协议版本: OpenClaw Gateway Protocol v3

### 8.2 调用方式

#### 内部调用

```http
POST /api/mcp
Content-Type: application/json

{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "in_progress"
  }
}
```

#### 外部调用（需认证）

```http
POST /api/mcp/external
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "in_progress"
  }
}
```

### 8.3 工具列表

#### 任务相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_task` | `task_id` | 获取任务详情 |
| `list_my_tasks` | - | 获取当前 AI 成员的任务列表 |
| `update_task_status` | `task_id`, `status` | 更新任务状态 |
| `add_task_comment` | `task_id`, `content` | 添加评论 |
| `create_check_item` | `task_id`, `text` | 创建检查项 |
| `complete_check_item` | `task_id`, `item_id` | 完成检查项 |

#### 项目相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_project` | `project_id` | 获取项目详情 |
| `get_project_members` | `project_id` | 获取项目成员 |

#### 文档相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_document` | `document_id` 或 `title` | 获取文档 |
| `create_document` | `title`, `content` | 创建文档 |
| `update_document` | `document_id`, `content` | 更新文档 |
| `search_documents` | `query` | 搜索文档 |

#### 状态面板

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `update_status` | `status` | 更新 AI 状态 |
| `set_queue` | `queued_tasks` | 设置任务队列 |
| `set_do_not_disturb` | `interruptible` | 免打扰模式 |

#### 定时任务

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `create_schedule` | `title`, `task_type`, `schedule_type` | 创建定时任务 |
| `list_schedules` | - | 获取定时任务列表 |
| `update_schedule` | `schedule_id` | 更新定时任务 |
| `delete_schedule` | `schedule_id` | 删除定时任务 |

#### 交付相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `deliver_document` | `title`, `platform` | 提交文档交付 |
| `review_delivery` | `delivery_id`, `status` | 审核交付 |
| `list_my_deliveries` | - | 获取当前成员的交付物列表 |
| `get_delivery` | `delivery_id` | 获取交付物详情 |

#### SOP 引擎

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `advance_sop_stage` | `task_id` | 推进 SOP 到下一阶段 |
| `request_sop_confirm` | `task_id`, `confirm_message`, `stage_output` | 请求人工确认 |
| `get_sop_context` | `task_id` | 获取 SOP 执行上下文 |
| `save_stage_output` | `task_id`, `output` | 保存阶段产出 |
| `update_knowledge` | `document_id`, `content` | 向知识库追加经验 |
| `create_sop_template` | `name`, `stages` | 创建 SOP 模板 |
| `update_sop_template` | `template_id` | 更新 SOP 模板 |
| `create_render_template` | `name`, `html_template` | 创建渲染模板 |
| `update_render_template` | `template_id` | 更新渲染模板 |

### 8.4 参数类型定义

```typescript
// update_task_status
{
  task_id: string;
  status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
  progress?: number;         // 0-100
  message?: string;
}

// create_document
{
  title: string;
  content: string;           // Markdown
  doc_type?: 'report' | 'note' | 'decision' | 'scheduled_task' | 'task_list' | 'other';
  project_id?: string;
}

// update_status
{
  status: 'idle' | 'working' | 'waiting' | 'offline';
  current_action?: string;
  task_id?: string;
  progress?: number;
  member_id?: string;
}

// deliver_document
{
  title: string;
  platform: 'tencent-doc' | 'feishu' | 'notion' | 'local' | 'other';
  description?: string;
  document_id?: string;      // platform=local 时必填
  external_url?: string;     // 外部平台时必填
  task_id?: string;
}
```

### 8.5 对话中嵌入 Actions

在对话回复末尾可嵌入 JSON actions：

```json
{"actions": [
  {"type": "update_task", "task_id": "xxx", "status": "in_progress"},
  {"type": "add_comment", "task_id": "xxx", "content": "分析完成"},
  {"type": "update_status", "status": "working"},
  {"type": "deliver_document", "title": "报告", "platform": "local", "document_id": "xxx"},
  {"type": "ask_user", "question": "需要覆盖哪些竞品?", "options": ["A","B","C"]},
  {"type": "request_info", "info_type": "document", "query": "竞品分析"}
]}
```

---

## 9. Skill 开发指南

### 9.1 Skill 结构

```
skills/
├── SKILL.md                 # 主文档：AI 成员操作手册
└── references/              # 参考文档
    ├── system-info.md       # 系统信息模板
    ├── task-board.md        # 任务看板模板
    ├── task-push.md         # 任务推送模板
    ├── schedules.md         # 定时任务模板
    ├── deliveries.md        # 交付列表模板
    └── doc-template-*.md    # 文档模板
```

### 9.2 核心原则

**Markdown 优先**：涉及 ≥2 条记录的写操作，必须使用 Markdown 文档同步。单条字段更新使用 API。

| 操作类型 | 推荐方式 | 说明 |
|---------|---------|------|
| 批量创建任务 | MD 同步 | `create_document(teamclaw:tasks)` |
| 批量提交交付 | MD 同步 | `create_document(teamclaw:deliveries)` |
| 单字段更新 | API | `update_task_status` |
| 评论、查询 | API | `add_task_comment`, `get_task` |

### 9.3 任务 Markdown 语法

```markdown
- [ ] 普通任务          # status: todo, priority: medium
- [!] 高优先级任务       # status: todo, priority: high
- [-] 低优先级任务       # status: todo, priority: low
- [~] 进行中任务         # status: in_progress
- [?] 待审核任务         # status: reviewing
- [x] 已完成任务         # status: completed

@张三                    # 分配给成员张三
[[需求文档]]             # 关联文档
#task_abc123            # 引用任务 ID
```

---

## 10. 开发规范

### 10.1 必须遵守

| 规则 | 原因 |
|------|------|
| 所有 UI 文本必须用 `t()` | 国际化（`@/shared/lib/i18n`，en + zh） |
| 敏感字段返回前必须脱敏 | 安全（`@/shared/lib/sanitize`） |
| 编辑输入必须防抖 500ms | 性能（`useRef<setTimeout>`） |
| PUT/DELETE 必须检查资源存在性 | API 规范（404 if missing） |
| Store 更新必须用 API 返回数据 | 数据一致性 |
| Store fetchXxx 必须 Array.isArray 防御 | API 可能返回分页对象 |
| JSON 字段消费必须 Array.isArray 守卫 | SQLite 读出的 JSON 可能是字符串 |
| PUT 用 `allowedFields` 白名单 | 防止非法字段注入 |
| 级联删除用 `db.transaction()` | 数据完整性 |
| 成功后 `set({ error: null })` | Store 错误状态清理 |

### 10.2 常见陷阱

| 陷阱 | 解决方案 |
|------|----------|
| 客户端组件导入 `db` 或 `fs` | 使用 `client.ts` 入口分离 |
| 直接修改 Store 状态 | 使用 `xxxAsync` 方法 |
| `useEffect` 依赖整个对象 | 依赖具体字段 `[task?.id]` |
| 内联 `<style jsx>` | 使用 Tailwind CSS |
| 只检查 `connected` 判断 Gateway | 根据 `connectionMode` 双模式判断 |
| Enter + Blur 双重提交 | `submittedByEnterRef` 防重复 |
| Store 用 `data \|\| []` 处理 API 返回 | 必须用 `Array.isArray(data) ? data : (data?.data \|\| [])` |
| JSON 字段用 truthy 检查 | 必须用 `Array.isArray(field)` 守卫 |

---

## 11. 测试指南

### 11.1 测试类型

| 类型 | 框架 | 覆盖目标 |
|------|------|---------|
| 单元测试 | Vitest | 工具函数、Store 逻辑 |
| 集成测试 | Vitest | API 端点、数据库操作 |
| E2E 测试 | Playwright | 核心用户流程 |

### 11.2 运行测试

```bash
# 单元/集成测试
npm run test

# E2E 测试
npm run test:e2e

# 生成测试覆盖率
npm run test:coverage
```

### 11.3 测试数据

使用演示数据脚本生成测试数据：

```bash
npx tsx scripts/generate-demo-data.ts
```

---

## 12. 部署指南

### 12.1 生产环境部署

```bash
# 1. 构建
npm run build

# 2. 使用 PM2 托管
pm2 start ecosystem.config.cjs

# 3. 查看状态
pm2 status

# 4. 查看日志
pm2 logs teamclaw

# 5. 保存 PM2 配置
pm2 save
```

### 12.2 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `NODE_ENV` | 环境 | development |
| `DATABASE_URL` | 数据库路径 | ./data/teamclaw.db |

### 12.3 数据备份

```bash
# 备份数据库
cp data/teamclaw.db data/teamclaw.db.backup

# 定时备份（crontab）
0 2 * * * cp /path/to/teamclaw/data/teamclaw.db /backup/teamclaw_$(date +\%Y\%m\%d).db
```

---

## 附录

### A. 相关文档

| 文档 | 用途 | 路径 |
|------|------|------|
| 编码规范 | 开发约束 | `CODING_STANDARDS.md` |
| API 文档 | REST API 详情 | `docs/technical/API.md` |
| 组件文档 | UI 组件说明 | `docs/technical/COMPONENTS.md` |
| 用户手册 | 使用指南 | `docs/product/USER_GUIDE.md` |
| 产品需求 | 功能规划 | `docs/product/PRD.md` |
| 变更日志 | 版本历史 | `docs/process/CHANGELOG.md` |

### B. 问题排查

```bash
# 查找模块被谁引用（上游兼容性）
grep -r "from '@/shared/lib/chat-channel'" --include="*.ts" --include="*.tsx"

# 查找模块依赖什么（下游依赖）
grep -r "^import" src/shared/lib/chat-channel/*.ts

# 客户端不能导入服务端模块
grep -r "from '@/shared/lib/chat-channel'" src/features/
# 应该使用: from '@/shared/lib/chat-channel/client'
```

---

*本文档由 TeamClaw 团队维护，最后更新: 2026-03-23*
