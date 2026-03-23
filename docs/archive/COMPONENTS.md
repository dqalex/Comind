# TeamClaw 组件库

> 记录可复用组件，按功能分类。实现新功能前先查阅此文档，避免重复造轮子。

---

## 组件索引

| 分类 | 组件 | 文件 | 复用场景 |
|------|------|------|----------|
| API | 统一响应格式 | `lib/api-response.ts` | API 响应封装 |
| API | 错误处理 | `lib/error-handler.ts` | API 错误处理 |
| 安全 | Token 加密 | `lib/security.ts` | 敏感数据加密 |
| 安全 | 输入验证 | `lib/validators.ts` | 参数验证 |
| 数据 | ID 生成 | `lib/id.ts` | 唯一 ID 生成 |
| 数据 | 数据库连接 | `db/index.ts` | SQLite 连接 |
| 同步 | Markdown 解析 | `lib/markdown-sync.ts` | MD 文档解析 |
| 同步 | SSE 事件推送 | `lib/event-bus.ts` | 实时事件广播 |
| 国际化 | 多语言支持 | `lib/i18n.ts` | i18n 翻译 |
| 状态 | Zustand Store | `store/` | 前端状态管理 |
| **对话信道** | **统一数据交互** | `lib/chat-channel/` | **AI 对话操作（含 SOP Actions）** |
| **服务端 Gateway** | **服务端代理模式** | `lib/server-gateway-client.ts` | **Gateway 服务端连接** |
| **Gateway 连接判断** | **双模式支持** | `components/GatewayRequired.tsx` | **server_proxy + browser_direct** |
| **SOP 进度条** | **SOP 阶段可视化** | `components/sop/SOPProgressBar.tsx` | **任务卡片/TaskDrawer SOP 进度** |
| **SOP 模板编辑器** | **SOP 模板 CRUD** | `components/sop/SOPTemplateEditor.tsx` | **SOP 模板创建/编辑（拖拽排序）** |
| **SOP 调试面板** | **SOP 诊断调试** | `components/sop/SOPDebugPanel.tsx` | **DebugPanel 集成** |
| **Know-how 解析器** | **分层知识库** | `lib/knowhow-parser.ts` | **SOP 知识库 L1-L5 解析** |
| ~~对话解析~~ | ~~Chat Action 解析器~~ | `lib/chat-action-parser.ts` | ⚠️ **已废弃，请使用 chat-channel** |

---

## API 组件

### 统一响应格式

**文件**：`lib/api-errors.ts`

**功能**：API 错误类型定义与处理

**复用场景**：所有 API 路由

**示例**：
```typescript
// 成功响应
return NextResponse.json({ data: result, error: null });

// 错误响应
return NextResponse.json({ data: null, error: '错误信息' }, { status: 400 });
```

---

### 错误处理

**文件**：`lib/api-errors.ts`

**功能**：统一 API 错误类型定义（`ApiError` 类），含错误码和 HTTP 状态码映射

**复用场景**：API 异常捕获

---

## 安全组件

### Token 加密

**文件**：`lib/security.ts`

**功能**：敏感数据加密/解密

**复用场景**：存储 API Token、密码等敏感数据

**示例**：
```typescript
import { encryptToken, decryptToken } from '@/lib/security';

// 加密
const encrypted = encryptToken('my-api-token');

// 解密
const decrypted = decryptToken(encrypted);
```

**注意事项**：
- 加密密钥从环境变量 `ENCRYPTION_KEY` 读取
- 加密后数据为 base64 字符串

---

### 输入验证

**文件**：`lib/validators.ts`

**功能**：参数验证工具函数

**复用场景**：API 参数验证

**示例**：
```typescript
import { validateEnum, VALID_MEMBER_TYPE } from '@/lib/validators';

// 枚举验证
const type = validateEnum(input, VALID_MEMBER_TYPE); // 'human' | 'ai'
```

**支持的验证**：
- `validateEnum` - 枚举值验证
- `validateEnumWithDefault` - 枚举验证带默认值
- `VALID_MEMBER_TYPE` - 成员类型
- `VALID_DEPLOY_MODE` - 部署模式
- `VALID_CONNECTION_STATUS` - 连接状态

