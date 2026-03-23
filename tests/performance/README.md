# TeamClaw 性能测试套件

本目录包含 TeamClaw 项目的全面性能测试套件，覆盖 API、数据库、MCP、Gateway、前端等多个维度。

## 测试类型

### 1. API 性能基准测试 (`api-benchmark.test.ts`)

测试所有 API 模块的响应时间和吞吐量。

**测试范围：**
- 21 个 API 模块
- GET/POST/PUT/DELETE 四种 HTTP 方法
- 每个测试 100 次迭代 + 10 次预热

**性能标准：**
- GET 请求：优秀 < 100ms，良好 < 300ms，可接受 < 1000ms
- Mutation 请求：优秀 < 200ms，良好 < 500ms，可接受 < 1500ms

### 2. 数据库性能测试 (`database.test.ts`)

测试 SQLite 数据库的查询、写入、并发性能。

**测试场景：**
- 单条查询（根据 ID）
- 列表查询（分页）
- 复杂查询（多条件筛选）
- 单条插入
- 批量插入
- 更新操作
- 并发读取/写入

**性能标准：**
- 单条查询：优秀 < 10ms，良好 < 50ms，可接受 < 200ms
- 批量查询：优秀 < 100ms，良好 < 500ms，可接受 < 2000ms
- 写入操作：优秀 < 20ms，良好 < 100ms，可接受 < 500ms

### 3. MCP 执行性能测试 (`mcp.test.ts`)

测试 MCP 工具调用的响应时间。

**测试范围：**
- 27 个 MCP 工具
- 读取类工具（list_*, get_*）
- 写入类工具（create_*, update_*, delete_*）
- 批量操作

### 4. Gateway WebSocket 性能测试 (`gateway.test.ts`)

测试 OpenClaw Gateway 的 WebSocket 连接性能。

**前置条件：**
- Gateway 需要运行在 `ws://localhost:18789`
- 需要配置有效的 Token

**测试场景：**
- 快照请求
- Agent/Session 列表请求
- 并发请求
- 连接稳定性

### 5. 前端性能测试 (`frontend.spec.ts`)

使用 Playwright 测试前端页面的 Web Vitals。

**测试页面：**
- 首页
- 任务列表
- 项目列表
- 文档列表
- 设置页

**性能指标：**
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)

## 快速开始

### 运行所有性能测试

```bash
# 方式 1: 使用脚本（推荐）
./tests/performance/run-performance-tests.sh

# 方式 2: 分别运行各模块
npm run test:unit tests/performance/api-benchmark.test.ts
npm run test:unit tests/performance/database.test.ts
npm run test:unit tests/performance/mcp.test.ts
npm run test:unit tests/performance/gateway.test.ts
npx playwright test tests/performance/frontend.spec.ts
```

### 运行单个测试

```bash
# API 性能测试
npm run test:unit tests/performance/api-benchmark.test.ts

# 数据库性能测试
npm run test:unit tests/performance/database.test.ts

# MCP 性能测试
npm run test:unit tests/performance/mcp.test.ts

# 前端性能测试
npx playwright test tests/performance/frontend.spec.ts
```

### 运行压力测试

```bash
npm run test:stress
```

## 配置说明

### 性能阈值配置 (`config.ts`)

```typescript
PERFORMANCE_CONFIG = {
  baseline: {
    iterations: 100,        // 每个测试迭代次数
    warmupIterations: 10,   // 预热次数
    concurrentUsers: [1, 5, 10, 20, 50], // 并发用户数
  },
  
  thresholds: {
    api: {
      get: { excellent: 100, good: 300, acceptable: 1000 },
      mutation: { excellent: 200, good: 500, acceptable: 1500 },
    },
    database: {
      singleQuery: { excellent: 10, good: 50, acceptable: 200 },
    },
    frontend: {
      fcp: { excellent: 1000, good: 2000, acceptable: 3000 },
      lcp: { excellent: 2000, good: 3000, acceptable: 4000 },
    },
  },
}
```

### 环境变量

```bash
# 测试服务器地址
BASE_URL=http://localhost:3000

# Gateway 地址
GATEWAY_URL=ws://localhost:18789

# Gateway Token
GATEWAY_TOKEN=your-token

# 测试数据库路径
TEST_DB_PATH=./data/teamclaw.db
```

## 测试报告

测试报告保存在 `tests/reports/performance/` 目录：

- `performance-summary-{timestamp}.md` - 综合报告
- `api-benchmark-{timestamp}.log` - API 测试日志
- `database-{timestamp}.log` - 数据库测试日志
- `mcp-{timestamp}.log` - MCP 测试日志
- `gateway-{timestamp}.log` - Gateway 测试日志
- `frontend-{timestamp}.log` - 前端测试日志

## 性能优化建议

根据测试结果，系统会自动生成优化建议：

1. **慢响应模块**: 平均响应时间 > 500ms 的模块
2. **高错误率模块**: 错误率 > 5% 的模块
3. **高内存使用**: 堆内存使用 > 100MB 的模块
4. **未达标模块**: 性能等级为 "failed" 的模块

## 工具类说明

### PerformanceCollector

收集和分析性能指标：

```typescript
const collector = new PerformanceCollector();
collector.start();

// 记录响应
collector.recordResponse(duration, success, error);

collector.stop();
const metrics = collector.getMetrics();
```

### ReportGenerator

生成性能测试报告：

```typescript
const generator = new ReportGenerator();
const report = mergeTestResults(results);
const savedFiles = generator.saveReport(report, 'both');
```

## 注意事项

1. **开发服务器**: 测试前确保开发服务器正在运行（脚本会自动启动）
2. **Gateway**: Gateway 测试需要 OpenClaw Gateway 运行
3. **数据库**: 数据库测试会创建和清理测试数据
4. **并发测试**: 压力测试会创建大量并发请求，请谨慎使用
5. **内存**: 长时间运行可能占用较多内存，建议定期重启测试环境

## 持续集成

在 CI/CD 中运行性能测试：

```yaml
# .github/workflows/performance.yml
- name: Run performance tests
  run: |
    npm run dev &
    sleep 10
    npm run test:unit tests/performance/
    npx playwright test tests/performance/frontend.spec.ts
```

## 故障排查

### 常见问题

1. **连接超时**: 检查开发服务器是否运行
2. **认证失败**: 检查测试用户是否存在
3. **Gateway 连接失败**: 检查 Gateway 是否运行在正确的端口
4. **数据库锁定**: 减少并发数或增加 busy timeout

### 调试模式

```bash
# 详细日志
npm run test:unit tests/performance/api-benchmark.test.ts -- --reporter=verbose

# 调试模式
npx playwright test tests/performance/frontend.spec.ts --debug
```
