# 工具速查表

> 本文档详细列出所有 MCP 工具，供需要时查阅。SKILL.md 中仅保留核心工作流程。

## 查询工具（仅 MCP API）

### L1 索引工具（轻量级，默认返回）

| 工具 | 必填参数 | 用途 | 验证场景 |
|------|---------|------|---------|
| `list_my_tasks` | status (可选) | 获取分配给当前成员的任务索引 | 验证批量创建任务 |
| `get_task` | task_id | 获取任务索引（不含描述/评论） | 快速状态查询 |
| `get_document` | document_id 或 title | 获取文档元信息（不含内容） | 验证文档创建 |
| `search_documents` | query | 搜索文档 | 验证文档同步 |
| `get_project` | project_id | 获取项目索引 | 验证项目上下文 |
| `list_my_deliveries` | status (可选) | 获取当前成员的交付物列表 | **验证交付创建** |
| `get_delivery` | delivery_id | 获取交付物详情（含审核意见） | **验证交付状态** |

### L2 详情工具（完整上下文，按需获取）

| 工具 | 必填参数 | 用途 | 使用场景 |
|------|---------|------|---------|
| `get_task` + `detail=true` | task_id | 获取任务完整详情（描述+评论+检查项+SOP历史） | 用户查看任务详情 |
| `get_project` + `detail=true` | project_id | 获取项目完整详情（成员+任务+文档+里程碑） | 用户查看项目详情 |
| `get_document` + `detail=true` | document_id 或 title | 获取文档完整内容 | 编辑文档时 |
| `get_sop_context` | task_id | 获取 SOP 执行上下文（前序产出+知识层） | SOP 执行参考 |

## 写入工具（Actions / MCP API）

| 工具 | 必填参数 | 支持方式 | 用途 | 是否需要验证 |
|------|---------|---------|------|-------------|
| `create_task` | title | Actions / MCP API | 创建新任务 | ✅ `list_my_tasks` 验证 |
| `update_task_status` | task_id, status | Actions / MCP API | 更新任务状态 | ✅ `get_task` 验证 |
| `add_task_comment` | task_id, content | Actions / MCP API | 添加评论 | ❌ 不需要 |
| `create_check_item` | task_id, text | Actions / MCP API | 创建检查项 | ✅ `get_task` 验证 |
| `complete_check_item` | task_id, item_id | Actions / MCP API | 完成检查项 | ✅ `get_task` 验证 |
| `create_document` | title, content | Actions / MCP API | 创建文档 | ✅ `get_document` 验证 |
| `update_document` | document_id, content | Actions / MCP API | 更新文档 | ✅ `get_document` 验证 |
| `deliver_document` | title, platform | Actions / MCP API | 提交交付 | ✅ `list_my_deliveries` 验证 |
| `create_milestone` | title, project_id | Actions / MCP API | 创建里程碑 | ✅ `list_milestones` 验证 |
| `update_milestone` | milestone_id | Actions / MCP API | 更新里程碑 | ✅ `list_milestones` 验证 |
| `delete_milestone` | milestone_id | Actions / MCP API | 删除里程碑 | ✅ `list_milestones` 验证 |
| `update_status` | status | Actions / MCP API | AI 状态面板 | ❌ 不需要 |
| `set_queue` | queued_tasks | Actions / MCP API | 任务队列 | ❌ 不需要 |
| `set_do_not_disturb` | interruptible | Actions / MCP API | 免打扰模式 | ❌ 不需要 |
| `sync_identity` | — | Actions | 同步身份信息 | ❌ 不需要 |
| `get_mcp_token` | member_id | Actions | 获取 MCP Token | ❌ 不需要 |

## 查询工具（Actions / MCP API）

| 工具 | 必填参数 | 用途 | 验证场景 |
|------|---------|------|---------|
| `list_my_tasks` | status (可选) | 获取分配给当前成员的任务索引 | 验证批量创建任务 |
| `get_task` | task_id | 获取任务索引（不含描述/评论） | 快速状态查询 |
| `get_document` | document_id 或 title | 获取文档元信息（不含内容） | 验证文档创建 |
| `search_documents` | query | 搜索文档 | 验证文档同步 |
| `get_project` | project_id | 获取项目索引 | 验证项目上下文 |
| `list_schedules` | — | 列出定时任务 | — |
| `list_milestones` | project_id | 列出项目里程碑 | 验证里程碑操作 |
| `list_render_templates` | category (可选) | 列出渲染模板 | — |
| `get_render_template` | template_id | 获取渲染模板详情 | — |
| `get_sop_context` | task_id | 获取 SOP 执行上下文 | SOP 执行参考 |
| `list_skills` | category (可选) | 列出可用 Skill | Skill 发现 |
| `list_my_deliveries` | status (可选) | 获取当前成员的交付物列表 | **验证交付创建** |
| `get_delivery` | delivery_id | 获取交付物详情（含审核意见） | **验证交付状态** |

## L2 详情工具（仅 MCP API）

| 工具 | 必填参数 | 用途 | 使用场景 |
|------|---------|------|---------|
| `get_task` + `detail=true` | task_id | 获取任务完整详情（描述+评论+检查项+SOP历史） | 用户查看任务详情 |
| `get_project` + `detail=true` | project_id | 获取项目完整详情（成员+任务+文档+里程碑） | 用户查看项目详情 |
| `get_document` + `detail=true` | document_id 或 title | 获取文档完整内容 | 编辑文档时 |

