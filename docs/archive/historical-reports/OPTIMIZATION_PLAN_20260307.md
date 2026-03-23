# TeamClaw 项目优化方案

> 基于测试结果生成的系统优化计划
> **生成时间**: 2026-03-07
> **版本**: v3.0

---

## 执行摘要

根据 E2E 测试、压力测试和安全测试的结果，本方案整合了所有发现的问题和优化建议，按优先级分为三个阶段执行。

### 测试结果概览

| 测试类型 | 通过率 | 主要问题 |
|----------|--------|----------|
| E2E 测试 | 80.9% | API Cookie 问题、语法错误、页面导航 |
| 压力测试 | 99.15% | P95 响应时间偏高、SQLite 并发瓶颈 |
| 安全测试 | 良好 | 1 个高危漏洞、2 个中危漏洞 |
| 单元/集成测试 | 94.2% | API 返回格式不一致 |

---

## Phase 1: 紧急修复 (P0) - 1-2 天

### 1.1 E2E 测试 API Cookie 问题修复

**问题**: `page.request.post/get/put/delete` 不携带浏览器 Cookie，导致 401 错误

**影响文件** (5 个测试文件):
- `tests/e2e/task-lifecycle.spec.ts`
- `tests/e2e/document-workflow.spec.ts`
- `tests/e2e/delivery-workflow.spec.ts`
- `tests/e2e/project-collaboration.spec.ts`
- `tests/e2e/multi-user-permissions.spec.ts`

**修复方案**:

```typescript
// 创建统一 API 调用工具 tests/helpers/api-helper.ts
export async function apiCall(page: Page, options: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}) {
  // 确保页面已加载
  if (page.url() === 'about:blank') {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  }
  
  return page.evaluate(async ({ method, path, body }) => {
    const url = `${window.location.origin}${path}`;
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    
    const data = response.ok ? await response.json().catch(() => null) : null;
    return { status: response.status, ok: response.ok, data };
  }, options);
}
```

**验证**: 重新运行 E2E 测试，通过率提升至 95%+

---

### 1.2 测试文件语法错误修复

**问题**: 多余大括号导致语法错误

**影响文件**:
- `tests/e2e/task-lifecycle.spec.ts` (第 112 行)
- `tests/e2e/delivery-workflow.spec.ts` (第 156 行)

**修复**: 已在上一轮修复，需验证

---

### 1.3 水平越权漏洞修复 (SEC-HIGH-001)

**问题**: 用户可访问其他用户的私有项目详情

**影响**: `GET /api/projects/{id}` 返回 404 而非权限检查

**修复方案**:

```typescript
// app/api/projects/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const project = await db.select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  
  if (!project.length) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  
  // 添加权限检查
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  
  if (project[0].visibility === 'private') {
    // 检查是否为所有者或成员
    const isMember = await db.select()
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.memberId, userId)
      ))
      .limit(1);
    
    if (project[0].createdBy !== userId && isMember.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }
  
  return NextResponse.json(project[0]);
}
```

---

### 1.4 Enter/Blur 防重复提交保护 (TD-015)

**问题**: 内联编辑场景 Enter 和 Blur 双触发保存

**影响范围**: 全项目内联编辑组件

**修复方案**:

```typescript
// hooks/useInlineEdit.ts
import { useRef, useCallback } from 'react';

export function useInlineEdit<T>(
  onSave: (value: T) => Promise<void> | void
) {
  const submittedByEnterRef = useRef(false);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent, value: T) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submittedByEnterRef.current = true;
      onSave(value);
    }
  }, [onSave]);
  
  const handleBlur = useCallback((value: T) => {
    if (!submittedByEnterRef.current) {
      onSave(value);
    }
    submittedByEnterRef.current = false;
  }, [onSave]);
  
  return { handleKeyDown, handleBlur };
}
```

**应用位置**:
- `components/TaskDrawer.tsx`
- `app/wiki/page.tsx` (文档标题编辑)
- `app/members/page.tsx` (成员名称编辑)

---

## Phase 2: 性能优化 (P1) - 3-5 天

### 2.1 API 响应时间优化

**问题**: 压力测试显示 P95 响应时间偏高（对话信道 890ms、文档编辑 1240ms）

**根因分析**:
1. 可能存在 N+1 查询
2. 数据库连接池配置不足
3. 缺少查询索引

**优化方案**:

