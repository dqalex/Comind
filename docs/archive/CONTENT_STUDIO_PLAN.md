# TeamClaw v0.9.8 规划：SOP 引擎 + Content Studio

> **状态**：规划中
> **版本**：v0.9.8（目标版本号，实际按 v0.4.6 → v0.5.4 → v0.6.2 → v0.7.0 → v0.9.8 递进）
> **创建时间**：2026-03-03
> **作者**：Alex

---

## 目录

1. [产品定位升级](#1-产品定位升级)
2. [现有需求衔接](#2-现有需求衔接)
3. [三大新模块总览](#3-三大新模块总览)
4. [模块一：SOP 引擎](#4-模块一sop-引擎)
    - 4.7 [与现有 CheckItem 的兼容策略](#47-与现有-checkitem-的兼容策略)
5. [模块二：Content Studio（内容工作台）](#5-模块二content-studio内容工作台)
6. [模块三：Know-how 知识库](#6-模块三know-how-知识库)
7. [现有系统增强](#7-现有系统增强)
8. [OpenClaw Gateway 融合点](#8-openclaw-gateway-融合点)
9. [数据库 Schema 变更](#9-数据库-schema-变更)
10. [MCP 工具扩展](#10-mcp-工具扩展)
11. [页面/路由变更](#11-页面路由变更)
12. [内置内容策略](#12-内置内容策略)
13. [实施路线图](#13-实施路线图)
    - 13.5 [v0.9.8 多用户管理详细规划](#135-v30-多用户管理详细规划)
    - 13.5.1 [多维度操作日志系统](#1351-多维度操作日志系统)
    - 13.6 [v0.9.8 在线数据库对接](#136-v30-在线数据库对接)
    - 13.7 [v3.x+ 未来版本：媒体创作能力路线图](#137-v3x-未来版本媒体创作能力路线图)
14. [与现有规划的关系](#14-与现有规划的关系)
15. [风险评估](#15-风险评估)
16. [架构优化建议（Review 补充）](#16-架构优化建议review-补充)
17. [技术依赖规划](#17-技术依赖规划)
18. [GrowthPilot-editor 经验移植](#18-growthpilot-editor-经验移植)
19. [文档更新计划](#19-文档更新计划)
20. [Skill 更新计划](#20-skill-更新计划)

---

## 1. 产品定位升级

### 1.1 当前定位（v0.x）

> "把 AI 当队友，而不是工具。" — AI Agent 协作项目管理平台

TeamClaw v2 以**任务驱动**为核心，让 AI Agent 像团队成员一样接任务、写文档、提交交付。但 AI 的执行流程是**非结构化**的——推送一段文字描述，AI 自由发挥。

### 1.2 升级定位（v0.9.8）

> "定义 AI 怎么做，然后可重复执行。" — AI Agent 协作平台 + **可复用工作流引擎**

```
v2: 人写任务描述 → 推送给 AI → AI 自由发挥 → 人审核
v3: 人选择 SOP 模板 → 系统按阶段编排 → AI 分步执行 → 每步可确认 → 成品精修导出
     + 多用户协作 + 在线数据库 + 媒体创作扩展基座
```

### 1.3 核心升级价值

| 维度 | v2 | v3 |
|------|----|----|
| AI 执行方式 | 自由发挥，依赖 prompt 质量 | **SOP 分步编排**，每步有精确指令 |
| 执行可观测性 | 只有 4 状态（todo→completed） | **阶段级进度追踪**（第 3/5 步：亮点提炼） |
| 知识积累 | 每次从零开始 | **Know-how 分层知识库**，越用越好 |
| 内容产出 | 纯 Markdown | Markdown + **HTML 可视化渲染** + 导出图片（未来: 图片生成 + 视频） |
| 流程复用 | 每次手写任务描述 | **SOP 模板**一次定义，反复使用 |
| 协作深度 | 人审核 AI 产出 | 人在 **SOP 关键节点** 介入确认/编辑 |
| 用户体系 | 单用户本地 | **多用户管理** + 角色权限 + 团队协作 |
| 数据存储 | 本地 SQLite | **在线数据库**（PostgreSQL/MySQL）+ SQLite 降级兼容 |

### 1.4 版本能力演进全景

```
v0.x (当前)     v0.9.8 (本期)          v3.x+ (未来)
─────────────   ──────────────────   ──────────────────
文字内容        文字内容              文字内容
                + HTML 可视化内容     + HTML 可视化内容
                + SOP 工作流引擎      + SOP 工作流引擎
                + Know-how 知识库     + Know-how 知识库
                + 多用户管理          + 多用户管理
                + 在线数据库          + 在线数据库
                                     + 🖼 AI 图片创作
                                     + 🎬 AI 视频创作
                                     + 📊 数据可视化
                                     + 🔌 插件市场
```

> **设计原则**：v0.9.8 的数据模型和 SOP 阶段类型必须为未来媒体创作能力**预留扩展空间**，确保 v3.x+ 不需要 breaking change。

---

## 2. 现有需求衔接

### 2.1 未完成需求关系

| 现有需求 | 状态 | 与 v0.9.8 关系 |
|---------|------|-------------|
| **REQ-005**: 任务自动推送 + AI 巡检兜底 | pending (P1) | **前置依赖** — SOP 推送是 REQ-005 的扩展版，需先实现基础推送能力 |
| **REQ-006**: Markdown 甘特图生成器 | pending (P2) | **独立** — 可并行实现，不阻塞 v0.9.8 |

### 2.2 技术债关系

| 技术债 | 与 v0.9.8 关系 |
|--------|-------------|
| **TD-006**: 5 个文件超 800 行 | **顺便解决** — v0.9.8 对 wiki/page.tsx 和 tasks/page.tsx 的改造天然包含拆分 |
| **TD-008**: Gateway 客户端未抽象 Provider | **关联** — SOP 的 requiredTools 检查需要 Provider 抽象，但不阻塞 |
| **TD-009**: 数据统计面板 | **融合** — SOP 执行统计是最有价值的数据分析维度 |
| **TD-010**: 插件扩展机制 | **融合** — SOP 模板 + 渲染模板 = 最自然的"插件"形态 |
| **TD-011**: Gateway RPC 方法名常量 | **顺便解决** — 新增 MCP 工具时统一处理 |

### 2.3 建议执行顺序

```
1. 先完成 REQ-005（任务自动推送）→ 为 SOP 推送打基础
2. 开始 v0.9.8 Phase A（SOP 基础设施）
3. REQ-006（甘特图）可在任意阶段并行实现
```

---

## 3. 三大新模块总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TeamClaw v0.9.8 新增能力                        │
│                                                                     │
│   ┌─── SOP 引擎 ───┐   ┌── Content Studio ──┐   ┌── Know-how ──┐  │
│   │  流程定义       │   │  可视化编辑         │   │ 分层知识库    │  │
│   │  阶段编排       │──▶│  模板渲染          │   │ 经验沉淀     │  │
│   │  AI 指令生成    │   │  导出分发          │   │ 越用越好     │  │
│   └───────┬─────────┘   └────────┬───────────┘   └──────┬───────┘  │
│           │                      │                       │          │
│           ▼                      ▼                       ▼          │
│   ┌───────────────── 现有能力增强 ──────────────────────────────┐   │
│   │  任务系统（+SOP 绑定 +阶段追踪）                            │   │
│   │  Wiki 系统（+模板渲染模式 +双栏编辑）                       │   │
│   │  交付系统（+导出物关联 +阶段审核）                          │   │
│   │  AI 推送（+SOP 上下文注入 +阶段指令）                       │   │
│   │  OpenClaw（+Agent Skills +Cron SOP +Know-how 文件管理）     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌───────────────── v0.9.8 平台能力 ─────────────────────────────┐   │
│   │  👥 多用户管理（注册/登录/角色权限/团队空间）                 │   │
│   │  🗄️ 在线数据库（PostgreSQL/MySQL + SQLite 降级兼容）         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌───────────────── v3.x+ 扩展预留 ────────────────────────────┐   │
│   │  🖼 AI 图片创作 │ 🎬 AI 视频创作 │ 📊 数据可视化 │ 🔌 插件  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

三者关系：
- **SOP 引擎**定义"做什么、分几步、每步怎么做"
- **Content Studio**处理 SOP 产出的可视化内容（HTML 渲染、精修、导出；未来扩展图片/视频编辑）
- **Know-how**让 SOP 执行越来越智能（积累经验、避免重复错误）
- **多用户 + 在线数据库**提供团队协作和生产级数据持久化基座

---

## 4. 模块一：SOP 引擎

### 4.1 核心概念

**SOP（Standard Operating Procedure）** = 可复用的标准操作流程模板。

每个 SOP 模板定义：
- **多阶段流程**：有序的步骤列表
- **每阶段的执行者和行为**：谁做、怎么做、产出什么
- **AI 指令模板**：每阶段的 prompt（Mustache 语法）
- **交互确认点**：哪些阶段需要人工介入
- **知识库引用**：执行时参考哪些经验
- **输出配置**：最终产出物格式和导出设置

### 4.1.1 SOP 的三种创建方式

SOP 模板**不仅可以由人手动创建**，OpenClaw Agent 也能自主编写：

| 创建方式 | 谁操作 | 场景 | 实现 |
|---------|--------|------|------|
| **人工创建** | 用户 | 在 SOP 管理页面通过可视化编辑器配置 | UI 表单 + 阶段拖拽 |
| **AI 自主创建** | OpenClaw Agent | 用户对话中描述需求，AI 自动生成 SOP 模板 | MCP `create_sop_template` |
| **AI 迭代优化** | OpenClaw Agent | AI 执行 SOP 后根据经验自动优化流程 | MCP `update_sop_template` |

**典型场景**：

```
用户: "帮我建一个客户回访的 SOP"
AI:  分析需求 → 设计阶段 → 调用 create_sop_template 生成 →
     {name: "客户回访", stages: [
       {label: "准备客户资料", type: "ai_auto"},
       {label: "生成回访提纲", type: "ai_with_confirm"},
       {label: "回访记录整理", type: "input"},
       {label: "跟进建议", type: "ai_auto"},
       {label: "输出报告", type: "ai_auto", outputType: "markdown"}
     ]}
用户: "确认"  → SOP 模板入库，后续可反复使用
```

```
AI 执行某 SOP 多次后:
     检测到"阶段3总是被用户驳回修改" →
     建议: "建议将阶段3从 ai_auto 改为 ai_with_confirm"
     用户确认 → AI 调用 update_sop_template 优化流程
```

**设计原则**：
- AI 创建的 SOP 与人创建的**数据结构完全相同**，无特殊标记
- `createdBy` 字段记录创建者（人的 memberId 或 AI Agent 的 memberId）
- AI 创建 SOP 后**必须经用户确认**才生效（通过 `request_sop_confirm` 或 delivery 审核）

### 4.2 SOP 模板数据模型

```typescript
interface SOPTemplate {
  id: string;                    // Base58 短 ID
  name: string;                  // "竞品调研报告"、"项目周报"
  description: string;           // 简要说明
  category: SOPCategory;         // 分类
  icon: string;                  // lucide 图标名

  // === 流程定义 ===
  stages: SOPStage[];            // 有序阶段列表

  // === AI 配置 ===
  requiredTools: string[];       // 所需 OpenClaw 工具 (web_search, exec, etc.)
  systemPrompt: string;          // 全局系统 prompt（Mustache 模板）

  // === 知识库（可选）===
  knowledgeConfig?: {
    documentId?: string;         // 关联 Wiki 文档作为知识库
    layers?: KnowledgeLayer[];   // 分层读取规则
  };

  // === 输出配置（可选）===
  outputConfig?: {
    type: OutputType;            // 产出物类型（可扩展）
    renderTemplateId?: string;   // 关联可视化渲染模板
    exportPreset?: ExportPreset;
  };

  // === 质量检查 ===
  qualityChecklist: string[];    // 完成时的检查清单

  // === 元信息 ===
  isBuiltin: boolean;            // 内置 vs 用户创建
  projectId?: string;            // null=全局, 有值=项目专属
  createdBy: string;             // 创建者 memberId
  createdAt: Date;
  updatedAt: Date;
}

type SOPCategory =
  | 'content'      // 内容制作（案例、文章、报告）
  | 'analysis'     // 数据分析（诊断、评估）
  | 'research'     // 调研（竞品、市场、用户）
  | 'development'  // 开发（功能实现、Bug 修复）
  | 'operations'   // 运营（周报、月报、复盘）
  | 'media'        // 媒体创作（图片、视频）— v3.x+ 预留
  | 'custom';      // 自定义

// === 输出类型（可扩展枚举，v3.x+ 新增媒体类型）===
type OutputType =
  | 'markdown'     // v0.9.8: 纯文本/Markdown
  | 'html'         // v0.9.8: HTML 可视化内容
  | 'both'         // v0.9.8: Markdown + HTML
  | 'image'        // v3.x+: AI 生成图片（DALL-E/Midjourney/SD 等）
  | 'video'        // v3.x+: AI 生成视频（Sora/Runway/Pika 等）
  | 'data_viz'     // v3.x+: 数据可视化（ECharts/D3 等）
  | 'composite';   // v3.x+: 混合媒体（图文+视频）
```

### 4.3 SOP 阶段定义

```typescript
interface SOPStage {
  id: string;                    // 阶段唯一 ID
  label: string;                 // "数据收集"、"初稿撰写"
  description: string;           // 阶段说明
  type: StageType;

  // === AI 指令 ===
  promptTemplate?: string;       // 该阶段的 AI 指令（Mustache 模板）
                                 // 可用变量: {{previousStageOutput}}, {{projectContext}},
                                 // {{taskTitle}}, {{knowledgeContent}}, {{sopInputs.*}}

  // === 交互配置 ===
  requiredInputs?: InputDef[];   // type=input 时，需要用户提供的输入
  confirmMessage?: string;       // type=ai_with_confirm 时的确认提示

  // === 输出定义 ===
  outputType?: StageOutputType;  // 阶段产出类型
  outputLabel?: string;          // "分析结果"、"初稿"

  // === 知识库层级 ===
  knowledgeLayers?: string[];    // 该阶段需读取的知识库层级 ["L1", "L2"]

  // === 可选配置 ===
  optional?: boolean;            // 是否可跳过
  estimatedMinutes?: number;     // 预估耗时
  rollbackStageId?: string;      // review 驳回时回退到的阶段 ID（默认上一阶段）
}

type StageType =
  | 'input'            // 等待人工输入（上传文件、填写信息）
  | 'ai_auto'          // AI 自动执行，完成后自动推进
  | 'ai_with_confirm'  // AI 执行后暂停，等人工确认/修改
  | 'manual'           // 纯人工操作
  | 'render'           // 进入 Content Studio 可视化编辑
  | 'export'           // 导出阶段
  | 'review'           // 提交交付审核
  // === v3.x+ 预留阶段类型 ===
  | 'ai_image'         // AI 图片生成（调用图片模型 API）
  | 'ai_video'         // AI 视频生成（调用视频模型 API）
  | 'media_edit'       // 媒体编辑（图片裁剪/标注、视频剪辑）
  | 'data_viz';        // 数据可视化生成

// === 阶段产出类型（可扩展）===
type StageOutputType =
  | 'text'             // v0.9.8: 纯文本
  | 'markdown'         // v0.9.8: Markdown
  | 'html'             // v0.9.8: HTML
  | 'data'             // v0.9.8: 结构化数据 (JSON)
  | 'file'             // v0.9.8: 文件引用
  | 'image_url'        // v3.x+: 图片 URL/Base64
  | 'video_url'        // v3.x+: 视频 URL
  | 'media_bundle';    // v3.x+: 混合媒体包

interface InputDef {
  key: string;                   // 变量名，在 promptTemplate 中用 {{sopInputs.key}} 引用
  label: string;
  type: 'text' | 'textarea' | 'file' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];            // type=select 时的选项
}
```

### 4.4 阶段类型行为矩阵

| 类型 | 执行者 | 行为 | 推进方式 | 版本 |
|------|--------|------|---------|------|
| `input` | 人 | 等待用户填写/上传输入数据 | 用户提交表单后自动推进 | v0.9.8 |
| `ai_auto` | AI | AI 自动执行，无需人工干预 | AI 调用 `advance_sop_stage` 推进 | v0.9.8 |
| `ai_with_confirm` | AI+人 | AI 执行后暂停，等人工确认 | AI 调用 `request_sop_confirm`，人确认后推进 | v0.9.8 |
| `manual` | 人 | 纯人工操作阶段（如线下调研） | 用户手动标记完成 | v0.9.8 |
| `render` | 人 | 进入 Content Studio 双栏编辑 | 用户保存后推进 | v0.9.8 |
| `export` | 系统 | 触发导出（JPG/HTML/PDF） | 导出完成后自动推进 | v0.9.8 |
| `review` | 人 | 创建 delivery 等待审核 | 审核通过后推进，驳回则回退 | v0.9.8 |
| `ai_image` | AI | 调用图片生成模型（DALL-E/SD 等） | 生成完成后等待人工确认 | v3.x+ |
| `ai_video` | AI | 调用视频生成模型（Sora/Runway 等） | 生成完成后等待人工确认 | v3.x+ |
| `media_edit` | 人 | 进入媒体编辑器（裁剪/标注/剪辑） | 用户保存后推进 | v3.x+ |
| `data_viz` | AI+人 | 生成数据可视化图表 | AI 生成后人工调整确认 | v3.x+ |

### 4.5 任务绑定 SOP 后的状态模型

```
普通任务生命周期（不变）：
  todo → in_progress → reviewing → completed

SOP 任务生命周期（扩展）：
  todo → in_progress → [SOP 阶段流转] → reviewing → completed
                       │
                       ├── stage_1 (input): waiting_input → completed
                       ├── stage_2 (ai_auto): active → completed
                       ├── stage_3 (ai_with_confirm): active → waiting_confirm → completed
                       ├── stage_4 (render): active → completed
                       └── stage_5 (review): active → completed → 整体 completed

  如果 review 阶段被驳回：
    → 回退到 review 阶段的 rollbackStageId 指定的阶段（默认上一个 ai_ 阶段）
    → 任务状态回退为 in_progress
```

### 4.6 任务卡片 UI 变化

```
普通任务卡片：               SOP 任务卡片：
┌──────────────┐            ┌──────────────────────┐
│ 写周报       │            │ 📋 Q1 竞品调研         │
│ 🟡 进行中    │            │ SOP: 调研报告           │
│ 张三         │            │ ████████░░ 3/5 整理分析 │  ← 阶段进度条
└──────────────┘            │ 🟡 等待确认大纲         │  ← 当前阶段状态
                            │ AI: Claude-agent-01    │
                            └──────────────────────┘
```

### 4.7 与现有 CheckItem 的兼容策略

> **背景**：现有 `tasks.check_items` 存储了 `{ id, text, completed }[]` 简单检查项，与 SOP 阶段（SOPStage）在概念上有重叠但层次不同。需要明确两者关系，避免用户困惑。

#### 4.7.1 概念区分

| 维度 | 现有 CheckItem | SOP Stage |
|------|---------------|-----------|
| 定位 | 任务级简单清单（类似 todo-list） | 流程级有序阶段（有状态机、有 AI 参与） |
| 数据结构 | `{ id, text, completed }` 三字段 | `{ id, label, type, promptTemplate, ... }` 十余字段 |
| 状态 | `boolean`（完成/未完成） | 五态（`pending → running → completed/skipped/failed`） |
| 执行者 | 人工勾选 或 AI 调 `complete_check_item` | 按 `type` 自动分派（AI 自动 / 人工输入 / 人工确认） |
| 产出物 | 无 | 每阶段有 `output` + `outputType` |
| 回退 | 不支持 | 支持 `rollbackStageId` |

#### 4.7.2 兼容规则

**1. 普通任务（无 SOP）**：`checkItems` 行为完全不变，用户手动增删改。

**2. SOP 任务**：`checkItems` 由 SOP 引擎**自动托管**，规则如下：

```
SOP 阶段流转时自动同步 checkItems：

阶段启动 → 自动追加 checkItem: { text: "[阶段名] 开始", completed: false }
阶段完成 → 自动标记 completed: true
阶段跳过 → 自动标记 completed: true，text 追加 "(已跳过)"
阶段回退 → 重置目标阶段及之后的 checkItems 为 completed: false

结果：TaskDrawer 的进度条自动反映 SOP 进度，无需额外 UI。
```

**3. SOP 的 `qualityChecklist` → `checkItems` 注入**：

```
当 SOP 流转到 review 类型阶段时：
  → 将 SOPTemplate.qualityChecklist 中的每一项注入为 checkItem
  → 前缀标记: "[质检] 检查标题格式是否规范"
  → 人工逐项勾选后，才能调用 advance_sop_stage 推进 review 通过
  → 如果 review 驳回回退，这些质检 checkItems 被移除（回退后重新注入）
```

**4. SOP 任务的 checkItems 锁定**：

```
当任务绑定了 SOP 时：
  → UI 禁止手动添加/删除 checkItems（仅允许勾选 review 质检项）
  → MCP create_check_item 工具在 SOP 任务上返回错误提示
  → 仅 SOP 引擎内部可增删 checkItems
```

#### 4.7.3 数据模型扩展

```typescript
// CheckItem 扩展（向后兼容，新字段均为 optional）
export type CheckItem = {
  id: string;
  text: string;
  completed: boolean;
  // === v0.9.8 新增 ===
  sopStageId?: string;     // 关联的 SOP 阶段 ID（null = 手动创建的普通检查项）
  source?: 'manual' | 'sop_stage' | 'sop_quality';  // 来源标识
};
```

新增的 `source` 字段用于 UI 区分显示：
- `manual`（或 undefined）：普通检查项，可编辑/删除
- `sop_stage`：SOP 阶段自动生成，只读
- `sop_quality`：SOP review 质检项，仅可勾选

#### 4.7.4 TaskDrawer UI 适配

```
普通任务 TaskDrawer：            SOP 任务 TaskDrawer：
┌──────────────────────┐        ┌─────────────────────────────┐
│ 检查项 (2/4)         │        │ SOP 进度 3/5                │
│ ████████░░░░ 50%     │        │ ██████████████░░░░░░ 60%    │
│                      │        │                             │
│ ☑ 收集数据           │        │ ✅ [数据收集] 完成          │  ← sop_stage, 只读
│ ☑ 整理格式           │        │ ✅ [初稿撰写] 完成          │
│ ☐ 写初稿             │        │ 🔄 [专家审阅] 进行中        │  ← 当前阶段高亮
│ ☐ 提交审核           │        │ ☐ [排版输出] 待开始          │
│                      │        │ ☐ [终审导出] 待开始          │
│ [+ 添加检查项]       │        │                             │
│                      │        │ ── 质检清单 (1/3) ──        │  ← review 阶段时显示
└──────────────────────┘        │ ☑ 数据来源已标注             │  ← sop_quality, 可勾选
                                │ ☐ 图表格式统一               │
                                │ ☐ 结论与数据一致             │
                                └─────────────────────────────┘
```

#### 4.7.5 迁移兼容性

- 现有所有 `checkItems` 的 `source` 字段为 `undefined`，等同于 `manual`，**无需数据迁移**
- 现有 MCP 工具 `create_check_item` / `complete_check_item` 对普通任务行为不变
- 新增一个 MCP 工具校验：当 `task.sop_template_id` 存在时，`create_check_item` 返回错误 `"SOP 任务的检查项由引擎自动管理，无法手动添加"`

---

## 5. 模块二：Content Studio（内容工作台）

### 5.1 定位

**不是独立页面，而是 Wiki 的增强模式。** 当文档关联了可视化渲染模板时，Wiki 编辑区自动切换为双栏模式（左 MD / 右 HTML 预览）。

### 5.1.1 渲染模板的三种创建方式

与 SOP 模板相同，渲染模板也支持 **AI 自主编写**：

| 创建方式 | 谁操作 | 场景 | 实现 |
|---------|--------|------|------|
| **内置模板** | 系统 | 开箱即用的通用模板 | `isBuiltin: true` |
| **人工创建** | 用户 | 在渲染模板管理页面上传/编辑 HTML+CSS | UI 编辑器 |
| **AI 自主编写** | OpenClaw Agent | 用户描述需求，AI 生成完整 HTML/CSS/槽位定义 | MCP `create_render_template` |
| **AI 迭代优化** | OpenClaw Agent | AI 根据导出效果反馈优化模板样式 | MCP `update_render_template` |

**典型场景**：

```
用户: "帮我做一个深色科技风的报告模板，16:9 横版"
AI:  设计 HTML 骨架 → 编写 CSS 样式 → 定义 slots →
     调用 create_render_template {
       name: "深色科技风报告",
       category: "presentation",
       htmlTemplate: "<div class='report-container' data-section='header'>...",
       cssTemplate: ":root { --bg: #0a0e1a; --accent: #00d4ff; } ...",
       slots: {
         title: { label: "标题", type: "text" },
         subtitle: { label: "副标题", type: "text" },
         heroImage: { label: "主图", type: "image" },
         bodyContent: { label: "正文", type: "richtext" }
       },
       exportConfig: { formats: ["jpg","html"], defaultWidth: 1920, mode: "16:9" }
     }
用户: 在 Content Studio 中预览 → 微调 → 满意后保存
```

```
SOP "内容创作" 的 render 阶段:
     AI 发现当前任务需要"竖版长图"但没有合适模板 →
     AI 自动编写一个匹配的渲染模板 → 关联到当前文档 →
     用户在 Content Studio 中使用
```

**AI 编写 HTML 的约束**：
- 必须包含 `data-slot` 和 `data-section` 属性，否则 Content Studio 无法识别槽位
- CSS 必须自包含（不依赖外部 CDN），确保导出时样式完整
- 图片使用占位符 `data-slot-type="image"`，实际图片由用户在 Content Studio 中替换
- AI 生成的模板同样需要**用户确认/预览**后才正式保存

### 5.2 核心能力（移植自 GrowthPilot Editor）

| 能力 | 实现方式 | 来源 |
|------|---------|------|
| MD → HTML 实时渲染 | `data-slot` + `<!-- @slot:xxx -->` 槽位映射 | GrowthPilot `useSync` |
| HTML 可视化编辑 | iframe 内点击选中 → 双击编辑文字/替换图片 | GrowthPilot `HtmlPane` |
| 属性面板 | 右侧面板：颜色/字号/字重/背景修改 | GrowthPilot `PropertyPanel` |
| MD ↔ HTML 双向同步 | 编辑任一侧自动同步到另一侧 | GrowthPilot `useSync` |
| MD 槽位定位 | HTML 中点击元素 → 跳转到 MD 对应位置 | GrowthPilot `HtmlPane` |
| 版本管理 | 保存到 DB（复用 Wiki 版本机制） | TeamClaw Wiki（增强） |
| 导出 JPG/HTML | `html-to-image` 多倍率 + 文件下载 | GrowthPilot `ExportModal` |
| AI 辅助编辑 | 编辑时打开 Chat 面板对话 | TeamClaw Chat（已有） |

### 5.3 渲染模板数据模型

```typescript
interface RenderTemplate {
  id: string;
  name: string;                  // "16:9 横版报告"、"长图信息卡"
  description: string;
  category: string;              // 'report' | 'card' | 'poster' | 'presentation' | 'custom'

  // === 模板内容 ===
  htmlTemplate: string;          // HTML 骨架（含 data-slot, data-section 属性）
  mdTemplate: string;            // 对应 MD 模板（含 <!-- @slot:xxx --> 标记）
  cssTemplate?: string;          // 可选自定义 CSS

  // === 槽位定义 ===
  slots: Record<string, SlotDef>;
  sections: SectionDef[];

  // === 导出配置 ===
  exportConfig: ExportPreset;

  // === 缩略图 ===
  thumbnail?: string;            // base64 或 URL

  // === 元信息 ===
  isBuiltin: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SlotDef {
  label: string;
  type: 'text' | 'richtext' | 'image' | 'data';
  description?: string;
  placeholder?: string;
}
```

#### richtext Slot 的 Markdown 语法支持

`richtext` 类型的 slot 在 MD 模板中编写 Markdown 内容，通过 `simpleMdToHtml()`（`lib/slot-sync.ts`）转为 HTML 后注入到 HTML 模板中。系统会自动注入 `MD_RICHTEXT_STYLES` 样式表（作用域限定在 `[data-slot-type="richtext"]` 内），确保生成的 HTML 标签有正确的排版样式。

**支持的 Markdown 语法**：

| 语法 | MD 写法 | 生成的 HTML |
|------|---------|-------------|
| 标题 | `# ~ ######` | `<h1>` ~ `<h6>` |
| 无序列表 | `- item` 或 `* item` | `<ul><li>` |
| 有序列表 | `1. item` | `<ol><li>` |
| 引用块 | `> text` | `<blockquote>` |
| 代码块 | `` ```code``` `` | `<pre><code>` |
| 水平线 | `---` 或 `***` | `<hr>` |
| 表格 | `| col | col |` | `<table>` |
| 加粗 | `**text**` | `<strong>` |
| 斜体 | `*text*` | `<em>` |
| 删除线 | `~~text~~` | `<del>` |
| 内联代码 | `` `code` `` | `<code>` |
| 链接 | `[text](url)` | `<a>` |
| 段落 | 连续非空行 | `<p>` |

**DOMPurify 白名单标签**（`lib/slot-sync.ts`）：

```
strong, em, b, i, a, br, p, ul, ol, li, code, pre, span,
h1-h6, blockquote, hr, del, table, thead, tbody, tr, td, th
```

**编写 mdTemplate 时的建议**：
- **text/data 类型 slot 禁止使用 MD 语法**（如 `# 标题`），因为 text 用 `textContent` 注入，MD 符号会原样显示
- richtext slot 应充分利用列表、标题、引用等 MD 语法，而非纯文本
- 模板的默认内容（placeholder）应展示该 slot 预期的 MD 格式
- MD 内容在注入 HTML 前经 DOMPurify 清洗，安全可控

```typescript

interface SectionDef {
  id: string;
  label: string;
  slots: string[];               // 包含的 slot ID 列表
}

interface ExportPreset {
  formats: ('jpg' | 'png' | 'html' | 'pdf')[];
  defaultWidth?: number;
  defaultScale?: number;
  mode?: '16:9' | 'long' | 'a4' | 'custom';
}
```

### 5.4 Wiki 文档扩展

当文档的 `renderMode === 'visual'` 时，Wiki 页面切换为 Content Studio 模式：

```
┌────────────────────────────────────────────────────────────┐
│  文档标题   [MD模式] [可视化模式]   保存 | 版本 | 导出     │
├────────────────────────────────────────────────────────────┤
│            │                        │                      │
│  MD 编辑区  │   HTML 预览区          │   属性面板           │
│  (CodeMir) │   (iframe 渲染)        │   (选中元素的       │
│            │                        │    样式/内容编辑)    │
│  <!-- @sl  │   ┌──────────────┐    │                      │
│  ot:title  │   │  [选中的标题]  │    │   字号: 24px        │
│  -->       │   │   ↕ 蓝框高亮   │    │   颜色: #333        │
│  # 标题    │   │              │    │   字重: bold         │
│            │   └──────────────┘    │   背景: transparent  │
│            │                        │                      │
└────────────┴────────────────────────┴──────────────────────┘
```

### 5.5 与 SOP 的衔接

SOP 阶段 `type: 'render'` 时的流程：

```
1. AI 前序阶段产出 MD 内容
2. 系统自动创建 Wiki 文档（renderMode: 'visual'）
3. 关联 SOP 指定的 renderTemplate
4. 用户进入 Content Studio 双栏编辑
5. 精修完成 → 导出 JPG/HTML
6. 导出物自动关联到任务的 delivery
7. SOP 推进到下一阶段（review 或完成）
```

---

## 6. 模块三：Know-how 知识库

### 6.1 定位

让 SOP **越用越好**。每次执行同类 SOP，AI 可以参考历史经验，避免重复犯错。

### 6.2 实现方式

**不新建表，复用 Wiki 文档系统。** Know-how = 普通 Wiki 文档（type: `reference`）+ 特殊的分层格式。

### 6.3 分层格式规范

```markdown
---
type: reference
tags: [know-how, sop-调研报告]
---
# 调研报告 Know-how

## L1 核心规则（~200 tokens，每次执行必读）
- 调研报告必须包含：背景、方法、发现、结论、建议 五个部分
- 数据必须标注来源
- 结论必须有数据支撑

## L2 详细标准（~500 tokens，分析阶段按需读取）
### 信息收集标准
- 至少覆盖 3 个一手信息源
- 数据时效性不超过 6 个月
### 报告结构标准
- 每个发现配 1-2 个数据点
- 建议部分按"短期/中期/长期"分类

## L3 案例库（~300 tokens/案例，建议阶段读取）
### 案例1：XX 行业调研（2026-02）
- 亮点：数据可视化表达
- 经验：竞品对比表格比文字描述效果好

## L4 经验记录（动态增长，复核阶段读+写）
- [2026-03-01] 用户修正：结论段落不要超过 3 句话
- [2026-03-02] 发现规律：客户更关注 ROI 相关数据

## L5 维护日志
- 上次清理：2026-03-01
- 案例数：1
- 经验条数：2
```

### 6.4 分层读取机制

AI 执行 SOP 时，根据当前阶段的 `knowledgeLayers` 配置，只读取对应层级：

| 阶段示例 | 读取层级 | Token 预算 |
|---------|---------|-----------|
| 信息收集 | L1 | ~200 |
| 深度分析 | L1 + L2 | ~700 |
| 撰写建议 | L1 + L3 | ~500 |
| 人工复核 | L4（读+写） | ~动态 |

相比全量加载（~1500+ tokens），分层读取平均节省 **40-60% 上下文**。

### 6.5 自动经验沉淀

当人工修改 AI 产出时，系统可自动（或提示）追加到 L4：

```
AI 生成："本季度营收增长 30%"
人工修改为："本季度营收同比增长 30%，环比增长 15%"
→ L4 自动追加：[2026-03-03] 营收数据需同时标注同比和环比
```

---

## 7. 现有系统增强

### 7.1 任务系统增强

```typescript
// tasks 表新增字段
{
  sopTemplateId?: string;        // 关联 SOP 模板（null=普通任务）
  currentStageId?: string;       // 当前阶段 ID
  stageHistory: StageRecord[];   // 各阶段执行记录 (JSON)
  sopInputs?: Record<string, unknown>; // 用户在 input 阶段提供的数据 (JSON)
}

interface StageRecord {
  stageId: string;
  status: 'pending' | 'active' | 'waiting_input' | 'waiting_confirm' | 'completed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: string;               // 阶段产出（文本/文档 ID/文件路径）
  confirmedBy?: string;          // 确认者 memberId
  retryCount?: number;
}
```

**UI 变化**：
- 创建任务时可选 SOP 模板
- 任务卡片显示 SOP 阶段进度条
- TaskDrawer 新增"SOP 进度"面板，展示各阶段状态

### 7.2 Wiki 系统增强

```typescript
// documents 表新增字段
{
  renderMode: 'markdown' | 'visual';  // 默认 'markdown'
  renderTemplateId?: string;          // 关联渲染模板
  htmlContent?: string;               // HTML 内容（visual 模式下存储）
  slotData?: Record<string, unknown>; // 槽位数据快照 (JSON)
}
```

**UI 变化**：
- 文档顶部新增"渲染模式"切换
- `visual` 模式下展示双栏编辑器 + 属性面板
- 导出按钮（JPG/HTML）

### 7.3 交付系统增强

- 导出物（JPG/HTML）自动创建 delivery 记录
- delivery 关联 SOP 的 review 阶段
- 审核通过后自动推进 SOP

### 7.4 AI 推送系统增强

现有 `task-push.md` 是通用模板，升级为 SOP 感知：

```
普通任务：继续使用 task-push.md（不变）
SOP 任务：使用新的 sop-task-push.md，注入：
  - 当前阶段信息和专属 prompt
  - 前序阶段产出（作为上下文）
  - 该阶段对应的知识库层级内容
  - 阶段推进 MCP 工具说明
```

---

## 8. OpenClaw Gateway 融合点

### 8.1 能力映射

| v0.9.8 功能 | OpenClaw Gateway 能力 | 融合方式 |
|----------|---------------------|---------|
| SOP AI 执行 | `chat.send` | SOP 阶段 prompt 通过 chat.send 推送给 Agent |
| 工具权限匹配 | `skills.status` + Tool Policy | 推送前检查 Agent 是否具备 SOP 所需工具 |
| 阶段交互确认 | 对话信道 Actions | 扩展 `advance_sop_stage`、`request_sop_confirm` |
| 知识库存储 | Agent Files (`agents.files`) | SOP 的 know-how 文档可同步到 Agent workspace |
| 定时 SOP | `cron.add` | Cron 触发时自动选 SOP 模板、注入上下文、开始执行 |
| 阶段产出存档 | MCP `create_document` | 每个阶段输出自动保存为 Wiki 文档 |
| 经验沉淀 | MCP `update_document` | AI 执行后自动追加到 know-how L4 |
| SOP 推送 | `chat.send` + 三通道架构 | 复用已有三通道（对话信道 + MCP + MD 同步） |

### 8.2 双模式兼容

所有 SOP 功能在 `server_proxy` 和 `browser_direct` 模式下均可用：
- `server_proxy`：SOP 推送由服务端自动处理，浏览器关闭不影响
- `browser_direct`：SOP 推送需浏览器在线（与 REQ-005 的限制一致）

### 8.3 Agent 能力匹配

创建 SOP 任务时，系统检查 Agent 的工具权限：

```typescript
// SOP 要求 web_search + exec
const sopTools = ['web_search', 'exec'];
// Agent 的 Tool Policy
const agentPolicy = await gateway.skills.status();
// 匹配检查
const missing = sopTools.filter(t => !agentHasTool(agentPolicy, t));
if (missing.length > 0) {
  // 提示: "该 Agent 缺少工具: web_search，SOP 可能无法正常执行"
}
```

---

## 9. 数据库 Schema 变更

### 9.1 新增表

```sql
-- SOP 模板表
CREATE TABLE sop_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  icon TEXT DEFAULT 'clipboard-list',
  status TEXT NOT NULL DEFAULT 'active',        -- 'draft' | 'active' | 'archived' (AI 创建时初始为 draft)
  stages TEXT NOT NULL DEFAULT '[]',            -- JSON: SOPStage[]
  required_tools TEXT DEFAULT '[]',             -- JSON: string[]
  system_prompt TEXT DEFAULT '',
  knowledge_config TEXT,                        -- JSON: KnowledgeConfig | null
  output_config TEXT,                           -- JSON: OutputConfig | null
  quality_checklist TEXT DEFAULT '[]',          -- JSON: string[]
  is_builtin INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,                              -- FK → projects.id (null=全局)
  created_by TEXT NOT NULL DEFAULT 'system',    -- memberId（可以是人或 AI Agent）
  created_at INTEGER NOT NULL,                  -- timestamp
  updated_at INTEGER NOT NULL                   -- timestamp
);

-- 渲染模板表
CREATE TABLE render_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'active',        -- 'draft' | 'active' | 'archived' (AI 创建时初始为 draft)
  html_template TEXT NOT NULL DEFAULT '',
  md_template TEXT NOT NULL DEFAULT '',
  css_template TEXT DEFAULT '',
  slots TEXT NOT NULL DEFAULT '{}',             -- JSON: Record<string, SlotDef>
  sections TEXT NOT NULL DEFAULT '[]',          -- JSON: SectionDef[]
  export_config TEXT NOT NULL DEFAULT '{}',     -- JSON: ExportPreset
  thumbnail TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',    -- memberId（可以是人或 AI Agent）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 9.2 扩展现有表

```sql
-- tasks 表新增字段
ALTER TABLE tasks ADD COLUMN sop_template_id TEXT;
ALTER TABLE tasks ADD COLUMN current_stage_id TEXT;
ALTER TABLE tasks ADD COLUMN stage_history TEXT DEFAULT '[]';    -- JSON
ALTER TABLE tasks ADD COLUMN sop_inputs TEXT;                    -- JSON

-- documents 表新增字段
ALTER TABLE documents ADD COLUMN render_mode TEXT DEFAULT 'markdown';
ALTER TABLE documents ADD COLUMN render_template_id TEXT;
ALTER TABLE documents ADD COLUMN html_content TEXT;
ALTER TABLE documents ADD COLUMN slot_data TEXT;                 -- JSON
```

### 9.3 Phase E 新增表（多用户 + 审计）

```sql
-- 用户表（Phase E）
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'member',         -- 'admin' | 'member' | 'viewer'
  team_id TEXT,                                -- 预留团队空间
  password_hash TEXT NOT NULL,                 -- argon2id 哈希
  email_verified INTEGER NOT NULL DEFAULT 0,   -- 0=未验证, 1=已验证
  preferences TEXT DEFAULT '{}',               -- JSON: { language, theme, ... }
  last_login_at INTEGER,                       -- timestamp
  locked_until INTEGER,                        -- 登录锁定截止时间（限流）
  created_at INTEGER NOT NULL,                 -- timestamp
  updated_at INTEGER NOT NULL                  -- timestamp
);

-- 用户 MCP Token 表（Phase E，§13.5 COWORK 外部认证）
CREATE TABLE user_mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                    -- SHA-256 哈希（快速查找）
  encrypted_token TEXT NOT NULL,               -- AES-256-GCM 加密存储
  name TEXT NOT NULL DEFAULT '',               -- Token 备注名
  permissions TEXT DEFAULT '[]',               -- JSON: string[]（MCP 工具白名单）
  last_used_at INTEGER,                        -- timestamp
  expires_at INTEGER,                          -- timestamp（null=永不过期）
  created_at INTEGER NOT NULL                  -- timestamp
);
CREATE INDEX idx_user_mcp_tokens_hash ON user_mcp_tokens(token_hash);
CREATE INDEX idx_user_mcp_tokens_user ON user_mcp_tokens(user_id);

-- SOP 阶段执行记录表（§16.1.1 性能优化，从 tasks.stage_history JSON 拆出）
CREATE TABLE sop_stage_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending' | 'running' | 'completed' | 'skipped' | 'failed'
  output TEXT,                                  -- 阶段产出内容
  output_type TEXT DEFAULT 'text',              -- 'text' | 'html' | 'image' | 'video'
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sop_stage_records_task ON sop_stage_records(task_id);

-- 操作日志表（§13.5.1 审计系统）
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,                         -- 'create' | 'update' | 'delete' | 'login' | 'export' | ...
  resource_type TEXT NOT NULL,                  -- 'task' | 'document' | 'sop_template' | ...
  resource_id TEXT,
  details TEXT,                                 -- JSON: 变更摘要
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
```

### 9.4 与现有 19 张表的关系

**最终 Schema 总览（24 张表）**：

| # | 表名 | 来源 | 说明 |
|---|------|------|------|
| 1-19 | （现有 19 张表） | v0.x | members, tasks, projects, documents, milestones, annotations, ... |
| 20 | `sop_templates` | §9.1 新增 | SOP 模板 |
| 21 | `render_templates` | §9.1 新增 | 渲染模板 |
| 22 | `users` | §9.3 Phase E | 用户认证 |
| 23 | `user_mcp_tokens` | §9.3 Phase E | COWORK MCP Token |
| 24 | `sop_stage_records` | §9.3 §16.1.1 | SOP 阶段执行记录 |
| 25 | `activity_logs` | §9.3 §13.5.1 | 操作审计日志 |

> **总计 25 张表**（19 现有 + 2 Phase A 新增 + 4 Phase E 新增）。

> **注意**：现有代码中 `db/schema.ts` 定义了 19 张表，`core/mcp/definitions.ts` 定义了 30 个 MCP 工具（其中 executor.ts 有 24 个业务 case + 1 default）。v0.9.8 新增 9 个工具后将达到 **39 个 MCP 工具**。

### 9.5 数据迁移方案（v0.3.9 → v0.9.8）

v0.9.8 采用**增量迁移**策略，所有新字段均为可选（nullable），无需破坏性变更。

#### Phase A 迁移（v0.4.6）

| 操作 | 说明 | 风险 |
|------|------|------|
| `ALTER TABLE tasks ADD COLUMN sop_template_id/current_stage_id/...` | 4 个新字段，默认 NULL | 无风险，现有数据不受影响 |
| `ALTER TABLE documents ADD COLUMN render_mode/render_template_id/...` | 4 个新字段，默认 'markdown'/NULL | 无风险，现有文档默认为 markdown 模式 |
| `CREATE TABLE sop_templates/render_templates` | 2 张新表 | 无风险，空表 |
| 内置数据 seed | 插入 5 个 SOP 模板 + 4 个渲染模板（`is_builtin=1`） | 幂等，按 ID 检查 |

#### Phase E 迁移（v0.9.8）

| 操作 | 说明 | 风险 |
|------|------|------|
| `CREATE TABLE users` | 新表 | 无风险 |
| **现有 `member-default` → `users` 表映射** | 创建默认 admin 用户（`email: admin@localhost`），将 `member-default` 的数据关联到新用户 | **中风险**，需脚本处理 |
| 所有现有记录的 `created_by` 回填 | `tasks.assignee_id` 等字段如引用 memberId，需兼容 userId | **中风险**，需双 ID 兼容期 |
| `CREATE TABLE user_mcp_tokens/sop_stage_records/activity_logs` | 3 张新表 | 无风险 |
| SQLite → PostgreSQL 可选迁移 | Drizzle 多驱动统一 Schema | 提供 `scripts/migrate-to-pg.ts` 脚本 |

#### 迁移脚本清单

```
scripts/
├── migrate-v0.4.6.ts        # Phase A：ALTER TABLE + CREATE TABLE + seed
├── migrate-v0.9.8.ts        # Phase E：users 表 + 数据映射 + 回填
├── migrate-to-pg.ts       # Phase E 可选：SQLite → PostgreSQL 一键迁移
└── backup-db.ts           # 迁移前自动备份 data/teamclaw.db
```

**迁移原则**：
- 所有迁移脚本**幂等设计**：重复执行不报错
- 迁移前**自动备份**数据库
- Phase A 和 Phase E 的迁移可独立执行
- 迁移脚本在 `db/index.ts` 启动时自动检测并执行（检查表/字段是否已存在）

关联关系：
```
sop_templates.project_id → projects.id
sop_templates.knowledge_config.documentId → documents.id
sop_templates.output_config.renderTemplateId → render_templates.id
tasks.sop_template_id → sop_templates.id
documents.render_template_id → render_templates.id
```

---

## 10. MCP 工具扩展

### 10.1 新增 MCP 工具（9 个）

> **现有工具**：30 个（`core/mcp/definitions.ts`）。新增 9 个后总计 **39 个**。

#### SOP 执行类（5 个）

| 工具名 | 用途 | 参数 |
|--------|------|------|
| `advance_sop_stage` | AI 完成当前阶段，推进到下一阶段 | `task_id`, `stage_output?` |
| `request_sop_confirm` | AI 请求人工确认当前阶段产出 | `task_id`, `confirm_message`, `stage_output` |
| `get_sop_context` | AI 获取当前 SOP 上下文 | `task_id`（返回阶段信息 + 知识库 + 前序产出） |
| `save_stage_output` | AI 保存当前阶段产出（不推进） | `task_id`, `output`, `output_type?` |
| `update_knowledge` | AI 追加经验到 know-how 知识库 L4 | `document_id`, `content` |

#### AI 自主创作类（4 个，新增）

| 工具名 | 用途 | 参数 |
|--------|------|------|
| `create_sop_template` | AI 自主创建 SOP 模板 | `name`, `description`, `category`, `stages[]`, `system_prompt?`, `required_tools[]?`, `quality_checklist[]?`, `project_id?` |
| `update_sop_template` | AI 优化/修改已有 SOP 模板 | `template_id`, `stages?`, `system_prompt?`, `quality_checklist?`, ... |
| `create_render_template` | AI 自主编写 HTML 渲染模板 | `name`, `description`, `category`, `html_template`, `css_template?`, `md_template`, `slots`, `sections?`, `export_config` |
| `update_render_template` | AI 优化/修改已有渲染模板 | `template_id`, `html_template?`, `css_template?`, `slots?`, ... |

#### AI 创作类工具的安全约束

- **创建后需确认**：AI 调用 `create_sop_template` / `create_render_template` 后，模板状态为 `draft`，需用户在 UI 中确认后才变为 `active`
- **渲染模板 HTML 校验**：`create_render_template` 的 `html_template` 参数会经过服务端校验：
  - 必须包含至少一个 `data-slot` 属性
  - 禁止 `<script>` 标签（安全）
  - 禁止外部资源引用（`<link href="http...">`）
  - CSS 自包含检查
  - **服务端清洗**：使用 DOMPurify（或 sanitize-html）白名单模式
    - 允许标签：div/span/p/h1-6/img/table/thead/tbody/tr/td/th/ul/ol/li/a/section/header/footer/style/svg
    - 禁止属性：onclick/onerror/onload 等所有事件处理器
    - CSS 禁止：`url()`、`@import`、`expression()` 等可执行代码
    - 图片 `src` 只允许 `data:` 和 `/api/assets/` 前缀
- **SOP 模板阶段校验**：`create_sop_template` 的 `stages` 参数校验：
  - 至少包含 1 个阶段
  - 每个阶段必须有 `id`、`label`、`type`
  - `type` 必须是合法的 StageType 枚举值

#### 完整场景示例：AI 从零创建 SOP + 渲染模板

```
用户: "我需要一个产品发布公告的 SOP，最终输出一个好看的发布图"

AI 执行链:
  1. 调用 create_render_template → 创建"产品发布公告"渲染模板（HTML+CSS+slots）
  2. 调用 create_sop_template → 创建 SOP，stages 包含:
     ① 产品信息收集(input)
     ② 亮点提炼(ai_auto)
     ③ 文案撰写(ai_with_confirm)
     ④ 可视化编辑(render, renderTemplateId=步骤1创建的模板)
     ⑤ 导出发布图(export)
  3. 用户确认两个模板
  4. 后续每次发布新产品 → 选择此 SOP → 一键走完流程
```

### 10.2 对话信道 Actions 同步扩展

以上 9 个工具同时注册为对话信道 Actions，保持三通道一致。

### 10.3 现有工具增强

| 工具 | 增强内容 |
|------|---------|
| `create_task` | 新增 `sop_template_id` 参数 |
| `update_task_status` | SOP 任务状态变更时自动处理阶段推进 |
| `create_document` | 新增 `render_mode`, `render_template_id` 参数 |
| `deliver_document` | SOP review 阶段自动关联 |

### 10.4 AI 创作 Skill 定义

为支持 AI 自主创建模板，在 `skills/teamclaw/SKILL.md` 中新增对应能力说明，让 Agent 知道何时以及如何使用这些工具：

```markdown
## SOP 模板管理

当用户描述一个业务流程、工作场景或重复性任务时，你可以使用 `create_sop_template` 
为其创建 SOP 模板。设计阶段时遵循以下原则：
- 需要用户提供信息的步骤 → type: input
- AI 可独立完成的步骤 → type: ai_auto
- 需要用户确认方向的关键决策点 → type: ai_with_confirm
- 涉及可视化内容产出的步骤 → type: render
- 需要人工审核的最终步骤 → type: review

## HTML 渲染模板

当用户需要可视化输出（图片、网页、海报、报告）时，你可以使用 `create_render_template`
生成 HTML+CSS 模板。模板必须：
- 使用 data-slot 属性标记可编辑区域
- 使用 data-section 属性划分内容区块
- CSS 必须内联或 <style> 标签，不引用外部资源
- 不包含 <script> 标签
```

### 10.5 推送模板新增

| 模板 | 用途 |
|------|------|
| `sop-task-push.md` | SOP 任务阶段推送（替代通用 task-push） |
| `sop-confirm-request.md` | AI 请求确认的消息格式 |
| `sop-stage-result.md` | 阶段完成结果通知 |

---

## 11. 页面/路由变更

| 路由 | 类型 | 说明 |
|------|------|------|
| `/sop` | **新增** | SOP 模板管理页面（列表 + CRUD + 预览） |
| `/sop/[id]/edit` | **新增** | SOP 模板编辑器（阶段可视化配置） |
| `/wiki` | **增强** | 文档关联渲染模板时激活 Content Studio 双栏模式 |
| `/tasks` | **增强** | 创建任务时可选 SOP；卡片显示阶段进度 |
| `/settings` | **增强** | 新增"渲染模板管理"Tab（或内嵌于 SOP 管理） |

### Sidebar 导航新增

```
现有导航:
  Dashboard, Tasks, Projects, Wiki, Agents, Sessions,
  Skills, Schedule, Deliveries, Members, Settings

新增:
  + SOP（在 Tasks 和 Projects 之间）
```

---

## 12. 内置内容策略

### 12.1 原则

TeamClaw 对外发布，内置内容必须是**通用的**，不包含任何特定业务场景。

**但用户无需手动配置**——可以直接对 AI 说需求，AI 自动生成场景 SOP 和渲染模板。

```
内置通用模板（开箱即用）
  + 用户手动创建（高级定制）
  + AI 自主生成（对话式创建）  ← 核心体验
```

### 12.2 内置 SOP 模板（5 个通用模板）

| SOP | 分类 | 阶段 | 价值 |
|-----|------|------|------|
| **调研报告** | research | ① 确定主题(input) → ② 信息收集(ai_auto, web_search) → ③ 整理分析(ai_auto) → ④ 大纲确认(ai_with_confirm) → ⑤ 撰写报告(ai_auto) → ⑥ 审核(review) | 通用调研，展示 web_search 整合 |
| **内容创作** | content | ① 需求确认(input) → ② 素材收集(ai_auto) → ③ 大纲确认(ai_with_confirm) → ④ 初稿撰写(ai_auto) → ⑤ 可视化编辑(render) → ⑥ 导出(export) | 端到端内容生产，展示 Content Studio |
| **周报生成** | operations | ① 收集本周任务(ai_auto, 读 TeamClaw 任务数据) → ② 生成摘要(ai_auto) → ③ 确认亮点(ai_with_confirm) → ④ 输出文档(ai_auto) | 结合 Cron 定时，展示 TeamClaw 数据联动 |
| **代码审查** | development | ① 获取变更(input, 粘贴 diff) → ② 代码分析(ai_auto) → ③ 问题标注(ai_auto) → ④ 建议确认(ai_with_confirm) → ⑤ 输出报告(ai_auto) | 开发者场景 |
| **会议纪要** | operations | ① 输入笔记(input) → ② 提取要点(ai_auto) → ③ 整理 TODO(ai_auto) → ④ 确认(ai_with_confirm) → ⑤ 分配任务(ai_auto, create_task) → ⑥ 输出文档(ai_auto) | 展示任务自动创建 |

### 12.3 AI 自主创建场景 SOP（核心能力）

内置模板只是起点。**任何业务场景的 SOP 都可以由 AI 通过对话生成**：

```
用户只需说：                         AI 自动完成：
──────────────────────────────────────────────────────────
"帮我建一个客户回访 SOP"            → 分析需求 → 设计阶段流程 → 生成模板
"做一个投标方案制作的工作流"         → 拆解步骤 → 配置 AI 指令 → 生成模板
"我们部门每月要出运营报告"           → 理解周期 → 设计数据收集+分析+输出阶段
"帮我优化这个 SOP，第3步总是要改"    → 分析执行历史 → 调整阶段类型/指令
```

**这意味着**：
- TeamClaw 不需要为每个行业/场景预置 SOP——AI 可以按需生成
- 用户不需要理解 SOP 配置的技术细节——用自然语言描述即可
- SOP 模板可以**持续进化**——AI 根据执行经验自动建议优化

**AI 创建 SOP 的流程**：
1. 用户在聊天中描述业务场景
2. AI 分析需求，设计阶段流程
3. AI 调用 `create_sop_template` 生成模板（状态: `draft`）
4. 系统在聊天中展示 SOP 预览（阶段列表 + 流程图）
5. 用户确认/修改 → 模板状态变为 `active`
6. 后续可绑定到任务反复使用

### 12.4 AI 自主编写 HTML 渲染模板（核心能力）

同理，渲染模板也不仅限于内置的 4 个——**AI 可以根据需求编写任意 HTML/CSS 模板**：

```
用户只需说：                              AI 自动完成：
──────────────────────────────────────────────────────────
"帮我做一个深色科技风的报告模板"           → 设计 HTML 骨架 + CSS + 定义 slots
"需要一个竖版的产品对比长图"               → 生成响应式长图模板 + 数据槽位
"这个模板的标题字体太小了，配色改成蓝色"    → 修改 CSS 样式，保持结构不变
"参考这种风格做一个类似的"（附截图/链接）   → 分析风格 → 生成匹配的 HTML+CSS
```

**AI 编写 HTML 的能力边界**：

| 能力 | 支持度 | 说明 |
|------|--------|------|
| 纯 CSS 样式设计 | ✅ 完全支持 | 布局、配色、字体、动画、渐变等 |
| 响应式布局 | ✅ 完全支持 | flexbox, grid, 媒体查询 |
| SVG 图形 | ✅ 支持 | 内联 SVG 图表、装饰元素 |
| 数据可视化 | ⚠️ 基础支持 | 纯 CSS/SVG 实现的图表（柱状图、饼图、进度条） |
| 外部图片 | ⚠️ 占位模式 | AI 生成占位符，用户在 Content Studio 中替换实际图片 |
| JavaScript 交互 | ❌ 不支持 | 安全限制，`<script>` 标签被过滤 |
| 外部 CDN 引用 | ❌ 不支持 | 样式必须自包含，确保导出完整 |

### 12.5 内置渲染模板（4 个）

| 模板 | 分类 | 尺寸 | 用途 |
|------|------|------|------|
| **基础报告** | report | A4 (210×297mm) | 标准文档报告 |
| **演示卡片** | presentation | 16:9 (1920×1080) | 横版展示图 |
| **信息长图** | card | 自定义宽度×自适应高度 | 竖版信息长图 |
| **社交卡片** | card | 1200×630 | 社交媒体分享图 |

### 12.6 内置 Know-how 文档模板（1 篇空白骨架）

用户创建 SOP 时可选择关联一篇 Know-how 文档，系统提供分层骨架自动生成。

### 12.7 AI 创作生态总结

```
                    ┌─────────────────────────────────────┐
                    │         用户的自然语言需求            │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │          OpenClaw Agent              │
                    │                                     │
                    │  理解需求 → 设计方案 → 生成模板       │
                    └──────┬────────────────┬─────────────┘
                           │                │
              ┌────────────▼───┐   ┌────────▼──────────┐
              │  SOP 模板       │   │  HTML 渲染模板     │
              │  create_sop_   │   │  create_render_   │
              │  template      │   │  template         │
              └────────┬───────┘   └────────┬──────────┘
                       │                    │
                       ▼                    ▼
              ┌────────────────────────────────────────┐
              │          用户确认 / 预览修改             │
              └────────────────┬───────────────────────┘
                               │
              ┌────────────────▼───────────────────────┐
              │       绑定任务 → 反复使用 → 持续优化     │
              │  (AI 根据执行经验 update_*_template)    │
              └────────────────────────────────────────┘
```

---

## 13. 实施路线图

### Phase A: v0.4.6 — 基础设施（≈2-3 周）

**前提**：先完成 REQ-005（任务自动推送），为 SOP 推送打基础。

| 编号 | 任务 | 依赖 |
|------|------|------|
| A0 | `package.json` 更新：name `teamclaw-v2`→`teamclaw`，`private: true`，版本号递进 | - |
| A1 | DB Schema 扩展（2 新表 + tasks/documents 扩展字段） | - |
| A2 | SOP 模板 CRUD API（`/api/sop-templates`） + Store | A1 |
| A3 | 渲染模板 CRUD API（`/api/render-templates`） + Store | A1 |
| A4 | MCP 工具扩展（9 个新工具：5 个 SOP 执行类 + 4 个 AI 创作类） | A2 |
| A5 | 对话信道 Actions 扩展（9 个新 action） | A4 |
| A6 | 推送模板新增（`sop-task-push.md` 等 3 个） | A2 |

**里程碑**：数据层完备，API 可调用，AI 可通过 MCP 操作 SOP。

### Phase B: v0.5.4 — SOP 引擎核心（≈2-3 周）

| 编号 | 任务 | 依赖 |
|------|------|------|
| B1 | SOP 管理页面（`/sop`，列表 + 创建/编辑） | A2 |
| B2 | SOP 模板编辑器（阶段可视化配置，拖拽排序） | B1 |
| B3 | 任务创建流程集成 SOP 选择 | A2 |
| B4 | 任务卡片 SOP 进度展示 | A1 |
| B5 | 阶段推进逻辑（AI advance + 人工确认 + 自动推进） | A4, A5 |
| B6 | SOP 推送集成（SOP 任务用 sop-task-push 模板） | A6, REQ-005 |

**里程碑**：完整 SOP 闭环可用——创建 SOP 模板 → 绑定任务 → AI 分阶段执行 → 人工确认。

### Phase C: v0.6.2 — Content Studio（≈2-3 周）

| 编号 | 任务 | 依赖 |
|------|------|------|
| C1 | `useSlotSync` hook（TS 移植 GrowthPilot useSync） | - |
| C2 | `HtmlPreview` 组件（iframe + 选中 + 编辑） | C1 |
| C3 | `PropertyPanel`（样式/图片编辑面板） | C2 |
| C4 | Wiki 页面增强（双栏模式切换，render_mode） | C1, C2, C3 |
| C5 | `ExportModal`（JPG/PNG/HTML 导出，多倍率） | C2 |
| C6 | SOP render 阶段 → Content Studio 联动 | C4, B5 |

**里程碑**：Wiki 支持可视化编辑模式，SOP 的 render 阶段可进入 Content Studio。

### Phase D: v0.7.0 — Know-how + 打磨（≈1-2 周）

| 编号 | 任务 | 依赖 |
|------|------|------|
| D1 | Know-how 文档分层格式约定 + 解析工具函数 | - |
| D2 | SOP 执行时自动读取知识库（按阶段+层级） | D1, B5 |
| D3 | 人工修正后自动追加到 L4 | D1 |
| D4 | 内置 SOP 模板 5 个 + 渲染模板 4 个 | B2, C4 |
| D5 | SOP 模板导入/导出（JSON 格式，便于分享） | B2 |
| D6 | i18n 全量翻译 + 文档更新 | 全部 |

**里程碑**：功能完整，内置模板就绪，可对外发布。

### Phase E: v0.9.8 — 多用户 + 在线数据库 + 高级特性（≈3-4 周）

| 编号 | 任务 | 依赖 |
|------|------|------|
| E1 | **多用户管理**：用户注册/登录、角色权限（admin/member/viewer）、团队空间 | A1 |
| E2 | **在线数据库对接**：PostgreSQL/MySQL 适配层，SQLite 降级兼容，Drizzle 多驱动 | A1 |
| E3 | Cron + SOP 定时自动触发（如"每周五生成周报"） | B5, Gateway cron |
| E4 | SOP 执行统计/分析面板（融合 TD-009） | B5 |
| E5 | 渲染模板可视化编辑器（高级，可选） | C4 |
| E6 | SOP 模板市场（社区分享，可选） | D5 |

**里程碑**：v0.9.8 正式版——完整的 AI 工作流引擎 + 多用户 + 在线数据库。

### 总时间线

> **注意**：以下为乐观预估。建议每个 Phase 预留 20% buffer，实际总工期约 **13-19 周**。

```
         REQ-005        Phase A     Phase B     Phase C     Phase D     Phase E
         (1周)          (2-3周)     (2-3周)     (2-3周)     (1-2周)     (3-4周)
───┬──────────┬──────────────┬───────────┬───────────┬─────────┬───────────┬───
   │          │              │           │           │         │           │
   v0.3.9    v0.3.9.1       v0.4.6        v0.5.4       v0.6.2      v0.7.0       v0.9.8
   (当前)   (自动推送)   (SOP基础)  (SOP核心)  (Studio)  (Know-how) (多用户+DB+完整版)

                                                     REQ-006（甘特图）可在任意阶段并行

────── v0.9.8 发布后 ──────────────────────────────────────────────────

         Phase F          Phase G          Phase H
         (3-4周)          (4-6周)          (持续)
───┬───────────┬──────────────┬──────────────┬───
   │           │              │              │
   v3.1       v3.2           v3.3          v3.x
  (图片创作) (视频创作)    (数据可视化)   (插件市场)
```

---

## 13.5 v0.9.8 多用户管理详细规划

### 用户体系

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  teamId?: string;           // 所属团队
  preferences: UserPrefs;    // 语言、主题等
  createdAt: Date;
}

type UserRole =
  | 'admin'      // 管理员：全部权限
  | 'member'     // 成员：CRUD 任务/文档/SOP，不能管理用户
  | 'viewer';    // 访客：只读
```

### 权限矩阵

| 操作 | admin | member | viewer |
|------|-------|--------|--------|
| 管理用户 | ✅ | ❌ | ❌ |
| 管理 SOP 模板 | ✅ | ✅ | ❌ |
| 创建/编辑任务 | ✅ | ✅ | ❌ |
| 管理渲染模板 | ✅ | ✅ | ❌ |
| 查看任务/文档 | ✅ | ✅ | ✅ |
| Gateway 配置 | ✅ | ❌ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ |
| 创建/吊销自己的 MCP Token | ✅ | ✅ | ❌ |
| 查看/吊销全团队 MCP Token | ✅ | ❌ | ❌ |
| 通过 MCP Token 执行写操作 | ✅ | ✅ | ❌ |
| 通过 MCP Token 执行只读操作 | ✅ | ✅ | ✅ |

### 认证方案

- **v0.9.8 首发**：邮箱+密码 + Session Cookie（NextAuth.js）
- **v3.x+**：OAuth 2.0（GitHub/Google）、API Key 认证、SSO

#### 认证安全要点

- 密码哈希：bcrypt（cost factor ≥ 12）或 argon2id
- Session Cookie: `HTTPOnly` + `Secure` + `SameSite=Strict`
- 登录限流：同一 IP/账号 5 分钟内最多 5 次失败尝试，之后锁定 15 分钟
- 密码重置：一次性 token + 15 分钟有效期 + 邮件验证
- CSRF Token：NextAuth 内置，所有 mutating 请求自动校验

#### COWORK 外部 MCP Token 认证（P0）

COWORK 是用户端使用的 AI 协作工具，通过 MCP 协议与 TeamClaw 通信。多用户场景下，每个用户需要**独立的 MCP Token**，用于在 COWORK 中配置 MCP Server 连接。

**双通道认证架构**：

```
┌──────────────────────────────────────────────────────────────────┐
│                    MCP 双通道认证                                 │
│                                                                  │
│  通道 1：浏览器内部调用                                            │
│  ┌──────────┐   Session Cookie   ┌──────────────┐               │
│  │ TeamClaw   │ ──────────────────▶│ /api/mcp     │               │
│  │ 前端     │   (NextAuth)       │ (内部端点)    │               │
│  └──────────┘                    └──────────────┘               │
│                                                                  │
│  通道 2：COWORK 外部调用                                          │
│  ┌──────────┐   Bearer Token     ┌──────────────────────┐       │
│  │ COWORK   │ ──────────────────▶│ /api/mcp/external    │       │
│  │ (用户端)  │   (用户个人 Token) │ (外部端点)            │       │
│  └──────────┘                    └──────────────────────┘       │
│                                                                  │
│  两个通道最终都注入 userId → MCP 执行上下文 → 审计日志              │
└──────────────────────────────────────────────────────────────────┘
```

**Token 管理设计**：

```typescript
// 新增独立的 user_mcp_tokens 表（替代现有 members.openclawApiToken 方案）
interface UserMcpToken {
  id: string;             // 主键
  userId: string;         // 所属用户（FK → users.id）
  tokenHash: string;      // SHA-256 哈希（用于快速查找，替代全表扫描+逐行解密）
  encryptedToken: string; // AES-256-GCM 加密存储（用于审计回溯）
  name: string;           // Token 备注名（如"我的 COWORK"、"办公室 Mac"）
  permissions: string[];  // 允许的 MCP 工具白名单（空 = 继承 UserRole 权限）
  lastUsedAt?: Date;      // 最后使用时间
  expiresAt?: Date;       // 过期时间（可选，null = 永不过期）
  createdAt: Date;
}
```

**与现有 AI 成员 Token 的区别**：

| 维度 | 现有 AI 成员 Token | 新 COWORK 用户 Token |
|------|-------------------|---------------------|
| 所属实体 | AI Member（`members.openclawApiToken`） | 人类 User（`user_mcp_tokens.userId`） |
| 用途 | AI Agent 自动调用 TeamClaw | 用户在 COWORK 中操作 TeamClaw |
| 认证方式 | 全表扫描 + 逐行解密（O(N)） | tokenHash 索引直查（O(1)） |
| Token 格式 | `cmk_<base58>` | `cmu_<base58>`（u = user，区分前缀） |
| 权限模型 | executionMode（chat_only/api_first/api_only） | UserRole + 可选工具白名单 |
| 多 Token | 一个 Member 一个 Token | 一个 User 可有多个 Token（不同设备/场景） |
| 吊销 | 删除/重新生成 | 独立吊销，不影响其他 Token |

**COWORK 配置流程**（用户视角）：

1. 用户在 TeamClaw 设置页面 → "MCP Token 管理" → "创建新 Token"
2. 填写备注名（如"COWORK 办公"），可选设置过期时间和工具白名单
3. 系统生成 `cmu_<base58>` 格式 Token，**仅显示一次**
4. 用户复制 Token，在 COWORK 中配置 MCP Server：
   ```json
   {
     "mcpServers": {
       "teamclaw": {
         "url": "https://your-teamclaw.example.com/api/mcp/external",
         "headers": {
           "Authorization": "Bearer cmu_xxxxxxxxxxxx"
         }
       }
     }
   }
   ```
5. COWORK 通过该 Token 调用 TeamClaw MCP 工具，所有操作归属到该用户

**安全约束**：

- Token 创建后明文**仅显示一次**，之后只能查看 tokenHash 前 8 位用于辨识
- 支持**即时吊销**：管理员可吊销任意用户 Token，用户可吊销自己的 Token
- Token 有**使用频率限流**：每 Token 独立限流（STANDARD: 60/min），而非按 IP
- 审计日志关联 userId + tokenId，可追溯到具体 Token
- admin 可查看全团队 Token 列表（脱敏），member 只能管理自己的
- 闲置 Token（90 天未使用）自动标记为 inactive，需要用户重新激活

### 向后兼容

- 现有单用户场景：自动创建 admin 账户，无缝升级
- `member-default`（v2 默认用户）映射为 admin
- `createdBy` 字段从 memberId 扩展为 userId

---

## 13.5.1 多维度操作日志系统

> **背景**：多用户场景下，需要完整记录所有成员的操作行为，支持按模块、按成员、按操作来源多维度查询。现有 `audit_logs` 表仅覆盖 MCP 工具调用（且仅 2 个路由写入），不覆盖 UI 操作，字段设计也不支持模块/资源维度的筛选。

### 现状与差距

| 维度 | 现有 `audit_logs` | v0.9.8 需求 |
|------|-------------------|-----------|
| 覆盖范围 | 仅 MCP 工具调用（`/api/mcp` + `/api/mcp/external`） | **所有 CRUD 操作**（UI + MCP + 系统自动） |
| 操作来源 | `mcp` / `mcp_external` / `chat_channel` / `gateway` / `system` | 新增 `web_ui`（浏览器操作）、`cowork`（COWORK MCP Token 调用） |
| 模块归属 | 无（仅按 action/工具名区分） | 按业务模块分类：project / task / wiki / delivery / content_studio / sop / member / settings |
| 资源定位 | 无（参数里可能有 ID 但未独立字段） | 独立 `resourceType` + `resourceId` 字段，支持"查看某任务的所有操作" |
| 操作者 | `memberId`（AI 成员）/ `agentId` | `userId`（人类用户） + `memberId`（AI 成员）+ 操作来源 |
| 前端查询 | 无 Store，无页面 | 需要 Store + 多入口查询页面 |

### Schema 设计

```sql
-- 新增：操作日志表（替代并扩展现有 audit_logs 的职责）
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  
  -- 操作者身份（二选一或同时存在）
  user_id TEXT,                              -- 人类用户（FK → users.id）
  member_id TEXT,                            -- AI 成员（FK → members.id）
  
  -- 操作来源
  source TEXT NOT NULL,                      -- web_ui | mcp | mcp_external | cowork | chat_channel | gateway | system | cron
  source_detail TEXT,                        -- 补充来源细节（如 Token 名称、Agent 名称、Cron 任务 ID）
  
  -- 业务模块 + 资源定位
  module TEXT NOT NULL,                      -- project | task | wiki | delivery | content_studio | sop | member | settings | gateway | system
  resource_type TEXT NOT NULL,               -- 细粒度资源类型（见下方枚举）
  resource_id TEXT,                          -- 操作对象的 ID（可选，如系统设置无具体 ID）
  resource_title TEXT,                       -- 操作对象的标题/名称快照（便于展示，无需二次查询）
  
  -- 操作信息
  action TEXT NOT NULL,                      -- create | update | delete | read | execute | export | import | assign | move | archive | restore
  action_detail TEXT,                        -- 操作的具体描述（如"修改了标题"、"推进到阶段3"）
  
  -- 变更内容（仅写操作记录）
  changes TEXT,                              -- JSON: { field: { old: any, new: any } }[]  变更差异
  
  -- 执行结果
  success INTEGER NOT NULL DEFAULT 1,        -- boolean
  error TEXT,                                -- 失败时的错误信息
  
  -- 上下文
  project_id TEXT,                           -- 所属项目（便于按项目筛选，跨模块关联）
  request_id TEXT,                           -- 请求追踪 ID
  ip_address TEXT,                           -- 客户端 IP（脱敏后保留前三段）
  user_agent TEXT,                           -- 客户端标识（截断到 200 字符）
  duration_ms INTEGER,                       -- 操作耗时
  
  -- 时间
  created_at INTEGER NOT NULL                -- timestamp
);

-- 索引设计（按查询维度优化）
CREATE INDEX idx_activity_module ON activity_logs(module, created_at DESC);              -- 模块视角
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at DESC);               -- 成员视角（人类）
CREATE INDEX idx_activity_member ON activity_logs(member_id, created_at DESC);           -- 成员视角（AI）
CREATE INDEX idx_activity_resource ON activity_logs(resource_type, resource_id);          -- 资源视角
CREATE INDEX idx_activity_project ON activity_logs(project_id, created_at DESC);         -- 项目视角
CREATE INDEX idx_activity_source ON activity_logs(source);                                -- 来源视角
CREATE INDEX idx_activity_action ON activity_logs(module, action);                        -- 模块+操作类型
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);                      -- 时间线
```

> **注意**：此表使 v0.9.8 总表数从 23 张变为 **24 张**。

### 资源类型枚举

| module | resource_type | 说明 |
|--------|---------------|------|
| `project` | `project` | 项目 CRUD |
| `task` | `task` | 任务 CRUD |
| `task` | `task_comment` | 任务评论 |
| `task` | `task_checklist` | 任务检查项 |
| `task` | `task_assignment` | 任务分配 |
| `wiki` | `document` | Wiki 文档 CRUD |
| `wiki` | `document_content` | 文档内容编辑 |
| `delivery` | `delivery` | 交付物 CRUD |
| `delivery` | `delivery_review` | 交付物审核 |
| `content_studio` | `render_template` | 渲染模板 CRUD |
| `content_studio` | `content_render` | 内容渲染/导出 |
| `content_studio` | `slot_edit` | 插槽内容编辑 |
| `sop` | `sop_template` | SOP 模板 CRUD |
| `sop` | `sop_execution` | SOP 执行/推进 |
| `sop` | `sop_stage` | SOP 阶段状态变更 |
| `member` | `member` | 成员管理 |
| `member` | `user` | 用户管理 |
| `member` | `mcp_token` | MCP Token 管理 |
| `settings` | `gateway_config` | Gateway 配置 |
| `settings` | `system_config` | 系统设置 |
| `gateway` | `agent` | Agent CRUD（Gateway 侧） |
| `gateway` | `session` | Session 管理 |
| `gateway` | `cron` | 定时任务管理 |

### 操作来源说明

| source | 含义 | 典型场景 |
|--------|------|----------|
| `web_ui` | 用户在 TeamClaw 浏览器界面操作 | 点击按钮创建任务、编辑文档 |
| `mcp` | 内部 MCP 调用（TeamClaw 前端通过 `/api/mcp`） | AI 成员在对话中执行工具 |
| `mcp_external` | 外部 MCP 调用（AI Agent Token） | OpenClaw Agent 通过 `cmk_*` Token 调用 |
| `cowork` | 外部 MCP 调用（用户 COWORK Token） | 用户在 COWORK 通过 `cmu_*` Token 操作 |
| `chat_channel` | 对话信道指令 | 用户在 Chat 中 @ AI 执行操作 |
| `gateway` | Gateway 事件同步 | Agent 注册、Session 创建等 |
| `system` | 系统自动行为 | 定时清理、自动归档 |
| `cron` | 定时任务触发 | Cron 巡检、日报生成 |

### 写入层设计

```typescript
// lib/activity-log.ts — 操作日志写入服务

interface ActivityLogEntry {
  // 操作者（二选一）
  userId?: string;
  memberId?: string;
  
  // 来源
  source: ActivitySource;
  sourceDetail?: string;
  
  // 业务定位
  module: ActivityModule;
  resourceType: string;
  resourceId?: string;
  resourceTitle?: string;
  
  // 操作
  action: ActivityAction;
  actionDetail?: string;
  changes?: FieldChange[];       // { field, old, new }[]
  
  // 上下文
  projectId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

type ActivitySource = 'web_ui' | 'mcp' | 'mcp_external' | 'cowork' | 'chat_channel' | 'gateway' | 'system' | 'cron';
type ActivityModule = 'project' | 'task' | 'wiki' | 'delivery' | 'content_studio' | 'sop' | 'member' | 'settings' | 'gateway' | 'system';
type ActivityAction = 'create' | 'update' | 'delete' | 'read' | 'execute' | 'export' | 'import' | 'assign' | 'move' | 'archive' | 'restore';

interface FieldChange {
  field: string;
  old: unknown;
  new: unknown;
}

// 核心写入函数（异步，不抛异常，不阻塞主流程）
export async function logActivity(entry: ActivityLogEntry): Promise<void>;

// 便捷方法：API Route 层自动注入 source + userId
export function createActivityLogger(source: ActivitySource, userId?: string, memberId?: string) {
  return {
    log: (entry: Omit<ActivityLogEntry, 'source' | 'userId' | 'memberId'>) => 
      logActivity({ ...entry, source, userId, memberId }),
  };
}
```

### 写入时机（埋点方案）

**原则**：在 **API Route 层**统一埋点，而非 Store 层或组件层。

```
┌──────────┐    ┌──────────┐    ┌─────────────────┐    ┌──────────┐
│ 组件/页面  │───▶│ Store    │───▶│ API Route       │───▶│ Database │
│          │    │          │    │ ┌─────────────┐  │    │          │
│          │    │          │    │ │ logActivity │  │    │          │
│          │    │          │    │ │  ← 埋点     │  │    │          │
│          │    │          │    │ └─────────────┘  │    │          │
└──────────┘    └──────────┘    └─────────────────┘    └──────────┘

┌──────────┐                    ┌─────────────────┐
│ COWORK   │──Bearer Token────▶│ /api/mcp/external │──▶ logActivity(source: 'cowork')
└──────────┘                    └─────────────────┘

┌──────────┐                    ┌─────────────────┐
│ AI Agent │──Bearer Token────▶│ /api/mcp/external │──▶ logActivity(source: 'mcp_external')
└──────────┘                    └─────────────────┘
```

**各模块埋点位置**：

| API Route | 记录的操作 | source |
|-----------|-----------|--------|
| `POST /api/tasks` | 创建任务 | `web_ui`（含 userId） |
| `PUT /api/tasks/[id]` | 更新任务（记录 changes 差异） | `web_ui` |
| `DELETE /api/tasks/[id]` | 删除任务 | `web_ui` |
| `POST /api/documents` | 创建文档 | `web_ui` |
| `PUT /api/documents/[id]` | 编辑文档 | `web_ui` |
| `POST /api/projects` | 创建项目 | `web_ui` |
| `/api/mcp` → `create_task` | MCP 创建任务 | `mcp` |
| `/api/mcp/external` → `create_task` | 外部创建任务 | `mcp_external` 或 `cowork`（按 Token 前缀区分） |
| `/api/mcp` → `advance_sop_stage` | SOP 推进 | `mcp` |
| `POST /api/sop-templates` | 创建 SOP 模板 | `web_ui` |
| `POST /api/render-templates` | 创建渲染模板 | `web_ui` |

### 查询 API 设计

```typescript
// GET /api/activity-logs — 多维度查询
interface ActivityLogQuery {
  // 模块视角
  module?: ActivityModule;         // 筛选模块
  resourceType?: string;           // 筛选资源类型
  resourceId?: string;             // 查看某个资源的所有操作
  
  // 成员视角
  userId?: string;                 // 查看某用户的所有操作
  memberId?: string;               // 查看某 AI 成员的所有操作
  
  // 来源视角
  source?: ActivitySource;         // 筛选操作来源
  
  // 操作类型
  action?: ActivityAction;         // 筛选操作类型
  
  // 项目范围
  projectId?: string;              // 限定项目范围
  
  // 时间范围
  startTime?: string;              // ISO 8601
  endTime?: string;
  
  // 搜索
  keyword?: string;                // 模糊搜索 action_detail + resource_title
  
  // 分页
  limit?: number;                  // 默认 50，上限 200
  offset?: number;
}

// 响应格式
interface ActivityLogResponse {
  success: boolean;
  data: {
    logs: ActivityLog[];
    pagination: { total: number; limit: number; offset: number };
    // 聚合统计（可选，用于 Dashboard）
    summary?: {
      totalActions: number;
      byModule: Record<string, number>;
      bySource: Record<string, number>;
      byAction: Record<string, number>;
    };
  };
}
```

### 前端查询入口（多视角）

```
┌─────────────────────────────────────────────────────────────────────┐
│                     操作日志查询入口                                  │
│                                                                     │
│  ① 模块视角（独立页面 /activity-logs）                                │
│     ┌──────────────────────────────────────────────────────┐        │
│     │ [项目] [任务] [Wiki] [交付] [工作台] [SOP] [成员] [设置] │        │
│     │  ▲ 切换 Tab                                          │        │
│     │                                                      │        │
│     │  10:32  Alex（UI）创建了任务「首页设计稿 v2」             │        │
│     │  10:28  Bot-01（MCP）更新了文档「周报 03-03」            │        │
│     │  10:15  Alex（COWORK）推进了 SOP「发布流程」到阶段 3     │        │
│     │  09:50  系统（Cron）执行了巡检任务                       │        │
│     └──────────────────────────────────────────────────────┘        │
│                                                                     │
│  ② 资源视角（内嵌面板，在具体资源详情页中）                           │
│     任务详情页 → 侧边「操作记录」Tab                                 │
│     文档详情页 → 侧边「操作记录」Tab                                 │
│     项目详情页 → 「活动」Tab                                        │
│                                                                     │
│  ③ 成员视角（成员详情页 → 「活动记录」Tab）                           │
│     可查看该成员（人类用户或 AI 成员）的所有操作                       │
│     区分 UI 操作 / MCP 操作 / COWORK 操作                           │
│                                                                     │
│  ④ 项目全局视角（项目页面 → 「活动流」Tab）                           │
│     该项目下所有模块的操作时间线                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 操作日志展示格式

每条日志的展示需要组合以下信息：

```
[时间] [操作者名称]（[来源标签]）[动词]了 [资源类型]「[资源标题]」
```

**来源标签样式**：

| source | 标签文案 | 样式 |
|--------|---------|------|
| `web_ui` | UI | 蓝色 badge |
| `mcp` | MCP | 紫色 badge |
| `mcp_external` | API | 橙色 badge |
| `cowork` | COWORK | 绿色 badge |
| `chat_channel` | Chat | 青色 badge |
| `system` | 系统 | 灰色 badge |
| `cron` | 定时 | 灰色 badge |

**展示示例**：

```
10:32  Alex [UI] 创建了任务「首页设计稿 v2」                    ▸ 详情
10:28  Bot-01 [MCP] 更新了文档「周报 03-03」                    ▸ 详情
       └ 变更：content（+352字）
10:15  Alex [COWORK] 推进了 SOP 阶段「发布流程 → 阶段3: 审核」  ▸ 详情
09:50  系统 [定时] 执行了 Cron 巡检「每日系统健康检查」           ▸ 详情
09:30  Alex [UI] 删除了交付物「旧版方案 PDF」                   ▸ 详情
```

### 与现有 `audit_logs` 的关系

| 方面 | 处理方式 |
|------|----------|
| 现有 `audit_logs` 表 | **保留**，继续作为 MCP 工具的**技术审计日志**（参数、耗时、Token 哈希等低层级信息） |
| 新 `activity_logs` 表 | 作为**业务操作日志**，面向用户可读的操作记录 |
| 写入关系 | MCP 调用同时写入两张表：`audit_logs`（技术细节）+ `activity_logs`（业务摘要） |
| UI 操作 | 仅写入 `activity_logs`（无需技术审计） |
| 查询 | 前端操作记录页面查 `activity_logs`；安全审计 / 技术排查查 `audit_logs` |

### changes 字段格式规范

`changes` 字段记录字段级变更差异（仅 `update` 操作），格式：

```json
[
  { "field": "title", "old": "旧标题", "new": "新标题" },
  { "field": "status", "old": "active", "new": "completed" },
  { "field": "content", "old": "(3215字)", "new": "(3567字)" }
]
```

**规则**：
- 长文本字段（content、description）只记录字数变化，不存全文
- 密码、Token 等敏感字段不记录具体值，只记录 `"[已更新]"`
- JSON 字段（tags、checkItems）记录序列化后的差异摘要
- `changes` 为空表示无差异（如只读操作或无法计算差异的场景）

### 日志保留与清理策略

| 策略 | 参数 | 说明 |
|------|------|------|
| 默认保留期 | 90 天 | 超过 90 天的日志自动删除 |
| admin 可配置 | 30 / 90 / 180 / 365 天 / 永久 | 系统设置页面配置 |
| 批量清理 | 每日凌晨 Cron | `DELETE FROM activity_logs WHERE created_at < ?` |
| 导出 | CSV / JSON | 清理前可导出归档 |
| 只读操作 | 可选记录 | 默认不记录 `read` 操作（减少数据量），admin 可开启 |

### 实施阶段

| 阶段 | 内容 | 时机 |
|------|------|------|
| Phase E1（多用户） | 创建 `activity_logs` 表 + `lib/activity-log.ts` + 核心 API Route 埋点 | 与用户体系同步 |
| Phase E1 | `GET /api/activity-logs` 查询 API | 与埋点同步 |
| Phase E1 | 独立操作日志页面 `/activity-logs`（模块视角） | 基础 UI |
| Phase E2 | 资源详情页内嵌操作记录面板 | UI 增强 |
| Phase E2 | 成员详情页活动记录 Tab | UI 增强 |
| Phase E3 | 项目全局活动流 + Dashboard 统计 | 高级功能 |
| Phase E3 | 日志导出 + 保留策略配置 | 运维功能 |

## 13.6 v0.9.8 在线数据库对接

### 架构设计

```
应用层（Zustand Store → API Route）
      │
      ▼
数据访问层（Drizzle ORM）  ← 统一接口
      │
      ├── SQLite 驱动（本地/开发）
      ├── PostgreSQL 驱动（生产推荐）
      └── MySQL 驱动（可选）
```

### 数据库切换策略

```typescript
// 通过环境变量切换
// .env
DATABASE_URL="sqlite:./data/teamclaw.db"        // 本地 SQLite（默认，向后兼容）
DATABASE_URL="postgres://user:pass@host/db"   // 在线 PostgreSQL
DATABASE_URL="mysql://user:pass@host/db"      // 在线 MySQL
```

### 迁移策略

- Drizzle ORM 已天然支持多数据库驱动
- Schema 定义保持一致，仅驱动层切换
- SQLite 特有语法（如 `text` + `mode: 'json'`）需抽象为通用 JSON 字段
- 提供 `scripts/migrate-to-pg.ts` 一键迁移脚本

#### 迁移基础设施升级（前置条件）

- 引入 `drizzle-kit generate` / `drizzle-kit push` 替代 `db/index.ts` 中的手写 SQL 迁移
- 生成 migration 文件（SQL），版本化管理（`db/migrations/` 目录）
- 运行时 ALTER TABLE 逻辑逐步退场
- 这是多数据库适配的**前置条件**，建议在 Phase A 开始时实施

#### JSON 字段迁移策略

- SQLite `text mode:'json'` → PostgreSQL `jsonb`
- 对高频查询的 JSON 字段（`sopInputs`、`knowledgeConfig`）创建 GIN 索引
- `stageHistory` 已拆为独立 `sop_stage_records` 表（见 §16.1.1），无需 JSON 迁移
- 其他 JSON 字段（`tags`、`checkItems`、`assignees`）评估是否需要拆表

### 为什么 v0.9.8 做这个

- 多用户场景下 SQLite 并发写入性能不足
- 团队协作需要集中式数据库
- 生产部署更可靠（备份、监控、扩容）
- 但保留 SQLite 作为本地开发/个人使用的降级选项

---

## 13.7 v3.x+ 未来版本：媒体创作能力路线图

> **原则**：v0.9.8 搭建好 SOP + Content Studio 基座，v3.x+ 在此基础上逐步扩展媒体类型。每个新媒体类型 = 新的阶段类型 + 新的 AI Provider + 新的编辑器组件。

### Phase F: v3.1 — AI 图片创作（≈3-4 周）

**核心能力**：SOP 流程中可插入"AI 图片生成"阶段，AI 根据文字描述生成图片。

| 编号 | 任务 | 说明 |
|------|------|------|
| F1 | AI 图片 Provider 抽象层 | 统一接口：`generateImage(prompt, config) → ImageResult`，支持 DALL-E 3、Stable Diffusion、Midjourney API 等 |
| F2 | `ai_image` 阶段类型实现 | SOP 引擎识别此类型 → 调用图片 Provider → 生成后等待用户确认 |
| F3 | 图片编辑器组件 | Content Studio 内嵌图片编辑（裁剪、标注、滤镜、拼接） |
| F4 | 图片槽位（Slot）支持 | 渲染模板的 `data-slot-type="ai_image"` → 点击触发 AI 图片生成 |
| F5 | MCP 工具 `generate_image` | AI Agent 可通过 MCP 调用图片生成能力 |
| F6 | 图片资产管理 | 生成的图片存入资产库，可跨文档复用 |

**典型 SOP 示例**：

```
SOP: 社交媒体内容制作
  ① 需求确认(input) → ② 文案撰写(ai_auto) → ③ 文案确认(ai_with_confirm)
  → ④ 配图生成(ai_image) ← 新阶段类型
  → ⑤ 可视化排版(render) → ⑥ 导出(export)
```

**AI Provider 抽象**（为多模型适配预留）：

```typescript
interface ImageProvider {
  id: string;                    // 'dall-e-3' | 'stable-diffusion' | 'midjourney'
  name: string;
  generate(params: ImageGenParams): Promise<ImageResult>;
  estimateCost(params: ImageGenParams): CostEstimate;
}

interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  style?: string;               // 'photorealistic' | 'illustration' | 'anime' | ...
  count?: number;               // 生成数量
  referenceImage?: string;      // 参考图（img2img）
}

interface ImageResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    revisedPrompt?: string;     // 模型修正后的 prompt
  }>;
  cost: number;
  model: string;
}
```

### Phase G: v3.2 — AI 视频创作（≈4-6 周）

**核心能力**：SOP 流程中可插入"AI 视频生成"阶段，从文字/图片生成视频。

| 编号 | 任务 | 说明 |
|------|------|------|
| G1 | AI 视频 Provider 抽象层 | 统一接口：`generateVideo(prompt, config) → VideoResult`，支持 Sora、Runway ML、Pika Labs 等 |
| G2 | `ai_video` 阶段类型实现 | 异步生成（视频生成耗时长）→ 轮询/Webhook 状态 → 完成后通知 |
| G3 | 视频预览/编辑组件 | 内嵌视频播放器 + 基础剪辑（裁剪片段、拼接、加字幕） |
| G4 | `media_edit` 阶段类型实现 | 进入媒体编辑器（类似 render 进入 Content Studio） |
| G5 | MCP 工具 `generate_video` | AI Agent 可通过 MCP 调用视频生成能力 |
| G6 | 视频资产管理 + CDN 存储 | 视频文件较大，需要对象存储（S3/COS）+ CDN 加速 |

**异步生成的特殊处理**：

```
视频生成耗时较长（30s ~ 5min），需要特殊处理：

1. AI 调用 generate_video → 返回 taskId（不阻塞 SOP）
2. 系统创建异步任务，SOP 阶段状态: generating
3. 轮询/Webhook 检查生成状态
4. 生成完成 → 通知用户 → 阶段状态: waiting_confirm
5. 用户预览确认 → 阶段推进

与 ai_auto 的区别：ai_auto 是同步的，ai_video 是异步的
```

**典型 SOP 示例**：

```
SOP: 产品宣传视频制作
  ① 需求确认(input) → ② 脚本撰写(ai_auto) → ③ 脚本确认(ai_with_confirm)
  → ④ 分镜图生成(ai_image, count=6)
  → ⑤ 视频生成(ai_video) ← 新阶段类型
  → ⑥ 视频剪辑(media_edit) ← 新阶段类型
  → ⑦ 审核(review) → ⑧ 导出(export)
```

### Phase H: v3.3 — 数据可视化 + 综合（≈3-4 周）

| 编号 | 任务 | 说明 |
|------|------|------|
| H1 | 数据可视化 Provider | 基于 ECharts/D3.js，AI 根据数据自动选择图表类型 |
| H2 | `data_viz` 阶段类型实现 | AI 分析数据 → 推荐图表 → 生成可交互图表 → 用户调整 |
| H3 | 图表编辑器组件 | 内嵌 ECharts 编辑器（切换图表类型、调整颜色、修改数据） |
| H4 | 图表→图片导出 | 可视化图表导出为 SVG/PNG，嵌入渲染模板 |
| H5 | 插件市场 v1 | SOP 模板 + 渲染模板 + AI Provider = 可安装的"插件" |

### 媒体创作统一架构

```
┌──────────────────────────────────────────────────────────┐
│                    Content Studio v3.x+                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 文字编辑  │  │ HTML编辑  │  │ 图片编辑  │  │ 视频编辑  │ │
│  │ (MD)     │  │ (WYSIWYG)│  │ (裁剪/AI) │  │ (剪辑)   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │              │      │
│       ▼              ▼              ▼              ▼      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              统一资产管理层 (Asset Manager)           │ │
│  │  文档(.md) | HTML(.html) | 图片(.jpg/.png) | 视频   │ │
│  └─────────────────────────────────────────────────────┘ │
│       │              │              │              │      │
│       ▼              ▼              ▼              ▼      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              AI Provider 抽象层                      │ │
│  │  LLM (文字) | LLM (HTML) | 图片模型 | 视频模型       │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 扩展性保证（v0.9.8 设计时必须遵循）

为确保 v3.x+ 的媒体创作能力**不需要 breaking change**，v0.9.8 在设计时必须遵循：

| 扩展点 | v0.9.8 设计 | v3.x+ 如何扩展 |
|--------|----------|----------------|
| StageType 枚举 | 使用 `string` 存储，不用 `integer` | 直接新增字符串值，无需 Schema 变更 |
| OutputType 枚举 | 同上，`string` 存储 | 同上 |
| SOP outputConfig | JSON 字段，灵活结构 | 新增字段（如 `imageProviderConfig`）无需改表 |
| 渲染模板 SlotDef.type | `string` 枚举 | 新增 `'ai_image'`, `'video'` 等类型 |
| 导出格式 ExportPreset.formats | `string[]` 数组 | 新增 `'mp4'`, `'gif'`, `'svg'` 等 |
| MCP 工具 | `definitions.ts` 注册制 | 新增工具定义，不影响已有工具 |
| API 路由 | RESTful 资源路由 | 新增 `/api/media-assets/` 等路由 |
| Store | 独立 Zustand Store | 新增 `media.store.ts` 等 |

---

## 14. 与现有规划的关系

| 现有 Phase | 状态 | v0.9.8 融合方式 |
|-----------|------|-------------|
| Phase 1-9 | ✅ 已完成 | - |
| **Phase 10**: 数据统计 | 待实现 | 融入 E4：SOP 执行统计是最有价值的分析维度 |
| **Phase 11**: 插件机制 | 待实现 | 融入 D5/H5：SOP 模板 + 渲染模板 + AI Provider = 可安装的"插件" |
| **Phase 12**: 数据库上云 | 待实现 | **融入 E2**：v0.9.8 核心能力，Drizzle 多驱动适配 PostgreSQL/MySQL |
| **Phase 13**: 多用户 | 待实现 | **融入 E1**：v0.9.8 核心能力，NextAuth.js + 角色权限 |
| Phase 14: 多 Gateway | 待实现 | SOP 的 requiredTools 检查天然适配不同 Gateway |

---

## 15. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| SOP 模板编辑器复杂度高 | 开发周期延长 | 中 | 先实现 JSON 编辑模式，可视化编辑器作为 P1 迭代 |
| Content Studio iframe 跨域限制 | 编辑功能受限 | 低 | 使用 srcdoc 而非 src，同源渲染 |
| 知识库分层读取增加 AI 上下文管理复杂度 | AI 执行质量不稳定 | 中 | 先实现全量读取，分层读取作为优化 |
| 内置 SOP 模板质量 | 影响首次体验 | 中 | 反复测试打磨，确保每个内置 SOP 完整可用 |
| 与 REQ-005 的依赖关系 | 阻塞 Phase B | 低 | REQ-005 范围较小，可快速完成 |
| Schema 迁移对现有数据的影响 | 数据丢失/不兼容 | 低 | 所有新字段均为可选（nullable），增量迁移 |
| GrowthPilot useSync 移植到 TypeScript | 兼容性问题 | 中 | 逐步移植，先实现核心 slot 映射，再补充边缘场景 |
| AI 生成的 HTML 质量不稳定 | 渲染模板效果差 | 中 | 服务端校验（slot 属性、安全检查）+ 用户必须预览确认后才生效 |
| AI 生成的 SOP 阶段设计不合理 | SOP 执行效率低 | 中 | 默认 draft 状态，用户确认后才激活；AI 可根据执行经验自动建议优化 |
| 多用户权限系统复杂度 | 开发周期延长 | 中 | 先实现 3 级角色（admin/member/viewer），复杂权限模型（RBAC/ABAC）留到 v3.x+ |
| SQLite → PostgreSQL 迁移数据丢失 | 数据不可用 | 低 | 提供一键迁移脚本 + 迁移前自动备份；Drizzle 统一 Schema 降低风险 |
| Drizzle 多驱动 SQL 兼容性 | SQLite 特有语法在 PG 上报错 | 中 | 提前排查 `text mode:'json'` 等 SQLite 专有写法，用 Drizzle 抽象层统一处理 |
| v0.9.8 设计未充分预留扩展 | v3.x+ 需要 breaking change | 中 | 严格遵循"扩展性保证"表格中的设计原则；所有枚举用 `string` 存储，JSON 字段保持灵活 |
| AI 图片/视频模型 API 成本高 | 用户使用成本失控 | 中 | Provider 层内置 `estimateCost` 方法，执行前展示预估费用；设置每月额度上限 |
| 视频生成异步流程中断 | SOP 阶段卡死 | 低 | 轮询超时机制（10min）+ 手动重试按钮 + SOP 阶段可跳过配置 |
| Content Studio iframe XSS | 安全漏洞 | 高 | iframe 必须启用 sandbox + CSP 沙箱 + DOMPurify 清洗 HTML（见 §16.2） |
| SSE 多用户广播性能 | 服务端压力 | 中 | 事件按 teamId/projectId 分区，设置最大连接数（见 §16.1.2） |
| MCP executor switch-case 膨胀（当前 24 个，v0.9.8 将达 33+） | 维护困难 | 高 | 重构为 Map 注册制（见 §16.3.2） |
| stageHistory JSON 字段查询性能 | SOP 统计 E4 受阻 | 中 | 拆为独立 `sop_stage_records` 表（见 §16.1.1） |
| 渲染模板无版本管理 | 多用户编辑冲突 | 中 | 增加 version 字段 + 文档固定模板版本（见 §16.3.5） |
| MCP 双通道鉴权缺失 | 多用户安全 + COWORK 场景 | 高 | 内部加 Session 鉴权，外部加用户 Token 表 + 哈希索引（见 §16.2.2） |
| COWORK Token 泄露风险 | 未授权操作 | 中 | Token 仅显示一次 + 即时吊销 + 90天闲置冻结 + 独立限流（见 §13.5 COWORK 章节） |
| 操作日志数据量膨胀 | 磁盘/查询性能 | 中 | 90 天自动清理 + 默认不记录 read 操作 + 长文本只存摘要（见 §13.5.1） |
| 操作日志埋点遗漏 | 审计不完整 | 中 | API Route 层统一埋点 + 代码 Review 检查清单（见 §13.5.1） |
| Schema 双轨维护（Drizzle + 手写 SQL） | 迁移 PG 时不一致 | 高 | 引入 drizzle-kit 替代手写迁移（见 §16.3.1） |
| **总工期超预期** | 项目延期 | **高** | 总时间线 11-16 周无 buffer，建议每个 Phase 预留 20% 缓冲期（即乐观 13 周、悲观 19 周）；优先完成 Phase A-C 核心功能，Phase D/E 可按实际进度调整范围 |

### 15.1 测试策略

v0.9.8 新增模块的测试覆盖要求：

| 模块 | 测试类型 | 重点覆盖 | 目标覆盖率 |
|------|---------|---------|-----------|
| SOP 引擎状态机 | 单元测试 | 阶段流转、回退逻辑、`advance_sop_stage` 边界条件 | ≥90% |
| SOP API Routes | 集成测试 | CRUD + 权限校验 + 级联删除 | ≥80% |
| Content Studio slot 同步 | 单元测试 | `useSlotSync` 核心逻辑、syncLock 防循环、三种 slot 类型 | ≥90% |
| Content Studio 导出 | E2E 测试 | JPG/PNG/HTML 导出流程完整性 | 关键路径 |
| MCP 新工具（9 个） | 集成测试 | 参数校验、权限控制、执行结果 | ≥80% |
| 多用户认证 | 集成测试 + E2E | 登录/注册/权限矩阵/Token 管理 | ≥85% |
| 数据迁移脚本 | 集成测试 | 幂等性、数据完整性、回滚 | 100%（关键路径） |

**测试工具**：沿用现有 Vitest（单元/集成）+ Playwright（E2E）。

**每个 Phase 发布前必须**：
- 新增代码覆盖率 ≥80%
- 所有现有测试通过
- E2E 关键路径测试通过

---

## 16. 架构优化建议（Review 补充）

> **来源**：对整体项目架构（db/schema.ts、middleware.ts、executor.ts、gateway-client.ts、store/index.ts、event-bus.ts 等核心模块）结合本规划文档做的全面 Review。以下按 **性能 → 安全 → 扩展性** 三个维度组织。

### 16.1 性能优化

#### 16.1.1 SOP 阶段历史应独立为表（P0）

**现状**：规划中 `tasks.stageHistory` 是 JSON 字段存储所有阶段记录。

**问题**：
- SQLite/PG 的 JSON 字段**无法高效索引**，"查询所有处于某阶段的任务"需全表扫描
- 多用户并发更新同一任务的 stageHistory 可能丢数据（JSON 整体覆盖，非增量更新）
- E4（SOP 执行统计）需要对 stageHistory 做聚合分析，JSON 查询性能差

**建议**：将 §9.1 的 `tasks.stage_history` JSON 字段替换为独立表：

```sql
-- 新增独立的阶段执行记录表（替代 JSON 字段）
CREATE TABLE sop_stage_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|active|waiting_input|waiting_confirm|completed|skipped
  output TEXT,                             -- 阶段产出（文本/文档 ID/文件路径）
  confirmed_by TEXT,                       -- 确认者 memberId/userId
  retry_count INTEGER DEFAULT 0,
  started_at INTEGER,                      -- timestamp
  completed_at INTEGER,                    -- timestamp
  created_at INTEGER NOT NULL              -- timestamp
);
CREATE INDEX idx_stage_records_task ON sop_stage_records(task_id);
CREATE INDEX idx_stage_records_status ON sop_stage_records(status);
```

**影响**：
- §9.2 中 `ALTER TABLE tasks ADD COLUMN stage_history` 改为不需要
- §7.1 的 `StageRecord` 接口保持不变，但存储从 JSON → 关系表
- `advance_sop_stage` MCP 工具改为操作 `sop_stage_records` 表
- E4 统计分析可直接用 SQL 聚合，性能大幅提升
- 总表数 +1（`sop_stage_records`），结合 §16.2.2 的 `user_mcp_tokens` 和 §13.5.1 的 `activity_logs`，共新增 5 张表（含基础的 2 张），最终 **24 张表**

#### 16.1.2 SSE 多用户广播优化

**现状**：`lib/event-bus.ts` 的 `emit()` 向所有 SSE 客户端广播所有事件，无过滤、无连接数限制。

**问题**：v0.9.8 多用户场景下，N 个用户在线 = N 个 SSE 连接。一个任务更新触发 N 次序列化 + 写入。

**建议**（Phase E 实施）：
- 事件广播按 teamId/projectId 分区，用户只接收有权限的事件
- 设置 SSE 最大连接数（如 500），超出时拒绝或降级为轮询
- 考虑从 SSE 迁移到 WebSocket 双向通信（减少连接数，复用 Gateway 通道）
- 多节点部署时引入 Redis Pub/Sub 做事件分发

#### 16.1.3 Content Studio 渲染性能

**建议**（Phase C 实施时注意）：
- `useSlotSync` 的 MD→HTML 转换需要防抖（300ms），避免每次击键都触发
- iframe 通信使用 `postMessage` 而非 DOM 直接操作
- 大文档（5000+ 字）启用 MD 编辑区虚拟滚动
- 导出 JPG 时 `html-to-image` 在 Web Worker 中执行，避免阻塞主线程

#### 16.1.4 Store 全量初始化优化

**现状**：`store/index.ts` 的 `useDataInitializer()` 启动时并行拉取 14 个 Store 的全量数据。v0.9.8 新增 `sop.store.ts` 和 `render-template.store.ts` 后会更多。

**建议**：
- 首屏只加载当前页面所需的 Store（路由级懒加载）
- SOP 模板列表按需加载（进入 `/sop` 页面时才 fetch）
- 渲染模板使用 LRU 缓存，避免重复拉取
- API 默认支持分页，初始化只加载 recent N 条

#### 16.1.5 JSON 字段迁移策略

**建议**（Phase E2 在线数据库对接时实施）：
- SQLite `text mode:'json'` → PostgreSQL `jsonb`
- 对高频查询的 JSON 字段（`sopInputs`、`knowledgeConfig`）创建 GIN 索引
- `stageHistory` 已拆为独立表（§16.1.1），无需迁移
- 其他 JSON 字段（`tags`、`checkItems`、`assignees`）评估是否需要拆表

---

### 16.2 安全优化

#### 16.2.1 Content Studio iframe CSP 沙箱（P0）

**现状**：`middleware.ts` 的 CSP 允许 `'unsafe-inline' 'unsafe-eval'`。Content Studio 的 iframe 将渲染用户/AI 生成的 HTML。

**问题**：如果 CSP 不收紧，用户或 AI 注入的恶意 HTML 可执行脚本（XSS）。规划中提到"禁止 `<script>` 标签"但这是应用层校验，CSP 是最后一道防线。

**建议**：
- iframe 使用 `sandbox="allow-same-origin"` 属性（禁止脚本执行）
- iframe 的 `srcdoc` 中注入独立 CSP meta 标签：`<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`
- 渲染模板 HTML 在存储前经过 **DOMPurify**（或 `sanitize-html`）清洗
- 白名单模式：只允许安全标签（div/span/p/h1-6/img/table/ul/ol/li/a/section/header/footer/style）
- 禁止事件处理器属性（onclick、onerror、onload 等）
- CSS 中禁止 `url()`、`@import`、`expression()` 等可执行代码
- 图片 `src` 只允许 `data:` 和 `/api/assets/` 前缀
- 考虑 iframe 使用 `blob:` URL 完全隔离域

#### 16.2.2 MCP 双通道鉴权升级（P0）

**现状**：
- `/api/mcp`（内部端点）：无鉴权，依赖 middleware 的 CSRF 保护，任何前端代码可伪造 `X-Agent-Id` header
- `/api/mcp/external`（外部端点）：Bearer Token 鉴权，Token 存储在 `members.openclawApiToken`（AI 成员专用）
- 外部端点认证为 O(N) 全表扫描 + 逐行解密，无 Token 哈希索引

**v0.9.8 多用户 + COWORK 场景需求**：

两种调用者身份都需要鉴权：
1. **浏览器用户**（TeamClaw 前端）→ `/api/mcp` → Session Cookie 识别 userId
2. **COWORK 用户**（外部 MCP Client）→ `/api/mcp/external` → 个人 MCP Token 识别 userId

**改造方案**：

**a) 内部端点 `/api/mcp` 升级**
- 改为 NextAuth Session 鉴权（从 session cookie 获取 userId）
- 注入 userId 到 MCP 执行上下文（`McpContext.userId`）
- 按 UserRole 校验工具权限（viewer 不能调用写操作）
- 审计日志记录 `{ userId, source: 'web' }` 而非仅 agentId

**b) 外部端点 `/api/mcp/external` 升级**
- 新增 `user_mcp_tokens` 表，每个人类用户可创建多个 Token（详见 §13.5 COWORK 章节）
- Token 格式 `cmu_<base58>`（用户 Token）与 `cmk_<base58>`（AI 成员 Token）共存
- 认证流程改为：Token → SHA-256 哈希 → `user_mcp_tokens.tokenHash` 索引直查 → O(1)
- 旧 AI 成员 Token（`cmk_*`）保持兼容，走现有 `members` 表认证
- 限流 Key 从 IP 改为 tokenId（每 Token 独立限流）
- 审计日志记录 `{ userId, tokenId, source: 'mcp_external_user' }` 或 `{ memberId, source: 'mcp_external_ai' }`

**c) Schema 变更**

```sql
-- 新增用户 MCP Token 表
CREATE TABLE user_mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,              -- SHA-256 哈希，建唯一索引
  encrypted_token TEXT NOT NULL,                -- AES-256-GCM 加密（审计回溯用）
  name TEXT NOT NULL DEFAULT '',                -- Token 备注名
  permissions TEXT DEFAULT '[]',                -- JSON: 工具白名单（空=继承角色）
  is_active INTEGER NOT NULL DEFAULT 1,         -- 0=已吊销/冻结
  last_used_at INTEGER,                         -- timestamp
  expires_at INTEGER,                           -- timestamp，null=永不过期
  created_at INTEGER NOT NULL                   -- timestamp
);
CREATE UNIQUE INDEX idx_user_tokens_hash ON user_mcp_tokens(token_hash);
CREATE INDEX idx_user_tokens_user ON user_mcp_tokens(user_id);
```

> **注意**：此表 + §13.5.1 的 `activity_logs` 使本次 v0.9.8 总表数达到 **24 张**。

**d) API 新增**

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/user-tokens` | GET | 列出当前用户的 Token（admin 可查全部） | member+ |
| `/api/user-tokens` | POST | 创建新 Token | member+ |
| `/api/user-tokens/[id]` | DELETE | 吊销 Token | owner 或 admin |
| `/api/user-tokens/[id]` | PUT | 更新备注/权限/过期时间 | owner 或 admin |

**e) 认证流程（外部端点，改造后）**

```
请求 Bearer Token
      │
      ├── 前缀 cmu_ → 用户 Token 路径
      │     ├── SHA-256(token) → 查 user_mcp_tokens.token_hash
      │     ├── 命中 → 检查 is_active + expires_at
      │     ├── 有效 → 注入 userId + UserRole
      │     └── 无效 → 401
      │
      └── 前缀 cmk_ → AI 成员 Token 路径（向后兼容）
            ├── 走现有 members 全表扫描+解密逻辑
            ├── 命中 → 注入 memberId + executionMode
            └── 未来迁移：也改为 tokenHash 索引查找

#### 16.2.3 限流策略完善

**现状**：仅 3 个路由应用了限流（`/api/mcp/external`、`/api/chat-reply`、`/api/members POST`）。v0.9.8 新增的 `/api/sop-templates`、`/api/render-templates` 等 API 缺少限流。

**建议**：
- **所有写操作 API** 必须应用限流（至少 STANDARD: 60/min）
- AI 创建模板的 MCP 工具应用 CREATE 级别（30/min）
- SOP 推进操作（`advance_sop_stage`）应用 STANDARD（防止 AI 死循环推进）
- 多用户场景：限流 Key 从 IP 改为 userId（登录后）

#### 16.2.4 多用户认证安全细化

**现状**：§13.5 提到 NextAuth.js 但未涉及具体安全细节。

**建议补充**：
- 密码哈希：bcrypt（cost factor ≥ 12）或 argon2id
- Session: HTTPOnly + Secure + SameSite=Strict Cookie
- 登录限流：同一 IP/账号 5 分钟内最多 5 次失败尝试，之后锁定 15 分钟
- 密码重置：一次性 token + 15 分钟有效期 + 邮件验证
- CSRF Token：NextAuth 内置，所有 mutating 请求自动校验

---

### 16.3 扩展性优化

#### 16.3.1 Schema 迁移基础设施升级（P1）

**现状**：`db/schema.ts`（Drizzle 定义）和 `db/index.ts`（手写 SQL ALTER TABLE 迁移）**两套表定义并存**。

**问题**：v0.9.8 新增 2-3 张表 + 扩展 4+ 个字段 + 持续迭代，双轨维护的不一致风险会指数级增长。迁移到 PostgreSQL 后更严重（SQLite SQL 和 PG SQL 语法不同）。

**建议**（Phase A 实施，为 E2 打基础）：
- 引入 `drizzle-kit generate` / `drizzle-kit push` 替代手写 SQL 迁移
- 生成 migration 文件（SQL），版本化管理（`db/migrations/` 目录）
- `db/index.ts` 的运行时 ALTER TABLE 逻辑逐步退场
- 这是多数据库适配（§13.6）的**前置条件**

#### 16.3.2 MCP 工具注册制重构（P1）

**现状**：`definitions.ts` 是一个大对象字面量（30 个工具），`executor.ts` 是一个 24 分支的 switch-case + 1 default（574 行）。

**问题**：v0.9.8 新增 9 个工具后将达到 39 个定义 + 33+ 个 case 分支，维护极其困难。每次新增工具需同时修改 3 个文件（definitions.ts + executor.ts + handler）。

**建议**（Phase A 实施）：
```
// 重构为 Map<toolName, handler> 注册模式
// 每个 handler 文件同时导出 definition + execute 函数
core/mcp/tools/
  ├── advance-sop-stage.ts    // { definition, execute }
  ├── create-sop-template.ts
  ├── generate-image.ts       // v3.x+
  └── index.ts                // auto-register all tools
```
- 新增工具只需一个文件，无需修改 executor.ts
- 与规划中"扩展性保证"表的 `definitions.ts 注册制` 一致

#### 16.3.3 AI Provider 抽象层前置

**现状**：§13.7 Phase F（v3.1）才引入 AI Provider 抽象层。

**问题**：v0.9.8 的 SOP 引擎已在调用 LLM（`chat.send`），但没有经过 Provider 抽象。到 v3.1 引入时，LLM 调用和图片模型调用将走不同路径，需要二次重构。

**建议**（前置到 Phase A 或 B）：
```typescript
// v0.9.8 即定义 AIProvider 基础接口
interface AIProvider {
  id: string;
  type: 'llm' | 'image' | 'video' | 'data_viz';
  execute(params: AIProviderParams): Promise<AIResult>;
  estimateCost?(params: AIProviderParams): CostEstimate;
}

// v0.9.8 仅实现 LLMProvider（包装 Gateway chat.send）
// v3.x+ 新增 ImageProvider/VideoProvider 时只需实现接口
// SOP 引擎的 AI 调用统一通过 Provider 分发
```

#### 16.3.4 Members 表 AI 配置拆分

**现状**：`db/schema.ts` 的 `members` 表包含 15+ 个 `openclaw_*` 字段，混合了基础成员信息和 AI 运行时配置。

**问题**：v0.9.8 引入 User 表后，members（AI 成员）和 users（人类用户）的关系需要理清。

**建议**（Phase E1 实施）：
- 新增 `users` 表（人类用户，含 auth 字段）
- `members` 表保留（AI 成员 + 团队角色映射）
- 拆分 members 表：基础信息（id/name/avatar）vs AI 配置（`openclaw_*` 字段 → `member_ai_configs` 表）
- `users.id` 和 `members.id` 通过 `user_member_mapping` 关联

#### 16.3.5 渲染模板版本管理

**现状**：`render_templates` 表只有 `updatedAt`，没有版本字段。

**问题**：AI 更新模板后，旧模板关联的文档会立即受影响。多用户场景下，一个用户的模板修改可能破坏另一个用户正在编辑的文档。

**建议**（Phase C 或 E 实施）：
```sql
-- render_templates 表增加版本管理
ALTER TABLE render_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE render_templates ADD COLUMN parent_version_id TEXT;  -- 指向上一版本

-- documents 表固定使用的模板版本
ALTER TABLE documents ADD COLUMN render_template_version INTEGER;
```

#### 16.3.6 gateway.store.ts 拆分

**现状**：`gateway.store.ts` 约 1000 行（33.75KB），是项目中最大的 Store 文件。

**建议**（Phase A 或 B 顺便解决，关联 TD-006）：
- 拆分为 `gateway-connection.store.ts`（连接管理）+ `gateway-agents.store.ts`（Agent CRUD）+ `gateway-sessions.store.ts`（Session 管理）
- 对外仍通过 `useGatewayStore` 统一导出（组合 Store 模式）

---

### 16.4 规划文档修正记录

| 修正项 | 原文 | 修正为 | 说明 |
|--------|------|--------|------|
| §10.1 MCP 工具数量 | 未明确现有数量 | 现有 30 个 + 新增 9 个 = 39 个 | `definitions.ts` 实际 30 个工具 |
| §10.4 编号重复 | 两个 10.4 | 第二个改为 10.5 | 编号冲突 |
| §13 Phase A 的 A4 | "5 个新工具" | "9 个新工具：5 个 SOP 执行类 + 4 个 AI 创作类" | 与 §10.1 的 9 个工具一致 |
| §13 Phase A 的 A5 | "5 个新 action" | "9 个新 action" | 与 A4 同步 |
| `definitions.ts` 文件头注释 | "18 个工具" | 实际 30 个 | 代码中的过时注释，非本文档问题，后续代码修改时更新 |

### 16.5 优化优先级总览

| 优先级 | 建议 | 维度 | 实施阶段 |
|--------|------|------|---------|
| **P0** | Content Studio iframe CSP 沙箱 + HTML DOMPurify 清洗 | 安全 | Phase C |
| **P0** | MCP 双通道鉴权（Session + COWORK 用户 Token） | 安全 | Phase E1 |
| **P0** | `sop_stage_records` 独立表替代 JSON 字段 | 性能+扩展 | Phase A |
| **P1** | Schema 双轨维护 → drizzle-kit 迁移 | 扩展性 | Phase A |
| **P1** | SSE 事件按权限分区广播 | 性能 | Phase E |
| **P1** | MCP 工具从 switch-case 重构为注册制 | 扩展性 | Phase A |
| **P1** | 渲染模板版本管理 | 扩展性 | Phase C/E |
| **P1** | 多维度操作日志系统（`activity_logs` 表 + 埋点 + 查询 UI） | 安全+运维 | Phase E1 |
| **P2** | AI Provider 基座前置 | 扩展性 | Phase A/B |
| **P2** | 限流覆盖所有写操作 API | 安全 | Phase A |
| **P2** | Store 懒加载 + 分页初始化 | 性能 | Phase B/C |
| **P2** | Members 表 AI 配置拆分 | 扩展性 | Phase E1 |
| **P3** | CSP 从 unsafe-inline 迁移到 nonce 模式 | 安全 | Phase E+ |
| **P3** | gateway.store.ts 拆分 | 代码质量 | Phase A/B |

---

## 17. 技术依赖规划

> **来源**：对当前 `node_modules`（451M）的全面审计 + v0.9.8 新增功能的依赖预估。
> **目标**：精简现有冗余、统一新增依赖选型标准、控制项目整体体积。

### 17.1 当前依赖审计（v0.3.9 基线）

| 依赖 | 磁盘大小 | 实际用量 | 判定 |
|------|---------|---------|------|
| `next` + `@next` | 211M (47%) | 核心框架 | **不可动** |
| `lucide-react` | 44M (10%) | 3838 图标，实际引用 72 个（1.9%） | ⚠️ 构建 tree-shaking 有效，磁盘浪费可接受 |
| `date-fns` | 38M (8%) | 仅 `hooks/useRelativeTime.ts` 用 1 个函数 | **🔴 严重浪费** |
| `typescript` | 23M | devDep，编译必需 | 不可动 |
| `esbuild` + `@esbuild` | 20M | devDep，vitest 依赖 | 不可动 |
| `drizzle-orm` | 16M | 核心 ORM | 不可动 |
| `playwright*` | 14M | devDep，E2E 测试 | 不可动 |
| `better-sqlite3` | 12M | 核心数据库驱动 | 不可动 |
| `highlight.js` | 9.1M | `rehype-highlight` 依赖，190+ 语言包仅用 ~10 种 | ⚠️ 可按需加载 |
| `tailwindcss` | 6M | CSS 框架 | 不可动 |
| 其余 ~80 个包 | ~58M | 小型依赖 | 正常 |

### 17.2 精简计划

#### 17.2.1 移除 `date-fns`（省 ~38M）— Phase A

38M 库仅为 `hooks/useRelativeTime.ts` 的 `formatDistanceToNow` + 2 个 locale。

**替代方案**：重写现有 `hooks/useRelativeTime.ts` 中的 `formatRelativeTime` 函数（该文件已存在同名函数，直接替换实现即可，无需新建文件），去除 `date-fns` 依赖，约 40 行即可实现中英文相对时间格式化。

```typescript
// lib/format-relative-time.ts
export function formatRelativeTime(date: Date | number, lang: 'zh' | 'en' = 'zh'): string {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (lang === 'zh') {
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    return `${Math.floor(days / 30)} 个月前`;
  }
  // ... 英文分支类似
}
```

#### 17.2.2 `highlight.js` 按需加载（省 ~7M）— Phase A

当前 `rehype-highlight` 加载全部 190+ 语言包。实际只需 ~10 种（JS/TS/JSON/SQL/Bash/Python/HTML/CSS/YAML/Markdown）。

**方案**：配置 `rehype-highlight` 的 `languages` 选项，仅注册所需语言。

#### 17.2.3 `lucide-react` 长期优化 — Phase B+

44M 磁盘占用中 98% 是未使用的图标。但 Next.js 构建时 tree-shaking 已生效，**构建产物**不受影响。

**短期**：维持现状，不影响运行时性能。
**长期**（v3.x+）：评估切换为 `lucide-static` + SVG sprite 方案。

### 17.3 v0.9.8 新增依赖选型

| Phase | 依赖 | 用途 | 预估大小 | 类型 | 替代方案评估 |
|-------|------|------|---------|------|------------|
| **A** | `drizzle-kit` | Schema 迁移管理（§16.3.1） | ~5M | devDep | 无替代，drizzle 官方工具 |
| **C** | `dompurify` | Content Studio HTML 清洗（§16.2.1） | ~0.3M | dep | `sanitize-html`（~2M，更重） |
| **C** | `html-to-image` | Content Studio 导出 JPG/PNG（§18.7 修正） | ~0.05M | dep | `html2canvas`（~1.5M，CSS 还原度低） |
| **E** | `next-auth` (v5) | 多用户认证（§13.5） | ~3M | dep | 自实现（不推荐，安全风险高） |
| **E** | `@node-rs/argon2` | 密码哈希 | ~1M | dep | `bcrypt`（~1M，argon2 更安全） |
| **E** | `pg` | PostgreSQL 驱动（§13.6） | ~2M | dep | `@neondatabase/serverless`（Serverless 场景） |

**不引入的依赖**：

| 候选 | 用途 | 不引入原因 |
|------|------|-----------|
| ~~`codemirror`~~ | Wiki MD 编辑器 | 现有 `<textarea>` 够用，未来按需引入 |
| ~~`@dnd-kit`~~ | SOP 阶段拖拽 | 使用原生 HTML5 Drag & Drop API |
| ~~`echarts`~~ | 数据可视化 | 延迟到 Phase H（v3.x+），当前无需求 |
| ~~`socket.io`~~ | 多用户实时协作 | 复用现有 SSE + Gateway WebSocket |

### 17.4 依赖准入标准

v0.9.8 及后续版本，新增任何 production dependency 前必须满足：

| 检查项 | 标准 |
|--------|------|
| 必要性 | 功能无法用 ≤100 行自实现合理替代 |
| 体积 | 单包 ≤5M（超过需在本文档登记并说明理由） |
| 维护状态 | npm 最近 6 个月内有发布，GitHub issue 活跃 |
| 安全 | 无已知未修复的 CVE |
| Tree-shaking | 支持 ESM 导出（确保构建产物不膨胀） |
| 替代评估 | 列出至少 1 个替代方案并说明选择理由 |

### 17.5 体积变化预测

```
v0.3.9 当前:     451M
精简后 (A):    ~406M  (-45M: date-fns + highlight.js 按需)
Phase C 新增:  ~406.35M  (+0.35M: dompurify 0.3M + html-to-image 0.05M)
Phase E 新增:  ~412.35M  (+6M: next-auth + argon2 + pg)
──────────────────────────────────────────────────
v0.9.8 最终预估:  ~413M  (vs 当前 451M，净减 ~38M)
```

### 17.6 优先级行动清单

| 优先级 | 动作 | 预计效果 | 实施时机 |
|--------|------|---------|---------|
| **P0** | 移除 `date-fns`，重写 `hooks/useRelativeTime.ts` 中的 `formatRelativeTime` | -38M | Phase A |
| **P1** | `rehype-highlight` 按需注册 ~10 种语言 | -7M | Phase A |
| **P1** | 评估 `chokidar` 是否仍需（v0.9.8 可能不再用 OpenClaw file watcher） | -0.1M | Phase A |
| **P2** | 新增依赖严格准入：必须在 §17.3 表中登记 | 控制增长 | v0.9.8 全程 |
| **P3** | `lucide-react` → `lucide-static` + SVG sprite | -40M | v3.x+ |

---

## 18. GrowthPilot-editor 经验移植

> **来源**：GrowthPilot-editor（`案例制作工作区/GrowthPilot -editor`）是 v0.9.8 Content Studio 的原型实现，在实际使用中积累了大量踩坑经验。本章记录关键经验教训和技术决策对 v0.9.8 的影响。

### 18.1 架构差异对照

| 维度 | GrowthPilot-editor | TeamClaw v0.9.8 Content Studio | 变化原因 |
|------|-------------------|---------------------------|---------|
| **框架** | Vite + React 18 (JSX) | Next.js 14 + TypeScript | 统一技术栈，类型安全 |
| **状态管理** | useState/useRef（组件内） | Zustand Store | 多组件共享状态 |
| **数据持久化** | localStorage | SQLite/PostgreSQL（DB） | 多用户 + 服务端持久化 |
| **MD 编辑器** | CodeMirror 6 | `<textarea>`（现有 Wiki）| 避免引入重依赖（~2M）；未来按需升级 |
| **HTML 渲染** | iframe + srcdoc | iframe + srcdoc（沿用） | 经验证稳定，安全隔离 |
| **图片导出** | `html-to-image` (toJpeg) | `html-to-image`（§18.7 已确认采纳） | GrowthPilot 实测 CSS 还原度高，体积仅 50KB |
| **Markdown 解析** | `marked` | `react-markdown` + rehype（已有） | 复用现有链路 |
| **HTML→MD** | `turndown` | 自实现 slot 提取 | 基于 slot 的精确同步，不需通用 HTML→MD |
| **模板系统** | 静态 HTML 文件 + JSON schema | DB 存储 `render_templates` 表 | 支持 AI 动态创建/版本管理 |
| **文件索引** | Vite 自定义插件扫描 public/ | API Route + DB 查询 | 结构化管理 |

### 18.2 核心经验：槽位同步机制（useSync）

GrowthPilot-editor 的 `useSync.js`（436 行）是最核心的模块，也是踩坑最多的地方。

#### 18.2.1 已验证有效的设计

| 设计决策 | 具体做法 | 为何有效 |
|---------|---------|---------|
| **slot 标记规范** | HTML: `data-slot="xxx"` + `data-type="text\|richtext\|image"`；MD: `<!-- @slot:xxx -->...<!-- @/slot -->` | 精确定位，不依赖 DOM 结构 |
| **syncLock 防循环** | `useRef(false)` 互斥锁，任何同步操作前检查、操作后 50ms 解锁 | 防止 MD→HTML→MD 无限循环 |
| **模板引用分离** | `htmlTemplateRef` 保存原始模板结构，同步时只替换 slot 内容 | 样式和布局永远不被覆盖 |
| **四种 slot 类型** | text（textContent）、richtext（innerHTML + MD→HTML 转换 + 自动注入样式表）、image（img.src）、data（textContent + data-value 属性） | 覆盖 99% 场景 |
| **setContents 旁路** | 版本恢复时绕过同步逻辑，直接设置双侧内容 | 避免恢复时触发错误同步 |

**v0.9.8 建议**：上述设计直接沿用。TeamClaw 的 `lib/slot-sync.ts`（§5.2 规划）应以此为基础实现。

#### 18.2.2 踩过的坑 → v0.9.8 防御措施

| 坑 | 现象 | 根因 | GrowthPilot 解法 | v0.9.8 改进方案 |
|----|------|------|-----------------|-------------|
| **正则 lastIndex** | 全局正则第二次匹配失败 | `MD_SLOT_REGEX` 是 `/g` 模式，`lastIndex` 不重置 | 每次匹配前 `MD_SLOT_REGEX.lastIndex = 0` | 改用非全局正则 + `String.matchAll()` |
| **DOMParser 序列化** | `parser.parseFromString` 后 `outerHTML` 丢失 `<!DOCTYPE>` | DOMParser 不保留 doctype | 手动拼接 `'<!DOCTYPE html>\n' + doc.documentElement.outerHTML` | 同上，但考虑用 `XMLSerializer` |
| **innerHTML 注入** | richtext slot 同步时 XSS 风险 | `simpleMarkdownToHtml` 直接拼接 HTML | 仅支持有限标签（strong/em/a/br） | 必须经 DOMPurify 清洗（§16.2.1），白名单标签。v0.9.8 已扩展 `simpleMdToHtml()` 支持标题/列表/引用/表格/代码块/水平线/删除线，配套 `MD_RICHTEXT_STYLES` 样式表自动注入 |
| **isInternalChange 标记** | iframe 内编辑触发 onChange → 又重新加载 iframe → 闪烁 | content 变化触发 useEffect 重新 srcdoc | `isInternalChange.current = true` 标记内部变化，跳过 useEffect | 同样需要此标记，但用 TypeScript 严格类型约束 |
| **syncLock 时序** | 快速连续编辑时 50ms 锁过短，偶尔漏掉 | setTimeout 50ms 可能在高频输入时不够 | 基本够用（500ms debounce 兜底） | 增加到 100ms 或改用 microtask + 防抖双重保护 |

#### 18.2.3 v0.9.8 useSlotSync 设计要点

基于 GrowthPilot 经验，TeamClaw v0.9.8 的 `hooks/useSlotSync.ts` 应遵循：

```typescript
// 关键设计约束（来自 GrowthPilot 踩坑）
interface SlotSyncOptions {
  debounceMs: number;        // 同步防抖（默认 300ms，GrowthPilot 用 50ms 偏短）
  lockTimeoutMs: number;     // 互斥锁超时（默认 100ms）
  sanitize: boolean;         // richtext 清洗开关（v0.9.8 强制 true）
  onSlotChange?: (slotName: string, value: string) => void;  // GrowthPilot 无此回调，v0.9.8 需要用于实时保存
}
```

### 18.3 核心经验：图片导出（ExportModal）

GrowthPilot-editor 的 `ExportModal.jsx`（679 行）是踩坑第二多的模块。

#### 18.3.1 导出流程中的关键问题

| 问题 | 现象 | 解法 | v0.9.8 注意事项 |
|------|------|------|-------------|
| **字体丢失** | 导出图片中 Material Icons 和 Inter 字体显示为方块 | 运行时 fetch 字体 woff2 → base64 → 注入 @font-face | v0.9.8 使用 lucide（SVG 图标），无此问题；但自定义字体仍需处理 |
| **嵌套 iframe 重影** | Logo 组件是 iframe，导出时出现双重渲染 | 将 iframe 内容内联替换为 div，filter 函数排除所有 iframe | v0.9.8 模板禁止嵌套 iframe（在 §16.2.1 HTML 清洗时移除） |
| **tracking-widest 偏移** | Tailwind `tracking-widest` 在导出图中字距与预览不同 | 导出前强制计算 `fontSize * 0.1` 并内联为 px 值 | v0.9.8 模板 CSS 应避免 em 单位的 letter-spacing，改用 px |
| **资源加载等待** | 图片/字体未加载完就截图，导致空白 | `await setTimeout(2500)` 硬等待 | v0.9.8 应改为 `document.fonts.ready` + 图片 `onload` Promise.all |
| **长图高度计算** | scrollHeight 有时返回 0 或不准确 | 取 body + html 的 scrollHeight/offsetHeight/clientHeight 最大值，兜底 800px | 沿用 |

#### 18.3.2 `html-to-image` vs `html2canvas` 选型

GrowthPilot 使用了 `html-to-image`（1.11），v0.9.8 规划（§17.3）写的是 `html2canvas`。对比：

| 维度 | html-to-image | html2canvas |
|------|--------------|-------------|
| 体积 | ~50KB（极轻） | ~1.5MB |
| 原理 | SVG foreignObject → Canvas | 重新绘制 DOM 到 Canvas |
| CSS 支持 | 支持 backdrop-filter/blur | 不支持 backdrop-filter/blur |
| 跨域图片 | 支持 `cacheBust` | 需要代理 |
| 字体 | 需要手动内嵌 | 需要手动内嵌 |
| 已知问题 | Safari 偶尔白屏 | 样式还原度约 80% |

**GrowthPilot 实测结论**：`html-to-image` 的 `toJpeg` 在支持 CSS 特效方面更好（`backdrop-filter`、`blur` 等暗色主题常用效果），且体积远小于 `html2canvas`。

**v0.9.8 建议**：将 §17.3 中的 `html2canvas`（~1.5M）替换为 `html-to-image`（~50KB），减少 1.45M 体积，且 CSS 还原度更高。

### 18.4 核心经验：iframe 可视化编辑（HtmlPane）

GrowthPilot-editor 的 `HtmlPane.jsx`（681 行）实现了 iframe 内的所见即所得编辑。

#### 18.4.1 iframe 通信架构

```
┌─────────────────────────────────┐      postMessage       ┌──────────────────────────────┐
│         父窗口 (React)           │◄─────────────────────►│      iframe (渲染模板)         │
│                                 │                        │                              │
│ HtmlPane.jsx                    │  elementSelected       │  注入脚本:                    │
│  ├ 接收: elementSelected        │  contentChanged        │  ├ initElements()            │
│  ├ 接收: contentChanged         │  previewLocate         │  ├ selectElement()           │
│  ├ 接收: previewLocate          │  elementDeselected     │  ├ deselectElement()         │
│  ├ 发送: setStyle              │  ──────────────►       │  ├ replaceImage()            │
│  ├ 发送: setText               │  setStyle              │  └ notifyChange() (100ms防抖) │
│  ├ 发送: replaceImage          │  setText               │                              │
│  └ 发送: toggleEditMode        │  toggleEditMode        │  两种模式:                    │
│                                 │  replaceImage          │  ├ 预览模式: 点击定位到MD     │
│ PropertyPanel.jsx               │                        │  └ 编辑模式: 双击编辑/替换    │
│  └ 属性修改 → sendStyleCommand  │                        │                              │
└─────────────────────────────────┘                        └──────────────────────────────┘
```

#### 18.4.2 已验证有效的设计

| 设计决策 | 具体做法 | v0.9.8 沿用？ |
|---------|---------|------------|
| **srcdoc 而非 blob URL** | `iframe.srcdoc = html` 而非 `URL.createObjectURL(blob)` | ✅ 沿用。blob URL 有 sandbox 脚本限制 |
| **预览/编辑双模式** | 默认预览模式（点击定位 MD），手动切换编辑模式 | ✅ 沿用。避免误操作 |
| **注入脚本后清理** | onChange 时正则清理注入的 script/contenteditable/data-editable 等 | ✅ 沿用。但 v0.9.8 用 TypeScript 封装为工具函数 |
| **块级子元素跳过** | 含 div/p/h1-6 等块级子元素的容器不设为可编辑 | ✅ 沿用。编辑块级容器会破坏 DOM 结构 |
| **notifyChange 防抖 100ms** | iframe 内编辑后 100ms 防抖再 postMessage | ✅ 沿用 |
| **设备模拟** | 锁定 iframe 宽高 + transform scale 缩放 | ✅ 沿用。PC(1920×1080) / Mobile(1024×1366) |
| **ResizeObserver** | 容器尺寸变化时自适应缩放 | ✅ 沿用 |

#### 18.4.3 踩过的坑 → v0.9.8 防御措施

| 坑 | 现象 | 根因 | v0.9.8 防御 |
|----|------|------|----------|
| **class 清理正则过度** | 清理 `element-selected` 时误删其他类名 | 正则 `class="([^"]*)"` 全局替换不够精确 | 用 DOMParser 操作 classList，不用正则 |
| **pointerEvents 层级** | 图片容器的子元素接收了点击事件 | 子元素默认 pointerEvents: auto | 图片容器子元素统一设 `pointerEvents: 'none'` |
| **contenteditable 焦点** | 双击编辑后 blur 事件不触发 | Safari 下 contenteditable 行为不一致 | 增加 `focusout` 事件作为 blur 备选 |
| **空 class 属性残留** | 清理后产生 `class=""` 空属性 | 正则替换后未清理空属性 | 统一由 clean 工具函数处理 |

### 18.5 核心经验：Know-how 分层知识库

GrowthPilot-editor 的 SkillMemory 系统（分层知识库 + 学习闭环 + 知识管家）是 v0.9.8 SOP 引擎 Know-how 模块（§6）的直接前身。

#### 18.5.1 已验证的分层设计

| 层级 | 内容 | 大小 | 读取时机 | 实际效果 |
|------|------|------|---------|---------|
| L1 核心规则 | 公式、定义、评分标准 | ~200 tokens | 每次启动 | 保证一致性 |
| L2 详细标准 | 各维度评估细则 | ~500 tokens | 分析阶段 | 按需加载，省 40%+ |
| L3 案例库 | 参考案例 | ~300 tokens/案例 | 建议生成阶段 | 精准匹配 |
| L4 经验记录 | 用户修正、偏好 | 动态增长 | 复核阶段（读+写） | **核心价值：越用越好** |
| L5 维护状态 | 计数器、清理日期 | ~50 tokens | 系统维护 | 自动触发整理 |

**v0.9.8 影响**：§6 的 Know-how 知识库和 §4.3 的 `knowledgeLayers` 直接采用此 L1-L5 分层设计。

#### 18.5.2 实际使用中发现的问题

| 问题 | 严重度 | 详情 | v0.9.8 对策 |
|------|--------|------|----------|
| **阶段跳跃** | 高 | LLM 跳过 L2/L3 直接输出结论 | SOP 引擎强制阶段流转（`advance_sop_stage` MCP），代码级控制 |
| **确认点遗漏** | 高 | AI 该等用户确认时自行推进 | `ai_with_confirm` 类型阶段强制等 `request_sop_confirm` |
| **经验格式不一致** | 中 | AI 追加到 L4 的内容格式凌乱 | v0.9.8 经验记录存入 DB 表，schema 强约束格式 |
| **知识冲突无检测** | 中 | 新经验与旧规则矛盾 | 知识管家 Skill 的冲突检测机制（GrowthPilot 已设计完整流程） |
| **跨 Skill 知识重复** | 中 | 多个 Skill 有重叠知识 | 共享知识库（`shared-know-how`）机制 |

#### 18.5.3 Skill 痛点分析 → SOP 引擎设计决策

来自 `docs/Skill痛点需求分析.md` 的 23 个痛点中，v0.9.8 SOP 引擎重点解决的：

| 痛点类别 | GrowthPilot 解决率 | v0.9.8 SOP 引擎解决率 | 关键改进 |
|---------|-------------------|--------------------|---------| 
| 上下文管理 | 🟢 60%（分层加载） | 🟢 80%（+ DB 存储 + 服务端知识库） | 知识库从文件系统 → DB |
| 流程控制 | 🟡 40%（靠 LLM 遵循） | 🟢 90%（代码级强制阶段流转） | 核心突破：`advance_sop_stage` 替代"请 AI 自觉" |
| 规则管理 | 🟢 60%（Skill 分离） | 🟢 80%（+ MCP 注册制 + 权限） | MCP 工具注册制（§16.3.2） |
| 知识库维护 | 🟡 30%（有规范无执行） | 🟢 70%（知识管家 + DB 版本管理） | 结构化 DB + 版本管理 |
| 用户体验 | 🟡 50%（TodoList + 检查点） | 🟢 85%（UI 进度条 + 实时状态） | 前端可视化阶段进度 |

### 18.6 GrowthPilot 技术选型决策复盘

| 选型 | GrowthPilot 用了 | 效果 | v0.9.8 是否沿用 | 理由 |
|------|-----------------|------|-------------|------|
| CodeMirror 6 | ✅ MD 编辑器 | 好（语法高亮 + 槽位高亮） | ❌ 暂不引入 | 体积 ~2M，现有 textarea 够用；v3.1+ 按需引入 |
| `marked` | ✅ MD→HTML 解析 | 好 | ❌ 用 `react-markdown` | 已有，无需重复引入 |
| `turndown` | ✅ HTML→MD 转换 | 仅用于初始化 | ❌ 不需要 | 基于 slot 的精确同步不需要通用 HTML→MD |
| `html-to-image` | ✅ 图片导出 | 优秀（CSS 还原度高） | ✅ **替换** §17.3 的 `html2canvas` | 体积 50KB vs 1.5MB，且支持 backdrop-filter |
| Material Icons | ✅ 图标 | 需要字体内嵌（导出时） | ❌ 用 `lucide-react` | SVG 图标无字体依赖 |
| localStorage | ✅ 版本管理 | 勉强可用（单机限制） | ❌ 用 DB | 多用户 + 持久化 |
| Vite 插件扫描 | ✅ 文件索引 | 仅开发模式可用 | ❌ 用 API Route | 生产环境兼容 |

### 18.7 对 §17 技术依赖规划的修正

基于 GrowthPilot-editor 经验，对 §17.3 做以下修正：

| 修正项 | 原规划 | 修正为 | 理由 |
|--------|--------|--------|------|
| Phase C 图片导出 | `html2canvas`（~1.5M） | `html-to-image`（~50KB） | GrowthPilot 实测 CSS 还原度更高，体积减少 97% |
| Phase C HTML 清洗 | `dompurify`（~0.3M） | `dompurify`（~0.3M）**不变** | GrowthPilot 手写白名单，但 v0.9.8 多用户场景需更严格的 CSP |

§17.5 体积预测修正：Phase C 新增从 +1.8M → +0.35M（dompurify 0.3M + html-to-image 0.05M）。

### 18.8 移植优先级清单

| 优先级 | 移植内容 | 来源文件 | v0.9.8 目标文件 | Phase |
|--------|---------|---------|-------------|-------|
| **P0** | 槽位同步核心逻辑 | `src/hooks/useSync.js` | `lib/slot-sync.ts` + `hooks/useSlotSync.ts` | C |
| **P0** | iframe postMessage 通信协议 | `src/components/HtmlPane.jsx` | `components/studio/HtmlPreview.tsx` | C |
| **P0** | 模板 slot 标记规范 | `public/templates/_schema.json` | `docs/technical/TEMPLATE_SPEC.md` + DB schema | C |
| **P1** | 图片导出流程 | `src/components/ExportModal.jsx` | `components/studio/ExportModal.tsx` | C |
| **P1** | 属性面板 | `src/components/PropertyPanel.jsx` | `components/studio/PropertyPanel.tsx` | C |
| **P1** | Know-how 分层读取 | `SkillMemory/` + `docs/Skill外挂知识库-流程说明.md` | SOP 引擎知识库层 | A/B |
| **P2** | 版本管理（改用 DB） | `src/components/VersionPanel.jsx` | Wiki 版本系统增强 | C |
| **P2** | 设备模拟预览 | `HtmlPane.jsx` 设备模式 | `HtmlPreview.tsx` | C |
| **P3** | CodeMirror 集成 | `src/components/MarkdownPane.jsx` | 延后到 v3.1+ | v3.1+ |

---

## 19. 文档更新计划

> v0.9.8 引入 SOP 引擎、Content Studio、多用户、在线数据库等重大变更，现有 16 个文档文件需要按阶段同步更新。

### 19.1 文档更新矩阵

| 文档 | 当前版本 | 更新阶段 | 更新内容 | 优先级 |
|------|---------|---------|---------|--------|
| **`docs/product/PRD.md`** | v0.x | Phase A | 产品定位升级（§1.2）、新增 SOP/Studio 模块说明、页面路由更新（§11）、数据库表清单更新（19→25 张）、技术栈新增依赖 | **P0** |
| **`docs/product/USER_GUIDE.md`** | v0.3.9 | Phase B/C | 新增 SOP 使用指南章节、Content Studio 编辑教程、渲染模板说明、MCP 新增 9 个工具文档、Know-how 知识库使用说明 | **P0** |
| **`docs/product/UI_DESIGN_SPEC.md`** | v0.x | Phase B | 新增 `/sop` 页面设计规格、Content Studio 双栏模式 UI 规格、SOP 进度条组件规格、Sidebar 导航新增 SOP 入口 | **P1** |
| **`docs/technical/API.md`** | v0.x | Phase A | 新增 `/api/sop-templates` 4 个端点、`/api/render-templates` 4 个端点、Phase E 新增 `/api/auth/*`、`/api/users/*` 端点 | **P0** |
| **`docs/technical/DEVELOPMENT.md`** | v0.x | Phase A | 架构章节新增 SOP 引擎层、Store 章节新增 2 个 Store、数据库章节更新表数量和 Schema、MCP 章节更新工具数量 | **P0** |
| **`docs/technical/COMPONENTS.md`** | v0.x | Phase B/C | 新增 `components/sop/` 组件文档（5 个）、`components/studio/` 组件文档（4 个）、新增 hooks 文档（useSlotSync、useStudioHistory） | **P1** |
| **`docs/technical/OPENCLAW_SYNC_DESIGN.md`** | v0.x | Phase A | SOP 执行与 Gateway 交互的数据流补充、新增 SOP 推送场景的同步设计 | **P2** |
| **`docs/openclaw/CLAUDE.md`** | v0.x | Phase A | 新增 SOP 相关实体映射（sop_templates → Gateway）、AI 创建 SOP/渲染模板的约束说明 | **P1** |
| **`docs/openclaw/WORKSPACE_STANDARD.md`** | v0.x | Phase A | 新增 SOP 模板的协作规范、渲染模板的 HTML 安全约束 | **P1** |
| **`docs/process/CHANGELOG.md`** | v0.3.9 | 每个 Phase 发布时 | 按 Phase 追加变更条目（v0.4.6/v0.5.4/v0.6.2/v0.7.0/v0.9.8） | **P0** |
| **`docs/process/REQUIREMENTS.md`** | REQ-006 | Phase A | 新增 REQ-007（SOP 引擎）、REQ-008（Content Studio）、REQ-009（多用户管理）、REQ-010（在线数据库），REQ-005 标记为 completed | **P0** |
| **`docs/process/TECH_DEBT.md`** | TD-011 | Phase A/E | TD-006（文件拆分）在 v0.9.8 中处理、TD-009（统计面板）由 Phase E E4 覆盖、TD-010（插件机制）标记为 v3.x+、新增 v0.9.8 产生的技术债 | **P1** |
| **`docs/product/PROMOTION.md`** | v0.x | Phase D | 更新产品定位描述、新增 SOP 引擎和 Content Studio 的推广卖点 | **P2** |
| **`docs/clawhub-security-appeal.md`** | v0.x | Phase E | 多用户认证后更新安全说明（NextAuth、密码哈希、CSRF） | **P2** |
| **`docs/archive/DEVELOPMENT_V1_MIGRATION.md`** | 归档 | 不更新 | 历史归档，无需变更 | - |
| **`README.md` + `README_zh.md`** | v0.x | Phase D | 版本号更新、功能亮点新增 SOP/Studio、截图更新 | **P0** |
| **`CODING_STANDARDS.md`** | v0.x | Phase A | 新增 SOP 相关编码规范（模板校验、阶段状态机）、Content Studio HTML 安全规范 | **P1** |
| **`CODEBUDDY.md`** | v0.x | Phase D | 更新架构描述、表数量、MCP 工具数、Store 数量、组件列表 | **P1** |

### 19.2 新增文档

| 文档 | 阶段 | 内容 |
|------|------|------|
| `docs/technical/SOP_ENGINE.md` | Phase B | SOP 引擎技术文档：状态机、阶段流转、推送机制、知识库集成 |
| `docs/technical/CONTENT_STUDIO.md` | Phase C | Content Studio 技术文档：slot 同步机制、iframe 通信、导出流程 |
| `docs/technical/TEMPLATE_SPEC.md` | Phase C | 渲染模板规范：slot 标记语法、安全约束、模板 Schema |
| `docs/technical/AUTH_DESIGN.md` | Phase E | 认证授权设计：NextAuth 集成、RBAC、MCP Token、COWORK 认证 |
| `docs/technical/MIGRATION_GUIDE.md` | Phase E | 升级迁移指南：v0.3.9→v0.9.8 数据迁移步骤、SQLite→PG 迁移 |

### 19.3 文档更新时间线

```
Phase A (v0.4.6):  PRD + API + DEVELOPMENT + REQUIREMENTS + CODING_STANDARDS + OpenClaw 文档
Phase B (v0.5.4):  UI_DESIGN_SPEC + COMPONENTS + SOP_ENGINE.md（新）
Phase C (v0.6.2):  COMPONENTS(Studio) + CONTENT_STUDIO.md（新）+ TEMPLATE_SPEC.md（新）
Phase D (v0.7.0):  USER_GUIDE + PROMOTION + README + CODEBUDDY + CHANGELOG
Phase E (v0.9.8):  AUTH_DESIGN.md（新）+ MIGRATION_GUIDE.md（新）+ clawhub-security-appeal + TECH_DEBT
```

---

## 20. Skill 更新计划

> 当前 `skills/teamclaw/` 包含 1 个核心 SKILL.md（v0.3.9, 1143 行）+ 12 个 references 模板 + 1 个 Python 脚本。v0.9.8 需要全面更新以覆盖 SOP 引擎和 Content Studio 能力。

### 20.1 `skills/teamclaw/SKILL.md` 更新清单

| 章节 | 当前内容 | v0.9.8 更新 | 阶段 |
|------|---------|----------|------|
| 版本号 | v0.3.9 | 按 Phase 递增：v0.4.6 → v0.5.4 → ... → v0.9.8 | 每个 Phase |
| 交互通道架构 | 三通道（Actions/MCP/文档同步） | 不变，但补充 SOP 专用通道说明 | Phase A |
| MCP 工具清单 | 30 个工具 | 新增 9 个 SOP/创作工具的调用说明和参数示例 | Phase A |
| Actions 清单 | 现有 Actions | 新增 9 个 SOP Actions 的格式和使用场景 | Phase A |
| **新增：SOP 执行场景** | 无 | 完整的 SOP 执行流程指引（接收 SOP 任务 → 按阶段执行 → 请求确认 → 推进 → 交付） | Phase B |
| **新增：渲染模板创建场景** | 无 | AI 自主创建 HTML 渲染模板的指引（slot 规范、安全约束、CSS 内联要求） | Phase C |
| **新增：SOP 模板创建场景** | 无 | AI 自主设计和创建 SOP 模板的指引（阶段设计原则、类型选择策略） | Phase B |
| **新增：Know-how 读写场景** | 无 | 知识库分层读取/写入指引（L1-L5 分层策略、`update_knowledge` 使用规范） | Phase D |
| **新增：Content Studio 协作场景** | 无 | AI 在 Content Studio 模式下的编辑协作指引（通过 Chat 接收编辑指令、slot 内容更新） | Phase C |
| 枚举值速查表 | 现有枚举 | 新增 SOP 相关枚举（SOPCategory、StageType、SOPStageStatus 等） | Phase A |
| 验证场景清单 | 6 个场景 | 扩展到 10+ 个（新增 SOP 执行、模板创建、知识库写入、Content Studio 协作等） | Phase D |

### 20.2 新增 references 模板

| 模板文件 | 阶段 | 用途 |
|---------|------|------|
| `references/sop-task-push.md` | Phase A | SOP 任务推送模板——推送 SOP 任务时注入阶段信息、工具清单、知识库上下文 |
| `references/sop-confirm-request.md` | Phase A | SOP 确认请求模板——AI 请求人工确认时的消息格式 |
| `references/sop-stage-result.md` | Phase A | SOP 阶段结果模板——阶段完成时的结构化输出格式 |
| `references/sop-template-creation.md` | Phase B | SOP 模板创建指引——AI 创建 SOP 时的最佳实践和约束 |
| `references/render-template-creation.md` | Phase C | 渲染模板创建指引——HTML/CSS 编写规范、slot 标记要求、安全约束 |
| `references/knowhow-update.md` | Phase D | Know-how 更新指引——L4 经验写入的格式和触发条件 |

### 20.3 `scripts/render-template.py` 更新

| 变更 | 说明 | 阶段 |
|------|------|------|
| 新增 SOP 数据获取 | 支持从 `/api/sop-templates` 获取 SOP 模板数据 | Phase A |
| 新增 SOP 阶段渲染 | 支持渲染 SOP 阶段进度信息到模板 | Phase B |
| PostgreSQL 兼容 | 数据获取 API 兼容在线数据库场景 | Phase E |

### 20.4 `public/skills/` 公共 Skill 模板新增

当前 `public/` 包含 11 个通用 Skill 模板。v0.9.8 新增：

| 模板 | 阶段 | 说明 |
|------|------|------|
| `public/skills/templates/sop-task-push.md` | Phase A | 供 OpenClaw Gateway 推送 SOP 任务时使用 |
| `public/skills/templates/sop-confirm-request.md` | Phase A | 确认请求的标准消息模板 |
| `public/skills/templates/sop-stage-result.md` | Phase A | 阶段完成的标准输出模板 |

### 20.5 更新时间线

```
Phase A (v0.4.6):  SKILL.md 新增 MCP/Actions 清单 + 枚举值 + 3 个 references 模板
Phase B (v0.5.4):  SKILL.md 新增 SOP 执行场景 + SOP 创建场景 + 1 个 reference
Phase C (v0.6.2):  SKILL.md 新增 Content Studio 场景 + 渲染模板创建场景 + 1 个 reference
Phase D (v0.7.0):  SKILL.md 新增 Know-how 场景 + 验证场景扩展 + 1 个 reference + 版本号更新到 v0.7.0
Phase E (v0.9.8):  SKILL.md 版本号更新到 v0.9.8 + render-template.py 更新 + 全量 review
```

---

## 附录

### A. 文件结构预览

```
新增/修改文件：
├── app/
│   ├── sop/
│   │   ├── page.tsx                    # SOP 列表页
│   │   └── [id]/
│   │       └── edit/page.tsx           # SOP 编辑页
│   ├── api/
│   │   ├── sop-templates/
│   │   │   ├── route.ts               # GET + POST
│   │   │   └── [id]/route.ts          # GET + PUT + DELETE
│   │   └── render-templates/
│   │       ├── route.ts               # GET + POST
│   │       └── [id]/route.ts          # GET + PUT + DELETE
│   ├── tasks/page.tsx                  # 增强：SOP 选择 + 阶段进度
│   └── wiki/page.tsx                   # 增强：Content Studio 模式
├── components/
│   ├── sop/
│   │   ├── SOPList.tsx                 # SOP 列表
│   │   ├── SOPEditor.tsx               # SOP 编辑器
│   │   ├── SOPStageConfigurator.tsx     # 阶段配置器
│   │   ├── SOPProgressBar.tsx          # 阶段进度条
│   │   └── SOPInputForm.tsx            # 阶段输入表单
│   ├── studio/
│   │   ├── HtmlPreview.tsx             # HTML 预览面板
│   │   ├── PropertyPanel.tsx           # 属性面板
│   │   ├── ExportModal.tsx             # 导出对话框
│   │   └── StudioToolbar.tsx           # 工具栏
│   └── TaskDrawer.tsx                  # 增强：SOP 进度面板
├── hooks/
│   ├── useSlotSync.ts                  # MD ↔ HTML 槽位同步
│   └── useStudioHistory.ts             # 撤销/重做
├── store/
│   ├── sop.store.ts                    # SOP 模板 Store
│   └── render-template.store.ts        # 渲染模板 Store
├── lib/
│   ├── slot-sync.ts                    # 槽位同步核心逻辑
│   └── knowhow-parser.ts              # Know-how 分层解析
├── core/mcp/
│   ├── definitions.ts                  # 增强：9 个新工具定义
│   └── executor.ts                     # 增强：9 个新工具执行
├── app/api/mcp/handlers/
│   └── sop.handler.ts                  # SOP 相关 MCP 处理器（含模板创建/更新）
├── public/skills/templates/
│   ├── sop-task-push.md                # SOP 任务推送模板
│   ├── sop-confirm-request.md          # 确认请求模板
│   └── sop-stage-result.md             # 阶段结果模板
└── db/schema.ts                        # 增强：2 新表 + 扩展字段
```

### B. 术语表

| 术语 | 定义 |
|------|------|
| **SOP** | Standard Operating Procedure，标准操作流程 |
| **SOP 模板** | 可复用的流程定义，包含有序阶段列表和 AI 指令 |
| **阶段（Stage）** | SOP 中的一个执行步骤 |
| **槽位（Slot）** | 渲染模板中的可编辑占位符 |
| **渲染模板** | HTML/CSS 模板骨架，定义可视化输出的布局和样式 |
| **Know-how** | 分层知识库文档，按 L1-L5 组织历史经验 |
| **Content Studio** | Wiki 的增强编辑模式（双栏 MD+HTML，未来扩展图片/视频编辑） |
| **AI Provider** | AI 模型服务的抽象接口（LLM、图片模型、视频模型等） |
| **OutputType** | SOP 产出物类型枚举，v0.9.8 支持文字/HTML，v3.x+ 扩展图片/视频 |
| **StageType** | SOP 阶段类型枚举，v0.9.8 支持 7 种，v3.x+ 预留 4 种媒体类型 |
| **Asset Manager** | v3.x+ 统一资产管理层，管理文档/图片/视频等多媒体资产 |