> **v1.0.1 废弃**: `get_task_detail`, `get_project_detail`, `get_document_detail` 已标记为 DEPRECATED，请使用上述替代方案。

## 管理/配置工具（仅 MCP API）

| 工具 | 必填参数 | 用途 |
|------|---------|------|
| `create_schedule` | title, task_type, schedule_type | 创建定时任务 |
| `delete_schedule` | schedule_id | 删除定时任务 |
| `update_schedule` | schedule_id, ... | 更新定时任务 |
| `register_member` | name, endpoint | AI 自注册 |
| `review_delivery` | delivery_id, status | 审核交付（人类操作） |

## SOP 相关工具

| 工具 | 必填参数 | 用途 |
|------|---------|------|
| `get_sop_context` | task_id | 获取 SOP 执行上下文（当前阶段+知识库） |
| `save_stage_output` | task_id, output | 保存阶段中间产出 |
| `advance_sop_stage` | task_id, stage_output | 完成当前阶段，推进到下一阶段 |
| `request_sop_confirm` | task_id, confirm_message | 请求人工确认 |
| `create_sop_template` | name, stages | 创建 SOP 模板 |
| `update_sop_template` | template_id, ... | 更新 SOP 模板 |
| `update_knowledge` | document_id, content, layer | 更新知识库 |

## Agent MCP Token 工具（v3.0 新增）

| 工具 | 必填参数 | 用途 |
|------|---------|------|
| `get_agent_mcp_token` | member_id (可选) | 获取当前 Agent 的 MCP Token，首次调用自动创建 |
| `list_agent_mcp_tokens` | member_id (可选) | 列出当前 Agent 的所有 MCP Token |
| `revoke_agent_mcp_token` | token_id | 撤销指定的 Agent MCP Token |

> **说明**：Agent MCP Token 用于对话信道自动认证。外部 API 调用时，member_id 自动注入。

## Content Studio 工具

| 工具 | 必填参数 | 用途 |
|------|---------|------|
| `create_render_template` | name, html_template, slots | 创建渲染模板 |
| `update_render_template` | template_id, ... | 更新渲染模板 |

## 验证工具选择指南

```
操作类型                    验证工具
─────────────────────────────────────────
状态变更 (update_task_status)  → get_task
批量创建任务                   → list_my_tasks
创建/更新文档                  → get_document / search_documents
提交交付                       → list_my_deliveries + get_delivery
定时任务                       → list_schedules
里程碑                         → list_milestones
SOP 执行需要上下文              → get_sop_context
```

## 对话信道 Actions 支持的操作

**查询类**：
- ✅ `get_task` — 获取任务详情
- ✅ `list_my_tasks` — 获取我的任务列表
- ✅ `get_project` — 获取项目详情
- ✅ `get_project_members` — 获取项目成员
- ✅ `get_document` — 获取文档内容
- ✅ `search_documents` — 搜索文档
- ✅ `get_message_template` — 获取消息模板（v1.0.1+，替代 get_template）
- ✅ `list_message_templates` — 列出消息模板（v1.0.1+，替代 list_templates）
- ✅ `list_schedules` — 列出定时任务
- ✅ `list_milestones` — 列出里程碑
- ✅ `list_render_templates` — 列出渲染模板
- ✅ `get_render_template` — 获取渲染模板详情
- ✅ `get_sop_context` — 获取 SOP 执行上下文（v1.0.1+，替代 get_sop_previous_output + get_sop_knowledge_layer）

**写入类**：
- ✅ `create_task` — 创建新任务
- ✅ `update_task_status` — 更新任务状态
- ✅ `add_comment` — 添加任务评论
- ✅ `create_check_item` — 创建检查项
- ✅ `complete_check_item` — 完成检查项
- ✅ `create_document` — 创建文档
- ✅ `update_document` — 更新文档
- ✅ `deliver_document` — 提交文档交付
- ✅ `create_milestone` — 创建里程碑
- ✅ `update_milestone` — 更新里程碑
- ✅ `delete_milestone` — 删除里程碑
- ✅ `invoke_skill` — 调用 Skill 执行任务

**状态类**：
- ✅ `update_status` — 更新 AI 状态
- ✅ `set_queue` — 设置任务队列
- ✅ `set_do_not_disturb` — 免打扰模式

**SOP 类**：
- ✅ `advance_sop_stage` — 推进 SOP 阶段
- ✅ `request_sop_confirm` — 请求 SOP 确认
- ✅ `get_sop_context` — 获取 SOP 上下文
- ✅ `save_stage_output` — 保存阶段产出
- ✅ `update_knowledge` — 更新知识库
- ✅ `create_sop_template` — 创建 SOP 模板
- ✅ `update_sop_template` — 更新 SOP 模板
- ✅ `create_render_template` — 创建渲染模板
- ✅ `update_render_template` — 更新渲染模板

**扩展类**：
- ✅ `sync_identity` — 同步身份信息
- ✅ `get_mcp_token` — 获取 MCP API Token

**不支持的操作**（必须用 MCP API）：
- ❌ `create_schedule` / `update_schedule` / `delete_schedule` — 定时任务管理
- ❌ `review_delivery` — 审核交付（人类操作）
- ❌ `register_member` — 成员注册
