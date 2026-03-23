# TeamClaw 文档中心

> 最后更新: 2026-03-23 | 版本: v1.0.1

## 目录结构

```
docs/
├── README.md              ← 你在这里
├── product/               ← 产品文档（用户指南、宣传）
├── technical/             ← 技术设计文档
├── process/               ← 需求、变更日志、技术债务
├── optimization/          ← 架构优化与能力 Review
├── openclaw/              ← OpenClaw 协作规范
├── landing/               ← 落地页内容与模板
├── templates/             ← SOP/渲染模板
├── testing/               ← 测试指南
├── tech-debt/             ← 技术债务跟踪
├── screenshots/           ← 产品截图 (PNG)
└── archive/               ← 归档文档（仅供参考）
```

---

## 核心文档（内置到数据库）

以下 3 个文档通过 `scripts/db/init-db.ts` 内置到项目初始化数据库中，**修改后需执行 `npm run init-db` 更新**：

| 文档 | 路径 | 数据库 ID | 说明 |
|------|------|-----------|------|
| 用户使用手册 | [`product/USER_GUIDE.md`](product/USER_GUIDE.md) | `VrihWxkCoM9Q` | 面向用户的完整产品说明 |
| 开发者手册 | [`technical/DEVELOPMENT.md`](technical/DEVELOPMENT.md) | `JzbpWix9BUnf` | 面向开发者的技术指南 |
| API 文档 | [`technical/API.md`](technical/API.md) | `FtmyZ2zMsm1c` | 所有 REST API 接口文档 |

---

## product/ — 产品文档

| 文件 | 说明 |
|------|------|
| [`USER_GUIDE.md`](product/USER_GUIDE.md) | **[内置]** 产品使用手册 |
| [`PROMOTION.md`](product/PROMOTION.md) | 产品宣传文案 |

## technical/ — 技术设计

| 文件 | 说明 |
|------|------|
| [`DEVELOPMENT.md`](technical/DEVELOPMENT.md) | **[内置]** 开发者指南（架构/项目结构/Gateway/MCP） |
| [`API.md`](technical/API.md) | **[内置]** REST API 接口文档 |
| [`SKILL_DESIGN.md`](technical/SKILL_DESIGN.md) | Skill 结构规范与开发指南 |
| [`APPROVAL_SYSTEM_DESIGN.md`](technical/APPROVAL_SYSTEM_DESIGN.md) | 通用审批系统设计 |
| [`MULTI_USER_ACCESS_CONTROL.md`](technical/MULTI_USER_ACCESS_CONTROL.md) | 多用户数据权限设计 |
| [`OPENCLAW_SYNC_DESIGN.md`](technical/OPENCLAW_SYNC_DESIGN.md) | OpenClaw 文件同步功能设计 |
| [`PROGRESSIVE_CONTEXT_DESIGN.md`](technical/PROGRESSIVE_CONTEXT_DESIGN.md) | Agent 渐进式上下文设计 |
| [`TEAMCLAW_SKILLHUB_DESIGN.md`](technical/TEAMCLAW_SKILLHUB_DESIGN.md) | SkillHub 注册中心设计 |
| [`TEMPLATE_GUIDE.md`](technical/TEMPLATE_GUIDE.md) | 渲染模板制作规范 |
| [`ARCHITECTURE_OPTIMIZATION.md`](technical/ARCHITECTURE_OPTIMIZATION.md) | 架构优化建议（综合版） |

## process/ — 需求与流程

| 文件 | 说明 |
|------|------|
| [`REQUIREMENTS.md`](process/REQUIREMENTS.md) | 需求文档（REQ-001 ~ REQ-022+） |
| [`TECH_DEBT.md`](process/TECH_DEBT.md) | 技术债务跟踪（TD-001 ~ TD-014+） |
| [`CHANGELOG.md`](process/CHANGELOG.md) | 版本变更日志 |
| [`REQ-020-chat-channel-high-concurrency.md`](process/REQ-020-chat-channel-high-concurrency.md) | 聊天高并发需求详情 |
| [`OPTIMIZATION_REPORT_2026-03-19.md`](process/OPTIMIZATION_REPORT_2026-03-19.md) | 最新优化报告 |
| [`clawhub-security-appeal.md`](process/clawhub-security-appeal.md) | ClawHub 安全审查申诉 |

## optimization/ — 架构优化

| 文件 | 说明 |
|------|------|
| [`ATOMIC_CAPABILITY_REVIEW_v1.0.0.md`](optimization/ATOMIC_CAPABILITY_REVIEW_v1.0.0.md) | 全栈原子化能力 Review |
| [`INTERACTION_REVIEW_v1.0.0.md`](optimization/INTERACTION_REVIEW_v1.0.0.md) | 业务流程与 Agent 交互点 Review |

## openclaw/ — OpenClaw 协作

| 文件 | 说明 |
|------|------|
| [`CLAUDE.md`](openclaw/CLAUDE.md) | Agent 端协作规范（精简版） |
| [`WORKSPACE_STANDARD.md`](openclaw/WORKSPACE_STANDARD.md) | 开发者协作规范（完整版） |

## landing/ — 落地页

| 文件 | 说明 |
|------|------|
| `landing-en.md` | 英文落地页内容 |
| `landing-zh.md` | 中文落地页内容 |
| `landingpage-template.md` | 落地页 HTML/CSS 模板 |

## templates/ — 模板

| 文件 | 说明 |
|------|------|
| `tech-research-sop.md` | 技术调研 SOP 模板 |
| `tech-sharing-card.md` | 技术分享卡片渲染模板 |

## testing/ — 测试

| 文件 | 说明 |
|------|------|
| [`chat-test-guide.md`](testing/chat-test-guide.md) | Chat 流式响应测试指南 |
| [`mock-gateway.md`](testing/mock-gateway.md) | Mock Gateway 本地测试指南 |

## tech-debt/ — 技术债务

| 文件 | 说明 |
|------|------|
| [`DEPRECATED_TOOLS.md`](tech-debt/DEPRECATED_TOOLS.md) | 废弃 MCP 工具移除计划 |
| [`UNUSED_COMPONENTS.md`](tech-debt/UNUSED_COMPONENTS.md) | 可复用组件清单 |

## archive/ — 归档

历史文档，仅作参考。包含 V2 PRD、旧优化报告、审计报告等。
