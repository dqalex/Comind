# TeamClaw 技术债务

> 记录所有技术债务，按优先级分类。实现新需求时必须检查是否可以顺便解决。

---

## 技术债索引

| ID | 标题 | 优先级 | 状态 | 影响范围 |
|----|------|--------|------|----------|
| TD-001 | Gateway 唯一标识问题 | P2 | open | 成员匹配 |
| TD-002 | UUID → Base58 ID 迁移失败 | P1 | open | 数据库 |
| TD-003 | openclaw-gateway 内存泄漏 | P1 | open | 服务器性能 |
| TD-004 | chat-action-parser 待迁移 | P1 | resolved | 对话信道 |
| TD-005 | Browser Direct 模式 Chat Actions 全局监听 | P2 | open | 对话信道 |
| TD-006 | 5 个文件超 800 行需模块拆分（原 8 个，3 个已拆分） | P1 | in_progress | 代码组织 |
| TD-014 | API 路由缺乏统一错误处理和参数校验 | P1 | resolved | 代码质量 |
| TD-007 | 跨页面重复模式未抽象（删除确认已迁移 9/13） | P2 | in_progress | 可维护性 |
| TD-008 | Gateway 客户端未抽象为 Provider 接口 | P2 | open | 多平台扩展 |
| TD-009 | Phase 10 数据统计/分析面板未实现 | P2 | open | 功能缺失 |
| TD-010 | Phase 11 插件扩展机制未实现 | P3 | open | 功能缺失 |
| TD-011 | Gateway RPC 方法名未共享常量 | P2 | open | Gateway 双客户端 |
| TD-012 | PostgreSQL Schema 兼容层未实现 | P2 | open | 数据库扩展 |
| TD-013 | 大列表虚拟滚动未实施 | P3 | open | 性能优化 |
| TD-015 | Enter/Blur 防重复提交保护缺失 | P1 | resolved | 前端质量 |
| TD-016 | useMemo 性能优化（274 处派生计算） | P2 | in_progress | 性能优化 |
| TD-017 | i18n 命名空间规范（59 处未指定） | P2 | open | 国际化 |
| TD-018 | Store 异步操作命名不统一 | P3 | open | 代码规范 |
| TD-019 | 双模式兼容性检查（5 处直接使用 connected/client） | P2 | open | Gateway 兼容性 |
| TD-020 | 安全审计日志系统集成 | P1 | resolved | 安全合规 |
| TD-021 | 登录限流机制 | P1 | resolved | 安全合规 |
| TD-022 | HTML 模板可视化编辑功能缺陷 | P2 | open | 模板编辑 |

---

## 优先级说明

| 优先级 | 说明 | 处理时机 |
|--------|------|----------|
| **P0** | 阻塞性问题，影响核心功能 | 立即处理 |
| **P1** | 重要问题，影响稳定性/性能 | 尽快处理 |
| **P2** | 中等问题，影响用户体验 | 有空处理 |
| **P3** | 低优先级，优化建议 | 视情况处理 |

---

## TD-001: Gateway 唯一标识问题

**优先级**：P2
**状态**：open
**创建时间**：2026-02-20
**影响范围**：成员匹配

### 问题描述

当用户连接不同的 OpenClaw Gateway 时，需要区分不同 Gateway 中的 Agent。当前使用 `openclawGatewayUrl + openclawAgentId` 作为复合键来匹配 AI 成员，但这个方案存在可靠性问题。

### 当前方案

**复合键**：`(openclawGatewayUrl, openclawAgentId)`

**问题**：
1. **URL 可能变化** - Gateway 的 WebSocket URL 可能因为网络环境变化而改变
2. **Token 可能变化** - Gateway 的 Token 可能被重新生成
3. **无法持久识别** - URL/Token 变化后，之前创建的 AI 成员记录无法匹配到新的连接

### 已调研的方案

1. **Gateway deviceId** - OpenClaw Gateway 有全局唯一 deviceId，但未在协议中暴露
2. **用户手动设置别名** - 不够可靠
3. **Token Hash** - URL 和 Token 都可能变化
4. **设备认证（ED25519）** - 实现复杂，跨设备无法同步

### 建议方案

向 OpenClaw 提 Feature Request，请求在 `hello-ok` 响应中暴露 Gateway 的 `deviceId`。

### 相关代码

- `db/schema.ts` - `members` 表
- `store/gateway.store.ts` - `refreshAgents` 函数
- `app/members/page.tsx` - `getLocalAIMember` 函数

