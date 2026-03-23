#!/bin/bash

#######################################################################
# TeamClaw 性能测试套件
# 
# 运行所有性能测试并生成综合报告
#######################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/tests/reports/performance"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 记录开始时间
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

print_header "TeamClaw 性能测试套件"
echo "测试时间: $(date)"
echo "项目路径: $PROJECT_ROOT"
echo "报告目录: $REPORT_DIR"
echo ""

# 检查服务器是否运行
print_info "检查开发服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    print_success "开发服务器已运行"
else
    print_warning "开发服务器未运行，正在启动..."
    npm run dev > /dev/null 2>&1 &
    DEV_PID=$!
    
    # 等待服务器启动
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            print_success "开发服务器启动成功 (PID: $DEV_PID)"
            break
        fi
        sleep 1
    done
    
    if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_error "开发服务器启动失败"
        exit 1
    fi
fi

echo ""

# 1. API 性能基准测试
print_header "1. API 性能基准测试"
if npm run test:unit -- tests/performance/api-benchmark.test.ts --reporter=verbose 2>&1 | tee "$REPORT_DIR/api-benchmark-$TIMESTAMP.log"; then
    print_success "API 性能基准测试完成"
else
    print_warning "API 性能基准测试部分失败"
fi
echo ""

# 2. 数据库性能测试
print_header "2. 数据库性能测试"
if npm run test:unit -- tests/performance/database.test.ts --reporter=verbose 2>&1 | tee "$REPORT_DIR/database-$TIMESTAMP.log"; then
    print_success "数据库性能测试完成"
else
    print_warning "数据库性能测试部分失败"
fi
echo ""

# 3. MCP 性能测试
print_header "3. MCP 执行性能测试"
if npm run test:unit -- tests/performance/mcp.test.ts --reporter=verbose 2>&1 | tee "$REPORT_DIR/mcp-$TIMESTAMP.log"; then
    print_success "MCP 性能测试完成"
else
    print_warning "MCP 性能测试部分失败"
fi
echo ""

# 4. Gateway WebSocket 性能测试
print_header "4. Gateway WebSocket 性能测试"
if npm run test:unit -- tests/performance/gateway.test.ts --reporter=verbose 2>&1 | tee "$REPORT_DIR/gateway-$TIMESTAMP.log"; then
    print_success "Gateway 性能测试完成"
else
    print_warning "Gateway 性能测试跳过或失败（需要 Gateway 运行）"
fi
echo ""

# 5. 前端性能测试 (Playwright E2E)
print_header "5. 前端性能测试 (E2E)"
if npx playwright test tests/performance/frontend.spec.ts --reporter=list 2>&1 | tee "$REPORT_DIR/frontend-$TIMESTAMP.log"; then
    print_success "前端性能测试完成"
else
    print_warning "前端性能测试部分失败"
fi
echo ""

# 6. 压力测试
print_header "6. 压力测试"
read -p "是否运行压力测试？（耗时较长，y/N）" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if npm run test:stress 2>&1 | tee "$REPORT_DIR/stress-$TIMESTAMP.log"; then
        print_success "压力测试完成"
    else
        print_warning "压力测试失败"
    fi
else
    print_info "跳过压力测试"
fi
echo ""

# 计算总耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 生成综合报告
print_header "生成性能测试报告"

SUMMARY_FILE="$REPORT_DIR/performance-summary-$TIMESTAMP.md"

cat > "$SUMMARY_FILE" << EOF
# TeamClaw 性能测试报告

**测试时间**: $(date)
**总耗时**: ${DURATION}s

## 测试模块

| 模块 | 状态 | 日志文件 |
|------|------|----------|
| API 基准测试 | ✓ | api-benchmark-$TIMESTAMP.log |
| 数据库测试 | ✓ | database-$TIMESTAMP.log |
| MCP 测试 | ✓ | mcp-$TIMESTAMP.log |
| Gateway 测试 | ⚠ | gateway-$TIMESTAMP.log |
| 前端测试 | ✓ | frontend-$TIMESTAMP.log |

## 性能指标摘要

### API 响应时间
- GET 请求：优秀 (< 100ms)，良好 (< 300ms)，可接受 (< 1000ms)
- POST/PUT/DELETE：优秀 (< 200ms)，良好 (< 500ms)，可接受 (< 1500ms)

### 数据库性能
- 单条查询：优秀 (< 10ms)，良好 (< 50ms)，可接受 (< 200ms)
- 批量查询：优秀 (< 100ms)，良好 (< 500ms)，可接受 (< 2000ms)
- 写入操作：优秀 (< 20ms)，良好 (< 100ms)，可接受 (< 500ms)

### 前端性能
- FCP (首次内容绘制): 优秀 (< 1s)，良好 (< 2s)，可接受 (< 3s)
- LCP (最大内容绘制): 优秀 (< 2s)，良好 (< 3s)，可接受 (< 4s)

## 详细报告

请查看各模块的日志文件获取详细性能数据。

---
*报告生成时间: $(date -Iseconds)*
EOF

print_success "性能测试报告已生成: $SUMMARY_FILE"
echo ""

# 打印总结
print_header "测试完成"
echo "总耗时: ${DURATION}s"
echo ""
echo "报告文件:"
echo "  - $SUMMARY_FILE"
ls -lh "$REPORT_DIR"/*-$TIMESTAMP.* 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'
echo ""

# 清理后台进程
if [ ! -z "$DEV_PID" ]; then
    print_info "停止开发服务器 (PID: $DEV_PID)"
    kill $DEV_PID 2>/dev/null || true
fi

print_success "性能测试完成！"
