# TeamClaw 项目编码规范

> 本文档是 TeamClaw 项目的权威编码标准。所有新增、修改代码必须遵循以下规范。

---

## 一、技术栈

| 层面 | 技术 | 版本要求 |
|------|------|---------|
| 框架 | Next.js (App Router) | 14.x |
| 语言 | TypeScript (strict) | ^5.7 |
| UI | React + Tailwind CSS | React ^18 / Tailwind ^3.4 |
| 组件库 | shadcn/ui | - |
| 状态管理 | Zustand | ^5.0 |
| 数据库 | SQLite (better-sqlite3) | ^11 |
| ORM | Drizzle ORM | ^0.36 |
| 图标 | lucide-react | - |
| ID 生成 | uuid v4 | - |
| 条件类名 | clsx | - |

---

## 二、目录结构

```
teamclaw/
├── app/                    # 页面层 (Next.js App Router)
│   ├── api/{resource}/     # API 路由 (GET/POST + GET/PUT/DELETE)
│   └── api/mcp/            # MCP 工具接口
├── src/
│   ├── domains/            # 领域层 (16个领域模块)
│   │   └── {domain}/       # task, project, document...
│   │       ├── api/        # API 路由实现
│   │       ├── store.ts    # Zustand Store
│   │       ├── mcp.ts      # MCP Handlers
│   │       └── index.ts    # 领域导出
│   ├── features/           # 功能层
│   ├── shared/             # 共享层 (ui, hooks, lib, services)
│   └── core/               # 基础设施 (db, mcp, gateway)
├── components/             # 遗留组件
├── lib/                    # 遗留工具库
├── hooks/                  # 遗留 Hooks
└── db/                     # 数据库 Schema
```

### 2.1 架构分层

| 层级 | 目录 | 职责 | 依赖 |
|------|------|------|------|
| 5 | `app/` | 页面、路由 | features, shared |
| 4 | `src/features/` | 业务组件 | shared, domains |
| 3 | `src/shared/` | UI/Hooks/工具 | core (domains index) |
| 2 | `src/domains/` | Store/API/MCP | core only |
| 1 | `src/core/`, `app/api/` | 数据库、框架 | 外部库 |

**约束**：领域间禁止直接导入；shared 禁止依赖 features；禁止 `../../` 相对路径。

### 2.2 路径别名

| 别名 | 目标 | 示例 |
|------|------|------|
| `@/*` | `./*` | `@/db/schema` |
| `@/domains/{name}` | `./src/domains/{name}` | `@/domains/task` |
| `@/features/*` | `./src/features/*` | `@/features/chat` |
| `@/shared/*` | `./src/shared/*` | `@/shared/ui` |
| `@/core/*` | `./src/core/*` | `@/core/db` |

---

## 三、数据库层规范

### 3.1 Schema 定义 (`src/db/schema.ts`)

```ts
// 标准表定义模板
export const examples = sqliteTable('examples', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  metadata: text('metadata', { mode: 'json' }).$type<MetadataType>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// 必须同时导出 Select 和 Insert 类型
export type Example = typeof examples.$inferSelect;
export type NewExample = typeof examples.$inferInsert;

// 关系单独声明
export const examplesRelations = relations(examples, ({ one, many }) => ({
  project: one(projects, { fields: [examples.projectId], references: [projects.id] }),
}));
```

**强制规则**:
- 主键: `text('id').primaryKey()`，值由 API 层 `uuidv4()` 生成
- 字段命名: TypeScript 用 camelCase，SQL 列名用 snake_case
- 时间戳: `integer` + `mode: 'timestamp'`
- JSON 字段: `text` + `mode: 'json'` + `$type<T>()`
- 枚举: `text` + `enum: [...]` 内联

### 3.2 连接配置

```ts
// 必须启用的 PRAGMA
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -64000');  // 64MB
db.pragma('busy_timeout = 5000');
```

### 3.3 迁移

- 新增表/字段通过 `db/index.ts` 的增量迁移逻辑添加（检测表/列是否存在后再执行）
- 禁止手动修改 `data/teamclaw.db`，一切变更通过代码驱动

---

## 四、API Route 规范

### 4.1 通用模板

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { examples } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

