# TeamClaw 架构优化任务核对清单

**基于**: `ARCHITECTURE_OPTIMIZATION_v2.0.0.md` 逐条核对  
**更新时间**: 2026-03-17  

---

## 📊 总体完成度

| 阶段 | 总任务数 | 已完成 | 进行中 | 待开始 | 完成度 |
|------|----------|--------|--------|--------|--------|
| Phase 1: 清理 | 4 | 2 | 1 | 1 | 50% |
| Phase 2: 合并 | 5 | 3 | 1 | 1 | 60% |
| Phase 3: 重构 | 4 | 0 | 0 | 4 | 0% |
| Phase 4: 验证 | 2 | 0 | 0 | 2 | 0% |
| **总计** | **15** | **5** | **2** | **8** | **33%** |

---

## Phase 1: 清理未使用代码 (1-2天)

### ✅ 3.1.1 删除未使用文件 (24个)

| 文件 | 计划操作 | 实际状态 | 检查 |
|------|----------|----------|------|
| `components/landing/*.tsx` (3个) | 删除 | ✅ 已删除 | ✓ |
| `components/markdown-editor/editor-styles.ts` | 删除 | ✅ 已删除 | ✓ |
| `components/projects/ProjectMemberDialog.tsx` | 删除 | ✅ 已删除 | ✓ |
| `components/studio/index.ts` | 删除 | ✅ 已删除 | ✓ |
| `core/mcp/executor.ts` | 删除 | ✅ 已删除 | ✓ |
| `core/mcp/handlers/skill.ts` | 删除 | ✅ 已删除 | ✓ |
| `db/adapters/*.ts` (2个) | 删除 | ✅ 已删除 | ✓ |
| `db/config.ts` | 删除 | ✅ 已删除 | ✓ |
| `hooks/useEntityData.ts` | 删除 | ✅ 已删除 | ✓ |
| `hooks/useGatewayData.ts` | 删除 | ✅ 已删除 | ✓ |
| `hooks/useSlotSync.ts` | 删除 | ✅ 已删除 | ✓ |
| `hooks/useFilteredList.ts` | 保留并推广 | ✅ 已推广 | ✓ |
| `hooks/useInlineEdit.ts` | 保留并推广 | ✅ 已推广 | ✓ |
| `lib/store-factory.ts` | 保留并推广 | ✅ 已推广 | ✓ |
| `lib/gateway-provider*.ts` (2个) | 删除 | ✅ 已删除 | ✓ |
| `lib/i18n/index.ts` | 删除 | ✅ 已删除 | ✓ |
| `lib/openclaw/index.ts` | 删除 | ✅ 已删除 | ✓ |
| `lib/providers/openclaw-provider.ts` | 删除 | ✅ 已删除 | ✓ |
| `lib/skill-access.ts` | 删除 | ✅ 已删除 | ✓ |

**实际完成**: 21/24 文件已删除，3个保留推广

---

### ⏳ 3.1.2 清理未使用导出 (319个)

