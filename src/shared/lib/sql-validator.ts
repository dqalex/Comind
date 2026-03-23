/**
 * SQL 白名单验证工具
 * 
 * 用于防止 SQL 注入攻击，确保所有动态 SQL 查询使用的表名和列名都在白名单中
 */

// 使用内联 logger 避免循环依赖
const debug = process.env.NODE_ENV === 'development';

// 允许的表名白名单（与 schema.ts 中定义的表保持一致）
export const ALLOWED_TABLES = [
  'projects',
  'members',
  'tasks',
  'milestones',
  'task_logs',
  'task_comments',
  'documents',
  'openclaw_status',
  'scheduled_tasks',
  'scheduled_task_history',
  'deliveries',
  'chat_sessions',
  'chat_messages',
  'openclaw_workspaces',
  'openclaw_files',
  'openclaw_versions',
  'openclaw_conflicts',
  'audit_logs',
  'sop_templates',
  'render_templates',
  'users',
  'user_mcp_tokens',
  'sop_stage_records',
  'activity_logs',
  'project_members',
  'landing_pages',
  'gateway_configs',
  'agent_mcp_tokens',
] as const;

// 允许的列名白名单（按表组织）
export const ALLOWED_COLUMNS: Record<string, string[]> = {
  projects: ['id', 'name', 'description', 'source', 'owner_id', 'visibility', 'created_at', 'updated_at'],
  members: ['id', 'name', 'type', 'email', 'avatar', 'online', 'openclaw_name', 'openclaw_deploy_mode', 
    'openclaw_endpoint', 'openclaw_connection_status', 'openclaw_last_heartbeat', 'openclaw_gateway_url',
    'openclaw_agent_id', 'openclaw_api_token', 'openclaw_model', 'openclaw_enable_web_search',
    'openclaw_temperature', 'config_source', 'execution_mode', 'experience_task_count',
    'experience_task_types', 'experience_tools', 'user_id', 'created_at', 'updated_at'],
  tasks: ['id', 'title', 'description', 'project_id', 'milestone_id', 'source', 'assignees', 'creator_id',
    'status', 'progress', 'priority', 'deadline', 'check_items', 'attachments', 'parent_task_id',
    'cross_projects', 'sop_template_id', 'current_stage_id', 'stage_history', 'sop_inputs', 'created_at', 'updated_at'],
  documents: ['id', 'title', 'content', 'project_id', 'project_tags', 'source', 'external_platform',
    'external_id', 'external_url', 'mcp_server', 'last_sync', 'sync_mode', 'links', 'backlinks',
    'type', 'render_mode', 'render_template_id', 'html_content', 'slot_data', 'created_at', 'updated_at'],
  users: ['id', 'email', 'name', 'avatar', 'role', 'team_id', 'password_hash', 'security_code_hash',
    'email_verified', 'preferences', 'last_login_at', 'locked_until', 'created_at', 'updated_at'],
  deliveries: ['id', 'member_id', 'task_id', 'document_id', 'title', 'description', 'platform',
    'external_url', 'external_id', 'status', 'reviewer_id', 'reviewed_at', 'review_comment',
    'version', 'previous_delivery_id', 'source', 'created_at', 'updated_at'],
  chat_sessions: ['id', 'member_id', 'member_name', 'title', 'conversation_id', 'entity_type',
    'entity_id', 'entity_title', 'user_id', 'created_at', 'updated_at'],
  chat_messages: ['id', 'session_id', 'role', 'content', 'status', 'created_at'],
  gateway_configs: ['id', 'name', 'url', 'encrypted_token', 'mode', 'status', 'last_connected_at',
    'last_error', 'reconnect_attempts', 'last_heartbeat', 'is_default', 'created_at', 'updated_at'],
  sop_templates: ['id', 'name', 'description', 'category', 'icon', 'status', 'version', 'stages', 'required_tools',
    'system_prompt', 'knowledge_config', 'output_config', 'quality_checklist', 'references', 'scripts',
    'is_builtin', 'project_id', 'created_by', 'created_at', 'updated_at'],
  render_templates: ['id', 'name', 'description', 'category', 'status', 'html_template', 'md_template',
    'css_template', 'slots', 'sections', 'export_config', 'thumbnail', 'is_builtin', 'created_by',
    'created_at', 'updated_at'],
  milestones: ['id', 'title', 'description', 'project_id', 'status', 'due_date', 'sort_order', 'created_at', 'updated_at'],
  task_logs: ['id', 'task_id', 'action', 'message', 'timestamp'],
  task_comments: ['id', 'task_id', 'member_id', 'content', 'created_at', 'updated_at'],
  openclaw_workspaces: ['id', 'member_id', 'name', 'path', 'is_default', 'sync_enabled', 'watch_enabled',
    'sync_interval', 'exclude_patterns', 'last_sync_at', 'sync_status', 'last_error', 'created_at', 'updated_at'],
  openclaw_files: ['id', 'workspace_id', 'document_id', 'relative_path', 'file_type', 'hash', 'content_hash',
    'version', 'base_hash', 'title', 'category', 'tags', 'related_task_id', 'related_project',
    'opportunity_score', 'confidence', 'doc_status', 'sync_status', 'sync_direction', 'file_modified_at',
    'synced_at', 'created_at', 'updated_at'],
  scheduled_tasks: ['id', 'member_id', 'title', 'description', 'task_type', 'schedule_type', 'schedule_time',
    'schedule_days', 'next_run_at', 'config', 'enabled', 'last_run_at', 'last_run_status', 'last_run_result',
    'created_at', 'updated_at'],
  audit_logs: ['id', 'source', 'member_id', 'agent_id', 'gateway_url', 'api_token_hash', 'action', 'params',
    'success', 'result', 'error', 'session_key', 'request_id', 'duration_ms', 'created_at'],
  activity_logs: ['id', 'user_id', 'member_id', 'source', 'source_detail', 'module', 'resource_type',
    'resource_id', 'resource_title', 'action', 'action_detail', 'changes', 'success', 'error',
    'project_id', 'request_id', 'ip_address', 'user_agent', 'duration_ms', 'created_at'],
  project_members: ['id', 'project_id', 'user_id', 'role', 'created_at'],
  landing_pages: ['id', 'locale', 'title', 'content', 'render_template_id', 'meta_title', 'meta_description',
    'status', 'created_at', 'updated_at'],
};

