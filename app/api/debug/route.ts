/**
 * 系统诊断 API
 * 
 * GET  - 获取诊断信息
 * POST - 修复缺失的数据库表
 * 
 * 需要管理员权限
 */

import { NextResponse, NextRequest } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { sqlite } from '@/db';
import { withAuth } from '@/lib/with-auth';
import type { AuthResult } from '@/lib/api-auth';
import { validateTableName, validateColumnName, safeTableInfo, safeCount } from '@/lib/sql-validator';

// 所有关键表的建表 SQL（与 db/index.ts 保持一致）
const TABLE_DEFINITIONS: Record<string, string> = {
  gateway_configs: `
    CREATE TABLE IF NOT EXISTS gateway_configs (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL DEFAULT 'default',
      url TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'server_proxy',
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_connected_at INTEGER,
      last_error TEXT,
      reconnect_attempts INTEGER DEFAULT 0,
      last_heartbeat INTEGER,
      is_default INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gateway_configs_name ON gateway_configs(name);
    CREATE INDEX IF NOT EXISTS idx_gateway_configs_status ON gateway_configs(status);
  `,
  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      member_id TEXT,
      agent_id TEXT,
      gateway_url TEXT,
      api_token_hash TEXT,
      action TEXT NOT NULL,
      params TEXT,
      success INTEGER NOT NULL,
      result TEXT,
      error TEXT,
      session_key TEXT,
      request_id TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_source ON audit_logs(source);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_member_id ON audit_logs(member_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_api_token_hash ON audit_logs(api_token_hash);
  `,
  members: `
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'human',
      email TEXT,
      avatar TEXT,
      online INTEGER DEFAULT 0,
      openclaw_name TEXT,
      openclaw_deploy_mode TEXT,
      openclaw_endpoint TEXT,
      openclaw_connection_status TEXT,
      openclaw_last_heartbeat INTEGER,
      openclaw_gateway_url TEXT,
      openclaw_agent_id TEXT,
      openclaw_api_token TEXT,
      openclaw_model TEXT,
      openclaw_enable_web_search INTEGER DEFAULT 0,
      openclaw_temperature REAL,
      config_source TEXT DEFAULT 'manual',
      execution_mode TEXT DEFAULT 'chat_only',
      experience_task_count INTEGER DEFAULT 0,
      experience_task_types TEXT,
      experience_tools TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
    CREATE INDEX IF NOT EXISTS idx_members_type ON members(type);
    CREATE INDEX IF NOT EXISTS idx_members_openclaw_endpoint ON members(openclaw_endpoint);
  `,
  projects: `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT REFERENCES projects(id),
      milestone_id TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      assignees TEXT NOT NULL DEFAULT '[]',
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      progress INTEGER DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      deadline INTEGER,
      check_items TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      parent_task_id TEXT,
      cross_projects TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
  `,
  documents: `
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      project_id TEXT REFERENCES projects(id),
      project_tags TEXT DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'local',
      external_platform TEXT,
      external_id TEXT,
      external_url TEXT,
      mcp_server TEXT,
      last_sync INTEGER,
      sync_mode TEXT,
      links TEXT DEFAULT '[]',
      backlinks TEXT DEFAULT '[]',
      type TEXT NOT NULL DEFAULT 'note',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
    CREATE INDEX IF NOT EXISTS idx_documents_project_tags ON documents(project_tags);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
  `,
  milestones: `
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'open',
      due_date INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
  `,
  task_logs: `
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
  `,
  task_comments: `
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      member_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
  `,
  openclaw_status: `
    CREATE TABLE IF NOT EXISTS openclaw_status (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'offline',
      current_task_id TEXT REFERENCES tasks(id),
      current_task_title TEXT,
      current_action TEXT,
      progress INTEGER DEFAULT 0,
      started_at INTEGER,
      estimated_end_at INTEGER,
      next_task_id TEXT REFERENCES tasks(id),
      next_task_title TEXT,
      queued_tasks TEXT DEFAULT '[]',
      interruptible INTEGER DEFAULT 1,
      do_not_disturb_reason TEXT,
      last_heartbeat INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_openclaw_status_member_id ON openclaw_status(member_id);
  `,
  scheduled_tasks: `
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_time TEXT,
      schedule_days TEXT,
      next_run_at INTEGER,
      config TEXT,
      enabled INTEGER DEFAULT 1,
      last_run_at INTEGER,
      last_run_status TEXT,
      last_run_result TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_member_id ON scheduled_tasks(member_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
  `,
  scheduled_task_history: `
    CREATE TABLE IF NOT EXISTS scheduled_task_history (
      id TEXT PRIMARY KEY NOT NULL,
      scheduled_task_id TEXT NOT NULL REFERENCES scheduled_tasks(id),
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      deliverable_type TEXT,
      deliverable_url TEXT,
      deliverable_title TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_task_history_task_id ON scheduled_task_history(scheduled_task_id);
  `,
  deliveries: `
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      task_id TEXT REFERENCES tasks(id),
      document_id TEXT REFERENCES documents(id),
      title TEXT NOT NULL,
      description TEXT,
      platform TEXT NOT NULL,
      external_url TEXT,
      external_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT REFERENCES members(id),
      reviewed_at INTEGER,
      review_comment TEXT,
      version INTEGER DEFAULT 1,
      previous_delivery_id TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deliveries_member_id ON deliveries(member_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON deliveries(task_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_document_id ON deliveries(document_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_reviewer_id ON deliveries(reviewer_id);
  `,
  chat_sessions: `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      conversation_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      entity_title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_member_id ON chat_sessions(member_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_entity ON chat_sessions(entity_type, entity_id);
  `,
  chat_messages: `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
  `,
  openclaw_workspaces: `
    CREATE TABLE IF NOT EXISTS openclaw_workspaces (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT REFERENCES members(id),
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      sync_enabled INTEGER DEFAULT 1,
      watch_enabled INTEGER DEFAULT 1,
      sync_interval INTEGER DEFAULT 120,
      exclude_patterns TEXT DEFAULT '["node_modules/**", ".git/**", "temp/**"]',
      last_sync_at INTEGER,
      sync_status TEXT DEFAULT 'idle',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_openclaw_workspaces_member_id ON openclaw_workspaces(member_id);
  `,
  openclaw_files: `
    CREATE TABLE IF NOT EXISTS openclaw_files (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES openclaw_workspaces(id),
      document_id TEXT REFERENCES documents(id),
      relative_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      hash TEXT NOT NULL,
      content_hash TEXT,
      version INTEGER DEFAULT 1,
      base_hash TEXT,
      title TEXT,
      category TEXT,
      tags TEXT,
      related_task_id TEXT,
      related_project TEXT,
      opportunity_score INTEGER,
      confidence TEXT,
      doc_status TEXT,
      sync_status TEXT DEFAULT 'synced',
      sync_direction TEXT,
      file_modified_at INTEGER,
      synced_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_workspace_id ON openclaw_files(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_document_id ON openclaw_files(document_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_sync_status ON openclaw_files(sync_status);
  `,
  openclaw_versions: `
    CREATE TABLE IF NOT EXISTS openclaw_versions (
      id TEXT PRIMARY KEY NOT NULL,
      file_id TEXT NOT NULL REFERENCES openclaw_files(id),
      version INTEGER NOT NULL,
      hash TEXT NOT NULL,
      storage_type TEXT DEFAULT 'full',
      content TEXT,
      diff_patch TEXT,
      change_summary TEXT,
      changed_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_openclaw_versions_file_id ON openclaw_versions(file_id);
  `,
  openclaw_conflicts: `
    CREATE TABLE IF NOT EXISTS openclaw_conflicts (
      id TEXT PRIMARY KEY NOT NULL,
      file_id TEXT NOT NULL REFERENCES openclaw_files(id),
      local_version INTEGER NOT NULL,
      remote_version INTEGER NOT NULL,
      local_hash TEXT NOT NULL,
      remote_hash TEXT NOT NULL,
      local_content TEXT NOT NULL,
      remote_content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      resolution TEXT,
      merged_content TEXT,
      detected_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_file_id ON openclaw_conflicts(file_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_status ON openclaw_conflicts(status);
  `,
};

// 各表应有的列定义（用于检测缺失列并修复）
const TABLE_COLUMNS: Record<string, [string, string][]> = {
  documents: [
    ['project_tags', "TEXT DEFAULT '[]'"],
    ['links', "TEXT DEFAULT '[]'"],
    ['backlinks', "TEXT DEFAULT '[]'"],
    ['type', "TEXT NOT NULL DEFAULT 'note'"],
    ['external_platform', 'TEXT'],
    ['external_id', 'TEXT'],
    ['external_url', 'TEXT'],
    ['mcp_server', 'TEXT'],
    ['last_sync', 'INTEGER'],
    ['sync_mode', 'TEXT'],
  ],
  deliveries: [
    ['member_id', 'TEXT REFERENCES members(id)'],
    ['source', "TEXT NOT NULL DEFAULT 'local'"],
    ['document_id', 'TEXT REFERENCES documents(id)'],
    ['reviewer_id', 'TEXT REFERENCES members(id)'],
    ['reviewed_at', 'INTEGER'],
    ['review_comment', 'TEXT'],
    ['version', 'INTEGER DEFAULT 1'],
    ['previous_delivery_id', 'TEXT'],
    ['external_id', 'TEXT'],
  ],
  members: [
    ['config_source', "TEXT DEFAULT 'manual'"],
    ['execution_mode', "TEXT DEFAULT 'chat_only'"],
    ['experience_task_count', 'INTEGER DEFAULT 0'],
    ['experience_task_types', 'TEXT'],
    ['experience_tools', 'TEXT'],
    ['openclaw_gateway_url', 'TEXT'],
    ['openclaw_agent_id', 'TEXT'],
    ['openclaw_model', 'TEXT'],
    ['openclaw_enable_web_search', 'INTEGER DEFAULT 0'],
    ['openclaw_temperature', 'REAL'],
  ],
  tasks: [
    ['check_items', "TEXT DEFAULT '[]'"],
    ['attachments', "TEXT DEFAULT '[]'"],
    ['parent_task_id', 'TEXT'],
    ['cross_projects', "TEXT DEFAULT '[]'"],
    ['milestone_id', 'TEXT'],
    ['source', "TEXT NOT NULL DEFAULT 'local'"],
  ],
  projects: [
    ['source', "TEXT NOT NULL DEFAULT 'local'"],
  ],
};

export const GET = withAuth(async (_request: NextRequest, _auth: AuthResult) => {
  try {
    const diagnostics: Record<string, any> = {};

    // 1. 数据库健康检查
    try {
      const tables = sqlite.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `).all() as { name: string }[];
      diagnostics.database = {
        status: 'ok',
        tables: tables.map(r => r.name),
        tableCount: tables.length,
      };
    } catch (e) {
      diagnostics.database = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // 2. 关键表结构检查
    const criticalTables = Object.keys(TABLE_DEFINITIONS);

    diagnostics.tableStructure = {};
    for (const tableName of criticalTables) {
      try {
        // 使用白名单验证表名防止 SQL 注入
        const columns = safeTableInfo(sqlite, tableName);
        const columnNames = columns.map(r => r.name);
        diagnostics.tableStructure[tableName] = {
          exists: columnNames.length > 0,
          columns: columnNames,
        };
      } catch (e) {
        diagnostics.tableStructure[tableName] = {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    }

    // 3. 缺失表统计
    const missingTables = criticalTables.filter(t => {
      const info = diagnostics.tableStructure[t];
      return !info?.exists;
    });
    diagnostics.missingTables = missingTables;

    // 3.1 缺失列检测
    const missingColumns: Record<string, string[]> = {};
      for (const [tableName, expectedCols] of Object.entries(TABLE_COLUMNS)) {
        // 使用白名单验证表名
        try {
          validateTableName(tableName);
        } catch {
          continue; // 跳过不合法的表名
        }
        
        const tableInfo = diagnostics.tableStructure[tableName];
        if (tableInfo?.exists && tableInfo.columns) {
          const existingCols = new Set(tableInfo.columns as string[]);
          const missing = expectedCols
            .filter(([col]) => !existingCols.has(col))
            .map(([col]) => col);
          if (missing.length > 0) {
            missingColumns[tableName] = missing;
          }
        }
      }
    diagnostics.missingColumns = missingColumns;
    diagnostics.hasMissingColumns = Object.keys(missingColumns).length > 0;

    // 4. Gateway 配置检查
    try {
      const gatewayConfig = sqlite.prepare(`
        SELECT id, name, url, mode, status, is_default, created_at 
        FROM gateway_configs
      `).all() as any[];
      diagnostics.gateway = {
        configCount: gatewayConfig.length,
        configs: gatewayConfig.map(r => ({
          ...r,
          hasToken: true,
        })),
      };
    } catch (e) {
      diagnostics.gateway = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // 5. 环境变量检查（隐藏敏感值）
    const envVars = [
      'NODE_ENV',
      'NEXT_PUBLIC_BASE_URL',
      'NEXT_PUBLIC_GATEWAY_URL',
      'OPENCLAW_DEFAULT_ENDPOINT',
      'OPENCLAW_TOKEN',
      'GATEWAY_MODE',
      'OPENCLAW_WORKSPACE_PATH',
      'OPENCLAW_WORKSPACE_NAME',
      'OPENCLAW_WORKSPACE_SYNC_INTERVAL',
      'TOKEN_ENCRYPTION_KEY',
      'TEAMCLAW_API_TOKEN',
    ];

    diagnostics.environment = {};
    for (const key of envVars) {
      const value = process.env[key];
      if (value) {
        const sensitiveKeys = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD'];
        const isSensitive = sensitiveKeys.some(s => key.toUpperCase().includes(s));
        diagnostics.environment[key] = isSensitive ? '****** (已设置)' : value;
      } else {
        diagnostics.environment[key] = '(未设置)';
      }
    }

    // 6. 成员检查
    try {
      const members = sqlite.prepare(`
        SELECT id, name, type, online, created_at FROM members
      `).all() as any[];
      diagnostics.members = {
        count: members.length,
        list: members,
      };
    } catch (e) {
      diagnostics.members = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // 7. 工作区检查
    try {
      const workspaces = sqlite.prepare(`
        SELECT id, name, path, sync_status, is_default FROM openclaw_workspaces
      `).all() as any[];
      diagnostics.workspaces = {
        count: workspaces.length,
        list: workspaces,
      };
    } catch (e) {
      diagnostics.workspaces = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // 8. 运行时信息
    diagnostics.runtime = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      status: 'ok',
      diagnostics,
    });
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      error: e instanceof Error ? e.message : 'Unknown error',
    }, { status: 500 });
  }
}, { requireAdmin: true });

/**
 * POST /api/debug - 修复缺失的数据库表
 * 需要管理员权限
 * 
 * Body: { action: 'repair_tables' }
 * 或: { action: 'repair_tables', tables: ['gateway_configs', 'audit_logs'] }
 * 或: { action: 'seed_default_member' }
 */
export const POST = withAuth(async (request: NextRequest, _auth: AuthResult) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'repair_tables') {
      // 获取当前已有的表
      const existingTables = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as { name: string }[];
      const existingTableNames = new Set(existingTables.map(t => t.name));

      // 确定要修复的表
      const targetTables: string[] = body.tables && Array.isArray(body.tables)
        ? body.tables.filter((t: string) => TABLE_DEFINITIONS[t] && !existingTableNames.has(t))
        : Object.keys(TABLE_DEFINITIONS).filter(t => !existingTableNames.has(t));

      if (targetTables.length === 0) {
        return NextResponse.json({
          status: 'ok',
          message: '所有表已存在，无需修复',
          created: [],
          failed: [],
        });
      }

      const created: string[] = [];
      const failed: { table: string; error: string }[] = [];

      for (const tableName of targetTables) {
        try {
          sqlite.exec(TABLE_DEFINITIONS[tableName]);
          created.push(tableName);
          console.log(`[Debug] Created missing table: ${tableName}`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          failed.push({ table: tableName, error: errMsg });
          console.error(`[Debug] Failed to create table ${tableName}:`, e);
        }
      }

      return NextResponse.json({
        status: failed.length === 0 ? 'ok' : 'partial',
        message: `已创建 ${created.length} 个表${failed.length > 0 ? `，${failed.length} 个失败` : ''}`,
        created,
        failed,
      });
    }

    if (action === 'repair_columns') {
      // 修复已存在表的缺失列
      const addedColumns: { table: string; column: string }[] = [];
      const failedColumns: { table: string; column: string; error: string }[] = [];

      for (const [tableName, expectedCols] of Object.entries(TABLE_COLUMNS)) {
        // 使用白名单验证表名
        try {
          validateTableName(tableName);
        } catch {
          console.error(`[Debug] Invalid table name: ${tableName}`);
          continue;
        }
        
        try {
          const cols = safeTableInfo(sqlite, tableName);
          const existingCols = new Set(cols.map(c => c.name));
          
          for (const [colName, colDef] of expectedCols) {
            // 使用白名单验证列名
            try {
              validateColumnName(tableName, colName);
            } catch {
              console.error(`[Debug] Invalid column name: ${colName}`);
              continue;
            }
            
            if (!existingCols.has(colName)) {
              try {
                sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
                addedColumns.push({ table: tableName, column: colName });
                console.log(`[Debug] Added column ${tableName}.${colName}`);
              } catch (e) {
                const errMsg = e instanceof Error ? e.message : 'Unknown error';
                failedColumns.push({ table: tableName, column: colName, error: errMsg });
                console.error(`[Debug] Failed to add column ${tableName}.${colName}:`, e);
              }
            }
          }
        } catch {
          // 表不存在，跳过
        }
      }

      return NextResponse.json({
        status: failedColumns.length === 0 ? 'ok' : 'partial',
        message: addedColumns.length === 0
          ? '所有列均已存在，无需修复'
          : `已添加 ${addedColumns.length} 个列${failedColumns.length > 0 ? `，${failedColumns.length} 个失败` : ''}`,
        added: addedColumns,
        failed: failedColumns,
      });
    }

    if (action === 'seed_default_member') {
      // v0.9.8: 已废弃，多用户系统中用户通过注册创建
      return NextResponse.json({
        status: 'deprecated',
        message: 'v3.0 多用户系统不再支持创建默认用户，请通过 /login 页面注册',
      }, { status: 400 });
    }

    if (action === 'test_query') {
      // 测试关键表的查询能力，返回详细错误
      const tablesToTest = ['deliveries', 'documents', 'task_logs', 'tasks', 'members'];
      const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};
      
      for (const table of tablesToTest) {
        // 使用白名单验证表名防止 SQL 注入
        try {
          validateTableName(table);
        } catch {
          results[table] = { ok: false, error: 'Invalid table name' };
          continue;
        }
        
        try {
          const count = safeCount(sqlite, table);
          // 也测试 SELECT * 查询（Drizzle ORM 的模式）
          sqlite.prepare(`SELECT * FROM ${table} LIMIT 1`).get();
          results[table] = { ok: true, count };
        } catch (e) {
          results[table] = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }

      // 额外：用 Drizzle ORM 测试 deliveries
      let drizzleError: string | null = null;
      try {
        // 动态导入避免顶层依赖问题
        const { db } = await import('@/db');
        const { deliveries: deliveriesTable } = await import('@/db/schema');
        const { desc } = await import('drizzle-orm');
        const result = await db.select().from(deliveriesTable).orderBy(desc(deliveriesTable.createdAt)).limit(1);
        results['deliveries_drizzle'] = { ok: true, count: result.length };
      } catch (e) {
        drizzleError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
        results['deliveries_drizzle'] = { ok: false, error: drizzleError };
      }

      return NextResponse.json({ status: 'ok', results });
    }

    return NextResponse.json({
      status: 'error',
      error: `Unknown action: ${action}, supported: repair_tables, repair_columns, seed_default_member, test_query`,
    }, { status: 400 });
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      error: e instanceof Error ? e.message : 'Unknown error',
    }, { status: 500 });
  }
}, { requireAdmin: true });
