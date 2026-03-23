# TeamClaw 性能测试套件 - 项目总结

## 概述

本次为 TeamClaw 项目创建了完整的性能测试套件，覆盖 API、数据库、MCP、Gateway、前端等多个维度，共计 **6 大测试模块**。

## 测试套件组成

### 1. 配置文件 (`tests/performance/config.ts`)

定义了完整的性能测试配置：

- **基准测试配置**: 迭代次数、预热次数、并发用户数等
- **压力测试配置**: 持续时间、并发数、错误率阈值等
- **负载测试配置**: 渐进增加用户数的策略
- **性能阈值**: API、数据库、前端的性能标准
- **API 模块列表**: 21 个需要测试的 API 模块

### 2. 工具类 (`tests/performance/utils.ts`)

提供性能测试的核心工具：

- **PerformanceCollector**: 收集和分析性能指标
- **PerformanceMetrics**: 性能指标接口定义
- **evaluatePerformance()**: 评估性能等级
- **formatDuration()**: 格式化时间
- **runConcurrently()**: 并发执行工具
- **generateTestData()**: 生成测试数据

### 3. API 性能基准测试 (`tests/performance/api-benchmark.test.ts`)

**测试范围**: 21 个 API 模块

- **GET 请求测试**: 列表查询、详情查询
- **POST 请求测试**: 创建操作
- **PUT 请求测试**: 更新操作
- **DELETE 请求测试**: 删除操作

**性能标准**:
```
GET 请求:      优秀 < 100ms, 良好 < 300ms, 可接受 < 1000ms
Mutation 请求: 优秀 < 200ms, 良好 < 500ms, 可接受 < 1500ms
批量操作:      优秀 < 500ms, 良好 < 1000ms, 可接受 < 3000ms
```

**测试模块**:
- tasks, projects, documents, members
- chat-sessions, chat-messages
- milestones, templates, sop-templates
- skills, agents, sessions
- scheduled-tasks, deliveries
- approval-requests, blog, comments
- health, sse, mcp, auth

### 4. 数据库性能测试 (`tests/performance/database.test.ts`)

**测试场景**:

#### 查询性能
- 单条查询（根据 ID 查询任务）
- 列表查询（分页查询任务）
- 复杂查询（多条件筛选）

#### 写入性能
- 单条插入
- 批量插入（100 条/次）
- 更新操作

#### 并发性能
- 并发读取（10/20/50 并发）
- 并发写入（10/20 并发）

**性能标准**:
```
单条查询:  优秀 < 10ms,  良好 < 50ms,   可接受 < 200ms
批量查询:  优秀 < 100ms, 良好 < 500ms,  可接受 < 2000ms
写入操作:  优秀 < 20ms,  良好 < 100ms,  可接受 < 500ms
```

### 5. MCP 执行性能测试 (`tests/performance/mcp.test.ts`)

**测试范围**: 27 个 MCP 工具

**工具分类**:

#### 读取类工具
- `list_tasks`, `get_task`
- `list_documents`, `get_document`
- `list_projects`, `get_project`
- `list_members`
- `list_schedules`, `list_milestones`
- `list_templates`, `list_sops`

#### 写入类工具
- `create_task`, `update_task`, `delete_task`
- `create_document`, `update_document`, `delete_document`
- `create_project`, `update_project`, `delete_project`
- `create_member`, `update_member`, `delete_member`
- `create_schedule`, `create_milestone`
- `create_template`, `create_sop`

**测试场景**:
- 单工具调用性能
- 批量操作性能
- 错误率测试

### 6. Gateway WebSocket 性能测试 (`tests/performance/gateway.test.ts`)

**前置条件**: OpenClaw Gateway 运行在 `ws://localhost:18789`

**测试场景**:
- 快照请求性能
- Agent 列表请求性能
- Session 列表请求性能
- 并发请求性能（5/10/20 并发）
- 连接稳定性测试（10 秒持续测试）

**特性**:
- 自动连接和认证
- 请求超时处理
- 连接状态检测

### 7. 前端性能测试 (`tests/performance/frontend.spec.ts`)

**测试框架**: Playwright E2E

**测试页面**:
- 首页
- 任务列表页
- 项目列表页
- 文档列表页
- 设置页

**性能指标 (Web Vitals)**:
```
FCP (首次内容绘制):   优秀 < 1s,  良好 < 2s,  可接受 < 3s
LCP (最大内容绘制):   优秀 < 2s,  良好 < 3s,  可接受 < 4s
FID (首次输入延迟):   优秀 < 50ms, 良好 < 100ms, 可接受 < 300ms
CLS (累积布局偏移):   优秀 < 0.05, 良好 < 0.1,  可接受 < 0.25
```

