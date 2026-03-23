#!/bin/bash

#######################################################################
# TeamClaw 快速性能测试
# 
# 快速评估各模块性能
#######################################################################

set -e

PROJECT_ROOT="/Users/alex/Documents/alex base/sense/teamclaw"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$PROJECT_ROOT/tests/reports/performance/quick-report-$TIMESTAMP.md"

# 创建报告目录
mkdir -p "$(dirname "$REPORT_FILE")"

echo "# TeamClaw 性能快速测试报告" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**测试时间**: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 测试 API 响应时间
test_api_performance() {
    local module=$1
    local method=$2
    local iterations=${3:-10}
    
    echo "测试 $module $method ..."
    
    local total_time=0
    local success_count=0
    
    for i in $(seq 1 $iterations); do
        start=$(python3 -c "import time; print(int(time.time() * 1000))")
        
        if [ "$method" = "GET" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/$module")
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
                -H "Content-Type: application/json" \
                -d "{\"title\":\"test\",\"content\":\"test\"}" \
                "http://localhost:3000/api/$module")
        fi
        
        end=$(python3 -c "import time; print(int(time.time() * 1000))")
        duration=$((end - start))
        total_time=$((total_time + duration))
        
        if [ "$status" = "200" ] || [ "$status" = "201" ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    avg_time=$((total_time / iterations))
    success_rate=$((success_count * 100 / iterations))
    
    echo "- $module $method: 平均 ${avg_time}ms, 成功率 ${success_rate}%" >> "$REPORT_FILE"
}

echo "## API 性能测试" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 模块 | 方法 | 平均响应时间 | 成功率 |" >> "$REPORT_FILE"
echo "|------|------|-------------|--------|" >> "$REPORT_FILE"

# 测试关键 API
test_api_performance "health" "GET" 20
test_api_performance "tasks" "GET" 10
test_api_performance "projects" "GET" 10
test_api_performance "documents" "GET" 10
test_api_performance "members" "GET" 10

echo "" >> "$REPORT_FILE"
echo "## 数据库性能测试" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 测试数据库查询性能
echo "测试数据库查询..." 
db_size=$(sqlite3 "$PROJECT_ROOT/data/teamclaw.db" "SELECT COUNT(*) FROM tasks")
echo "- 任务数: $db_size" >> "$REPORT_FILE"

db_size=$(sqlite3 "$PROJECT_ROOT/data/teamclaw.db" "SELECT COUNT(*) FROM projects")
echo "- 项目数: $db_size" >> "$REPORT_FILE"

db_size=$(sqlite3 "$PROJECT_ROOT/data/teamclaw.db" "SELECT COUNT(*) FROM documents")
echo "- 文档数: $db_size" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "## 性能评估" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 简单的性能评级
echo "### 性能等级标准" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- **优秀**: < 100ms" >> "$REPORT_FILE"
echo "- **良好**: < 300ms" >> "$REPORT_FILE"
echo "- **可接受**: < 1000ms" >> "$REPORT_FILE"
echo "- **需优化**: > 1000ms" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "*报告生成时间: $(date -Iseconds)*" >> "$REPORT_FILE"

echo ""
echo "✓ 快速性能测试完成"
echo "✓ 报告已保存: $REPORT_FILE"
cat "$REPORT_FILE"
