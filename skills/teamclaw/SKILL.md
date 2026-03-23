---
name: teamclaw
description: TeamClaw 人机协作平台 AI 成员操作手册。定义任务执行、Markdown 同步、对话协作、状态面板、SOP 引擎、Content Studio 等全部工作流程。当 AI 成员接收到 TeamClaw 平台的任务推送、对话请求、定时调度或巡检指令时，应使用此 Skill 执行标准化操作。
teamclaw_version: "1.0.1"
metadata: { "openclaw": { "always": true, "emoji": "🧠", "homepage": "https://github.com/dqalex/teamclaw", "requires": { "env": ["TEAMCLAW_BASE_URL", "TEAMCLAW_API_TOKEN"] } } }
---

# TeamClaw AI 成员操作手册

> **版本**: v1.0.1
> **项目地址**: https://github.com/dqalex/teamclaw
> **核心特性**: 多用户认证、SOP 引擎、Content Studio、渐进式上下文、Agent Token 管理


作为 TeamClaw 协作平台的 AI 成员，按照本文档定义的流程执行所有操作。

## 环境变量

| 变量 | 说明 |
|------|------|
| `TEAMCLAW_BASE_URL` | TeamClaw 实例地址（如 `http://localhost:3000`） |
| `TEAMCLAW_API_TOKEN` | MCP External API 鉴权 Token |

**获取 API Token**：登录 TeamClaw → 成员管理 → 编辑 AI 成员 → 复制 `openclawApiToken`

---

## 🚨 关键概念

### 1. 渐进式上下文获取

按需获取信息，避免一次性加载过多数据：

| 层级 | 说明 | 典型工具 |
|------|------|---------|
| **L1 索引** | 轻量级，默认返回 | `get_task`, `list_my_tasks` |
| **L2 详情** | 完整上下文，按需获取 | `get_task` + `detail=true`, `get_sop_context` |

**使用原则**：列表用 L1，详情用 L2。详见 `references/tools.md`。

### 2. 三种交互通道架构

```
┌─────────────────────────────────────────────────────────────────┐
│   对话信道 Actions (主要)  │   MCP API (独立 HTTP)  │   文档同步         │
│   (任务推送场景唯一通道)   │   (可选备用通道)       │   (批量写入)       │
├─────────────────────────────────────────────────────────────────┤
│   ✅ 查询 + 写入          │   ✅ HTTP POST         │   ❌ 格式要求严格  │
│   ✅ 实时响应             │   ✅ 显式错误返回       │   ❌ 失败仅日志    │
│   ✅ 自动身份注入         │   ✅ 需 Bearer Token    │   ❌ 无即时验证    │
└─────────────────────────────────────────────────────────────────┘
```

**决策树**：
- **任务推送场景** → **必须使用对话通道 Actions**（查询 + 写入）
- 需要独立 HTTP API 调用（如外部脚本）→ 使用 **MCP API**（需配置 executionMode）
- 批量写入 ≥2 条 → Markdown 同步 + Actions 验证

### 3. 验证机制

**所有关键操作必须用 MCP API 验证**：

| 操作 | 验证工具 |
|------|---------|
| 文档同步创建任务 | `list_my_tasks()` |
| Actions 更新状态 | `get_task(task_id)` |
| 提交交付 | `list_my_deliveries()` |

详见 `references/validation.md`。

---

## 场景 A: 执行任务

**触发**：收到 task-push 推送

### 流程

1. **确认收到** → 在对话中说明执行计划
2. **获取上下文** → **对话通道 Actions** `get_task` + `get_project`
3. **更新状态** → **对话通道 Actions** `update_task_status(in_progress)`
4. **执行** → 遇到关键节点主动汇报
5. **产出交付** → 如需要，**对话通道 Actions** `deliver_document`
6. **完成任务** → **对话通道 Actions** `update_task_status(completed/reviewing)`

### ⚠️ 必须遵守

- 开始前**必须**更新状态为 `in_progress`
- 完成后**必须**更新状态为 `completed` 或 `reviewing`
- **必须**在对话中主动汇报工作进展
- **任务推送场景必须使用对话通道 Actions** - 没有独立的 MCP 工具可用

---

## 场景 B: Markdown 批量同步

**触发**：批量创建 ≥2 条记录

### 支持的同步类型

| Front Matter type | 同步目标 |
|-------------------|---------|
| `teamclaw:tasks` | 批量创建任务 |
| `teamclaw:deliveries` | 批量交付列表 |
| `teamclaw:milestones` | 批量创建里程碑 |
| `delivery_status: pending` | 单文档交付 |

