# TeamClaw 变更日志

> 按版本记录所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

---

## [v1.0.1] - 2026-03-23

### Added
- **src/ 层级架构**：全新目录结构，按领域/功能划分代码
  - `src/core/` - 核心模块（MCP 执行器、Gateway 客户端、Event Bus）
  - `src/domains/` - 领域模块（task、project、document、member 等领域 store）
  - `src/features/` - 功能模块（聊天面板、文档编辑器、SOP 引擎）
  - `src/shared/` - 共享模块（UI 组件、Hooks、工具函数、类型定义）
  - `src/server/` - 服务端模块（API 路由、服务层）

### Changed
- **路径别名更新**：
  - `@/store/*` → `@/domains/*/store` (14 个 store 迁移)
  - `@/lib/*` → `@/shared/lib/*` (12 处)
  - `@/components/chat/*` → `@/features/chat-panel/*`
  - `@/components/studio/*` → `@/features/document-editor/*`
  - `@/components/sop/*` → `@/features/sop-engine/*`
- **共享服务提取**：
  - 提取 `approval-service.ts` - 统一审批服务
  - 提取 `sync-service.ts` - 统一同步服务

### Deprecated
- **废弃组件移除**：
  - 删除 `components/` 目录下的 55 个旧组件
  - 删除 `hooks/` 目录下的 14 个旧 hooks
  - 删除 `lib/` 目录下的旧 lib 文件

### Technical
- **导入路径标准化**：所有内部模块通过 @/ 别名导入
- **客户端/服务端分离**：`@/shared/lib/index.ts` 仅导出客户端可用模块
- **构建修复**：修复 MarkdownEditor 客户端组件错误导入服务端模块问题

### Documentation
- 新增 `docs/optimization/ATOMIC_CAPABILITY_REVIEW_v1.0.0.md` - 原子化能力完整 Review
- 新增 `docs/optimization/INTERACTION_REVIEW_v1.0.0.md` - 业务流程与 Agent 交互点 Review
- 更新 `docs/tech-debt/` - 建立技术债跟踪机制

---

## [v3.0.3] - 2026-03-12

### Added
- **Skill 管理系统 (REQ-022)**：
  - 新增 `skills` 表：记录所有发现的 Skill（含来源、信任状态、敏感标记）
  - 新增 `skillSnapshots` 表：Agent Skill 快照，支持差异检测和风险告警
  - 新增 `skillTrustRecords` 表：信任操作审计日志
  - 新增 `lib/skill-validator.ts`：Skill 目录结构和内容验证
  - 新增 `/api/skills` API：Skill CRUD + 列表查询
  - 新增 `/api/skills/[id]/submit` API：提交 Skill 发布审批
  - 新增 `/api/skills/[id]/approve` API：管理员批准 Skill 发布
  - 新增 `/api/skills/[id]/reject` API：管理员拒绝 Skill 发布
  - 新增 `/api/skills/[id]/trust` API：信任/取消信任 Skill
  - 新增 `/api/skills/[id]/snapshots` API：获取 Skill 快照历史
  - 新增 `/api/skills/discover` API：从 Gateway 发现已安装 Skill
  - 新增 `/api/skills/install` API：安装 Skill 到 Agent
- **通用审批系统 (REQ-023)**：
  - 新增 `approvalRequests` 表：通用审批请求
  - 新增 `approvalHistories` 表：审批历史审计日志
  - 新增 `approvalStrategies` 表：审批策略配置
  - 新增 `/api/approval-requests` API：审批请求 CRUD
  - 新增 `/api/approval-requests/[id]/approve` API：批准审批
  - 新增 `/api/approval-requests/[id]/reject` API：拒绝审批
  - 新增 `/api/approval-requests/[id]/cancel` API：取消审批
  - 支持 4 种审批类型：`skill_publish`、`skill_install`、`project_join`、`sensitive_action`
- **SOP 导入增强**：
  - 支持导入 `.zip` 格式 Skill 包（自动解析 SKILL.md + references/ + scripts/）
  - 新增 `jszip` 依赖