### 更新记录

- 2026-02-20：初始记录

---

## TD-002: UUID → Base58 ID 迁移失败

**优先级**：P1
**状态**：open
**创建时间**：2026-02-20
**影响范围**：数据库

### 问题描述

服务器构建时出现 UUID → Base58 ID 迁移失败错误：

```
[TeamClaw-v2] Migration failed, rolled back: SqliteError: FOREIGN KEY constraint failed
```

### 根本原因

迁移过程中存在外键约束冲突，可能是：
1. 某些关联记录的 ID 未同步更新
2. 迁移顺序不正确
3. 存在孤立的关联记录

### 影响

- 迁移回滚后不影响运行，但每次构建都会尝试迁移
- 可能导致旧 UUID 格式数据无法正确转换

### 建议方案

1. 检查外键关联表，确保迁移顺序正确
2. 先迁移主表，再迁移关联表
3. 处理孤立记录

### 相关代码

- `db/index.ts` - 迁移逻辑

### 更新记录

- 2026-02-20：初始记录

---

## TD-003: openclaw-gateway 内存泄漏

**优先级**：P1
**状态**：open
**创建时间**：2026-02-20
**影响范围**：服务器性能

### 问题描述

openclaw-gateway 进程运行 3 天后内存从 465MB 膨胀到 1.4GB，占用服务器 40% 内存。

### 影响

- 服务器内存紧张（总共 3.5GB）
- 系统变慢
- 需要定期手动重启

### 临时解决方案

定期重启 openclaw-gateway 进程。

### 建议方案

1. 向 OpenClaw 团队报告内存泄漏问题
2. 设置定时任务每周重启一次

### 相关命令

```bash
# 重启 openclaw-gateway
pkill -f openclaw-gateway && nohup openclaw-gateway > /var/log/openclaw-gateway.log 2>&1 &
```

### 更新记录

- 2026-02-20：初始记录，临时解决方案验证有效

---

## TD-004: chat-action-parser 待迁移

**优先级**：P1
**状态**：resolved
**创建时间**：2026-02-20
**解决时间**：2026-02-20
**影响范围**：对话信道

### 问题描述

对话信道数据交互模块已重构为 `lib/chat-channel/`，但旧的 `lib/chat-action-parser.ts` 和 `app/api/chat-actions/route.ts` 仍在使用中，存在以下问题：

1. **代码重复**：新旧两套解析和执行逻辑
2. **功能不完整**：旧模块缺少 `get_mcp_token`、`sync_identity` 等新功能
3. **维护困难**：修改功能需要同步两处代码

### 解决方案

1. 创建客户端入口 `lib/chat-channel/client.ts`，只导出解析器相关功能
2. 迁移 `ChatPanel.tsx` 使用 `@/lib/chat-channel/client`
3. 迁移 `/api/chat-actions` 使用 `@/lib/chat-channel` 的 `executeActions`
4. 标记旧模块为 `@deprecated`

### 相关代码

- `lib/chat-action-parser.ts` - 已废弃
- `app/api/chat-actions/route.ts` - 已迁移
- `lib/chat-channel/` - 新模块
- `lib/chat-channel/client.ts` - 客户端入口
- `components/chat/ChatPanel.tsx` - 已迁移

### 更新记录

- 2026-02-20：初始记录，REQ-002 完成后发现
- 2026-02-20：完成迁移，创建客户端入口解决服务端/客户端模块问题

---

## TD-005: Browser Direct 模式 Chat Actions 全局监听

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：对话信道

### 问题描述

当前 Chat Actions 自动解析执行（F2）仅在 `server_proxy` 模式下工作——由 `ServerGatewayClient` 在服务端监听 chat 事件并自动处理。

在 `browser_direct` 模式下，WebSocket 连接由浏览器直接建立（`lib/gateway-client.ts`），chat 事件只在前端 `ChatPanel` 打开时才被处理。如果用户未打开对应会话的 ChatPanel，AI 发送的 actions 将不会被执行。

### 当前状态

- **server_proxy 模式**：✅ 已实现（`server-gateway-client.ts` → `handleChatActions`）
- **browser_direct 模式**：❌ 未实现，需要全局监听方案

### 需要考虑的问题

1. **生命周期**：浏览器页面关闭/刷新后监听中断，actions 丢失
2. **重复执行**：ChatPanel 和全局监听器可能同时处理同一条消息
3. **离线场景**：用户关闭浏览器后 AI 的消息完全无法处理
4. **多标签页**：多个浏览器标签页可能同时监听同一会话

