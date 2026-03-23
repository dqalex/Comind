# Mock Gateway 测试套件

> 用于本地开发和测试的 OpenClaw Gateway 模拟器

## 快速开始

### 1. 启动 Mock Gateway

```bash
# 在一个终端中启动
npm run mock:gateway
```

### 2. 运行测试

```bash
# 快速连接测试（验证 Gateway 是否工作）
npm run mock:test

# v1.0.1 核心能力测试
npm run mock:test:v101

# 知识闭环测试
npm run mock:test:knowledge

# SOP 引擎测试
npm run mock:test:sop
```

## 脚本说明

| 脚本 | 用途 |
|------|------|
| `mock-gateway.ts` | Mock OpenClaw Gateway 服务器 |
| `quick-test.ts` | 快速验证 Gateway 连接 |
| `test-v101-capabilities.ts` | v1.0.1 核心能力集成测试 |
| `test-knowledge-closed-loop.ts` | 知识闭环测试套件 |
| `test-sop-flow.ts` | SOP 引擎测试套件 |
| `init-mock-gateway-config.ts` | 初始化 Gateway 配置 |
| `clear-gateway-config.ts` | 清除 Gateway 配置 |

## v1.0.1 测试覆盖

### 1. 核心能力测试 (`test-v101-capabilities.ts`)

| 测试项 | 说明 |
|--------|------|
| Gateway 健康检查 | HTTP 和 WebSocket 连接 |
| WebSocket 握手 | 认证流程 |
| 快照获取 | agents/sessions/crons/skills |
| Chat 流式响应 | delta + final 消息 |
| Agent DM | 直接消息发送 |
| Task Push | HTTP 端点 |
| SSE 端点 | Server-Sent Events |
| Skills 列表 | Skill 状态查询 |
| Cron 列表 | 定时任务查询 |
| Config 操作 | 配置读写 |
| Agent Identity | 身份获取 |
| Sessions 操作 | 会话管理 |

### 2. 知识闭环测试 (`test-knowledge-closed-loop.ts`)

| 测试项 | 说明 |
|--------|------|
| L4 经验读取 | 推送任务时注入历史经验 |
| update_knowledge | 知识沉淀工具 |
| 交付审核历史 | 审核时读取历史意见 |
| 里程碑完成提示 | 知识沉淀引导 |
| L4 项目过滤 | 按项目筛选经验 |
| L4 标签搜索 | 按标签搜索经验 |
| 知识分层验证 | L1-L5 分层完整性 |
| 闭环完整性 | 消费→生产→沉淀→复用 |

### 3. SOP 引擎测试 (`test-sop-flow.ts`)

| 测试项 | 说明 |
|--------|------|
| SOP 模板列表 | 模板获取 |
| SOP 模板详情 | 阶段和提示词 |
| advance_sop_stage | 阶段推进 |
| request_sop_confirm | 确认流程 |
| get_sop_context | 上下文获取 |
| save_stage_output | 阶段产出保存 |
| SOP 模板创建 | 新建模板 |
| SOP 闭环验证 | 完整流程验证 |

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Mock Gateway                             │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Server (ws://localhost:18789)                     │
│  ├── Challenge/Connect 认证                                 │
│  ├── snapshot.get                                           │
│  ├── chat.send / agent.dm                                   │
│  ├── skills.status                                          │
│  ├── cron.list                                              │
│  └── config.get/set                                         │
├─────────────────────────────────────────────────────────────┤
│  HTTP Server (http://localhost:18790)                      │
│  ├── GET /api/health                                        │
│  ├── GET /api/sse                                           │
│  └── POST /api/task-push                                    │
└─────────────────────────────────────────────────────────────┘
```

## 协议版本

Mock Gateway 支持 TeamClaw Gateway Protocol v0.9.8：

1. **Challenge**: 客户端发送 `{ type: 'challenge' }`
2. **Connect**: 收到 challenge 后发送 `{ type: 'req', method: 'connect', params: {...} }`
3. **Hello-OK**: 认证成功响应 `{ type: 'res', payload: { type: 'hello-ok' } }`

## 故障排除

### Gateway 未运行

```
❌ Mock Gateway 未运行！
```

解决方案：
```bash
npm run mock:gateway
```

### 端口被占用

```
Error: listen EADDRINUSE :::18789
```

解决方案：
```bash
# 查找占用端口的进程
lsof -i :18789
# 杀死进程
kill <PID>
```

### WebSocket 连接失败

1. 检查 Gateway 是否在 ws://localhost:18789 运行
2. 检查防火墙设置
3. 运行 `quick-test.ts` 诊断

## 开发

### 添加新测试

1. 在对应测试文件中添加测试函数：

```typescript
async function testX_newFeature() {
  const start = performance.now();
  const testName = '新功能测试';

  try {
    // 测试逻辑
    const duration = performance.now() - start;
    recordTest({ name: testName, passed: true, duration });
    log('pass', `${testName}: 通过`);
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    recordTest({ name: testName, passed: false, duration, error: msg });
    log('fail', `${testName}: ${msg}`);
  }
}
```

2. 在 `main()` 中调用：

```typescript
await testX_newFeature();
```

### 添加新的 MCP 方法

在 `mock-gateway.ts` 的 `switch (method)` 中添加：

```typescript
case 'your.method':
  ws.send(JSON.stringify({
    type: 'res',
    id,
    ok: true,
    payload: { /* response */ }
  }));
  break;
```