```typescript
// 1. 添加数据库索引
// db/migrations/add-indexes.ts
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)
`);
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
`);
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)
`);
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)
`);

// 2. 优化列表查询，避免 N+1
// app/api/tasks/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  
  // 使用关联查询一次获取所有数据
  const tasksWithDetails = await db
    .select({
      task: tasks,
      assignee: members,
      project: projects,
    })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(projectId ? eq(tasks.projectId, projectId) : undefined);
  
  return NextResponse.json(tasksWithDetails);
}
```

---

### 2.2 useMemo 性能优化 (TD-016)

**问题**: 274 处派生计算未使用 useMemo

**优先处理**:
1. 任务列表 (`app/tasks/page.tsx`)
2. 文档列表 (`app/wiki/page.tsx`)
3. 聊天消息列表 (`components/chat/ChatMessageList.tsx`)

**修复模式**:

```typescript
// ❌ 之前
const activeTasks = tasks.filter(t => t.status === 'active').sort((a, b) => b.priority - a.priority);

// ✅ 之后
const activeTasks = useMemo(() => {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter(t => t.status === 'active')
    .sort((a, b) => b.priority - a.priority);
}, [tasks]);
```

---

### 2.3 大文件模块拆分 (TD-006)

**当前超标文件**:

| 文件 | 行数 | 目标 |
|------|------|------|
| `app/tasks/page.tsx` | 1203 | < 800 |
| `app/wiki/page.tsx` | 986 | < 800 |
| `lib/server-gateway-client.ts` | 942 | < 800 |
| `store/gateway.store.ts` | 897 | < 800 |

**拆分方案**:

```typescript
// app/tasks/page.tsx → 拆分为:
// - app/tasks/page.tsx (主页面入口 ~200 行)
// - app/tasks/components/TaskKanbanView.tsx
// - app/tasks/components/TaskSwimlaneView.tsx
// - app/tasks/components/TaskToolbar.tsx
// - app/tasks/components/TaskFilterPanel.tsx

// app/wiki/page.tsx → 拆分为:
// - app/wiki/page.tsx (主页面入口 ~200 行)
// - app/wiki/components/WikiEditor.tsx
// - app/wiki/components/WikiKnowledgeGraph.tsx
// - app/wiki/components/WikiDeliveryDialog.tsx
```

---

### 2.4 SSE 连接稳定性优化

**问题**: SSE 连接错误率 2.22%，存在 ECONNRESET 错误

**优化方案**:

```typescript
// 1. 添加心跳机制
// app/api/sse/route.ts
const heartbeatInterval = setInterval(() => {
  writer.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
}, 30000); // 30 秒心跳

// 2. 客户端自动重连
// components/DataProvider.tsx
const connectSSE = useCallback(() => {
  const eventSource = new EventSource('/api/sse');
  
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 5000); // 5 秒后重连
  };
  
  eventSource.addEventListener('heartbeat', () => {
    // 收到心跳，连接正常
  });
}, []);
```

---

## Phase 3: 安全增强 (P2) - 2-3 天

### 3.1 错误信息脱敏 (SEC-MED-001)

**问题**: 错误响应包含技术栈信息

**修复方案**:

```typescript
// app/api/error-handler.ts
export function handleApiError(error: unknown, request: Request): NextResponse {
  const requestId = request.headers.get('X-Request-Id');
  
  // 记录详细错误到日志
  console.error(`[${requestId}] API Error:`, error);
  
  // 生产环境返回通用错误
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'An unexpected error occurred', requestId },
      { status: 500 }
    );
  }
  
  // 开发环境返回详细错误
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error', requestId },
    { status: 500 }
  );
}
```

---

### 3.2 登录限流增强 (SEC-MED-002)

**问题**: 登录 API 缺少独立的账户级限流

**修复方案**:

```typescript
// lib/rate-limit.ts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function checkLoginRateLimit(identifier: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  
  if (!record) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true, remainingMs: 0 };
  }
  
  // 15 分钟窗口
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  
  if (now - record.lastAttempt > windowMs) {
    // 重置窗口
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true, remainingMs: 0 };
  }
  
  if (record.count >= maxAttempts) {
    const remainingMs = windowMs - (now - record.lastAttempt);
    return { allowed: false, remainingMs };
  }
  
  record.count++;
  record.lastAttempt = now;
  return { allowed: true, remainingMs: 0 };
}
```

---

### 3.3 审计日志系统 (SEC-LOW-003)

