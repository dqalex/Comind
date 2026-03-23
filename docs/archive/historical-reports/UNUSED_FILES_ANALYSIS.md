# 未使用文件分析报告

> 基于 `npx knip` 检测结果，共 **24 个未使用文件**

---

## 一、文件分类总览

| 类别 | 数量 | 文件 |
|------|------|------|
| Landing Page 组件 | 3 | Features.tsx, Hero.tsx, Footer.tsx |
| Markdown 编辑器废弃 | 1 | editor-styles.ts |
| 项目相关组件 | 1 | ProjectMemberDialog.tsx |
| Studio 组件 | 1 | studio/index.ts |
| MCP 执行引擎 | 2 | executor.ts, handlers/skill.ts |
| 数据库适配器 | 4 | adapters/index.ts, sqlite.ts, postgres.ts, config.ts |
| Hooks | 5 | useEntityData.ts, useFilteredList.ts, useGatewayData.ts, useInlineEdit.ts, useSlotSync.ts |
| Provider 抽象层 | 3 | gateway-provider-types.ts, gateway-provider.ts, openclaw-provider.ts |
| 其他工具 | 3 | lib/i18n/index.ts, lib/openclaw/index.ts, lib/skill-access.ts, lib/store-factory.ts |

---

## 二、详细文件分析

### 1. Landing Page 组件（3个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `components/landing/Features.tsx` | 营销页 - 产品特性展示 | 无直接替代 | **保留** - 未来可能用于官网或产品页 |
| `components/landing/Hero.tsx` | 营销页 - 首屏英雄区 + 产品截图 mock | 无直接替代 | **保留** - 未来可能用于官网 |
| `components/landing/Footer.tsx` | 营销页 - 页脚链接 | 无直接替代 | **保留** - 未来可能用于官网 |

**分析**：这3个组件是为营销官网设计的，目前项目专注于管理后台。如果近期不计划做官网，可考虑删除或移入 `archive/` 目录。

---

### 2. Markdown 编辑器废弃代码（1个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `components/markdown-editor/editor-styles.ts` | 旧 Markdown 编辑器的样式配置（textarea + highlight overlay 方案） | CodeMirror 6（已迁移） | **删除** |

**分析**：该文件是为旧的 textarea + 高亮层方案设计的样式常量。根据 memory，MarkdownEditor 已重构为 CodeMirror 6，此文件不再使用。

---

### 3. 项目相关组件（1个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `components/projects/ProjectMemberDialog.tsx` | 项目成员管理弹窗（添加/移除成员） | `app/projects/page.tsx` 内置成员管理 | **评估后决定** |

**分析**：这是一个完整的项目成员管理弹窗组件。检查 `app/projects/page.tsx` 中是否已有替代实现：
- 如果项目详情页已内联成员管理功能 → **删除**
- 如果需要弹窗模式但未使用 → **保留或整合**

---

### 4. Studio 组件（1个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `components/studio/index.ts` | Content Studio 导出文件（HtmlPreview, PropertyPanel, ExportModal） | 直接导入子组件 | **删除** |

**分析**：导出文件中提到的组件未被其他地方使用，属于 Content Studio 设计系统的残留。

---

### 5. MCP 执行引擎（2个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `core/mcp/executor.ts` | MCP 指令执行引擎（前端调用 MCP API） | `app/api/mcp/handlers/*.ts` 服务端处理 | **谨慎评估** |
| `core/mcp/handlers/skill.ts` | Skill 相关 MCP 处理器 | 服务端 handler | **谨慎评估** |

**分析**：
- `executor.ts` 是前端 MCP 执行引擎，通过调用 `/api/mcp` 执行 ActionInstruction
- 代码量很大（983行），包含 27+ 种 ActionInstruction 的处理逻辑
- 当前架构已改为服务端处理 MCP，前端可能直接使用 Store