// POST — 创建
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. 验证必填字段
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    
    // 2. 创建记录
    const newItem = { id: uuidv4(), ...body, createdAt: new Date(), updatedAt: new Date() };
    db.insert(examples).values(newItem).run();
    
    // 3. 脱敏后返回（如含敏感字段）
    return NextResponse.json(sanitizeIfNeeded(newItem), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
```

### 4.2 强制规则

| 规则 | 说明 |
|------|------|
| **存在性校验** | PUT/DELETE 必须先查询记录是否存在，不存在返回 404 |
| **白名单更新** | PUT 使用 `allowedFields` 数组过滤，禁止直接 spread 请求体 |
| **级联删除** | 涉及关联数据时使用 `db.transaction()` 确保原子性 |
| **敏感数据脱敏** | 含 API Token 等字段的响应必须经过 `sanitize.ts` 处理 |
| **错误格式** | 统一 `{ error: string }` + 对应 HTTP 状态码 |
| **错误消息语言** | API 错误消息**必须使用英文**，禁止中文。前端通过 i18n `t()` 翻译展示给用户 |
| **参数获取** | 动态路由: `{ params }: { params: Promise<{ id: string }> }` + `await params` |

### 4.3 PUT 存在性校验示例

```ts
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const updated = db.update(examples)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(examples.id, id))
      .returning()
      .all();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: updated[0] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
```

---

## 五、数据访问层规范 (`src/shared/lib/data-service.ts`)

### 5.1 通用请求函数

```ts
// 所有前端 API 调用必须通过 apiRequest 或对应领域 API 对象
const { data, error } = await tasksApi.getAll();
```

### 5.2 新增领域 API 模板

```ts
export const examplesApi = {
  getAll: () => apiRequest<Example[]>('/api/examples'),
  getById: (id: string) => apiRequest<Example>(`/api/examples/${id}`),
  create: (data: Partial<NewExample>) => apiRequest<Example>('/api/examples', {
    method: 'POST', body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Example>) => apiRequest<Example>(`/api/examples/${id}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/api/examples/${id}`, { method: 'DELETE' }),
};
```

---

## 六、Store 规范 (Zustand)

### 6.1 文件位置

Store 文件位于领域模块内：`src/domains/{domain}/store.ts`

```
src/domains/
├── task/
│   ├── store.ts          # Task Store
│   ├── mcp.ts            # MCP Handlers
│   ├── api/              # API 路由
│   └── index.ts          # 统一导出
├── project/
│   ├── store.ts          # Project Store
│   └── ...
```

### 6.2 标准结构

```ts
// src/domains/task/store.ts
import { create } from 'zustand';
import type { Task, NewTask } from '@/db/schema';

interface TaskState {
  // 状态
  items: Task[];
  loading: boolean;
  error: string | null;

  // 同步操作
  setItems: (items: Task[]) => void;
  addItem: (item: Task) => void;
  updateItem: (id: string, changes: Partial<Task>) => void;
  removeItem: (id: string) => void;

  // 异步操作
  fetchAsync: () => Promise<void>;
  createAsync: (data: NewTask) => Promise<Task | null>;
  updateAsync: (id: string, changes: Partial<Task>) => Promise<void>;
  deleteAsync: (id: string) => Promise<void>;

  // 派生查询
  getByProject: (projectId: string) => Task[];
  getByStatus: (status: string) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  // ... 实现
}));
```

### 6.3 强制规则

| 规则 | 说明 |
|------|------|
| **使用服务端响应** | `updateAsync` / `createAsync` 必须用 API 返回的 `data` 更新本地状态，不用请求体 |
| **先成功后更新** | `deleteAsync` 必须 await API 成功后再从本地移除 |
| **清除错误** | 操作成功后 `set({ error: null })` |
| **统一导出** | 通过领域 `index.ts` 导出，如 `export { useTaskStore } from '@/domains/task'` |

### 6.4 跨领域访问

**禁止**直接导入其他领域的 Store，通过 `src/shared/services` 或事件机制通信：

```ts
// ❌ 错误：直接导入其他领域 Store
import { useProjectStore } from '@/domains/project';

// ✅ 正确：通过服务层通信
import { projectService } from '@/shared/services';
```

### 6.5 反模式（禁止）

```ts
// ❌ 用请求体更新本地
updateItem(id, changes);  // 应该用 API 返回值

// ❌ fire-and-forget 删除
fetch(`/api/tasks/${id}`, { method: 'DELETE' });
set({ items: items.filter(t => t.id !== id) });

// ✅ 正确做法
const { data } = await tasksApi.update(id, changes);
if (data) updateItem(id, data);
```

---

## 七、前端组件规范

### 7.1 编辑操作防抖

所有触发 API 调用的用户输入（标题、描述、内容编辑等）**必须防抖**：

```ts
const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

// 清理
useEffect(() => () => { clearTimeout(saveTimerRef.current); }, []);

