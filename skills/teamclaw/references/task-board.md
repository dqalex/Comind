---
title: 任务看板模板
description: 用于 Markdown 双向同步的任务看板模板
type: teamclaw:tasks
---

# {{project_name}} - 任务看板

> 项目ID: {{project_id}} | 更新时间: {{current_date}}

## 可用成员

**人类**: {{human_member_names}}
**AI**: {{ai_member_names}}

---

## 待办事项

- [ ] 普通任务 @负责人 [[关联文档]]
  > 任务描述
  > 截止日期: YYYY-MM-DD
  - [ ] 子检查项

- [!] 高优先任务 @负责人 [[文档A]] [[文档B]]

- [-] 低优先任务 @负责人

## 进行中

- [~] 正在执行的任务 @负责人 [30%]
  > 当前进度描述

## 审核中

- [?] 待审核任务 @负责人 [90%]

## 已完成

- [x] 已完成任务 @负责人

---

## 语法说明

| 标记 | 状态 | 优先级 |
|------|------|--------|
| `[ ]` | todo | medium |
| `[!]` | todo | high |
| `[-]` | todo | low |
| `[~]` | in_progress | - |
| `[?]` | reviewing | - |
| `[x]` | completed | - |

**其他语法**：
- `@成员名` — 分配任务
- `[[文档名]]` — 关联文档（可多个）
- `[[doc:xxx]]` — 关联文档（ID 匹配）
- `#task_xxx` — 引用已有任务
- `[进度%]` — 进度百分比
- `> 描述` — 任务描述
- `> 截止日期: YYYY-MM-DD` — 截止日期
- 缩进子任务 — 子任务清单

---

## 里程碑（可选）

在同一文档中可同时管理里程碑，使用 `## 里程碑` 标题开启里程碑区域：

```markdown
## 里程碑

### 进行中

- v0.4.6 核心功能 | 2026-03-15 | 完成里程碑管理和批注系统
  > 包含 UI 创建、Markdown 同步、Skill 模板更新

### 待开始

- v0.5.4 AI 增强 | 2026-04-01 | Agent 自主巡检和智能调度

### 已完成

- v0.3.9 基础框架 | 2026-02-25 | 数据库 Schema 和 API 完成
```

**里程碑格式**：`- 标题 | 截止日期 | 描述`

| 字段 | 格式 | 说明 |
|------|------|------|
| 标题 | 文本 | 里程碑名称（必填） |
| 截止日期 | YYYY-MM-DD | 可选 |
| 描述 | 文本 | 可选 |

**里程碑状态分区**：

| 分区标题 | 状态值 |
|---------|--------|
| 待开始 / open | open |
| 进行中 / in_progress | in_progress |
| 已完成 / completed | completed |
| 已取消 / cancelled | cancelled |

> 📌 里程碑也可使用独立文档（`type: teamclaw:milestones`），格式与此相同。

---

## ⚠️ 验证步骤（必须）

同步任务看板后，**必须通过 MCP API 验证**：

```json
// 验证任务数量和分配
{"tool": "list_my_tasks", "parameters": {"status": "todo"}}

// 验证单个任务详情
{"tool": "get_task", "parameters": {"task_id": "xxx"}}

// 验证里程碑（如有）
{"tool": "list_milestones", "parameters": {"project_id": "xxx"}}
```

**验证失败常见原因**：
- 成员名 `@xxx` 不存在 → assignees 为空
- 项目名不匹配 → project_id 为空
- 任务行格式错误 → 该行被跳过
- 里程碑缺少 project 字段 → 同步跳过