**检查清单**：
- [ ] 搜索项目中是否有 `executeActionInstruction` 或 `executeActionInstructions` 的调用
- [ ] 确认前端是否通过此文件调用 MCP
- [ ] 如果没有调用 → **删除**
- [ ] 如果有调用 → **保留** 或迁移到服务端

---

### 6. 数据库适配器（4个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `db/adapters/index.ts` | 适配器统一导出 | 直接导入 | **删除** |
| `db/adapters/sqlite.ts` | SQLite 适配器 | `db/index.ts` 中的实现 | **评估** |
| `db/adapters/postgres.ts` | PostgreSQL 适配器 | `db/index.ts` 中的实现 | **评估** |
| `db/config.ts` | 数据库配置工厂 | `db/index.ts` 中的实现 | **评估** |

**分析**：
- 这4个文件是为多数据库支持设计的抽象层
- 但项目目前实际使用的是 `db/index.ts` 中的简化实现
- 检查 `db/index.ts` 是否已包含完整的 SQLite/PostgreSQL 支持

**建议**：
- 如果 `db/index.ts` 已能满足需求 → **删除** 这4个文件
- 如果需要支持 PostgreSQL 迁移 → **保留** 并整合

---

### 7. Hooks（5个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `hooks/useEntityData.ts` | 实体数据集中订阅 Hook（members/projects/tasks等） | 各组件直接订阅 Store | **删除或推广使用** |
| `hooks/useFilteredList.ts` | 列表筛选/搜索/排序 Hook | 各页面自行实现 | **保留** |
| `hooks/useGatewayData.ts` | Gateway 数据集中订阅 Hook | 各组件直接订阅 gateway.store | **删除或推广使用** |
| `hooks/useInlineEdit.ts` | 内联编辑 Hook（解决 Enter/Blur 双重提交） | 各组件自行实现 | **保留** |
| `hooks/useSlotSync.ts` | MD ↔ HTML 双向槽位同步 Hook | lib/slot-sync.ts | **评估** |

**分析**：

1. **useEntityData.ts / useGatewayData.ts**：
   - 这些 Hooks 是为了减少组件重复代码设计的
   - 如果各组件直接订阅 Store → **删除**
   - 如果需要统一数据层 → **推广使用**

2. **useFilteredList.ts**：
   - 提供统一的列表筛选、搜索、排序功能
   - 质量较高，建议在需要筛选的页面推广使用

3. **useInlineEdit.ts**：
   - 解决 Enter/Blur 双重提交问题
   - 建议在需要内联编辑的组件中使用

4. **useSlotSync.ts**：
   - 基于 `lib/slot-sync.ts` 的 React Hook
   - 如果渲染模板功能还在使用 → **保留**
   - 如果已废弃 → **删除**

---

### 8. Provider 抽象层（3个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `lib/gateway-provider-types.ts` | Gateway Provider 类型定义 | 直接使用 gateway-client | **删除** |
| `lib/gateway-provider.ts` | Gateway Provider 工厂 | 直接使用 gateway-client | **删除** |
| `lib/providers/openclaw-provider.ts` | OpenClaw Provider 实现（已标记废弃） | 服务端代理模式 | **删除** |

**分析**：
- 这是为支持多 Gateway 平台（OpenClaw、Knot 等）设计的抽象层
- 根据 `openclaw-provider.ts` 中的注释，浏览器直连模式已废弃
- 当前使用服务端代理模式，不需要 Provider 抽象

**建议**：**删除** 这3个文件，未来需要时再重新设计。

---

### 9. 其他工具（4个）

| 文件 | 用途 | 替代方案 | 建议 |
|------|------|----------|------|
| `lib/i18n/index.ts` | 异步加载语言包 | `lib/i18n.ts` | **评估** |
| `lib/openclaw/index.ts` | OpenClaw 同步服务入口 | 各模块单独导入 | **删除** |
| `lib/skill-access.ts` | Skill 权限检查模块 | 未实现或使用其他方式 | **评估** |
| `lib/store-factory.ts` | CRUD Store 工厂 | 各 Store 自行实现 | **评估** |

