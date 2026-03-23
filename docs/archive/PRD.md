# teamclaw-v2 产品需求文档 (PRD)

## 1. 产品定位

teamclaw-v2 是新一代 AI Agent 管理平台，定位为 **OpenClaw Gateway 的增强型前端**。

- **保留 TeamClaw 核心能力**：任务看板、项目管理、Wiki、聊天、文档交付
- **融合 OpenClaw Gateway 底层能力**：通过 WebSocket 直连 Gateway，复用定时任务、Agent 管理、会话管理、技能市场、状态监控等能力（OpenClaw 原生支持多 Agent 模式，取代原 Cowork 角色方案）
- **前提假设**：用户已安装并运行 OpenClaw Gateway（默认 `ws://localhost:18789`）

## 2. 技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        teamclaw-v2 (Next.js)                         │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 任务看板  │ │ 定时任务  │ │ 项目管理  │ │ Wiki     │ │ 成员管理  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 会话管理  │ │ 技能市场  │ │ 文档交付  │ │ 聊天     │ │ 设置     │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  WebSocket 客户端 (ws://<host>:18789, Protocol v3)           │ │
│  │  双模式：server_proxy（服务端代理）/ browser_direct（浏览器直连）│ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  本地数据层 (SQLite + Drizzle ORM)                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ WebSocket (OpenClaw Protocol v3)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐│
│  │ Agents │ │Sessions│ │  Cron  │ │ Skills │ │Snapshot│ │Channels││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └───────┘│
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                     │
│  │ Memory │ │Presence│ │  Logs  │ │ Config │                     │
│  └────────┘ └────────┘ └────────┘ └────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 14 + React 18 | App Router，Strict Mode |
| 状态管理 | Zustand | 19 个 Store |
| 样式 | Tailwind CSS 3.4 | 深色/浅色主题切换 |
| UI 组件 | shadcn/ui | 15 个基础组件 |
| 图标 | lucide-react | 统一图标库 |
| 数据库 | SQLite + Drizzle ORM | 本地数据存储，28 张表 |
| Gateway 连接 | WebSocket | OpenClaw Protocol v3，双模式 |
| 国际化 | i18next + react-i18next | 中英文 |
| 实时推送 | SSE | 本地数据变更通知 |
| 安全 | AES-256 加密 + CSRF + CSP | Token 加密存储 |

### 数据流

```
双数据源架构:

1. Gateway 数据 (WebSocket):
   用户 → Zustand Store → gateway-client.ts → WebSocket → OpenClaw Gateway
   (定时任务、Agent 状态、会话、技能、系统快照)
   双模式：
   - server_proxy: 服务端维护连接，浏览器通过 API 代理 + SSE 获取数据
   - browser_direct: 浏览器直接建立 WebSocket 连接到 Gateway

2. 本地数据 (SQLite):
   用户 → Zustand Store → data-service.ts → API Routes → Drizzle → SQLite
   (任务、项目、成员、文档、聊天、交付)
   SSE EventBus 广播变更 → DataProvider 自动刷新

3. MCP 指令 (AI Agent → TeamClaw):
   AI Agent → /api/mcp（或 /api/mcp/external + Bearer Token）→ executor → DB + SSE
```

## 3. 功能模块

### 3.1 首页仪表盘 (Dashboard)

**功能：**
- Gateway 连接管理（URL + Token 输入，独立于 Settings 页面）
- 连接状态指示（连接中/已连接/未连接，兼容双模式判断）
- 统计卡片（进行中任务、审核中任务、待审交付、工作中 AI 数量）
- 快捷入口网格（7 个：任务、Wiki、成员、交付、项目、Agents、定时任务）
- Gateway 状态展示（Snapshot、Health、Sessions、Cron Jobs、Agents、Skills）

**数据来源：** OpenClaw Gateway `snapshot.get` + 本地 SQLite 统计

---