### Changed
- 数据库表从 27 张增至 33 张（+skills, +skillSnapshots, +skillTrustRecords, +approvalRequests, +approvalHistories, +approvalStrategies）
- Skills API 权限控制：普通用户只能看到 active 状态和自己创建的 Skill

### Technical
- Skill 来源类型：`teamclaw`（内置）、`manual`（手动创建）、`external`（外部导入）、`unknown`（未知）
- Skill 信任状态：`trusted`（信任）、`untrusted`（不信任）、`pending`（待审核）
- Skill 状态流转：`draft` → `pending_approval` → `active` / `rejected`
- 审批策略支持：审批人规则、超时设置、通知配置

### Added
- **SOP 规范化改造 (REQ-021)**：
  - `sopTemplates` 表新增 `version`、`references`、`scripts` 字段
  - 新增 `lib/skill-generator.ts`：从 SOP 模板生成符合规范的 SKILL.md
  - 新增 `lib/skill-package.ts`：Skill 安装包打包和解析
  - 新增 `/api/sop-templates/[id]/generate-skill` API：生成 SKILL.md
  - 新增 `/api/sop-templates/[id]/export-skill` API：导出 Skill 安装包
  - 新增 `/api/sop-templates/import-skill` API：导入 Skill 安装包
  - 新增 `components/sop/ReferencesPanel.tsx`：参考文档管理面板
  - 新增 `components/sop/ScriptsPanel.tsx`：脚本文件管理面板

### Changed
- `SOPTemplateEditor.tsx` 支持管理外挂文件（references/scripts）
- 数据库迁移逻辑支持自动添加 v3.1 新字段

### Technical
- Skill 安装包格式（.skill.zip）：
  ```
  ├── SKILL.md          # 主文档（含 frontmatter + 自动索引）
  ├── references/       # 参考文档目录
  ├── scripts/          # 脚本目录
  └── manifest.json     # 元数据
  ```

---

## [v3.0.2] - 2026-03-08

### Added
- **对话信道高并发架构优化 (REQ-020)**：
  - 新增 `lib/chat-channel/pool.ts`：Gateway 连接池，支持按用户会话隔离和连接复用
  - 新增 `lib/chat-channel/queue.ts`：消息队列，按 sessionKey 分组处理，支持自动重试
  - 新增 `lib/chat-channel/incremental.ts`：增量更新机制，减少全量 Store 刷新
  - 新增 `lib/chat-channel/resilience.ts`：容灾机制，含熔断器和主备自动切换
  - 优化 `lib/chat-channel/executor.ts`：批量执行 actions，延迟 Store 刷新，并行刷新多个 Store
  - 新增预连接机制 `prefetchConnection`：用户注册/登录时预先建立 Gateway 连接

### Changed
- `lib/chat-channel/index.ts` 更新导出，包含所有 v3.0 新增模块
- `executor.ts` 批量执行优化：N 次全量查询 → 1 次批量并行刷新

### Performance
- 消息处理延迟从 100-300ms 优化到 10-50ms（单 action < 50ms，批量 10 actions < 100ms）
- 连接建立时间从 500-2000ms 优化到 0ms（预连接机制）

---

## [v3.0.1] - 2026-03-07

### Added
- **测试优化**：
  - 新增 `tests/helpers/api-helper.ts`：统一 E2E 测试 API 调用，解决 Cookie 问题
  - 新增 `TestApiFactory` 类：测试数据工厂基类
- **安全增强**：
  - 新增 `lib/audit-log.ts`：审计日志系统，记录敏感操作
  - 新增 `lib/login-rate-limit.ts`：登录限流模块，防止暴力破解
  - 新增 `lib/api-error-handler.ts`：统一 API 错误处理，避免信息泄露
- **性能优化**：
  - 新增 `scripts/add-indexes.ts`：数据库索引优化脚本
  - 新增 `hooks/useInlineEdit.ts`：Enter/Blur 防重复提交 Hook
