# Changelog

> **完整变更日志请查看**: [docs/process/CHANGELOG.md](./docs/process/CHANGELOG.md)

All notable changes to this project will be documented in [docs/process/CHANGELOG.md](./docs/process/CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-03-17

### Overview

v1.0.1 是一次重要的架构优化版本，核心目标是**统一接口规范**和**简化工具集**。通过合并功能重复的工具、标准化参数命名、完善文档体系，降低 AI Agent 的使用门槛，提升开发体验。

**关键数据**：
- 废弃工具：7 个（仍可用，带警告）
- 新增工具：2 个
- 合并接口：3 个 → 1 个（SOP 上下文）
- 文档更新：4 个文件
- 向后兼容：100%（无破坏性变更）

---

### Added

#### 1. 统一任务推送模板系统

**新文件**：`public/skills/templates/task-push-unified.md`

- 支持三种任务类型的统一模板：
  - **普通任务**（`type: task`）
  - **批量任务**（`type: batch`）
  - **SOP 任务**（`type: sop`）
- 使用 Mustache 变量替换（`{{taskId}}`, `{{projectId}}` 等）
- 包含任务信息、上下文、知识库、执行步骤、输出格式等模块
- 渐进式上下文获取指引（L1/L2 分层）

#### 2. MCP 工具接口统一

**新增工具**（作为推荐接口）：

| 工具 | 用途 | 替代方案 |
|------|------|----------|
| `get_message_template` | 获取消息模板内容 | `get_template` |
| `list_message_templates` | 列出所有消息模板 | `list_templates` |

**参数统一**：
- `get_task(task_id, detail=true)` - 获取任务完整详情
- `get_project(project_id, detail=true)` - 获取项目完整详情
- `get_document(document_id, detail=true)` - 获取文档完整内容

**SOP 上下文合并**：
- `get_sop_context(task_id)` 替代：
  - `get_sop_previous_output(task_id)`
  - `get_sop_knowledge_layer(task_id, layer)`

#### 3. API 路由别名

- `/api/message-templates` - 与 `/api/templates` 功能相同
- 为废弃工具提供平滑迁移路径

#### 4. 知识结晶提示增强

**文件**：`src/domains/task/mcp.ts`

- 新方法 `buildV101KnowledgeHint()`
- 返回格式改为 `_v1_0_1_hint` 包装
- 包含 `knowledge_crystallization` 结构化对象：
  ```json
  {
    "_v1_0_1_hint": {
      "knowledge_crystallization": {
        "why": "...",
        "what": "...",
        "how": "...",
        "tips": "..."
      }
    }
  }
  ```

#### 5. 工具选择指南

**新文件**：`public/skills/guides/tool-selection-guide.md`

- 按场景分类：任务管理、项目管理、文档管理、SOP 引擎等
- 工具选择决策树
- 场景与工具映射表
- 废弃工具迁移指引

#### 6. 运行时废弃警告

**文件**：`app/api/mcp/handlers/tool-registry.ts`

- `wrapWithDeprecationWarning()` 包装器
- 调用废弃工具时输出控制台警告：
  ```
  [DEPRECATED v1.0.1] xxx is deprecated, use yyy
  ```

---

### Deprecated

以下工具仍可用，但已标记为废弃，计划在 v1.1.0 彻底移除：

| 废弃工具 | 替代方案 | 废弃原因 |
|----------|----------|----------|
| `get_task_detail` | `get_task` + `detail=true` | 参数化统一，减少工具数量 |
| `get_project_detail` | `get_project` + `detail=true` | 参数化统一，减少工具数量 |
| `get_document_detail` | `get_document` + `detail=true` | 参数化统一，减少工具数量 |
| `get_sop_previous_output` | `get_sop_context` | 功能合并，简化 SOP 接口 |
| `get_sop_knowledge_layer` | `get_sop_context` | 功能合并，简化 SOP 接口 |
| `get_template` | `get_message_template` | 命名标准化 |
| `list_templates` | `list_message_templates` | 命名标准化 |

**迁移成本**：低（仅需调整参数或工具名）

---

### Documentation

#### Skill 文档更新

| 文件 | 变更 |
|------|------|
| `SKILL.md` | 版本 1.0.0 → 1.0.1，更新所有工具引用为新接口 |
| `references/tools.md` | 更新 L2 详情工具、验证场景指南、Actions 支持列表 |

**关键更新点**：
- 渐进式上下文获取：使用 `detail=true` 参数替代 `_detail` 后缀工具
- 模板工具：使用 `get_message_template` / `list_message_templates`
- SOP 执行：使用 `get_sop_context` 替代两个旧工具

#### 技术债记录

**新文件**：`docs/tech-debt/DEPRECATED_TOOLS.md`

- 7 个废弃工具清单
- 移除前检查清单
- 当前状态说明
- 决策记录（为什么选择 v1.1.0 移除）

---

### Changed

#### 1. MCP 工具定义更新

**文件**：`src/core/mcp/definitions.ts`

- 新增工具定义：`get_message_template`, `list_message_templates`
- 7 个工具描述添加 `[DEPRECATED v1.0.1]` 前缀

#### 2. 版本号更新

- `package.json`: `version` 1.0.0 → 1.0.1
- `SKILL.md`: `teamclaw_version` 1.0.0 → 1.0.1

---

### Migration Guide

#### 从 v1.0.0 迁移到 v1.0.1

**无需立即修改代码** - 所有变更向后兼容，废弃工具仍可用。

**建议迁移（可选）**：

```typescript
// 旧写法（仍可用，但会输出警告）
get_task_detail({ task_id: "xxx" })
get_template({ template_name: "xxx" })
get_sop_previous_output({ task_id: "xxx" })

// 新写法（推荐）
get_task({ task_id: "xxx", detail: true })
get_message_template({ template_name: "xxx" })
get_sop_context({ task_id: "xxx" })
```

---

### Compatibility

- **向后兼容**：✅ 100%
- **破坏性变更**：❌ 无
- **废弃工具移除计划**：v1.1.0

---

## [1.0.0] - 2026-03-01

### Added
- 初始版本发布
- MCP 工具系统（37 个工具）
- 任务管理系统
- 项目管理
- 文档管理（Wiki）
- SOP 引擎
- 交付物审核流程
- AI 成员注册与管理
