# TeamClaw  迁移参考（归档）

> **状态**：已归档（2026-02-22）
> **原文件**：`docs/DEVELOPMENT.md` Section 1, 2, 5
> **归档原因**：迁移已完成，这些章节仅供历史回溯

---

## 1. 参考代码目录

```
sense/
├── openclaw-reference/              # OpenClaw 源码 (仅供参考，不修改)
│   ├── ui/src/ui/
│   │   ├── views/cron.ts           # 定时任务 UI (583 行)
│   │   ├── views/overview.ts       # 系统概览 UI (298 行)
│   │   ├── views/sessions.ts       # 会话管理 UI (322 行)
│   │   ├── views/skills.ts         # 技能市场 UI (193 行)
│   │   ├── views/skills-grouping.ts
│   │   ├── views/skills-shared.ts
│   │   └── types.ts                # 核心类型定义 (567 行, 50+ 类型)
│   ├── src/                         # Gateway 核心逻辑
│   ├── docs/gateway/protocol.md    # WebSocket 协议文档
│   └── skills/                      # 54+ 内置技能
│
├── teamclaw/                          # TeamClaw v1 现有版本 (直接复用)
│   ├── src/db/
│   │   ├── schema.ts               # 数据库 Schema (13 张表, 425 行)
│   │   └── index.ts                # SQLite 连接 + 自动建表 + 迁移 (384 行)
│   ├── src/app/api/                 # 20+ 组 API 路由 (REST + SSE + MCP)
│   ├── src/store/                   # 12 个 Zustand Store
│   ├── src/lib/                     # 工具库
│   │   ├── data-service.ts          # 数据访问层 (325 行)
│   │   ├── event-bus.ts             # SSE 事件总线 (128 行)
│   │   ├── chat-context.ts          # 聊天上下文注入 (322 行)
│   │   ├── wiki.ts                  # Wiki 双向链接 (301 行)
│   │   ├── markdown-sync.ts         # Markdown ↔ 看板双向同步 (1097 行)
│   │   ├── template-engine.ts       # 模板引擎 (406 行)
│   │   ├── validators.ts            # 输入校验 (120 行)
│   │   ├── sanitize.ts              # 数据脱敏 (15 行)
│   │   └── openclaw/                # OpenClaw 客户端 (HTTP 代理模式)
│   │       ├── client.ts            # 客户端类 (607 行)
│   │       ├── types.ts             # 类型定义 (170 行)
│   │       └── utils.ts             # 工具函数 (90 行)
│   ├── src/core/                    # 核心逻辑
│   │   ├── member-resolver.ts       # 成员解析器
│   │   └── mcp/                     # MCP 指令系统
│   │       ├── definitions.ts       # 工具定义
│   │       ├── types.ts             # 18 种指令类型
│   │       ├── parser.ts            # 指令解析器
│   │       └── executor.ts          # 指令执行器
│   └── src/components/              # 23 个 UI 组件
│       ├── DataProvider.tsx          # 数据初始化 + SSE 实时同步 (158 行)
│       ├── TaskDrawer.tsx            # 任务详情抽屉 (最大组件)
│       ├── chat/ChatPanel.tsx        # 聊天面板 (核心组件)
│       └── ...
│
└── teamclaw-v2/                       # 新版本 (当前开发)
    ├── app/                         # Next.js App Router 页面
    ├── lib/                         # 核心库
    ├── stores/                      # Zustand 状态管理
    ├── types/                       # 类型定义
    └── components/                  # UI 组件
```

---

## 2. 模块复用映射表

### 2.1 定时任务 (Scheduler)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **UI 参考** | `openclaw-reference/ui/src/ui/views/cron.ts` | `app/scheduler/page.tsx` | Lit → React 重写 |
| **类型参考** | `openclaw-reference/ui/src/ui/types.ts` | `types/index.ts` | CronJob 相关类型 |
| **WebSocket API** | 自实现 | `lib/gateway-client.ts` | cron.* 方法 |
| **本地数据参考** | `teamclaw/src/db/schema.ts` → `scheduledTasks` 表 | - | 本地缓存 |
| **Store 参考** | `teamclaw/src/store/schedule.store.ts` | `stores/schedule.store.ts` | Zustand 模式 |

### 2.2 成员管理 (Members)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **UI 参考** | `openclaw-reference/ui/src/ui/views/overview.ts` | `app/members/page.tsx` | Snapshot UI |
| **UI 复用** | `teamclaw/src/components/MemberCard.tsx` | `components/MemberCard.tsx` | 成员卡片 |
| **数据库** | `teamclaw/src/db/schema.ts` → `members` 表 | `db/schema.ts` | 成员信息 |
| **API 复用** | `teamclaw/src/app/api/members/**` | `app/api/members/**` | 成员 CRUD |
| **Store 复用** | `teamclaw/src/store/member.store.ts` | `stores/member.store.ts` | 114 行 |
| **Gateway API** | - | `lib/gateway-client.ts` | agent.list, snapshot.get |