### 可能方案

1. **前端全局监听器**：在 `DataProvider` 或 `AppShell` 层注册全局 chat 事件处理器，不依赖 ChatPanel
   - 优点：实现简单
   - 缺点：浏览器关闭后失效

2. **混合模式**：browser_direct 模式下仍通过服务端中转 action 执行请求
   - 优点：可靠性更高
   - 缺点：架构更复杂

3. **推荐用户使用 server_proxy 模式**：在 UI 中提示 browser_direct 模式下 actions 自动执行功能受限
   - 优点：零开发成本
   - 缺点：功能受限

### 相关代码

- `lib/server-gateway-client.ts` - server_proxy 模式的 `handleChatActions` 实现
- `lib/gateway-client.ts` - browser_direct 模式的 WebSocket 客户端
- `components/chat/ChatPanel.tsx` - 前端 chat 消息处理
- `lib/chat-channel/` - actions 解析与执行模块

### 更新记录

- 2026-02-22：初始记录，F1 需求 pending，等待优化方案确定

---

## TD-006: 5 个文件超 800 行需模块拆分

**优先级**：P1
**状态**：in_progress
**创建时间**：2026-02-22
**影响范围**：代码组织、可维护性

### 问题描述

原 8 个文件超过 800 行编码规范上限，已拆分 3 个，剩余 5 个仍超标：

| 文件 | 原行数 | 当前行数 | 状态 |
|------|--------|---------|------|
| `components/chat/ChatPanel.tsx` | ~1527 | 674 | ✅ 已拆分（提取子组件 + hooks） |
| `app/agents/page.tsx` | 1275 | 326 | ✅ 已拆分（提取到 `components/agents/`） |
| `lib/markdown-sync.ts` | 1082 | 392 | ✅ 已拆分（提取到 `lib/sync/` 子模块） |
| `app/tasks/page.tsx` | 817 | **1203** | ❌ 反而增长（新增泳道视图等功能） |
| `app/wiki/page.tsx` | 811 | **986** | ❌ 仍超标 |
| `lib/server-gateway-client.ts` | 1129 | **942** | ⚠️ 缩减但仍超标 |
| `store/gateway.store.ts` | 992 | **897** | ⚠️ 仍超标 |
| `app/schedule/page.tsx` | 822 | **822** | ⚠️ 仍超标 |

### 拆分方案

按优先级逐步拆分：
- **P0**：`tasks/page.tsx`（1203 行，最严重）— 提取泳道视图、看板视图为独立组件
- **P1**：`wiki/page.tsx`（986 行）— 提取编辑器、知识图谱、交付对话框为独立组件
- **P1**：`server-gateway-client.ts`（942 行）— 提取 chat action 处理、消息格式化为独立模块
- **P2**：`gateway.store.ts`（897 行）— 提取 CRUD 操作为独立模块
- **P3**：`schedule/page.tsx`（822 行）— 提取新建/编辑对话框为独立组件

### 更新记录

- 2026-02-22：初始记录，开始 Phase 1 拆分
- 2026-02-22：ChatPanel 拆分完成（1527 → ~670 行），提取 useChatStream、useAutoScroll、ChatInputArea、ChatMessageList、ChatSessionList
- 2026-03-02：Review 审计更新——agents/page.tsx 已拆分至 326 行，markdown-sync.ts 已拆分至 392 行；tasks/page.tsx 因新功能增长至 1203 行，wiki/page.tsx 增长至 986 行

---

## TD-007: 跨页面重复模式未抽象

**优先级**：P2
**状态**：in_progress
**创建时间**：2026-02-22
**影响范围**：可维护性、代码复用

### 问题描述

多个页面存在相同的交互模式但各自实现，导致代码重复和行为不一致：

| 重复模式 | 出现次数 | 现有抽象 | 当前状态 |
|----------|---------|---------|----------|
| 删除确认 | 13 处 | `useConfirmAction` + `ConfirmDialog` ✅ | ⚠️ 已迁移 9/13：`members/page.tsx`、`Sidebar.tsx` 仍手写弹窗；`WorkspaceCard.tsx`、`GatewayConfigPanel.tsx` 仍用原生 `confirm()` |
| 防抖保存 | 3 处 | 无 | ❌ `TaskDrawer.tsx`、`wiki/page.tsx`、`lib/openclaw/config.ts` 各自实现 |
| 空状态展示 | 11+ 处 | 无 | ❌ 每处内联硬编码文案 + 样式不统一 |
| 列表筛选/搜索 | 5 处 | 无 | ❌ 每处各自实现 useMemo + filter |
| 内联编辑 | 3 处 | 无 | ❌ 实现方式各异 |

