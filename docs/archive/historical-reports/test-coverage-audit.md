# 🧪 TeamClaw 测试覆盖审计报告

> 生成时间：2026-03-13T05:29:58.709Z

## 📊 总览

| 指标 | 数值 |
|------|------|
| 模块总数 | 256 |
| 有测试覆盖 | 137 |
| 覆盖率 | **54%** |
| 未覆盖 | 119 |

### 按模块类型

| 类型 | 总数 | 已覆盖 | 覆盖率 | 状态 |
|------|------|--------|--------|------|
| api | 111 | 67 | 60% | ⚠️ |
| store | 29 | 19 | 66% | ⚠️ |
| lib | 79 | 31 | 39% | 🟡 |
| hook | 17 | 0 | 0% | ❌ |
| mcp | 20 | 20 | 100% | ✅ |

### 按优先级

| 优先级 | 总数 | 已覆盖 | 覆盖率 | 状态 |
|--------|------|--------|--------|------|
| P0 | 20 | 14 | 70% | ⚠️ |
| P1 | 41 | 29 | 71% | ⚠️ |
| P2 | 65 | 35 | 54% | ⚠️ |
| P3 | 130 | 59 | 45% | 🟡 |

## 🚨 发现的问题

### 🔴 CRITICAL (1)

#### P0_NO_TEST
6 个 P0 核心模块完全没有测试覆盖

- `store/milestone.store.ts`
- `lib/login-rate-limit.ts`
- `lib/openclaw/task-list-generator.ts`
- `lib/project-access.ts`
- `lib/sync/milestone-sync.ts`
- `lib/sync/task-sync.ts`

### 🟠 HIGH (2)

#### P1_NO_INTEGRATION
15 个 P1 重要模块缺少集成/E2E 测试

- `app/api/blog/[id]/route.ts`
- `app/api/blog/route.ts`
- `app/api/chat-context/route.ts`
- `app/api/chat-mcp/route.ts`
- `app/api/sop-stats/route.ts`
- `store/render-template.store.ts`
- `store/sop-template.store.ts`
- `lib/skill-access.ts`
- `lib/skill-discovery.ts`
- `lib/skill-generator.ts`
- `lib/skill-snapshot-scheduler.ts`
- `lib/skill-validator.ts`
- `lib/sop-config.ts`
- `lib/sync/delivery-sync.ts`
- `lib/template-engine.ts`

#### API_NO_TEST
44 个 API 路由完全没有测试覆盖

- `app/api/approval-requests/[id]/route.ts`
- `app/api/approval-requests/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/blog/[id]/route.ts`
- `app/api/blog/route.ts`
- `app/api/chat-context/route.ts`
- `app/api/chat-mcp/route.ts`
- `app/api/chat-messages/[id]/route.ts`
- `app/api/chat-messages/route.ts`
- `app/api/chat-sessions/[id]/route.ts`
- `app/api/chat-sessions/route.ts`
- `app/api/comments/[id]/route.ts`
- `app/api/comments/route.ts`
- `app/api/context-request/route.ts`
- `app/api/debug/route.ts`
- ... 还有 29 个

### 🟡 MEDIUM (3)

#### STORE_NO_TEST
10 个 Store 模块没有测试覆盖

- `store/comment.store.ts`
- `store/gateway/config.slice.ts`
- `store/gateway/connection.slice.ts`
- `store/gateway/cron.slice.ts`
- `store/milestone.store.ts`
- `store/openclaw-workspace.store.ts`
- `store/openclaw.store.ts`
- `store/tasklog.store.ts`
- `store/ui.store.ts`
- `store/user-mcp-token.store.ts`

#### FRAMEWORK_MIXED
tests/e2e/ 目录混合了 Playwright (.spec.ts) 和 Vitest (.test.ts) 测试

- `tests/e2e/approval.test.ts`
- `tests/e2e/skillhub.test.ts`

#### TEST_MISPLACED
1 个测试脚本放在 scripts/ 而不是 tests/

- `scripts/test-skillhub-api.ts`

### 🔵 LOW (2)

#### DUPLICATE_SCRIPT
发现 1 组重复脚本

- `scripts/import-wiki-docs.js`
- `scripts/import-wiki-docs.ts`

#### SCRIPT_NOT_DOCUMENTED
13 个脚本未记录到 scripts/README.md

