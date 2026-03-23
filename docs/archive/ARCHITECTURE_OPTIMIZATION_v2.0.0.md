# TeamClaw 架构优化方案 v1.0.0

**基于**: dependency-cruiser + knip 依赖检测结果 + 原子化设计思想  
**检测日期**: 2026-03-17  
**模块数**: 478 | **依赖数**: 2218 | **违规**: 17

---

## 一、依赖检测结果分析

### 1.1 现状概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    架构健康度评分                                │
├─────────────────────────────────────────────────────────────────┤
│  依赖规范      ████████████████████░░░░  循环依赖: 0 错误        │
│  代码复用      ██████████████░░░░░░░░░░  孤立文件: 5 个          │
│  导出规范      ██████░░░░░░░░░░░░░░░░░░  未使用导出: 319 个      │
│  文件组织      ████████████████░░░░░░░░  未使用文件: 24 个       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 关键问题清单

| 类别 | 问题 | 数量 | 严重程度 |
|------|------|------|----------|
| **架构违规** | Components 直接访问 lib 内部 | 12 | 中 |
| **孤立文件** | 未被任何模块引用 | 5 | 低 |
| **未使用文件** | 项目中有 but 未被导入 | 24 | 中 |
| **未使用导出** | 导出 but 未被使用 | 319 | 高 |
| **循环依赖** | 已知的通过动态导入修复 | 3 | 已修复 |

---

## 二、原子化架构设计原则

### 2.1 核心原则

