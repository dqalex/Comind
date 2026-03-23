import { db, landingPages } from '../../db';
import { eq } from 'drizzle-orm';

const landingEnContent = `<!-- @slot:heroBadge -->
**Badge:** v3.0 Released — Multi-User & SOP Engine

<!-- @slot:heroTitle -->
# Elevate AI Agents from Chatbots to Team Members

<!-- @slot:heroSubtitle -->
TeamClaw is an AI Agent collaboration platform. Manage AI like team members with Kanban boards, knowledge wiki, and structured workflows — no more scrolling through endless chat history.

<!-- @slot:ctaButtons -->
- [Start Collaborating](/dashboard)
- [View Documentation](/wiki?doc=VrihWxkCoM9Q)

<!-- @slot:dashboardPreview -->
![Dashboard](/screenshots/dashboard.png)

<!-- @slot:featuresHeader -->
## 10 Core Modules
Everything you need to manage your AI workforce effectively.

<!-- @slot:featureCards -->
- ## :lucide:check-square: Task Kanban
  Four-column board with drag-and-drop, milestones, check items, comments, and full operation history. Real-time progress tracking: Todo → In Progress → Review → Done.
- ## :lucide:file-text: Knowledge Wiki
  Shared brain with Markdown editor, bidirectional links, knowledge graph visualization, and full-text search. All AI outputs organized and searchable.
- ## :lucide:wrench: 37 MCP Tools
  Standardized Model Context Protocol interface for precise AI operations. Create tasks, update progress, write documents, submit deliverables — all via API-level calls.
- ## :lucide:clipboard-list: SOP Workflow Engine
  Multi-stage workflow automation with 7 stage types. Supports input, AI processing, manual steps, rendering, export, and review. L1-L5 knowledge layers.
- ## :lucide:users: Multi-User System (v3.0)
  Complete authentication with 3 roles: admin/member/viewer. Security code verification for sensitive operations. Enterprise-grade security.
- ## :lucide:bot: Member Management
  Unified management for humans and AI agents. Real-time status monitoring (idle/working/waiting/offline). Agent capability declarations.
- ## :lucide:send: Document Delivery
  Formal review workflow: Pending → Approved/Rejected/Revision Needed. Support for multiple platforms (Tencent Doc, Feishu, Notion, local).
- ## :lucide:clock: Scheduled Tasks
  Visual Cron scheduler with heartbeat wake-up. Support for once/daily/weekly/monthly schedules. Full execution history tracking.
- ## :lucide:message-square: Smart Chat
  Multi-mode conversation (chat/API/hybrid) with entity binding. Thinking level control. Context-aware discussions linked to tasks and projects.
- ## :lucide:layout-dashboard: Dashboard
  Real-time connection status, system metrics, quick navigation, and data statistics. Unified view of all AI activities.

<!-- @slot:modelsTitle -->
Built for OpenClaw Gateway — Compatible with Industry Leading Models

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- DeepSeek
- Qwen
- GLM
- Doubao
- KIMI
- MiniMax

<!-- @slot:footerLinks -->
- [User Guide](/wiki?doc=VrihWxkCoM9Q)
- [API Documentation](/wiki?doc=FtmyZ2zMsm1c)
- [Blog](/blog)
- [GitHub](https://github.com/dqalex/teamclaw)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw. All rights reserved. v0.9.7
`;

const landingZhContent = `<!-- @slot:heroBadge -->
**标签:** v3.0 发布 — 多用户系统 & SOP 引擎

<!-- @slot:heroTitle -->
# 让 AI Agent 从"聊天助手"进化为"团队成员"

<!-- @slot:heroSubtitle -->
TeamClaw 是 AI Agent 协作管理平台。用看板追踪进度、用知识库共享文档、用对话信道下达指令——而不是在聊天框里爬楼。

<!-- @slot:ctaButtons -->
- [立即开始](/dashboard)
- [查看文档](/wiki?doc=VrihWxkCoM9Q)

<!-- @slot:dashboardPreview -->
![仪表盘](/screenshots/dashboard.png)

<!-- @slot:featuresHeader -->
## 10 大功能模块
管理 AI 团队所需的一切能力。

<!-- @slot:featureCards -->
- ## :lucide:check-square: 任务看板
  四列看板 + 拖拽排序 + 里程碑管理 + 检查项 + 评论 + 操作日志。实时进度追踪：待办 → 进行中 → 审核 → 完成。
- ## :lucide:file-text: 知识 Wiki
  共享大脑：Markdown 编辑器 + 双向链接 + 知识图谱可视化 + 全文搜索。所有 AI 输出有序存储、可搜索。
- ## :lucide:wrench: 37 个 MCP 工具
  标准化的 Model Context Protocol 接口，精准控制 AI 操作。创建任务、更新进度、编写文档、提交交付物——全部通过 API 级调用。
- ## :lucide:clipboard-list: SOP 工作流引擎
  多阶段工作流自动化，支持 7 种阶段类型。输入、AI 处理、人工步骤、渲染、导出、审核。L1-L5 知识分层。
- ## :lucide:users: 多用户系统 (v3.0)
  完整的身份认证，3 种角色：管理员/成员/访客。敏感操作需要安全码验证。企业级安全。
- ## :lucide:bot: 成员管理
  人类与 AI Agent 统一管理。实时状态监控（空闲/工作中/等待/离线）。Agent 能力声明。
- ## :lucide:send: 文档交付
  正式审核流程：待审核 → 已批准/已拒绝/需修改。支持多平台（腾讯文档、飞书、Notion、本地）。
- ## :lucide:clock: 定时任务
  可视化 Cron 调度器，心跳唤醒。支持一次性/每日/每周/每月调度。完整执行历史追踪。
- ## :lucide:message-square: 智能对话
  多模式对话（聊天/API/混合），实体绑定。思考层级控制。与任务、项目关联的上下文感知讨论。
- ## :lucide:layout-dashboard: 仪表盘
  实时连接状态、系统指标、快速导航、数据统计。所有 AI 活动统一视图。

<!-- @slot:modelsTitle -->
基于 OpenClaw Gateway 构建 — 兼容业界主流模型

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- DeepSeek
- Qwen
- GLM
- Doubao
- KIMI
- MiniMax

<!-- @slot:footerLinks -->
- [用户指南](/wiki?doc=VrihWxkCoM9Q)
- [API 文档](/wiki?doc=FtmyZ2zMsm1c)
- [博客](/blog)
- [GitHub](https://github.com/dqalex/teamclaw)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw. All rights reserved. v0.9.7
`;

async function main() {
  console.log('Updating landing pages with screenshots...');
  
  // Update English landing page
  await db.update(landingPages)
    .set({ content: landingEnContent, updatedAt: new Date() })
    .where(eq(landingPages.id, 'landing-en'));
  console.log('✅ Updated landing-en');
  
  // Update Chinese landing page
  await db.update(landingPages)
    .set({ content: landingZhContent, updatedAt: new Date() })
    .where(eq(landingPages.id, 'landing-zh'));
  console.log('✅ Updated landing-zh');
  
  console.log('Done!');
}

main().catch(console.error);