### 2.3 会话管理 (Sessions)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **UI 参考** | `openclaw-reference/ui/src/ui/views/sessions.ts` | `app/sessions/page.tsx` | 参考筛选/编辑 |
| **类型参考** | `openclaw-reference/ui/src/ui/types.ts` | `types/index.ts` | 会话类型 |
| **Gateway API** | - | `lib/gateway-client.ts` | session.* 方法 |

### 2.4 技能市场 (Skills)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **UI 参考** | `openclaw-reference/ui/src/ui/views/skills.ts` | `app/skills/page.tsx` | 分组/过滤 |
| **类型参考** | `openclaw-reference/ui/src/ui/types.ts` | `types/index.ts` | 技能类型 |
| **Gateway API** | - | `lib/gateway-client.ts` | skill.* 方法 |

### 2.5 任务看板 (Tasks)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据库** | `teamclaw/src/db/schema.ts` → tasks 表 | `db/schema.ts` | 直接复用 |
| **API 复用** | `teamclaw/src/app/api/tasks/**` | `app/api/tasks/**` | 直接复用 |
| **Store 复用** | `teamclaw/src/store/task.store.ts` | `stores/task.store.ts` | 90 行 |
| **UI 复用** | `teamclaw/src/components/TaskCard.tsx` | `components/TaskCard.tsx` | 任务卡片 |

### 2.6 项目管理 (Projects)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据库** | `teamclaw/src/db/schema.ts` → projects 表 | `db/schema.ts` | 直接复用 |
| **API 复用** | `teamclaw/src/app/api/projects/**` | `app/api/projects/**` | 直接复用 |
| **Store 复用** | `teamclaw/src/store/project.store.ts` | `stores/project.store.ts` | 91 行 |

### 2.7 知识库 Wiki (Documents)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据库** | `teamclaw/src/db/schema.ts` → documents 表 | `db/schema.ts` | 直接复用 |
| **API 复用** | `teamclaw/src/app/api/documents/**` | `app/api/documents/**` | 直接复用 |
| **Lib 复用** | `teamclaw/src/lib/wiki.ts` | `lib/wiki.ts` | 双向链接/图谱 |

### 2.8 文档交付 (Deliveries)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据库** | `teamclaw/src/db/schema.ts` → deliveries 表 | `db/schema.ts` | 直接复用 |
| **API 复用** | `teamclaw/src/app/api/deliveries/**` | `app/api/deliveries/**` | 直接复用 |

### 2.9 聊天 (Chat)

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据库** | `teamclaw/src/db/schema.ts` → chatSessions/chatMessages 表 | `db/schema.ts` | 直接复用 |
| **API 复用** | `teamclaw/src/app/api/chat-*/**` | `app/api/chat-*/**` | 直接复用 |
| **Store 复用** | `teamclaw/src/store/chat.store.ts` | `stores/chat.store.ts` | 359 行 |
| **UI 复用** | `teamclaw/src/components/chat/ChatPanel.tsx` | `components/chat/ChatPanel.tsx` | 聊天面板 |

### 2.10 公共能力

| 复用类型 | 源文件 | 目标文件 | 说明 |
|----------|--------|----------|------|
| **数据访问层** | `teamclaw/src/lib/data-service.ts` | `lib/data-service.ts` | 统一 API 调用 |
| **SSE 事件总线** | `teamclaw/src/lib/event-bus.ts` | `lib/event-bus.ts` | 实时推送 |
| **数据初始化** | `teamclaw/src/components/DataProvider.tsx` | `components/DataProvider.tsx` | SSE + 首次加载 |
| **MCP 系统** | `teamclaw/src/core/mcp/**` | `core/mcp/**` | 指令定义/解析/执行 |

---

## 5. 开发计划（v1→v2 迁移）

### Phase 1: 数据层搭建

从 `teamclaw/src/` 复制并适配：db/schema.ts, db/index.ts, lib/data-service.ts, lib/event-bus.ts, lib/validators.ts, lib/sanitize.ts, app/api/ 路由。

### Phase 2: Store 层搭建

从 `teamclaw/src/store/` 复制所有 Store 文件并适配。

### Phase 3: 页面完善

| 页面 | 操作 |
|------|------|
| `tasks/page.tsx` | 接入 task.store + SQLite |
| `scheduler/page.tsx` | 参考 openclaw cron.ts 完善 |
| `members/page.tsx` | 接入 member.store + Agent 合并 |
| `sessions/page.tsx` | 参考 openclaw sessions.ts 重写 |
| `skills/page.tsx` | 参考 openclaw skills.ts 重写 |
| `projects/page.tsx` | 接入 project.store |
| `wiki/page.tsx` | 新建 |
| `deliveries/page.tsx` | 新建 |
| `settings/page.tsx` | 新建 |

### Phase 4: 组件迁移

从 teamclaw 复用 DataProvider, Header, Sidebar, TaskCard, TaskDrawer, ProjectCard, MemberCard, MarkdownEditor, ChatPanel, ErrorBoundary 等组件。
