#!/bin/bash
# TeamClaw 部署脚本
# 用法: ./scripts/deploy/deploy.sh [--skip-build] [--init-db] [--local]
#
# 部署模式：
#   本地部署（默认，当 DEPLOY_SERVER 未设置时）：
#     - 所有操作在本地执行
#     - 适用于 Agent 在 TeamClaw 项目目录内直接部署
#
#   远程部署（设置 DEPLOY_SERVER 时）：
#     - 通过 SSH 部署到远程服务器
#     - 需要设置环境变量：DEPLOY_SERVER, DEPLOY_PATH, DEPLOY_NVM_DIR

set -e

# 配置
LOCAL_PATH="$(pwd)"

# 检测部署模式
if [ -n "${DEPLOY_SERVER}" ] && [ -n "${DEPLOY_PATH}" ]; then
  # 远程部署模式（使用环境变量）
  DEPLOY_MODE="remote"
  SERVER="${DEPLOY_SERVER}"
  REMOTE_PATH="${DEPLOY_PATH}"
  NVM_INIT="${DEPLOY_NVM_DIR:+source $DEPLOY_NVM_DIR/nvm.sh && nvm use 22 &&}"
elif [ -n "${DEPLOY_SERVER}" ]; then
  # 部分环境变量设置，提示用户
  echo "⚠️  警告: DEPLOY_SERVER 已设置但 DEPLOY_PATH 未设置"
  echo "    请设置完整的环境变量：DEPLOY_SERVER, DEPLOY_PATH, DEPLOY_NVM_DIR"
  echo "    参见 .codebuddy/rules/deploy-enforcement.mdc"
  exit 1
else
  # 本地部署模式（未设置远程服务器环境变量）
  DEPLOY_MODE="local"
  SERVER=""
  REMOTE_PATH="${LOCAL_PATH}"
  NVM_INIT=""
fi

# 解析参数
SKIP_BUILD=false
INIT_DB=false
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --init-db)
      INIT_DB=true
      shift
      ;;
    --local)
      DEPLOY_MODE="local"
      SERVER=""
      REMOTE_PATH="${LOCAL_PATH}"
      NVM_INIT=""
      shift
      ;;
  esac
done

echo "=========================================="
echo "TeamClaw 部署脚本"
echo "=========================================="
echo "部署模式: ${DEPLOY_MODE}"
if [ "${DEPLOY_MODE}" = "remote" ]; then
  echo "服务器: $SERVER"
  echo "远程路径: $REMOTE_PATH"
fi
echo "工作目录: $LOCAL_PATH"
echo "跳过构建: $SKIP_BUILD"
echo "初始化数据库: $INIT_DB"
echo ""

# ============================================
# 通用函数
# ============================================

# 执行命令（根据部署模式选择本地或远程）
run_cmd() {
  if [ "${DEPLOY_MODE}" = "remote" ]; then
    ssh $SERVER "$NVM_INIT $*"
  else
    eval "$*"
  fi
}

# 执行命令并返回结果
run_cmd_result() {
  if [ "${DEPLOY_MODE}" = "remote" ]; then
    ssh $SERVER "$NVM_INIT $*"
  else
    eval "$*"
  fi
}

# 检测目标平台信息
detect_platform() {
  PLATFORM=$(run_cmd "uname -s | tr '[:upper:]' '[:lower:]'")
  ARCH=$(run_cmd "uname -m")
  LIBC=$(run_cmd "ldd --version 2>&1 | head -1 | grep -qi 'musl' && echo 'musl' || echo 'glibc'")

  # 映射架构名称（兼容各种命名）
  case $ARCH in
    x86_64) ARCH_MAP="x64" ;;
    i386|i486|i586|i686) ARCH_MAP="x86" ;;
    aarch64|arm64) ARCH_MAP="arm64" ;;
    armv7l|armv7) ARCH_MAP="arm" ;;
    armv8l|armv8) ARCH_MAP="arm64" ;;
    *) ARCH_MAP="$ARCH" ;;
  esac

  echo "目标平台: $PLATFORM-$ARCH_MAP ($LIBC)"
}

