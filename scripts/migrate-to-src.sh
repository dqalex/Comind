#!/bin/bash
# TeamClaw Phase 4 迁移脚本
# 将代码从旧目录迁移到 src/ 新架构

set -e

echo "=========================================="
echo "TeamClaw Phase 4: 目录结构迁移"
echo "=========================================="

# 步骤1: 替换 UI 组件导入
echo ""
echo "步骤1: 替换 UI 组件 @/components/ui → @/shared/ui"
echo "------------------------------------------"

# macOS 使用 -i ''，Linux 使用 -i
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_CMD="sed -i ''"
else
    SED_CMD="sed -i"
fi

# 查找并替换所有 @/components/ui 导入
FILES=$(grep -rl "from ['\"]@/components/ui" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null || true)
COUNT=$(echo "$FILES" | grep -c . || echo "0")
echo "找到 $COUNT 个文件需要替换"

if [ -n "$FILES" ]; then
    for file in $FILES; do
        $SED_CMD 's|from "@/components/ui|from "@/shared/ui|g' "$file"
        $SED_CMD "s|from '@/components/ui|from '@/shared/ui|g" "$file"
    done
    echo "✅ UI 组件导入替换完成"
else
    echo "✅ 无需替换 UI 组件"
fi

# 步骤2: 替换 Hooks 导入
echo ""
echo "步骤2: 替换 Hooks @/hooks → @/shared/hooks"
echo "------------------------------------------"

FILES=$(grep -rl "from ['\"]@/hooks/" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null || true)
COUNT=$(echo "$FILES" | grep -c . || echo "0")
echo "找到 $COUNT 个文件需要替换"

if [ -n "$FILES" ]; then
    for file in $FILES; do
        $SED_CMD 's|from "@/hooks/|from "@/shared/hooks/|g' "$file"
        $SED_CMD "s|from '@/hooks/|from '@/shared/hooks/|g" "$file"
    done
    echo "✅ Hooks 导入替换完成"
else
    echo "✅ 无需替换 Hooks"
fi

# 步骤3: 验证没有遗漏
echo ""
echo "步骤3: 验证迁移结果"
echo "------------------------------------------"

UI_REFS=$(grep -r "from ['\"]@/components/ui" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
HOOK_REFS=$(grep -r "from ['\"]@/hooks/" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)

echo "剩余 @/components/ui 引用: $UI_REFS"
echo "剩余 @/hooks/ 引用: $HOOK_REFS"

if [ "$UI_REFS" -eq 0 ] && [ "$HOOK_REFS" -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 迁移完成！"
    echo "=========================================="
    echo ""
    echo "下一步:"
    echo "1. 运行 npm run build 验证"
    echo "2. 运行 npm run test:unit 检查测试"
    echo "3. 删除旧目录: rm -rf components/ui hooks/"
else
    echo ""
    echo "⚠️ 还有未完成的替换，请检查上述文件"
fi
