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
| **Local Deployment** | Deploy on OpenClaw Gateway machine | Most common, Agent direct usage |
| **Remote Deployment** | Deploy to remote production server | Independent production environment needed |

---

## Scenario 1: Local Deployment

Deploy TeamClaw on the same machine running OpenClaw Gateway.

### Step 1: Clone Repository

```bash
# ⚠️ WARNING: Do NOT clone into OpenClaw Agent workspace directory
# TeamClaw has file scanning and writing capabilities that may cause infinite loops
# Recommended: Clone to user home directory

cd ~
git clone https://github.com/dqalex/teamclaw.git
cd teamclaw
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment (Required for Auto-Connection)

Configure TeamClaw to automatically connect to OpenClaw Gateway on startup:

```bash
cp .env.example .env.local
```

Edit `.env.local` with Agent workspace directory and Gateway credentials:

```bash
# Basic
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Gateway auto-connection (REQUIRED)
OPENCLAW_DEFAULT_ENDPOINT=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-gateway-token-here

# Agent workspace directory (REQUIRED for file sync)
# This should point to the Agent's workspace, NOT TeamClaw installation directory
OPENCLAW_WORKSPACE_PATH=/root/workspace
OPENCLAW_WORKSPACE_NAME=Agent Workspace
```

**Key Points:**
- `OPENCLAW_WORKSPACE_PATH` must point to Agent's workspace directory (for Markdown sync)
- TeamClaw installation directory and Agent workspace must be **different directories**
- With these settings, TeamClaw will auto-connect to Gateway on startup

### Step 4: Start Service

**Development:**
```bash
npm run dev
```

**Production (PM2):**
```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

### Step 5: Initialize

Visit `http://localhost:3000` and complete the first-run setup wizard.

---

## Scenario 2: Remote Deployment

Deploy from local machine to remote production server.

### Prerequisites

| Requirement | Description |
|-------------|-------------|
| Local code | Cloned and dependencies installed |
| SSH access | Passwordless login configured |
| Server Node.js | Version 18+ |

### Environment Variables

```bash
export DEPLOY_SERVER="user@your-server-ip"
export DEPLOY_PATH="/path/to/teamclaw"
export DEPLOY_NVM_DIR="/path/to/.nvm"
```

### Deploy Command

```bash
# Standard deployment
./scripts/deploy/deploy.sh

# Skip local build
./scripts/deploy/deploy.sh --skip-build
```

### Verify Deployment

```bash
# Service status
ssh $DEPLOY_SERVER "pm2 status teamclaw"

# Health check
ssh $DEPLOY_SERVER "curl -s http://localhost:3000/api/health"

# Authenticated APIs (expect 401 without login)
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
# Local
npm rebuild argon2

# Remote (deploy.sh handles automatically via prebuilds)
# If argon2 compilation fails, the script will automatically:
# 1. Detect target platform (linux-x64, darwin-arm64, etc.)
# 2. Copy prebuilt binaries from node_modules/argon2/prebuilds/
```

### Initialization Page Not Accessible

**Solution:**
```bash
# Local
echo 'ENABLE_INITIALIZATION=true' >> .env.local && npm run dev

# Remote
ssh $DEPLOY_SERVER "echo 'ENABLE_INITIALIZATION=true' >> $DEPLOY_PATH/.env.local && pm2 restart teamclaw"
```

### Database Locked

**Solution:** Restart the service.

---

## PM2 Commands

```bash
# Local
pm2 start teamclaw
pm2 stop teamclaw
pm2 restart teamclaw
pm2 logs teamclaw

# Remote
ssh $DEPLOY_SERVER "pm2 start teamclaw"
ssh $DEPLOY_SERVER "pm2 restart teamclaw"
ssh $DEPLOY_SERVER "pm2 logs teamclaw"
```

---

## Data Backup

```bash
# Local
cp data/teamclaw.db backups/teamclaw_$(date +%Y%m%d).db

# Remote
ssh $DEPLOY_SERVER "cp $DEPLOY_PATH/data/teamclaw.db $DEPLOY_PATH/backups/teamclaw_$(date +%Y%m%d).db"
```

---

## Related Documentation

| Document | Path |
|----------|------|
| User Guide | `docs/product/USER_GUIDE.md` |
| Developer Guide | `docs/technical/DEVELOPMENT.md` |
| API Reference | `docs/technical/API.md` |