# 数据库初始化确认（如果显式请求）
if [ "$INIT_DB" = true ]; then
  echo "⚠️  警告: 您选择了初始化数据库"
  echo "    这将删除所有现有数据并重新创建空数据库！"
  read -p "    确定要继续吗? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "已取消数据库初始化"
    INIT_DB=false
  fi
fi

# ============================================
# 步骤 1: 构建
# ============================================
if [ "$SKIP_BUILD" = false ]; then
  echo "[1/8] 构建..."
  npm run build

  if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
  fi
  echo "✓ 构建完成"
else
  echo "[1/8] 跳过构建"
fi

# ============================================
# 步骤 2: 根据部署模式选择后续流程
# ============================================
if [ "${DEPLOY_MODE}" = "remote" ]; then
  # ---- 远程部署模式 ----

  # 2. 同步文件到服务器（排除 data/ 目录保护数据库）
  echo "[2/8] 同步文件到服务器..."
  rsync -avz --delete \
    --exclude='node_modules/' \
    --exclude='.next/' \
    --exclude='data/' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env*.local' \
    --exclude='.codebuddy/' \
    --exclude='logs/' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

  if [ $? -ne 0 ]; then
    echo "❌ 同步失败"
    exit 1
  fi
  echo "✓ 同步完成"

  # 3. 服务器端安装依赖
  echo "[3/8] 服务器端安装依赖..."
  run_cmd "cd $REMOTE_PATH && npm install --production=false"

  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
  fi
  echo "✓ 依赖安装完成"

  # 4. 服务器端构建
  if [ "$SKIP_BUILD" = false ]; then
    echo "[4/8] 服务器端构建..."
    run_cmd "cd $REMOTE_PATH && npm run build"

    if [ $? -ne 0 ]; then
      echo "❌ 服务器构建失败"
      exit 1
    fi
    echo "✓ 服务器构建完成"
  else
    echo "[4/8] 跳过服务器构建"
  fi

else
  # ---- 本地部署模式 ----

  # 2. 安装依赖（仅在需要时）
  echo "[2/8] 检查依赖..."
  if [ ! -d "node_modules" ] || [ "$SKIP_BUILD" = true ]; then
    echo "  安装依赖..."
    npm install --production=false
    echo "✓ 依赖检查完成"
  else
    echo "✓ 依赖已就绪"
  fi

  # 3-4. 跳过（本地构建已在步骤1完成）
  echo "[3/8] 跳过（本地模式）"
  echo "[4/8] 跳过（本地模式）"
fi

# ============================================
# 步骤 5: 处理原生模块
# ============================================
echo "[5/8] 检测目标平台并处理原生模块..."
detect_platform

# 5.1 重建 better-sqlite3
echo "[5.1/8] 重建 better-sqlite3..."
REBUILD_RESULT=$(run_cmd "cd $REMOTE_PATH && npm rebuild better-sqlite3 2>&1")
if echo "$REBUILD_RESULT" | grep -qi "error\|failed"; then
  echo "  ⚠️  better-sqlite3 编译输出: $(echo "$REBUILD_RESULT" | tail -2)"
else
  echo "  ✓ better-sqlite3 重建完成"
fi

