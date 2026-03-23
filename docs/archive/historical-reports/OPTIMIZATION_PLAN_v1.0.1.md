# TeamClaw v1.0.1 优化方案

> Patch 版本优化：只增不改，向后兼容
> 
> 目标：标记冗余、新增统一入口、增强闭环提示

---

## 优化约束（Patch 版本）

| 约束 | 说明 |
|------|------|
| **不删除** | 不删除任何工具、模板、API |
| **不改签名** | 不改现有函数参数和返回值 |
| **只增不改** | 新增统一入口，旧入口保留 |
| **向后兼容** | 现有代码无需修改即可运行 |

---

## 优化内容

### 1. 新增统一任务推送模板（不删除旧的）

**新增文件：** `public/skills/templates/task-push-unified.md`

```markdown
---
title: 统一任务推送模板
description: 支持普通/批量/SOP任务的统一模板（v1.0.1新增）
---

**这是一条{{task_type_text}}推送消息！**

{{#is_batch}}
## 批量任务（{{task_count}}个）
{{#tasks}}
### {{index}}. {{title}}
- ID: {{id}} | 优先级: {{priority}}
{{/tasks}}
{{/is_batch}}

{{#is_sop}}
## SOP任务阶段
- SOP: {{sop_name}}
- 阶段: {{current_stage_label}} ({{current_stage_index}}/{{total_stages}})
- 进度: {{progress}}%
{{#current_stage_prompt}}
### 阶段指令
{{current_stage_prompt}}
{{/current_stage_prompt}}
{{/is_sop}}

{{^is_batch}}{{^is_sop}}
## 任务信息
- ID: {{task_id}} | 标题: {{task_title}}
- 优先级: {{task_priority}} | 状态: {{task_status}}
{{/is_sop}}{{/is_batch}}

---

## 执行流程

{{#is_sop}}
1. 确认收到 → 执行阶段 → advance_sop_stage → 下一阶段
{{/is_sop}}

{{#is_batch}}
1. 确认收到 → 逐个处理 → 分别更新状态 → 总结
{{/is_batch}}

{{^is_sop}}{{^is_batch}}
1. 确认收到 → 获取上下文 → in_progress → 执行 → completed
{{/is_batch}}{{/is_sop}}

---

💡 **任务完成后**，如积累可复用经验，请使用 `update_knowledge` 沉淀到知识库。
```

**旧模板保留：** `task-push.md`, `batch-task-push.md`, `sop-task-push.md` 继续可用

**代码层新增：**

```typescript
// lib/template-engine.ts
// 新增统一渲染函数，不替换旧的
export async function renderTaskPushUnified(
  mode: 'single' | 'batch' | 'sop',
  context: TaskPushContext
): Promise<string> {
  const template = await loadTemplate('task-push-unified');
  // ... 渲染逻辑
}

// 旧函数保留
export async function renderTaskPush(context: TaskContext): Promise<string> {
  // 保持原有实现不变
}
```

---

### 2. 标记冗余工具（deprecated，不删除）

**在 MCP 工具定义中添加 deprecated 标记：**

```typescript
// core/mcp/definitions.ts
export const TEAMCLAW_TOOLS = {
  // 保留现有工具，添加 deprecated 注释
  
  get_task: {
    name: 'get_task',
    description: '获取任务详情',
    // ...
  },
  
  // 标记为 deprecated，但不删除
  get_task_detail: {
    name: 'get_task_detail',
    description: '[DEPRECATED] 请使用 get_task 并传 detail=true',
    parameters: {
      // 保持原样
    },
  },
  
  get_project_detail: {
    name: 'get_project_detail', 
    description: '[DEPRECATED] 请使用 get_project 并传 detail=true',
    // ...
  },
  
  // 同理标记其他 detail 工具
  get_document_detail: {
    name: 'get_document_detail',
    description: '[DEPRECATED] 请使用 get_document 并传 detail=true',
  },
  
  get_sop_previous_output: {
    name: 'get_sop_previous_output',
    description: '[DEPRECATED] 请使用 get_sop_context',
  },
  
  get_sop_knowledge_layer: {
    name: 'get_sop_knowledge_layer',
    description: '[DEPRECATED] 请使用 get_sop_context',
  },
  
  // 模板工具标记
  get_template: {
    name: 'get_template',
    description: '[DEPRECATED] 请使用 get_message_template',
  },
  
  list_templates: {
    name: 'list_templates',
    description: '[DEPRECATED] 请使用 list_message_templates',
  },
};
```

**在 handler 中添加运行时警告：**

```typescript
// app/api/mcp/handlers/task.handler.ts
async function handleGetTaskDetail(params: any) {
  console.warn('[DEPRECATED] get_task_detail is deprecated, use get_task with detail=true');
  // 转发到 get_task
  return this.handleGetTask({ ...params, detail: true });
}
```

---

### 3. 增强知识结晶提示（新增功能）

