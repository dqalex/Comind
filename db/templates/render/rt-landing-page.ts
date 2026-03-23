/**
 * 渲染模板：首页内容
 * 设计原则：1:1 对标 app/page.tsx
 * 导航栏由 Navbar 组件固定渲染，此模板仅管理 Hero/Features/Models/Footer 内容
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtLandingPage: BuiltinRenderTemplate = {
  id: 'rt-builtin-landing-page',
  name: '首页内容',
  description: '用于编辑网站首页内容（Hero、功能特性、模型Logo、页脚）。导航栏固定不可编辑。',
  category: 'custom',
  htmlTemplate: `<div class="landing-page">
  <!-- Hero -->
  <section class="lp-hero">
    <div class="lp-hero-glow"></div>
    <div class="lp-hero-glow-2"></div>
    <div class="lp-hero-content">
      <div class="lp-badge">
        <span class="lp-badge-dot"><span class="lp-badge-ping"></span></span>
        <span data-slot="heroBadge" data-slot-type="content"></span>
      </div>
      <div class="lp-title" data-slot="heroTitle" data-slot-type="content"></div>
      <div class="lp-subtitle" data-slot="heroSubtitle" data-slot-type="content"></div>
      <div class="lp-cta" data-slot="ctaButtons" data-slot-type="content"></div>
      <!-- Dashboard Preview -->
      <div class="lp-preview">
        <div class="lp-preview-window">
          <div class="lp-preview-titlebar">
            <span class="lp-dot lp-dot-red"></span>
            <span class="lp-dot lp-dot-yellow"></span>
            <span class="lp-dot lp-dot-green"></span>
            <span class="lp-preview-titlebar-text">TeamClaw Agent Orchestrator</span>
          </div>
          <div class="lp-preview-body" data-slot="dashboardPreview" data-slot-type="content"></div>
        </div>
        <div class="lp-preview-glow"></div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="lp-features" id="features">
    <div class="lp-features-inner">
      <div class="lp-features-header" data-slot="featuresHeader" data-slot-type="content"></div>
      <div class="lp-feature-grid" data-slot="featureCards" data-slot-type="content"></div>
    </div>
  </section>

  <!-- Models -->
  <section class="lp-models" id="models">
    <div class="lp-models-inner">
      <div class="lp-models-title" data-slot="modelsTitle" data-slot-type="content"></div>
      <div class="lp-model-logos" data-slot="modelLogos" data-slot-type="content"></div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="lp-footer">
    <div class="lp-footer-inner">
      <div class="lp-footer-brand">
        <svg class="lp-footer-logo" viewBox="0 0 1024 1024" fill="none">
          <rect x="53" y="222" width="200" height="580" rx="100" ry="100" fill="#475569"/>
          <rect x="309" y="222" width="200" height="580" rx="100" ry="100" fill="#334155"/>
          <rect x="309" y="362" width="200" height="300" rx="100" ry="100" fill="#475569"/>
          <rect x="565" y="222" width="200" height="580" rx="100" ry="100" fill="#475569"/>
          <circle cx="896" cy="297" r="75" fill="#475569"/>
        </svg>
        <span>TeamClaw</span>
      </div>
      <div class="lp-footer-links" data-slot="footerLinks" data-slot-type="content"></div>
      <div class="lp-footer-social" data-slot="footerSocial" data-slot-type="content"></div>
    </div>
    <div class="lp-copyright" data-slot="footerCopyright" data-slot-type="content"></div>
  </footer>
</div>`,
  cssTemplate: `/* ===== 基础（对标 app/page.tsx：bg-[#020617]） ===== */
.landing-page {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #020617;
  color: #fff;
  min-height: 100vh;
  overflow-x: hidden;
}
.landing-page *, .landing-page *::before, .landing-page *::after {
  box-sizing: border-box;
}

