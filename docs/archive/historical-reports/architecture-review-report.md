# TeamClaw 架构 Review 报告

> 生成时间: 2026-03-13
> 工具: Knip + Dependency Cruiser

---

## 执行摘要

| 指标 | 结果 | 严重程度 | 状态 |
|-----|------|---------|------|
| 未使用文件 | 28 个 | 🟡 Medium | ✅ 已清理 6 个 |
| 未使用依赖 | 1 个 | 🟢 Low | ✅ 已移除 uuid |
| 未列出依赖 | 4 个 | 🟡 Medium | ✅ 已安装 nanoid, unified |
| 循环依赖 | 3 处 | 🔴 High | ✅ 已通过动态导入修复 |
| 架构违规 | 9 处 | 🟡 Medium | ℹ️ 已记录为 info 级别 |
| 孤立文件 | 5 个 | 🟡 Medium | ℹ️ 待后续处理 |

---

## 1. 循环依赖 (已修复 ✅)

所有循环依赖已通过动态导入修复。

### 修复详情

| 问题 | 修复方案 | 状态 |
|-----|---------|------|
| gateway-provider ↔ openclaw-provider | 提取类型到 `gateway-provider-types.ts`，使用动态导入 | ✅ 已修复 |
| gateway-config-db ↔ server-gateway-client | 将 `ConnectionStatus` 类型移到 `gateway-types.ts` | ✅ 已修复 |
| MCP Handler 循环 | 使用动态导入 (`await import()`) 延迟加载依赖 | ✅ 已修复 |

---

## 2. 未使用文件 (28 个)

以下文件未被任何模块引用，可能是遗留代码：

### 组件 (8)
| 文件 | 建议 |
|-----|------|
| `components/EmptyState.tsx` | 保留备用或删除 |
| `components/landing/Features.tsx` | Landing 页面组件，检查是否在用 |
| `components/landing/Footer.tsx` | Landing 页面组件 |
| `components/landing/Hero.tsx` | Landing 页面组件 |
| `components/landing/ModelLogos.tsx` | 🔴 孤立文件 |
| `components/projects/ProjectMemberDialog.tsx` | 检查是否被使用 |
| `components/studio/index.ts` | 检查导出 |
| `components/SystemDiagnostics.tsx` | 系统诊断组件 |

### Core (2)
| 文件 | 建议 |
|-----|------|
| `core/mcp/executor.ts` | MCP 核心功能，检查是否被使用 |
| `core/mcp/handlers/skill.ts` | Skill handler |

### DB (4)
| 文件 | 建议 |
|-----|------|
| `db/adapters/index.ts` | 数据库适配器 |
| `db/adapters/postgres.ts` | Postgres 适配器 |
| `db/adapters/sqlite.ts` | SQLite 适配器 |
| `db/config.ts` | 数据库配置 |

### Hooks (5)
| 文件 | 建议 |
|-----|------|
| `hooks/useEntityData.ts` | 实体数据 hook |
| `hooks/useFilteredList.ts` | 列表过滤 hook |
| `hooks/useGatewayData.ts` | Gateway 数据 hook |
| `hooks/useInlineEdit.ts` | 内联编辑 hook |
| `hooks/useSlotSync.ts` | Slot 同步 hook |

### Lib (10)
| 文件 | 建议 |
|-----|------|
| `lib/api-error-handler.ts` | 错误处理 |
| `lib/data-refresh.ts` | 数据刷新 |
| `lib/gateway-provider.ts` | 🔴 参与循环依赖 |
| `lib/i18n/index.ts` | i18n 模块 |
| `lib/log-helper.ts` | 日志辅助 |
| `lib/openclaw/index.ts` | OpenClaw 模块 |
| `lib/providers/openclaw-provider.ts` | 🔴 参与循环依赖 |
| `lib/skill-access.ts` | Skill 访问控制 |
| `lib/store-factory.ts` | Store 工厂 |
| `lib/login-rate-limit.ts` | 🟡 已测试但未使用 |

---

## 3. 依赖问题 (已修复 ✅)

### 未使用依赖
| 依赖 | 位置 | 建议 | 状态 |
|-----|------|------|------|
| `uuid` | package.json | ~~删除或使用 `crypto.randomUUID()`~~ | ✅ 已移除 |

### 未列出依赖 (已添加到 package.json)
| 依赖 | 使用位置 | 建议 | 状态 |
|-----|---------|------|------|
| `nanoid` | `app/api/skills/install/route.ts` | `npm i nanoid` | ✅ 已安装 |
| `unified` | `components/markdown-editor/MarkdownContent.tsx` | `npm i unified` | ✅ 已安装 |
| `@eslint/js` | `eslint.config.mjs` | 已在 devDependencies | ℹ️ 无需操作 |
| `playwright` | `scripts/run-screenshots.ts` | 已安装 | ℹ️ 无需操作 |

### 未解析导入
| 导入 | 文件 | 建议 |
|-----|------|------|
| `../db/builtin-templates` | `scripts/init-db.ts` | 检查文件是否存在 |
| `../helpers/db` | `tests/integration/api-health.test.ts` | 已修复路径 |

---

## 4. 架构违规

### 组件层访问模式 (INFO)
以下组件直接访问了 lib 内部模块，建议通过统一入口访问：

