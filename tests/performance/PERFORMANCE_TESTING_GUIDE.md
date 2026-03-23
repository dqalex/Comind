# TeamClaw 性能测试概览

## 快速开始

### 运行所有性能测试
```bash
npm run test:perf
```

### 运行单个模块测试
```bash
# API 性能测试
npm run test:perf:api

# 数据库性能测试
npm run test:perf:db

# MCP 性能测试
npm run test:perf:mcp

# Gateway 性能测试
npm run test:perf:gateway

# 前端性能测试
npm run test:perf:frontend
```

## 测试覆盖

### 1️⃣ API 性能 (21 模块)
- **GET 请求**: 列表查询、详情查询
- **POST 请求**: 创建操作
- **PUT 请求**: 更新操作  
- **DELETE 请求**: 删除操作

**性能标准**:
- 优秀: < 100ms (GET), < 200ms (Mutation)
- 良好: < 300ms (GET), < 500ms (Mutation)
- 可接受: < 1000ms (GET), < 1500ms (Mutation)

### 2️⃣ 数据库性能
- **查询**: 单条查询、列表查询、复杂查询
- **写入**: 单条插入、批量插入、更新
- **并发**: 10/20/50 并发测试

**性能标准**:
- 优秀: 单条 < 10ms, 批量 < 100ms
- 良好: 单条 < 50ms, 批量 < 500ms
- 可接受: 单条 < 200ms, 批量 < 2000ms

### 3️⃣ MCP 性能 (27 工具)
- **读取类**: list_*, get_* 工具
- **写入类**: create_*, update_*, delete_* 工具
- **批量操作**: 并发调用测试

### 4️⃣ Gateway 性能
- WebSocket 连接性能
- 快照/列表请求性能
- 并发请求测试 (5/10/20 并发)
- 连接稳定性测试 (10s)

### 5️⃣ 前端性能 (5 页面)
- 首页、任务列表、项目列表、文档列表、设置页
- **Web Vitals**: FCP, LCP, FID, CLS
- 交互响应时间
- 滚动性能

**性能标准**:
- FCP: 优秀 < 1s, 良好 < 2s
- LCP: 优秀 < 2s, 良好 < 3s

## 测试报告

所有测试报告保存在: `tests/reports/performance/`

报告格式:
- Markdown 综合报告
- 详细日志文件
- JSON 数据文件

## 测试配置

编辑 `tests/performance/config.ts` 调整:
- 迭代次数
- 并发用户数
- 性能阈值
- 超时时间

## 环境要求

- **开发服务器**: 自动启动或手动运行 `npm run dev`
- **Gateway**: 需要 OpenClaw Gateway 运行 (可选)
- **数据库**: 使用现有 SQLite 数据库

## 性能优化建议

测试完成后，系统会自动分析并给出优化建议:

1. **慢响应模块**: 平均响应 > 500ms
2. **高错误率模块**: 错误率 > 5%
3. **高内存使用**: 堆内存 > 100MB
4. **未达标模块**: 性能等级为 "failed"

## 持续集成

集成到 CI/CD:

```yaml
- name: Run performance tests
  run: npm run test:perf:api
```

## 相关文档

- [详细配置](./config.ts)
- [工具类](./utils.ts)
- [完整总结](./SUMMARY.md)
- [使用指南](./README.md)

---

**提示**: 运行 `npm run test:perf` 开始全面的性能测试！