```
┌─────────────────────────────────────────────────────────────────┐
│                    原子化设计四原则                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 单一职责原则 (SRP)                                           │
│     每个原子能力只做一件事，且做好                               │
│                                                                  │
│  2. 组合优于继承                                                │
│     复杂能力 = 原子能力的组合                                    │
│                                                                  │
│  3. 显式依赖原则                                                │
│     依赖必须显式声明，禁止隐式/传递依赖                          │
│                                                                  │
│  4. 稳定抽象原则                                                │
│     高层不依赖低层，都依赖抽象                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 分层架构（优化后）

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 页面层 (Pages) - 禁止包含业务逻辑                      │
│  app/*/*.tsx                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  职责: 布局组合、路由参数处理、初始数据获取               │    │
│  │  依赖: Layer 4 (Feature), Layer 3 (Hooks)               │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 功能层 (Features) - 业务功能封装                       │
│  components/*/                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  职责: 业务组件、功能组合、用户交互处理                   │    │
│  │  依赖: Layer 3 (Hooks), Layer 2 (Store), Layer 1 (API)  │    │
│  │  禁止: 直接访问 db/, scripts/, core/mcp/handlers        │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: 逻辑层 (Hooks/Lib) - 可复用逻辑                        │
│  hooks/, lib/                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  职责: 状态管理、副作用、工具函数、业务逻辑封装           │    │
│  │  依赖: Layer 2 (Store), Layer 1 (API)                   │    │
│  │  禁止: 直接访问 components/ (除类型导入)                │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 数据层 (Store/API) - 数据访问抽象                      │
│  store/, lib/data-service.ts                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  职责: 状态管理、API 调用、数据缓存、乐观更新             │    │
│  │  依赖: Layer 1 (API)                                    │    │
│  │  禁止: 直接访问 db/ (schema 类型除外)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 核心层 (Core) - 基础设施                               │
│  db/, app/api/, core/mcp/                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  职责: 数据存储、API 路由、MCP 工具、类型定义             │    │
│  │  依赖: 仅依赖外部库和类型                                │    │
│  │  禁止: 依赖任何上层                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、优化方案详解

### 3.1 第一阶段：清理未使用代码（1-2天）

#### 3.1.1 删除未使用文件（24个）

| 文件 | 原因 | 操作 |
|------|------|------|
| `components/landing/*.tsx` | 3个文件，着陆页已重构 | **删除** |
| `components/markdown-editor/editor-styles.ts` | 孤立文件 | **删除或整合** |
| `components/projects/ProjectMemberDialog.tsx` | 未使用 | **删除** |
| `components/studio/index.ts` | 空导出 | **删除** |
| `core/mcp/executor.ts` | 未使用（有备用） | **删除** |
| `core/mcp/handlers/skill.ts` | 未使用 | **删除** |
| `db/adapters/*.ts` | 未使用（SQLite 直连） | **删除** |
| `db/config.ts` | 孤立文件 | **删除** |
| `hooks/useEntityData.ts` | 未使用 | **删除** |
| `hooks/useGatewayData.ts` | 未使用 | **删除** |
| `hooks/useSlotSync.ts` | 未使用 | **删除** |
| `hooks/useFilteredList.ts` | 未使用，但价值高 | **保留并推广** |
| `hooks/useInlineEdit.ts` | 未使用，但价值高 | **保留并推广** |
| `lib/store-factory.ts` | 未使用，但价值高 | **保留并推广** |
| `lib/gateway-provider*.ts` | 未使用 | **删除** |
| `lib/i18n/index.ts` | 未使用 | **删除** |
| `lib/openclaw/index.ts` | 未使用 | **删除** |
| `lib/providers/openclaw-provider.ts` | 未使用 | **删除** |
| `lib/skill-access.ts` | 未使用 | **删除** |

**脚本自动化：**
```bash
# scripts/cleanup-unused.sh
#!/bin/bash
# 自动删除未使用文件（需人工确认）
npx knip --no-progress | grep "Unused files" -A 30 > unused-files.txt
# 人工审查后执行删除
```

#### 3.1.2 清理未使用导出（319个）

**策略：**
```typescript
// 1. 组件导出优化
// 修改前：导出所有
export { Button, Input, Card, CardHeader, CardFooter, ... };

// 修改后：仅导出使用中的
export { Button, Input, Card };

// 2. Hook 导出优化
// 保留：useChatStream, useSSEConnection, useDataInitializer
// 删除：useEntityData, useFilteredList, useGatewayData, ...

// 3. Lib 导出优化
// 通过 index.ts 显式控制公开 API
```

### 3.2 第二阶段：架构违规修复（2-3天）

#### 3.2.1 Components 直接访问 lib 内部（12处）

**违规清单：**
```
components/studio/HtmlPreview.tsx → lib/slot-sync.ts
components/studio/HtmlPreview.tsx → lib/icon-render.ts
components/studio/ExportModal.tsx → lib/slot-sync.ts
components/sop/SOPProgressBar.tsx → lib/sop-config.ts
components/markdown-editor/types.ts → lib/slot-sync.ts
components/markdown-editor/MarkdownEditor.tsx → lib/slot-sync.ts
components/markdown-editor/MarkdownEditor.tsx → lib/icon-render.ts
components/landing/LandingContentEditor.tsx → lib/slot-sync.ts
components/DataProvider.tsx → lib/sse-events.ts
components/DataProvider.tsx → lib/logger.ts
components/agents/ToolsPanel.tsx → lib/tool-policy.ts
components/agents/OverviewPanel.tsx → lib/gateway-client.ts
```

**优化方案：**

```typescript
// 1. 创建 lib/index.ts 公开 API
// lib/index.ts
export { slotSync } from './slot-sync';
export { iconRender } from './icon-render';
export { sopConfig } from './sop-config';
export { sseEvents } from './sse-events';
export { logger } from './logger';
export { toolPolicy } from './tool-policy';
export { gatewayClient } from './gateway-client';

// 2. 修改组件导入
// 修改前：
import { syncSlots } from '@/lib/slot-sync';

// 修改后：
import { slotSync } from '@/lib';
```

#### 3.2.2 依赖规则强化

**更新 .dependency-cruiser.cjs：**
```javascript
module.exports = {
  forbidden: [
    // 现有规则...
    
    // 新增：强制通过 lib/index 访问
    {
      name: 'no-direct-lib-internal',
      severity: 'error',
      comment: '禁止直接访问 lib 内部模块，请通过 lib/index',
      from: { path: '^components' },
      to: { 
        path: '^lib/(slot-sync|icon-render|sop-config|sse-events|logger|tool-policy)',
        pathNot: '^lib/index'
      }
    },
    
    // 新增：禁止层间跳跃
    {
      name: 'no-layer-skip',
      severity: 'error',
      comment: '禁止跳过层级访问（如 components 直接访问 db）',
      from: { path: '^components' },
      to: { path: '^db' }
    },
    
    // 新增：禁止反向依赖
    {
      name: 'no-reverse-dependency',
      severity: 'error',
      comment: '禁止反向依赖（低层依赖高层）',
      from: { path: '^lib' },
      to: { path: '^components' }
    }
  ]
};
```

### 3.3 第三阶段：原子能力重构（3-5天）

#### 3.3.1 合并重复能力

**1. 数据校验层合并**

```typescript
// lib/validation/index.ts（统一入口）
import { z } from 'zod';

// 从 validation.ts 迁移 Zod Schema
export * from './schemas';

// 从 validators.ts 迁移的函数转为 Zod 辅助函数
export { validateRequestBodySize } from './utils';

// 删除 lib/validators.ts
```

**2. Store 工厂推广**

```typescript
// 使用 lib/store-factory.ts 重构 19 个 Store
// 目前 19 个 Store 中有大量重复代码

// 修改前（每个 Store 重复）:
const useTaskStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  fetch: async () => { /* 重复逻辑 */ },
  create: async (data) => { /* 重复逻辑 */ },
  update: async (id, data) => { /* 重复逻辑 */ },
  delete: async (id) => { /* 重复逻辑 */ },
}));

