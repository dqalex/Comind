**中文 | [English](./README.md)** | [📖 Agent 指南](skills/deploy/SKILL.md)

# TeamClaw

**把 AI 当队友，而不是工具。**

TeamClaw 是一个开源的人机协作平台，让 AI Agent 像真正的团队成员一样参与项目管理——接任务、写文档、提交交付、汇报进度。

> 当前版本：v1.0.1

---

## 解决什么问题？

现有的 AI 工具大多是"对话框模式"——你问一句，它答一句。但真实的团队协作远不止于此：

| 痛点 | TeamClaw 的解法 |
|------|--------------|
| **AI 不知道项目上下文** | AI 成员自动获取项目、任务、文档的完整上下文 |
| **AI 产出无法追踪** | 文档交付中心 + 审核流程，产出有迹可循 |
| **任务分配靠口头沟通** | 任务看板直接推送给 AI，自动开始执行 |
| **AI 状态不透明** | 实时状态面板：idle / working / waiting，一眼看清 |
| **多 Agent 协调困难** | 统一的 Agent 管理 + 会话管理 + 定时调度 |
| **文档和代码不同步** | Markdown 双向同步，本地编辑自动上云 |

## 核心特性

### 🔐 多用户认证系统（v3.0 新增）

企业级多用户系统，支持基于角色的访问控制：
- **注册与登录**：安全的密码哈希认证
- **角色系统**：管理员和成员角色，权限分级
- **用户-成员绑定**：每个用户自动关联团队成员档案
- **首次初始化向导**：新部署引导式配置

### 🔧 Skill 管理系统（v3.0 新增）

完整的 AI Skill 生命周期管理：
- **Skill 注册与验证**：自动验证 SKILL.md 结构规范
- **审批流程**：Skill 发布需管理员审批
- **信任管理**：信任/拒绝未知来源 Skill
- **快照监控**：定期检测 Agent 已安装 Skill 变更，发现风险告警
- **敏感内容检测**：自动标记含敏感信息的 Skill

### ✅ 通用审批系统（v3.0 新增）

统一的多场景审批流程：
- **4 种审批类型**：Skill 发布、Skill 安装、项目加入、敏感操作
- **灵活策略**：审批人规则、超时设置、自动处理
- **完整审计**：审批历史全记录
- **通知集成**：审批状态变更通知

### 🎯 任务驱动的人机协作

任务看板不只是给人看的——AI 成员能接收任务推送，自动更新状态，提交检查项，记录操作日志。支持泳道分组、四列状态流转、拖拽排序、里程碑管理。

### 📄 文档交付与审核

AI 写的文档不应该石沉大海。交付中心提供完整的提交→审核→修改→通过流程，每份产出都经过人类审核确认。

### 🔄 SOP 工作流引擎

标准化操作流程引擎，用于复杂 AI 任务：
- **7 种阶段类型**：input、ai_auto、ai_with_confirm、manual、render、export、review
- **模板管理**：创建、编辑、导入/导出 SOP 模板
- **Know-how 知识库**：L1-L5 五层知识结构
- **Content Studio 集成**：可视化渲染文档产出

### 💬 多模式对话

三种交互通道并行：
- **对话信道**：自然语言 + 嵌入式 Actions 指令
- **MCP 工具**：37 个标准化接口，覆盖任务/文档/项目/状态等全场景
- **Markdown 同步**：本地 `.md` 文件自动同步为任务、交付物、定时计划

### 🔗 OpenClaw Gateway 深度集成