### 3.2 定时任务 (Scheduler)

> 复用 OpenClaw Cron 底层能力，替代 TeamClaw 的 Agent 转发方案

**核心功能：**
- 可视化调度配置（支持三种模式）：
  - `every`：间隔执行（毫秒）
  - `at`：一次性定时
  - `cron`：标准 Cron 表达式 + 时区
- Session 目标：`main`（主会话）/ `isolated`（隔离会话）
- Wake 模式：`now`（立即）/ `next-heartbeat`（下次心跳）
- Payload 类型：
  - `systemEvent`：系统事件（纯文本）
  - `agentTurn`：Agent 对话轮（message + thinking + timeout）
- 投递模式：`announce`（通知）/ `webhook` / `none`
- 任务启用/禁用、手动触发执行、删除
- 执行历史查看（状态/摘要/耗时/关联会话）
- 调度器全局状态面板（启用状态/任务数/下次唤醒时间）

**数据来源：** OpenClaw Gateway
- `cron.list` — 获取任务列表和调度器状态
- `cron.add` — 创建定时任务
- `cron.remove` — 删除定时任务
- `cron.run` — 手动触发执行
- `cron.toggle` — 启用/禁用任务
- `cron.runs` — 获取执行历史

---

### 3.3 成员管理 (Members)

> 融合 TeamClaw 成员管理 + OpenClaw Agent/Snapshot 能力

**核心功能：**
- 成员列表（人类 + AI Agent）
- Agent 实时状态监控（Idle/Working/Waiting/Offline）
- 消息计数
- 成员配置：
  - OpenClaw 部署模式（cloud/local/knot）
  - Knot 平台配置（Agent ID/API Token/模型/温度/Web搜索）
  - 执行模式（chat_only/api_first/api_only）
- 成员创建/编辑/删除
- AI 成员自注册（通过 MCP `register_member` 工具，幂等设计）
- Quick Setup 一键配置
- 用户使用手册快捷入口（链接到 Wiki `/wiki?doc=VrihWxkCoM9Q`）

**初始化：**
- 仅预置 1 个默认人类用户
- AI 成员通过连接 OpenClaw Gateway 后由 Agent 自动注册，不预置

**数据来源：**
- 本地 SQLite `members` 表 — 成员基础信息和配置
- OpenClaw Gateway `agent.list` — Agent 实时状态
- OpenClaw Gateway `snapshot.get` — 系统快照

---

### 3.4 会话管理 (Sessions)

> 复用 OpenClaw Session 能力，增强 UI

**核心功能：**
- 活跃会话列表（筛选：时间范围/数量限制/包含 global/unknown）
- 会话信息：Key、Kind（direct/group/global/unknown）、Label、更新时间、Token 用量
- 在线编辑会话参数：
  - Label（标签）
  - Thinking Level（off/minimal/low/medium/high/xhigh）
  - Verbose Level（inherit/off/on/full）
  - Reasoning Level（off/on/stream）
- 删除会话
- 链接到聊天记录

**数据来源：** OpenClaw Gateway
- `session.list` — 会话列表
- `session.patch` — 修改会话参数
- `session.delete` — 删除会话

---

### 3.5 技能市场 (Skills)

> 复用 OpenClaw Skills 能力

**核心功能：**
- 技能列表（分组：workspace / built-in）
- 搜索过滤
- 技能详情：名称、描述、Emoji、来源、依赖状态
- 启用/禁用技能
- 依赖安装（brew/node/go/uv）
- API Key 管理（编辑/保存）
- 缺失依赖/配置提示

**数据来源：** OpenClaw Gateway
- `skill.list` — 获取技能报告（含状态、依赖、配置检查）
- `skill.toggle` — 启用/禁用技能
- `skill.save-key` — 保存 API Key
- `skill.install` — 安装依赖

---

### 3.6 任务看板 (Tasks) — TeamClaw 核心能力