### 同步后必须验证

```json
{"tool": "list_my_tasks", "parameters": {"status": "todo"}}
// 确认任务数量、assignees、project_id 正确
```

模板文件：`references/task-board.md`, `references/deliveries.md`

---

## 场景 D: 任务巡检

**触发**：自主检查待处理任务

**使用对话通道 Actions**：

```json
{"actions": [{"type": "list_my_tasks", "status": "todo"}]}
{"actions": [{"type": "list_my_tasks", "status": "all"}]}
```

**如需独立 HTTP API 调用**：

```json
{"tool": "list_my_tasks", "parameters": {"status": "todo"}}
```

端点：`POST ${TEAMCLAW_BASE_URL}/api/mcp/external`
鉴权：`Authorization: Bearer ${TEAMCLAW_API_TOKEN}`

> **SSE 流式调用**（智能体友好）：`POST ${TEAMCLAW_BASE_URL}/api/mcp/external/stream`
> - 支持实时进度反馈（`progress` / `result` / `error` / `done` 事件）
> - 适用于长时间运行的工具调用
> - 响应类型：`text/event-stream`

---

## 场景 E: 对话协作

**触发**：用户在项目/任务页面发起对话

### 对话信道 Actions 格式

**任务推送场景下获取上下文的唯一方式！**

在消息**末尾**嵌入 JSON 块：

```json
{"actions": [
  {"type": "get_task", "task_id": "xxx"},
  {"type": "get_project", "project_id": "xxx"},
  {"type": "update_task_status", "task_id": "xxx", "status": "in_progress"},
  {"type": "add_comment", "task_id": "xxx", "content": "开始执行"}
]}
```

**执行流程**：
1. Agent 在回复中嵌入 Actions JSON
2. TeamClaw 接收消息并解析 Actions
3. 执行 Actions 并将结果返回给 Agent
4. Agent 基于返回的上下文继续执行

### 支持的 Actions 类型

**查询类（任务推送场景必须使用）：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `get_task` | task_id | 获取任务详情（包含附件、评论）|
| `get_project` | project_id | 获取项目详情（成员、任务列表）|
| `get_project_members` | project_id | 获取项目成员列表 |
| `list_my_tasks` | - | 获取我的任务列表 |
| `get_document` | document_id 或 title | 获取 Wiki 文档内容 |
| `search_documents` | query | 搜索 Wiki 文档 |
| `get_message_template` | template_name | 获取消息模板内容（v1.0.1+）|
| `list_message_templates` | - | 列出所有消息模板（v1.0.1+）|
| `list_schedules` | - | 列出定时任务 |
| `list_milestones` | project_id | 列出项目里程碑 |
| `list_render_templates` | - | 列出渲染模板 |
| `get_render_template` | template_id | 获取渲染模板详情 |
| `get_sop_context` | task_id | 获取 SOP 执行上下文（含前序产出+知识层，v1.0.1+）|

**写入类：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `create_task` | title | 创建新任务，可分配给人类或其他 AI |
| `update_task_status` | task_id, status | 更新任务状态（in_progress/completed/reviewing）|
| `add_comment` | task_id, content | 添加评论 |
| `create_check_item` | task_id, text | 创建检查项 |
| `complete_check_item` | task_id, item_id | 完成检查项 |
| `create_document` | title, content | 创建 Wiki 文档 |
| `update_document` | document_id, content | 更新 Wiki 文档 |
| `deliver_document` | title, platform | 提交交付 |
| `create_milestone` | title, project_id | 创建里程碑 |
| `update_milestone` | milestone_id | 更新里程碑 |
| `delete_milestone` | milestone_id | 删除里程碑 |
| `invoke_skill` | skill_key | 调用 Skill 执行任务 |

**状态类：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `update_status` | status | 更新 AI 实时状态面板 |
| `set_queue` | queued_tasks | 设置任务队列 |
| `set_do_not_disturb` | interruptible | 设置免打扰模式 |

**SOP 执行类：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `advance_sop_stage` | task_id | 推进到下一 SOP 阶段 |
| `request_sop_confirm` | task_id, confirm_message, stage_output | 请求人工确认 |
| `get_sop_context` | task_id | 获取 SOP 执行上下文 |
| `save_stage_output` | task_id, output | 保存阶段产出 |
| `update_knowledge` | document_id, content | 更新知识库 |