---

## 数据组件

### ID 生成

**文件**：`lib/id.ts`

**功能**：生成唯一 ID（Base58 短 ID）

**复用场景**：创建新记录时生成 ID

**示例**：
```typescript
import { generateMemberId, generateTaskId, normalizeId } from '@/lib/id';

// 生成 ID
const memberId = generateMemberId(); // 'member-xxx'
const taskId = generateTaskId();     // 'task-xxx'

// 标准化 ID（兼容 UUID）
const normalized = normalizeId('d5796667-1def-46d9-95bc-e5c682c4075f');
```

**注意事项**：
- ID 格式：前缀 + Base58 字符串
- 兼容旧版 UUID，自动转换

---

### 数据库连接

**文件**：`db/index.ts`

**功能**：SQLite 数据库连接单例

**复用场景**：所有数据库操作

**示例**：
```typescript
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 查询
const allMembers = await db.select().from(members);

// 条件查询
const member = await db.select().from(members).where(eq(members.id, 'xxx'));

// 插入
await db.insert(members).values({ id: 'xxx', name: 'Test' });

// 更新
await db.update(members).set({ name: 'New Name' }).where(eq(members.id, 'xxx'));

// 删除
await db.delete(members).where(eq(members.id, 'xxx'));

// 事务
await db.transaction(async (tx) => {
  await tx.delete(members).where(eq(members.id, 'xxx'));
  // ...
});
```

**注意事项**：
- 使用 `globalThis` 保证单例（HMR 安全）
- 自动启用 WAL 模式、外键约束

---

## 同步组件

### Markdown 解析

**文件**：`lib/markdown-sync.ts`

**功能**：解析 Markdown 文档，同步到数据库

**复用场景**：批量创建任务、文档同步

**示例**：
```typescript
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';

// 同步 Markdown 文档
await syncMarkdownToDatabase(markdownContent, projectId);
```

---

### SSE 事件推送

**文件**：`lib/event-bus.ts`

**功能**：服务端事件广播

**复用场景**：数据变更后通知前端刷新

**示例**：
```typescript
import { eventBus, EventType } from '@/lib/event-bus';

// 发送事件
eventBus.emit(EventType.TASK_UPDATED, { taskId: 'xxx' });
eventBus.emit(EventType.MEMBER_UPDATED, { memberId: 'xxx' });
```

**支持的事件类型**：
- `TASK_CREATED` / `TASK_UPDATED` / `TASK_DELETED`
- `MEMBER_CREATED` / `MEMBER_UPDATED` / `MEMBER_DELETED`
- `DOCUMENT_CREATED` / `DOCUMENT_UPDATED` / `DOCUMENT_DELETED`

---

## 国际化组件

### 多语言支持

**文件**：`lib/i18n.ts`

**功能**：i18n 国际化支持

**复用场景**：所有用户可见文本

**示例**：
```tsx
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t } = useTranslation('namespace');
  
  return <h1>{t('title')}</h1>;
}
```

**注意事项**：
- 所有用户可见文本必须使用 `t()` 函数
- 禁止硬编码中英文字符串
- 翻译文件按模块划分命名空间

---

## 状态管理

### Zustand Store

**文件**：`store/*.ts`

**功能**：前端状态管理

**复用场景**：组件间状态共享

**可用 Store**：
- `useMemberStore` - 成员状态
- `useTaskStore` - 任务状态
- `useProjectStore` - 项目状态
- `useDocumentStore` - 文档状态
- `useDeliveryStore` - 交付状态
- `useScheduleStore` - 定时任务状态
- `useChatStore` - 聊天状态
- `useOpenClawStore` - OpenClaw 状态
- `useGatewayStore` - Gateway 连接状态

**示例**：
```tsx
import { useTaskStore } from '@/store';

function MyComponent() {
  const { tasks, fetchTasks, updateTask } = useTaskStore();
  
  // 使用状态和方法
}
```