| 组件 | 访问的 lib | 建议 |
|-----|-----------|------|
| `components/studio/HtmlPreview.tsx` | `lib/slot-sync.ts`, `lib/icon-render.ts` | 通过 index 导出 |
| `components/studio/ExportModal.tsx` | `lib/slot-sync.ts` | 通过 index 导出 |
| `components/sop/SOPProgressBar.tsx` | `lib/sop-config.ts` | 通过 index 导出 |
| `components/markdown-editor/*` | `lib/slot-sync.ts`, `lib/icon-render.ts` | 通过 index 导出 |
| `components/DataProvider.tsx` | `lib/sse-events.ts`, `lib/logger.ts` | 通过 index 导出 |
| `components/agents/*` | `lib/tool-policy.ts`, `lib/gateway-client.ts` | 通过 index 导出 |

---

## 5. 孤立文件 (部分已清理 ✅)

这些文件没有被任何其他文件引用：

| 文件 | 建议 | 状态 |
|-----|------|------|
| `lib/login-rate-limit.ts` | 已添加测试，检查是否使用 | ℹ️ 保留 |
| `lib/env-validator.ts` | 环境验证工具 | ℹ️ 保留 |
| `lib/api-errors.ts` | API 错误定义 | ℹ️ 保留 |
| ~~`components/landing/ModelLogos.tsx`~~ | ~~Landing 组件~~ | ✅ 已删除 |
| `app/loading.tsx` | Next.js loading 页面 | ℹ️ 保留 |

### 已删除的未使用文件 (6个)
- `lib/log-helper.ts`
- `lib/data-refresh.ts`
- `lib/api-error-handler.ts`
- `components/EmptyState.tsx`
- `components/SystemDiagnostics.tsx`
- `components/landing/ModelLogos.tsx`

---

## 6. 未使用导出 (317 个)

部分统计：
- `components/chat/index.ts`: `ChatPanel` 等
- `components/markdown-editor/index.ts`: `MarkdownEditor`, `MarkdownContent` 等
- `components/ui/index.ts`: `Spinner`, `Loading`, `Table` 等
- `components/sop/index.ts`: `SOPTemplateEditor`

**建议**: 检查这些导出是否真的需要，或者是否存在 import 路径问题导致 Knip 误判。

---

## 7. 修复完成情况

### 🔴 P0: 立即修复 (已完成 ✅)
1. **循环依赖** - 已通过动态导入修复
2. **添加缺失依赖** - nanoid, unified 已安装
3. **移除未使用依赖** - uuid 已移除

### 🟡 P1: 本周修复 (已完成 ✅)
4. **清理未使用文件** - 已删除 6 个文件

### 🟢 P2: 后续优化
5. **统一组件访问模式** - 记录在案，后续改进
6. **解决未使用导出** - 317 个导出待审查

---

## 8. 工具集成建议

### 添加 npm scripts
```json
{
  "scripts": {
    "arch:check": "npm run arch:knip && npm run arch:cruise",
    "arch:knip": "knip --no-progress",
    "arch:cruise": "depcruise --validate .dependency-cruiser.cjs app lib store db components",
    "arch:graph": "depcruise app lib store db components --output-type dot | dot -T svg > docs/dependency-graph.svg"
  }
}
```

### CI 集成
建议在 CI 中添加架构检查步骤：
```yaml
- name: Architecture Check
  run: |
    npm run arch:cruise
    npm run arch:knip
```

---

## 9. dpdm 评估

**dpdm** 是专门的循环依赖检测工具。与 dependency-cruiser 对比：

| 特性 | dpdm | dependency-cruiser |
|-----|------|-------------------|
| 循环依赖检测 | ✅ 强 | ✅ 强 |
| 可视化 | ❌ 无 | ✅ 有 |
| 规则配置 | ❌ 弱 | ✅ 强 |
| CI 集成 | ✅ 简单 | ✅ 简单 |
| 性能 | ✅ 快 | 🟡 中等 |

**结论**: dependency-cruiser 已满足需求，dpdm 可作为补充但不必须。

---

## 10. Environment Variables 检查

推荐使用 `dotenv-linter` 检查 `.env` 文件：
```bash
npm install -D dotenv-linter
npx dotenv-linter
```

TeamClaw 目前环境变量管理良好，此工具优先级较低。

---

## 总结

### 修复完成情况
| 类别 | 问题数 | 已修复 | 状态 |
|-----|-------|-------|------|
| 循环依赖 | 3 | 3 | ✅ 全部修复 |
| 未使用依赖 | 1 | 1 | ✅ 全部修复 |
| 未列出依赖 | 4 | 2 | ✅ 关键依赖已安装 |
| 未使用文件 | 28 | 6 | ✅ 高危文件已清理 |

### 工具价值评估
- **Knip**: ⭐⭐⭐⭐⭐ - 非常有价值，发现大量未使用代码
- **dependency-cruiser**: ⭐⭐⭐⭐⭐ - 发现循环依赖和架构违规
- **dpdm**: ⭐⭐⭐ - 功能被 dependency-cruiser 覆盖
- **dotenv-linter**: ⭐⭐ - 当前项目需求不高

### 下一步行动
1. ✅ 修复 3 处循环依赖 (使用动态导入)
2. ✅ 安装缺失依赖 (nanoid, unified)
3. ✅ 移除 uuid 依赖
4. ✅ 清理确认无用的文件 (6个)
5. [ ] 在 CI 中添加架构检查
6. [ ] 审查 317 个未使用导出
7. [ ] 处理 4 个孤立文件