### 建议方案

提取公共抽象：
1. `hooks/useDebouncedCallback.ts` — 防抖回调
2. `components/EmptyState.tsx` — 统一空状态
3. `hooks/useFilteredList.ts` — 列表筛选
4. 迁移剩余 4 处到 `useConfirmAction`：`members/page.tsx`、`Sidebar.tsx`、`WorkspaceCard.tsx`、`GatewayConfigPanel.tsx`

### 更新记录

- 2026-02-22：初始记录
- 2026-03-02：Review 审计更新——`useConfirmAction` 已迁移 9/13 处（TaskDrawer、MilestoneManager、deliveries、wiki、agents、projects、tasks、schedule、sessions）；空状态实际有 11+ 处重复；防抖保存发现第 3 处（`lib/openclaw/config.ts`）

---

## TD-008: Gateway 客户端未抽象为 Provider 接口

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：多平台扩展

### 问题描述

当前 Gateway 客户端直接耦合 OpenClaw 协议，不支持其他平台（如 Knot 等 OpenClaw 封装运行时）的统一管理。未来需要支持多 Gateway 平台时，需要引入 Provider 抽象层。

### 当前架构

```
gateway.store.ts → lib/gateway-client.ts (浏览器 WebSocket)
                 → lib/server-gateway-client.ts (服务端 WebSocket)
                 → lib/gateway-proxy.ts (代理转发)
```

所有文件直接实现 OpenClaw Protocol v3 细节。

### 目标架构

```
gateway.store.ts → GatewayProvider (接口)
                     ├── OpenClawProvider (WebSocket v3)
                     ├── KnotProvider (AG-UI 协议)
                     └── CustomProvider (未来扩展)
```

### 相关代码

- `lib/gateway-client.ts` — 浏览器端 OpenClaw 客户端
- `lib/server-gateway-client.ts` — 服务端 OpenClaw 客户端
- `lib/gateway-proxy.ts` — 代理客户端
- `store/gateway.store.ts` — Gateway 状态管理
- `app/api/chat-reply/route.ts` — 已有 OpenClaw/Knot 路由分发

### 更新记录

- 2026-02-22：初始记录，与 PRD Phase 14 对应

---

## TD-009: Phase 10 数据统计/分析面板未实现

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：功能缺失

### 问题描述

PRD Phase 10 规划了 Dashboard 数据可视化功能（任务完成率、Agent 活跃度等），目前未实现。

### 建议方案

1. 集成图表库（recharts 或 chart.js）
2. 增加统计 API 端点
3. Dashboard 页面添加数据面板

### 更新记录

- 2026-02-22：从 PRD Phase 10 迁移为技术债

---

## TD-010: Phase 11 插件扩展机制未实现

**优先级**：P3
**状态**：open
**创建时间**：2026-02-22
**影响范围**：功能缺失

### 问题描述

PRD Phase 11 规划了第三方插件加载机制，目前未实现。

### 建议方案

1. 定义插件接口标准
2. 实现插件加载器
3. 提供插件开发 SDK

### 更新记录

- 2026-02-22：从 PRD Phase 11 迁移为技术债

---

## TD-011: Gateway RPC 方法名未共享常量

**优先级**：P2
**状态**：open
**创建时间**：2026-02-25
**影响范围**：Gateway 双客户端

### 问题描述

`gateway-client.ts`（浏览器直连）和 `gateway-proxy.ts`（服务端代理）两个 Gateway 客户端独立定义 RPC 方法名字符串。v2.2.5 之前 `gateway-proxy.ts` 使用了错误的方法名（`cron.create`/`cron.delete` 而非正确的 `cron.add`/`cron.remove`），因为两个文件无共享常量引用。

### 根本原因

RPC 方法名以字符串字面量散落在两个客户端中，无编译时保障。新增或修改 RPC 方法时，容易遗漏其中一个客户端。

### 影响

- `server_proxy` 模式下创建/删除 cron job 失败（已在 v2.2.5 修复）
- 未来新增 RPC 方法时可能再次出现不一致

### 建议方案