- **组件抽象**：
  - 新增 `components/EmptyState.tsx`：统一空状态展示组件
  - 新增 `hooks/useFilteredList.ts`：列表筛选 Hook
- **文档**：
  - 新增 `docs/process/OPTIMIZATION_PLAN_20260307.md`：项目优化方案

### Fixed
- 修复 E2E 测试中 `page.request` 不携带 Cookie 的问题
- 修复水平越权漏洞（项目权限校验已实现）

---

## [v3.0.0] - 2026-03-07

### Added
- **多用户认证系统**：
  - 用户注册与登录（邮箱+密码，Argon2id 密码哈希）
  - 用户角色系统：admin（管理员）、member（成员）、viewer（只读）
  - 用户管理页面（`/users`，仅管理员可访问）
  - 用户-成员绑定：每个用户自动关联一个团队成员档案
  - 用户 MCP Token 管理：用户可创建/管理自己的 MCP 访问令牌
  - Cookie Session 认证，支持自动过期和刷新
- **首次初始化向导**：
  - `/init` 初始化页面，新部署自动跳转
  - 管理员账户创建引导
  - 初始化状态检测 API（`GET /api/init`）
  - 初始化锁定机制，防止重复初始化
- **项目权限系统**：
  - 项目拥有者（owner）字段
  - 项目可见性（private/team/public）
  - 项目成员表（project_members）：owner/admin/member/viewer 四种项目角色
- **聊天记录用户隔离**：
  - chat_sessions 表新增 userId 字段
  - 每个用户只能看到自己的聊天记录
- **活动日志增强**：
  - 新增 activity_logs 表，支持多维度审计
  - 记录操作者身份（userId/memberId）
  - 记录操作来源（web_ui/mcp/chat_channel/gateway 等）
  - 记录业务模块、资源类型、变更内容
- **认证相关 API**：
  - `POST /api/auth/login` - 用户登录
  - `POST /api/auth/register` - 用户注册
  - `POST /api/auth/logout` - 用户登出
  - `GET /api/auth/me` - 获取当前用户
  - `GET/POST /api/users` - 用户列表/创建
  - `GET/PUT/DELETE /api/users/[id]` - 用户详情/更新/删除
  - `GET/POST/PUT/DELETE /api/user-mcp-tokens` - 用户 MCP Token 管理

### Changed
- 数据库表从 21 张增至 27 张（+users, +user_mcp_tokens, +sop_stage_records, +activity_logs, +project_members, +landing_pages）
- members 表新增 userId 字段，关联认证用户
- projects 表新增 ownerId、visibility 字段
- chat_sessions 表新增 userId 字段实现用户隔离
- Zustand Store 新增 auth.store.ts、user-mcp-token.store.ts
- README.md/README_zh.md 版本号更新为 v3.0.0

### Fixed
- 初始化流程数据库连接问题：初始化检测 API 使用独立数据库连接
- 管理员创建时自动关联成员档案

---

## [v0.4.6] - 2026-03-04

### Fixed (Code Review Round 2)
- **P0 严重问题修复**：
  - `push/route.ts` 旧版本丢失 bug：先读取旧内容再写入新内容，确保版本历史正确保存
  - `debug/route.ts` GET 端点添加生产环境鉴权（TEAMCLAW_API_TOKEN），防止敏感信息泄露
  - 5 个 openclaw-files 路由添加路径遍历防护（`filePath.startsWith(workspace.path)` 校验）
- **P1 重要问题修复**：
  - `sop-templates/[id]/export` 路由添加 try-catch 错误处理
  - `openclaw-conflicts/[id]/resolve` 改为 `db.transaction()` 原子操作
  - `openclaw-files/[id]/versions` limit 添加最大值限制（Math.min 100）
  - `task-logs` GET 添加默认 limit(500) 防止全量返回