- `scripts/audit-test-coverage.ts`
- `scripts/check-i18n.ts`
- `scripts/fix-imports.js`
- `scripts/generate-architecture-docs-v2.ts`
- `scripts/generate-demo-data.ts`
- `scripts/generate-screenshots.ts`
- `scripts/import-wiki-docs.js`
- `scripts/reset-admin-password.ts`
- `scripts/run-screenshots.ts`
- `scripts/seed-templates.ts`
- `scripts/test-skillhub-api.ts`
- `scripts/update-init-db.ts`
- `scripts/update-landing-screenshots.ts`

## 📋 缺失测试的模块清单

### project (P0)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `store/milestone.store.ts` | store | 单元测试, E2E |
| `lib/project-access.ts` | lib | 单元测试, E2E |
| `lib/sync/milestone-sync.ts` | lib | 单元测试, E2E |

### auth (P0)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `lib/login-rate-limit.ts` | lib | 单元测试, E2E |

### task (P0)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `lib/openclaw/task-list-generator.ts` | lib | 单元测试, E2E |
| `lib/sync/task-sync.ts` | lib | 单元测试, E2E |

### document (P1)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/blog/[id]/route.ts` | api | 集成测试, E2E |
| `app/api/blog/route.ts` | api | 集成测试, E2E |

### chat (P1)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/chat-context/route.ts` | api | 集成测试, E2E |
| `app/api/chat-mcp/route.ts` | api | 集成测试, E2E |

### sop (P1)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/sop-stats/route.ts` | api | 集成测试, E2E |
| `lib/sop-config.ts` | lib | 单元测试, E2E |

### skill (P1)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `lib/skill-access.ts` | lib | 单元测试, E2E |
| `lib/skill-discovery.ts` | lib | 单元测试, E2E |
| `lib/skill-generator.ts` | lib | 单元测试, E2E |
| `lib/skill-snapshot-scheduler.ts` | lib | 单元测试, E2E |
| `lib/skill-validator.ts` | lib | 单元测试, E2E |

### delivery (P1)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `lib/sync/delivery-sync.ts` | lib | 单元测试, E2E |

### system (P2)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/context-request/route.ts` | api | 集成测试 |
| `app/api/debug/route.ts` | api | 集成测试 |
| `app/api/health/route.ts` | api | 集成测试 |
| `app/api/init/route.ts` | api | 集成测试 |
| `app/api/landing/route.ts` | api | 集成测试 |
| `app/api/upload/route.ts` | api | 集成测试 |
| `lib/sse-events.ts` | lib | 单元测试 |

### openclaw (P2)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/openclaw-status/check-stale/route.ts` | api | 集成测试 |
| `app/api/openclaw-status/route.ts` | api | 集成测试 |
| `store/openclaw-workspace.store.ts` | store | 单元测试 |
| `store/openclaw.store.ts` | store | 单元测试 |
| `lib/openclaw/auto-sync-scheduler.ts` | lib | 单元测试 |
| `lib/openclaw/claude-md-generator.ts` | lib | 单元测试 |
| `lib/openclaw/config.ts` | lib | 单元测试 |
| `lib/openclaw/index-manager.ts` | lib | 单元测试 |
| `lib/openclaw/sync-manager.ts` | lib | 单元测试 |
| `lib/openclaw/watcher.ts` | lib | 单元测试 |
| `lib/providers/openclaw-provider.ts` | lib | 单元测试 |

### gateway (P2)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `store/gateway/config.slice.ts` | store | 单元测试 |
| `store/gateway/connection.slice.ts` | store | 单元测试 |
| `store/gateway/cron.slice.ts` | store | 单元测试 |
| `lib/agent-token.ts` | lib | 单元测试 |
| `lib/gateway-client.ts` | lib | 单元测试 |
| `lib/gateway-config-db.ts` | lib | 单元测试 |
| `lib/gateway-logger.ts` | lib | 单元测试 |
| `lib/gateway-provider.ts` | lib | 单元测试 |
| `lib/gateway-proxy.ts` | lib | 单元测试 |
| `lib/gateway-types.ts` | lib | 单元测试 |
| `lib/sync/schedule-sync.ts` | lib | 单元测试 |

### mcp (P2)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `store/user-mcp-token.store.ts` | store | 单元测试 |

### other (P3)

