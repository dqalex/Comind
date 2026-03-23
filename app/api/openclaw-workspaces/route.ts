import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { openclawWorkspaces } from '@/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { refreshIndex, startHeartbeat } from '@/lib/openclaw/index-manager';
import { refreshClaudeMd } from '@/lib/openclaw/claude-md-generator';
import { withAuth, withAdminAuth } from '@/lib/with-auth';

/**
 * GET /api/openclaw-workspaces
 * 获取所有 workspace 列表
 * v0.9.8: 需要登录才能访问（只读）
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const memberId = searchParams.get('member_id');

    let workspaces;
    if (memberId) {
      workspaces = await db.select()
        .from(openclawWorkspaces)
        .where(eq(openclawWorkspaces.memberId, memberId));
    } else {
      workspaces = await db.select().from(openclawWorkspaces);
    }

    // 直接返回数组，与其他 API 保持一致（apiRequest 会自动包装为 { data: ... }）
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('[API] GET /openclaw-workspaces error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
});

/**
 * POST /api/openclaw-workspaces
 * 创建新的 workspace
 * v0.9.8: Admin Only - 只有管理员可以创建 Workspace
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name,
      path: workspacePath,
      memberId,
      isDefault = false,
      syncEnabled = true,
      watchEnabled = true,
      syncInterval = 120,
      excludePatterns = ['node_modules/**', '.git/**', 'temp/**'],
    } = body;

    if (!name || !workspacePath) {
      return NextResponse.json(
        { error: 'name and path are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const newWorkspace = {
      id: generateId(),
      name,
      path: workspacePath,
      memberId: memberId || null,
      isDefault,
      syncEnabled,
      watchEnabled,
      syncInterval,
      excludePatterns,
      syncStatus: 'idle' as const,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(openclawWorkspaces).values(newWorkspace);

    // 在 workspace 目录下生成心跳模板文件和 HEARTBEAT.md
    try {
      await generateHeartbeatFiles(workspacePath);
    } catch (err) {
      // 文件生成失败不阻塞 workspace 创建
      console.warn('[API] Failed to generate heartbeat files:', err);
    }

    // 初始化 .teamclaw-index 索引文件 + CLAUDE.md 动态数据
    try {
      await refreshIndex(newWorkspace.id);
      await refreshClaudeMd(newWorkspace.id);
      // 如果启用了同步，启动心跳定时器
      if (syncEnabled) {
        startHeartbeat(newWorkspace.id);
      }
    } catch (err) {
      console.warn('[API] Failed to initialize index/claude.md:', err);
    }

    // 直接返回对象，与其他 API 保持一致（apiRequest 会自动包装）
    return NextResponse.json(newWorkspace, { status: 201 });
  } catch (error) {
    console.error('[API] POST /openclaw-workspaces error:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
});

// HEARTBEAT.md 中 TeamClaw 自动管理段的标记
const TEAMCLAW_HEARTBEAT_START = '<!-- TEAMCLAW_HEARTBEAT_START -->';
const TEAMCLAW_HEARTBEAT_END = '<!-- TEAMCLAW_HEARTBEAT_END -->';

/**
 * 在 workspace 目录下生成心跳任务模板文件和 HEARTBEAT.md
 * - tasks/heartbeat-check-progress.md
 * - tasks/heartbeat-daily-report.md
 * - tasks/heartbeat-sync-to-teamclaw.md
 * - HEARTBEAT.md（幂等更新：用标记段保护 TeamClaw 内容，不影响用户自定义部分）
 */