1. 创建 `lib/gateway-rpc-methods.ts`，导出所有 RPC 方法名常量
2. `gateway-client.ts` 和 `gateway-proxy.ts` 均从该文件引用
3. 添加 TypeScript 类型约束，确保方法名合法

### 相关代码

- `lib/gateway-client.ts` — 浏览器端 RPC 调用
- `lib/gateway-proxy.ts` — 服务端代理 RPC 调用
- BUG-032 — 本次发现的方法名不一致问题

### 更新记录

- 2026-02-25：初始记录，由全量审查 BUG-032 发现

---

## TD-012: PostgreSQL Schema 兼容层未实现

**优先级**：P2
**状态**：open
**创建时间**：2026-03-05
**影响范围**：数据库扩展

### 问题描述

Sprint 3 创建了 PostgreSQL 适配器架构（`db/adapters/`），但 Drizzle ORM 对 SQLite 和 PostgreSQL 使用不同的表定义语法：

```typescript
// SQLite
import { sqliteTable } from 'drizzle-orm/sqlite-core';

// PostgreSQL  
import { pgTable } from 'drizzle-orm/pg-core';
```

当前只实现了 SQLite schema，PostgreSQL 模式无法自动建表。

### 影响

- 无法真正使用 PostgreSQL 数据库
- 仅完成架构就绪，未完成 schema 迁移

### 建议方案

1. 创建 `db/schema-pg.ts`，使用 `pgTable` 定义所有 21 个表
2. 处理数据类型差异：
   - `integer` → `serial` (自增主键)
   - `text` → `varchar` / `text`
   - `blob` → `bytea`
3. 创建迁移脚本同步两种 schema
4. 添加 CI 测试双数据库兼容性

**预计工作量**：4-6 小时

### 相关代码

- `db/schema.ts` — SQLite 表定义
- `db/adapters/postgres.ts` — PostgreSQL 适配器
- `db/config.ts` — 数据库配置工厂

### 更新记录

- 2026-03-05：初始记录，从 Sprint 3 S3.1 延后

---

## TD-013: 大列表虚拟滚动未实施

**优先级**：P3
**状态**：open
**创建时间**：2026-03-05
**影响范围**：性能优化

### 问题描述

任务列表、文档列表等大型列表未实现虚拟滚动，在数据量大时可能影响渲染性能。

### 当前状态

| 组件 | 数据量预估 | 虚拟滚动 |
|------|-----------|---------|
| 任务列表 | 通常 < 500 | ❌ |
| 文档列表 | 通常 < 200 | ❌ |
| 聊天消息 | 单会话 < 100 | ❌ |

### 延后原因

1. **收益有限**：管理系统数据量通常不大
2. **实现复杂**：
   - 表格虚拟滚动需要固定行高或动态测量
   - 看板视图（多列）虚拟化更复杂
3. **依赖引入**：需要安装 react-virtuoso 或 react-window

### 建议方案

1. 安装 `react-virtuoso`（支持表格和看板）
2. 实现 `VirtualizedTable` 组件
3. 在 TaskListView、DocumentList 等处应用

**预计工作量**：2-3 小时

### 相关代码

- `app/tasks/components/TaskListView.tsx` — 表格视图
- `app/wiki/components/WikiSidebar.tsx` — 文档列表
- `components/chat/ChatMessageList.tsx` — 消息列表

### 更新记录

- 2026-03-05：初始记录，从 Sprint 3 S3.3 延后

---

## TD-014: API 路由缺乏统一错误处理和参数校验

**优先级**：P1
**状态**：resolved
**创建时间**：2026-03-04
**解决时间**：2026-03-04
**影响范围**：API 代码质量、安全性

### 问题描述

Code Review Round 2 发现 12 个 API 层面的问题：

1. **P0 严重**：
   - `push/route.ts` 旧版本丢失 bug（先写新内容再读"旧版本"导致保存的是新内容）
   - `debug/route.ts` GET 端点无鉴权，生产环境可能暴露敏感信息
   - 5 个 openclaw-files 路由存在路径遍历风险

2. **P1 重要**：
   - `export/route.ts` 无 try-catch 错误处理
   - `resolve/route.ts` 非原子操作（文件写入和状态更新分离）
   - `versions/route.ts` limit 无上限

3. **P2 改进**：
   - 外键校验缺失（3 个路由）
   - 参数范围校验缺失（progress、temperature）
   - 默认值不一致（syncInterval）

### 根本原因

