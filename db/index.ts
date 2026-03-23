/**
 * TeamClaw 数据库模块（SQLite 默认）
 * 
 * PostgreSQL 支持状态：
 * - [x] 连接管理（db/postgres.ts）
 * - [x] 基本查询
 * - [ ] 自动建表（需要单独的迁移脚本）
 * - [ ] Schema 兼容层（需要 pgTable 版本的 schema）
 * 
 * 使用 PostgreSQL：
 * 1. 设置 DATABASE_URL=postgres://...
 * 2. 运行数据库迁移脚本（待实现）
 * 3. 重启应用
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { BUILTIN_SOP_TEMPLATES, BUILTIN_RENDER_TEMPLATES } from './templates';
import { migrateUuidToBase58 } from './migrations';
import { validateTableName, validateColumnName } from '@/lib/sql-validator';
import { logger } from '@/lib/logger';
import { encryptToken } from '@/lib/security';

/**
 * 数据库路径计算（解决 Next.js standalone 模式下的路径问题）
 * 
 * 优先级：
 * 1. 环境变量 TEAMCLAW_DB_PATH（生产环境推荐）
 * 2. process.cwd()/data/teamclaw.db（开发模式）
 * 3. 向上查找 data 目录（standalone 模式）
 */
function getDatabasePath(): string {
  // 1. 环境变量优先（生产环境推荐显式配置）
  if (process.env.TEAMCLAW_DB_PATH) {
    return process.env.TEAMCLAW_DB_PATH;
  }
  
  // 2. standalone 模式：优先使用项目根目录的 data，而非 standalone/data
  // 从 __dirname 向上查找，直到找到真正的项目根目录
  // 真正的项目根目录包含 package.json 且不是 standalone 子目录
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    // 检查是否是项目根目录：包含 package.json 且包含 data 目录
    // 排除 standalone/.next 等子目录中的 package.json
    const hasPackageJson = existsSync(join(currentDir, 'package.json'));
    const hasDataDir = existsSync(join(currentDir, 'data'));
    const isStandaloneSubdir = currentDir.includes('.next/standalone') || currentDir.includes('.next\\standalone');
    
    if (hasPackageJson && hasDataDir && !isStandaloneSubdir) {
      return join(currentDir, 'data', 'teamclaw.db');
    }
    
    // 继续向上查找
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  // 3. 回退：使用 process.cwd()/data（保持向后兼容）
  return join(process.cwd(), 'data', 'teamclaw.db');
}

/**
 * 获取初始化数据库路径
 */