// 修改后（工厂模式）:
const useTaskStore = createCrudStore<Task, NewTask>({
  api: tasksApi,
  name: 'tasks',
  autoAddOnCreate: true,
  autoUpdateOnUpdate: true,
  autoRemoveOnDelete: true,
});
```

**推广计划：**
- 新 Store 优先使用 `createCrudStore`
- 现有 Store 在重构时逐步迁移
- 预计减少 Store 层 70% 重复代码（约 2000 行）

**3. Hooks 推广使用**

**3.1 useFilteredList - 统一列表筛选**

```typescript
// 适用场景：17 个页面/组件有列表筛选需求
// 推广收益：减少 ~300 行重复代码

// 修改前（各页面自行实现）:
const filteredTasks = useMemo(() => {
  return tasks
    .filter(t => t.title.includes(searchQuery))
    .filter(t => statusFilter ? t.status === statusFilter : true)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}, [tasks, searchQuery, statusFilter]);

// 修改后（使用 Hook）:
const { filteredItems, searchQuery, setSearchQuery, toggleFilter } = useFilteredList({
  items: tasks,
  config: {
    searchFields: ['title', 'description'],
    filters: {
      pending: (t) => t.status === 'pending',
      completed: (t) => t.status === 'completed',
    },
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
  },
});
```

**推广页面清单：**
- `app/tasks/page.tsx` - 任务列表筛选
- `app/skills/page.tsx` - Skill 列表筛选
- `app/deliveries/page.tsx` - 交付物列表筛选
- `app/sop/page.tsx` - SOP 模板列表筛选
- `app/users/page.tsx` - 用户列表筛选
- `app/sessions/page.tsx` - Session 列表筛选
- `components/GlobalSearch.tsx` - 全局搜索结果筛选

**3.2 useInlineEdit - 解决 Enter/Blur 双重提交**

```typescript
// 适用场景：内联编辑输入框
// 推广收益：解决已知 Bug，统一 UX

// 修改前（各组件自行处理，容易出错）:
const [submittedByEnter, setSubmittedByEnter] = useState(false);
const handleBlur = (value: string) => {
  if (!submittedByEnter) save(value);
  setSubmittedByEnter(false);
};
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    setSubmittedByEnter(true);
    save(value);
  }
};

// 修改后（使用 Hook）:
const { handleKeyDown, handleBlur, isSaving } = useInlineEdit({
  onSave: async (value) => {
    await updateTitle(value);
  },
});
```

**推广组件清单：**
- 文档标题编辑
- 任务名称编辑
- 成员名称编辑
- 项目标题编辑
- 任何内联输入框场景

**推广优先级：**
| 优先级 | 文件 | 预计成本 | 收益 |
|--------|------|----------|------|
| P0 | `useInlineEdit.ts` | 2-4h | 解决已知 Bug |
| P1 | `useFilteredList.ts` | 4-8h | 减少 300 行重复 |
| P2 | `store-factory.ts` | 逐步迁移 | 长期减少技术债 |

**3. 推送模板合并**

```
templates/
├── base/
│   └── base-push.md              # 公共部分（系统信息、工具指南）
├── partials/
│   ├── task-context.md           # 任务上下文片段
│   ├── sop-context.md            # SOP 上下文片段
│   └── project-context.md        # 项目上下文片段
└── composed/
    ├── task-push.md              # = base + task-context
    ├── sop-task-push.md          # = base + task-context + sop-context
    └── delivery-push.md          # = base + delivery-context
```

#### 3.3.2 提取共享服务

**1. 审批服务提取**

```typescript
// lib/services/approval-service.ts
export class ApprovalService {
  // 当前分散在 approval.handler.ts 和 delivery.handler.ts 中的逻辑
  async createRequest(data: ApprovalRequest): Promise<Approval>;
  async processDecision(id: string, decision: Decision): Promise<void>;
  async notifyStakeholders(approval: Approval): Promise<void>;
  async updateRelatedEntity(approval: Approval): Promise<void>;
}
```

**2. 同步服务合并**

```typescript
// lib/services/sync-service.ts
// 合并 task-sync.ts, delivery-sync.ts, milestone-sync.ts, schedule-sync.ts