1. 早期开发阶段对边界情况考虑不足
2. 缺乏统一的 API 开发规范和代码审查
3. 安全意识和防御性编程实践不足

### 解决方案

已在 v2.5.1 全部修复：

| 问题 | 修复方式 |
|------|----------|
| 旧版本丢失 | 先 `readFileSync` 读旧内容 → `db.insert` 保存版本 → `writeFileSync` 写新内容 |
| debug 无鉴权 | GET 添加与 POST 相同的 `TEAMCLAW_API_TOKEN` Bearer Token 校验 |
| 路径遍历 | 所有 `join(workspace.path, relativePath)` 后添加 `startsWith(workspace.path)` 校验 |
| export 无 try-catch | 添加标准 try-catch，返回 `{ error: string }` 格式 |
| 冲突解决非原子 | 使用 `db.transaction()` 包装冲突状态更新 + 文件状态更新 |
| limit 无上限 | `Math.min(parseInt(limit) || 10, 100)` 限制最大 100 |
| 外键校验 | POST 路由添加 `db.select().from(table).where(eq(id, foreignKey))` 存在性检查 |
| 参数范围 | `Math.min(max, Math.max(min, value))` 模式校验 progress(0-100)、temperature(0-2.0) |
| 默认值 | `syncInterval` 从 30 改为 120（与 DB schema 一致） |

### 预防措施

1. 新增 `.codebuddy/rules/api-defensive-coding.mdc` 规则文件
2. 新增 `.codebuddy/rules/change-impact-check.mdc` 变更影响评估规则
3. 建立 `logs/bug-knowledge.log` Bug 知识积累机制

### 相关代码

- `app/api/openclaw-files/[id]/push/route.ts`
- `app/api/debug/route.ts`
- `app/api/openclaw-files/[id]/route.ts`
- `app/api/openclaw-files/[id]/pull/route.ts`
- `app/api/openclaw-files/[id]/rollback/route.ts`
- `app/api/openclaw-conflicts/[id]/resolve/route.ts`
- `app/api/sop-templates/[id]/export/route.ts`
- `app/api/openclaw-files/[id]/versions/route.ts`
- `app/api/task-logs/route.ts`
- `app/api/tasks/route.ts`
- `app/api/tasks/[id]/route.ts`
- `app/api/openclaw-status/route.ts`
- `app/api/members/route.ts`
- `app/api/members/[id]/route.ts`
- `app/api/chat-messages/route.ts`
- `app/api/scheduled-task-history/route.ts`
- `app/api/openclaw-workspaces/route.ts`

### 更新记录

- 2026-03-04：初始记录，Code Review Round 2 发现
- 2026-03-04：全部修复完成，关闭技术债

---

## TD-015: Enter/Blur 防重复提交保护缺失

**优先级**：P1
**状态**：open
**创建时间**：2026-03-07
**影响范围**：前端质量、数据一致性

### 问题描述

全量代码审查发现项目中缺少 Enter/Blur 防重复提交保护机制。内联编辑场景（如重命名、标题编辑）中，用户按 Enter 键提交后，输入框失去焦点 (Blur) 会再次触发保存，导致重复提交。

### 当前状态

| 检查项 | 数量 | 状态 |
|--------|------|------|
| submittedByEnterRef 使用 | 0 处 | ❌ 未实现 |
| 内联编辑场景 | 多处 | ⚠️ 存在风险 |

### 影响

- 重复 API 调用，增加服务器负担
- 可能导致数据不一致（如重复创建记录）
- 用户体验下降（保存按钮闪烁、重复提示）

### 建议方案

1. 创建可复用的 `useInlineEdit` hook，内置 Enter/Blur 保护
2. 在现有内联编辑组件中统一添加保护：
   ```tsx
   const submittedByEnterRef = useRef(false);
   
   onKeyDown: (e) => {
     if (e.key === 'Enter') {
       submittedByEnterRef.current = true;
       doSave();
     }
   }
   onBlur: () => {
     if (!submittedByEnterRef.current) {
       doSave();
     }
     submittedByEnterRef.current = false;
   }
   ```

### 相关代码

- `components/TaskDrawer.tsx` - 任务编辑
- `app/wiki/page.tsx` - 文档标题编辑
- `app/members/page.tsx` - 成员名称编辑
- `CODING_STANDARDS.md` - 已有规范但执行不到位

### 更新记录

- 2026-03-07：初始记录，全量 Review 发现

---