**注意事项**：
- `updateAsync` / `createAsync` 必须用 API 返回的 data 更新本地状态
- `deleteAsync` 必须等待 API 成功后才移除本地数据
- `fetchXxx` 方法必须使用 `Array.isArray(data)` 防御 API 返回格式（API 可能返回裸数组或分页对象 `{data, total}`）
- JSON 类型字段（如 `crossProjects`、`projectTags`）消费时必须使用 `Array.isArray(field)` 守卫，不能用 truthy 检查

**Store 防御性模式**：

```typescript
// ✅ 正确：fetchXxx 中的 API 返回值防御
const data = await apiRequest<T[]>('/api/xxx');
const items = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data as T[] || []);
set({ items, loading: false, error: null });

// ✅ 正确：JSON 字段消费
const filtered = tasks.filter(t => 
  Array.isArray(t.crossProjects) && t.crossProjects.includes(projectId)
);

// ❌ 错误：直接信任 API 返回值
set({ items: data || [], loading: false });

// ❌ 错误：truthy 检查 JSON 字段
const filtered = tasks.filter(t => t.crossProjects && t.crossProjects.includes(projectId));
```

---

## 网络组件

### Gateway Client

**文件**：`lib/gateway-client.ts`

**功能**：OpenClaw Gateway WebSocket 客户端

**复用场景**：与 OpenClaw Gateway 通信

**示例**：
```typescript
import { getGatewayClient } from '@/lib/gateway-client';

const client = getGatewayClient();

// 获取快照
const snapshot = await client.getSnapshot();

// 创建 Agent
await client.createAgent({ name: 'Scout', ... });
```

---

## 对话信道模块

### 统一数据交互模块

**文件**：`lib/chat-channel/`

**功能**：统一 AI 对话中的数据交互，合并 Chat Actions 和 MCP Tools

**子文件**：

| 文件 | 功能 |
|------|------|
| `types.ts` | 统一类型定义 |
| `actions.ts` | Action 定义和验证 |
| `parser.ts` | 解析 AI 回复中的 JSON actions |
| `executor.ts` | 统一执行入口 |
| `logger.ts` | 结构化日志 |
| `errors.ts` | 错误处理 |

**上游调用者**：

| 调用方 | 文件 | 使用方式 |
|--------|------|----------|
| 聊天面板 | `components/chat/ChatPanel.tsx` | 编排层，约 670 行 ✅ |
| 聊天输入 | `components/chat/ChatInputArea.tsx` | 统一输入区域组件 ✅ |
| 消息列表 | `components/chat/ChatMessageList.tsx` | 统一消息列表组件 ✅ |
| 会话列表 | `components/chat/ChatSessionList.tsx` | 会话列表视图 ✅ |
| 流式处理 | `hooks/useChatStream.ts` | ChatEvent 订阅 + delta rAF + actions 解析 ✅ |
| 自动滚动 | `hooks/useAutoScroll.ts` | 自动滚动 + 滚到底部按钮 ✅ |
| Chat Actions API | `app/api/chat-actions/route.ts` | 执行 actions ✅ |

**下游依赖**：

| 依赖 | 文件 | 功能 |
|------|------|------|
| Task Handlers | `app/api/mcp/handlers/task.handler.ts` | 任务 CRUD 操作 |
| Document Handlers | `app/api/mcp/handlers/document.handler.ts` | 文档 CRUD 操作 |
| Status Handlers | `app/api/mcp/handlers/status.handler.ts` | AI 状态管理 |
| Member Handlers | `app/api/mcp/handlers/member.handler.ts` | 成员管理 + Token 获取 |
| 各种 Store | `store/*.store.ts` | 前端状态管理 |

**复用场景**：
- AI 通过对话更新任务状态
- AI 创建文档或添加评论
- AI 更新自己的工作状态
- AI 获取自己的 MCP API Token
- 所有需要 AI 与系统交互的场景

**示例**：