**问题**: 敏感操作缺少审计日志

**实现方案**:

```typescript
// lib/audit-log.ts
interface AuditLogEntry {
  action: string;
  actor: string;
  target: string;
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
}

export async function logAudit(entry: AuditLogEntry) {
  await db.insert(auditLogs).values({
    id: generateId(),
    action: entry.action,
    actor: entry.actor,
    target: entry.target,
    details: entry.details,
    createdAt: new Date(),
    ipAddress: entry.ipAddress,
  });
}

// 使用示例
await logAudit({
  action: 'user.login',
  actor: user.id,
  target: user.id,
  details: { method: 'password' },
  ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
});
```

---

### 3.4 安全响应头完善 (SEC-LOW-001)

**问题**: 部分静态资源缺少安全响应头

**修复**: 更新 `middleware.ts`

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 确保所有响应都有安全头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 生产环境添加 HSTS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  
  return response;
}
```

---

## Phase 4: 代码质量 (P3) - 持续优化

### 4.1 i18n 命名空间规范 (TD-017)

**问题**: 59 处 `useTranslation()` 未指定命名空间

**修复模式**:

```typescript
// ❌ 之前
const { t } = useTranslation();

// ✅ 之后
const { t } = useTranslation('tasks'); // 或对应模块名
```

---

### 4.2 API 返回格式统一

**问题**: 部分测试期望 `{ data: {...} }` 格式，实际返回裸对象

**修复方案**: 统一所有 API 返回格式

```typescript
// 标准 API 响应格式
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
```

---

### 4.3 跨页面重复模式抽象 (TD-007)

**待处理**:
1. 空状态展示 - 创建 `components/EmptyState.tsx`
2. 列表筛选 - 创建 `hooks/useFilteredList.ts`
3. 删除确认 - 迁移剩余 4 处到 `useConfirmAction`

---

## 执行计划

### Week 1: Phase 1 紧急修复

| 日期 | 任务 | 负责人 |
|------|------|--------|
| Day 1-2 | 修复 E2E 测试 Cookie 问题 | - |
| Day 1-2 | 修复水平越权漏洞 | - |
| Day 3-4 | 实现 Enter/Blur 防重复提交 | - |
| Day 5 | 运行测试验证 | - |

### Week 2: Phase 2 性能优化

| 日期 | 任务 | 负责人 |
|------|------|--------|
| Day 1-2 | 数据库索引优化 | - |
| Day 3-4 | useMemo 批量优化 | - |
| Day 5 | 大文件拆分 (tasks/wiki) | - |

### Week 3: Phase 3 安全增强

| 日期 | 任务 | 负责人 |
|------|------|--------|
| Day 1-2 | 错误信息脱敏 | - |
| Day 3 | 登录限流实现 | - |
| Day 4 | 审计日志系统 | - |
| Day 5 | 完整测试验证 | - |

---

## 验收标准

### E2E 测试
- [ ] 通过率 ≥ 95%
- [ ] 无语法错误
- [ ] Cookie 问题全部修复

### 压力测试
- [ ] P95 响应时间 < 500ms
- [ ] 错误率 < 0.5%
- [ ] 支持 10+ 并发用户

### 安全测试
- [ ] 无高危漏洞
- [ ] 中危漏洞全部修复
- [ ] OWASP Top 10 合规

### 代码质量
- [ ] 所有文件 ≤ 800 行
- [ ] useMemo 覆盖率 ≥ 90%
- [ ] i18n 命名空间规范 100%

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 性能优化引入新 Bug | 中 | 高 | 每个优化独立测试 |
| API 格式变更影响前端 | 高 | 中 | 版本化 API |
| 大文件拆分破坏依赖 | 中 | 中 | 渐进式拆分 |
| 安全修复影响用户体验 | 低 | 低 | 配置化开关 |

---

## 附录

### A. 测试报告索引

> **注意**：测试报告详情请参阅 [tests/README.md](../../tests/README.md)

### B. 相关技术债

- [TD-006: 大文件拆分](./TECH_DEBT.md#td-006)
- [TD-015: Enter/Blur 防重复提交](./TECH_DEBT.md#td-015)
- [TD-016: useMemo 性能优化](./TECH_DEBT.md#td-016)
- [TD-017: i18n 命名空间规范](./TECH_DEBT.md#td-017)

---

*文档由测试结果自动生成，需要定期更新*