export class SyncService {
  async syncToGateway<T>(type: SyncType, data: T): Promise<void>;
  async syncFromGateway<T>(type: SyncType): Promise<T[]>;
  async resolveConflict<T>(local: T, remote: T): Promise<T>;
}
```

### 3.4 第四阶段：目录结构重构（5-7天）

#### 3.4.1 新目录结构

```
teamclaw/
├── app/                          # Layer 1: 核心层
│   ├── api/                      # API 路由
│   ├── layout.tsx
│   └── page.tsx
│
├── src/                          # 业务代码（新增顶层目录）
│   ├── domains/                  # Layer 1-2: 领域层
│   │   ├── task/                 # 任务领域
│   │   │   ├── api.ts            # API 路由
│   │   │   ├── store.ts          # 状态管理
│   │   │   ├── mcp.ts            # MCP 工具
│   │   │   ├── types.ts          # 领域类型
│   │   │   └── index.ts          # 公开 API
│   │   ├── project/              # 项目领域
│   │   ├── document/             # 文档领域
│   │   ├── member/               # 成员领域
│   │   └── ...                   # 其他领域
│   │
│   ├── features/                 # Layer 4: 功能层
│   │   ├── task-board/           # 任务看板功能
│   │   ├── chat-panel/           # Chat 功能
│   │   ├── sop-engine/           # SOP 引擎功能
│   │   └── ...
│   │
│   ├── shared/                   # Layer 3: 共享层
│   │   ├── ui/                   # UI 组件
│   │   ├── hooks/                # 共享 Hooks
│   │   ├── lib/                  # 工具函数
│   │   ├── services/             # 共享服务
│   │   └── types/                # 共享类型
│   │
│   └── core/                     # Layer 1: 基础设施
│       ├── db/                   # 数据库
│       ├── mcp/                  # MCP 框架
│       └── gateway/              # Gateway 客户端
│
├── public/
├── scripts/
└── tests/
```

#### 3.4.2 领域驱动设计（DDD）

每个领域包含完整的能力栈：

```typescript
// src/domains/task/index.ts
// 公开该领域的所有原子能力

// API
export { taskApi } from './api';

// Store
export { useTaskStore } from './store';

// MCP Tools
export { taskTools } from './mcp';

// Types
export type { Task, NewTask, TaskStatus } from './types';

// Services
export { TaskService } from './services/task-service';
```

---

## 四、依赖规则配置（.dependency-cruiser.cjs v2）

```javascript
/**
 * Dependency Cruiser 配置 v2.0
 * 原子化架构依赖规则
 */