# 5.2 处理 argon2 原生模块
# argon2 需要 C 编译器（gcc）和 Python 2 进行 node-gyp 构建
# 如果没有，先尝试安装；否则使用预编译版本
echo "[5.2/8] 处理 argon2 原生模块..."
REBUILD_ARGON2=$(run_cmd "cd $REMOTE_PATH && npm rebuild argon2 2>&1")
if echo "$REBUILD_ARGON2" | grep -qi "error\|failed"; then
  echo "  argon2 编译失败，尝试使用预编译版本..."

  # 检测目标平台的预编译文件
  echo "  查找预编译文件: ${PLATFORM}-${ARCH_MAP}"

  # 创建 standalone 的 argon2 目录结构
  run_cmd "mkdir -p $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release"

  # 尝试多种可能的预编译文件路径
  # argon2 预编译文件命名规则：<platform>-<arch>/argon2.<arch>.<libc>.node 或 <platform>-<arch>/argon2.<libc>.node
  PREBUILDS=(
    "$REMOTE_PATH/node_modules/argon2/prebuilds/${PLATFORM}-${ARCH_MAP}/argon2.${ARCH_MAP}.${LIBC}.node"
    "$REMOTE_PATH/node_modules/argon2/prebuilds/${PLATFORM}-x64/argon2.x64.${LIBC}.node"
    "$REMOTE_PATH/node_modules/argon2/prebuilds/${PLATFORM}-${ARCH_MAP}/${PLATFORM}.${ARCH_MAP}.${LIBC}.node"
    "$REMOTE_PATH/node_modules/argon2/prebuilds/${PLATFORM}-${ARCH_MAP}/argon2.${LIBC}.node"
    "$REMOTE_PATH/node_modules/argon2/prebuilds/${PLATFORM}-x64/argon2.${LIBC}.node"
  )

  COPIED=false
  for PREBUILD in "${PREBUILDS[@]}"; do
    if run_cmd "test -f $PREBUILD"; then
      run_cmd "cp $PREBUILD $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.node"
      echo "  ✓ 已复制: $PREBUILD"
      COPIED=true
      break
    fi
  done

  if [ "$COPIED" = false ]; then
    echo "  ⚠️  未找到 $PLATFORM-$ARCH_MAP ($LIBC) 的预编译文件"
    echo "  可用的预编译平台:"
    run_cmd "find $REMOTE_PATH/node_modules/argon2/prebuilds -type d -maxdepth 1 | xargs -I {} basename {}"
    echo "  "
    echo "  解决方案:"
    echo "  1. 安装编译工具链: yum install -y gcc python2 make"
    echo "  2. 或升级到 64 位系统（推荐）"
  fi
else
  echo "  ✓ argon2 编译成功"
fi

# 5.3 重建 standalone 目录的 better-sqlite3
echo "[5.3/8] 重建 standalone 的 better-sqlite3..."
# 清理旧的编译文件确保干净重建
run_cmd "cd $REMOTE_PATH/.next/standalone && rm -rf node_modules/better-sqlite3/build/Release/*.node 2>/dev/null || true"
run_cmd "cd $REMOTE_PATH/.next/standalone && npm rebuild better-sqlite3 2>&1 | tail -3"
echo "✓ standalone better-sqlite3 重建完成"

# 5.4 处理 standalone 的 argon2
echo "[5.4/8] 处理 standalone 的 argon2..."
# 如果主目录的 argon2 编译成功，复制到 standalone
if run_cmd "test -f $REMOTE_PATH/node_modules/argon2/build/Release/argon2.node"; then
  run_cmd "cp $REMOTE_PATH/node_modules/argon2/build/Release/argon2.node $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/ 2>/dev/null || true"
  echo "  ✓ 已复制编译好的 argon2.node"
elif run_cmd "test -f $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.glibc.node"; then
  # 重命名预编译文件为argon2.node
  run_cmd "cp $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.glibc.node $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.node"
  echo "  ✓ 已重命名 glibc 预编译文件"
elif run_cmd "test -f $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.musl.node"; then
  run_cmd "cp $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.musl.node $REMOTE_PATH/.next/standalone/node_modules/argon2/build/Release/argon2.node"
  echo "  ✓ 已重命名 musl 预编译文件"
fi

# ============================================
# 步骤 6: 复制静态文件和配置到 standalone
# ============================================
echo "[6/8] 复制静态文件和配置到 standalone..."