async function generateHeartbeatFiles(workspacePath: string) {
  // 展开 ~ 为用户 home 目录
  const resolvedPath = workspacePath.startsWith('~')
    ? join(process.env.HOME || '/root', workspacePath.slice(1))
    : resolve(workspacePath);

  // 确保 tasks 目录存在
  const tasksDir = join(resolvedPath, 'tasks');
  await mkdir(tasksDir, { recursive: true });

  // 心跳模板文件内容（精简版，完整版参见 skills/teamclaw/references/）
  const templates: Record<string, string> = {
    'heartbeat-check-progress.md': `---
title: 心跳巡检：任务进展
trigger: heartbeat
priority: high
---

# 任务进展巡检

每次心跳轮换执行，检查分配给自己的任务进展。

## 触发方式

通过 OpenClaw Cron Job 定时发送消息到 agent:main 会话触发执行。

## 可用上下文文件（优先级从高到低）

- \`tasks/TODO.md\` — **首选数据源**：我的任务清单（待处理 + 进行中），含 ID/进度/截止日期
- \`.teamclaw-index\` — 文件索引（路径→ID/hash/version 映射），对比 hash 检测变更
- \`CLAUDE.md\` — 动态数据段（项目列表、成员列表、任务统计）

## 步骤

1. 读取 \`tasks/TODO.md\` 获取任务列表（首选），仅当文件缺失时回退到 MCP API \`list_my_tasks\`
2. 按优先级分类：
   - 🔴 我的重点任务（分配给我 + in_progress/todo）
   - 🟡 超期任务（deadline 已过）
   - 🟢 正常推进（in_progress 且未超期）
3. 读取 \`.teamclaw-index\` 的 files 段，对比本地文件 hash 检测 workspace 变更
4. 检查卡住的任务（in_progress 超 24h 无更新）
5. 通过 \`update_status\` + \`set_queue\` 输出巡检报告
6. 无异常则回复 HEARTBEAT_OK
`,
    'heartbeat-daily-report.md': `---
title: 心跳任务：日报生成
trigger: heartbeat
priority: medium
schedule_hint: 每天 17:00-23:59 执行
---

# 每日工作总结

仅在 17:00-23:59 时段执行，其他时间回复 HEARTBEAT_OK 跳过。

## 触发方式

通过 OpenClaw Cron Job 每日定时（建议 18:00 或 23:00）发送消息到 agent:main 会话触发。

## 可用上下文文件（优先级从高到低）

- \`tasks/TODO.md\` — 活跃任务列表（待处理 + 进行中）
- \`tasks/DONE.md\` — 近 24h 已完成任务列表
- \`CLAUDE.md\` — 动态数据段读取项目名（8.1 节）和成员名（8.2 节），填入 Front Matter
- \`.teamclaw-index\` — 文件→ID 映射，交付文档时获取 document_id

## 步骤

1. 读取 \`tasks/TODO.md\` + \`tasks/DONE.md\` 获取全部任务数据（无需 MCP API）
2. 读取 \`CLAUDE.md\` 动态段获取项目/成员上下文
3. 筛选：今日完成（DONE.md）/ 今日推进 / 新接收 / 明日待办（TODO.md）
4. 调用 \`search_documents\` 查找已有日报（避免重复创建）
5. 通过 \`create_document\` 生成日报文档（type: report）
6. 对话中发送简要总结
`,
    'heartbeat-sync-to-teamclaw.md': `---
title: 心跳任务：状态同步
trigger: heartbeat
priority: low
schedule_hint: 每 5-10 分钟
---

# 状态同步到 TeamClaw

最轻量的心跳任务，同步 Agent 状态到 TeamClaw 面板。

## 触发方式

通过 OpenClaw Cron Job（建议每 5-10 分钟）发送消息到 agent:main 会话触发。

## 可用上下文文件（优先级从高到低）

- \`tasks/TODO.md\` — **首选数据源**：我的任务清单，含任务 ID 可直接用于 \`update_status\`
- \`.teamclaw-index\` — 文件索引（路径→ID/hash/version），检测变更时从此获取 document_id
- \`CLAUDE.md\` — 项目/成员/任务统计

## 步骤

1. 评估当前状态（working / idle / waiting）
2. 读取 \`tasks/TODO.md\` 获取任务快照（首选），仅当文件缺失时回退到 MCP API \`list_my_tasks\`
3. 通过 \`update_status\` + \`set_queue\` 同步状态面板
4. 读取 \`.teamclaw-index\` 的 files 段对比本地文件 hash 检测变更
5. 有变更时从 \`.teamclaw-index\` 获取 document_id，调用 \`update_document\` 同步
6. 无异常则回复 HEARTBEAT_OK

默认静默执行，仅异常时汇报。
`,
  };

  // 写入模板文件（不覆盖已有文件）
  for (const [filename, content] of Object.entries(templates)) {
    const filePath = join(tasksDir, filename);
    if (!existsSync(filePath)) {
      await writeFile(filePath, content, 'utf-8');
    }
  }

  // TeamClaw 自动管理的标记段内容（每次更新时会被替换，用户自定义内容不受影响）
  const heartbeatSection = `${TEAMCLAW_HEARTBEAT_START}
## TeamClaw 自动维护文件

以下文件由 TeamClaw 自动生成和维护，心跳任务可直接读取：

| 文件 | 用途 | 刷新频率 |
|------|------|----------|
| \`tasks/TODO.md\` | 我的任务清单（待处理 + 进行中） | 心跳间隔（120s），有变更时写入 |
| \`tasks/DONE.md\` | 近 24h 已完成任务 | 心跳间隔（120s），有变更时写入 |
| \`.teamclaw-index\` | 文件索引（路径→ID/hash/version）、心跳状态 | 心跳间隔（120s） |
| \`CLAUDE.md\` | 协作规范 + 动态数据段（项目/成员/任务统计） | 每次同步后 |

## 定期检查（每次心跳轮换 1-2 项）

- 任务进展：读取 tasks/heartbeat-check-progress.md 执行巡检
- 日报生成：读取 tasks/heartbeat-daily-report.md 生成总结（仅 17:00-23:59）
- 状态同步：读取 tasks/heartbeat-sync-to-teamclaw.md 同步数据

---
保持精简。每项检查都消耗 token。
${TEAMCLAW_HEARTBEAT_END}`;

  // 幂等更新 HEARTBEAT.md
  const heartbeatPath = join(resolvedPath, 'HEARTBEAT.md');

  if (existsSync(heartbeatPath)) {
    const existing = await readFile(heartbeatPath, 'utf-8');

    if (existing.includes(TEAMCLAW_HEARTBEAT_START) && existing.includes(TEAMCLAW_HEARTBEAT_END)) {
      // 已有标记段 → 替换标记段内容，保留用户自定义部分
      const startIdx = existing.indexOf(TEAMCLAW_HEARTBEAT_START);
      const endIdx = existing.indexOf(TEAMCLAW_HEARTBEAT_END) + TEAMCLAW_HEARTBEAT_END.length;
      const updated = existing.slice(0, startIdx) + heartbeatSection + existing.slice(endIdx);
      await writeFile(heartbeatPath, updated, 'utf-8');
    } else {
      // 已有文件但无标记段 → 在末尾追加标记段
      const updated = existing.trimEnd() + '\n\n' + heartbeatSection + '\n';
      await writeFile(heartbeatPath, updated, 'utf-8');
    }
  } else {
    // 新文件 → 创建完整内容
    const content = `# HEARTBEAT.md - 心跳清单

${heartbeatSection}

## 提醒/待办

（在这里添加具体的提醒事项）
`;
    await writeFile(heartbeatPath, content, 'utf-8');
  }
}
