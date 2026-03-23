# Deprecated MCP 工具移除计划

> **技术债类型**: 计划性废弃  
> **风险等级**: 中（影响依赖这些工具的 Agent 配置）  
> **处理策略**: v1.1.0 或 v0.0.0 彻底移除，提前公告

---

## 背景

v3.0.3 起，以下 7 个 MCP 工具被标记为 **DEPRECATED**，但仍向后兼容可用。计划在 **v3.1.0** 或 **v4.0.0** 版本中彻底移除。

---

## 废弃工具清单

| 废弃工具 | 替代方案 | 废弃版本 | 计划移除版本 |
|----------|----------|----------|--------------|
| `get_task_detail` | `get_task` + `detail=true` | v1.0.1 | v1.1.0 |
| `get_project_detail` | `get_project` + `detail=true` | v1.0.1 | v1.1.0 |
| `get_document_detail` | `get_document` + `detail=true` | v1.0.1 | v1.1.0 |
| `get_sop_previous_output` | `get_sop_context` | v1.0.1 | v1.1.0 |
| `get_sop_knowledge_layer` | `get_sop_context` | v1.0.1 | v1.1.0 |
| `get_template` | `get_message_template` | v1.0.1 | v1.1.0 |
| `list_templates` | `list_message_templates` | v1.0.1 | v1.1.0 |

---

## 迁移检查清单

### 移除前必须完成

- [ ] **公告期** (至少 2 周)
  - 在 CHANGELOG 中声明废弃时间表
  - 更新 MCP 工具文档
  - 通知所有使用 TeamClaw MCP 的 Agent 开发者

- [ ] **文档更新**
  - [ ] 从 `definitions.ts` 删除工具定义
  - [ ] 从 `tool-registry.ts` 删除 handler 注册
  - [ ] 删除 API 路由别名（如 `get_template` 别名）
  - [ ] 更新 `tool-selection-guide.md`

- [ ] **代码清理**
  - [ ] 删除 `wrapWithDeprecationWarning` 包装器（如无其他用途）
  - [ ] 删除相关 handler 文件（如未被其他工具复用）
  - [ ] 更新 `src/core/mcp/executor.ts` 中的 switch-case

- [ ] **验证测试**
  - [ ] 确保所有内部调用已迁移到新接口
  - [ ] 运行 MCP 集成测试
  - [ ] 验证工具列表 API 返回正确

---

## 当前状态 (v1.0.1)

### 已实施的废弃措施

1. **工具描述标记** - `definitions.ts` 中添加 `[DEPRECATED v1.0.1]` 前缀
2. **运行时警告** - `tool-registry.ts` 中包装 handler，控制台输出警告
3. **替代工具** - 新增 `get_message_template`, `list_message_templates`
4. **统一接口** - `get_task`, `get_project`, `get_document` 支持 `detail` 参数
5. **合并接口** - 新增 `get_sop_context` 替代两个旧接口

### 向后兼容保障

```typescript
// 当前行为（v1.0.1）
const result = await callTool('get_task_detail', { id: 'xxx' });
// → 正常返回结果
// → 控制台输出: [DEPRECATED v1.0.1] get_task_detail is deprecated, use get_task
```

---

## 决策记录

### 为什么选择 v1.1.0 移除？

| 因素 | 评估 |
|------|------|
| 语义版本规范 | 移除 API 属于破坏性变更，适合 minor/major 版本 |
| 用户影响 | 影响所有使用这些工具的 Agent 配置，需要缓冲期 |
| 迁移成本 | 低（参数调整即可），但需通知用户 |
| 维护成本 | 保留旧代码增加维护负担，不宜长期保留 |

### 备选方案

- **延迟到 v0.0.0**: 如果 v1.1.0 发布时间较近，或用户反馈需要更多迁移时间
- **提供迁移脚本**: 自动化扫描并更新 Agent 配置中的工具调用

---

## 相关文档

- [优化方案 v1.0.1](/docs/optimization/OPTIMIZATION_PLAN_v1.0.1.md)
- [工具选择指南](/public/skills/guides/tool-selection-guide.md)
- [统一任务推送模板](/public/skills/templates/task-push-unified.md)
- [CHANGELOG](/CHANGELOG.md)

---

## 更新记录

| 日期 | 操作 | 内容 |
|------|------|------|
| 2026-03-17 | 创建 | 记录 7 个废弃工具及移除计划 |
| 2026-03-20 | 更新 | v3.0.3 更新版本号，重新评估移除时间线 |