| 模块 | 类型 | 需要的测试 |
|------|------|-----------|
| `app/api/approval-requests/[id]/route.ts` | api | 集成测试 |
| `app/api/approval-requests/route.ts` | api | 集成测试 |
| `app/api/audit-logs/route.ts` | api | 集成测试 |
| `app/api/chat-messages/[id]/route.ts` | api | 集成测试 |
| `app/api/chat-messages/route.ts` | api | 集成测试 |
| `app/api/chat-sessions/[id]/route.ts` | api | 集成测试 |
| `app/api/chat-sessions/route.ts` | api | 集成测试 |
| `app/api/comments/[id]/route.ts` | api | 集成测试 |
| `app/api/comments/route.ts` | api | 集成测试 |
| `app/api/milestones/[id]/route.ts` | api | 集成测试 |
| `app/api/milestones/route.ts` | api | 集成测试 |
| `app/api/openclaw-conflicts/[id]/resolve/route.ts` | api | 集成测试 |
| `app/api/openclaw-conflicts/route.ts` | api | 集成测试 |
| `app/api/openclaw-files/[id]/pull/route.ts` | api | 集成测试 |
| `app/api/openclaw-files/[id]/rollback/route.ts` | api | 集成测试 |
| `app/api/openclaw-files/[id]/route.ts` | api | 集成测试 |
| `app/api/openclaw-files/[id]/versions/route.ts` | api | 集成测试 |
| `app/api/openclaw-files/route.ts` | api | 集成测试 |
| `app/api/openclaw-workspaces/[id]/route.ts` | api | 集成测试 |
| `app/api/openclaw-workspaces/[id]/scan/route.ts` | api | 集成测试 |
| `app/api/openclaw-workspaces/[id]/sync/route.ts` | api | 集成测试 |
| `app/api/openclaw-workspaces/route.ts` | api | 集成测试 |
| `app/api/scheduled-task-history/[id]/route.ts` | api | 集成测试 |
| `app/api/scheduled-task-history/route.ts` | api | 集成测试 |
| `app/api/scheduled-tasks/[id]/route.ts` | api | 集成测试 |
| `app/api/scheduled-tasks/route.ts` | api | 集成测试 |
| `app/api/skill-snapshots/capture/route.ts` | api | 集成测试 |
| `app/api/skillhub-settings/route.ts` | api | 集成测试 |
| `app/api/task-logs/route.ts` | api | 集成测试 |
| `app/api/user-mcp-tokens/[id]/route.ts` | api | 集成测试 |
| `app/api/user-mcp-tokens/route.ts` | api | 集成测试 |
| `store/comment.store.ts` | store | 单元测试 |
| `store/tasklog.store.ts` | store | 单元测试 |
| `store/ui.store.ts` | store | 单元测试 |
| `lib/api-auth.ts` | lib | 单元测试 |
| `lib/api-error-handler.ts` | lib | 单元测试 |
| `lib/api-route-factory.ts` | lib | 单元测试 |
| `lib/api-utils.ts` | lib | 单元测试 |
| `lib/audit-log.ts` | lib | 单元测试 |
| `lib/data-refresh.ts` | lib | 单元测试 |
| `lib/env-validator.ts` | lib | 单元测试 |
| `lib/icon-render.ts` | lib | 单元测试 |
| `lib/knowhow-parser.ts` | lib | 单元测试 |
| `lib/log-helper.ts` | lib | 单元测试 |
| `lib/markdown-sync.ts` | lib | 单元测试 |
| `lib/rpc-methods.ts` | lib | 单元测试 |
| `lib/server-gateway-client.ts` | lib | 单元测试 |
| `lib/slot-sync.ts` | lib | 单元测试 |
| `lib/store-events.ts` | lib | 单元测试 |
| `lib/store-factory.ts` | lib | 单元测试 |
| `lib/sync/shared.ts` | lib | 单元测试 |
| `lib/version-utils.ts` | lib | 单元测试 |
| `lib/version.ts` | lib | 单元测试 |
| `lib/with-auth.ts` | lib | 单元测试 |
| `hooks/useAutoScroll.ts` | hook | 单元测试 |
| `hooks/useChatStream.ts` | hook | 单元测试 |
| `hooks/useClickOutside.ts` | hook | 单元测试 |
| `hooks/useConfirmAction.ts` | hook | 单元测试 |
| `hooks/useDataInitializer.ts` | hook | 单元测试 |
| `hooks/useEntityData.ts` | hook | 单元测试 |
| `hooks/useEscapeKey.ts` | hook | 单元测试 |
| `hooks/useFilteredList.ts` | hook | 单元测试 |
| `hooks/useGatewayData.ts` | hook | 单元测试 |
| `hooks/useGatewaySync.ts` | hook | 单元测试 |
| `hooks/useInlineEdit.ts` | hook | 单元测试 |
| `hooks/useRelativeTime.ts` | hook | 单元测试 |
| `hooks/useSSEConnection.ts` | hook | 单元测试 |
| `hooks/useSecurityCode.ts` | hook | 单元测试 |
| `hooks/useSlotSync.ts` | hook | 单元测试 |
| `hooks/useStaleStatusCheck.ts` | hook | 单元测试 |
| `hooks/useTaskSOP.ts` | hook | 单元测试 |