- **P2 改进项**：
  - 3 个路由添加 `progress` 范围校验（0-100）
  - 2 个路由添加 `openclawTemperature` 范围校验（0.0-2.0）
  - `syncInterval` 默认值从 30 修正为 120（与 DB schema 保持一致）
  - 3 个路由添加外键存在性校验（task-logs/chat-messages/scheduled-task-history）

---

## [v0.4.6] - 2026-03-03

### Added
- **SOP 引擎**：新增完整的标准化操作流程（SOP）引擎，支持 7 种阶段类型（input/ai_auto/ai_with_confirm/manual/render/export/review），7 种阶段状态，自动推进与人工确认混合工作流
- **SOP 模板管理**：SOP 模板 CRUD API + Store + 页面 UI（列表/筛选/创建/编辑/导入/导出），5 个内置模板（竞品调研/内容营销/周报月报/Bug 分析/数据分析）
- **渲染模板系统**：渲染模板 CRUD API + Store + 页面 UI（列表/详情/Slots/Sections/HTML 预览），4 个内置模板（简约报告/项目周报/社交卡片/数据海报）
- **SOP 进度条组件**（`SOPProgressBar.tsx`）：compact/expanded 双模式，阶段状态可视化，操作按钮（确认/驳回/跳过/启动）
- **SOP 模板编辑器**（`SOPTemplateEditor.tsx`）：完整阶段编辑（含拖拽排序、渲染模板选择器），质量检查项管理
- **SOP 调试面板**（`SOPDebugPanel.tsx`）：统计、模板使用、任务列表、阶段历史时间线、sopInputs/JSON 查看
- **Input Stage 表单 UI**：SOP input 阶段动态表单（text/textarea/select），验证逻辑，数据传递
- **SOP 推送集成**：SOP 任务自动使用 `sop-task-push` 模板，注入阶段信息、前序产出、用户输入、阶段类型指令
- **Know-how 分层知识库**（`lib/knowhow-parser.ts`）：L1-L5 五层解析器，智能 L4 追加，token 预估
- **Content Studio 集成**：SOP render 阶段自动创建 visual 文档，TaskDrawer "打开 Content Studio" 按钮
- **9 个 SOP MCP 工具**：advance_sop_stage/request_sop_confirm/get_sop_context/save_stage_output/update_knowledge/create_sop_template/update_sop_template/create_render_template/update_render_template
- **9 个 SOP 对话信道 Actions**：chat-channel types/actions 扩展 SOP 操作类型
- **SOP 模板导入导出 API**：导出脱 DB 字段加元数据，导入校验+重生成 ID+draft 状态
- **SOP 页面 Tab 切换**：SOP 模板 / 渲染模板双标签页
- **SSE 事件扩展**：新增 sop_confirm_request 事件类型
- **3 个 SOP Mustache 模板**：sop-task-push.md/sop-confirm-request.md/sop-stage-result.md
- **DB Schema 扩展**：新增 sop_templates/render_templates 表，tasks/documents 表新增 SOP 相关字段

### Fixed
- **SOP 推送模板缺 has_previous_outputs**：前序产出永远不显示（BUG-048）
- **SOP reject 回退状态错误**：回退到 input 阶段硬编码 active 改为 waiting_input（BUG-049）
- **save_stage_output 覆盖状态**：不再覆盖 waiting_confirm 状态（BUG-050）
- **ai_with_confirm 阶段绕过防护**：AI 必须先 request_sop_confirm（BUG-051）
- **sop-advance 非原子操作**：4 个操作包装 db.transaction()（BUG-052）
- **客户端伪造内置模板**：POST 强制 isBuiltin=false（BUG-053）
- **MCP definitions required 错误**：移除 category 必选（BUG-054）
- **useMemo 执行副作用**：fetchRenderTemplates 改为 useEffect
- **SOPTemplateEditor 未使用导入**：移除 GripVertical/AlertTriangle/useRef/useEffect 死代码
- **sop-advance SSE 事件类型**：document_create 改为 document_update

