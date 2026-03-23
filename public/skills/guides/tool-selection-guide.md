# MCP 工具选择指南

> v1.0.1 新增：帮助 AI 选择正确的工具，避免使用已废弃的工具

---

## 任务管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取任务详情 | `get_task` + detail=true | `get_task_detail` |
| 获取项目详情 | `get_project` + detail=true | `get_project_detail` |

**示例：**
```json
// ✅ 推荐：使用 get_task 获取完整详情
{
  "tool": "get_task",
  "parameters": {
    "task_id": "task_xxx",
    "detail": true
  }
}

// ❌ 避免：get_task_detail 已废弃
{
  "tool": "get_task_detail",
  "parameters": { "task_id": "task_xxx" }
}
```

---

## 文档管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取文档 | `get_document` + detail=true | `get_document_detail` |

---

## SOP 管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取 SOP 上下文 | `get_sop_context` | `get_sop_previous_output`, `get_sop_knowledge_layer` |

---

## 模板管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取消息模板 | `get_message_template` | `get_template` |
| 列出消息模板 | `list_message_templates` | `list_templates` |

**v1.0.1 新增：**
- `get_message_template` - 获取渲染后的消息模板内容
- `list_message_templates` - 列出所有可用的消息模板
- 支持新的统一模板 `task-push-unified`（普通/批量/SOP 任务通用）

---

## 知识库沉淀

任务完成后，如有可复用经验，建议使用 `update_knowledge` 沉淀到知识库。

**沉淀格式：**
```
踩坑点：xxx
解决方案：yyy
适用场景：zzz
```

---

## Deprecated 工具列表

以下工具仍可用，但会返回警告，建议迁移到新工具：

| 废弃工具 | 替代方案 | 版本 |
|----------|----------|------|
| `get_task_detail` | `get_task` + detail=true | v1.0.1 |
| `get_project_detail` | `get_project` + detail=true | v1.0.1 |
| `get_document_detail` | `get_document` + detail=true | v1.0.1 |
| `get_sop_previous_output` | `get_sop_context` | v1.0.1 |
| `get_sop_knowledge_layer` | `get_sop_context` | v1.0.1 |
| `get_template` | `get_message_template` | v1.0.1 |
| `list_templates` | `list_message_templates` | v1.0.1 |