**分析**：

1. **lib/i18n/index.ts**：
   - 异步加载语言包的优化实现
   - 检查 `lib/i18n.ts` 是否为同步加载版本
   - 如果需要减少首屏体积 → **保留并替换**
   - 否则 → **删除**

2. **lib/openclaw/index.ts**：
   - 导出同步服务模块
   - 如果同步功能还在使用 → **保留**
   - 否则 → **删除**

3. **lib/skill-access.ts**：
   - Skill 权限检查模块
   - 如果多用户 Skill 权限控制已实现 → **保留并推广**
   - 否则 → **删除**

4. **lib/store-factory.ts**：
   - CRUD Store 工厂，可消除 18 个 Store 的重复代码
   - 非常有价值，建议推广使用
   - 如果决定推广 → **保留**
   - 否则 → **删除**

---

## 三、删除建议汇总

### Phase 1: 立即可删除（低风险）✅ 已完成

| 序号 | 文件 | 理由 | 状态 |
|------|------|------|------|
| 1 | `components/markdown-editor/editor-styles.ts` | 旧 Markdown 编辑器已废弃 | ✅ 已删除 |
| 2 | `components/studio/index.ts` | Studio 组件未使用 | ✅ 已删除 |
| 3 | `lib/gateway-provider-types.ts` | Provider 模式已废弃 | ✅ 已删除 |
| 4 | `lib/gateway-provider.ts` | Provider 模式已废弃 | ✅ 已删除 |
| 5 | `lib/providers/openclaw-provider.ts` | 已标记废弃 | ✅ 已删除 |
| 6 | `db/adapters/index.ts` | 适配器模式未使用 | ✅ 已删除 |

### Phase 1 延续: Landing Page 遗留组件 ✅ 已完成

| 序号 | 文件 | 理由 | 状态 |
|------|------|------|------|
| 7 | `components/landing/Features.tsx` | Landing Page 已改造为渲染模板 | ✅ 已删除 |
| 8 | `components/landing/Hero.tsx` | 使用 rt-landing-page.ts + landing_pages 表 | ✅ 已删除 |
| 9 | `components/landing/Footer.tsx` | 不再使用静态 React 组件 | ✅ 已删除 |

### Phase 2A: 确认后删除（中风险）✅ 已完成

| 序号 | 文件 | 审查结果 | 状态 |
|------|------|----------|------|
| 10 | `core/mcp/executor.ts` | 无调用，使用 `lib/chat-channel/executor.ts` | ✅ 已删除 |
| 11 | `core/mcp/handlers/skill.ts` | 无调用，已迁移到服务端 | ✅ 已删除 |
| 12 | `db/adapters/sqlite.ts` | 仅内部引用，无外部使用 | ✅ 已删除 |
| 13 | `db/adapters/postgres.ts` | 仅内部引用，无外部使用 | ✅ 已删除 |
| 14 | `db/config.ts` | 导出函数未被使用 | ✅ 已删除 |
| 15 | `components/projects/ProjectMemberDialog.tsx` | 全项目无引用，已内联实现 | ✅ 已删除 |
| 16 | `hooks/useSlotSync.ts` | 未使用，底层 `lib/slot-sync.ts` 保留 | ✅ 已删除 |
| 17 | `hooks/useEntityData.ts` | 未使用，各组件直接订阅 Store | ✅ 已删除 |
| 18 | `hooks/useGatewayData.ts` | 未使用，各组件直接订阅 Store | ✅ 已删除 |
| 19 | `lib/openclaw/index.ts` | 无引用，同步服务已废弃 | ✅ 已删除 |

### Phase 2B: 决策后删除/保留 ✅ 已完成

| 序号 | 文件 | 决策 | 理由 |
|------|------|------|------|
| 20 | `lib/skill-access.ts` | **保留** | 需要 Skill 权限控制（多用户隔离）|
| 21 | `lib/i18n/index.ts` | **删除** | 与 `lib/i18n.ts` 完全重复 |