### Changed
- 数据库表从 19 张增至 21 张（+sop_templates, +render_templates）
- MCP 工具从 28 个增至 37 个（+9 SOP/渲染模板工具）
- 对话信道 Actions 从 27 个增至 36 个（+9 SOP Actions）
- SOPCategory 新增 media 分类
- 移除 date-fns 依赖（~38M），用原生 JS 实现 formatDistanceToNow

---

## [v0.3.9] - 2026-02-28

### Added
- **UI 设计系统 v3**：全面视觉升级，字体切换到 Plus Jakarta Sans + JetBrains Mono，品牌色改为 indigo #4f46e5，新增毛玻璃/渐变/glow 动效等 Design Token，圆角升级 rounded-2xl，阴影改为 CSS 变量分级体系
- **Vitest 测试框架**：搭建完整测试套件，127 用例全通过，测试目录重组为 unit/integration/req/reports 四层，新增 api-client 双环境切换和 test-reporter 诊断报告工具
- **Chat 状态迁移**：7 个 chat 相关字段从 ui.store 迁移到 chat.store，新增 persist 持久化 activeGwSessionKey
- **统一相对时间格式化**：新增 `hooks/useRelativeTime`，5 个文件的内联 formatDistanceToNow 替换为统一工具函数

### Changed
- **开发流程重构**：dev-workflow 从 6 步改为 7 步（测试前置），需求确认→建立测试→实现→测试验证→文档维护→Review→发布
- **Sidebar 全面升级**：导航项图标 rounded-xl 容器、活跃态左侧指示条、展开/收起宽度调整
- **Header 升级**：高度调整、sticky 定位、用户头像渐变色背景
- **Dashboard 全面重构**：统计卡片渐变背景+独立图标容器、快速入口彩色渐变+箭头动效、项目进度条渐变
- **UI 基础组件全面升级**：Button 渐变主色+光影 hover、Card/Badge/Tabs/Input/Dialog/Dropdown/Progress 圆角和动画增强

---

## [v0.3.5] - 2026-02-26

### Added
- **里程碑功能**：新增 milestones DB 表、milestone.store.ts（第 14 个 Store）、4 个 MCP 工具（create_milestone/list_milestones/update_milestone/delete_milestone）、完整 API Routes、SSE 事件推送、MilestoneManager 管理 UI
- **里程碑 Markdown 同步**：新增 `teamclaw:milestones` 同步类型，支持解析/序列化/同步到数据库/反向回写（`lib/sync/milestone-sync.ts`）
- **任务看板里程碑支持**：泳道按里程碑子分组、拖拽支持跨里程碑移动、新建任务对话框里程碑选项、TaskDrawer 里程碑选择器
- **批注系统**：新增 `AnnotationPanel.tsx`，非编辑模式可添加批注、选中文本插入批注、面板跳转定位+闪烁动画
- **任务批量操作**：新增批量状态变更下拉菜单和批量删除（含确认对话框）
- **"与 AI 讨论"功能**：Wiki 文档和交付中心新增 MessageSquare 按钮，构造引用消息通过 openChatWithMessage 发送
- **任务日志自动记录**：前端操作（状态/优先级/负责人/截止日期变更）自动调用 createLog 写入 task_logs
- **任务卡片子任务进度**：看板视图任务卡片新增 checkItems 进度条和完成计数
- **Agent 工作状态超时自动重置**：新增 `/api/openclaw-status/check-stale` 端点，DataProvider 每 60 秒定时检查
- **交付删除功能**：审核弹窗增加删除按钮和确认对话框
- **交付审核通知增强**：新建 delivery-review-result 模板，重构为模板引擎渲染丰富消息
- **交付审核通知 browser_direct 兼容**：重构为 task-push 模式（API 构建消息 → 前端发送）
- **Logo/Icon 更新**：整体布局调整，青色圆点增大