if [ "${DEPLOY_MODE}" = "remote" ]; then
  # 远程模式使用 scp/rsync
  run_cmd "cd $REMOTE_PATH && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/"
  run_cmd "cd $REMOTE_PATH && cp -r public .next/standalone/ 2>/dev/null || echo 'No public directory'"
  run_cmd "cd $REMOTE_PATH && mkdir -p .next/standalone/node_modules/chokidar && cp -r node_modules/chokidar/* .next/standalone/node_modules/chokidar/ 2>/dev/null || true"

  # 验证静态文件复制成功
  STATIC_CHUNKS_COUNT=$(run_cmd "ls $REMOTE_PATH/.next/standalone/.next/static/chunks/ 2>/dev/null | wc -l")
  echo "  ✓ 静态 chunks 文件数: $STATIC_CHUNKS_COUNT"

  # 关键：standalone 读取 .env.local，不是 .env
  if run_cmd "test -f $REMOTE_PATH/.env"; then
    run_cmd "cd $REMOTE_PATH && cp .env .next/standalone/.env.local"
    echo "✓ .env 已复制为 .env.local"
  else
    echo "⚠️  警告: .env 文件不存在，跳过复制"
  fi
else
  # 本地模式直接复制
  mkdir -p .next/standalone/.next/
  cp -r .next/static .next/standalone/.next/
  cp -r public .next/standalone/ 2>/dev/null || echo 'No public directory'
  mkdir -p .next/standalone/node_modules/chokidar
  cp -r node_modules/chokidar/* .next/standalone/node_modules/chokidar/ 2>/dev/null || true

  # 验证静态文件复制成功
  STATIC_CHUNKS_COUNT=$(ls .next/standalone/.next/static/chunks/ 2>/dev/null | wc -l)
  echo "  ✓ 静态 chunks 文件数: $STATIC_CHUNKS_COUNT"

  # 关键：standalone 读取 .env.local，不是 .env
  if [ -f ".env" ]; then
    cp .env .next/standalone/.env.local
    echo "✓ .env 已复制为 .env.local"
  else
    echo "⚠️  警告: .env 文件不存在，跳过复制"
  fi
fi

echo "✓ 静态文件和配置复制完成"

# ============================================
# 步骤 7: 确保环境变量完整
# ============================================
echo "[7/8] 检查并生成缺失的环境变量..."

ENV_FILE="$REMOTE_PATH/.next/standalone/.env.local"

if [ "${DEPLOY_MODE}" = "remote" ]; then
  run_cmd "
    cd $REMOTE_PATH/.next/standalone && \
    if ! grep -q 'TEAMCLAW_API_TOKEN=' .env.local 2>/dev/null || grep -q 'TEAMCLAW_API_TOKEN=\$' .env.local 2>/dev/null; then
      sed -i 's/TEAMCLAW_API_TOKEN=.*/TEAMCLAW_API_TOKEN='\$(openssl rand -hex 32)'/' .env.local 2>/dev/null || true
    fi && \
    if ! grep -q 'JWT_SECRET=' .env.local 2>/dev/null || grep -q 'JWT_SECRET=\$' .env.local 2>/dev/null; then
      sed -i 's/JWT_SECRET=.*/JWT_SECRET='\$(openssl rand -base64 48)'/' .env.local 2>/dev/null || true
    fi && \
    if ! grep -q 'MCP_TOKEN_KEY=' .env.local 2>/dev/null || grep -q 'MCP_TOKEN_KEY=\$' .env.local 2>/dev/null; then
      sed -i 's/MCP_TOKEN_KEY=.*/MCP_TOKEN_KEY='\$(openssl rand -hex 32)'/' .env.local 2>/dev/null || true
    fi && \
    if ! grep -q 'SESSION_SECRET=' .env.local 2>/dev/null || grep -q 'SESSION_SECRET=\$' .env.local 2>/dev/null; then
      sed -i 's/SESSION_SECRET=.*/SESSION_SECRET='\$(openssl rand -base64 32)'/' .env.local 2>/dev/null || true
    fi && \
    if ! grep -q 'TOKEN_ENCRYPTION_KEY=' .env.local 2>/dev/null || grep -q 'TOKEN_ENCRYPTION_KEY=\$' .env.local 2>/dev/null; then
      sed -i 's/TOKEN_ENCRYPTION_KEY=.*/TOKEN_ENCRYPTION_KEY='\$(openssl rand -base64 32)'/' .env.local 2>/dev/null || true
    fi
  "