**核心功能：**
- 双视图：看板视图（四列拖拽）/ 列表视图（表格）
- 状态流转：待办 → 进行中 → 审核中 → 已完成
- 优先级：高/中/低
- 拖拽排序（HTML5 Drag & Drop）
- 任务详情抽屉：
  - 标题/描述编辑
  - 检查项（Checklist）管理
  - 截止日期
  - 成员分配
  - 评论系统
  - 操作日志
- 新建任务（独立页面）
- 跨项目任务关联
- 按项目/成员/全局/跨项目过滤

**数据来源：** 本地 SQLite
- `tasks` 表 — 任务 CRUD
- `comments` 表 — 任务评论
- `taskLogs` 表 — 操作日志

---

### 3.7 项目管理 (Projects)

**核心功能：**
- 项目列表/创建/编辑/删除
- 当前项目切换（持久化到 localStorage）
- 项目成员分配
- 项目维度数据过滤（任务/文档/成员）

**初始化：** 不预置项目，由用户自行创建

**数据来源：** 本地 SQLite `projects` 表

---

### 3.8 知识库 Wiki (Documents)

**核心功能：**
- 文档创建/编辑/删除
- Markdown 编辑器
- 双向链接（`[[文档名]]` 语法）
- 反向链接计算
- 文档图谱可视化
- 多项目标签归类
- 全文搜索
- Frontmatter 自动生成/更新
- 文档来源：本地创建 / 外部导入
- 文档类型分组（guide/reference/note/report/decision/scheduled_task/task_list/other）

**初始化：** 3 篇内置文档（用户使用手册、开发者手册、API 文档），ID 固定

**数据来源：** 本地 SQLite `documents` 表

---

### 3.9 文档交付 (Deliveries)

**核心功能：**
- 交付记录列表
- 审核流程（待审核/已通过/已拒绝/需修改）
- 交付详情
- 版本追踪

**数据来源：** 本地 SQLite `deliveries` 表

---

### 3.10 聊天 (Chat)

**核心功能：**
- 聊天会话列表
- 消息收发（支持 AI 回复）
- 实体绑定（绑定到任务/定时任务/项目）
- Knot conversationId 关联
- 乐观更新
- AI 执行模式支持：
  - `chat_only`：纯聊天对话
  - `api_first`：优先 API 操作，失败回退聊天
  - `api_only`：仅 API 操作
- MCP 指令解析与执行
- Thinking 级别控制（low/medium/high）
- Gateway 双模式兼容（server_proxy / browser_direct）

**数据来源：**
- 本地 SQLite `chatSessions` + `chatMessages` 表
- OpenClaw Gateway / Knot API — AI 回复

---

### 3.11 系统设置 (Settings)

**5 个 Tab：**

| Tab | 功能 |
|-----|------|
| 通用 | 主题切换（浅色/深色）、语言切换（中/英）、数据刷新 |
| OpenClaw 设置 | Workspace 管理（CRUD）、Gateway 配置（URL/Token/模式）、SSH 隧道说明 |
| 安全设置 | SSRF 防护、外网访问控制、DNS 重绑定防护、0.0.0.0 绑定拦截 |
| 调试工具 | DebugPanel（动态加载） |
| 关于 | 版本号 v0.4.6、技术栈信息 |

---

### 3.12 OpenClaw Workspace 同步

**核心功能：**
- Workspace 管理（创建/编辑/删除）
- 文件双向同步（TeamClaw ↔ OpenClaw Agent）
- 版本历史追踪
- 冲突检测与解决
- 排除规则配置
- 手动同步/扫描/推送/拉取

**数据来源：** 本地 SQLite `openclawWorkspaces` + `openclawFiles` + `openclawVersions` + `openclawConflicts` 表

---

## 4. 数据库设计