**测试场景**:
- 页面加载性能
- 交互响应时间
- 列表滚动性能

### 8. 报告生成器 (`tests/performance/reporter.ts`)

**功能**:
- 生成 Markdown 格式报告
- 生成 JSON 格式报告
- 自动分析性能瓶颈
- 提供优化建议

**报告内容**:
- 测试概览（总测试数、通过率）
- 性能详情（按模块）
- 优化建议（慢响应、高错误率、高内存使用）

## 运行方式

### 方式 1: 运行所有测试（推荐）

```bash
./tests/performance/run-performance-tests.sh
```

此脚本会：
1. 检查开发服务器状态
2. 依次运行所有性能测试
3. 生成综合报告

### 方式 2: 运行单个测试

```bash
# API 性能测试
npm run test:unit tests/performance/api-benchmark.test.ts

# 数据库性能测试
npm run test:unit tests/performance/database.test.ts

# MCP 性能测试
npm run test:unit tests/performance/mcp.test.ts

# Gateway 性能测试
npm run test:unit tests/performance/gateway.test.ts

# 前端性能测试
npx playwright test tests/performance/frontend.spec.ts
```

### 方式 3: 运行压力测试

```bash
npm run test:stress
```

## 测试报告

测试报告保存在 `tests/reports/performance/` 目录：

```
tests/reports/performance/
├── performance-summary-{timestamp}.md    # 综合报告
├── api-benchmark-{timestamp}.log          # API 测试日志
├── database-{timestamp}.log               # 数据库测试日志
├── mcp-{timestamp}.log                    # MCP 测试日志
├── gateway-{timestamp}.log                # Gateway 测试日志
└── frontend-{timestamp}.log               # 前端测试日志
```

## 性能标准总结

### API 性能

| 操作类型 | 优秀 | 良好 | 可接受 |
|---------|------|------|--------|
| GET 请求 | < 100ms | < 300ms | < 1000ms |
| Mutation 请求 | < 200ms | < 500ms | < 1500ms |
| 批量操作 | < 500ms | < 1000ms | < 3000ms |

### 数据库性能

| 操作类型 | 优秀 | 良好 | 可接受 |
|---------|------|------|--------|
| 单条查询 | < 10ms | < 50ms | < 200ms |
| 批量查询 | < 100ms | < 500ms | < 2000ms |
| 写入操作 | < 20ms | < 100ms | < 500ms |

### 前端性能

| 指标 | 优秀 | 良好 | 可接受 |
|------|------|------|--------|
| FCP | < 1s | < 2s | < 3s |
| LCP | < 2s | < 3s | < 4s |
| FID | < 50ms | < 100ms | < 300ms |
| CLS | < 0.05 | < 0.1 | < 0.25 |

## 测试覆盖

✅ **API 模块**: 21 个模块，4 种 HTTP 方法
✅ **数据库操作**: 查询、写入、并发
✅ **MCP 工具**: 27 个工具，读写分类测试
✅ **WebSocket**: 连接稳定性、并发性能
✅ **前端页面**: 5 个页面，Web Vitals 指标
✅ **压力测试**: 100 并发用户，持续 60s

## 使用建议

### 日常开发

```bash
# 快速检查 API 性能
npm run test:unit tests/performance/api-benchmark.test.ts
```

### 发布前检查

```bash
# 运行完整性能测试
./tests/performance/run-performance-tests.sh
```

### 性能优化

1. 运行性能测试，查看报告
2. 关注 "failed" 和 "需优化" 的模块
3. 分析慢查询/慢请求
4. 优化后重新测试验证

## 后续优化方向

1. **自动化集成**: 集成到 CI/CD 流程
2. **性能趋势**: 记录历史数据，分析性能趋势
3. **告警机制**: 性能下降时自动告警
4. **A/B 测试**: 支持性能对比测试
5. **真实场景**: 模拟真实用户行为模式

## 总结

本性能测试套件提供了：

✅ **全面覆盖**: 6 大测试模块，覆盖所有关键性能点
✅ **易于使用**: 一键运行，自动生成报告
✅ **清晰标准**: 明确的性能等级和阈值
✅ **实用建议**: 自动分析并提供优化建议
✅ **可扩展**: 易于添加新的测试场景

测试套件已准备就绪，可以随时运行以评估系统性能！