// 使用
const handleContentChange = (value: string) => {
  setLocalContent(value);  // 立即更新 UI
  clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(() => {
    saveToApi(value);      // 延迟保存到服务端
  }, 500);
};
```

**防抖时间**: 输入型操作统一 500ms。

### 7.2 Enter/Blur 防重复提交

内联编辑场景（如重命名）必须用 ref 防止 Enter 和 Blur 双重触发：

```ts
const submittedByEnterRef = useRef(false);

onKeyDown: (e) => {
  if (e.key === 'Enter') {
    submittedByEnterRef.current = true;
    doSave();
    exitEdit();
  }
}
onBlur: () => {
  if (!submittedByEnterRef.current) {
    doSave();
  }
  submittedByEnterRef.current = false;
  exitEdit();
}
```

### 7.3 性能优化

| 场景 | 做法 |
|------|------|
| 派生列表计算 | `useMemo` 包裹 filter/map/sort |
| 不触发渲染的状态 | `useRef` 代替 `useState`（如键盘修饰键状态） |
| 回调函数 | 事件处理器用 `useCallback` 包裹（特别是传给子组件的） |
| useEffect 依赖 | 精确到具体字段 `[task?.id, task?.title]`，禁止 `[task]` 整对象 |
| 大型计算 | 预索引（如日历视图按日期建 tasksByDate Map 再查找） |

### 7.4 组件库使用规范

**强制使用 shadcn/ui 组件库**，禁止自行实现已有组件。

| 规则 | 说明 |
|------|------|
| **优先使用组件库** | 按钮、输入框、对话框、下拉菜单、表格等 UI 组件必须使用 shadcn/ui |
| **禁止重复造轮子** | 已有组件（Button、Input、Dialog、Select、Table 等）禁止自行实现 |
| **统一风格** | 所有组件必须遵循 shadcn/ui 的设计风格和 API 约定 |
| **按需引入** | 使用 `npx shadcn@latest add <component>` 按需添加组件 |

**常用组件清单**：

```
Button, Input, Textarea, Select, Checkbox, Switch
Dialog, Sheet, Popover, DropdownMenu, Tooltip
Table, Card, Tabs, Badge, Avatar, Skeleton
Toast, AlertDialog, Command, Calendar
```

**组件导入示例**：

```tsx
// ✅ 正确：从组件库导入
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ❌ 错误：自行实现按钮
<div className="px-4 py-2 bg-primary text-white rounded">提交</div>
```

**自定义样式**：

组件库组件支持通过 `className` 扩展样式：

```tsx
<Button className="w-full md:w-auto" variant="outline" size="lg">
  提交
</Button>
```

### 7.5 组件文件规范

- 文件名 PascalCase: `TaskCard.tsx`
- 每个页面文件顶部 `'use client';`
- 图标统一用 lucide-react
- 条件类名用 `clsx()`
- CSS 变量用于主题色: `style={{ color: 'var(--text-primary)' }}`
- 禁止内联 `<style jsx>`，动画/全局样式放 `globals.css`

---

## 八、安全规范

### 8.1 API 安全

- 中间件 (`middleware.ts`) 强制添加安全头: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- API Token 认证: 环境变量 `TEAMCLAW_API_TOKEN` + Bearer Token
- CORS: 同源检测 + `TEAMCLAW_CORS_ORIGINS` 白名单

### 8.2 数据脱敏

任何包含 `openclawApiToken` 或类似敏感字段的 API 响应，必须经过 `@/shared/lib/sanitize` 处理：

```ts
import { sanitizeMember } from '@/shared/lib/sanitize';

// 响应前调用
return NextResponse.json(sanitizeMember(member));
```

脱敏规则: Token 仅保留末尾 4 位，其余替换为 `****`。

### 8.3 禁止事项

- 禁止在前端代码中硬编码 API Token / Secret
- 禁止 API 响应原样返回数据库中的敏感字段
- 禁止在 `console.log` 中打印 Token

---

## 九、MCP 模块规范

MCP 系统采用简化结构：
- `app/api/mcp/handlers/` - API 路由入口
- `src/core/mcp/` - 核心框架 (definitions, executor, types)
- `src/domains/{domain}/mcp.ts` - 各领域 MCP 实现

新增工具步骤：
1. 在 `src/core/mcp/definitions.ts` 注册工具定义
2. 在 `src/core/mcp/executor.ts` 添加执行逻辑
3. 在对应领域的 `mcp.ts` 实现业务逻辑

---

## 十、架构验证规范

### 10.1 依赖规则

```bash
npx dependency-cruiser --no-progress .
```

提交前必须确保 **0 违规**。

| 规则 | 说明 |
|------|------|
| `no-feature-imports-domain-internal` | features 只能通过领域 index 导入 |
| `no-domain-cross-import` | 领域之间禁止直接导入 |
| `no-shared-imports-features` | shared 层不能依赖 features 层 |
| `no-circular` | 禁止循环依赖 |

### 10.2 领域模块规范

```
src/domains/{domain}/
├── api/                    # API 路由
├── store.ts                # Zustand Store
├── mcp.ts                  # MCP Handlers
└── index.ts                # 统一导出
```

### 10.3 导入规范

**✅ 正确方式**：
```typescript
// 从领域 index.ts 导入
import { useTaskStore } from '@/domains/task';
import { useProjectStore } from '@/domains/project';