19 张表（Drizzle ORM + SQLite）：

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| `projects` | 项目 | id, name, description, source |
| `members` | 成员 | id, name, type(human/ai), OpenClaw 配置, 执行模式, configSource |
| `tasks` | 任务 | id, title, status, priority, deadline, assignees, checkItems, projectId |
| `taskLogs` | 任务日志 | id, taskId, action, message |
| `comments` | 评论 | id, taskId, authorId, content |
| `documents` | 文档 | id, title, content, type, projectTags, source, links, backlinks |
| `milestones` | 里程碑 | id, title, description, projectId, status, dueDate |
| `openclawStatus` | AI 实时状态 | id, memberId, status, currentTask, progress, queuedTasks, interruptible |
| `scheduledTasks` | 定时任务 | id, memberId, title, taskType, scheduleType, config, enabled |
| `scheduledTaskHistory` | 执行历史 | id, scheduledTaskId, status, result, deliverableType |
| `deliveries` | 交付记录 | id, memberId, taskId, documentId, status, platform, version |
| `chatSessions` | 聊天会话 | id, memberId, title, conversationId, entityType, entityId |
| `chatMessages` | 聊天消息 | id, sessionId, role, content, status |
| `openclawWorkspaces` | OpenClaw Workspace | id, memberId, path, syncEnabled, watchEnabled |
| `openclawFiles` | OpenClaw 文件 | id, workspaceId, documentId, relativePath, hash, syncStatus |
| `openclawVersions` | OpenClaw 版本 | id, fileId, version, hash, content, diffPatch |
| `openclawConflicts` | OpenClaw 冲突 | id, fileId, localHash, remoteHash, status, resolution |
| `gatewayConfigs` | Gateway 配置 | id, url, encryptedToken, mode(server_proxy/browser_direct), status |
| `auditLogs` | 审计日志 | id, action, entityType, entityId, details, ipAddress |
| `sopTemplates` | SOP 模板 | id, name, description, category, stages(JSON), status, knowledgeConfig |
| `renderTemplates` | 渲染模板 | id, name, category, htmlTemplate, slots(JSON), sections(JSON) |

## 5. MCP 指令系统