```typescript
import { parseChatActions, executeActions, generateRequestId } from '@/lib/chat-channel';

// 1. 解析 AI 回复中的 actions
const aiReply = '任务已开始！{"actions":[{"type":"update_task_status","task_id":"task-123","status":"in_progress"}]}';
const { actions, cleanContent } = parseChatActions(aiReply);
// actions: [{ type: 'update_task_status', task_id: 'task-123', status: 'in_progress' }]
// cleanContent: '任务已开始！'

// 2. 执行 actions
const result = await executeActions(actions, {
  requestId: generateRequestId(),
  memberId: 'member-xxx',
});

// 3. 检查结果
console.log(result.summary); // { total: 1, success: 1, failed: 0 }
```

**支持的 Action 类型**：

| 分类 | 操作 | 对话信道支持 |
|------|------|------------|
| 写入 | update_task_status, add_comment, create_check_item, complete_check_item | ✅ |
| 写入 | create_document, update_document, deliver_document | ✅ |
| 状态 | update_status, set_queue | ✅ |
| 扩展 | sync_identity, get_mcp_token, custom_action | ✅ |
| 查询 | get_task, list_my_tasks, get_document, search_documents | ❌ (用 MCP API) |
| 定时 | create_schedule, update_schedule, delete_schedule | ❌ (用 MCP API) |

**注意事项**：
- 对话信道只支持写入类操作，查询类操作需使用 MCP API
- 日志自动记录请求 ID，便于追踪
- 错误有清晰的错误代码和恢复建议
- **返回值传递**：`create_document` → `deliver_document` 自动传递 `document_id`

**返回值传递机制**（v2.1 新增）：

批量执行 Actions 时，前序 action 的返回值可自动传递给后续 action：

```typescript
// 示例：create_document 返回的 document_id 自动注入到 deliver_document
const actions = [
  { type: 'create_document', title: '报告', content: '...' },
  { type: 'deliver_document', title: '报告', platform: 'local', task_id: 'xxx' }
  // deliver_document 无需提供 document_id，会自动注入
];

const result = await executeActions(actions, { memberId: 'member-xxx' });
```

**支持的上下文传递**：

| Action 类型 | 传递值 | 后续 Action 使用 |
|-------------|--------|------------------|
| `create_document` | `document_id`, `document_title` | `deliver_document` 自动注入 |
| `update_task_status` | `taskId` | 记录到上下文 |
| `deliver_document` | `deliveryId` | 记录到上下文 |

**迁移状态**：
- ✅ `lib/chat-action-parser.ts` 已废弃，请使用 `lib/chat-channel/`
- ✅ `app/api/chat-actions/route.ts` 已迁移到新模块
- ✅ `components/chat/ChatPanel.tsx` 已迁移到新模块

**客户端使用**：
```typescript
// 客户端组件只能导入解析器
import { parseChatActions, hasChatActions } from '@/lib/chat-channel/client';

// 服务端可以使用完整功能
import { executeActions } from '@/lib/chat-channel';
```

### v3.0 高并发架构组件

**文件**：`lib/chat-channel/pool.ts`

**功能**：Gateway 连接池，按用户会话隔离连接，实现连接复用和预连接

**复用场景**：多用户同时与 Agent 交互时复用 Gateway 连接

**示例**：
```typescript
import { GatewayConnectionPool, prefetchConnection } from '@/lib/chat-channel';

// 获取连接池实例（单例）
const pool = GatewayConnectionPool.getInstance();

// 获取/创建连接
const connection = await pool.acquire(userId, sessionKey, url, token);

// 预连接：用户登录时预先建立连接
await prefetchConnection(userId, url, token);

// 获取连接统计
const stats = pool.getStats();
```

**特性**：
- 按 `userId` 隔离连接，不同用户互不干扰
- 同用户同会话复用现有连接
- LRU 淘汰策略，防止连接池无限增长
- 自动心跳保活（30秒间隔）

---

**文件**：`lib/chat-channel/queue.ts`

**功能**：消息队列，按 sessionKey 分组处理，支持自动重试

**复用场景**：高并发场景下削峰填谷，保证消息有序处理

**示例**：
```typescript
import { enqueueChatActions, getQueueStats } from '@/lib/chat-channel';

// 入队消息
const jobId = await enqueueChatActions(sessionKey, actions, memberId);

// 获取队列统计
const stats = getQueueStats();
```