## TD-016: useMemo 性能优化（274 处派生计算）

**优先级**：P2
**状态**：open
**创建范围**：性能优化

### 问题描述

全量代码审查发现 274 处派生列表计算未使用 `useMemo`，包括 `filter`、`map`、`sort` 等操作。这些计算在每次渲染时都会重新执行，可能导致性能问题。

### 检查命令

```bash
grep -rn "\.map(\|\.filter(\|\.sort(" --include="*.tsx" components/ app/ | grep -v "useMemo\|components/ui/" | wc -l
# 结果: 274 处
```

### 影响

- 大数据量列表渲染性能下降
- 不必要的重复计算
- 组件重新渲染频率增加

### 建议方案

1. 优先处理大数据量组件（任务列表、文档列表）
2. 使用 `useMemo` 包裹派生计算：
   ```tsx
   const sortedTasks = useMemo(() => {
     return tasks.filter(t => t.status === 'active').sort((a, b) => b.priority - a.priority);
   }, [tasks]);
   ```
3. 结合虚拟滚动 (TD-013) 进一步优化

### 相关代码

- `components/MarkdownEditor.tsx` - 多处 map/filter
- `components/DocumentPicker.tsx` - 文档筛选
- `app/tasks/page.tsx` - 任务列表排序/筛选
- `app/wiki/page.tsx` - 文档列表处理

### 更新记录

- 2026-03-07：初始记录，全量 Review 发现

---

## TD-017: i18n 命名空间规范（59 处未指定）

**优先级**：P2
**状态**：open
**影响范围**：国际化、代码规范

### 问题描述

全量代码审查发现 59 处 `useTranslation()` 调用未指定命名空间，违反 `CODING_STANDARDS.md` 规范。这可能导致：
1. 翻译 key 冲突
2. 无法正确加载对应模块的翻译
3. 类型推断不准确

### 检查命令

```bash
grep -rn "useTranslation()" --include="*.tsx" app/ components/ | wc -l
# 结果: 59 处
```

### 问题示例

```tsx
// ❌ 不规范
const { t } = useTranslation();

// ✅ 规范
const { t } = useTranslation('tasks');
```

### 主要问题文件

- `app/settings/openclaw/page.tsx`
- `app/schedule/components/*.tsx` (多处)
- `app/tasks/page.tsx`
- `app/sop/page.tsx`

### 建议方案

1. 批量修复：为所有 `useTranslation()` 添加对应命名空间
2. 添加 ESLint 规则禁止无命名空间的调用
3. 更新 `CODING_STANDARDS.md` 检查清单

### 更新记录

- 2026-03-07：初始记录，全量 Review 发现

---

## TD-018: Store 异步操作命名不统一

**优先级**：P3
**状态**：open
**影响范围**：代码规范、可维护性

### 问题描述

Store 层异步操作命名不统一，部分使用 `updateAsync`/`createAsync`，部分直接使用 `update`/`create`，缺乏一致性。

### 现状

| Store | 命名方式 |
|-------|----------|
| document.store.ts | `updateDocumentAsync` |
| delivery.store.ts | `updateDelivery` (直接) |
| task.store.ts | `updateTask` (直接) |

### 建议方案

1. 统一命名规范：
   - 同步操作：`updateXxx`, `createXxx`, `deleteXxx`
   - 异步操作：`updateXxxAsync`, `createXxxAsync`, `deleteXxxAsync`
2. 逐步重构现有 Store
3. 添加命名规范到 `CODING_STANDARDS.md`

### 相关代码

- `store/*.store.ts` - 所有 Store 文件

### 更新记录

- 2026-03-07：初始记录，全量 Review 发现

---

## TD-019: 双模式兼容性检查（5 处直接使用 connected/client）

**优先级**：P2
**状态**：open
**影响范围**：Gateway 兼容性

### 问题描述

全量代码审查发现 5 处代码直接使用 `useGatewayStore` 的 `connected` 或 `client` 属性，未正确处理 `server_proxy` 和 `browser_direct` 两种模式。

### 检查命令

```bash
grep -rn "useGatewayStore.*connected\|useGatewayStore.*\bclient\b" --include="*.tsx" --include="*.ts" app/ components/ store/ | grep -v "serverProxy\|connectionMode" | wc -l
# 结果: 5 处
```

### 风险

- `server_proxy` 模式下 `client` 可能为 null，导致报错
- `connected` 状态在两种模式下含义不同
- 可能导致 Gateway 功能在某种模式下不可用

