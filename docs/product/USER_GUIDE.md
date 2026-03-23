# TeamClaw 产品说明书

> **TeamClaw** 是 AI Agent 管理平台，帮助团队高效管理 AI 智能体、任务协作、文档知识库。
>
> - **目标用户**：产品团队、研发团队、AI 应用团队
> - **当前版本**：v1.0.1
> - **最后更新**：2026-03-12

---

## 目录

1. [产品介绍](#1-产品介绍)
2. [快速开始](#2-快速开始)
3. [功能指南](#3-功能指南)
4. [常见问题](#4-常见问题)
5. [附录](#附录)

---

> **📷 截图说明**：本文档中的截图可通过以下命令生成：
> ```bash
> # 1. 确保开发服务器运行
> npm run dev
>
> # 2. 生成截图（自动处理登录）
> npx tsx scripts/run-screenshots.ts
> ```
> 截图保存位置：`docs/screenshots/`

---

## 1. 产品介绍

### 1.1 什么是 TeamClaw

TeamClaw 是一个 **AI Agent 管理平台**，作为 [OpenClaw Gateway](https://openclaw.ai) 的增强型前端，提供完整的人机协作能力。

```
┌─────────────────────────────────────────────────────────┐
│                      TeamClaw 平台                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 任务管理 │ │ 文档Wiki │ │ 成员协作 │ │ SOP工作流 │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                         ↓                                │
│              ┌─────────────────────┐                    │
│              │   OpenClaw Gateway  │                    │
│              │   (AI 智能体运行时)   │                    │
│              └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 核心功能

| 功能模块 | 说明 |
|---------|------|
| **任务管理** | 可视化看板、多项目支持、AI 协作、里程碑管理 |
| **文档 Wiki** | Markdown 编辑、双向链接、知识图谱、批注系统 |
| **SOP 工作流** | 标准化操作流程、AI 自动执行、知识库集成 |
| **Agent 管理** | Agent 状态监控、会话管理、技能配置 |
| **成员协作** | 人类成员 + AI 成员、角色权限、多项目协作 |
| **定时任务** | Cron/Interval/At 多种调度模式 |
| **文档交付** | 多平台交付、审核流程、版本管理 |
| **Skill 管理** | Skill 注册/审批/信任管理/快照监控 (v3.0) |
| **审批系统** | 通用审批流程、多场景支持 (v3.0) |

### 1.3 适用场景

- **AI 辅助开发**：AI 成员参与代码开发、文档编写、测试
- **内容生产**：AI 辅助创作文章、案例、报告
- **数据分析**：AI 执行数据采集、分析、可视化
- **流程自动化**：SOP 工作流标准化重复任务
- **知识管理**：团队知识库沉淀与检索

### 1.4 技术架构

| 层级 | 技术栈 |
|------|--------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS |
| 数据库 | SQLite + Drizzle ORM |
| 通信 | WebSocket (Gateway) + SSE (实时推送) |
| AI 协议 | MCP (Model Context Protocol) |

---

## 2. 快速开始

### 2.1 获取 TeamClaw

#### 方式一：GitHub 下载（推荐）

```bash
# 克隆仓库
git clone https://github.com/your-org/teamclaw-v3.git
cd teamclaw-v3

# 安装依赖
npm install
```

#### 方式二：下载发布包

从 [GitHub Releases](https://github.com/your-org/teamclaw-v3/releases) 下载最新版本压缩包。

### 2.2 部署方式

TeamClaw 支持多种部署方式，根据团队规模和需求选择：

#### 方式一：OpenClaw 机器部署（推荐）

适用于已部署 OpenClaw Gateway 的环境，TeamClaw 作为前端界面运行。

**前置条件**：
- OpenClaw Gateway 已运行（默认 `ws://localhost:18789`）
- Node.js 18+ 环境

**部署步骤**：

```bash
# 1. 构建生产版本
npm run build

# 2. 启动服务（默认端口 3000）
npm run start

# 或使用 PM2 托管
pm2 start ecosystem.config.cjs
```

#### 方式二：独立部署

适用于无需 OpenClaw Gateway 的场景，仅使用本地功能（任务、文档、成员）。

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm run start
```

#### 方式三：Docker 部署（计划中）

```bash
docker run -d -p 3000:3000 teamclaw/teamclaw:latest
```

### 2.3 首次初始化

首次访问 TeamClaw 会自动进入初始化流程：

1. **访问首页**：打开浏览器访问 `http://localhost:3000`
2. **初始化向导**：系统检测到未初始化，自动跳转到 `/init` 页面
3. **创建管理员**：
   - 填写管理员用户名
   - 填写邮箱（登录账号）
   - 设置密码（至少 8 位，包含字母和数字）
4. **完成初始化**：点击「创建管理员」按钮
5. **自动登录**：初始化成功后自动登录并跳转到工作台

> **注意**：初始化只能执行一次，创建的管理员账户拥有系统最高权限。

### 2.4 配置 OpenClaw Gateway

如需使用 Agent、会话、技能等 Gateway 功能，需配置连接：

1. 进入 **系统设置** 页面（`/settings`）
2. 填写 Gateway 配置：
   - **WebSocket 地址**：如 `ws://localhost:18789`
   - **Token**：Gateway 认证 Token（可选）
3. 点击「保存配置」
4. 系统自动连接并同步数据

### 2.5 生成演示数据

如需快速体验 TeamClaw 功能，可生成演示数据：

```bash
npx tsx scripts/generate-demo-data.ts
```

演示数据包含：
- 1 个演示项目
- 4 个成员（2 人类 + 2 AI）
- 15 个任务（覆盖所有状态）
- 5 个文档
- 3 个交付物
- 1 个 SOP 模板

---

## 3. 功能指南

### 3.1 工作台 (Dashboard)

**入口**：点击侧边栏「工作台」或访问 `/dashboard`

工作台是 TeamClaw 的核心入口页面，提供系统概览和快捷操作。

![工作台](./screenshots/dashboard.png)

#### 功能区域

| 区域 | 说明 |
|------|------|
| **连接状态** | 显示 OpenClaw Gateway 连接状态 |
| **系统快照** | CPU、内存、运行时间等系统信息 |
| **数据统计** | 任务数、项目数、成员数概览 |
| **快捷入口** | 各功能模块的快速访问卡片 |
| **最近活动** | 近期任务、文档更新记录 |

#### 状态指示器

| 状态 | 图标 | 说明 |
|------|------|------|
| 已连接 | 🟢 | Gateway 正常连接 |
| 断开连接 | 🔴 | Gateway 未连接或断开 |
| 服务端代理 | 🟡 | 使用服务端代理模式连接 |

---

### 3.2 任务管理

**入口**：点击侧边栏「任务」或访问 `/tasks`

任务管理是 TeamClaw 的核心功能，提供可视化的看板视图。

![任务看板](./screenshots/task-board.png)

#### 看板视图

任务以卡片形式展示在看板上，按状态分为四列：

| 列 | 说明 |
|----|------|
| **待办** | 新创建或未开始的任务 |
| **进行中** | 正在执行的任务 |
| **审核中** | 等待审核的任务 |
| **已完成** | 已完成的任务 |

#### 泳道分组

任务可按项目或成员分组显示：
- **按项目分组**：每个项目一个泳道
- **按成员分组**：每个成员一个泳道

#### 里程碑管理

在项目泳道下，任务按里程碑进一步分组：
- 点击里程碑标题可折叠/展开
- 支持创建、编辑、删除里程碑
- 设置里程碑截止日期

#### 任务操作

| 操作 | 说明 |
|------|------|
| **创建任务** | 点击右上角「新建任务」按钮 |
| **编辑任务** | 点击任务卡片打开详情抽屉 |
| **拖拽移动** | 拖拽任务卡片改变状态或分组 |
| **批量操作** | 按住 Shift 多选，批量变更状态/删除 |
| **与 AI 讨论** | 任务详情中点击 AI 图标发起对话 |

#### 任务详情

点击任务卡片打开详情抽屉，包含：
- **基本信息**：标题、描述、优先级、截止日期
- **检查项**：子任务列表，支持完成进度追踪
- **分配成员**：支持多成员分配
- **评论**：任务讨论记录
- **操作日志**：完整的变更历史
- **SOP 进度**：如关联 SOP 模板，显示执行进度

![任务详情抽屉](./screenshots/task-drawer.png)

#### 任务 Markdown 语法

在文档中可使用 Markdown 语法快速创建任务：

```markdown
- [ ] 普通任务          # status: todo, priority: medium
- [!] 高优先级任务       # status: todo, priority: high
- [-] 低优先级任务       # status: todo, priority: low
- [~] 进行中任务         # status: in_progress
- [?] 待审核任务         # status: reviewing
- [x] 已完成任务         # status: completed
```

---

### 3.3 文档 Wiki

**入口**：点击侧边栏「Wiki」或访问 `/wiki`

Wiki 是团队知识库，支持 Markdown 编辑和双向链接。

![文档 Wiki](./screenshots/wiki-list.png)

#### 文档列表

- **项目筛选**：按项目过滤文档
- **类型筛选**：按文档类型分类（指南、参考、笔记等）
- **搜索**：支持标题和内容搜索

#### 文档类型

| 类型 | 用途 |
|------|------|
| `guide` | 使用手册/指南 |
| `reference` | 参考文档 |
| `report` | 研究/分析报告 |
| `note` | 日常笔记（默认） |
| `decision` | 决策记录 |
| `task_list` | 包含任务的文档 |
| `scheduled_task` | 定时任务关联文档 |
| `blog` | 博客文章 |
| `other` | 未分类 |

#### 双向链接

使用 `[[文档标题]]` 语法建立文档关联：
- 输入 `[[` 自动提示已存在的文档
- 点击链接跳转到关联文档
- 自动计算反向链接（哪些文档引用了当前文档）

#### 批注系统

在非编辑模式下：
1. 选中需要批注的文本
2. 点击「添加批注」按钮
3. 输入批注内容
4. 批注面板显示所有批注，点击跳转定位

#### 与 AI 讨论

点击标题栏的 MessageSquare 图标，可将文档内容作为上下文发送给 AI 进行讨论。

---

### 3.4 项目管理

**入口**：点击侧边栏「项目」或访问 `/projects`

管理团队项目，分配成员，追踪进度。

![项目管理](./screenshots/projects.png)

#### 项目操作

| 操作 | 说明 |
|------|------|
| **创建项目** | 点击右上角「新建项目」按钮 |
| **编辑项目** | 点击项目卡片上的编辑图标 |
| **删除项目** | 点击项目卡片上的删除图标 |
| **切换项目** | 点击侧边栏项目选择器切换当前项目 |

#### 项目详情

- **基本信息**：名称、描述
- **成员分配**：添加/移除项目成员
- **统计信息**：任务数、完成进度
- **关联文档**：项目相关文档列表

---

### 3.5 Agent 管理

**入口**：点击侧边栏「Agent」或访问 `/agents`

管理 OpenClaw Gateway 的 Agent 实例。

> **前置条件**：需配置并连接 OpenClaw Gateway

![Agent 管理](./screenshots/agents.png)

#### Agent 列表

显示所有已注册的 Agent，包含：
- Agent 名称和状态
- 当前任务
- 运行时间
- 操作按钮

#### Agent 详情

点击 Agent 卡片查看详情：
- **基本信息**：名称、模型、端点
- **会话列表**：该 Agent 的活跃会话
- **技能列表**：该 Agent 已安装的技能
- **文件管理**：Agent 工作目录文件

---

### 3.6 会话管理

**入口**：点击侧边栏「会话」或访问 `/sessions`

管理 Agent 的对话会话。

#### 会话参数配置

| 参数 | 说明 |
|------|------|
| **Thinking Level** | 思考深度：off/minimal/low/medium/high/xhigh |
| **Verbose Level** | 输出详细度：inherit/off/on/full |
| **Reasoning Level** | 推理模式：off/on/stream |

#### Token 用量

每个会话显示：
- 输入 Token 数
- 输出 Token 数
- 总 Token 数

---

### 3.7 技能市场

**入口**：点击侧边栏「技能」或访问 `/skills`

管理 Agent 技能。

#### 技能分组

| 分组 | 说明 |
|------|------|
| **workspace** | 工作区自定义技能 |
| **built-in** | 内置技能 |

#### 技能操作

| 操作 | 说明 |
|------|------|
| **启用/禁用** | 切换技能开关 |
| **安装依赖** | 支持 brew/node/go/uv |
| **配置 API Key** | 为技能设置 API 密钥 |

---

### 3.8 定时任务

**入口**：点击侧边栏「定时任务」或访问 `/schedule`

![定时任务](./screenshots/schedule.png)

创建和管理定时执行的任务。

#### 调度模式

| 模式 | 说明 | 示例 |
|------|------|------|
| **every** | 间隔执行 | 每 5 分钟执行一次 |
| **at** | 一次性定时 | 指定时间执行一次 |
| **cron** | Cron 表达式 | 标准 Cron + 时区 |

#### 任务类型

| 类型 | 说明 |
|------|------|
| `report` | 报告生成 |
| `summary` | 摘要汇总 |
| `backup` | 数据备份 |
| `notification` | 通知提醒 |
| `custom` | 自定义任务 |

---

### 3.9 文档交付

**入口**：点击侧边栏「交付」或访问 `/deliveries`

管理文档交付物的提交和审核。

![文档交付](./screenshots/deliveries.png)

#### 审核流程

```
待审核 (pending) → 已通过 (approved) / 已拒绝 (rejected) / 需修改 (revision_needed)
```

#### 支持平台

| 平台 | 说明 |
|------|------|
| `local` | TeamClaw 内部文档 |
| `tencent-doc` | 腾讯文档 |
| `feishu` | 飞书 |
| `notion` | Notion |
| `other` | 其他平台 |

#### 交付操作

| 操作 | 说明 |
|------|------|
| **提交交付** | 关联文档并提交审核 |
| **审核** | 管理员审核通过/拒绝/要求修改 |
| **与 AI 讨论** | 将交付物内容发送给 AI 讨论 |

---

### 3.10 SOP 工作流

**入口**：点击侧边栏「SOP」或访问 `/sop`

SOP（标准化操作流程）引擎让 AI Agent 按预定义工作流执行复杂任务。

![SOP 模板列表](./screenshots/sop-templates.png)

#### 阶段类型

| 类型 | 说明 |
|------|------|
| `input` | 人工输入阶段，收集用户表单数据 |
| `ai_auto` | AI 自动执行，完成后自动推进 |
| `ai_with_confirm` | AI 执行后需人工确认再推进 |
| `manual` | 纯人工操作阶段 |
| `render` | 可视化渲染阶段 |
| `export` | 导出阶段 |
| `review` | 最终审核阶段 |

#### 使用流程

1. 在 `/sop` 页面创建或选择 SOP 模板
2. 在任务看板创建任务时关联 SOP 模板
3. 推送任务给 AI，AI 通过 MCP 工具按阶段执行
4. 人工在任务详情中确认/驳回/跳过阶段
5. 所有阶段完成后任务自动进入审核状态

#### 内置模板

| 模板 | 阶段数 | 用途 |
|------|--------|------|
| 竞品调研 SOP | 5 | 竞品信息收集→分析→报告 |
| 内容营销 SOP | 5 | 选题→创作→审核→发布 |
| 周报月报 SOP | 4 | 数据收集→汇总→渲染→审核 |
| Bug 分析 SOP | 5 | 复现→根因→修复→验证→知识沉淀 |
| 数据分析 SOP | 5 | 需求→采集→分析→可视化→审核 |

---

### 3.11 成员管理

**入口**：点击侧边栏「成员」或访问 `/members`

管理团队成员，包括人类和 AI 成员。

![成员管理](./screenshots/members.png)

#### 成员类型

| 类型 | 说明 |
|------|------|
| `human` | 人类成员 |
| `ai` | AI Agent 成员 |

#### AI 成员配置

| 配置项 | 说明 |
|--------|------|
| **部署模式** | cloud/local/knot |
| **执行模式** | chat_only/api_first/api_only |
| **模型配置** | 模型选择、温度设置 |
| **能力声明** | 擅长工具、任务类型 |

---

### 3.12 聊天功能

**入口**：在任务/项目/定时任务页面点击聊天图标

与 AI 成员进行对话协作。

#### 功能

- 多会话管理
- 实体绑定（任务/项目/定时任务）
- AI 回复（支持 Knot/OpenClaw 双模式）
- MCP 指令解析

---

### 3.13 用户管理

**入口**：点击侧边栏「用户」或访问 `/users`

> **权限**：仅管理员可访问

#### 用户角色

| 角色 | 权限说明 |
|------|----------|
| `admin` | 管理员：完全访问权限，可管理用户、系统设置 |
| `member` | 成员：可访问所有业务功能，不可管理用户和系统设置 |
| `viewer` | 只读：仅可查看，不可编辑 |

#### 用户操作

- 查看用户列表
- 创建、编辑、删除用户
- 分配用户角色
- 重置用户密码

---

### 3.14 系统设置

**入口**：点击侧边栏「设置」或访问 `/settings`

![系统设置](./screenshots/settings.png)

#### Gateway 配置

| 配置项 | 说明 |
|--------|------|
| **WebSocket 地址** | Gateway 连接地址 |
| **Token** | 认证 Token |
| **连接模式** | server_proxy（服务端代理） |

#### 连接状态

- 实时显示连接状态
- 连接失败时显示错误信息

---

### 3.15 博客系统

**入口**：点击侧边栏「博客」或访问 `/blog`

博客系统复用 Wiki 文档系统，通过文档类型 `blog` 标识博客文章。

![博客页面](./screenshots/blog.png)

#### 创建博客文章

1. 进入 Wiki 页面
2. 点击「新建文档」
3. **文档类型选择 `blog`**
4. 保存后自动显示在博客页面

#### 博客特性

| 特性 | 说明 |
|------|------|
| **时间排序** | 按更新时间倒序，最新文章置顶 |
| **摘要显示** | 自动提取前 150 字符作为摘要 |
| **标签支持** | 使用项目标签功能分类文章 |
| **全文阅读** | 点击文章跳转到 Wiki 查看完整内容 |

---

### 3.16 OpenClaw 同步

**入口**：设置页面 → OpenClaw 配置（`/settings/openclaw`）

Markdown 文件与 TeamClaw 数据双向同步。

#### 核心能力

| 功能 | 说明 |
|------|------|
| **Workspace 管理** | 配置本地 Markdown 目录 |
| **实时监听** | 文件变更自动同步 |
| **版本历史** | 文件版本记录、回滚 |
| **冲突处理** | 双向编辑冲突检测 |

---

### 3.17 Skill 管理

**入口**：点击侧边栏「Skill 管理」或访问 `/skills-management`

> **新增功能** (v3.0)

管理 Skill 的完整生命周期。

![Skill 管理](./screenshots/skill-management.png)

#### 核心功能

| 功能 | 说明 |
|------|------|
| **Skill 注册** | 验证并注册新 Skill |
| **审批流程** | Skill 发布需管理员审批 |
| **信任管理** | 信任/拒绝未知来源 Skill |
| **快照监控** | 检测 Agent Skill 变更，风险告警 |
| **敏感检测** | 自动标记含敏感信息的 Skill |

#### Skill 状态流转

```
draft → pending_approval → active / rejected
```

#### Skill 来源类型

| 类型 | 说明 |
|------|------|
| `teamclaw` | 内置 Skill |
| `manual` | 手动创建 |
| `external` | 外部导入 |
| `unknown` | 未知来源 |

#### 权限规则

| 操作 | 普通用户 | 管理员 |
|------|---------|--------|
| 查看所有 Skill | ❌（仅 active 和自己创建的） | ✅ |
| 创建 Skill | ✅ | ✅ |
| 提交审批 | ✅（自己的 Skill） | ✅ |
| 批准/拒绝 Skill | ❌ | ✅ |
| 信任管理 | ❌ | ✅ |

---

### 3.18 审批系统

**入口**：点击侧边栏「审批」或访问 `/approvals`

> **新增功能** (v3.0)

通用审批流程管理。

> **注意**：此功能路由正在开发中，截图将在功能完成后添加。

#### 审批类型

| 类型 | 说明 |
|------|------|
| `skill_publish` | Skill 发布审批 |
| `skill_install` | Skill 安装审批 |
| `project_join` | 项目加入申请 |
| `sensitive_action` | 敏感操作审批（预留） |

#### 审批状态

```
pending → approved / rejected / cancelled / expired
```

#### 权限规则

| 操作 | 申请人 | 管理员 | 其他用户 |
|------|--------|--------|----------|
| 创建审批请求 | ✅ | ✅ | ✅ |
| 查看所有请求 | ❌ | ✅ | ❌ |
| 批准/拒绝请求 | ❌ | ✅ | ❌ |
| 取消自己的请求 | ✅ | ✅ | ❌ |

---

## 4. 常见问题

### 4.1 安装部署

**Q: TeamClaw 支持哪些操作系统？**

A: TeamClaw 是跨平台的 Node.js 应用，支持 Windows、macOS、Linux。推荐使用 Linux 服务器部署。

**Q: 如何升级 TeamClaw？**

A:
```bash
# 1. 备份数据库
cp data/teamclaw.db data/teamclaw.db.backup

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
npm install

# 4. 重新构建
npm run build

# 5. 重启服务
pm2 restart teamclaw
```

**Q: 数据库在哪里？**

A: 数据存储在 `data/teamclaw.db`（SQLite 文件）。数据库会自动迁移，无需手动操作。

### 4.2 功能使用

**Q: 如何邀请团队成员？**

A: 管理员可在用户管理页面创建新用户，或开启注册功能让成员自行注册。

**Q: AI 成员如何配置？**

A: 在成员管理页面，创建类型为 AI 的成员，配置 OpenClaw 相关参数（端点、模型、Token）。

**Q: 如何创建 SOP 工作流？**

A: 进入 SOP 页面，点击「新建模板」，定义阶段和输入参数。然后在任务中关联该模板。

**Q: 文档如何导出？**

A: 在文档编辑页面，可复制 Markdown 内容或通过交付功能提交审核。

### 4.3 故障排查

**Q: Gateway 连接失败怎么办？**

A:
1. 检查 Gateway 是否运行（访问 WebSocket 地址）
2. 检查 Token 是否正确
3. 检查网络连接和防火墙设置
4. 查看浏览器控制台错误日志

**Q: 任务拖拽不生效？**

A:
1. 检查是否有编辑权限
2. 刷新页面重试
3. 检查浏览器控制台错误

**Q: AI 不响应怎么办？**

A:
1. 检查 AI 成员配置
2. 检查 Gateway 连接状态
3. 查看 Agent 状态页面
4. 检查 AI 成员的 API Token 配置

---

## 附录

### A. 枚举值速查

| 字段 | 可选值 |
|------|--------|
| 任务状态 | `todo`, `in_progress`, `reviewing`, `completed` |
| 任务优先级 | `high`, `medium`, `low` |
| AI 状态 | `idle`, `working`, `waiting`, `offline` |
| 文档类型 | `guide`, `reference`, `note`, `report`, `decision`, `scheduled_task`, `task_list`, `blog`, `other` |
| 交付平台 | `tencent-doc`, `feishu`, `notion`, `local`, `other` |
| 交付状态 | `pending`, `approved`, `rejected`, `revision_needed` |
| 定时周期 | `once`, `daily`, `weekly`, `monthly` |
| 定时类型 | `report`, `summary`, `backup`, `notification`, `custom` |
| 成员类型 | `human`, `ai` |
| 部署模式 | `cloud`, `local`, `knot` |
| 执行模式 | `chat_only`, `api_first`, `api_only` |
| 用户角色 | `admin`, `member`, `viewer` |
| Skill 来源 | `teamclaw`, `manual`, `external`, `unknown` |
| Skill 状态 | `draft`, `pending_approval`, `active`, `rejected` |
| Skill 信任状态 | `trusted`, `untrusted`, `pending` |
| 审批类型 | `skill_publish`, `skill_install`, `project_join`, `sensitive_action` |
| 审批状态 | `pending`, `approved`, `rejected`, `cancelled`, `expired` |

### B. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `ESC` | 关闭抽屉/对话框 |
| `Enter` | 提交表单（部分场景） |
| `?` | 显示帮助（计划中） |

### C. 相关文档

| 文档 | 路径 |
|------|------|
| 开发文档 | `docs/technical/DEVELOPMENT.md` |
| API 文档 | `docs/technical/API.md` |
| 编码规范 | `CODING_STANDARDS.md` |
| 产品需求 | `docs/product/PRD.md` |
| 变更日志 | `docs/process/CHANGELOG.md` |

### D. 技术支持

- **GitHub Issues**: [提交问题](https://github.com/your-org/teamclaw-v3/issues)
- **文档反馈**: 在文档页面提交改进建议

---

*本文档由 TeamClaw 团队维护，最后更新: 2026-03-12*