**SOP 模板类：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `create_sop_template` | name, stages | AI 自主创建 SOP 模板 |
| `update_sop_template` | template_id | AI 修改/优化 SOP 模板 |
| `create_render_template` | name, html_template | 创建渲染模板 |
| `update_render_template` | template_id | 更新渲染模板 |

**扩展类：**

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `sync_identity` | - | 同步 AI 身份信息到 IDENTITY.md |
| `get_mcp_token` | - | 获取 MCP API Token（用于调用 /api/mcp/external）|

**重要**：任务推送场景没有独立的 `get_task`、`update_task_status` 等工具可用，**必须通过对话通道 Actions 调用**！

完整列表见 `references/tools.md`。

---

## 场景 F: 定时任务

**触发**：定时调度器推送

**必须使用 MCP API**（Actions 不支持定时任务管理）：

```json
{"tool": "create_schedule", "parameters": {
  "title": "每日报告",
  "task_type": "report",
  "schedule_type": "daily",
  "schedule_time": "09:00"
}}
```

> 注：`create_schedule` / `update_schedule` / `delete_schedule` 仍需 MCP API，Actions 暂不支持。
```

---

## 场景 G: AI 状态面板

| status | 含义 | 切换时机 |
|--------|------|---------|
| `idle` | 空闲 | 任务完成 |
| `working` | 执行中 | 接到任务 |
| `waiting` | 等待中 | 需要用户回复 |

---

## 场景 H: SOP 任务执行

**触发**：任务绑定了 SOP 模板

### SOP 阶段类型

| 类型 | AI 行为 |
|------|---------|
| `input` | 等待用户提供文件/信息 |
| `ai_auto` | 执行完成后自动推进 |
| `ai_with_confirm` | 等待人工确认 |
| `manual` | 等待人工完成 |
| `render` | 进入 Content Studio |
| `review` | 进入交付中心 |

### 核心工具

```json
// 获取上下文
{"tool": "get_sop_context", "parameters": {"task_id": "xxx"}}

// 完成阶段
{"tool": "advance_sop_stage", "parameters": {"task_id": "xxx", "stage_output": "..."}}

// 获取 SOP 执行上下文（包含前序产出和知识层）
{"tool": "get_sop_context", "parameters": {"task_id": "xxx"}}
```

---

## 场景 I: Content Studio 可视化编辑

**触发**：文档 `renderMode: visual` 或 SOP render 阶段

> 📖 **详细规范**：创建或套用模板前，**必须**阅读 `references/render-template-guide.md`

### 核心概念

| 概念 | 说明 |
|------|------|
| **MD 优先设计** | 先用 MD 写内容结构，再设计 HTML 布局 |
| **Slot 槽位** | 内容注入点，`data-slot` 标记，支持 `content`/`image`/`data` 类型 |
| **循环渲染** | 用 `data-slot-loop` 标记重复结构，HTML 只写一份模板 |

### AI 使用场景

**场景 1：为现有 MD 文章套用模板**

1. 分析文章结构，识别主要章节
2. 选择合适的内置模板（report/card/poster）
3. 或创建新模板匹配文章结构
4. 将 MD 内容按 slot 切分注入

**场景 2：AI 自主创建模板**

```json
{"tool": "create_render_template", "parameters": {
  "name": "技术分享卡片",
  "category": "card",
  "html_template": "<div class=\"card\">\n  <h2 data-slot=\"title\" data-slot-type=\"content\"></h2>\n  <p data-slot=\"body\" data-slot-type=\"content\"></p>\n</div>",
  "md_template": "<!-- @slot:title -->\n# 标题\n\n<!-- @slot:body -->\n正文内容",
  "slots": {
    "title": {"type": "content", "label": "标题"},
    "body": {"type": "content", "label": "正文"}
  }
}}
```

### 模板创建约束（重要）

| 约束 | 说明 |
|------|------|
| HTML 结构简洁 | 避免深层嵌套（≤5 层） |
| 所有内容用 slot | 不在 HTML 中硬编码文本 |
| 重复结构用循环 | `data-slot-loop` 标记，不写重复 HTML |
| CSS 不超过 3KB | 保持精简 |
| MD 模板有默认内容 | 每个 slot 有占位文本 |
| slot 数量 3-12 个 | 太少/太多都不合适 |

### simpleMdToHtml 支持的语法

| 支持 | 不支持 |
|------|--------|
| `# ~ ######` 标题 | 嵌套列表 |
| `-` / `1.` 列表 | 脚注 `[^1]` |
| `>` 引用 | LaTeX 公式 |
| `---` 分隔线 | HTML 标签 |
| `|` 表格 | |
| `**` `*` `~~` 格式 | |
| `==高亮==` | |
| `:lucide:icon:` 图标 | |

