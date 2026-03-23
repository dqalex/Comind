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