function getInitDatabasePath(): string | null {
  // 检查多个可能的位置
  const possiblePaths = [
    join(process.cwd(), 'data', 'init', 'teamclaw-init.db'),
    join(dirname(DB_PATH), 'init', 'teamclaw-init.db'),
  ];
  
  // standalone 模式：向上查找
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    possiblePaths.push(join(currentDir, 'data', 'init', 'teamclaw-init.db'));
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

const DB_PATH = getDatabasePath();
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 如果数据库不存在，尝试从初始化数据库复制
if (!existsSync(DB_PATH)) {
  const initDbPath = getInitDatabasePath();
  if (initDbPath) {
    console.log(`[TeamClaw] No database found, copying init database from: ${initDbPath}`);
    copyFileSync(initDbPath, DB_PATH);
    console.log(`[TeamClaw] Init database copied to: ${DB_PATH}`);
  }
}

// 单例保护：防止 HMR 重复创建数据库连接
const globalDbKey = '__teamclaw_sqlite__' as const;
const globalDb = globalThis as unknown as Record<string, Database.Database>;

let sqlite: Database.Database;
if (globalDb[globalDbKey]) {
  sqlite = globalDb[globalDbKey];
} else {
  console.log(`[TeamClaw] Database path: ${DB_PATH}`);
  sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -64000');
  sqlite.pragma('busy_timeout = 5000');
  globalDb[globalDbKey] = sqlite;
}

// 自动建表（仅在首次连接时执行）
const globalInitKey = '__teamclaw_db_initialized__' as const;
const globalInit = globalThis as unknown as Record<string, boolean>;

if (!globalInit[globalInitKey]) {
  globalInit[globalInitKey] = true;

const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
const tableNames = tables.map(t => t.name);

if (tables.length === 0) {
  console.log('[TeamClaw] Empty database detected, initializing schema...');
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
      sop_template_id TEXT,
      current_stage_id TEXT,
      stage_history TEXT DEFAULT '[]',
      sop_inputs TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      member_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
      render_mode TEXT DEFAULT 'markdown',
      render_template_id TEXT,
      html_content TEXT,
      slot_data TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      conversation_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      entity_title TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at INTEGER NOT NULL
    );
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

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    CREATE INDEX IF NOT EXISTS idx_openclaw_status_member_id ON openclaw_status(member_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_member_id ON scheduled_tasks(member_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_task_history_task_id ON scheduled_task_history(scheduled_task_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_member_id ON deliveries(member_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON deliveries(task_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_member_id ON chat_sessions(member_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_entity ON chat_sessions(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_workspaces_member_id ON openclaw_workspaces(member_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_workspace_id ON openclaw_files(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_document_id ON openclaw_files(document_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_sync_status ON openclaw_files(sync_status);
    CREATE INDEX IF NOT EXISTS idx_openclaw_versions_file_id ON openclaw_versions(file_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_file_id ON openclaw_conflicts(file_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_status ON openclaw_conflicts(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_source ON audit_logs(source);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_member_id ON audit_logs(member_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_api_token_hash ON audit_logs(api_token_hash);
    
    -- 新增索引：优化成员名查询和文档标题查询
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
    CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
    CREATE INDEX IF NOT EXISTS idx_documents_project_tags ON documents(project_tags);
    
    -- 新增索引：优化高频查询
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_document_id ON deliveries(document_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_reviewer_id ON deliveries(reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
    CREATE INDEX IF NOT EXISTS idx_members_type ON members(type);
    CREATE INDEX IF NOT EXISTS idx_members_openclaw_endpoint ON members(openclaw_endpoint);

    -- v3.0: SOP 相关索引
    CREATE INDEX IF NOT EXISTS idx_tasks_sop_template_id ON tasks(sop_template_id);
    CREATE INDEX IF NOT EXISTS idx_documents_render_mode ON documents(render_mode);
    CREATE INDEX IF NOT EXISTS idx_documents_render_template_id ON documents(render_template_id);

    -- v3.0: SOP 模板表（与 schema.ts sopTemplates 一致）
    CREATE TABLE IF NOT EXISTS sop_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'custom',
      icon TEXT DEFAULT 'clipboard-list',
      status TEXT NOT NULL DEFAULT 'active',
      version TEXT NOT NULL DEFAULT '1.0.0',
      stages TEXT NOT NULL DEFAULT '[]',
      required_tools TEXT DEFAULT '[]',
      system_prompt TEXT DEFAULT '',
      knowledge_config TEXT,
      output_config TEXT,
      quality_checklist TEXT DEFAULT '[]',
      "references" TEXT DEFAULT '[]',
      scripts TEXT DEFAULT '[]',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      project_id TEXT REFERENCES projects(id),
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
    CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);

    -- v3.0: 渲染模板表（与 schema.ts renderTemplates 一致）
    CREATE TABLE IF NOT EXISTS render_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'active',
      html_template TEXT NOT NULL DEFAULT '',
      md_template TEXT NOT NULL DEFAULT '',
      css_template TEXT,
      slots TEXT NOT NULL DEFAULT '{}',
      sections TEXT NOT NULL DEFAULT '[]',
      export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}',
      thumbnail TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
    CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);

    -- v3.0 Phase E: 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      team_id TEXT,
      password_hash TEXT NOT NULL,
      security_code_hash TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      preferences TEXT DEFAULT '{}',
      last_login_at INTEGER,
      locked_until INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

    -- v3.0 Phase E: 用户 MCP Token 表
    CREATE TABLE IF NOT EXISTS user_mcp_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      permissions TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      last_used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_hash ON user_mcp_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_user ON user_mcp_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_status ON user_mcp_tokens(status);

    -- v3.0 Phase E: SOP 阶段执行记录表
    CREATE TABLE IF NOT EXISTS sop_stage_records (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      output_type TEXT DEFAULT 'text',
      started_at INTEGER,
      completed_at INTEGER,
      confirmed_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sop_stage_records_task ON sop_stage_records(task_id);
    CREATE INDEX IF NOT EXISTS idx_sop_stage_records_status ON sop_stage_records(status);

    -- v3.0 Phase E: 操作日志表（多维度审计）
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id),
      member_id TEXT REFERENCES members(id),
      source TEXT NOT NULL,
      source_detail TEXT,
      module TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      resource_title TEXT,
      action TEXT NOT NULL,
      action_detail TEXT,
      changes TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      project_id TEXT,
      request_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_module ON activity_logs(module, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_member ON activity_logs(member_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_source ON activity_logs(source);
    CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(module, action);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);

    -- v3.0: 项目成员表（协作权限）
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);

    -- v3.0 Phase E: 首页内容表（独立于 documents，用于公开 API）
    CREATE TABLE IF NOT EXISTS landing_pages (
      id TEXT PRIMARY KEY NOT NULL,
      locale TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      render_template_id TEXT,
      meta_title TEXT,
      meta_description TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_landing_pages_locale ON landing_pages(locale);
    CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);

    -- v3.0 Phase F: Agent MCP Token 表（对话信道自动认证）
    CREATE TABLE IF NOT EXISTS agent_mcp_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT,
      member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'auto',
      status TEXT NOT NULL DEFAULT 'active',
      last_used_at INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_hash ON agent_mcp_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_agent ON agent_mcp_tokens(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_member ON agent_mcp_tokens(member_id);
    CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_status ON agent_mcp_tokens(status);
  `);

  console.log('[TeamClaw] Schema initialized. Seeding default data...');
  
  const now = Date.now();
  // v3.0: 不再创建默认成员和默认 admin 用户
  // 用户通过 /login 页面注册，第一个注册的用户自动成为 admin
  // 成员记录在注册时自动创建并关联 userId
  console.log('[TeamClaw] No default users created. First registered user will become admin.');

  // 初始化文档：与 scripts/init-db.ts 保持一致的 3 篇内置文档
  // 使用数据库路径的父目录推断项目根目录（兼容 standalone 模式）
  const projectRoot = dirname(dataDir);
  const BUILTIN_DOCS = [
    { id: 'VrihWxkCoM9Q', title: '用户使用手册', type: 'guide', file: 'docs/product/USER_GUIDE.md' },
    { id: 'JzbpWix9BUnf', title: '开发者手册', type: 'guide', file: 'docs/technical/DEVELOPMENT.md' },
    { id: 'FtmyZ2zMsm1c', title: 'API 文档', type: 'reference', file: 'docs/technical/API.md' },
  ];
  const insertDoc = sqlite.prepare(
    `INSERT OR IGNORE INTO documents (id, title, content, type, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let docCount = 0;
  for (const doc of BUILTIN_DOCS) {
    const docPath = join(projectRoot, doc.file);
    let content = `# ${doc.title}\n\n文档内容未找到。请访问 /wiki 页面查看最新版本。`;
    if (existsSync(docPath)) {
      content = readFileSync(docPath, 'utf-8');
    } else {
      console.warn(`[TeamClaw] 文档文件不存在: ${doc.file}`);
    }
    insertDoc.run(doc.id, doc.title, content, doc.type, 'local', now, now);
    docCount++;
  }
  console.log(`[TeamClaw] Seeded ${docCount} builtin documents.`);

  // 内置 SOP 模板和渲染模板
  const insertSop = sqlite.prepare(
    `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_SOP_TEMPLATES) {
    insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
  }
  console.log(`[TeamClaw] Seeded ${BUILTIN_SOP_TEMPLATES.length} builtin SOP templates.`);

  const insertRt = sqlite.prepare(
    `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_RENDER_TEMPLATES) {
    insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
  }
  console.log(`[TeamClaw] Seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin render templates.`);

  // ===== 首页内容种子数据（独立 landing_pages 表） =====
  const insertLandingPage = sqlite.prepare(`
    INSERT INTO landing_pages (id, locale, title, content, render_template_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'rt-builtin-landing-page', 'published', ?, ?)
  `);

  // 首页内容从文件读取，避免硬编码
  const LANDING_FILES = [
    { id: 'landing-en', locale: 'en' as const, title: 'Landing Page (English)', file: 'docs/landing/landing-en.md' },
    { id: 'landing-zh', locale: 'zh' as const, title: '首页内容（中文）', file: 'docs/landing/landing-zh.md' },
  ];

  // 默认内容（文件不存在时的后备）
  const defaultMdEn = `<!-- @slot:heroBadge -->
**Badge:** Now with GPT-4o Integration

<!-- @slot:heroTitle -->
# Elevate AI Agents from Chatbots to Team Members

<!-- @slot:heroSubtitle -->
Orchestrate multi-agent workflows, manage shared knowledge, and visualize progress on a unified Kanban board designed for synthetic intelligence.

<!-- @slot:ctaButtons -->
- [Start Collaborating](/dashboard)
- [Watch Demo](#demo)

<!-- @slot:dashboardPreview -->
Dashboard Preview

<!-- @slot:featuresHeader -->
## Core Capabilities
Everything you need to manage your synthetic workforce effectively.

<!-- @slot:featureCards -->
- ## Task Kanban
  Visual project management designed specifically for autonomous agents.
- ## Knowledge Wiki
  A shared brain that all your agents can read and write to.
- ## MCP Command System
  Standardized Model Context Protocol Integration for seamless tool use.

<!-- @slot:modelsTitle -->
Works with Industry Leading Models

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. All rights reserved.
`;

  const defaultMdZh = `<!-- @slot:heroBadge -->
**标签:** 现已集成 GPT-4o

<!-- @slot:heroTitle -->
# 让 AI 代理从聊天机器人进化为团队成员

<!-- @slot:heroSubtitle -->
编排多代理工作流、管理共享知识、在专为合成智能设计的统一看板上可视化进度。

<!-- @slot:ctaButtons -->
- [立即开始](/dashboard)
- [观看演示](#demo)

<!-- @slot:dashboardPreview -->
Dashboard 预览

<!-- @slot:featuresHeader -->
## 核心能力
管理您的合成劳动力所需的一切。

<!-- @slot:featureCards -->
- ## 任务看板
  专为自主代理设计的可视化项目管理。
- ## 知识 Wiki
  所有代理可读写的共享大脑。
- ## MCP 命令系统
  标准化的模型上下文协议集成。

<!-- @slot:modelsTitle -->
支持业界领先的大模型

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. 保留所有权利。
`;

  const defaultContent = { en: defaultMdEn, zh: defaultMdZh };

  for (const landing of LANDING_FILES) {
    const filePath = join(projectRoot, landing.file);
    let content = defaultContent[landing.locale];
    if (existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8');
    } else {
      console.warn(`[TeamClaw] 首页文件不存在: ${landing.file}，使用默认内容`);
    }
    insertLandingPage.run(landing.id, landing.locale, landing.title, content, now, now);
  }
  console.log('[TeamClaw] Seeded default landing pages (en + zh) to landing_pages table.');

  // ===== 审批策略种子数据 =====
  const insertApprovalStrategy = sqlite.prepare(
    `INSERT OR IGNORE INTO approval_strategies (id, type, strategy, enabled, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const BUILTIN_APPROVAL_STRATEGIES = [
    {
      id: 'as-skill-publish',
      type: 'skill_publish',
      strategy: JSON.stringify({
        type: 'skill_publish',
        approverRule: 'any_admin',
        requireMultiple: false,
        requiredApprovals: 1,
        timeoutHours: 72,
        timeoutAction: 'none',
        notifyRequester: true,
        notifyApprover: true,
      }),
    },
    {
      id: 'as-skill-install',
      type: 'skill_install',
      strategy: JSON.stringify({
        type: 'skill_install',
        approverRule: 'any_admin',
        requireMultiple: false,
        requiredApprovals: 1,
        timeoutHours: 48,
        timeoutAction: 'none',
        notifyRequester: true,
        notifyApprover: true,
      }),
    },
    {
      id: 'as-project-join',
      type: 'project_join',
      strategy: JSON.stringify({
        type: 'project_join',
        approverRule: 'project_admin',
        requireMultiple: false,
        requiredApprovals: 1,
        timeoutHours: 24,
        timeoutAction: 'auto_reject',
        notifyRequester: true,
        notifyApprover: true,
      }),
    },
    {
      id: 'as-sensitive-action',
      type: 'sensitive_action',
      strategy: JSON.stringify({
        type: 'sensitive_action',
        approverRule: 'any_admin',
        requireMultiple: true,
        requiredApprovals: 2,
        timeoutHours: 24,
        timeoutAction: 'auto_reject',
        notifyRequester: true,
        notifyApprover: true,
      }),
    },
  ];
  for (const s of BUILTIN_APPROVAL_STRATEGIES) {
    insertApprovalStrategy.run(s.id, s.type, s.strategy, 1, 'system', now, now);
  }
  console.log(`[TeamClaw] Seeded ${BUILTIN_APPROVAL_STRATEGIES.length} builtin approval strategies.`);

  console.log('[TeamClaw] Database initialization complete.');
} else {
  // ===== V1 数据库兼容迁移 =====
  console.log('[TeamClaw] Existing database detected, running v1 compatibility migration...');

  // 1. 忽略 v1 独有的表（coworks, openclaw_connections）— 不删除，仅跳过
  if (tableNames.includes('coworks')) {
    console.log('[TeamClaw] Found v1 "coworks" table — ignored (v2 does not use it)');
  }
  if (tableNames.includes('openclaw_connections')) {
    console.log('[TeamClaw] Found v1 "openclaw_connections" table — ignored (v2 does not use it)');
  }

  // 2. 处理 tasks 表可能存在的 cowork_mode 列 — 无需删除，Drizzle 会忽略未知列
  const taskCols = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const taskColNames = taskCols.map(c => c.name);
  if (taskColNames.includes('cowork_mode')) {
    console.log('[TeamClaw] Found v1 "cowork_mode" column in tasks — ignored (Drizzle skips unknown columns)');
  }

  // 2.5 处理 comments → task_comments 表名迁移
  if (tableNames.includes('comments') && !tableNames.includes('task_comments')) {
    console.log('[TeamClaw] Renaming "comments" → "task_comments"...');
    try {
      sqlite.exec('ALTER TABLE comments RENAME TO task_comments');
      // 补齐 member_id 列（旧表可能用 author_id）
      const tcCols = sqlite.prepare("PRAGMA table_info(task_comments)").all() as { name: string }[];
      const tcColNames = tcCols.map(c => c.name);
      if (!tcColNames.includes('member_id') && tcColNames.includes('author_id')) {
        sqlite.exec('ALTER TABLE task_comments RENAME COLUMN author_id TO member_id');
      }
      if (!tcColNames.includes('updated_at')) {
        sqlite.exec('ALTER TABLE task_comments ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
      }
    } catch (err) {
      console.error('[TeamClaw] comments → task_comments migration failed:', err);
    }
  }

  // 2.6 清理遗留旧表（task_comments 已存在时删除旧 comments，以及 v1 的 schedules/status_queues）
  const legacyTables = ['schedules', 'status_queues'];
  // 如果 task_comments 已存在且 comments 也存在，说明旧表是残留
  if (tableNames.includes('comments') && tableNames.includes('task_comments')) {
    legacyTables.push('comments');
  }
  for (const lt of legacyTables) {
    if (tableNames.includes(lt)) {
      try {
        sqlite.exec(`DROP TABLE IF EXISTS "${lt}"`);
        console.log(`[TeamClaw] Dropped legacy v1 table "${lt}"`);
      } catch (err) {
        console.error(`[TeamClaw] Failed to drop legacy table "${lt}":`, err);
      }
    }
  }

  // 3. 确保所有必需表存在（V1 中可能没有 openclaw_status / scheduled_tasks / scheduled_task_history）
  // 每个表的创建都独立 try-catch，避免一个失败导致后续全部跳过
  const tablesToCreate = [
    {
      name: 'openclaw_status',
      sql: `
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
      `
    },
    {
      name: 'scheduled_tasks',
      sql: `
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
      `
    },
    {
      name: 'scheduled_task_history',
      sql: `
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
      `
    },
    {
      name: 'chat_sessions',
      sql: `
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
      `
    },
    {
      name: 'chat_messages',
      sql: `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES chat_sessions(id),
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      `
    },
    {
      name: 'openclaw_workspaces',
      sql: `
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
      `
    },
    {
      name: 'openclaw_files',
      sql: `
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
      `
    },
    {
      name: 'openclaw_versions',
      sql: `
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
      `
    },
    {
      name: 'openclaw_conflicts',
      sql: `
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
      `
    },
    {
      name: 'deliveries',
      sql: `
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
      `
    },
    // v3.0: SOP 模板表（与 schema.ts sopTemplates 一致）
    {
      name: 'sop_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS sop_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT NOT NULL DEFAULT 'custom',
          icon TEXT DEFAULT 'clipboard-list',
          status TEXT NOT NULL DEFAULT 'active',
          version TEXT NOT NULL DEFAULT '1.0.0',
          stages TEXT NOT NULL DEFAULT '[]',
          required_tools TEXT DEFAULT '[]',
          system_prompt TEXT DEFAULT '',
          knowledge_config TEXT,
          output_config TEXT,
          quality_checklist TEXT DEFAULT '[]',
          "references" TEXT DEFAULT '[]',
          scripts TEXT DEFAULT '[]',
          is_builtin INTEGER NOT NULL DEFAULT 0,
          project_id TEXT REFERENCES projects(id),
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
        CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);
      `
    },
    // v3.0: 渲染模板表（与 schema.ts renderTemplates 一致）
    {
      name: 'render_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS render_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT NOT NULL DEFAULT 'custom',
          status TEXT NOT NULL DEFAULT 'active',
          html_template TEXT NOT NULL DEFAULT '',
          md_template TEXT NOT NULL DEFAULT '',
          css_template TEXT,
          slots TEXT NOT NULL DEFAULT '{}',
          sections TEXT NOT NULL DEFAULT '[]',
          export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}',
          thumbnail TEXT,
          is_builtin INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
        CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
      `
    },
  ];

  for (const table of tablesToCreate) {
    if (!tableNames.includes(table.name)) {
      try {
        console.log(`[TeamClaw] Creating missing "${table.name}" table...`);
        sqlite.exec(table.sql);

        // openclaw_workspaces 表创建后，从环境变量自动创建默认工作区
        if (table.name === 'openclaw_workspaces' && process.env.OPENCLAW_WORKSPACE_PATH) {
          const workspacePath = process.env.OPENCLAW_WORKSPACE_PATH;
          const workspaceName = process.env.OPENCLAW_WORKSPACE_NAME || 'Default Workspace';
          const workspaceMemberId = process.env.OPENCLAW_WORKSPACE_MEMBER_ID || null;
          const syncInterval = parseInt(process.env.OPENCLAW_WORKSPACE_SYNC_INTERVAL || '120', 10);
          const now = Date.now();
          const workspaceId = `ws-${now.toString(36)}`;

          try {
            sqlite.prepare(`
              INSERT INTO openclaw_workspaces 
              (id, member_id, name, path, is_default, sync_enabled, watch_enabled, sync_interval, sync_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(workspaceId, workspaceMemberId, workspaceName, workspacePath, 1, 1, 1, syncInterval, 'idle', now, now);

            console.log(`[TeamClaw] Default workspace created from environment: ${workspacePath}`);
          } catch (wsErr) {
            console.error('[TeamClaw] Failed to create default workspace:', wsErr);
          }
        }
        // sop_templates 表创建后，seed 内置模板
        if (table.name === 'sop_templates') {
          try {
            const now = Date.now();
            const insertSop = sqlite.prepare(
              `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            for (const t of BUILTIN_SOP_TEMPLATES) {
              insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
            }
            console.log(`[TeamClaw] Seeded ${BUILTIN_SOP_TEMPLATES.length} builtin SOP templates (migration).`);
          } catch (seedErr) {
            console.error('[TeamClaw] Failed to seed SOP templates:', seedErr);
          }
        }

        // render_templates 表创建后，seed 内置模板
        if (table.name === 'render_templates') {
          try {
            const now = Date.now();
            const insertRt = sqlite.prepare(
              `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            for (const t of BUILTIN_RENDER_TEMPLATES) {
              insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
            }
            console.log(`[TeamClaw] Seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin render templates (migration).`);
          } catch (seedErr) {
            console.error('[TeamClaw] Failed to seed render templates:', seedErr);
          }
        }
      } catch (err) {
        console.error(`[TeamClaw] Failed to create "${table.name}" table:`, err);
        // 继续执行后续表的创建
      }
    }
  }

  // 4. 确保 members 表有 v2 新增列
  const memberCols = sqlite.prepare("PRAGMA table_info(members)").all() as { name: string }[];
  const memberColNames = memberCols.map(c => c.name);
  const v2MemberCols: [string, string][] = [
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
  ];
  for (const [col, def] of v2MemberCols) {
    if (!memberColNames.includes(col)) {
      // 使用白名单验证表名和列名
      validateTableName('members');
      validateColumnName('members', col);
      console.log(`[TeamClaw] Adding missing column "members.${col}"...`);
      sqlite.exec(`ALTER TABLE members ADD COLUMN ${col} ${def}`);
    }
  }

  // 5. 确保 tasks 表有 v2 新增列
  const v2TaskCols: [string, string][] = [
    ['check_items', "TEXT DEFAULT '[]'"],
    ['attachments', "TEXT DEFAULT '[]'"],
    ['parent_task_id', 'TEXT'],
    ['cross_projects', "TEXT DEFAULT '[]'"],
    ['milestone_id', 'TEXT'],
  ];
  for (const [col, def] of v2TaskCols) {
    if (!taskColNames.includes(col)) {
      console.log(`[TeamClaw] Adding missing column "tasks.${col}"...`);
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
    }
  }

  // 5.2 确保 tasks 表有 v3.0 SOP 相关列
  const v3TaskCols: [string, string][] = [
    ['sop_template_id', 'TEXT'],
    ['current_stage_id', 'TEXT'],
    ['stage_history', "TEXT DEFAULT '[]'"],
    ['sop_inputs', 'TEXT'],
  ];
  // 重新获取 task 列（可能在 v2 迁移中已更新）
  const taskColsV3 = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const taskColNamesV3 = taskColsV3.map(c => c.name);
  for (const [col, def] of v3TaskCols) {
    if (!taskColNamesV3.includes(col)) {
      console.log(`[TeamClaw] Adding v3.0 column "tasks.${col}"...`);
      try {
        // 使用白名单验证表名和列名
        validateTableName('tasks');
        validateColumnName('tasks', col);
        sqlite.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
      } catch (err) {
        console.error(`[TeamClaw] Failed to add tasks.${col}:`, err);
      }
    }
  }

  // 5.1 确保 milestones 表存在（v0.3.9 新增）
  if (!tableNames.includes('milestones')) {
    console.log('[TeamClaw] Creating missing "milestones" table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        project_id TEXT NOT NULL REFERENCES projects(id),
        status TEXT NOT NULL DEFAULT 'open',
        due_date INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        knowledge_config TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
    `);
  }

  // v3.1: 确保 milestones 表有 knowledge_config 列
  if (tableNames.includes('milestones')) {
    const milestoneCols = sqlite.prepare("PRAGMA table_info(milestones)").all() as { name: string }[];
    const milestoneColNames = milestoneCols.map(c => c.name);
    if (!milestoneColNames.includes('knowledge_config')) {
      console.log('[TeamClaw] Adding v3.1 column "milestones.knowledge_config"...');
      try {
        sqlite.exec(`ALTER TABLE milestones ADD COLUMN knowledge_config TEXT`);
      } catch (err) {
        console.error('[TeamClaw] Failed to add milestones.knowledge_config:', err);
      }
    }
  }

  // 6. 确保 documents 表有 v2 新增列
  if (tableNames.includes('documents')) {
    const docCols = sqlite.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    const docColNames = docCols.map(c => c.name);
    const v2DocCols: [string, string][] = [
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
    ];
    for (const [col, def] of v2DocCols) {
      if (!docColNames.includes(col)) {
        console.log(`[TeamClaw] Adding missing column "documents.${col}"...`);
        try {
          sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[TeamClaw] Failed to add documents.${col}:`, err);
        }
      }
    }
    
    // 6.1 确保 documents 表有 v3.0 Content Studio 相关列
    const v3DocCols: [string, string][] = [
      ['render_mode', "TEXT DEFAULT 'markdown'"],
      ['render_template_id', 'TEXT'],
      ['html_content', 'TEXT'],
      ['slot_data', 'TEXT'],
    ];
    // 重新获取文档列（可能在 v2 迁移中已更新）
    const docColsV3 = sqlite.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    const docColNamesV3 = docColsV3.map(c => c.name);
    for (const [col, def] of v3DocCols) {
      if (!docColNamesV3.includes(col)) {
        console.log(`[TeamClaw] Adding v3.0 column "documents.${col}"...`);
        try {
          // 使用白名单验证表名和列名
          validateTableName('documents');
          validateColumnName('documents', col);
          sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[TeamClaw] Failed to add documents.${col}:`, err);
        }
      }
    }
  }

  // v3.1: 确保 projects 表有 knowledge_config 列
  if (tableNames.includes('projects')) {
    const projectCols = sqlite.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    const projectColNames = projectCols.map(c => c.name);
    if (!projectColNames.includes('knowledge_config')) {
      console.log('[TeamClaw] Adding v3.1 column "projects.knowledge_config"...');
      try {
        sqlite.exec(`ALTER TABLE projects ADD COLUMN knowledge_config TEXT`);
      } catch (err) {
        console.error('[TeamClaw] Failed to add projects.knowledge_config:', err);
      }
    }
  }

  console.log('[TeamClaw] V1/V2 compatibility migration complete.');

  // v3.0: 检查 sop_templates/render_templates 表 schema 是否为旧版
  // 旧版（v2）的 sop_templates 有 'version'/'is_system' 列，缺少 'icon'/'status'
  if (tableNames.includes('sop_templates')) {
    const sopCols = sqlite.prepare("PRAGMA table_info(sop_templates)").all() as { name: string }[];
    const sopColNames = sopCols.map(c => c.name);
    if (!sopColNames.includes('icon') || !sopColNames.includes('status')) {
      console.log('[TeamClaw] Detected old sop_templates schema, rebuilding...');
      try {
        sqlite.exec('DROP TABLE IF EXISTS sop_templates');
        sqlite.exec(`
          CREATE TABLE sop_templates (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'custom', icon TEXT DEFAULT 'clipboard-list',
            status TEXT NOT NULL DEFAULT 'active', version TEXT NOT NULL DEFAULT '1.0.0',
            stages TEXT NOT NULL DEFAULT '[]',
            required_tools TEXT DEFAULT '[]', system_prompt TEXT DEFAULT '',
            knowledge_config TEXT, output_config TEXT, quality_checklist TEXT DEFAULT '[]',
            references TEXT DEFAULT '[]', scripts TEXT DEFAULT '[]',
            is_builtin INTEGER NOT NULL DEFAULT 0, project_id TEXT REFERENCES projects(id),
            created_by TEXT NOT NULL DEFAULT 'system', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
          CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);
        `);
        const now = Date.now();
        const insertSop = sqlite.prepare(
          `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const t of BUILTIN_SOP_TEMPLATES) {
          insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
        }
        console.log(`[TeamClaw] Rebuilt sop_templates and seeded ${BUILTIN_SOP_TEMPLATES.length} builtin templates.`);
      } catch (err) {
        console.error('[TeamClaw] Failed to rebuild sop_templates:', err);
      }
    }
    
    // v3.1: 添加 references 和 scripts 列（如果不存在）
    const sopColsV31 = sqlite.prepare("PRAGMA table_info(sop_templates)").all() as { name: string }[];
    const sopColNamesV31 = sopColsV31.map(c => c.name);
    const v31SopCols: [string, string][] = [
      ['version', "TEXT NOT NULL DEFAULT '1.0.0'"],
      // references 是 SQLite 关键字，需要用双引号包裹列名
      ['references', 'TEXT DEFAULT \'[]\''],
      ['scripts', "TEXT DEFAULT '[]'"],
    ];
    for (const [col, def] of v31SopCols) {
      if (!sopColNamesV31.includes(col)) {
        try {
          console.log(`[TeamClaw] Adding v3.1 column "sop_templates.${col}"...`);
          validateTableName('sop_templates');
          validateColumnName('sop_templates', col);
          // references 是 SQLite 关键字，需要特殊处理
          const colName = col === 'references' ? `"${col}"` : col;
          sqlite.exec(`ALTER TABLE sop_templates ADD COLUMN ${colName} ${def}`);
        } catch (err) {
          console.error(`[TeamClaw] Failed to add sop_templates.${col}:`, err);
        }
      }
    }
  }
  if (tableNames.includes('render_templates')) {
    const rtCols = sqlite.prepare("PRAGMA table_info(render_templates)").all() as { name: string }[];
    const rtColNames = rtCols.map(c => c.name);
    if (!rtColNames.includes('md_template') || !rtColNames.includes('slots')) {
      console.log('[TeamClaw] Detected old render_templates schema, rebuilding...');
      try {
        sqlite.exec('DROP TABLE IF EXISTS render_templates');
        sqlite.exec(`
          CREATE TABLE render_templates (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'custom', status TEXT NOT NULL DEFAULT 'active',
            html_template TEXT NOT NULL DEFAULT '', md_template TEXT NOT NULL DEFAULT '',
            css_template TEXT, slots TEXT NOT NULL DEFAULT '{}', sections TEXT NOT NULL DEFAULT '[]',
            export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}', thumbnail TEXT,
            is_builtin INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'system',
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
          CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
        `);
        const now = Date.now();
        const insertRt = sqlite.prepare(
          `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const t of BUILTIN_RENDER_TEMPLATES) {
          insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
        }
        console.log(`[TeamClaw] Rebuilt render_templates and seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin templates.`);
      } catch (err) {
        console.error('[TeamClaw] Failed to rebuild render_templates:', err);
      }
    }
  }

  // 确保 deliveries 表有所有必需列
  if (tableNames.includes('deliveries')) {
    const deliveryCols = sqlite.prepare("PRAGMA table_info(deliveries)").all() as { name: string }[];
    const deliveryColNames = deliveryCols.map(c => c.name);
    const v2DeliveryCols: [string, string][] = [
      ['member_id', 'TEXT REFERENCES members(id)'],
      ['source', "TEXT NOT NULL DEFAULT 'local'"],
      ['document_id', 'TEXT REFERENCES documents(id)'],
      ['reviewer_id', 'TEXT REFERENCES members(id)'],
      ['reviewed_at', 'INTEGER'],
      ['review_comment', 'TEXT'],
      ['version', 'INTEGER DEFAULT 1'],
      ['previous_delivery_id', 'TEXT'],
      ['external_id', 'TEXT'],
      ['external_url', 'TEXT'],
    ];
    for (const [col, def] of v2DeliveryCols) {
      if (!deliveryColNames.includes(col)) {
        try {
          console.log(`[TeamClaw] Adding missing column "deliveries.${col}"...`);
          // 使用白名单验证表名和列名
          validateTableName('deliveries');
          validateColumnName('deliveries', col);
          sqlite.exec(`ALTER TABLE deliveries ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[TeamClaw] Failed to add deliveries.${col}:`, err);
        }
      }
    }
  }

  // 确保 projects 表有 source 列
  if (tableNames.includes('projects')) {
    const projectCols = sqlite.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    const projectColNames = projectCols.map(c => c.name);
    if (!projectColNames.includes('source')) {
      console.log('[TeamClaw] Adding missing column "projects.source"...');
      sqlite.exec(`ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'local'`);
    }
  }

  // 确保 tasks 表有 source 列
  if (tableNames.includes('tasks')) {
    const taskCols = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const taskColNames = taskCols.map(c => c.name);
    if (!taskColNames.includes('source')) {
      console.log('[TeamClaw] Adding missing column "tasks.source"...');
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'local'`);
    }
  }
}

  // 确保新索引存在（V1 迁移后添加）
  const existingIndexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
  const indexNames = existingIndexes.map(i => i.name);
  
  const newIndexes = [
    { name: 'idx_members_name', sql: 'CREATE INDEX IF NOT EXISTS idx_members_name ON members(name)' },
    { name: 'idx_documents_title', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)' },
    { name: 'idx_documents_project_tags', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_project_tags ON documents(project_tags)' },
    { name: 'idx_tasks_parent_task_id', sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)' },
    { name: 'idx_deliveries_status', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)' },
    { name: 'idx_chat_messages_session_created', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at)' },
    { name: 'idx_documents_source', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)' },
    // 问题 #32：deliveries 的 document_id 和 reviewer_id 索引
    { name: 'idx_deliveries_document_id', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_document_id ON deliveries(document_id)' },
    { name: 'idx_deliveries_reviewer_id', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_reviewer_id ON deliveries(reviewer_id)' },
    // 问题 #33：members 的 type 和 openclaw_endpoint 索引
    { name: 'idx_members_type', sql: 'CREATE INDEX IF NOT EXISTS idx_members_type ON members(type)' },
    { name: 'idx_members_openclaw_endpoint', sql: 'CREATE INDEX IF NOT EXISTS idx_members_openclaw_endpoint ON members(openclaw_endpoint)' },
    // v3.0: SOP 相关索引
    { name: 'idx_tasks_sop_template_id', sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_sop_template_id ON tasks(sop_template_id)' },
    { name: 'idx_documents_render_mode', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_render_mode ON documents(render_mode)' },
    { name: 'idx_documents_render_template_id', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_render_template_id ON documents(render_template_id)' },
    // 缺失索引补充
    { name: 'idx_scheduled_tasks_enabled', sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled)' },
    { name: 'idx_openclaw_files_relative_path', sql: 'CREATE INDEX IF NOT EXISTS idx_openclaw_files_relative_path ON openclaw_files(relative_path)' },
    { name: 'idx_chat_sessions_updated_at', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at)' },
  ];
  
  for (const idx of newIndexes) {
    if (!indexNames.includes(idx.name)) {
      console.log(`[TeamClaw] Creating missing index "${idx.name}"...`);
      sqlite.exec(idx.sql);
    }
  }

  // ===== Gateway 配置表迁移（REQ-003） =====
  if (!tableNames.includes('gateway_configs')) {
    try {
      console.log('[TeamClaw] Creating "gateway_configs" table for server proxy mode...');
      sqlite.exec(`
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
      `);

      // 从环境变量自动创建默认 Gateway 配置
      if (process.env.OPENCLAW_DEFAULT_ENDPOINT && process.env.OPENCLAW_TOKEN) {
        let defaultUrl = process.env.OPENCLAW_DEFAULT_ENDPOINT;
        const defaultToken = process.env.OPENCLAW_TOKEN;
        const mode = process.env.GATEWAY_MODE || 'server_proxy';
        const now = Date.now();
        
        // 自动修正 URL 协议：http:// -> ws://, https:// -> wss://
        if (defaultUrl.startsWith('http://')) {
          defaultUrl = defaultUrl.replace('http://', 'ws://');
          console.log('[TeamClaw] Auto-corrected Gateway URL: http:// -> ws://');
        } else if (defaultUrl.startsWith('https://')) {
          defaultUrl = defaultUrl.replace('https://', 'wss://');
          console.log('[TeamClaw] Auto-corrected Gateway URL: https:// -> wss://');
        }
        
        // 验证 URL 协议
        if (!defaultUrl.startsWith('ws://') && !defaultUrl.startsWith('wss://')) {
          console.error('[TeamClaw] Invalid Gateway URL protocol, must be ws:// or wss://:', defaultUrl);
        } else {
          try {
            const encryptedToken = encryptToken(defaultToken);
            
            sqlite.prepare(`
              INSERT INTO gateway_configs (id, name, url, encrypted_token, mode, status, is_default, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('gw-default', 'default', defaultUrl, encryptedToken, mode, 'disconnected', 1, now, now);
            
            console.log('[TeamClaw] Default Gateway config created from environment variables');
          } catch (err) {
            console.error('[TeamClaw] Failed to create default Gateway config:', err);
          }
        }
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to create gateway_configs table:', err);
    }
  }

  // ===== 审计日志表迁移 =====
  if (!tableNames.includes('audit_logs')) {
    try {
      console.log('[TeamClaw] Creating "audit_logs" table...');
      sqlite.exec(`
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
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create audit_logs table:', err);
    }
  }

  // ===== Phase E: 多用户管理表迁移 =====
  
  // v3.0 Phase E: users 表
  if (!tableNames.includes('users')) {
    try {
      console.log('[TeamClaw] Creating "users" table (Phase E)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          avatar TEXT,
          role TEXT NOT NULL DEFAULT 'member',
          team_id TEXT,
          password_hash TEXT NOT NULL,
          security_code_hash TEXT,
          email_verified INTEGER NOT NULL DEFAULT 0,
          preferences TEXT DEFAULT '{}',
          last_login_at INTEGER,
          locked_until INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
      `);
      
      // v3.0: 不再创建默认 admin 用户
      // 用户通过 /init 页面创建第一个管理员账户
      console.log('[TeamClaw] Users table created. Visit /init to create admin account.');
    } catch (err) {
      console.error('[TeamClaw] Failed to create users table:', err);
    }
  }

  // v3.0 Phase E: user_mcp_tokens 表
  if (!tableNames.includes('user_mcp_tokens')) {
    try {
      console.log('[TeamClaw] Creating "user_mcp_tokens" table (Phase E)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS user_mcp_tokens (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL,
          encrypted_token TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          permissions TEXT DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active',
          last_used_at INTEGER,
          expires_at INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_hash ON user_mcp_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_user ON user_mcp_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_mcp_tokens_status ON user_mcp_tokens(status);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create user_mcp_tokens table:', err);
    }
  }

  // v3.0 Phase E: sop_stage_records 表（SOP 阶段执行记录，从 tasks.stage_history JSON 拆出）
  if (!tableNames.includes('sop_stage_records')) {
    try {
      console.log('[TeamClaw] Creating "sop_stage_records" table (Phase E)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS sop_stage_records (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          stage_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          output TEXT,
          output_type TEXT DEFAULT 'text',
          started_at INTEGER,
          completed_at INTEGER,
          confirmed_by TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sop_stage_records_task ON sop_stage_records(task_id);
        CREATE INDEX IF NOT EXISTS idx_sop_stage_records_status ON sop_stage_records(status);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create sop_stage_records table:', err);
    }
  }

  // v3.0 Phase E: activity_logs 表（多维度操作日志）
  if (!tableNames.includes('activity_logs')) {
    try {
      console.log('[TeamClaw] Creating "activity_logs" table (Phase E)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT REFERENCES users(id),
          member_id TEXT REFERENCES members(id),
          source TEXT NOT NULL,
          source_detail TEXT,
          module TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          resource_title TEXT,
          action TEXT NOT NULL,
          action_detail TEXT,
          changes TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          error TEXT,
          project_id TEXT,
          request_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          duration_ms INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activity_module ON activity_logs(module, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_member ON activity_logs(member_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_logs(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_source ON activity_logs(source);
        CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(module, action);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create activity_logs table:', err);
    }
  }

  // ===== 内置模板升级（幂等，每次启动检查） =====
  // 1. INSERT OR IGNORE：确保新增的内置模板能被插入到已有数据库
  // 2. UPDATE：已有的内置模板内容保持最新（不影响用户自定义模板）
  if (tableNames.includes('render_templates')) {
    try {
      const now = Date.now();
      // 先 INSERT OR IGNORE，确保新模板被创建
      const insertRt = sqlite.prepare(
        `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      let inserted = 0;
      for (const t of BUILTIN_RENDER_TEMPLATES) {
        const result = insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
        if (result.changes > 0) inserted++;
      }
      if (inserted > 0) {
        console.log(`[TeamClaw] Inserted ${inserted} new builtin render templates.`);
      }
      // 再 UPDATE，确保已有模板内容为最新版本
      const updateRt = sqlite.prepare(
        `UPDATE render_templates SET md_template = ?, html_template = ?, css_template = ?, slots = ?, sections = ?, export_config = ?, updated_at = ? WHERE id = ? AND is_builtin = 1`
      );
      let updated = 0;
      for (const t of BUILTIN_RENDER_TEMPLATES) {
        const result = updateRt.run(t.mdTemplate, t.htmlTemplate, t.cssTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), now, t.id);
        if (result.changes > 0) updated++;
      }
      if (updated > 0) {
        console.log(`[TeamClaw] Upgraded ${updated} builtin render templates.`);
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to upgrade builtin render templates:', err);
    }
  }

  // ===== v3.0 Phase E: 首页文档 slot 格式迁移（移除 navLinks/navButtons，导航栏改为组件固定渲染） =====
  // 检测标志：包含 @slot:navLinks 表示是旧版格式（v3.0-early），需要迁移
  if (tableNames.includes('documents')) {
    try {
      const landingDocs = sqlite.prepare(
        `SELECT id, content FROM documents WHERE id IN ('landing-en', 'landing-zh') AND type = 'landing'`
      ).all() as { id: string; content: string }[];
      
      let migrated = 0;
      for (const doc of landingDocs) {
        // v3.0 Phase E 迁移：移除 navLinks 和 navButtons slot（导航栏改为 Navbar 组件固定渲染）
        // 同时处理更老的版本（缺少 footerSocial/dashboardPreview 等）
        const hasOldNavSlots = doc.content && doc.content.includes('@slot:navLinks');
        const hasOldFormat = doc.content && (
          !doc.content.includes('@slot:footerSocial') ||
          !doc.content.includes('@slot:dashboardPreview') ||
          doc.content.includes('@slot:ctaPrimary') ||
          doc.content.includes('@slot:feature1')
        );
        
        if (!hasOldNavSlots && !hasOldFormat) continue;

        const newContent = doc.id === 'landing-en'
          ? `<!-- @slot:heroBadge -->
**Badge:** Now with GPT-4o Integration

<!-- @slot:heroTitle -->
# Elevate AI Agents from Chatbots to Team Members

<!-- @slot:heroSubtitle -->
Orchestrate multi-agent workflows, manage shared knowledge, and visualize progress on a unified Kanban board designed for synthetic intelligence.

<!-- @slot:ctaButtons -->
- [Start Collaborating](/dashboard)
- [Watch Demo](#demo)

<!-- @slot:dashboardPreview -->
Dashboard Preview

<!-- @slot:featuresHeader -->
## Core Capabilities
Everything you need to manage your synthetic workforce effectively.

<!-- @slot:featureCards -->
- ## 📊 Task Kanban
  Visual project management designed specifically for autonomous agents. Track reasoning steps, tool usage, and final outputs in real-time.
- ## 📚 Knowledge Wiki
  A shared brain that all your agents can read and write to. Persistent memory management ensures no context is lost between sessions.
- ## 🔧 MCP Command System
  Standardized Model Context Protocol Integration for seamless tool use. Connect agents to your database, API, or local file system securely.

<!-- @slot:modelsTitle -->
Works with Industry Leading Models

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerLinks -->
- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Contact Support](/contact)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)
- [X (Twitter)](https://x.com)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. All rights reserved.`
          : `<!-- @slot:heroBadge -->
**标签:** 现已集成 GPT-4o

<!-- @slot:heroTitle -->
# 让 AI 代理从聊天机器人进化为团队成员

<!-- @slot:heroSubtitle -->
编排多代理工作流、管理共享知识、在专为合成智能设计的统一看板上可视化进度。

<!-- @slot:ctaButtons -->
- [立即开始](/dashboard)
- [观看演示](#demo)

<!-- @slot:dashboardPreview -->
Dashboard 预览

<!-- @slot:featuresHeader -->
## 核心能力
管理您的合成劳动力所需的一切。

<!-- @slot:featureCards -->
- ## 📊 任务看板
  专为自主代理设计的可视化项目管理。实时追踪推理步骤、工具调用和最终输出。
- ## 📚 知识 Wiki
  所有代理可读写的共享大脑。持久化记忆管理确保会话间上下文不丢失。
- ## 🔧 MCP 命令系统
  标准化的模型上下文协议集成。安全连接代理到数据库、API 或本地文件系统。

<!-- @slot:modelsTitle -->
支持业界领先的大模型

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerLinks -->
- [隐私政策](/privacy)
- [服务条款](/terms)
- [联系支持](/contact)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)
- [X (Twitter)](https://x.com)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. 保留所有权利。`;
        sqlite.prepare(`UPDATE documents SET content = ?, updated_at = ? WHERE id = ?`)
          .run(newContent, Date.now(), doc.id);
        migrated++;
      }
      if (migrated > 0) {
        console.log(`[TeamClaw] Migrated ${migrated} landing documents to v3.0 Phase E slot format (12 slots, removed navLinks/navButtons).`);
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate landing documents:', err);
    }
  }

  // ===== v3.0 Phase E: landing_pages 表迁移（从 documents 表分离）=====
  // 创建独立的 landing_pages 表，并从 documents 迁移数据
  if (!tableNames.includes('landing_pages')) {
    try {
      console.log('[TeamClaw] Creating "landing_pages" table (v3.0 Phase E)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS landing_pages (
          id TEXT PRIMARY KEY NOT NULL,
          locale TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          render_template_id TEXT,
          meta_title TEXT,
          meta_description TEXT,
          status TEXT NOT NULL DEFAULT 'published',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_landing_pages_locale ON landing_pages(locale);
        CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);
      `);

      // 从 documents 表迁移 landing 类型文档到 landing_pages 表
      const landingDocs = sqlite.prepare(`
        SELECT id, title, content, render_template_id, created_at, updated_at
        FROM documents WHERE type = 'landing'
      `).all() as { id: string; title: string; content: string; render_template_id: string | null; created_at: number; updated_at: number }[];

      if (landingDocs.length > 0) {
        const insertLanding = sqlite.prepare(`
          INSERT OR REPLACE INTO landing_pages (id, locale, title, content, render_template_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'published', ?, ?)
        `);
        for (const doc of landingDocs) {
          const locale = doc.id.includes('zh') ? 'zh' : 'en';
          insertLanding.run(doc.id, locale, doc.title, doc.content, doc.render_template_id || 'rt-builtin-landing-page', doc.created_at, doc.updated_at);
        }
        console.log(`[TeamClaw] Migrated ${landingDocs.length} landing documents to landing_pages table.`);

        // 可选：删除 documents 表中的 landing 类型记录（保留也无妨，但会占用空间）
        // sqlite.prepare(`DELETE FROM documents WHERE type = 'landing'`).run();
        // console.log(`[TeamClaw] Removed landing documents from documents table.`);
      } else {
        // 如果 documents 中没有 landing 数据，seed 默认内容
        const now = Date.now();
        const defaultMdEn = `<!-- @slot:heroBadge -->
**Badge:** Now with GPT-4o Integration

<!-- @slot:heroTitle -->
# Elevate AI Agents from Chatbots to Team Members

<!-- @slot:heroSubtitle -->
Orchestrate multi-agent workflows, manage shared knowledge, and visualize progress on a unified Kanban board designed for synthetic intelligence.

<!-- @slot:ctaButtons -->
- [Start Collaborating](/dashboard)
- [Watch Demo](#demo)

<!-- @slot:dashboardPreview -->
Dashboard Preview

<!-- @slot:featuresHeader -->
## Core Capabilities
Everything you need to manage your synthetic workforce effectively.

<!-- @slot:featureCards -->
- ## 📊 Task Kanban
  Visual project management designed specifically for autonomous agents. Track reasoning steps, tool usage, and final outputs in real-time.
- ## 📚 Knowledge Wiki
  A shared brain that all your agents can read and write to. Persistent memory management ensures no context is lost between sessions.
- ## 🔧 MCP Command System
  Standardized Model Context Protocol Integration for seamless tool use. Connect agents to your database, API, or local file system securely.

<!-- @slot:modelsTitle -->
Works with Industry Leading Models

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerLinks -->
- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Contact Support](/contact)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)
- [X (Twitter)](https://x.com)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. All rights reserved.`;

        const defaultMdZh = `<!-- @slot:heroBadge -->
**标签:** 现已集成 GPT-4o

<!-- @slot:heroTitle -->
# 让 AI 代理从聊天机器人进化为团队成员

<!-- @slot:heroSubtitle -->
编排多代理工作流、管理共享知识、在专为合成智能设计的统一看板上可视化进度。

<!-- @slot:ctaButtons -->
- [立即开始](/dashboard)
- [观看演示](#demo)

<!-- @slot:dashboardPreview -->
Dashboard 预览

<!-- @slot:featuresHeader -->
## 核心能力
管理您的合成劳动力所需的一切。

<!-- @slot:featureCards -->
- ## 📊 任务看板
  专为自主代理设计的可视化项目管理。实时追踪推理步骤、工具调用和最终输出。
- ## 📚 知识 Wiki
  所有代理可读写的共享大脑。持久化记忆管理确保会话间上下文不丢失。
- ## 🔧 MCP 命令系统
  标准化的模型上下文协议集成。安全连接代理到数据库、API 或本地文件系统。

<!-- @slot:modelsTitle -->
支持业界领先的大模型

<!-- @slot:modelLogos -->
- OpenAI
- Anthropic
- Mistral AI
- Meta Llama

<!-- @slot:footerLinks -->
- [隐私政策](/privacy)
- [服务条款](/terms)
- [联系支持](/contact)

<!-- @slot:footerSocial -->
- [GitHub](https://github.com/dqalex/teamclaw)
- [X (Twitter)](https://x.com)

<!-- @slot:footerCopyright -->
© 2026 TeamClaw Inc. 保留所有权利。`;

        const insertLanding = sqlite.prepare(`
          INSERT INTO landing_pages (id, locale, title, content, render_template_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'rt-builtin-landing-page', 'published', ?, ?)
        `);
        insertLanding.run('landing-en', 'en', 'Landing Page (English)', defaultMdEn, now, now);
        insertLanding.run('landing-zh', 'zh', '首页内容（中文）', defaultMdZh, now, now);
        console.log('[TeamClaw] Seeded default landing pages (en + zh) to landing_pages table (migration).');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to create landing_pages table:', err);
    }
  }

  // ===== v3.0: 用户 → 成员同步迁移（带 userId 关联）=====
  // 确保所有 users 表中的用户都有对应的 members 记录，并通过 userId 关联
  if (tableNames.includes('users') && tableNames.includes('members')) {
    try {
      // 1. 检查并添加 user_id 列
      const memberCols = sqlite.prepare("PRAGMA table_info('members')").all() as { name: string }[];
      const hasUserIdCol = memberCols.some(c => c.name === 'user_id');
      
      if (!hasUserIdCol) {
        console.log('[TeamClaw] Adding user_id column to members table...');
        sqlite.exec('ALTER TABLE members ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE');
      }
      
      // 2. 为已存在的 members 通过 email 匹配关联 user_id
      const membersWithoutUserId = sqlite.prepare(`
        SELECT m.id, m.email FROM members m
        WHERE m.type = 'human' AND m.user_id IS NULL AND m.email IS NOT NULL
      `).all() as { id: string; email: string }[];
      
      if (membersWithoutUserId.length > 0) {
        console.log(`[TeamClaw] Linking ${membersWithoutUserId.length} members to users...`);
        const updateMemberUserId = sqlite.prepare(`
          UPDATE members SET user_id = (SELECT id FROM users WHERE email = ?) WHERE id = ?
        `);
        for (const m of membersWithoutUserId) {
          updateMemberUserId.run(m.email, m.id);
        }
      }
      
      // 3. 删除没有关联用户的人类成员（如默认管理员 member-default、遗留 member-er-admin 等）
      const orphanHumanMembers = sqlite.prepare(`
        SELECT m.id, m.name FROM members m
        WHERE m.type = 'human' AND (m.user_id IS NULL OR m.user_id = '')
      `).all() as { id: string; name: string }[];
      
      if (orphanHumanMembers.length > 0) {
        console.log(`[TeamClaw] Removing ${orphanHumanMembers.length} orphan human members: ${orphanHumanMembers.map(m => m.name).join(', ')}`);
        sqlite.prepare(`DELETE FROM members WHERE type = 'human' AND (user_id IS NULL OR user_id = '')`).run();
      }
      
      // 4. 为没有 member 记录的 users 创建成员
      const usersWithoutMember = sqlite.prepare(`
        SELECT u.id, u.email, u.name, u.created_at, u.updated_at
        FROM users u
        LEFT JOIN members m ON m.user_id = u.id
        WHERE m.id IS NULL
      `).all() as { id: string; email: string; name: string; created_at: number; updated_at: number }[];
      
      if (usersWithoutMember.length > 0) {
        console.log(`[TeamClaw] Creating members for ${usersWithoutMember.length} users...`);
        const insertMember = sqlite.prepare(`
          INSERT INTO members (id, user_id, name, type, email, online, created_at, updated_at)
          VALUES (?, ?, ?, 'human', ?, 0, ?, ?)
        `);
        
        for (const user of usersWithoutMember) {
          const memberId = `member-${user.id.slice(-8)}`;
          insertMember.run(memberId, user.id, user.name, user.email, user.created_at, user.updated_at);
        }
        console.log(`[TeamClaw] Created ${usersWithoutMember.length} member records.`);
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to sync users to members:', err);
    }
  }

  // ===== v3.0: 安全码字段迁移 =====
  if (tableNames.includes('users')) {
    try {
      const userCols = sqlite.prepare("PRAGMA table_info('users')").all() as { name: string }[];
      const hasSecurityCode = userCols.some(c => c.name === 'security_code_hash');
      
      if (!hasSecurityCode) {
        console.log('[TeamClaw] Adding security_code_hash column to users table...');
        sqlite.exec('ALTER TABLE users ADD COLUMN security_code_hash TEXT');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to add security_code_hash column:', err);
    }
  }

  // ===== v3.0: 聊天会话用户隔离迁移 =====
  // 为 chat_sessions 添加 user_id 字段，实现严格的用户隔离
  if (tableNames.includes('chat_sessions')) {
    try {
      const chatSessionCols = sqlite.prepare("PRAGMA table_info('chat_sessions')").all() as { name: string }[];
      const hasUserId = chatSessionCols.some(c => c.name === 'user_id');
      
      if (!hasUserId) {
        console.log('[TeamClaw] Adding user_id column to chat_sessions table for user isolation...');
        sqlite.exec('ALTER TABLE chat_sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE');
        sqlite.exec('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)');
        
        // 数据迁移：将现有会话关联到 admin 用户
        const adminUser = sqlite.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
        if (adminUser) {
          const result = sqlite.prepare("UPDATE chat_sessions SET user_id = ? WHERE user_id IS NULL").run(adminUser.id);
          console.log(`[TeamClaw] Migrated ${result.changes} existing chat sessions to admin user (${adminUser.id})`);
        }
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate chat_sessions user_id:', err);
    }
  }

  // ===== v3.0: 项目权限系统迁移 =====
  // 为 projects 添加 owner_id 和 visibility 字段
  if (tableNames.includes('projects')) {
    try {
      const projectCols = sqlite.prepare("PRAGMA table_info('projects')").all() as { name: string }[];
      const projectColNames = projectCols.map(c => c.name);
      
      // 添加 owner_id 字段
      if (!projectColNames.includes('owner_id')) {
        console.log('[TeamClaw] Adding owner_id column to projects table...');
        sqlite.exec('ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL');
        sqlite.exec('CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)');
        
        // 数据迁移：将现有项目归属给 admin 用户
        const adminUser = sqlite.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
        if (adminUser) {
          const result = sqlite.prepare("UPDATE projects SET owner_id = ? WHERE owner_id IS NULL").run(adminUser.id);
          console.log(`[TeamClaw] Migrated ${result.changes} existing projects to admin user (${adminUser.id})`);
        }
      }
      
      // 添加 visibility 字段
      if (!projectColNames.includes('visibility')) {
        console.log('[TeamClaw] Adding visibility column to projects table...');
        sqlite.exec("ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
        sqlite.exec('CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility)');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate projects permission fields:', err);
    }
  }

  // ===== v3.0: 项目成员表迁移 =====
  // 检查表是否存在，以及是否需要重建（旧版使用 member_id，新版使用 user_id）
  if (tableNames.includes('project_members')) {
    const pmCols = sqlite.prepare("PRAGMA table_info('project_members')").all() as { name: string }[];
    const pmColNames = pmCols.map(c => c.name);
    
    // 旧版 schema: 使用 member_id 和复合主键 (project_id, member_id)
    // 新版 schema: 使用 id 作为主键，user_id 引用 users 表
    const hasUserId = pmColNames.includes('user_id');
    const hasId = pmColNames.includes('id');
    
    if (!hasUserId || !hasId) {
      console.log('[TeamClaw] Detected old project_members schema (member_id), rebuilding to use user_id...');
      try {
        // 备份并重建表
        sqlite.exec('DROP TABLE IF EXISTS project_members');
        sqlite.exec(`
          CREATE TABLE project_members (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member',
            created_at INTEGER NOT NULL,
            UNIQUE(project_id, user_id)
          );
          CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
          CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
          CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
        `);
        console.log('[TeamClaw] project_members table rebuilt with new schema.');
        
        // 为每个现有项目创建 owner 成员记录
        const projectsWithOwner = sqlite.prepare(`
          SELECT id, owner_id FROM projects WHERE owner_id IS NOT NULL
        `).all() as { id: string; owner_id: string }[];
        
        if (projectsWithOwner.length > 0) {
          const now = Date.now();
          const insertMember = sqlite.prepare(`
            INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
            VALUES (?, ?, ?, 'owner', ?)
          `);
          for (const p of projectsWithOwner) {
            insertMember.run(`pm-${p.id}-${p.owner_id}`, p.id, p.owner_id, now);
          }
          console.log(`[TeamClaw] Created owner records for ${projectsWithOwner.length} projects in project_members table.`);
        }
      } catch (err) {
        console.error('[TeamClaw] Failed to rebuild project_members table:', err);
      }
    }
  } else {
    // 表不存在，创建新表
    try {
      console.log('[TeamClaw] Creating "project_members" table for project collaboration...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS project_members (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'member',
          created_at INTEGER NOT NULL,
          UNIQUE(project_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
      `);
      
      // 为每个现有项目创建 owner 成员记录
      const projectsWithOwner = sqlite.prepare(`
        SELECT id, owner_id FROM projects WHERE owner_id IS NOT NULL
      `).all() as { id: string; owner_id: string }[];
      
      if (projectsWithOwner.length > 0) {
        const now = Date.now();
        const insertMember = sqlite.prepare(`
          INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
          VALUES (?, ?, ?, 'owner', ?)
        `);
        for (const p of projectsWithOwner) {
          insertMember.run(`pm-${p.id}-${p.owner_id}`, p.id, p.owner_id, now);
        }
        console.log(`[TeamClaw] Created owner records for ${projectsWithOwner.length} projects in project_members table.`);
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to create project_members table:', err);
    }
  }

  // ===== v3.0 Phase F: Agent MCP Token 表（对话信道自动认证） =====
  if (!tableNames.includes('agent_mcp_tokens')) {
    try {
      console.log('[TeamClaw] Creating "agent_mcp_tokens" table (v3.0 Phase F)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS agent_mcp_tokens (
          id TEXT PRIMARY KEY NOT NULL,
          agent_id TEXT,
          member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL,
          encrypted_token TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'auto',
          status TEXT NOT NULL DEFAULT 'active',
          last_used_at INTEGER,
          usage_count INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_hash ON agent_mcp_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_agent ON agent_mcp_tokens(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_member ON agent_mcp_tokens(member_id);
        CREATE INDEX IF NOT EXISTS idx_agent_mcp_tokens_status ON agent_mcp_tokens(status);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create agent_mcp_tokens table:', err);
    }
  }

  // ===== v3.0 SkillHub: 审批系统表 =====
  if (!tableNames.includes('approval_requests')) {
    try {
      console.log('[TeamClaw] Creating "approval_requests" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS approval_requests (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          requester_id TEXT NOT NULL,
          payload TEXT,
          request_note TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          approved_by TEXT,
          rejected_by TEXT,
          approval_note TEXT,
          rejection_note TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          processed_at INTEGER,
          expires_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_approval_type_status ON approval_requests(type, status);
        CREATE INDEX IF NOT EXISTS idx_approval_resource ON approval_requests(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_approval_requester ON approval_requests(requester_id);
        CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create approval_requests table:', err);
    }
  }

  if (!tableNames.includes('approval_histories')) {
    try {
      console.log('[TeamClaw] Creating "approval_histories" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS approval_histories (
          id TEXT PRIMARY KEY NOT NULL,
          request_id TEXT NOT NULL REFERENCES approval_requests(id),
          action TEXT NOT NULL,
          operator_id TEXT NOT NULL REFERENCES members(id),
          previous_status TEXT,
          new_status TEXT,
          note TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_histories(request_id);
        CREATE INDEX IF NOT EXISTS idx_approval_history_operator ON approval_histories(operator_id);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create approval_histories table:', err);
    }
  }

  if (!tableNames.includes('approval_strategies')) {
    try {
      console.log('[TeamClaw] Creating "approval_strategies" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS approval_strategies (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL UNIQUE,
          strategy TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create approval_strategies table:', err);
    }
  }

  // ===== v3.0 SkillHub: Skill 管理表 =====
  if (!tableNames.includes('skills')) {
    try {
      console.log('[TeamClaw] Creating "skills" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY NOT NULL,
          skill_key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          version TEXT DEFAULT '1.0.0',
          category TEXT,
          source TEXT NOT NULL DEFAULT 'unknown',
          sop_template_id TEXT,
          sop_template_version TEXT,
          sop_update_available INTEGER DEFAULT 0,
          skill_md TEXT,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          trust_status TEXT NOT NULL DEFAULT 'pending',
          is_sensitive INTEGER DEFAULT 0,
          sensitivity_note TEXT,
          external_published INTEGER DEFAULT 0,
          external_url TEXT,
          external_published_at INTEGER,
          status TEXT NOT NULL DEFAULT 'draft',
          skill_path TEXT,
          installed_agents TEXT DEFAULT '[]',
          discovered_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_skills_skill_key ON skills(skill_key);
        CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
        CREATE INDEX IF NOT EXISTS idx_skills_trust_status ON skills(trust_status);
        CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
        CREATE INDEX IF NOT EXISTS idx_skills_created_by ON skills(created_by);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create skills table:', err);
    }
  }

  // ===== v3.0 SkillHub: skills 表 created_by 字段迁移 =====
  if (tableNames.includes('skills')) {
    try {
      const skillCols = sqlite.prepare("PRAGMA table_info('skills')").all() as { name: string }[];
      const skillColNames = skillCols.map(c => c.name);
      
      if (!skillColNames.includes('created_by')) {
        console.log('[TeamClaw] Adding created_by column to skills table for user isolation...');
        sqlite.exec('ALTER TABLE skills ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL');
        sqlite.exec('CREATE INDEX IF NOT EXISTS idx_skills_created_by ON skills(created_by)');
        
        // 数据迁移：将现有 skills 关联到 admin 用户
        const adminUser = sqlite.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
        if (adminUser) {
          const result = sqlite.prepare("UPDATE skills SET created_by = ? WHERE created_by IS NULL").run(adminUser.id);
          console.log(`[TeamClaw] Migrated ${result.changes} existing skills to admin user (${adminUser.id})`);
        }
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate skills.created_by:', err);
    }
  }

  // ===== v3.0 SkillHub: skills 表 SOP 关联字段迁移 =====
  if (tableNames.includes('skills')) {
    try {
      const skillCols = sqlite.prepare("PRAGMA table_info('skills')").all() as { name: string }[];
      const skillColNames = skillCols.map(c => c.name);
      
      if (!skillColNames.includes('sop_template_version')) {
        console.log('[TeamClaw] Adding sop_template_version column to skills table...');
        sqlite.exec('ALTER TABLE skills ADD COLUMN sop_template_version TEXT');
      }
      
      if (!skillColNames.includes('sop_update_available')) {
        console.log('[TeamClaw] Adding sop_update_available column to skills table...');
        sqlite.exec('ALTER TABLE skills ADD COLUMN sop_update_available INTEGER DEFAULT 0');
      }
      
      if (!skillColNames.includes('skill_md')) {
        console.log('[TeamClaw] Adding skill_md column to skills table...');
        sqlite.exec('ALTER TABLE skills ADD COLUMN skill_md TEXT');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate skills SOP columns:', err);
    }
  }

  // ===== v3.0 SkillHub: skill_trust_records 表列迁移 =====
  if (tableNames.includes('skill_trust_records')) {
    try {
      const trustCols = sqlite.prepare("PRAGMA table_info('skill_trust_records')").all() as { name: string }[];
      const trustColNames = trustCols.map(c => c.name);
      
      if (!trustColNames.includes('operated_by')) {
        console.log('[TeamClaw] Adding operated_by column to skill_trust_records table...');
        sqlite.exec('ALTER TABLE skill_trust_records ADD COLUMN operated_by TEXT');
      }
      
      if (!trustColNames.includes('operated_at')) {
        console.log('[TeamClaw] Adding operated_at column to skill_trust_records table...');
        sqlite.exec('ALTER TABLE skill_trust_records ADD COLUMN operated_at INTEGER');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to migrate skill_trust_records columns:', err);
    }
  }

  // ===== v3.0 SkillHub: 修复 approval_requests 错误的外键约束 =====
  if (tableNames.includes('approval_requests')) {
    try {
      // 检查是否有外键约束问题（requester_id 引用了 members 而非 users）
      const fkList = sqlite.prepare("PRAGMA foreign_key_list('approval_requests')").all() as { from: string; table: string }[];
      const hasWrongFk = fkList.some(fk => fk.from === 'requester_id' && fk.table === 'members');
      
      if (hasWrongFk) {
        console.log('[TeamClaw] Fixing approval_requests foreign key constraint...');
        // SQLite 不支持删除外键，需要重建表
        sqlite.exec(`
          BEGIN TRANSACTION;
          
          -- 创建新表（无外键约束）
          CREATE TABLE approval_requests_new (
            id TEXT PRIMARY KEY NOT NULL,
            type TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            requester_id TEXT NOT NULL,
            payload TEXT,
            request_note TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            approved_by TEXT,
            rejected_by TEXT,
            approval_note TEXT,
            rejection_note TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            processed_at INTEGER,
            expires_at INTEGER
          );
          
          -- 复制数据
          INSERT INTO approval_requests_new SELECT * FROM approval_requests;
          
          -- 删除旧表
          DROP TABLE approval_requests;
          
          -- 重命名新表
          ALTER TABLE approval_requests_new RENAME TO approval_requests;
          
          -- 重建索引
          CREATE INDEX idx_approval_type_status ON approval_requests(type, status);
          CREATE INDEX idx_approval_resource ON approval_requests(resource_type, resource_id);
          CREATE INDEX idx_approval_requester ON approval_requests(requester_id);
          CREATE INDEX idx_approval_status ON approval_requests(status);
          
          COMMIT;
        `);
        console.log('[TeamClaw] approval_requests foreign key fixed successfully');
      }
    } catch (err) {
      console.error('[TeamClaw] Failed to fix approval_requests foreign key:', err);
    }
  }

  if (!tableNames.includes('skill_snapshots')) {
    try {
      console.log('[TeamClaw] Creating "skill_snapshots" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS skill_snapshots (
          id TEXT PRIMARY KEY NOT NULL,
          skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          files TEXT NOT NULL DEFAULT '[]',
          risk_metrics TEXT,
          captured_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_skill_snapshots_skill ON skill_snapshots(skill_id);
        CREATE INDEX IF NOT EXISTS idx_skill_snapshots_agent ON skill_snapshots(agent_id);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create skill_snapshots table:', err);
    }
  }

  if (!tableNames.includes('skill_trust_records')) {
    try {
      console.log('[TeamClaw] Creating "skill_trust_records" table (v3.0 SkillHub)...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS skill_trust_records (
          id TEXT PRIMARY KEY NOT NULL,
          skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          note TEXT,
          operated_by TEXT NOT NULL,
          operated_at INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_skill_trust_skill ON skill_trust_records(skill_id);
        CREATE INDEX IF NOT EXISTS idx_skill_trust_agent ON skill_trust_records(agent_id);
      `);
    } catch (err) {
      console.error('[TeamClaw] Failed to create skill_trust_records table:', err);
    }
  }

  // ===== UUID → Base58 ID 迁移 =====
  migrateUuidToBase58(sqlite);

} // end of initialization guard

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema });

// 导出底层 better-sqlite3 实例（供 debug 路由等原生 SQL 查询使用）
export { sqlite };

// 导出 schema
export * from './schema';