### 正确做法

```tsx
const isConnected = connectionMode === 'server_proxy'
  ? serverProxyConnected
  : connected;
```

### 建议方案

1. 审查并修复 5 处直接使用
2. 创建 `useGatewayConnection` hook 统一处理双模式判断
3. 添加双模式测试用例

### 相关代码

- `store/gateway.store.ts` - 需要检查的使用方
- `components/GatewayRequired.tsx` - 参考正确实现

### 更新记录

- 2026-03-07：初始记录，全量 Review 发现

---

## TD-022: HTML 模板可视化编辑功能缺陷

**优先级**：P2
**状态**：open
**创建时间**：2026-03-16
**影响范围**：模板编辑、可视化编辑

### 问题描述

Markdown 编辑器的 HTML 模板可视化编辑功能存在多个未解决的问题：

1. **MD 内容污染**：`simpleMdToHtml` 会为文本内容包装 `<p>` 标签，`htmlToSimpleMd` 解码 HTML 实体后这些标签会变成真实的 `<p>` 标签并污染 MD 源内容
2. **iframe sandbox 脚本执行问题**：编辑模式切换时 `Blocked script execution in 'about:srcdoc'` 错误
3. **React setState 警告**：`handleToggleEditMode` 在 `setState` 回调中调用 `onChange` 导致渲染期间更新组件

### 已尝试的修复

1. 将 `srcDoc` 从 useEffect DOM 操作改为 React prop（解决 sandbox 同步问题）
2. 移动 `onChange` 调用到 `setState` 外部（解决 React 警告）
3. 在 `htmlToSimpleMd` 中添加二次清理（缓解污染但未根治）

### 根本原因

TeamClaw 的 slot 同步方案 (`lib/slot-sync.ts`) 使用 `simpleMdToHtml` 将 MD 转换为 HTML 进行渲染，编辑后再通过 `htmlToSimpleMd` 转回 MD。这个双向转换过程存在信息丢失和污染问题。

对比 AIcase-editor 的方案：直接使用 `textContent` 处理文本 slot，不做 MD↔HTML 转换。这种方案更简单但无法在编辑时渲染 MD 语法（如加粗、链接等）。

### 当前状态

功能按钮已隐藏，代码保留但不可用。

### 建议方案

**方案 A（推荐）**：参考 AIcase-editor 简化实现
- 文本 slot 使用 `textContent`，不转换 MD
- 图片 slot 直接操作 `src` 属性
- 放弃编辑时的 MD 语法渲染

**方案 B**：重构 slot 同步机制
- 使用 AST 解析而非正则替换
- 建立精确的位置映射关系
- 避免不必要的 HTML 实体编解码

**方案 C**：使用成熟的可视化编辑器
- 集成 ProseMirror 或 TipTap
- 自定义 MD schema 扩展
- 依赖社区维护的编辑器核心

### 相关代码

- `components/markdown-editor/HtmlPreview.tsx` - 可视化编辑入口（按钮已注释）
- `components/markdown-editor/MarkdownEditor.tsx` - 编辑器主组件
- `lib/slot-sync.ts` - slot 同步核心逻辑
- `components/markdown-editor/types.ts` - 类型定义

### 更新记录

- 2026-03-16：初始记录，隐藏功能按钮

---

## 技术债模板

```markdown
## TD-XXX: 标题

**优先级**：P0/P1/P2/P3
**状态**：open / in_progress / resolved / wontfix
**创建时间**：YYYY-MM-DD
**影响范围**：简述影响范围

### 问题描述

[详细描述问题]

### 根本原因

[分析根本原因]

### 影响

[描述对系统/用户的影响]

### 建议方案

[提出解决方案]

### 相关代码

- `path/to/file.ts` - 说明

### 更新记录

- YYYY-MM-DD：初始记录
- YYYY-MM-DD：更新内容
```

---

## 贡献指南

发现新问题或解决问题时，请更新此文档：

1. **发现新问题**：使用模板创建新条目
2. **解决问题**：更新状态为 `resolved`，记录解决方案
3. **放弃解决**：更新状态为 `wontfix`，说明原因

---

## 处理检查清单

实现新需求时，检查是否可以顺便解决技术债：

- [ ] 查看技术债索引
- [ ] 评估是否与当前需求相关
- [ ] 如果相关，评估解决成本
- [ ] 如果成本可控，顺便解决
- [ ] 更新技术债状态