else
  cd .next/standalone
  if ! grep -q 'TEAMCLAW_API_TOKEN=' .env.local 2>/dev/null || grep -q 'TEAMCLAW_API_TOKEN=\$' .env.local 2>/dev/null; then
    sed -i "s/TEAMCLAW_API_TOKEN=.*/TEAMCLAW_API_TOKEN=$(openssl rand -hex 32)/" .env.local 2>/dev/null || true
  fi
  if ! grep -q 'JWT_SECRET=' .env.local 2>/dev/null || grep -q 'JWT_SECRET=\$' .env.local 2>/dev/null; then
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$(openssl rand -base64 48)/" .env.local 2>/dev/null || true
  fi
  if ! grep -q 'MCP_TOKEN_KEY=' .env.local 2>/dev/null || grep -q 'MCP_TOKEN_KEY=\$' .env.local 2>/dev/null; then
    sed -i "s/MCP_TOKEN_KEY=.*/MCP_TOKEN_KEY=$(openssl rand -hex 32)/" .env.local 2>/dev/null || true
  fi
  if ! grep -q 'SESSION_SECRET=' .env.local 2>/dev/null || grep -q 'SESSION_SECRET=\$' .env.local 2>/dev/null; then
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -base64 32)/" .env.local 2>/dev/null || true
  fi
  if ! grep -q 'TOKEN_ENCRYPTION_KEY=' .env.local 2>/dev/null || grep -q 'TOKEN_ENCRYPTION_KEY=\$' .env.local 2>/dev/null; then
    sed -i "s/TOKEN_ENCRYPTION_KEY=.*/TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)/" .env.local 2>/dev/null || true
  fi
  cd ../..
fi

echo "✓ 环境变量检查完成"

# ============================================
# 步骤 7.5: 数据库初始化（如请求）
# ============================================
if [ "$INIT_DB" = true ]; then
  echo "[7.5/8] 重置数据库..."
  if [ "${DEPLOY_MODE}" = "remote" ]; then
    run_cmd "pm2 stop teamclaw 2>/dev/null || echo '服务未运行'"
    run_cmd "rm -f $REMOTE_PATH/.next/standalone/data/teamclaw.db $REMOTE_PATH/.next/standalone/data/teamclaw.db-* 2>/dev/null || echo 'standalone 数据库不存在'"
    run_cmd "rm -f $REMOTE_PATH/data/teamclaw.db $REMOTE_PATH/data/teamclaw.db-* 2>/dev/null || echo 'data 目录数据库不存在'"
  else
    pm2 stop teamclaw 2>/dev/null || echo '服务未运行'
    rm -f .next/standalone/data/teamclaw.db .next/standalone/data/teamclaw.db-* 2>/dev/null || echo 'standalone 数据库不存在'
    rm -f data/teamclaw.db data/teamclaw.db-* 2>/dev/null || echo 'data 目录数据库不存在'
  fi
  echo "✓ 数据库已重置，将在服务启动时自动初始化"
fi

# ============================================
# 步骤 8: 启动/重启服务
# ============================================
echo "[8/8] 启动服务..."

if [ "${DEPLOY_MODE}" = "remote" ]; then
  run_cmd "cd $REMOTE_PATH && pm2 stop teamclaw 2>/dev/null || true && pm2 start .next/standalone/server.js --name teamclaw"

  if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
  fi

  # 等待服务启动
  sleep 3

  # 检查服务状态
  echo ""
  echo "=========================================="
  echo "部署完成！"
  echo "=========================================="
  run_cmd "pm2 status teamclaw"
  echo ""
  echo "访问方式: ssh -L 8000:localhost:3000 $SERVER"
  echo "然后访问: http://localhost:8000"

else
  # 本地模式
  pm2 stop teamclaw 2>/dev/null || true
  pm2 start .next/standalone/server.js --name teamclaw

  if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
  fi

  # 等待服务启动
  sleep 3

  # 检查服务状态
  echo ""
  echo "=========================================="
  echo "部署完成！"
  echo "=========================================="
  pm2 status teamclaw
  echo ""
  echo "访问地址: http://localhost:3000"
fi