### Fixed
- **React Hooks 错误 #300**：DeliveryStatusCard 条件性 return null 移到所有 hooks 之后
- **交付审核通知 sessionKey 错误**：修复硬拼 agent:${id} 导致消息发到错误会话
- **同步引擎幽灵项目**：front matter project 字段改为只关联已有项目不自动创建
- **项目删除遗漏 milestones 级联清理**
- **MD 编辑器选区偏移**：escapeHtml 不再转义反引号，移除高亮层多余换行
- **文档切换白屏**：MarkdownEditor 添加 key={selectedDocId} + loading 占位
- **i18n key 显示原始文字**：wiki.chatWithAI 翻译补充
- **非 teamclaw 文档 delivery_status 不触发交付识别**：parseFrontmatter 放宽校验
- **非 teamclaw 文件变更不更新 documents 表**：新增 syncNonComindDocument 方法
- **全量同步文件删除 FK 错误**：调整删除顺序（deliveries/tasks → files → documents）
- **文档删除后同步任务残留**：级联清理 sync:documentId 标记任务
- **任务解析误识别**：解析器增加"任务区域"检测，非任务区域 checkbox 不再被解析为独立任务
- **反向同步文档内容丢失**：从全量重写改为原地更新（patchTaskStatusInMarkdown），已删除任务归档

### Changed
- Wiki 文档审核面板重构：窄状态栏+弹窗改为可折叠面板
- delivery.store updateDeliveryAsync 返回 { success, notifyData? }
- SYNC_DIRS/SYNC_ROOT_FILES 白名单提取为共享常量

---

## [v0.3.1] - 2026-02-25

### Added
- **Watcher 实时监听 teamclaw:* 类型**：syncSingleFile 检测到 teamclaw:tasks 等类型时自动创建/更新 documents 并调用 syncMarkdownToDatabase
- **forceReparse 机制**：全量同步支持 forceReparse 参数，teamclaw:* 文件 hash 未变但无关联任务时自动重新解析
- **guide/reference 文档类型支持**：validators.ts 补充枚举值，sync route 补充类型映射
- **自动全量同步启用 forceReparse**：定时全量同步默认启用，确保任务不遗漏
- **子任务序列化缩进**：从 2 空格改为 4 空格（标准 Markdown 嵌套列表语法）
- **任务同步分配成员**：getOrCreateTask 增加 memberId 参数自动设置 assignees
- **`/api/tasks/refresh` 端点**：新增手动刷新任务列表 API

### Fixed
- **任务同步未分配成员**（BUG-021）：getOrCreateTask 自动关联 workspace 绑定的成员
- **task_list 类型文档任务解析失败**（BUG-022）：detectComindType 添加别名，parseFrontmatter 接受 task_list
- **反向同步清空文档**（BUG-024）：syncDatabaseToMarkdown 序列化结果无实际内容时跳过覆盖
- **CLAUDE.md 模板硬编码**：改为从 docs/openclaw/CLAUDE.md 动态读取
- **v0.3.9 部署后 milestone_id 缺失**（BUG-034）：db/index.ts 迁移逻辑补充 tasks.milestone_id 列和 milestones 表
- **DB 新增 4 个缺失索引**：deliveries(document_id, reviewer_id), members(type, openclaw_endpoint)

---

## [v0.2.7] - 2026-02-25

### Fixed
- **Store 防御性增强**：6 个 Store（project/delivery/schedule/openclaw/member/chat）的 `fetchXxx` 方法添加 `Array.isArray` 防御，防止 API 返回分页对象时 `.map()` 崩溃
- **JSON 字段类型守卫**：`crossProjects`/`projectTags` 字段从 truthy 检查改为 `Array.isArray` 守卫，防止非数组 truthy 值导致 `for-of` 逐字符遍历
- **Gateway RPC 方法名修正**：`gateway-proxy.ts` 的 `cron.create`→`cron.add`、`cron.delete`→`cron.remove`，与 `gateway-client.ts` 保持一致
- **MCP deliver_document 参数修正**：移除 `external_url` 必选校验（阻止 platform:local 交付），新增 `document_id` 参数传递
- **Sidebar 组件守卫**：`crossProjects`/`projectTags` 遍历前添加 `Array.isArray` 守卫

