**English | [中文](./README_zh.md)** | [📖 Agent Guide](skills/deploy/SKILL.md)

# TeamClaw

**Treat AI as a teammate, not a tool.**

TeamClaw is an open-source human-AI collaboration platform that enables AI Agents to participate in project management as real team members — picking up tasks, writing documents, submitting deliveries, and reporting progress.

> Current version: v1.0.1

---

## What Problem Does It Solve?

Most AI tools today work in a "chatbox mode" — you ask, it answers. But real team collaboration goes far beyond that:

| Pain Point | How TeamClaw Solves It |
|------------|---------------------|
| **AI lacks project context** | AI members automatically access full context of projects, tasks, and documents |
| **AI output is untraceable** | Delivery center + review workflow ensures every output is tracked |
| **Task assignment relies on verbal communication** | Push tasks directly to AI from the kanban board, auto-execution starts |
| **AI status is opaque** | Real-time status panel: idle / working / waiting, visible at a glance |
| **Multi-Agent coordination is hard** | Unified Agent management + session management + scheduled tasks |
| **Docs and code fall out of sync** | Bi-directional Markdown sync, local edits auto-sync to cloud |

## Key Features

### 🔐 Multi-User Authentication (v3.0 NEW)

Enterprise-ready multi-user system with role-based access control:
- **Registration & Login**: Secure authentication with password hashing
- **Role System**: Admin and member roles with permission control
- **User-Member Binding**: Each user automatically gets a linked team member profile
- **First-Run Initialization**: Guided setup wizard for new deployments

### 🔧 Skill Management System (v3.0 NEW)

Complete AI Skill lifecycle management:
- **Skill Registration & Validation**: Auto-validate SKILL.md structure compliance
- **Approval Workflow**: Skill publishing requires admin approval
- **Trust Management**: Trust/reject unknown-source Skills
- **Snapshot Monitoring**: Periodic detection of Agent Skill changes with risk alerts
- **Sensitive Content Detection**: Auto-flag Skills containing sensitive information

### ✅ Universal Approval System (v3.0 NEW)

Unified multi-scenario approval workflow:
- **4 Approval Types**: Skill publish, Skill install, Project join, Sensitive action
- **Flexible Strategies**: Approver rules, timeout settings, auto-processing
- **Full Audit Trail**: Complete approval history
- **Notification Integration**: Approval status change notifications

### 🎯 Task-Driven Human-AI Collaboration

The task board isn't just for humans — AI members can receive task pushes, auto-update status, submit check items, and log actions. Supports swimlane grouping, four-column status flow, drag-and-drop sorting, and milestone management.

### 📄 Document Delivery & Review

AI-generated documents shouldn't disappear into the void. The delivery center provides a complete submit → review → revise → approve workflow, with every output verified by human reviewers.

### 🔄 SOP Workflow Engine

Standardized Operating Procedure engine for complex AI tasks:
- **7 Stage Types**: input, ai_auto, ai_with_confirm, manual, render, export, review
- **Template Management**: Create, edit, import/export SOP templates
- **Know-how Knowledge Base**: L1-L5 layered knowledge structure
- **Content Studio Integration**: Visual rendering for document outputs

### 💬 Multi-Mode Communication

Three interaction channels running in parallel:
- **Chat Channel**: Natural language + embedded Actions commands
- **MCP Tools**: 37 standardized interfaces covering tasks, documents, projects, status, and more
- **Markdown Sync**: Local `.md` files auto-sync as tasks, deliveries, and scheduled plans

### 🔗 Deep OpenClaw Gateway Integration