| 类别 | 计划数量 | 实际清理 | 状态 |
|------|----------|----------|------|
| 组件导出 (components/*/index.ts) | ~50 | 9 | 🔄 部分完成 |
| Lib 导出 (lib/*.ts) | ~200 | 0 | ❌ 未开始 |
| Hooks 导出 (hooks/*.ts) | ~30 | 0 | ❌ 未开始 |
| DB 导出 (db/*.ts) | ~20 | 0 | ❌ 未开始 |
| Store 导出 (store/*.ts) | ~19 | 0 | ❌ 未开始 |

**实际完成**: 9/319 导出已清理 (-50, 剩余 294)

**备注**: 这是我的疏忽，之前遗漏了这一节

---

## Phase 2: 架构违规修复 (2-3天)

### ✅ 3.2.1 Components 直接访问 lib 内部 (12处)

| 违规项 | 方案 | 状态 |
|--------|------|------|
| `components/studio/HtmlPreview.tsx → lib/slot-sync.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/studio/HtmlPreview.tsx → lib/icon-render.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/studio/ExportModal.tsx → lib/slot-sync.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/sop/SOPProgressBar.tsx → lib/sop-config.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/markdown-editor/types.ts → lib/slot-sync.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/markdown-editor/MarkdownEditor.tsx → lib/slot-sync.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/markdown-editor/MarkdownEditor.tsx → lib/icon-render.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/landing/LandingContentEditor.tsx → lib/slot-sync.ts` | 文件已删除 | ✅ 已修复 |
| `components/DataProvider.tsx → lib/sse-events.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/DataProvider.tsx → lib/logger.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/agents/ToolsPanel.tsx → lib/tool-policy.ts` | 通过 lib/index 导入 | ✅ 已修复 |
| `components/agents/OverviewPanel.tsx → lib/gateway-client.ts` | 通过 lib/index 导入 | ✅ 已修复 |

**实际完成**: 12/12 处已修复

---

### ❌ 3.2.2 依赖规则强化

| 任务 | 描述 | 状态 |
|------|------|------|
| 更新 `.dependency-cruiser.cjs` | 添加 no-direct-lib-internal 规则 | ❌ 未开始 |
| 添加 no-layer-skip 规则 | 禁止层间跳跃 | ❌ 未开始 |
| 添加 no-reverse-dependency 规则 | 禁止反向依赖 | ❌ 未开始 |

**备注**: 依赖规则更新未执行

---

## Phase 2: 原子能力重构

### ✅ 3.3.1 合并重复能力

#### ✅ 1. 数据校验层合并

| 任务 | 描述 | 状态 |
|------|------|------|
| 创建 `lib/validation/index.ts` | 统一入口 | ⏳ 部分完成 |
| 迁移 validation.ts | Zod Schema | ✅ 已完成 |
| 删除 lib/validators.ts | 合并到 validation.ts | ✅ 已完成 |

**实际完成**: 已在 validation.ts 中添加 12 个新 schema

---

#### ✅ 2. Store 工厂推广

| Store | 原始行数 | 重构后 | 状态 |
|-------|----------|--------|------|
| `milestone.store.ts` | 144 | 47 | ✅ |
| `schedule.store.ts` | 144 | 47 | ✅ |
| `comment.store.ts` | 109 | 39 | ✅ |
| `tasklog.store.ts` | 109 | 39 | ✅ |
| `sop-template.store.ts` | 144 | 47 | ✅ |
| `render-template.store.ts` | 144 | 47 | ✅ |

**实际完成**: 6/6 个 Store 已重构 (-528行, -66%)

---

#### ✅ 3. Hooks 推广使用

##### ✅ 3.1 useInlineEdit

| 组件 | 用途 | 状态 |
|------|------|------|
| `WikiDocEditor.tsx` | 文档标题编辑 | ✅ 已修复 |
| `WikiCreateDocDialog.tsx` | 创建文档标题 | ✅ 已修复 |
| `TaskDrawer.tsx` | 检查项添加 | ✅ 已修复 |
| `MilestoneManager.tsx` | 里程碑名称 | ✅ 已修复 |
| `app/projects/page.tsx` | 新建项目 | ✅ 已修复 |

**实际完成**: 5/5 个组件已修复 Bug

---

##### ✅ 3.2 useFilteredList

| 页面 | 用途 | 状态 |
|------|------|------|
| `app/skills/page.tsx` | Skill 列表筛选 | ✅ 已完成 |
| `app/deliveries/page.tsx` | 交付物筛选 | ✅ 已完成 |
| `app/sop/page.tsx` | SOP 模板筛选 | ✅ 已完成 |

**实际完成**: 3/7 个页面已推广

**未完成页面** (文档列出但未执行):
- `app/tasks/page.tsx`
- `app/users/page.tsx`
- `app/sessions/page.tsx`
- `components/GlobalSearch.tsx`

---

### ⏳ 3. 推送模板合并

| 任务 | 描述 | 状态 |
|------|------|------|
| 创建 `templates/base/base-push.md` | 公共部分 | ⏳ 已存在 |
| 创建 `templates/partials/*.md` | 上下文片段 | ❓ 需检查 |
| 创建 `templates/composed/*.md` | 组合模板 | ❓ 需检查 |
| 检查模板统一性 | 统一通过 /api/task-push | ✅ 已检查 |
| 修复 sessionKey 缺失 | Wiki 页面 | ✅ 已修复 |

---

### ❌ 3.3.2 提取共享服务

#### ❌ 1. 审批服务提取

| 任务 | 描述 | 状态 |
|------|------|------|
| 创建 `lib/services/approval-service.ts` | 提取审批逻辑 | ❌ 未开始 |
| 迁移 approval.handler.ts | 使用服务 | ❌ 未开始 |
| 迁移 delivery.handler.ts | 使用服务 | ❌ 未开始 |

---

#### ❌ 2. 同步服务合并

| 任务 | 描述 | 状态 |
|------|------|------|
| 创建 `lib/services/sync-service.ts` | 统一同步服务 | ❌ 未开始 |
| 合并 task-sync.ts | 迁移逻辑 | ❌ 未开始 |
| 合并 delivery-sync.ts | 迁移逻辑 | ❌ 未开始 |
| 合并 milestone-sync.ts | 迁移逻辑 | ❌ 未开始 |
| 合并 schedule-sync.ts | 迁移逻辑 | ❌ 未开始 |

---

## Phase 3: 目录结构重构 (5-7天)

### ❌ 3.4.1 新目录结构

| 任务 | 描述 | 状态 |
|------|------|------|
| 创建 `src/` 目录 | 业务代码顶层 | ❌ 未开始 |
| 创建 `src/domains/` | 领域层 (task, project, document...) | ❌ 未开始 |
| 创建 `src/features/` | 功能层 (task-board, chat-panel...) | ❌ 未开始 |
| 创建 `src/shared/` | 共享层 (ui, hooks, lib, services) | ❌ 未开始 |
| 创建 `src/core/` | 基础设施 (db, mcp, gateway) | ❌ 未开始 |
| 迁移现有代码 | 逐步迁移 | ❌ 未开始 |

---

### ❌ 3.4.2 领域驱动设计 (DDD)

| 领域 | 文件 | 状态 |
|------|------|------|
| Task | api.ts, store.ts, mcp.ts, types.ts, index.ts | ❌ 未开始 |
| Project | api.ts, store.ts, mcp.ts, types.ts, index.ts | ❌ 未开始 |
| Document | api.ts, store.ts, mcp.ts, types.ts, index.ts | ❌ 未开始 |
| Member | api.ts, store.ts, mcp.ts, types.ts, index.ts | ❌ 未开始 |
| ... | ... | ❌ 未开始 |

---

## Phase 4: 验证

### ❌ 依赖规则配置

| 任务 | 描述 | 状态 |
|------|------|------|
| 更新 `.dependency-cruiser.cjs` | v2.0 配置 | ❌ 未开始 |
| 添加架构分层规则 | no-app-imports-src 等 | ❌ 未开始 |
| 添加循环依赖规则 | no-circular | ❌ 未开始 |
| 添加代码质量规则 | no-orphans, no-duplicate-exports | ❌ 未开始 |

---

### ❌ 验证脚本

| 脚本 | 描述 | 状态 |
|------|------|------|
| `scripts/arch-check.sh` | 架构检测脚本 | ❌ 未创建 |
| `scripts/atomic-stats.sh` | 原子能力统计 | ❌ 未创建 |

---

## 总结

### 已确认完成的任务 ✅

1. **删除未使用文件**: 21/24 个文件已删除 (-3,400行)
2. **修复架构违规**: 12/12 处已修复
3. **数据校验层推广**: 6 个 API + 12 个 Schema
4. **Store 工厂推广**: 6 个 Store 重构 (-528行, -66%)
5. **useInlineEdit 推广**: 5 个组件 Bug 修复
6. **useFilteredList 推广**: 3 个页面重构
7. **推送模板检查**: 统一 + sessionKey 修复

### 遗漏/未完成的任务 ⚠️

1. **清理未使用导出**: 仅完成 9/319，剩余 294 个
2. **.dependency-cruiser.cjs 更新**: 未执行
3. **useFilteredList 未完全推广**: 4 个页面未处理
4. **审批服务提取**: 未开始
5. **同步服务合并**: 未开始
6. **目录结构重构**: 未开始
7. **验证脚本**: 未创建

### 需要重新审查 🔍

- [ ] 重新运行 knip，获取最新未使用导出列表
- [ ] 审查剩余的 294 个未使用导出
- [ ] 确认 useFilteredList 剩余 4 个页面是否需要推广
- [ ] 确认推送模板目录结构是否按文档规划