---

## [v0.2.6] - 2026-02-24

### Added
- **三种交互通道架构文档**：对话信道、MCP API、文档同步的能力边界分析
- **MCP 验证机制**：内置验证脚本、验证场景清单（6 个必须验证场景）
- **交付审核增强**：心跳巡检交付状态检查、编辑器快速审核入口
- **MCP 工具扩展**：`list_my_deliveries`、`get_delivery` 工具

### Changed
- SKILL.md 重构：强调 MCP 作为核心兜底通道
- 模板文件更新：`deliveries.md`、`task-board.md` 添加验证步骤
- 心跳模板更新：`heartbeat-check-progress.md` 新增交付状态检查

### Fixed
- 交付记录 `documentId` 自动填充逻辑

---

## [v0.2.5] - 2026-02-22

### Changed
- 文档架构重组：按读者角色分类到 `docs/product/`、`docs/technical/`、`docs/process/`、`docs/openclaw/`
- DEVELOPMENT.md 重写为纯架构+开发指南，归档 v1 迁移内容到 `docs/archive/`
- PRD.md 更新：修复表数量（17→18，补充 auditLogs）、纳入 Phase 12-14 长期规划
- REQUIREMENTS.md 更新：REQ-003 状态 completed、REQ-002 迁移步骤全部完成
- TECH_DEBT.md 更新：TD-006 ChatPanel 拆分完成（1527→670 行）
- CLAUDE.md 和 WORKSPACE_STANDARD.md 分别归入 `docs/openclaw/`，按读者角色独立保留

### Added
- `docs/archive/DEVELOPMENT_V1_MIGRATION.md` — 归档 v1→v2 迁移历史
- `docs/process/CHANGELOG.md` — 变更日志

### Removed
- 删除根目录旧文档：`docs/CLAUDE.md`、`docs/OPENCLAW_WORKSPACE_STANDARD.md`
- 合并删除：`docs/PROJECT_CONTEXT.md`（内容分配到 DEVELOPMENT/PRD）
- 合并删除：`docs/UI_DEPENDENCIES.md`（内容合入 DEVELOPMENT/COMPONENTS）

---

## [v0.2.3] - 2026-02-21

### Added
- Gateway 双模式：`server_proxy`（服务端代理）/ `browser_direct`（浏览器直连）
- Gateway Token AES-256 加密数据库存储
- API 代理端点 `/api/gateway/*`
- SSE Gateway 事件推送
- GatewayRequired 组件双模式连接判断
- 安全设置面板（SSRF/外网/DNS 重绑定防护）
- 结构化日志（JSON 格式 + 日志轮转）

### Changed
- 所有 Gateway 依赖页面适配双模式（agents/schedule/sessions/skills）
- DataProvider 初始化时同步服务端代理状态

---

## [v0.1.5] - 2026-02-20

### Added
- OpenClaw Workspace 双向同步 + 冲突解决
- 对话信道模块 `lib/chat-channel/`（统一 Chat Actions + MCP）
- `get_mcp_token` action 支持
- 标准化开发流程 Skill（dev-workflow）
- 需求文档、组件文档、API 文档、技术债文档体系

### Changed
- ChatPanel 迁移到新对话信道模块

---

## [v0.1.0] - 2026-02-19

### Added
- 全平台国际化（i18n）支持（中文 + 英文）
- Markdown ↔ 看板双向同步
- 模板引擎迁移

---

## [v0.0.0] - 2026-02-18

### Added
- 全新架构：Next.js 14 App Router + TypeScript strict mode
- 双数据源架构：SQLite + OpenClaw Gateway WebSocket
- 14 个页面路由
- 27 组 REST API
- 13 个 Zustand Store
- 49 个 UI 组件
- 24 个 MCP 工具
- SSE 实时推送 + DataProvider
- 安全脱敏/错误处理