Serving as the enhanced frontend for [OpenClaw Gateway](https://github.com/nicepkg/openclaw), TeamClaw provides visual interfaces for Agent management, session management, skill marketplace, and scheduled task orchestration.

### 📊 Knowledge Graph Wiki

A bi-directional linked document system with automatic relationship mapping and visual knowledge graphs. Supports `[[document]]` references, backlink tracking, and multi-project tagging.

### 🌐 Full Internationalization

Complete English and Chinese coverage, with all UI text managed through i18n.

## Feature Overview

| Module | Description |
|--------|-------------|
| **Authentication** | User registration/login, role-based access control (v3.0) |
| **Initialization** | First-run setup wizard, admin account creation (v3.0) |
| **Skill Management** | Skill registration/approval/trust/snapshot monitoring (v3.0) |
| **Approval System** | Universal approval workflow, multi-scenario support (v3.0) |
| **Dashboard** | System overview, Gateway connection management, quick actions |
| **Task Board** | Swimlane + four-column kanban, drag-and-drop, milestone management |
| **Projects** | Project CRUD, member assignment, progress tracking |
| **Wiki** | Bi-directional links, knowledge graph, multi-type documents |
| **SOP Engine** | Template-driven workflows, 7 stage types, Know-how knowledge base |
| **Agents** | Multi-Agent mode, status monitoring, file management |
| **Sessions** | Session parameter configuration, token statistics |
| **Skills** | Skill enable / install / configure |
| **Scheduler** | Visual scheduling, Cron expressions, execution history |
| **Deliveries** | Submit & review workflow, version management |
| **Members** | Human / AI members, user-member binding (v3.0) |
| **Chat** | Floating panel, multi-mode conversation, MCP commands |
| **OpenClaw Sync** | Bi-directional Markdown sync, version history, conflict resolution |

## Quick Start

### Prerequisites

- **Node.js** 18+
- **OpenClaw Gateway** (optional — Agent features require it; local tasks, documents, and Wiki work without it)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/dqalex/teamclaw.git
cd teamclaw

# Install dependencies
npm install

# Configure environment variables (optional)
cp .env.example .env.local

# Start the dev server
npm run dev

# Visit http://localhost:3000
```

### Connect to Gateway

1. Start [OpenClaw Gateway](https://github.com/nicepkg/openclaw) (default `ws://localhost:18789`)
2. Open TeamClaw → Settings → Gateway Configuration, enter the address and token
3. Once connected, Agent / Session / Skill / Scheduler features are automatically activated

### Environment Variables

#### Basic Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_BASE_URL` | ✅ | Application base URL | `http://localhost:3000` |
| `NEXT_PUBLIC_GATEWAY_URL` | ❌ | Gateway WebSocket address | `ws://localhost:18789` |
| `TEAMCLAW_API_TOKEN` | ❌ | MCP External API auth token | — |
| `TOKEN_ENCRYPTION_KEY` | ❌ | Token encryption key (32+ chars recommended) | — |
| `TEAMCLAW_DB_PATH` | ❌ | Database path | Auto-detected |

#### Auto-Configuration for New Deployment

These environment variables enable automatic configuration on first deployment:

**Gateway Auto-Configuration:**

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_DEFAULT_ENDPOINT` | ❌ | Gateway WebSocket URL (e.g., `ws://127.0.0.1:23001`) |
| `OPENCLAW_TOKEN` | ❌ | Gateway authentication token |
| `GATEWAY_MODE` | ❌ | Connection mode: `server_proxy` or `browser_direct` |

**Workspace Auto-Configuration:**

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `OPENCLAW_WORKSPACE_PATH` | ❌ | Workspace directory path | — |
| `OPENCLAW_WORKSPACE_NAME` | ❌ | Workspace display name | `Default Workspace` |
| `OPENCLAW_WORKSPACE_MEMBER_ID` | ❌ | Associated AI member ID | `null` (unbound) |
| `OPENCLAW_WORKSPACE_SYNC_INTERVAL` | ❌ | Sync interval in seconds | `120` |

**Example `.env` for New Deployment:**

```bash
# Gateway auto-configuration
OPENCLAW_DEFAULT_ENDPOINT=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-gateway-token-here
GATEWAY_MODE=server_proxy

# Workspace auto-configuration
OPENCLAW_WORKSPACE_PATH=/root/workspace
OPENCLAW_WORKSPACE_NAME=Default Workspace
OPENCLAW_WORKSPACE_SYNC_INTERVAL=120
```

> **Note:** `OPENCLAW_DEFAULT_ENDPOINT` must use `ws://` or `wss://` protocol. If you accidentally use `http://` or `https://`, it will be auto-corrected on first startup.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand (18 stores) |
| Database | SQLite + Drizzle ORM (33 tables) |
| Authentication | Cookie-based sessions, Argon2id password hashing |
| Realtime | WebSocket (OpenClaw Protocol v3) + SSE |
| i18n | react-i18next |

## Project Structure

```
teamclaw/
├── app/                  # Next.js pages + API routes
├── src/
│   ├── core/            # Core modules (db, gateway, mcp)
│   ├── domains/         # Domain modules (16 domains with store + api + mcp)
│   ├── features/        # Feature modules (10 features)
│   ├── shared/          # Shared modules (lib, components, hooks, ui, layout, editor)
│   └── server/          # Server modules
├── db/                   # SQLite schema + connection (symlink to src/core/db)
├── skills/               # AI Skill documents & templates
├── docs/                 # Project documentation
└── scripts/              # Deployment & utility scripts
```

## Documentation

### User Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/product/USER_GUIDE.md) | Complete feature guide & usage instructions |
| [PRD](docs/product/PRD.md) | Product requirements document |
| [UI Design Spec](docs/product/UI_DESIGN_SPEC.md) | UI/UX design specifications |

### Technical Documentation

| Document | Description |
|----------|-------------|
| [Developer Guide](docs/technical/DEVELOPMENT.md) | Architecture, modules, development guide |
| [API Reference](docs/technical/API.md) | REST API documentation |
| [Components](docs/technical/COMPONENTS.md) | UI component library reference |
| [Architecture Optimization](docs/technical/ARCHITECTURE_OPTIMIZATION.md) | System architecture design |
| [Multi-User Access Control](docs/technical/MULTI_USER_ACCESS_CONTROL.md) | Authentication & authorization design |
| [Approval System Design](docs/technical/APPROVAL_SYSTEM_DESIGN.md) | Universal approval workflow |
| [OpenClaw Sync Design](docs/technical/OPENCLAW_SYNC_DESIGN.md) | Bi-directional Markdown sync |

### OpenClaw Integration

| Document | Description |
|----------|-------------|
| [Workspace Standard](docs/openclaw/WORKSPACE_STANDARD.md) | OpenClaw workspace standards |
| [Claude Integration](docs/openclaw/CLAUDE.md) | Claude Code integration guide |

### Process & Operations

| Document | Description |
|----------|-------------|
| [Changelog](docs/process/CHANGELOG.md) | Version history |
| [Requirements](docs/process/REQUIREMENTS.md) | Feature requirements tracking |
| [Tech Debt](docs/process/TECH_DEBT.md) | Known technical debt items |

### Blog & Announcements

| Document | Description |
|----------|-------------|
| [v3.0 Release Notes](docs/blog/v3-0-release.md) | Version 3.0 release announcement |


## Deployment Troubleshooting

### Common Issues

#### 1. argon2 Native Module Error

**Error:**
```
⨯ Error: No native build was found for platform=linux arch=x64 runtime=node abi=127
```

**Solution:**
The deploy script (`scripts/deploy.sh`) automatically handles this. If you encounter this error manually:

```bash
# On server, copy argon2 modules
mkdir -p /root/teamclaw/.next/standalone/node_modules/@node-rs
cp -r /root/teamclaw/node_modules/argon2 /root/teamclaw/.next/standalone/node_modules/
cp -r /root/teamclaw/node_modules/@node-rs /root/teamclaw/.next/standalone/node_modules/
```

#### 2. Initialization Page Not Working

**Symptom:** Homepage doesn't redirect to `/init` even with no users in database.

**Solution:**
Edit `/app/api/init/route.ts` to remove the `ENABLE_INITIALIZATION` environment variable check, or set the environment variable:

```bash
# Add to server's .env or .env.local
ENABLE_INITIALIZATION=true
```

Then restart the service:
```bash
pm2 restart teamclaw
```

## License

MIT