### 语义代码块

| 类型 | 渲染为 |
|------|--------|
| ` ```flow ` | 垂直流程图 |
| ` ```compare ` | 左右对比卡片 |
| ` ```steps ` | 横向步骤条 |

---

## 场景 J: AI 自主创作

**触发**：识别到重复性工作模式，或需要为新类型任务标准化流程

### 创建 SOP 模板

```json
{"tool": "create_sop_template", "parameters": {
  "name": "竞品分析报告",
  "stages": [
    {"id": "input", "type": "input", "requiredInputs": [...]},
    {"id": "research", "type": "ai_auto", "promptTemplate": "..."}
  ]
}}
```

创建后状态为 `draft`，需用户确认后变为 `active`。

### 创建渲染模板

当识别到需要可视化输出的场景时，创建渲染模板：

> 📖 **详细规范**：创建模板前，**必须**阅读 `references/render-template-guide.md`

**设计流程**：
1. **先写 MD**：用 MD 写出理想的内容结构
2. **规划 Slot**：识别可变内容区域
3. **设计 HTML**：只写布局骨架，内容区用 `data-slot` 占位
4. **编写 CSS**：通过 `data-slot` 选择器限定作用域
5. **声明定义**：配置 slots 和 sections

**常见模板类型**：

| 类型 | 用途 | 典型宽度 |
|------|------|----------|
| `report` | 调研报告、周报 | 800px |
| `card` | 社交媒体卡片 | 640px |
| `poster` | 数据海报 | 720px |
| `presentation` | 演示幻灯片 | 1280px |

---

## 场景 K: Agent MCP Token 管理

**触发**：对话信道需要自动认证

```json
// 获取 Token（首次自动创建）
{"tool": "get_agent_mcp_token", "parameters": {}}

// 列出所有 Token
{"tool": "list_agent_mcp_tokens", "parameters": {}}

// 撤销 Token
{"tool": "revoke_agent_mcp_token", "parameters": {"token_id": "amt_xxx"}}
```

**安全机制**：SHA-256 哈希 + AES-256-GCM 加密，外部 API 调用时 member_id 自动注入。

---

## API 调用方式

- **端点**：`POST ${TEAMCLAW_BASE_URL}/api/mcp/external`
- **鉴权**：`Authorization: Bearer ${TEAMCLAW_API_TOKEN}`
- **member_id** 自动注入

**单个调用**：
```json
{"tool": "update_task_status", "parameters": {"task_id": "xxx", "status": "in_progress"}}
```

**批量调用**：
```json
{"batch": [
  {"tool": "update_task_status", "parameters": {"task_id": "xxx", "status": "in_progress"}},
  {"tool": "update_status", "parameters": {"status": "working"}}
]}
```

---

## 决策流程

```
收到指令
├─ task-push → 场景A: 执行任务（必须在对话中汇报）
├─ chat-* → 场景E: 对话协作
├─ 定时推送 → 场景F: 定时任务
└─ 自主巡检 → 场景D: 任务巡检

执行中:
├─ 批量写操作(≥2条) → Markdown 同步 + MCP 验证
├─ 单字段更新 → Actions 或 MCP API
├─ 查询数据 → MCP API
├─ 关键进展 → 在对话中主动汇报
└─ 完成 → update_task_status + update_status(idle)
```

---

## 参考文档

| 文件 | 内容 | 加载时机 |
|------|------|---------|
| `references/tools.md` | 完整工具速查表 | 需要查看工具详情 |
| `references/validation.md` | 验证场景清单 | 需要验证操作结果 |
| `references/enums.md` | 枚举值参考 | 需要确认字段取值 |
| `references/render-template-guide.md` | 渲染模板制作规范 | **创建/套用模板时必须加载** |
| `scripts/mcp-call.sh` | MCP 调用脚本模板 | 需要执行验证脚本 |
| `references/task-board.md` | 任务看板模板 | 批量创建任务 |
| `references/deliveries.md` | 交付列表模板 | 批量提交交付 |

---

## 关键提醒

1. **验证优先**：关键操作必须用 MCP API 验证
2. **主动汇报**：在对话中主动汇报进展，不能默默执行
3. **状态管理**：开始/完成任务必须更新状态
4. **通道选择**：需要确认结果时使用 MCP API
5. **渐进加载**：列表用 L1 索引，详情用 L2 详情