// 从共享层导入
import { Button } from '@/shared/ui';
import { useToast } from '@/shared/hooks';

// 从核心层导入
import { db } from '@/core/db';
```

**❌ 禁止方式**：
```typescript
// 禁止访问领域内部文件
import { taskStoreApi } from '@/domains/task/store';

// 禁止相对路径跨层级
import { something } from '@/shared/lib/utils';

// 禁止领域之间直接导入
import { useProjectStore } from '@/domains/project/store';  // 在 task 领域中
```

## 十一、Factory 模式使用规范

**核心原则**：Factory 用于消除重复代码，不是增加抽象层。

| 场景 | 建议 |
|------|------|
| 大型重复模块 (>200行, 重复3+处) | ✅ 使用 Factory |
| 小型模块 (<100行) | ❌ 直接使用简单实现 |
| 稳定运行的遗留代码 | ❌ 不修改 |

**检查标准**：使用后代码量应减少，否则重新评估。

**可用 Factory**：
- `api-route-factory.ts` - API 错误响应格式
- `rpc-methods.ts` - Gateway 调用常量（强制使用）

---

## 十二、样式与设计系统

### 12.1 主题色

- 品牌色: `primary-50` ~ `primary-950` (深靛蓝系)
- AI 标识色: `cyan` 系
- 危险色: `red` 系
- 成功色: `emerald` / `green` 系
- 警告色: `amber` / `yellow` 系

### 12.2 CSS 变量

```css
--background, --surface, --surface-hover
--text-primary, --text-secondary, --text-tertiary
--border, --border-light
--ai, --ai-light
```

### 12.3 暗色模式

- `darkMode: 'class'`，通过 `ThemeProvider` 切换
- 所有新组件必须同时支持明/暗两种模式
- 使用 `dark:` 前缀或 CSS 变量保证适配

### 12.4 阴影层级

`shadow-card` < `shadow-card-hover` < `shadow-float` < `shadow-glow-ai`

---

## 十三、Git 与代码同步

### 13.1 双目录同步

`teamclaw/` 为开发目录，`teamclaw-release/` 为发布目录。每次修改后通过 rsync 同步：

```bash
rsync -av --delete --exclude='node_modules' --exclude='.next' --exclude='.env*' teamclaw/ teamclaw-release/
```

### 13.2 注释语言

代码注释使用**中文**。

### 13.3 版本号同步

软件版本更新时，必须同步更新以下文档中的版本号：

| 文件 | 位置 |
|------|------|
| `README.md` | 标题 + 更新说明 |
| `docs/technical/DEVELOPMENT.md` | 当前版本说明 |
| `docs/product/USER_GUIDE.md` | MCP Tools 版本信息 |
| `skills/teamclaw/SKILL.md` | 版本标识 |

**检查命令**：
```bash
grep -r "v2\.[0-9]" --include="*.md" .
```

---

## 十四、国际化规范 (i18n)

### 14.1 基本原则

**所有用户可见文本必须使用 i18n**，禁止在页面组件中硬编码中文或英文字符串。

### 14.2 技术方案

使用 `react-i18next`，通过 `useTranslation` hook + `t()` 函数实现：

```tsx
import { useTranslation } from 'react-i18next';

export default function MyPage() {
  const { t } = useTranslation('namespace');
  
  return <div>{t('key')}</div>;
}
```

### 14.3 翻译文件组织

翻译定义在 `src/shared/lib/i18n.ts`，按功能模块划分命名空间：

```ts
export const resources = {
  en: {
    common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', ... },
    agents: { title: 'Agent Management', newAgent: 'New Agent', ... },
    sessions: { title: 'Sessions', ... },
    // ... 其他模块
  },
  zh: {
    common: { save: '保存', cancel: '取消', delete: '删除', ... },
    agents: { title: 'Agent 管理', newAgent: '新建 Agent', ... },
    // ... 其他模块
  },
};
```

### 14.4 强制规则

| 规则 | 说明 |
|------|------|
| **禁止硬编码文本** | 所有 UI 文本必须通过 `t()` 获取 |
| **命名空间对应** | 页面使用对应命名空间：agents 页面用 `useTranslation('agents')` |
| **动态值用插值** | `t('itemsCount', { count: 5 })` → "5 items" / "5 个项目" |
| **常量移入组件** | 需要翻译的常量（如选项列表）定义在组件内部，在 `useTranslation` 之后 |

### 14.5 代码示例

**正确做法**：

```tsx
export default function AgentsPage() {
  const { t } = useTranslation('agents');
  
  // 常量定义在 useTranslation 之后，可以使用 t()
  const PANEL_TABS = [
    { key: 'overview', label: t('overview') },
    { key: 'files', label: t('files') },
  ];
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('itemsCount', { count: agents.length })}</p>
    </div>
  );
}
```

**错误做法**：

```tsx
// ❌ 硬编码中文
return <h1>Agent 管理</h1>;