**在任务完成返回中新增提示（不修改现有返回结构）：**

```typescript
// app/api/mcp/handlers/task.handler.ts
private async handleUpdateTaskStatus(params: Record<string, unknown>): Promise<HandlerResult> {
  // 现有逻辑保持不变
  
  const result = await this.updateTaskStatus(params);
  
  // v1.0.1 新增：任务完成时附加提示
  if (params.status === 'completed') {
    return {
      ...result,
      // 新增字段，不影响现有解析
      _v1_0_1_hint: {
        knowledge_crystallization: {
          message: '💡 任务已完成！如有可复用经验，建议使用 update_knowledge 沉淀',
          document_url: '/docs/knowledge-crystallization',
        },
      },
    };
  }
  
  return result;
}
```

**新增文档：** `docs/guides/knowledge-crystallization.md`

```markdown
# 知识结晶指南

## 何时使用

任务完成后，如果积累了以下类型的经验：
- 踩坑记录
- 解决方案
- 关键决策依据

## 如何使用

```json
{
  "actions": [{
    "type": "update_knowledge",
    "document_id": "项目知识库ID",
    "content": "经验内容"
  }]
}
```

## 沉淀格式

```
踩坑点：xxx
解决方案：yyy
适用场景：zzz
```
```

---

### 4. 新增统一 Template 别名（不改旧路由）

**新增 API 路由（旧路由保留）：**

```typescript
// app/api/message-templates/route.ts（新增文件）
// 与 /api/templates 功能相同，只是别名

import { GET, POST } from '../templates/route';
export { GET, POST };
```

**在 MCP 工具中新增别名：**

```typescript
// core/mcp/definitions.ts
export const TEAMCLAW_TOOLS = {
  // 保留旧的
  get_template: {
    name: 'get_template',
    description: '[DEPRECATED] 请使用 get_message_template',
    // ...
  },
  
  // v1.0.1 新增
  get_message_template: {
    name: 'get_message_template',
    description: '获取消息模板（与 get_template 相同）',
    parameters: {
      // 与 get_template 相同
    },
  },
  
  list_message_templates: {
    name: 'list_message_templates',
    description: '列出消息模板（与 list_templates 相同）',
    // ...
  },
};
```

**实现层复用：**

```typescript
// app/api/mcp/handlers/template.handler.ts
async function handleGetMessageTemplate(params: any) {
  // 直接复用现有实现
  return this.handleGetTemplate(params);
}
```

---

### 5. 新增工具使用指南（纯文档）

**新增 Skill 文档：** `public/skills/guides/tool-selection-guide.md`

```markdown
# MCP 工具选择指南

## 任务管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取任务详情 | `get_task` + detail=true | `get_task_detail` |
| 获取项目详情 | `get_project` + detail=true | `get_project_detail` |

## 文档管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取文档 | `get_document` + detail=true | `get_document_detail` |

## SOP 管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取 SOP 上下文 | `get_sop_context` | `get_sop_previous_output`, `get_sop_knowledge_layer` |

## 模板管理

| 场景 | 推荐工具 | 避免使用 |
|------|----------|----------|
| 获取消息模板 | `get_message_template` | `get_template` |
| 列出消息模板 | `list_message_templates` | `list_templates` |
```

---

## 版本号更新

**package.json：**

```json
{
  "name": "teamclaw",
  "version": "1.0.1",
  // ...
}
```

**CHANGELOG.md：**

```markdown
## [1.0.1] - 2026-03-17

### Added
- 新增统一任务推送模板 `task-push-unified.md`
- 新增 MCP 工具别名 `get_message_template`, `list_message_templates`
- 新增任务完成知识结晶提示
- 新增工具选择指南文档

### Deprecated
- `get_task_detail` → 使用 `get_task` + detail=true
- `get_project_detail` → 使用 `get_project` + detail=true
- `get_document_detail` → 使用 `get_document` + detail=true
- `get_sop_previous_output` → 使用 `get_sop_context`
- `get_sop_knowledge_layer` → 使用 `get_sop_context`
- `get_template` → 使用 `get_message_template`
- `list_templates` → 使用 `list_message_templates`

### Note
- 所有 deprecated 工具仍可用，但会在返回中添加警告
- 无破坏性变更，现有代码无需修改
```

---

## 检查清单

### 发布前检查

- [ ] 所有现有测试通过
- [ ] 新增模板渲染正常
- [ ] deprecated 工具返回警告但不报错
- [ ] 旧模板仍可正常使用
- [ ] API 路由别名正常工作
- [ ] 文档更新完成

### 发布后监控

- [ ] 无新增错误日志
- [ ] 性能无下降
- [ ] Agent 使用正常

---

**方案版本：** v1.0  
**制定日期：** 2026-03-17  
**当前软件版本：** v1.0.0  
**目标软件版本：** v1.0.1  
**预计发布：** 2026-03-20