37 个 MCP 工具供 AI Agent 调用。详细工具列表及参数说明请参阅 [用户手册 - MCP 指令系统](../product/USER_GUIDE.md#3-mcp-指令系统)。

**访问方式：**
- 内部：`/api/mcp`
- 外部：`/api/mcp/external` + Bearer Token 认证（CSRF 豁免）

## 6. 国际化

- 支持中文 / 英文切换
- 语言检测优先级：localStorage → 浏览器语言 → 回退英文
- 所有 UI 文本通过 `t('key')` 引用
- 翻译覆盖所有模块（nav/tasks/scheduler/members/sessions/skills/projects/wiki/chat/settings）

## 7. 实时能力

| 能力 | 实现方式 | 说明 |
|------|----------|------|
| Gateway 数据 | WebSocket 事件订阅 | Agent 状态、Cron 状态等实时推送 |
| 本地数据变更 | SSE (Server-Sent Events) | API 操作后通过 EventBus 广播 |
| 标签页同步 | visibilitychange 事件 | 标签页切回时自动刷新 |

## 8. 安全

- Gateway Token AES-256 加密存储（`lib/security.ts`）
- API Token 脱敏（仅显示末 4 位，`lib/sanitize.ts`）
- 禁止前端硬编码 Token
- API 响应过滤敏感字段
- 中间件安全防护：
  - CSP 内容安全策略
  - CSRF 防护（Origin/Referer 检查）
  - 安全响应头（X-Frame-Options、X-XSS-Protection 等）
  - 请求体 1MB 限制
- 安全设置面板：SSRF 防护、外网访问控制、DNS 重绑定防护
- 输入验证 + 限流保护

## 9. 部署方式

```bash
# 1. 确保 OpenClaw Gateway 已运行 (ws://localhost:18789)

# 2. 安装依赖
cd teamclaw-v2
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问 http://localhost:3000

# 5. 生产部署（使用 deploy.sh，standalone 输出模式）
chmod +x scripts/deploy.sh && ./scripts/deploy.sh
```

## 10. 与 TeamClaw v1 / OpenClaw Dashboard 对比

| 功能 | TeamClaw v1 | OpenClaw Dashboard | teamclaw-v2 |
|------|-----------|-------------------|-----------|
| 定时任务 | ❌ Agent 转发，易丢失 | ✅ 配置文件 Cron | ✅ 可视化 + WebSocket API |
| 任务看板 | ✅ 核心能力 | ❌ 无 | ✅ 保留并增强 |
| 项目管理 | ✅ 支持 | ❌ 无 | ✅ 保留 |
| Wiki/文档 | ✅ 双向链接 | ❌ 无 | ✅ 保留并增强（图谱可视化） |
| 状态监控 | ⚠️ 简单 | ✅ Snapshot | ✅ 借鉴 Snapshot |
| Agent 管理 | ⚠️ 基础 | ✅ 完整 | ✅ 全面借鉴 + MCP 自注册 |
| 会话管理 | ⚠️ 仅 UI | ✅ 完整参数控制 | ✅ 借鉴 + 优化 UI |
| 技能市场 | ❌ 无 | ✅ 完整 | ✅ 全面借鉴 |
| 文档交付 | ✅ 审核流 | ❌ 无 | ✅ 保留 + 版本追踪 |
| 聊天 | ✅ 多模式 | ✅ 多平台 | ✅ 保留 + 融合 + Thinking |
| MCP 指令 | ✅ 18 种指令 | ❌ 无 | ✅ 37 种指令 |
| 多语言 | ❌ 仅中文 | ❌ 仅英文 | ✅ 中英文 |
| Workspace 同步 | ❌ 无 | ❌ 无 | ✅ 双向同步 + 冲突解决 |
| 安全防护 | ⚠️ 基础 | ⚠️ 基础 | ✅ 完整（加密/CSRF/CSP/SSRF） |
| Gateway 模式 | ❌ 无 | ❌ 单一 | ✅ 双模式（server_proxy / browser_direct） |

## 11. 后续规划

- [x] Phase 1: 完善所有页面 UI
- [x] Phase 2: 接入本地 SQLite 数据层（任务/项目/文档/成员）
- [x] Phase 3: 实现聊天模块（整合 OpenClaw + Knot 双模式）
- [x] Phase 4: 实现 MCP 指令系统（37 种工具）
- [x] Phase 5: SSE 实时推送 + DataProvider
- [x] Phase 5.5: 全平台国际化 (i18n) 支持 — **v0.1.0**
- [x] Phase 6: Markdown 双向同步、模板引擎迁移 — **v0.1.0**
- [x] Phase 7: 多 Agent 模式（由 OpenClaw Gateway 原生支持，取代 Cowork 角色）
- [x] Phase 8: 文档双向链接 + 图谱可视化（双链自动持久化 + 知识图谱面板已完成）
- [x] Phase 8.5: OpenClaw Workspace 双向同步 + 冲突解决 — **v0.1.5**
- [x] Phase 9: Gateway 双模式（server_proxy / browser_direct）+ 安全加固 — **v0.2.3**
- [ ] Phase 10: 数据统计/分析面板（Dashboard 数据可视化：任务完成率、Agent 活跃度等）
- [ ] Phase 11: 插件扩展机制（支持第三方插件加载）
- [ ] Phase 12: 数据库上云（SQLite → PostgreSQL/MySQL，支持多设备访问，Drizzle ORM 方言切换）
- [x] Phase 13: 多用户支持（NextAuth.js 认证、数据隔离 userId/teamId、权限模型 admin/member/viewer）
- [ ] Phase 14: 多 Gateway 平台支持（Gateway Provider 抽象层：OpenClaw/Knot/Custom）
