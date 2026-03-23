# TeamClaw 测试框架 v1.0.1

## 框架选型

| 框架 | 用途 | 配置文件 |
|------|------|----------|
| **Vitest** | 单元测试、集成测试（API 级别） | `vitest.config.ts` |
| **Playwright** | E2E 浏览器测试、安全测试、压力测试 | `playwright.config.ts` |

**判定规则**：
- 纯函数 / mock 隔离 → `unit/` + Vitest
- HTTP 调用真实 API / 操作 DB → `integration/` + Vitest
- 真实浏览器交互 → `e2e/` + Playwright (`.spec.ts`)

---

## 目录结构

```
tests/
├── unit/                              # 单元测试 (Vitest)
│   ├── validators.test.ts             # 输入校验器
│   ├── security.test.ts               # 安全工具（escapeHtml, sanitize）
│   ├── utils.test.ts                  # 数据脱敏、工具策略
│   ├── event-bus.test.ts              # SSE EventBus
│   ├── data-service.test.ts           # 数据访问层 apiRequest
│   ├── rate-limit.test.ts             # API 限流
│   ├── template-engine.test.ts        # 模板引擎 renderTemplate
│   ├── api-errors.test.ts             # API 错误常量
│   ├── id.test.ts                     # Base58 ID 生成器
│   ├── doc-templates-and-mcp.test.ts  # 文档模板 + MCP 定义
│   ├── agent-mcp-token.test.ts        # Agent MCP Token
│   ├── chat-channel.test.ts           # 对话信道解析器/验证/日志
│   └── chat-channel-high-concurrency.test.ts  # 高并发架构 mock 测试
│
├── integration/                       # 集成测试 (Vitest)
│   ├── auth-permission.test.ts        # 认证权限（多用户角色）
│   ├── task-api.test.ts               # 任务 CRUD + 状态流转
│   ├── project-api.test.ts            # 项目 CRUD + 成员管理
│   ├── document-api.test.ts            # 文档 CRUD + Wiki
│   ├── sop-flow.test.ts               # SOP 模板 + 阶段推进
│   ├── sop-skill-package.test.ts      # SOP Skill 安装包
│   ├── skill-api-permission.test.ts   # Skill 权限混合模式
│   ├── skillhub-api.test.ts           # SkillHub 注册/状态/信任
│   ├── approval-api.test.ts            # 审批系统 CRUD + 权限
│   ├── render-template-import-export.test.ts  # 渲染模板导入导出
│   ├── sop-template-import-export.test.ts     # SOP 模板导入导出
│   ├── chat-stream.test.ts             # 聊天流式响应集成测试
│   ├── task-push.test.ts              # 任务推送流程测试
│   ├── service.test.ts                # 服务连接测试
│   └── sse-receive.test.ts            # SSE 接收测试
│
├── e2e/                               # E2E 浏览器测试 (Playwright)
│   ├── pages/                         # Page Object 模式封装
│   │   ├── AuthHelper.ts
│   │   ├── BasePage.ts
│   │   ├── TasksPage.ts, ProjectsPage.ts, WikiPage.ts, ...
│   │   └── SkillHubPage.ts
│   ├── auth.spec.ts                   # 认证流程
│   ├── tasks.spec.ts                  # 任务管理
│   ├── teamclaw-e2e.spec.ts          # 完整 E2E 流程测试
│   ├── e2e-flow.spec.ts              # E2E 流程验证
│   ├── projects.spec.ts               # 项目管理
│   ├── wiki.spec.ts                   # Wiki 文档
│   ├── members.spec.ts                # 成员管理
│   ├── navigation.spec.ts             # 导航布局
│   ├── dashboard.spec.ts              # 仪表盘
│   ├── settings.spec.ts               # 设置页面
│   ├── agents.spec.ts                 # Agent 管理
│   ├── sessions.spec.ts               # Session 管理
│   ├── skills.spec.ts                 # Skill 管理
│   ├── sop.spec.ts                    # SOP 模板
│   ├── schedule.spec.ts               # 定时任务
│   ├── deliveries.spec.ts             # 投递管理
│   ├── skillhub.spec.ts               # SkillHub 页面
│   ├── task-lifecycle.spec.ts         # 任务生命周期（跨页面）
│   ├── document-workflow.spec.ts      # 文档协作流程
│   ├── delivery-workflow.spec.ts      # 投递审核流程（多用户）
│   ├── project-collaboration.spec.ts  # 项目协作流程（多用户）
│   └── multi-user-permissions.spec.ts # 多用户权限
│
├── req/                               # 需求驱动的回归/验收测试 (Vitest)
│   ├── REQ-012/                       # 渐进式上下文
│   │   ├── README.md
│   │   ├── feature.test.ts
│   │   ├── upstream.test.ts
│   │   ├── downstream.test.ts
│   │   └── p1-p2-progressive.test.ts
│   ├── REQ-020/                       # 高并发架构
│   │   ├── README.md
│   │   ├── feature.test.ts
│   │   ├── upstream.test.ts
│   │   └── downstream.test.ts
│   └── ARCH-OPT-001/                  # 架构优化
│       ├── README.md
│       ├── file-validator.test.ts
│       ├── props-naming.test.ts
│       └── sql-validator.test.ts
│
├── security/                          # 安全测试 (Playwright)
│   └── security-test.spec.ts
│
├── stress/                            # 压力测试 (Playwright)
│   └── stress-test.spec.ts
│
├── performance/                       # 性能测试 (Vitest/Playwright)
│   └── full-automation.test.ts       # 全流程自动化性能测试
│
├── helpers/                           # 测试辅助工具（共享）
│   ├── api-client.ts                  # HTTP 客户端（本地/远程切换）
│   ├── api-helper.ts                  # E2E Playwright API 调用（Cookie 处理）
│   ├── auth-helper.ts                 # 认证辅助（注册/登录/Session）
│   ├── test-fixture.ts                # 测试数据工厂
│   ├── report-generator.ts            # 测试报告生成器
│   ├── test-reporter.ts               # R1/R2 基线对比
│   └── e2e-report-generator.ts        # E2E 报告生成（Playwright JSON → MD）
│
├── scripts/                           # 测试流程脚本
│   ├── run-all-tests.sh               # 标准测试流程编排
│   └── test-sse.sh                     # SSE 连接测试
│
├── __mocks__/                         # Mock 文件
│   └── server-only.ts                 # Mock server-only 模块
│
├── .auth/                             # Playwright 认证状态存储
├── screenshots/                       # E2E 截图输出
├── reports/                           # 测试报告目录
│   ├── e2e/                          # E2E 测试报告
│   ├── performance/                  # 性能测试报告
│   └── results/                      # 测试结果数据
```
```

---

## 测试命令

```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# E2E 测试（需要运行中的开发服务器）
npm run test:e2e

