# ClawHub Security Review Appeal — TeamClaw Skill

## About TeamClaw

**TeamClaw is an open-source, self-hosted human-AI collaboration platform** ([GitHub](https://github.com/dqalex/teamclaw)) that treats AI agents as **equal team members** alongside humans. Instead of treating AI as a tool to be invoked on-demand, TeamClaw creates a shared workspace where human and AI members collaborate through a unified task board, document system, and real-time status dashboard — just like a real team using project management software.

### Deployment Model

TeamClaw is designed to run on the **same machine** as the OpenClaw Gateway. A typical deployment looks like:

```
┌─────────────────────────────────────────┐
│           Single Server / VPS           │
│                                         │
│  ┌─────────────┐   ┌────────────────┐   │
│  │  OpenClaw    │   │    TeamClaw      │   │
│  │  Gateway     │◄──│  (Next.js)     │   │
│  │  :18789 ws   │   │  :3000 http    │   │
│  └─────────────┘   └───────┬────────┘   │
│                             │            │
│                    ┌────────▼────────┐   │
│                    │   SQLite DB     │   │
│                    │  data/teamclaw.db │   │
│                    └─────────────────┘   │
└─────────────────────────────────────────┘
```

- **100% self-hosted**: No cloud dependencies, no SaaS calls, no telemetry. Users deploy TeamClaw on their own infrastructure.
- **Local SQLite database**: All data (tasks, documents, members, projects) is stored in a single `data/teamclaw.db` file on the same machine. **No data leaves the server.**
- **Localhost communication**: The TeamClaw Skill's API calls (`POST /api/mcp/external`) target `localhost:3000` or the user's own server — traffic never routes through third-party services.
- **User-generated token**: `TEAMCLAW_API_TOKEN` is created by the user in their own TeamClaw Settings page, stored in their own database, and never shared with any external service.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Unified Team** | Human members and AI agents co-exist in the same team with shared visibility — every member has a profile, assigned tasks, and status |
| **Bidirectional Task Sync** | Tasks flow both ways: humans assign tasks to AI via the dashboard, AI reports progress back through heartbeats and MCP API |
| **Document Collaboration** | AI members produce deliverables (reports, analyses, daily summaries) that appear directly in TeamClaw's document center for human review |
| **Real-time Status** | A live dashboard shows what every team member — human or AI — is currently working on, their progress, and blockers |
| **Heartbeat System** | AI members periodically check in: syncing task progress, generating daily reports, and updating their workspace status |
| **Markdown-based Protocol** | Workspace files (`tasks/TODO.md`, `.teamclaw-index`) serve as the bridge between the AI's local environment and TeamClaw's centralized platform |

**The TeamClaw Skill is the essential connector** that enables an AI agent to function as a team member within this platform. Without it, the agent is just an isolated code assistant with no team awareness.

---

## 1. Instruction Scope (ℹ) — Local Workspace File Access

The skill reads local workspace files and scans directories for change detection. This is **the fundamental mechanism** by which an AI team member stays connected to TeamClaw.

### Each file serves a specific role in the collaboration protocol

| File | Purpose | Why it must be read |
|------|---------|---------------------|
| `.teamclaw-index` | Sync state metadata | Tracks which files have been synced, enabling incremental updates. Without it, every heartbeat would re-upload all files — wasteful and noisy for human reviewers |
| `tasks/TODO.md` | Bidirectional task board | The canonical workspace task file. Reading it lets the AI report task progress back to the team dashboard. **This is the core of human-AI task collaboration** |
| `CLAUDE.md` | Project context | Provides project-specific instructions so the AI member understands team conventions. Standard OpenClaw practice |
| Directory scan (mtime/hash) | Change detection | Only uploads files that actually changed, minimizing API calls and keeping the team's document feed clean |

### Scope constraints

- All local file access is **read-only** — the skill never writes to the local filesystem
- Write operations go exclusively through the authenticated TeamClaw API
- File access is limited to the **current workspace directory** — no access outside the workspace boundary

**Removing file access would break the core value proposition**: the AI member would have no way to sync its workspace state to TeamClaw, making it invisible to the team and defeating the purpose of the entire platform.

---

## 2. Credentials (ℹ) — TEAMCLAW_API_TOKEN Scope

The `TEAMCLAW_API_TOKEN` is a Bearer credential that enables the AI member to **report back to the team**. Critically, this token operates entirely within the user's own infrastructure:

- **Self-issued**: The token is generated by the user in their own TeamClaw Settings page and stored in their own local SQLite database. No third party is involved in token issuance or validation.
- **Localhost-scoped**: In the typical deployment, `TEAMCLAW_BASE_URL` points to `localhost:3000` or the user's own server. API calls never leave the machine or the user's private network.
- **Single endpoint**: Only used for `POST /api/mcp/external` — the MCP external handler on the user's own TeamClaw instance.
- **Team-scoped actions**: Document delivery, task status updates, progress reports, heartbeat check-ins — all operations an AI team member needs to communicate with the team.
- **No external network access**: The token cannot be used against any external service. It is validated solely by the user's own TeamClaw server process.
- **User-controlled lifecycle**: Rotatable and revocable at any time through the TeamClaw Settings UI. Since the user owns both the token and the server, they have full control over its lifecycle.

The token is the AI member's "team badge" — it proves membership and authorizes team communications, all within a self-hosted, user-controlled environment.

---

## 3. Persistence & Privilege (!) — `always: true`

`always: true` is a deliberate design choice rooted in TeamClaw's core vision: **AI agents are always-on team members, not on-demand tools.**

### Why always-on is required

1. **Team members don't clock in and out**: In TeamClaw's model, an AI member is part of the team at all times. Requiring manual activation per session is like requiring a human employee to re-badge into the project management system before every task — it breaks the seamless collaboration experience.

2. **Heartbeat is continuous**: The skill implements three periodic heartbeat tasks (progress check, daily report, status sync). These are the AI member's way of "being present" in the team. If the skill only loads on demand, heartbeats stop, the dashboard goes dark, and human team members lose visibility into AI progress.

3. **Pushed tasks require context**: When a human assigns a task to the AI via TeamClaw's dashboard, the task is pushed with TeamClaw-specific formatting and MCP protocol context. The AI needs the skill already loaded to understand and execute the assignment. Loading it after the push arrives is too late.

4. **Identity continuity**: The skill defines the AI's role, communication protocols, and team conventions. Without persistent loading, the AI loses its "team member identity" at the start of every session and must be re-contextualized — degrading both reliability and user trust.

### Why the blast radius is minimal despite `always: true`

| Concern | Mitigation |
|---------|------------|
| Data exfiltration | Impossible. All API calls target the user's own localhost/server. No outbound connections to third-party services. Data stays in the user's local SQLite database |
| System/shell access | Not requested. The skill contains no shell commands or OS-level operations |
| Local file writes | None. All local access is read-only |
| Network surface | Single self-hosted TeamClaw endpoint only (typically `localhost:3000`). No external service communication |
| Token compromise | Attacker would need access to the user's own server to exploit it. The token only works against the user's own TeamClaw instance. No lateral movement possible |
| Install mechanism | None. No remote downloads, no archive extraction, no post-install scripts. Purely instruction-based with one local-only helper script |

**In summary**: The combination of `always: true` + Bearer token + file access sounds privileged in the abstract, but in TeamClaw's actual deployment context, all three operate within a **single user-owned machine**:
- Files are read from the user's own workspace
- API calls go to the user's own `localhost`
- Tokens are issued and validated by the user's own database

The "blast radius" is confined to infrastructure the user already fully controls.

---

## Recommendation to ClawHub

We suggest the security model incorporate deployment context into risk assessment. A self-hosted, open-source project where all communication is localhost-scoped and all data resides in a local SQLite database presents a fundamentally different threat model from a skill that communicates with external cloud APIs. The `always: true` setting, combined with this self-contained architecture, results in a minimal effective privilege surface.

We also recommend distinguishing between "always-on with system/shell privileges" (high risk) and "always-on with scoped read-only local + single-endpoint API access on user-owned infrastructure" (low risk). This skill falls firmly in the latter category.