## 🔧 脚本审计

脚本总数：20

### 分类统计

| 分类 | 数量 | 脚本 |
|------|------|------|
| deployment | 2 | `deploy.sh`, `restart-dev.sh` |
| database | 7 | `add-indexes.ts`, `import-wiki-docs.js`, `import-wiki-docs.ts`, `init-db.ts`, `reset-admin-password.ts`, `seed-templates.ts`, `update-init-db.ts` |
| testing | 1 | `test-skillhub-api.ts` |
| generation | 5 | `generate-architecture-docs-v2.ts`, `generate-demo-data.ts`, `generate-screenshots.ts`, `run-screenshots.ts`, `update-landing-screenshots.ts` |
| utility | 4 | `audit-test-coverage.ts`, `diagnose.ts`, `fix-imports.js`, `sync-landing.ts` |
| i18n | 1 | `check-i18n.ts` |

### ⚠️ 重复脚本

- `scripts/import-wiki-docs.js` ↔ `scripts/import-wiki-docs.ts`

### ⚠️ 未记录到 README 的脚本

- `scripts/audit-test-coverage.ts`
- `scripts/check-i18n.ts`
- `scripts/fix-imports.js`
- `scripts/generate-architecture-docs-v2.ts`
- `scripts/generate-demo-data.ts`
- `scripts/generate-screenshots.ts`
- `scripts/import-wiki-docs.js`
- `scripts/reset-admin-password.ts`
- `scripts/run-screenshots.ts`
- `scripts/seed-templates.ts`
- `scripts/test-skillhub-api.ts`
- `scripts/update-init-db.ts`
- `scripts/update-landing-screenshots.ts`

## 🎯 建议行动计划

### Phase 1：补齐 P0 核心模块测试（1-2 周）

- [ ] store/milestone.store.ts (store)
- [ ] lib/login-rate-limit.ts (lib)
- [ ] lib/openclaw/task-list-generator.ts (lib)
- [ ] lib/project-access.ts (lib)
- [ ] lib/sync/milestone-sync.ts (lib)
- [ ] lib/sync/task-sync.ts (lib)

### Phase 2：补齐 P1 重要模块测试（2-3 周）

- [ ] app/api/blog/[id]/route.ts (api)
- [ ] app/api/blog/route.ts (api)
- [ ] app/api/chat-context/route.ts (api)
- [ ] app/api/chat-mcp/route.ts (api)
- [ ] app/api/sop-stats/route.ts (api)
- [ ] lib/skill-access.ts (lib)
- [ ] lib/skill-discovery.ts (lib)
- [ ] lib/skill-generator.ts (lib)
- [ ] lib/skill-snapshot-scheduler.ts (lib)
- [ ] lib/skill-validator.ts (lib)
- [ ] lib/sop-config.ts (lib)
- [ ] lib/sync/delivery-sync.ts (lib)

### Phase 3：规范化整理（1 周）

- [ ] 将 `tests/e2e/*.test.ts` (Vitest) 迁移到 `tests/integration/` 或转为 `.spec.ts` (Playwright)
- [ ] 将 `scripts/test-skillhub-api.ts` 迁移到 `tests/integration/`
- [ ] 合并 `scripts/import-wiki-docs.js` 和 `scripts/import-wiki-docs.ts`，保留 TS 版
- [ ] 更新 `tests/README.md` 和 `scripts/README.md` 使其与实际文件同步

### Phase 4：P2/P3 模块逐步覆盖（持续）

按需在功能变更时补充测试，目标 80% 覆盖率。