// SQL 标识符正则表达式（只允许字母、数字和下划线，且必须以字母或下划线开头）
const SQL_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * 验证表名是否合法
 * @param tableName 表名
 * @returns 验证通过的表名
 * @throws 如果表名不合法则抛出错误
 */
export function validateTableName(tableName: string): string {
  // 1. 格式验证
  if (!SQL_IDENTIFIER_REGEX.test(tableName)) {
    if (debug) console.error(`[SQL] Invalid table name format: ${tableName}`);
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  
  // 2. 白名单验证
  if (!ALLOWED_TABLES.includes(tableName as typeof ALLOWED_TABLES[number])) {
    if (debug) console.error(`[SQL] Table not in whitelist: ${tableName}`);
    throw new Error(`Table not in whitelist: ${tableName}`);
  }
  
  return tableName;
}

/**
 * 验证列名是否合法
 * @param tableName 表名
 * @param columnName 列名
 * @returns 验证通过的列名
 * @throws 如果列名不合法则抛出错误
 */
export function validateColumnName(tableName: string, columnName: string): string {
  // 1. 先验证表名
  validateTableName(tableName);
  
  // 2. 格式验证
  if (!SQL_IDENTIFIER_REGEX.test(columnName)) {
    if (debug) console.error(`[SQL] Invalid column name format: ${columnName}`);
    throw new Error(`Invalid column name format: ${columnName}`);
  }
  
  // 3. 白名单验证（如果该表有定义列白名单）
  const allowedCols = ALLOWED_COLUMNS[tableName];
  if (allowedCols && !allowedCols.includes(columnName)) {
    if (debug) console.error(`[SQL] Column not in whitelist: ${tableName}.${columnName}`);
    throw new Error(`Column not in whitelist: ${tableName}.${columnName}`);
  }
  
  return columnName;
}

/**
 * 安全地执行 PRAGMA table_info 查询
 * @param sqlite better-sqlite3 实例
 * @param tableName 表名
 * @returns 列信息数组
 */
export function safeTableInfo(
  sqlite: { prepare: (sql: string) => { all: () => unknown[] } },
  tableName: string
): { name: string }[] {
  const safeTable = validateTableName(tableName);
  return sqlite.prepare(`PRAGMA table_info(${safeTable})`).all() as { name: string }[];
}

/**
 * 安全地执行 SELECT COUNT(*) 查询
 * @param sqlite better-sqlite3 实例
 * @param tableName 表名
 * @returns 记录数量
 */
export function safeCount(
  sqlite: { prepare: (sql: string) => { get: () => unknown } },
  tableName: string
): number {
  const safeTable = validateTableName(tableName);
  const result = sqlite.prepare(`SELECT COUNT(*) as cnt FROM ${safeTable}`).get() as { cnt: number };
  return result.cnt;
}

/**
 * 批量验证表名
 * @param tableNames 表名数组
 * @returns 验证通过的表名数组
 */
export function validateTableNames(tableNames: string[]): string[] {
  return tableNames.map(validateTableName);
}

/**
 * 检查表名是否在白名单中（不抛出错误）
 * @param tableName 表名
 * @returns 是否在白名单中
 */
export function isValidTableName(tableName: string): boolean {
  return SQL_IDENTIFIER_REGEX.test(tableName) && 
    ALLOWED_TABLES.includes(tableName as typeof ALLOWED_TABLES[number]);
}

/**
 * 检查列名是否在白名单中（不抛出错误）
 * @param tableName 表名
 * @param columnName 列名
 * @returns 是否在白名单中
 */
export function isValidColumnName(tableName: string, columnName: string): boolean {
  if (!isValidTableName(tableName)) return false;
  if (!SQL_IDENTIFIER_REGEX.test(columnName)) return false;
  
  const allowedCols = ALLOWED_COLUMNS[tableName];
  if (!allowedCols) return true; // 如果该表没有定义列白名单，则只验证格式
  
  return allowedCols.includes(columnName);
}