// ❌ 常量在组件外，无法访问 t()
const TABS = ['概览', '文件'];  // 移入组件内

// ❌ 使用错误命名空间
const { t } = useTranslation();  // 应指定命名空间
```

### 14.6 复数与动态值

```ts
// 翻译文件
itemsCount_one: '{{count}} item',
itemsCount_other: '{{count}} items',

// 组件使用
t('itemsCount', { count: items.length })
```

---

## 十五、文档维护规范

### 15.1 强制文档更新

**所有新模块或原有模块增加功能，必须更新对应文档：**

| 变更类型 | 必须更新的文档 | 说明 |
|----------|----------------|------|
| 新增模块 | `docs/technical/COMPONENTS.md` | 添加模块说明、上游调用者、下游依赖 |
| 模块增加功能 | `docs/technical/COMPONENTS.md` | 更新功能说明、复用场景 |
| 新增/修改 API | `docs/technical/API.md` | 添加/更新接口文档 |
| 发现技术债 | `docs/process/TECH_DEBT.md` | 记录问题和优先级 |

### 15.2 文档格式

**COMPONENTS.md 格式**：

```markdown
### 模块名

**文件**：`path/to/file.ts`
**功能**：简述功能
**复用场景**：何时可以复用

**上游调用者**：
- `components/xxx.tsx` - 在 xxx 场景调用

**下游依赖**：
- `src/shared/lib/yyy.ts` - 数据处理

**示例**：
```typescript
// 使用示例
```

**注意事项**：
- 注意点1
```

**API.md 格式**：

```markdown
### POST /api/xxx

**功能**：简述功能

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|

**响应格式**：
```json
{ "data": {}, "error": null }
```
```

### 15.3 例外情况

- **Bug 诊断/修复**：不需要更新文档
- **配置调整**：不需要更新文档
- **临时脚本**：不需要更新文档（如一次性迁移脚本）

---

## 十六、部署规范（强制）

### 16.1 必须使用部署脚本

**所有部署到生产服务器必须通过 `./.codebuddy/skills/teamclaw/SKILL.md` skill执行，禁止手动 rsync 或其他方式。**

### 16.2 违规后果

**手动 rsync 或跳过脚本可能导致数据库被覆盖，造成数据丢失！**

---

## 十七、Checklist（提交前自查）

### 基础规范
- [ ] 新 API Route 是否有 try-catch + 错误响应？
- [ ] PUT/DELETE 是否校验了资源存在性？
- [ ] 含敏感字段的响应是否经过脱敏？
- [ ] Store 的 async 方法是否使用了 API 返回值更新本地状态？
- [ ] 删除操作是否 await 成功后才更新 UI？
- [ ] 编辑输入是否有防抖（500ms）？
- [ ] 内联编辑是否防止了 Enter/Blur 双重提交？
- [ ] useMemo/useCallback 是否用于频繁计算和回调？
- [ ] useEffect 依赖是否精确到具体字段？
- [ ] 新组件是否支持暗色模式？
- [ ] 所有用户可见文本是否使用 i18n（无硬编码中英文）？
- [ ] UI 组件是否使用 shadcn/ui（禁止自行实现已有组件）？

### 架构规范
- [ ] **新代码是否遵循分层架构？**（domains → shared → features → app）
- [ ] **是否避免了领域之间直接导入？**
- [ ] **是否运行了 `npx dependency-cruiser --no-progress .` 且 0 违规？**
- [ ] **Store 是否位于对应领域模块内？**（`src/domains/{domain}/store.ts`）
- [ ] **路径别名是否符合规范？**（禁止 `../../`）

### 部署与同步
- [ ] 是否同步到了 teamclaw-release？
- [ ] **部署是否通过 `./.codebuddy/skills/teamclaw/SKILL.md` 脚本执行？**