# 压力测试
npm run test:stress

# 安全测试
npm run test:security

# 需求回归测试
npx vitest run tests/req/

# 全部测试
bash tests/scripts/run-all-tests.sh all
```

---

## 架构检查命令

使用 Knip 和 dependency-cruiser 检测代码质量问题：

```bash
# 运行全部架构检查（Knip + dependency-cruiser）
npm run arch:check

# 仅运行 Knip - 检测未使用代码/依赖/导出
npm run arch:knip

# 仅运行 dependency-cruiser - 检测循环依赖和架构违规
npm run arch:cruise
```

**架构检查工具说明：**

| 工具 | 检测内容 | 配置文件 |
|------|---------|----------|
| **Knip** | 未使用文件、未列出依赖、未使用导出 | `knip.json` |
| **dependency-cruiser** | 循环依赖、禁止导入、架构层级违规 | `.dependency-cruiser.cjs` |

**建议执行时机：**
- 功能开发完成后，CI 集成前
- 定期代码审查（每周/每迭代）
- 重构前评估影响范围

---

## 测试覆盖矩阵

| 模块 | 单元测试 | 集成测试 | E2E 测试 | 压力测试 | 安全测试 |
|------|---------|---------|---------|---------|---------|
| 认证系统 | - | ✅ auth-permission | ✅ auth.spec | - | ✅ |
| 任务管理 | - | ✅ task-api | ✅ tasks.spec, task-lifecycle | ✅ | ✅ |
| 项目管理 | - | ✅ project-api | ✅ projects.spec, project-collaboration | - | ✅ |
| 文档管理 | ✅ doc-templates | ✅ document-api | ✅ wiki.spec, document-workflow | ✅ | - |
| 成员管理 | - | - | ✅ members.spec | - | ✅ |
| 聊天信道 | ✅ chat-channel, chat-channel-high-concurrency | - | - | ✅ | - |
| SOP 流程 | - | ✅ sop-flow, sop-skill-package | ✅ sop.spec | - | - |
| SkillHub | - | ✅ skillhub-api, skill-api-permission | ✅ skillhub.spec | - | - |
| 审批系统 | - | ✅ approval-api | - | - | - |
| 投递管理 | - | - | ✅ deliveries.spec, delivery-workflow | - | - |
| 权限控制 | - | ✅ auth-permission | ✅ multi-user-permissions | - | ✅ |
| 工具函数 | ✅ validators, security, utils, id, rate-limit, api-errors, template-engine | - | - | - | - |
| 模板导入导出 | - | ✅ render-template, sop-template | - | - | - |

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PLAYWRIGHT_TEST` | 标识测试环境，跳过限流 | `true` |
| `TEST_TARGET` | 测试目标 (`local` / `remote`) | `local` |
| `BASE_URL` | 测试基础 URL | `http://localhost:3000` |

## 注意事项

1. **Cookie 问题**: E2E 测试使用 `page.evaluate` + `fetch` 代替 `page.request` 确保 Cookie 携带
2. **限流**: 测试环境自动跳过限流（`PLAYWRIGHT_TEST=true`）
3. **并发**: E2E 测试限 2 并发，压力测试 4 并发
4. **超时**: E2E 测试 60s 超时，压力测试 120s 超时
5. **命名规范**: Playwright 用 `.spec.ts`，Vitest 用 `.test.ts`

---

*TeamClaw 测试框架 v4.0 — 更新日期 2026-03-13*
