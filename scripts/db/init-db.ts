/**
 * 数据库初始化脚本
 * 用于创建包含内置文档的初始化数据库
 * 
 * 使用方法：
 *   npx tsx scripts/init-db.ts
 * 
 * 输出：
 *   data/init/teamclaw-init.db - 包含内置文档的初始化数据库
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import { BUILTIN_SOP_TEMPLATES, BUILTIN_RENDER_TEMPLATES } from '../../db/templates';
import { rtLandingPage } from '../../db/templates/render/rt-landing-page';
// 使用简单的 ID 生成函数
function generateSimpleId(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 内置文档定义
const BUILTIN_DOCS = [
  {
    id: 'VrihWxkCoM9Q',
    title: '用户使用手册',
    type: 'guide',
    source: 'local' as const,
    description: 'TeamClaw 用户使用指南',
  },
  {
    id: 'JzbpWix9BUnf', 
    title: '开发者手册',
    type: 'guide',
    source: 'local' as const,
    description: 'TeamClaw 开发者指南',
  },
  {
    id: 'FtmyZ2zMsm1c',
    title: 'API 文档',
    type: 'reference',
    source: 'local' as const,
    description: 'TeamClaw API 参考文档',
  },
];

// 数据库 Schema SQL（与 db/index.ts 保持一致的 v3 完整 Schema）
const SCHEMA_SQL = `
-- v3.0: 用户表（必须在 projects/members 之前创建，因为有外键引用）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  avatar TEXT, role TEXT NOT NULL DEFAULT 'member', team_id TEXT,
  password_hash TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0,
  preferences TEXT DEFAULT '{}', last_login_at INTEGER, locked_until INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'human',
  email TEXT, avatar TEXT, online INTEGER DEFAULT 0,
  openclaw_name TEXT, openclaw_deploy_mode TEXT, openclaw_endpoint TEXT,
  openclaw_connection_status TEXT, openclaw_last_heartbeat INTEGER,
  openclaw_gateway_url TEXT, openclaw_agent_id TEXT, openclaw_api_token TEXT,
  openclaw_model TEXT, openclaw_enable_web_search INTEGER DEFAULT 0, openclaw_temperature REAL,
  config_source TEXT DEFAULT 'manual', execution_mode TEXT DEFAULT 'chat_only',
  experience_task_count INTEGER DEFAULT 0, experience_task_types TEXT, experience_tools TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT,
  project_id TEXT REFERENCES projects(id), milestone_id TEXT, source TEXT NOT NULL DEFAULT 'local',
  assignees TEXT NOT NULL DEFAULT '[]', creator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo', progress INTEGER DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium', deadline INTEGER,
  check_items TEXT DEFAULT '[]', attachments TEXT DEFAULT '[]',
  parent_task_id TEXT, cross_projects TEXT DEFAULT '[]',
  sop_template_id TEXT, current_stage_id TEXT, stage_history TEXT DEFAULT '[]', sop_inputs TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id), status TEXT NOT NULL DEFAULT 'open',
  due_date INTEGER, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS task_logs (
  id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id),
  action TEXT NOT NULL, message TEXT NOT NULL, timestamp INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id),
  member_id TEXT NOT NULL, content TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, content TEXT,
  project_id TEXT REFERENCES projects(id), project_tags TEXT DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'local', external_platform TEXT, external_id TEXT,
  external_url TEXT, mcp_server TEXT, last_sync INTEGER, sync_mode TEXT,
  links TEXT DEFAULT '[]', backlinks TEXT DEFAULT '[]', type TEXT NOT NULL DEFAULT 'note',
  render_mode TEXT DEFAULT 'markdown', render_template_id TEXT, html_content TEXT, slot_data TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL REFERENCES members(id),
  task_id TEXT REFERENCES tasks(id), document_id TEXT REFERENCES documents(id),
  title TEXT NOT NULL, description TEXT, platform TEXT NOT NULL,
  external_url TEXT, external_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT REFERENCES members(id), reviewed_at INTEGER, review_comment TEXT,
  version INTEGER DEFAULT 1, previous_delivery_id TEXT, source TEXT NOT NULL DEFAULT 'local',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL, member_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '新对话', conversation_id TEXT,
  entity_type TEXT, entity_id TEXT, entity_title TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL, content TEXT NOT NULL, status TEXT DEFAULT 'sent',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom', icon TEXT DEFAULT 'clipboard-list',
  status TEXT NOT NULL DEFAULT 'active', stages TEXT NOT NULL DEFAULT '[]',
  required_tools TEXT DEFAULT '[]', system_prompt TEXT DEFAULT '',
  knowledge_config TEXT, output_config TEXT, quality_checklist TEXT DEFAULT '[]',
  is_builtin INTEGER NOT NULL DEFAULT 0, project_id TEXT REFERENCES projects(id),
  created_by TEXT NOT NULL DEFAULT 'system', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS render_templates (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom', status TEXT NOT NULL DEFAULT 'active',
  html_template TEXT NOT NULL DEFAULT '', md_template TEXT NOT NULL DEFAULT '',
  css_template TEXT, slots TEXT NOT NULL DEFAULT '{}', sections TEXT NOT NULL DEFAULT '[]',
  export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}', thumbnail TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

-- v3.0: 用户 MCP Token 表
CREATE TABLE IF NOT EXISTS user_mcp_tokens (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL, encrypted_token TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '', permissions TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active', last_used_at INTEGER,
  expires_at INTEGER, created_at INTEGER NOT NULL
);

-- v3.0: 项目成员表（协作权限）
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, user_id)
);

-- v3.0: 活动日志表
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id), member_id TEXT REFERENCES members(id),
  source TEXT NOT NULL, source_detail TEXT,
  module TEXT NOT NULL, resource_type TEXT NOT NULL,
  resource_id TEXT, resource_title TEXT,
  action TEXT NOT NULL, action_detail TEXT,
  changes TEXT, success INTEGER NOT NULL DEFAULT 1, error TEXT,
  project_id TEXT, request_id TEXT, ip_address TEXT, user_agent TEXT, duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_deliveries_member_id ON deliveries(member_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON deliveries(task_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_member_id ON chat_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);
CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);

-- v3.0: 首页内容表（独立于 documents，用于公开 API）
CREATE TABLE IF NOT EXISTS landing_pages (
  id TEXT PRIMARY KEY NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en', 'zh')),
  title TEXT NOT NULL,
  content TEXT,
  rendered_html TEXT,
  render_template_id TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

function readDocContent(filename: string): string {
  const docPath = join(process.cwd(), filename);
  if (existsSync(docPath)) {
    return readFileSync(docPath, 'utf-8');
  }
  console.warn(`警告: 文档文件不存在: ${filename}`);
  return `# ${filename}\n\n文档内容未找到。请访问 /wiki 页面查看最新版本。`;
}

function main() {
  const outputDir = join(process.cwd(), 'data/init');
  const outputPath = join(outputDir, 'teamclaw-init.db');

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 删除旧的初始化数据库
  if (existsSync(outputPath)) {
    rmSync(outputPath);
    console.log('已删除旧的初始化数据库');
  }

  // 创建新数据库
  const db = new Database(outputPath);
  
  // 启用 WAL 模式和外键约束
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 创建表结构
  db.exec(SCHEMA_SQL);
  console.log('已创建数据库表结构');

  // Drizzle mode:timestamp expects seconds, not milliseconds
  const now = Math.floor(Date.now() / 1000);
  // v3.0: 不再创建默认用户，用户通过 /login 页面注册
  // 第一个注册的用户自动成为 admin，同时自动创建关联的 member 记录
  console.log('v3.0 多用户系统：用户通过 /login 注册，无预置用户');

  // 插入内置文档
  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, content, type, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const docFiles: Record<string, string> = {
    '用户使用手册': 'docs/product/USER_GUIDE.md',
    '开发者手册': 'docs/technical/DEVELOPMENT.md',
    'API 文档': 'docs/technical/API.md',
  };

  for (const doc of BUILTIN_DOCS) {
    const content = readDocContent(docFiles[doc.title] || '');
    insertDoc.run(doc.id, doc.title, content, doc.type, doc.source, now, now);
    console.log(`已插入文档: ${doc.title} (${doc.id})`);
  }

  // 插入内置 SOP 模板
  if (BUILTIN_SOP_TEMPLATES.length > 0) {
    const insertSop = db.prepare(
      `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of BUILTIN_SOP_TEMPLATES) {
      insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
    }
    console.log(`已插入 ${BUILTIN_SOP_TEMPLATES.length} 个内置 SOP 模板`);
  }

  // 插入内置渲染模板
  if (BUILTIN_RENDER_TEMPLATES.length > 0) {
    const insertRt = db.prepare(
      `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of BUILTIN_RENDER_TEMPLATES) {
      insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
    }
    console.log(`已插入 ${BUILTIN_RENDER_TEMPLATES.length} 个内置渲染模板`);
  }

  // 插入内置首页内容（使用 rtLandingPage 模板）
  const landingPages = [
    { id: 'landing-en', locale: 'en', title: 'Home (English)', content: rtLandingPage.mdTemplate },
    { id: 'landing-zh', locale: 'zh', title: '首页（中文）', content: rtLandingPage.mdTemplate },
  ];
  const insertLanding = db.prepare(`
    INSERT OR IGNORE INTO landing_pages (id, locale, title, content, render_template_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const lp of landingPages) {
    insertLanding.run(lp.id, lp.locale, lp.title, lp.content, rtLandingPage.id, 'published', now, now);
  }
  console.log(`已插入 ${landingPages.length} 个内置首页内容`);

  // 导入 blog 目录下的文档
  const blogDir = join(process.cwd(), 'docs', 'blog');
  if (existsSync(blogDir)) {
    const blogFiles = readdirSync(blogDir)
      .filter(f => extname(f) === '.md')
      .map(f => ({
        name: f,
        path: join(blogDir, f),
        // Drizzle mode:timestamp expects seconds, not milliseconds
        mtime: Math.floor(statSync(join(blogDir, f)).mtime.getTime() / 1000),
      }))
      .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序（最新的在前）

    if (blogFiles.length > 0) {
      console.log(`\n开始导入 ${blogFiles.length} 个 blog 文档...`);
      
      for (const blogFile of blogFiles) {
        const content = readFileSync(blogFile.path, 'utf-8');
        // 从内容中提取标题（第一行 # 标题）
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : basename(blogFile.name, '.md');
        const id = generateSimpleId();
        
        insertDoc.run(id, title, content, 'blog', 'local', blogFile.mtime, blogFile.mtime);
        console.log(`  ✓ 已导入博客: ${title} (${id})`);
      }
      
      console.log(`✓ Blog 文档导入完成（按时间降序排列）`);
    }
  }

  // 关闭数据库
  db.close();

  console.log(`\n初始化数据库已创建: ${outputPath}`);
  console.log('\n包含的内置文档:');
  BUILTIN_DOCS.forEach(doc => {
    console.log(`  - ${doc.title}: /wiki?doc=${doc.id}`);
  });

  console.log('\n使用方法:');
  console.log('  1. GitHub 发布时包含 data/init/teamclaw-init.db');
  console.log('  2. 部署时复制到 data/teamclaw.db: cp data/init/teamclaw-init.db data/teamclaw.db');
  console.log('  3. 或首次启动时自动检测并使用');
}

main();