### 建议保留并推广使用（有价值）

| 序号 | 文件 | 推广建议 |
|------|------|----------|
| 19 | `hooks/useFilteredList.ts` | 在任务列表、文档列表等页面使用 |
| 20 | `hooks/useInlineEdit.ts` | 在内联编辑场景中使用 |
| 21 | `lib/store-factory.ts` | 重构现有 Store，使用工厂模式 |

### 营销相关 - Landing Page 遗留组件（已确认可删除）

| 序号 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 22 | `components/landing/Features.tsx` | **可删除** | Landing Page 已改造为渲染模板系统 |
| 23 | `components/landing/Hero.tsx` | **可删除** | 使用 `rt-landing-page.ts` + `landing_pages` 表 |
| 24 | `components/landing/Footer.tsx` | **可删除** | 不再使用静态 React 组件 |

**改造说明：**
- **旧方案**：静态 React 组件（Features/Hero/Footer）
- **新方案**：渲染模板系统（`db/templates/render/rt-landing-page.ts`）+ Markdown Slot
- **数据存储**：`landing_pages` 表（替代硬编码组件）
- **确认结果**：搜索全项目无引用，可安全删除

**相关文件（保留）：**
- `db/templates/render/rt-landing-page.ts` - 渲染模板定义
- `db/schema.ts` - `landing_pages` 表结构
- `app/api/landing/*` - Landing Page API

---

## 四、执行建议

### Phase 1: 安全删除（已完成 ✅）

```bash
# 已删除 9 个文件，减少 981 行代码
git rm components/markdown-editor/editor-styles.ts
git rm components/studio/index.ts
git rm lib/gateway-provider-types.ts
git rm lib/gateway-provider.ts
git rm lib/providers/openclaw-provider.ts
git rm db/adapters/index.ts
git rm components/landing/Features.tsx
git rm components/landing/Hero.tsx
git rm components/landing/Footer.tsx
```

**提交记录**: `c7d046e refactor: 删除9个未使用文件（Phase 1）`

### Phase 2A: 确认后删除（10个文件）✅ 已完成
- [x] 搜索 `executor.ts` 和 `skill.ts` 的调用 — 无引用
- [x] 检查 `db/index.ts` 是否已覆盖适配器功能 — 已覆盖
- [x] 检查项目页成员管理实现 — 已内联
- [x] 检查渲染模板功能状态 — 底层库保留

### Phase 2B: 决策后处理（2个文件）✅ 已完成
- [x] `lib/skill-access.ts` — 保留（需要 Skill 权限控制）
- [x] `lib/i18n/index.ts` — 删除（与 `lib/i18n.ts` 重复）

### Phase 3: 推广使用（重构）
1. 识别使用 `useFilteredList.ts` 的页面
2. 识别使用 `useInlineEdit.ts` 的组件
3. 评估 `store-factory.ts` 推广成本

### Phase 4: 营销文件归档
```bash
# 如果不做官网，移入 archive
mkdir -p archive/landing
git mv components/landing/* archive/landing/
```

---

## 五、执行进度

| Phase | 文件数 | 状态 | 提交 |
|-------|--------|------|------|
| Phase 1: 安全删除 | 9 个 | ✅ 已完成 | c7d046e |
| Phase 2A: 确认后删除 | 10 个 | ✅ 已完成 | - |
| Phase 2B: 决策后处理 | 2 个 | ✅ 已完成 | - |
| Phase 3: 推广使用 | 3 个 | 📋 评估中 | - |
| **剩余未使用文件** | **3 个** | - | - |

**总计已删除：21 个文件**

## 六、预期收益

| 指标 | 现状 | 目标 |
|------|------|------|
| 未使用文件 | 24 → 15 个 | 0-5 个 |
| 代码行数 | ~44,000 | ~40,000 (-11%) |
| 架构清晰度 | 中等 | 高 |
