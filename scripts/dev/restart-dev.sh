#!/bin/bash
# TeamClaw 开发服务器重启脚本
# 快速 3 步流程：关闭 → 清理缓存 → 启动

# 获取脚本所在目录的绝对路径，然后定位到项目根目录
# 脚本位于 scripts/dev/，需要往上走两层才能到项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "=========================================="
echo "TeamClaw 开发服务器重启"
echo "项目根目录: $PROJECT_ROOT"
echo "=========================================="

# 1. 关闭开发服务器
echo "[1/3] 关闭开发服务器..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
# 等待进程完全退出
sleep 2
echo "✓ 已关闭"

# 2. 清理缓存
echo "[2/3] 清理构建缓存..."
cd "$PROJECT_ROOT"
echo "当前目录: $(pwd)"
# 强制删除 .next 目录
if [ -d ".next" ]; then
  rm -rf .next
  if [ -d ".next" ]; then
    echo "警告: .next 目录删除失败，跳过清理"
  else
    echo "✓ 已清理 .next"
  fi
else
  echo "✓ .next 目录不存在，跳过"
fi

# 3. 启动开发服务器
echo "[3/3] 启动开发服务器..."
echo "=========================================="
npm run dev