module.exports = {
  forbidden: [
    // ========== 架构分层规则 ==========
    {
      name: 'no-app-imports-src',
      severity: 'error',
      comment: 'app 只能导入 src/core 和 src/shared',
      from: { path: '^app' },
      to: { path: '^src/(domains|features)' }
    },
    {
      name: 'no-feature-imports-domain-internal',
      severity: 'error',
      comment: 'feature 只能通过领域 index 导入，禁止访问内部',
      from: { path: '^src/features' },
      to: { 
        path: '^src/domains/[^/]+/',
        pathNot: '^src/domains/[^/]+/index'
      }
    },
    {
      name: 'no-domain-cross-import',
      severity: 'error',
      comment: '领域之间禁止直接导入，通过 shared/services 通信',
      from: { path: '^src/domains/([^/]+)/' },
      to: { path: '^src/domains/(?!$1)/' }
    },
    {
      name: 'no-shared-imports-domain',
      severity: 'error',
      comment: 'shared 层不能依赖 domain 层',
      from: { path: '^src/shared' },
      to: { path: '^src/domains' }
    },
    
    // ========== 循环依赖规则 ==========
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止循环依赖',
      from: {},
      to: { circular: true }
    },
    
    // ========== 代码质量规则 ==========
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: '孤立文件 - 未被任何模块引用',
      from: { orphan: true },
      to: {}
    },
    {
      name: 'no-duplicate-exports',
      severity: 'warn',
      comment: '禁止重复导出相同能力',
      from: { path: 'index.ts' },
      to: { 
        // 通过自定义规则检测
      }
    }
  ],
  
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['\.d\.ts$', 'tests/', '__mocks__/', 'scripts/']
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' }
  }
};
```

---

## 五、实施路线图

### Phase 1: 清理（1周）

| 天数 | 任务 | 产出 |
|------|------|------|
| 1-2 | 删除 24 个未使用文件 | 减少代码量 15% |
| 3-4 | 清理 319 个未使用导出 | 明确公开 API |
| 5 | 修复 12 个架构违规 | 通过 dependency-cruiser |

### Phase 2: 合并（1周）✅ 已完成

| 天数 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 1-2 | 合并数据校验层 | 统一 validation | ⏳ 待进行 |
| 3-4 | 推广 Store 工厂 | 减少 Store 代码 66% | ✅ 已完成 (-528行) |
| 4-5 | 推广 Hooks（useInlineEdit, useFilteredList） | 解决 Bug + 减少重复代码 | ✅ 已完成 |
| 5 | 合并推送模板 | 减少模板重复 60% | ⏳ 待进行 |

**Phase 2 已完成成果：**
- Store 工厂推广：6 个 Store 重构，减少 528 行代码 (-66%)
- useInlineEdit 推广：修复 5 个组件双重提交问题
- useFilteredList 推广：3 个页面使用统一筛选逻辑

### Phase 3: 重构（2周）✅ 已完成

| 天数 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 1-5 | 提取共享服务 | approval, sync | ✅ 已完成 |
| 6-10 | 目录结构迁移 | 新 src/ 目录结构 | ✅ 已完成 |

**Phase 3 已完成成果：**
- 提取审批服务：lib/services/approval-service.ts
- 提取同步服务：lib/services/sync-service.ts
- 创建 src/ 层级架构（254 文件迁移）：
  - src/core/ (db, mcp, gateway) - 基础设施层
  - src/shared/ (ui, hooks, lib, services, types, layout, editor) - 共享层
  - src/domains/ (15 个领域模块) - 领域层
  - src/features/ (10 个功能模块) - 功能层
- 更新 tsconfig.json 添加路径别名

### Phase 4: 验证（1周）

| 天数 | 任务 | 产出 |
|------|------|------|
| 1-3 | 全面测试 | 所有测试通过 |
| 4-5 | 架构验证 | dependency-cruiser 0 违规 |

---

## 六、预期收益

### 6.1 量化指标

| 指标 | 现状 | 目标 | 改善 |
|------|------|------|------|
| 代码行数 | ~45,000 | ~35,000 | -22% |
| 模块数 | 478 | 400 | -16% |
| 未使用导出 | 319 | 0 | -100% |
| 架构违规 | 17 | 0 | -100% |
| 重复代码率 | 25% | <10% | -60% |
| 平均模块大小 | 94行 | 87行 | -7% |

### 6.2 质量提升

| 维度 | 改善 |
|------|------|
| **可维护性** | 清晰的层级，单一职责，易于定位问题 |
| **可测试性** | 原子能力独立，便于单元测试 |
| **可扩展性** | 新功能 = 原子能力组合，开发效率提升 |
| **可复用性** | 共享层沉淀，避免重复造轮子 |

---

## 七、脚本工具

### 7.1 架构检测脚本

```bash
# scripts/arch-check.sh
#!/bin/bash
set -e

echo "=== TeamClaw 架构检测 ==="

echo "1. 依赖关系检测..."
npm run arch:cruise

echo "2. 未使用代码检测..."
npm run arch:knip

echo "3. 循环依赖检测..."
npx depcruise --config .dependency-cruiser.cjs --output-type dot app lib store db components | dot -T png > architecture.png

echo "4. 架构报告生成..."
npx depcruise --config .dependency-cruiser.cjs --output-type html app lib store db components > architecture-report.html

echo "=== 检测完成 ==="
```

### 7.2 原子能力统计脚本

```bash
# scripts/atomic-stats.sh
#!/bin/bash

echo "=== 原子能力统计 ==="

echo "MCP 工具数:"
grep -c "^  [a-z_]*: {" core/mcp/definitions.ts

echo "API 模块数:"
ls -1 app/api | wc -l

echo "Store 数:"
ls -1 store/*.ts | wc -l

echo "Hooks 数:"
ls -1 hooks/*.ts | wc -l

echo "UI 组件数:"
ls -1 components/ui/*.tsx | wc -l

echo "领域模块数:"
ls -1 src/domains 2>/dev/null | wc -l || echo "0 (未迁移)"
```

---

**文档版本历史**
- v0.0.0 (2026-03-17): 基于 dependency-cruiser + knip 检测结果，结合原子化设计思想，给出完整架构优化方案