作为 [OpenClaw Gateway](https://github.com/nicepkg/openclaw) 的增强型前端，提供 Agent 管理、会话管理、技能市场、定时调度的可视化操作界面。

### 📊 知识图谱 Wiki

双向链接文档系统，自动建立关联网络，可视化知识图谱。支持 `[[文档名]]` 引用、反向链接追踪、多项目标签。

### 🌐 完整国际化

中英文全覆盖，所有界面文本通过 i18n 管理。

## 功能概览

| 模块 | 说明 |
|------|------|
| **用户认证** | 用户注册/登录、基于角色的访问控制（v3.0） |
| **初始化向导** | 首次启动配置、管理员账户创建（v3.0） |
| **Skill 管理** | Skill 注册/审批/信任管理/快照监控（v3.0） |
| **审批系统** | 通用审批流程、多场景支持（v3.0） |
| **工作台** | 系统概览、Gateway 连接管理、快速操作 |
| **任务看板** | 泳道+四列看板、拖拽排序、里程碑管理 |
| **项目管理** | 项目 CRUD、成员分配、进度追踪 |
| **文档 Wiki** | 双向链接、知识图谱、多类型文档 |
| **SOP 引擎** | 模板驱动工作流、7 种阶段类型、Know-how 知识库（v3.0） |
| **Agent 管理** | 多 Agent 模式、状态监控、文件管理 |
| **会话管理** | 会话参数配置、Token 统计 |
| **技能市场** | 技能启用/安装/配置 |
| **定时任务** | 可视化调度、Cron 表达式、执行历史 |
| **文档交付** | 提交审核流程、版本管理 |
| **成员管理** | 人类/AI 成员、AI 自注册、用户-成员绑定（v3.0） |
| **聊天面板** | 浮动面板、多模式对话、MCP 指令 |
| **OpenClaw 同步** | Markdown 双向同步、版本历史、冲突处理 |

## 快速开始

### 前置条件

- **Node.js** 18+
- **OpenClaw Gateway**（可选，Agent 功能依赖；本地任务/文档/Wiki 功能无需 Gateway）

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/dqalex/teamclaw.git
cd teamclaw

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env.local

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 连接 Gateway

1. 启动 [OpenClaw Gateway](https://github.com/nicepkg/openclaw)（默认 `ws://localhost:18789`）
2. 打开 TeamClaw → 设置 → Gateway 配置，填入地址和 Token
3. 连接成功后，Agent/会话/技能/定时任务功能自动激活

### 环境变量

#### 基础配置

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `NEXT_PUBLIC_BASE_URL` | ✅ | 应用基础 URL | `http://localhost:3000` |
| `NEXT_PUBLIC_GATEWAY_URL` | ❌ | Gateway WebSocket 地址 | `ws://localhost:18789` |
| `TEAMCLAW_API_TOKEN` | ❌ | MCP External API 认证 Token | — |
| `TOKEN_ENCRYPTION_KEY` | ❌ | Token 加密密钥（建议 32+ 字符） | — |
| `TEAMCLAW_DB_PATH` | ❌ | 数据库路径 | 自动检测 |

#### 新部署自动配置

以下环境变量支持首次部署时自动配置：

**Gateway 自动配置：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENCLAW_DEFAULT_ENDPOINT` | ❌ | Gateway WebSocket URL（如 `ws://127.0.0.1:18789`） |
| `OPENCLAW_TOKEN` | ❌ | Gateway 认证 Token |
| `GATEWAY_MODE` | ❌ | 连接模式：`server_proxy` 或 `browser_direct` |

**工作区自动配置：**

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `OPENCLAW_WORKSPACE_PATH` | ❌ | 工作区目录路径 | — |
| `OPENCLAW_WORKSPACE_NAME` | ❌ | 工作区显示名称 | `Default Workspace` |
| `OPENCLAW_WORKSPACE_MEMBER_ID` | ❌ | 关联的 AI 成员 ID | `null`（未绑定） |
| `OPENCLAW_WORKSPACE_SYNC_INTERVAL` | ❌ | 同步间隔（秒） | `120` |

**新部署 `.env` 示例：**

```bash
# Gateway 自动配置
OPENCLAW_DEFAULT_ENDPOINT=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-gateway-token-here
GATEWAY_MODE=server_proxy

# 工作区自动配置
OPENCLAW_WORKSPACE_PATH=/root/workspace
OPENCLAW_WORKSPACE_NAME=默认工作区
OPENCLAW_WORKSPACE_SYNC_INTERVAL=120
```

> **注意：** `OPENCLAW_DEFAULT_ENDPOINT` 必须使用 `ws://` 或 `wss://` 协议。如果误用了 `http://` 或 `https://`，首次启动时会自动修正。

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 语言 | TypeScript (strict mode) |
| UI | Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand (18 stores) |
| 数据库 | SQLite + Drizzle ORM (33 tables) |
| 认证 | Argon2id 密码哈希、Cookie Session |
| 实时通信 | WebSocket (OpenClaw Protocol v3) + SSE |
| 国际化 | react-i18next |

## 项目结构

```
teamclaw/
├── app/                  # Next.js 页面 + API 路由
├── src/
│   ├── core/            # 核心模块（db, gateway, mcp）
│   ├── domains/         # 领域模块（16 个领域，含 store + api + mcp）
│   ├── features/        # 功能模块（10 个功能）
│   ├── shared/          # 共享模块（lib, components, hooks, ui, layout, editor）
│   └── server/          # 服务端模块
├── db/                   # SQLite Schema + 连接（软链接到 src/core/db）
├── skills/               # AI Skill 文档与模板
├── docs/                 # 项目文档
└── scripts/              # 部署与工具脚本
```

## 文档

| 文档 | 说明 |
|------|------|
| [使用手册](docs/product/USER_GUIDE.md) | 完整功能介绍与操作指南 |
| [开发者手册](docs/technical/DEVELOPMENT.md) | 架构设计、模块说明、开发指南 |
| [API 文档](docs/technical/API.md) | REST API 参考 |
| [变更日志](docs/process/CHANGELOG.md) | 版本更新记录 |


## 部署问题排查

### 常见问题

#### 1. argon2 原生模块错误

**错误信息：**
```
⨯ Error: No native build was found for platform=linux arch=x64 runtime=node abi=127
```

**解决方案：**
部署脚本 (`scripts/deploy.sh`) 会自动处理此问题。如果手动遇到此错误：

```bash
# 在服务器上执行
mkdir -p /root/teamclaw/.next/standalone/node_modules/@node-rs
cp -r /root/teamclaw/node_modules/argon2 /root/teamclaw/.next/standalone/node_modules/
cp -r /root/teamclaw/node_modules/@node-rs /root/teamclaw/.next/standalone/node_modules/
```

#### 2. 初始化页面无法访问

**现象：** 数据库无用户时，首页没有跳转到 `/init` 初始化页面。

**解决方案：**
编辑 `/app/api/init/route.ts` 移除 `ENABLE_INITIALIZATION` 环境变量检查，或者设置环境变量：

```bash
# 添加到服务器的 .env 或 .env.local
ENABLE_INITIALIZATION=true
```

然后重启服务：
```bash
pm2 restart teamclaw
```

## License

MIT