/* ===== Hero（对标 page.tsx：pt-32/md:pt-48） ===== */
.lp-hero {
  position: relative;
  padding: 128px 24px 80px;
  overflow: hidden;
}
@media (min-width: 768px) {
  .lp-hero { padding: 192px 24px 128px; }
}
.lp-hero-glow {
  position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
  width: 1000px; height: 600px;
  background: radial-gradient(ellipse, rgba(0,86,255,0.10) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.lp-hero-glow-2 {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 800px; height: 400px;
  background: radial-gradient(ellipse, rgba(168,85,247,0.05) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.lp-hero-content {
  position: relative; z-index: 1;
  max-width: 1280px; margin: 0 auto; text-align: center;
}

/* Badge（对标 page.tsx：text-[#0056ff]，非 #60a5fa） */
.lp-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 9999px;
  background: rgba(0,86,255,0.1); border: 1px solid rgba(0,86,255,0.2);
  font-size: 12px; font-weight: 600; color: #0056ff;
  margin-bottom: 32px;
}
.lp-badge p { margin: 0; display: inline; }
.lp-badge strong { font-weight: 600; }
.lp-badge-dot {
  position: relative; display: flex; width: 8px; height: 8px;
}
.lp-badge-ping {
  position: absolute; inset: 0; border-radius: 50%;
  background: #0056ff; opacity: 0.75;
  animation: lp-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
}
.lp-badge-dot::after {
  content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: #0056ff;
}
@keyframes lp-ping { 75%, 100% { transform: scale(2); opacity: 0; } }

/* Title（对标 page.tsx：text-5xl/md:text-7xl = 48/72px，gradient to-r） */
.lp-title {
  max-width: 896px; margin: 0 auto 24px;
}
.lp-title h1, .lp-title p {
  font-size: 48px; font-weight: 700; line-height: 1.1;
  letter-spacing: -0.025em; margin: 0;
  background: linear-gradient(to right, #0056ff 0%, #60a5fa 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
@media (min-width: 768px) {
  .lp-title h1, .lp-title p { font-size: 72px; }
}

/* Subtitle（对标 page.tsx：max-w-2xl = 672px） */
.lp-subtitle {
  max-width: 672px; margin: 0 auto 40px;
}
.lp-subtitle p {
  font-size: 18px; line-height: 1.625; color: #94a3b8; margin: 0;
}
@media (min-width: 768px) {
  .lp-subtitle p { font-size: 20px; }
}

/* CTA 按钮区域：自适应数量，居中排列（对标 page.tsx：h-12 px-8 rounded-full） */
.lp-cta {
  display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-bottom: 80px;
}
.lp-cta p { margin: 0; }
.lp-cta ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.lp-cta li { display: inline-flex; }
.lp-cta li { list-style: none; }
.lp-cta li:first-child a {
  display: inline-flex; align-items: center; height: 48px; padding: 0 32px;
  border-radius: 9999px; font-weight: 600; font-size: 15px;
  cursor: pointer; transition: all .2s; text-decoration: none;
  background: #fff; color: #0f172a;
}
.lp-cta li:first-child a:hover { background: #f1f5f9; }
.lp-cta li:not(:first-child) a {
  display: inline-flex; align-items: center; height: 48px; padding: 0 32px;
  border-radius: 9999px; font-weight: 500; font-size: 15px;
  cursor: pointer; transition: all .2s; text-decoration: none;
  background: rgba(15,23,42,0.5); color: #fff;
  border: 1px solid rgba(51,65,85,0.8); backdrop-filter: blur(4px);
}
.lp-cta li:not(:first-child) a:hover { background: rgba(30,41,59,0.8); }

/* Dashboard Preview（对标 page.tsx：max-w-6xl = 1152px，h-[400px]/md:h-[500px]） */
.lp-preview {
  position: relative; max-width: 1152px; margin: 0 auto;
}
.lp-preview-window {
  border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(15,23,42,0.8);
  backdrop-filter: blur(12px);
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
}
.lp-preview-titlebar {
  height: 40px; display: flex; align-items: center; padding: 0 16px; gap: 8px;
  background: #0f172a; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.lp-dot { width: 12px; height: 12px; border-radius: 50%; }
.lp-dot-red { background: rgba(239,68,68,0.8); }
.lp-dot-yellow { background: rgba(234,179,8,0.8); }
.lp-dot-green { background: rgba(34,197,94,0.8); }
.lp-preview-titlebar-text {
  flex: 1; text-align: center; font-size: 12px; font-family: monospace; color: #64748b;
}
.lp-preview-body {
  min-height: 400px; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #0b1121; overflow: hidden;
}
@media (min-width: 768px) {
  .lp-preview-body { min-height: 500px; }
}
/* 默认占位样式（当 slot 注入简单文字时） */
.lp-preview-body p { color: #64748b; font-size: 14px; margin: 0; }
/* 当 slot 注入了图片时，图片填满预览区 */
.lp-preview-body img {
  width: 100%; height: 100%; object-fit: cover; object-position: top;
}
.lp-preview-glow {
  position: absolute; bottom: -40px; left: 40px; right: 40px; height: 80px;
  background: rgba(0,86,255,0.2); filter: blur(80px); border-radius: 50%;
  pointer-events: none;
}

/* ===== Features（对标 page.tsx：py-20/md:py-32） ===== */
.lp-features {
  padding: 80px 24px;
}
@media (min-width: 768px) {
  .lp-features { padding: 128px 24px; }
}
.lp-features-inner {
  max-width: 1280px; margin: 0 auto;
}
.lp-features-header {
  margin-bottom: 64px;
}
.lp-features-header h2 {
  font-size: 30px; font-weight: 700; color: #fff; margin: 0 0 24px;
  letter-spacing: -0.025em;
}
@media (min-width: 768px) {
  .lp-features-header h2 { font-size: 36px; }
}
.lp-features-header p {
  font-size: 18px; color: #94a3b8; margin: 0; max-width: 672px; line-height: 1.7;
}
/* 自适应卡片网格：auto-fill，最小 300px，自动换行，统一行高 */
.lp-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: 1fr;
  gap: 24px;
}
.lp-feature-grid ul {
  display: contents; list-style: none; padding: 0; margin: 0;
}
.lp-feature-grid > li, .lp-feature-grid ul > li {
  padding: 32px; border-radius: 16px;
  background: #0b1121;
  border: 1px solid rgba(255,255,255,0.05);
  transition: all 0.3s ease;
  list-style: none;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.lp-feature-grid > li:hover, .lp-feature-grid ul > li:hover {
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 25px 50px -12px rgba(0,86,255,0.08);
  transform: translateY(-4px);
}
.lp-feature-grid li h2, .lp-feature-grid li h3 {
  font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 12px;
  transition: color .2s;
  line-height: 1.3;
}
.lp-feature-grid li:hover h2, .lp-feature-grid li:hover h3 { color: #0056ff; }
.lp-feature-grid li p {
  font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.7;
  flex: 1;
}
/* Lucide Icons in feature cards */
.lp-feature-grid li h2 svg, .lp-feature-grid li h3 svg {
  display: inline-block; vertical-align: middle; margin-right: 8px;
  width: 22px; height: 22px; color: #0056ff; stroke-width: 2;
}
.lp-feature-grid li:hover h2 svg, .lp-feature-grid li:hover h3 svg {
  color: #60a5fa;
}

/* ===== Models（对标 page.tsx：tracking-widest = 0.1em，opacity-60，gap-12/md:gap-24） ===== */
.lp-models {
  padding: 80px 24px;
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(11,17,33,0.5);
  backdrop-filter: blur(4px);
}
.lp-models-inner {
  max-width: 1280px; margin: 0 auto; text-align: center;
}
.lp-models-title p, .lp-models-title {
  font-size: 14px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.1em; color: #64748b; margin: 0 0 40px;
}
/* Model logos：交替字体样式（对标 page.tsx logoStyles） */
.lp-model-logos {
  display: flex; flex-wrap: wrap; justify-content: center;
  align-items: center; gap: 48px;
  opacity: 0.6; filter: grayscale(1);
  transition: all .5s;
}
@media (min-width: 768px) {
  .lp-model-logos { gap: 96px; }
}
.lp-model-logos:hover { opacity: 1; filter: grayscale(0); }
.lp-model-logos ul {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 48px;
}
@media (min-width: 768px) {
  .lp-model-logos ul { gap: 96px; }
}
/* 交替字体：1=sans bold, 2=serif semibold, 3=mono bold, 4=sans black italic，循环 */
.lp-model-logos li {
  font-size: 20px; font-weight: 700; color: #fff; white-space: nowrap;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.lp-model-logos li:nth-child(4n+2) { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; }
.lp-model-logos li:nth-child(4n+3) { font-family: 'SF Mono', 'Fira Code', monospace; }
.lp-model-logos li:nth-child(4n+4) { font-weight: 900; font-style: italic; }
.lp-model-logos p { margin: 0; }
.lp-model-logos img { height: 32px; width: auto; filter: invert(1); opacity: 0.8; }

/* ===== Footer（对标 Footer.tsx：py-12/md:py-20，flex-col/md:flex-row） ===== */
.lp-footer {
  padding: 48px 24px 32px;
  border-top: 1px solid rgba(255,255,255,0.05);
  background: #020617;
}
@media (min-width: 768px) {
  .lp-footer { padding: 80px 24px 32px; }
}
.lp-footer-inner {
  max-width: 1280px; margin: 0 auto;
  display: flex; flex-direction: column; align-items: center;
  gap: 32px;
}
@media (min-width: 768px) {
  .lp-footer-inner { flex-direction: row; justify-content: space-between; }
}
.lp-footer-brand {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 18px; color: #94a3b8;
  transition: color .2s;
}
.lp-footer-brand:hover { color: #fff; }
.lp-footer-logo {
  width: 24px; height: 24px;
  opacity: 0.6; filter: grayscale(1);
  transition: all .3s;
}
.lp-footer-brand:hover .lp-footer-logo { opacity: 1; filter: grayscale(0); }
/* Footer 链接 */
.lp-footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 32px; }
.lp-footer-links a {
  color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500;
  transition: color .2s;
}
.lp-footer-links a:hover { color: #fff; }
.lp-footer-links ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 32px; }
.lp-footer-links li a { color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; transition: color .2s; }
.lp-footer-links li a:hover { color: #fff; }
.lp-footer-links p { margin: 0; }
/* Footer 社交链接 */
.lp-footer-social { display: flex; align-items: center; gap: 16px; }
.lp-footer-social a {
  color: #475569; text-decoration: none; font-size: 13px; font-weight: 500;
  transition: color .2s;
}
.lp-footer-social a:hover { color: #fff; }
.lp-footer-social ul { list-style: none; padding: 0; margin: 0; display: flex; align-items: center; gap: 16px; }
.lp-footer-social li a { color: #475569; text-decoration: none; font-size: 13px; font-weight: 500; transition: color .2s; }
.lp-footer-social li a:hover { color: #fff; }
.lp-footer-social p { margin: 0; }
/* Footer 版权 */
.lp-copyright {
  max-width: 1280px; margin: 48px auto 0;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 32px;
  text-align: center; font-size: 12px; color: #475569;
}
.lp-copyright p { margin: 0; }`,
  mdTemplate: `<!-- @slot:heroBadge -->
**Badge:** v3.0 Released — Multi-User & SOP Engine

<!-- @slot:heroTitle -->
# Elevate AI Agents from Chatbots to Team Members

<!-- @slot:heroSubtitle -->
TeamClaw is an AI Agent collaboration platform. Manage AI like team members with Kanban boards, knowledge wiki, and structured workflows — no more scrolling through endless chat history.

<!-- @slot:ctaButtons -->
- [Start Collaborating](/dashboard)
- [View Documentation](/wiki?doc=VrihWxkCoM9Q)

<!-- @slot:dashboardPreview -->
Dashboard Preview

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
© 2026 TeamClaw. All rights reserved. v0.9.7`,
  slots: {
    heroBadge: { label: 'Hero Badge', type: 'content', placeholder: '**Badge:** v3.0 Released — Multi-User & SOP Engine' },
    heroTitle: { label: 'Hero Title', type: 'content', placeholder: '# Elevate AI Agents from Chatbots to Team Members' },
    heroSubtitle: { label: 'Hero Subtitle', type: 'content', placeholder: 'TeamClaw is an AI Agent collaboration platform...' },
    ctaButtons: { label: 'CTA Buttons (list)', type: 'content', placeholder: '- [Start Collaborating](/dashboard)\n- [View Documentation](/wiki?doc=VrihWxkCoM9Q)' },
    dashboardPreview: { label: 'Dashboard Preview', type: 'content', placeholder: 'Dashboard Preview\n或插入截图：![screenshot](url)' },
    featuresHeader: { label: 'Features Header', type: 'content', placeholder: '## 10 Core Modules\nEverything you need to manage your AI workforce effectively.' },
    featureCards: { label: 'Feature Cards (list)', type: 'content', placeholder: '- ## :lucide:clipboard-list: SOP Workflow Engine\n  Multi-stage workflow automation with 7 stage types...' },
    modelsTitle: { label: 'Models Title', type: 'content', placeholder: 'Built for OpenClaw Gateway — Compatible with Industry Leading Models' },
    modelLogos: { label: 'Model Logos (list)', type: 'content', placeholder: '- OpenAI\n- Anthropic\n- DeepSeek\n- Qwen' },
    footerLinks: { label: 'Footer Links (list)', type: 'content', placeholder: '- [User Guide](/wiki?doc=VrihWxkCoM9Q)\n- [API Documentation](/wiki?doc=FtmyZ2zMsm1c)\n- [Blog](/blog)' },
    footerSocial: { label: 'Footer Social (list)', type: 'content', placeholder: '- [GitHub](https://github.com/dqalex/teamclaw)' },
    footerCopyright: { label: 'Footer Copyright', type: 'content', placeholder: '© 2026 TeamClaw. All rights reserved. v0.9.7' },
  },
  sections: [
    { id: 'hero', label: 'Hero 区域', slots: ['heroBadge', 'heroTitle', 'heroSubtitle', 'ctaButtons', 'dashboardPreview'] },
    { id: 'features', label: '功能特性', slots: ['featuresHeader', 'featureCards'] },
    { id: 'models', label: '模型 Logo', slots: ['modelsTitle', 'modelLogos'] },
    { id: 'footer', label: '页脚', slots: ['footerLinks', 'footerSocial', 'footerCopyright'] },
  ],
  exportConfig: { formats: ['html'], defaultWidth: 1200, defaultScale: 1, mode: 'long' },
};