**特性**：
- 按 `sessionKey` 分组：同一会话串行，不同会话并行
- 自动重试：指数退避策略（1s → 2s → 4s → 8s）
- 内存队列降级：Redis 不可用时自动降级到内存队列

---

**文件**：`lib/chat-channel/incremental.ts`

**功能**：增量更新机制，通过 SSE 广播变更字段，Store 合并增量数据

**复用场景**：替代全量 Store 刷新，减少数据传输

**示例**：
```typescript
import { 
  broadcastTaskUpdate, 
  mergeIncrementalUpdate,
  createIncrementalHandler 
} from '@/lib/chat-channel';

// 广播增量更新
broadcastTaskUpdate({ id: 'task-xxx', status: 'completed', progress: 100 });

// Store 中合并增量更新
const updatedTasks = mergeIncrementalUpdate(currentTasks, update);

// 创建增量更新处理器（自动订阅 SSE 事件）
const unsubscribe = createIncrementalHandler('tasks', getItems, setItems);
```

**特性**：
- 只传输变更字段，减少 80%+ 数据传输
- 自动合并到本地 Store，无需全量查询
- 支持乐观更新，失败自动回滚

---

**文件**：`lib/chat-channel/resilience.ts`

**功能**：容灾机制，含熔断器和主备自动切换

**复用场景**：提升系统可用性，故障恢复时间 < 1s

**示例**：
```typescript
import { CircuitBreaker, createResilientClient } from '@/lib/chat-channel';

// 创建熔断器
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });

// 使用熔断器执行操作
const result = await breaker.execute(() => riskyOperation());

// 创建弹性 Gateway 客户端
const client = createResilientClient({
  primaryUrl: 'ws://gateway1:18789',
  secondaryUrl: 'ws://gateway2:18789',
});

// 发送消息（自动主备切换）
await client.send(message);
```

**特性**：
- 熔断器模式：连续失败 5 次后打开，30秒后半开试探
- 主备自动切换：主连接失败时自动切换到备连接
- 双写模式：关键消息同时写入主备（可选）

---

**文件**：`lib/chat-channel/executor.ts`（v3.0 增强）

**功能**：批量执行 actions，延迟 Store 刷新，并行刷新多个 Store

**示例**：
```typescript
import { executeActions } from '@/lib/chat-channel';

// 批量执行（自动优化）
const result = await executeActions(actions, {
  memberId: 'member-xxx',
  triggerRefresh: true,  // 执行完成后批量刷新 Store
});

console.log(result.summary); // { total: 5, success: 5, failed: 0 }
```

**优化点**：
- 延迟刷新：`triggerRefresh: false` 延迟到所有 action 执行完再刷新
- 批量并行：`batchRefreshStores` 并行刷新多个 Store（tasks/documents/projects/members）
- 失败隔离：单个 action 失败不影响其他 action

---

## Gateway 连接判断组件

### GatewayRequired

**文件**：`components/GatewayRequired.tsx`

**功能**：统一的 Gateway 断连空状态引导组件，支持双模式判断

**复用场景**：所有依赖 Gateway 连接的页面（Agent 管理、定时任务、会话等）

**上游调用者**：
- `app/agents/page.tsx` - Agent 管理页面
- `app/schedules/page.tsx` - 定时任务页面
- `app/sessions/page.tsx` - 会话管理页面

**下游依赖**：
- `store/gateway.store.ts` - 获取连接状态

**示例**：
```tsx
import GatewayRequired from '@/components/GatewayRequired';

export default function AgentsPage() {
  return (
    <GatewayRequired feature="Agent 管理">
      {/* 页面内容，只在 Gateway 连接后显示 */}
    </GatewayRequired>
  );
}
```

**双模式支持**：
- `browser_direct` 模式：检查 `connected` 状态（浏览器直连）
- `server_proxy` 模式：检查 `serverProxyConnected` 状态（服务端代理）

**注意事项**：
- 必须配合 `DataProvider` 使用，确保服务端状态已同步
- `feature` 参数用于显示不同的提示文本

---

## 贡献指南

发现新的可复用组件时，请更新此文档：

1. 确定组件分类
2. 填写组件信息
3. 提供使用示例
4. 添加注意事项
