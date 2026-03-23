---
name: teamclaw-deploy
description: This skill should be used when the user asks to deploy TeamClaw to a local machine (OpenClaw Gateway environment) or to a remote production server. It provides step-by-step deployment workflows, environment configuration, and troubleshooting guidance for both deployment scenarios.
---

# TeamClaw Deployment Guide

> 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力
> **项目地址**: https://github.com/dqalex/teamclaw

Deploy TeamClaw to local machine (OpenClaw Gateway) or remote production server.

---

## Deployment Scenarios

| Scenario | Description | When to Use |
|----------|-------------|-------------|
| **Local Deployment** | Agent deploys directly in TeamClaw directory | Agent working in TeamClaw project |
| **Remote Deployment** | Deploy to remote production server | Independent production environment |

---

## Scenario 1: Local Deployment (Agent)

当 Agent 在 TeamClaw 项目目录内执行部署时，使用本地部署模式。

### Agent 工作流

Agent 直接在项目目录执行部署命令：

```bash
# 1. 进入项目目录（如果不在）
cd /path/to/teamclaw

# 2. 执行部署脚本（本地模式，无需设置 DEPLOY_SERVER）
./scripts/deploy/deploy.sh

# 3. 验证部署
curl -s http://localhost:3000/api/health
```

### 参数选项

| 参数 | 说明 |
|------|------|
| `--skip-build` | 跳过构建（已有构建产物时使用） |
| `--init-db` | 重置数据库（慎用，会丢失数据） |
| `--local` | 强制使用本地部署模式 |

### 部署步骤

| 步骤 | 说明 |
|------|------|
| 1/8 | 构建 `npm run build` |
| 2/8 | 检查依赖 |
| 5/8 | 重建原生模块（better-sqlite3, argon2） |
| 5.3-5.4 | 重建 standalone 的原生模块 |
| 6/8 | 复制静态文件和配置 |
| 7/8 | 检查/生成环境变量 |
| 8/8 | 启动 PM2 服务 |

### 验证命令

```bash
# 健康检查
curl -s http://localhost:3000/api/health

# 服务状态
pm2 status teamclaw

# 查看日志
pm2 logs teamclaw --lines 20
```

---

## Scenario 2: Remote Deployment

从本地机器部署到远程服务器。

### 环境变量

```bash
export DEPLOY_SERVER="user@your-server-ip"
export DEPLOY_PATH="/path/to/teamclaw"
export DEPLOY_NVM_DIR="/path/to/.nvm"
```

### 部署命令

```bash
# 标准部署
./scripts/deploy/deploy.sh

# 跳过本地构建（服务器已有构建产物）
./scripts/deploy/deploy.sh --skip-build
```

### 部署步骤

| 步骤 | 说明 |
|------|------|
| 1/8 | 本地构建 |
| 2/8 | rsync 同步到服务器 |
| 3/8 | 服务器安装依赖 |
| 4/8 | 服务器构建 |
| 5/8 | 服务器重建原生模块 |
| 6/8 | 复制静态文件和配置 |
| 7/8 | 检查/生成环境变量 |
| 8/8 | 重启 PM2 服务 |

### 验证命令

```bash
# 服务状态
ssh $DEPLOY_SERVER "pm2 status teamclaw"

# 健康检查
ssh $DEPLOY_SERVER "curl -s http://localhost:3000/api/health"

# 认证 API（期望 401）
ssh $DEPLOY_SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/projects"
```

---

## Troubleshooting

### argon2 Native Module Error

**Symptom:**
```
⨯ Error: No native build was found for platform=linux arch=x64
```

**Solution:**
```bash
# 本地
npm rebuild argon2

# 远程（deploy.sh 自动处理）
# 1. 检测目标平台 (linux-x64, darwin-arm64, etc.)
# 2. 复制预编译文件 from node_modules/argon2/prebuilds/
# 3. 如无预编译文件，安装编译工具链: yum install -y gcc python2 make
```

### Initialization Page Not Accessible

**Solution:**
```bash
# 本地
echo 'ENABLE_INITIALIZATION=true' >> .env.local && pm2 restart teamclaw

# 远程
ssh $DEPLOY_SERVER "echo 'ENABLE_INITIALIZATION=true' >> $DEPLOY_PATH/.env.local && pm2 restart teamclaw"
```

### Database Locked

**Solution:** Restart the service.

### Landing Page Error (rendered_html)

**Symptom:** `Landing page content not available`

**Solution:**
```bash
# 数据库迁移会自动添加缺失的列
# 如果问题持续，重启服务触发迁移
pm2 restart teamclaw
```

---

## PM2 Commands

```bash
# 本地
pm2 start teamclaw
pm2 stop teamclaw
pm2 restart teamclaw
pm2 logs teamclaw

# 远程
ssh $DEPLOY_SERVER "pm2 start teamclaw"
ssh $DEPLOY_SERVER "pm2 restart teamclaw"
ssh $DEPLOY_SERVER "pm2 logs teamclaw"
```

---

## Data Backup

```bash
# 本地
cp data/teamclaw.db backups/teamclaw_$(date +%Y%m%d).db

# 远程
ssh $DEPLOY_SERVER "cp $DEPLOY_PATH/data/teamclaw.db $DEPLOY_PATH/backups/teamclaw_$(date +%Y%m%d).db"
```

---

## Related Documentation

| Document | Path |
|----------|------|
| User Guide | `docs/product/USER_GUIDE.md` |
| Developer Guide | `docs/technical/DEVELOPMENT.md` |
| API Reference | `docs/technical/API.md` |