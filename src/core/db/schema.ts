import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 项目表
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  source: text('source', { enum: ['local', 'openclaw'] }).notNull().default('local'),
  // v3.0: 项目权限字段
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  visibility: text('visibility', { enum: ['private', 'team', 'public'] }).notNull().default('private'),
  // v3.1: 知识库配置（复用 SOP 的 KnowledgeConfig）
  knowledgeConfig: text('knowledge_config', { mode: 'json' }).$type<KnowledgeConfig>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 成员表
export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['human', 'ai'] }).notNull().default('human'),
  email: text('email'),
  avatar: text('avatar'),
  online: integer('online', { mode: 'boolean' }).default(false),
  // 关联认证用户（人类成员专用，v3.0 新增）
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  // OpenClaw 配置（AI 成员专用）
  openclawName: text('openclaw_name'),
  openclawDeployMode: text('openclaw_deploy_mode', { enum: ['cloud', 'local', 'knot'] }),
  openclawEndpoint: text('openclaw_endpoint'),
  openclawConnectionStatus: text('openclaw_connection_status', { enum: ['connected', 'disconnected', 'error'] }),
  openclawLastHeartbeat: integer('openclaw_last_heartbeat', { mode: 'timestamp' }),
  // Gateway 关联（暂时使用 URL + agentId，后续需要改进为更可靠的标识）
  openclawGatewayUrl: text('openclaw_gateway_url'),
  openclawAgentId: text('openclaw_agent_id'),
  openclawApiToken: text('openclaw_api_token'),
  openclawModel: text('openclaw_model'),
  openclawEnableWebSearch: integer('openclaw_enable_web_search', { mode: 'boolean' }).default(false),
  openclawTemperature: real('openclaw_temperature'),
  
  configSource: text('config_source', { enum: ['manual', 'self'] }).default('manual'),
  executionMode: text('execution_mode', { enum: ['chat_only', 'api_first', 'api_only'] }).default('chat_only'),
  
  experienceTaskCount: integer('experience_task_count').default(0),
  experienceTaskTypes: text('experience_task_types', { mode: 'json' }).$type<string[]>(),
  experienceTools: text('experience_tools', { mode: 'json' }).$type<string[]>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============================================================
// SOP 引擎相关类型
// ============================================================

// 检查项类型（v3.0 扩展）
export type CheckItem = {
  id: string;
  text: string;
  completed: boolean;
  // === v3.0 新增 ===
  sopStageId?: string;     // 关联的 SOP 阶段 ID（null = 手动创建的普通检查项）
  source?: 'manual' | 'sop_stage' | 'sop_quality';  // 来源标识
};

// SOP 阶段类型
export type StageType =
  | 'input'            // 等待人工输入（上传文件、填写信息）
  | 'ai_auto'          // AI 自动执行，完成后自动推进
  | 'ai_with_confirm'  // AI 执行后暂停，等人工确认/修改
  | 'manual'           // 纯人工操作
  | 'render'           // 进入 Content Studio 可视化编辑
  | 'export'           // 导出阶段
  | 'review';          // 提交交付审核

// SOP 阶段产出类型
export type StageOutputType = 'text' | 'markdown' | 'html' | 'data' | 'file';

// SOP 阶段输入定义
export type InputDef = {
  id: string;                    // 输入项唯一标识，在 promptTemplate 中用 {{inputs.id}} 引用
  label: string;
  type: 'text' | 'textarea' | 'file' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];            // type=select 时的选项
};

// SOP 阶段定义
export type SOPStage = {
  id: string;                    // 阶段唯一 ID
  label: string;                 // "数据收集"、"初稿撰写"
  description?: string;          // 阶段说明（可选）
  type: StageType;
  // AI 指令
  promptTemplate?: string;       // 该阶段的 AI 指令（Mustache 模板）
  // 交互配置
  requiredInputs?: InputDef[];   // type=input 时，需要用户提供的输入
  confirmMessage?: string;       // type=ai_with_confirm 时的确认提示
  // 输出定义
  outputType?: StageOutputType;  // 阶段产出类型
  outputLabel?: string;          // "分析结果"、"初稿"
  // 知识库层级
  knowledgeLayers?: string[];    // 该阶段需读取的知识库层级 ["L1", "L2"]
  // Content Studio 配置（type=render 时使用）
  renderTemplateId?: string;     // 关联的渲染模板 ID
  // 可选配置
  optional?: boolean;            // 是否可跳过
  estimatedMinutes?: number;     // 预估耗时
  rollbackStageId?: string;      // review 驳回时回退到的阶段 ID（默认上一阶段）
};

// SOP 阶段执行记录
export type StageRecord = {
  stageId: string;
  status: 'pending' | 'active' | 'waiting_input' | 'waiting_confirm' | 'completed' | 'skipped' | 'failed';
  startedAt?: string;
  completedAt?: string;
  output?: string;               // 阶段产出（文本/文档 ID/文件路径）
  outputType?: StageOutputType;
  confirmedBy?: string;          // 确认者 memberId
  retryCount?: number;
  renderDocumentId?: string;     // type=render 时自动创建的文档 ID
};

// SOP 分类
export type SOPCategory =
  | 'content'      // 内容制作（案例、文章、报告）
  | 'analysis'     // 数据分析（诊断、评估）
  | 'research'     // 调研（竞品、市场、用户）
  | 'development'  // 开发（功能实现、Bug 修复）
  | 'operations'   // 运营（周报、月报、复盘）
  | 'media'        // 多媒体制作（视频、音频、图形）
  | 'custom';      // 自定义

// SOP 输出类型
export type OutputType = 'markdown' | 'html' | 'both';

// SOP 知识库配置
export type KnowledgeConfig = {
  documentId?: string;         // 关联 Wiki 文档作为知识库
  layers?: string[];           // 分层读取规则
};

// SOP 输出配置
export type OutputConfig = {
  type: OutputType;            // 产出物类型
  renderTemplateId?: string;   // 关联可视化渲染模板
};

// ============================================================
// SOP 外挂文件类型（v3.1 新增）
// ============================================================

/** 参考文档文件类型 */
export type ReferenceType = 'template' | 'guide' | 'example' | 'doc';

/** 参考文档文件 */
export type ReferenceFile = {
  id: string;
  filename: string;           // 文件名，如 'task-push-template.md'
  title: string;              // 显示标题，如 '任务推送模板'
  description?: string;       // 简短描述
  content: string;            // 文件内容（Markdown）
  type: ReferenceType;        // 文件类型
  createdAt: string;          // ISO 8601 格式
  updatedAt: string;
};

/** 脚本文件类型 */
export type ScriptType = 'bash' | 'python' | 'node' | 'other';

/** 脚本文件 */
export type ScriptFile = {
  id: string;
  filename: string;           // 文件名，如 'mcp-call.sh'
  description?: string;       // 简短描述
  content: string;            // 脚本内容
  type: ScriptType;           // 脚本类型
  executable: boolean;        // 是否可执行
  createdAt: string;          // ISO 8601 格式
  updatedAt: string;
};

// 渲染模板槽位定义
export type SlotDef = {
  label: string;
  type: 'content' | 'image' | 'data' | 'text' | 'richtext';
  description?: string;
  placeholder?: string;
};

// 渲染模板区块定义
export type SectionDef = {
  id: string;
  label: string;
  slots: string[];               // 包含的 slot ID 列表
};

// 导出预设
export type ExportPreset = {
  formats: ('jpg' | 'png' | 'html' | 'pdf')[];
  defaultWidth?: number;
  defaultScale?: number;
  mode?: '16:9' | 'long' | 'a4' | 'custom';
};

// 任务表
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  projectId: text('project_id').references(() => projects.id),
  milestoneId: text('milestone_id'),
  source: text('source', { enum: ['local', 'openclaw'] }).notNull().default('local'),
  assignees: text('assignees', { mode: 'json' }).$type<string[]>().notNull().default([]),
  creatorId: text('creator_id').notNull(),
  status: text('status', { enum: ['todo', 'in_progress', 'reviewing', 'completed'] }).notNull().default('todo'),
  progress: integer('progress').default(0),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
  deadline: integer('deadline', { mode: 'timestamp' }),
  checkItems: text('check_items', { mode: 'json' }).$type<CheckItem[]>().default([]),
  attachments: text('attachments', { mode: 'json' }).$type<string[]>().default([]),
  parentTaskId: text('parent_task_id'),
  crossProjects: text('cross_projects', { mode: 'json' }).$type<string[]>().default([]),
  // === v3.0 SOP 字段 ===
  sopTemplateId: text('sop_template_id'),        // 关联 SOP 模板（null=普通任务）
  currentStageId: text('current_stage_id'),      // 当前阶段 ID
  stageHistory: text('stage_history', { mode: 'json' }).$type<StageRecord[]>().default([]),
  sopInputs: text('sop_inputs', { mode: 'json' }).$type<Record<string, unknown>>(), // 用户在 input 阶段提供的数据
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 看板过滤最常用查询：按项目和状态筛选
  projectStatusIdx: index('idx_tasks_project_status').on(table.projectId, table.status),
  // SOP 模板关联查询
  sopTemplateIdx: index('idx_tasks_sop_template').on(table.sopTemplateId),
  // 创建者查询
  creatorIdx: index('idx_tasks_creator').on(table.creatorId),
}));

// 里程碑表
export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status', { enum: ['open', 'in_progress', 'completed', 'cancelled'] }).notNull().default('open'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  sortOrder: integer('sort_order').notNull().default(0),
  // v3.1: 知识库配置（复用 SOP 的 KnowledgeConfig）
  knowledgeConfig: text('knowledge_config', { mode: 'json' }).$type<KnowledgeConfig>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 任务日志
export const taskLogs = sqliteTable('task_logs', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  action: text('action').notNull(),
  message: text('message').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// 评论表
export const comments = sqliteTable('task_comments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  memberId: text('member_id').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 文档表
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  projectId: text('project_id').references(() => projects.id),
  projectTags: text('project_tags', { mode: 'json' }).$type<string[]>().default([]),
  source: text('source', { enum: ['local', 'external', 'openclaw'] }).notNull().default('local'),
  externalPlatform: text('external_platform', { enum: ['notion', 'feishu', 'tencent-doc', 'yuque', 'google-docs', 'other'] }),
  externalId: text('external_id'),
  externalUrl: text('external_url'),
  mcpServer: text('mcp_server'),
  lastSync: integer('last_sync', { mode: 'timestamp' }),
  syncMode: text('sync_mode', { enum: ['realtime', 'cached'] }),
  links: text('links', { mode: 'json' }).$type<string[]>().default([]),
  backlinks: text('backlinks', { mode: 'json' }).$type<string[]>().default([]),
  type: text('type', { enum: ['guide', 'reference', 'report', 'note', 'decision', 'scheduled_task', 'task_list', 'blog', 'other'] }).notNull().default('note'),
  // === v3.0 Content Studio 字段 ===
  renderMode: text('render_mode', { enum: ['markdown', 'visual'] }).default('markdown'),
  renderTemplateId: text('render_template_id'),  // 关联渲染模板
  htmlContent: text('html_content'),             // HTML 内容（visual 模式下存储）
  slotData: text('slot_data', { mode: 'json' }).$type<Record<string, unknown>>(), // 槽位数据快照
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // Wiki 文档列表查询：按项目和类型筛选
  projectTypeIdx: index('idx_documents_project_type').on(table.projectId, table.type),
  // 渲染模板关联查询
  renderTemplateIdx: index('idx_documents_render_template').on(table.renderTemplateId),
}));

// OpenClaw 实时状态
export const openclawStatus = sqliteTable('openclaw_status', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id),
  status: text('status', { enum: ['idle', 'working', 'waiting', 'offline'] }).notNull().default('offline'),
  currentTaskId: text('current_task_id').references(() => tasks.id),
  currentTaskTitle: text('current_task_title'),
  currentAction: text('current_action'),
  progress: integer('progress').default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  estimatedEndAt: integer('estimated_end_at', { mode: 'timestamp' }),
  nextTaskId: text('next_task_id').references(() => tasks.id),
  nextTaskTitle: text('next_task_title'),
  queuedTasks: text('queued_tasks', { mode: 'json' }).$type<{ id: string; title: string }[]>().default([]),
  interruptible: integer('interruptible', { mode: 'boolean' }).default(true),
  doNotDisturbReason: text('do_not_disturb_reason'),
  lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 定时任务
export const scheduledTasks = sqliteTable('scheduled_tasks', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id),
  title: text('title').notNull(),
  description: text('description'),
  taskType: text('task_type', { enum: ['report', 'summary', 'backup', 'notification', 'custom'] }).notNull(),
  scheduleType: text('schedule_type', { enum: ['once', 'daily', 'weekly', 'monthly'] }).notNull(),
  scheduleTime: text('schedule_time'),
  scheduleDays: text('schedule_days', { mode: 'json' }).$type<number[]>(),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  lastRunStatus: text('last_run_status', { enum: ['success', 'failed', 'skipped'] }),
  lastRunResult: text('last_run_result'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 定时任务执行历史
export const scheduledTaskHistory = sqliteTable('scheduled_task_history', {
  id: text('id').primaryKey(),
  scheduledTaskId: text('scheduled_task_id').notNull().references(() => scheduledTasks.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['running', 'success', 'failed', 'skipped'] }).notNull(),
  result: text('result'),
  error: text('error'),
  deliverableType: text('deliverable_type', { enum: ['document', 'notification', 'data', 'none'] }),
  deliverableUrl: text('deliverable_url'),
  deliverableTitle: text('deliverable_title'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 文档交付记录
export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id),
  taskId: text('task_id').references(() => tasks.id),
  documentId: text('document_id').references(() => documents.id),
  title: text('title').notNull(),
  description: text('description'),
  platform: text('platform', { enum: ['tencent-doc', 'feishu', 'notion', 'local', 'other'] }).notNull(),
  externalUrl: text('external_url'),
  externalId: text('external_id'),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'revision_needed'] }).notNull().default('pending'),
  reviewerId: text('reviewer_id').references(() => members.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewComment: text('review_comment'),
  version: integer('version').default(1),
  previousDeliveryId: text('previous_delivery_id'),
  source: text('source', { enum: ['local', 'openclaw'] }).notNull().default('local'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 交付记录查询：按任务ID
  taskIdx: index('idx_deliveries_task').on(table.taskId),
  // 按成员查询
  memberIdx: index('idx_deliveries_member').on(table.memberId),
  // 按状态查询
  statusIdx: index('idx_deliveries_status').on(table.status),
}));

// 聊天会话表
export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  // v3.0: 用户隔离 - 每个用户只能看到自己的聊天记录
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('新对话'),
  conversationId: text('conversation_id'),
  entityType: text('entity_type', { enum: ['task', 'scheduled_task', 'project'] }),
  entityId: text('entity_id'),
  entityTitle: text('entity_title'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 聊天消息表
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => chatSessions.id),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['sending', 'sent', 'error'] }).default('sent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 消息列表查询：按会话ID获取消息
  sessionIdx: index('idx_chat_messages_session').on(table.sessionId),
  // 按时间排序
  createdIdx: index('idx_chat_messages_created').on(table.createdAt),
}));

// ============================================================
// OpenClaw 同步表
// ============================================================

// OpenClaw Workspace 表
export const openclawWorkspaces = sqliteTable('openclaw_workspaces', {
  id: text('id').primaryKey(),
  
  // 关联信息
  memberId: text('member_id').references(() => members.id),
  name: text('name').notNull(),
  
  // 路径配置
  path: text('path').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  
  // 同步配置
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).default(true),
  watchEnabled: integer('watch_enabled', { mode: 'boolean' }).default(true),
  syncInterval: integer('sync_interval').default(120),
  
  // 排除规则
  excludePatterns: text('exclude_patterns', { mode: 'json' })
    .$type<string[]>()
    .default(['node_modules/**', '.git/**', 'temp/**']),
  
  // 状态
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  syncStatus: text('sync_status').default('idle'),
  lastError: text('last_error'),
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// OpenClaw 文件表
export const openclawFiles = sqliteTable('openclaw_files', {
  id: text('id').primaryKey(),
  
  // 关联
  workspaceId: text('workspace_id')
    .references(() => openclawWorkspaces.id)
    .notNull(),
  documentId: text('document_id').references(() => documents.id),
  
  // 文件信息
  relativePath: text('relative_path').notNull(),
  fileType: text('file_type').notNull(),
  
  // 内容哈希
  hash: text('hash').notNull(),
  contentHash: text('content_hash'),
  
  // 版本控制
  version: integer('version').default(1),
  baseHash: text('base_hash'),
  
  // 元数据
  title: text('title'),
  category: text('category'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  relatedTaskId: text('related_task_id'),
  relatedProject: text('related_project'),
  opportunityScore: integer('opportunity_score'),
  confidence: text('confidence'),
  docStatus: text('doc_status'),
  
  // 同步状态
  syncStatus: text('sync_status').default('synced'),
  syncDirection: text('sync_direction'),
  
  // 时间戳
  fileModifiedAt: integer('file_modified_at', { mode: 'timestamp' }),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// OpenClaw 版本历史表
export const openclawVersions = sqliteTable('openclaw_versions', {
  id: text('id').primaryKey(),
  
  // 关联
  fileId: text('file_id')
    .references(() => openclawFiles.id)
    .notNull(),
  
  // 版本信息
  version: integer('version').notNull(),
  hash: text('hash').notNull(),
  
  // 存储策略
  storageType: text('storage_type').default('full'),
  
  // 内容
  content: text('content'),
  diffPatch: text('diff_patch'),
  
  // 元数据
  changeSummary: text('change_summary'),
  changedBy: text('changed_by'),
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 按文件ID查询版本历史
  fileIdx: index('idx_openclaw_versions_file').on(table.fileId),
}));

// OpenClaw 冲突表
export const openclawConflicts = sqliteTable('openclaw_conflicts', {
  id: text('id').primaryKey(),
  
  // 关联
  fileId: text('file_id')
    .references(() => openclawFiles.id)
    .notNull(),
  
  // 冲突信息
  localVersion: integer('local_version').notNull(),
  remoteVersion: integer('remote_version').notNull(),
  localHash: text('local_hash').notNull(),
  remoteHash: text('remote_hash').notNull(),
  
  // 内容
  localContent: text('local_content').notNull(),
  remoteContent: text('remote_content').notNull(),
  
  // 解决状态
  status: text('status').default('pending'),
  resolution: text('resolution'),
  mergedContent: text('merged_content'),
  
  // 时间戳
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

// 关系定义
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  documents: many(documents),
  milestones: many(milestones),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  sopTemplate: one(sopTemplates, { fields: [tasks.sopTemplateId], references: [sopTemplates.id] }),
  logs: many(taskLogs),
  comments: many(comments),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const taskLogsRelations = relations(taskLogs, ({ one }) => ({
  task: one(tasks, { fields: [taskLogs.taskId], references: [tasks.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
}));

export const openclawStatusRelations = relations(openclawStatus, ({ one }) => ({
  member: one(members, { fields: [openclawStatus.memberId], references: [members.id] }),
  currentTask: one(tasks, { fields: [openclawStatus.currentTaskId], references: [tasks.id] }),
  nextTask: one(tasks, { fields: [openclawStatus.nextTaskId], references: [tasks.id] }),
}));

export const scheduledTasksRelations = relations(scheduledTasks, ({ one, many }) => ({
  member: one(members, { fields: [scheduledTasks.memberId], references: [members.id] }),
  history: many(scheduledTaskHistory),
}));

export const scheduledTaskHistoryRelations = relations(scheduledTaskHistory, ({ one }) => ({
  scheduledTask: one(scheduledTasks, { fields: [scheduledTaskHistory.scheduledTaskId], references: [scheduledTasks.id] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  member: one(members, { fields: [deliveries.memberId], references: [members.id] }),
  task: one(tasks, { fields: [deliveries.taskId], references: [tasks.id] }),
  reviewer: one(members, { fields: [deliveries.reviewerId], references: [members.id] }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }),
}));

// OpenClaw 同步关系
export const openclawWorkspacesRelations = relations(openclawWorkspaces, ({ one, many }) => ({
  member: one(members, { fields: [openclawWorkspaces.memberId], references: [members.id] }),
  files: many(openclawFiles),
}));

export const openclawFilesRelations = relations(openclawFiles, ({ one, many }) => ({
  workspace: one(openclawWorkspaces, { fields: [openclawFiles.workspaceId], references: [openclawWorkspaces.id] }),
  document: one(documents, { fields: [openclawFiles.documentId], references: [documents.id] }),
  versions: many(openclawVersions),
  conflicts: many(openclawConflicts),
}));

export const openclawVersionsRelations = relations(openclawVersions, ({ one }) => ({
  file: one(openclawFiles, { fields: [openclawVersions.fileId], references: [openclawFiles.id] }),
}));

export const openclawConflictsRelations = relations(openclawConflicts, ({ one }) => ({
  file: one(openclawFiles, { fields: [openclawConflicts.fileId], references: [openclawFiles.id] }),
}));

// ============================================================
// SOP 模板表（v3.0 新增）
// ============================================================

export const sopTemplates = sqliteTable('sop_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  category: text('category', { 
    enum: ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'] 
  }).notNull().default('custom'),
  icon: text('icon').default('clipboard-list'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('active'),
  
  // 版本控制（v0.9.9 新增）
  version: text('version').notNull().default('1.0.0'),
  
  // 流程定义
  stages: text('stages', { mode: 'json' }).$type<SOPStage[]>().notNull().default([]),
  
  // AI 配置
  requiredTools: text('required_tools', { mode: 'json' }).$type<string[]>().default([]),
  systemPrompt: text('system_prompt').default(''),
  
  // 知识库配置
  knowledgeConfig: text('knowledge_config', { mode: 'json' }).$type<KnowledgeConfig>(),
  
  // 输出配置
  outputConfig: text('output_config', { mode: 'json' }).$type<OutputConfig>(),
  
  // 质量检查
  qualityChecklist: text('quality_checklist', { mode: 'json' }).$type<string[]>().default([]),
  
  // === v3.1 新增：外挂文件支持 ===
  references: text('references', { mode: 'json' }).$type<ReferenceFile[]>().default([]),
  scripts: text('scripts', { mode: 'json' }).$type<ScriptFile[]>().default([]),
  
  // 元信息
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  projectId: text('project_id').references(() => projects.id),  // null=全局
  createdBy: text('created_by').notNull().default('system'),    // memberId（可以是人或 AI Agent）
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============================================================
// 渲染模板表（v3.0 新增）
// ============================================================

export const renderTemplates = sqliteTable('render_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  category: text('category', { 
    enum: ['report', 'card', 'poster', 'presentation', 'custom'] 
  }).notNull().default('custom'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('active'),
  
  // 模板内容
  htmlTemplate: text('html_template').notNull().default(''),
  mdTemplate: text('md_template').notNull().default(''),
  cssTemplate: text('css_template').default(''),
  
  // 槽位和区块定义
  slots: text('slots', { mode: 'json' }).$type<Record<string, SlotDef>>().notNull().default({}),
  sections: text('sections', { mode: 'json' }).$type<SectionDef[]>().notNull().default([]),
  
  // 导出配置
  exportConfig: text('export_config', { mode: 'json' }).$type<ExportPreset>().notNull().default({ formats: ['jpg', 'html'] }),
  
  // 缩略图
  thumbnail: text('thumbnail'),
  
  // 元信息
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').notNull().default('system'),    // memberId（可以是人或 AI Agent）
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============================================================
// Gateway 配置表（服务端代理模式）
// ============================================================

export const gatewayConfigs = sqliteTable('gateway_configs', {
  id: text('id').primaryKey(),
  
  // Gateway 连接信息
  name: text('name').notNull().default('default'),
  url: text('url').notNull(),
  encryptedToken: text('encrypted_token').notNull(),
  
  // 连接模式
  mode: text('mode', { enum: ['server_proxy', 'browser_direct'] }).notNull().default('server_proxy'),
  
  // 连接状态
  status: text('status', { enum: ['connected', 'disconnected', 'connecting', 'error', 'error_auth', 'error_connection'] }).notNull().default('disconnected'),
  lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  reconnectAttempts: integer('reconnect_attempts').default(0),
  
  // 服务端心跳
  lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }),
  
  // 是否为默认配置（多用户场景下只有一个默认）
  isDefault: integer('is_default', { mode: 'boolean' }).default(true),
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============================================================
// 审计日志表
// ============================================================

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  
  // 调用来源
  source: text('source', { enum: ['mcp', 'mcp_external', 'chat_channel', 'gateway', 'system'] }).notNull(),
  
  // 调用者身份
  memberId: text('member_id'),           // 关联的 AI 成员 ID
  agentId: text('agent_id'),             // OpenClaw Agent ID
  gatewayUrl: text('gateway_url'),       // Gateway URL
  apiToken: text('api_token_hash'),      // Token 的哈希值（脱敏，仅用于匹配）
  
  // 调用内容
  action: text('action').notNull(),      // 工具名称或命令类型（如 register_member, create_task）
  params: text('params', { mode: 'json' }).$type<Record<string, unknown>>(), // 调用参数（脱敏后）
  
  // 执行结果
  success: integer('success', { mode: 'boolean' }).notNull(),
  result: text('result'),                // 成功时的简要结果
  error: text('error'),                  // 失败时的错误信息
  
  // 上下文
  sessionKey: text('session_key'),       // 对话信道的 sessionKey
  requestId: text('request_id'),         // 请求 ID（来自 middleware X-Request-Id）
  
  // 耗时
  durationMs: integer('duration_ms'),
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============================================================
// v3.0 Phase E: 多用户管理相关表
// ============================================================

// 用户角色类型
export type UserRole = 'admin' | 'member' | 'viewer';

// 用户偏好设置类型
export type UserPreferences = {
  language?: 'en' | 'zh';
  theme?: 'light' | 'dark' | 'system';
  defaultProjectId?: string;
  notificationEnabled?: boolean;
};

// 用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  role: text('role', { enum: ['admin', 'member', 'viewer'] }).notNull().default('member'),
  teamId: text('team_id'),                                    // 预留团队空间
  passwordHash: text('password_hash').notNull(),              // argon2id 哈希
  securityCodeHash: text('security_code_hash'),              // 安全码（管理员二次验证）
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  preferences: text('preferences', { mode: 'json' }).$type<UserPreferences>().default({}),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  lockedUntil: integer('locked_until', { mode: 'timestamp' }), // 登录锁定截止时间（限流）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 用户 MCP Token 表（COWORK 外部认证）
export const userMcpTokens = sqliteTable('user_mcp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),                    // SHA-256 哈希（快速查找）
  encryptedToken: text('encrypted_token').notNull(),          // AES-256-GCM 加密存储
  name: text('name').notNull().default(''),                   // Token 备注名
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().default([]), // MCP 工具白名单
  status: text('status', { enum: ['active', 'inactive', 'revoked'] }).notNull().default('active'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),    // null=永不过期
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// SOP 阶段执行记录表（从 tasks.stage_history JSON 拆出，提升性能）
export const sopStageRecords = sqliteTable('sop_stage_records', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  stageId: text('stage_id').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'skipped', 'failed'] }).notNull().default('pending'),
  output: text('output'),                                     // 阶段产出内容
  outputType: text('output_type', { enum: ['text', 'markdown', 'html', 'data', 'file'] }).default('text'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  confirmedBy: text('confirmed_by'),                          // 确认者 ID（userId 或 memberId）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 操作来源类型
export type ActivitySource = 'web_ui' | 'mcp' | 'mcp_external' | 'cowork' | 'chat_channel' | 'gateway' | 'system' | 'cron';

// 业务模块类型
export type ActivityModule = 'project' | 'task' | 'wiki' | 'delivery' | 'content_studio' | 'sop' | 'member' | 'settings' | 'gateway' | 'system';

// 操作日志表（多维度审计）
export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  
  // 操作者身份
  userId: text('user_id').references(() => users.id),         // 人类用户
  memberId: text('member_id').references(() => members.id),   // AI 成员
  
  // 操作来源
  source: text('source', { enum: ['web_ui', 'mcp', 'mcp_external', 'cowork', 'chat_channel', 'gateway', 'system', 'cron'] }).notNull(),
  sourceDetail: text('source_detail'),                        // 补充来源细节
  
  // 业务模块 + 资源定位
  module: text('module', { enum: ['project', 'task', 'wiki', 'delivery', 'content_studio', 'sop', 'member', 'settings', 'gateway', 'system'] }).notNull(),
  resourceType: text('resource_type').notNull(),              // 细粒度资源类型
  resourceId: text('resource_id'),                            // 操作对象 ID
  resourceTitle: text('resource_title'),                      // 操作对象标题快照
  
  // 操作信息
  action: text('action').notNull(),                           // create | update | delete | read | execute | export | ...
  actionDetail: text('action_detail'),                        // 操作具体描述
  
  // 变更内容
  changes: text('changes', { mode: 'json' }).$type<{ field: string; old: unknown; new: unknown }[]>(),
  
  // 执行结果
  success: integer('success', { mode: 'boolean' }).notNull().default(true),
  error: text('error'),
  
  // 上下文
  projectId: text('project_id'),                              // 所属项目
  requestId: text('request_id'),                              // 请求追踪 ID
  ipAddress: text('ip_address'),                              // 客户端 IP（脱敏）
  userAgent: text('user_agent'),                              // 客户端标识（截断）
  durationMs: integer('duration_ms'),                         // 操作耗时
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 审计日志查询：按用户和时间范围
  userCreatedIdx: index('idx_activity_logs_user_created').on(table.userId, table.createdAt),
  // 按模块查询
  moduleIdx: index('idx_activity_logs_module').on(table.module, table.createdAt),
  // 按资源ID查询
  resourceIdx: index('idx_activity_logs_resource').on(table.resourceId),
}));

// ============================================================
// v3.0 项目成员表（协作权限）
// ============================================================

export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 项目内角色：owner 拥有者、admin 管理员、member 成员、viewer 只读
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  uniqueProjectUser: uniqueIndex('idx_project_members_unique').on(table.projectId, table.userId),
}));

// 类型导出
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
// v3.0: 带用户角色的成员类型（从 users 表 JOIN 获取）
export type MemberWithRole = Member & { userRole: UserRole | null };
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskLog = typeof taskLogs.$inferSelect;
export type NewTaskLog = typeof taskLogs.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type OpenClawStatus = typeof openclawStatus.$inferSelect;
export type NewOpenClawStatus = typeof openclawStatus.$inferInsert;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type NewScheduledTask = typeof scheduledTasks.$inferInsert;
export type ScheduledTaskHistory = typeof scheduledTaskHistory.$inferSelect;
export type NewScheduledTaskHistory = typeof scheduledTaskHistory.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

// OpenClaw 同步类型
export type OpenClawWorkspace = typeof openclawWorkspaces.$inferSelect;
export type NewOpenClawWorkspace = typeof openclawWorkspaces.$inferInsert;
export type OpenClawFile = typeof openclawFiles.$inferSelect;
export type NewOpenClawFile = typeof openclawFiles.$inferInsert;
export type OpenClawVersion = typeof openclawVersions.$inferSelect;
export type NewOpenClawVersion = typeof openclawVersions.$inferInsert;
export type OpenClawConflict = typeof openclawConflicts.$inferSelect;
export type NewOpenClawConflict = typeof openclawConflicts.$inferInsert;

// Gateway 配置类型
export type GatewayConfig = typeof gatewayConfigs.$inferSelect;
export type NewGatewayConfig = typeof gatewayConfigs.$inferInsert;

// 审计日志类型
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// SOP 模板类型（v3.0 新增）
export type SOPTemplate = typeof sopTemplates.$inferSelect;
export type NewSOPTemplate = typeof sopTemplates.$inferInsert;

// 渲染模板类型（v3.0 新增）
export type RenderTemplate = typeof renderTemplates.$inferSelect;
export type NewRenderTemplate = typeof renderTemplates.$inferInsert;

// v3.0 Phase E 类型导出
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserMcpToken = typeof userMcpTokens.$inferSelect;
export type NewUserMcpToken = typeof userMcpTokens.$inferInsert;
export type SopStageRecord = typeof sopStageRecords.$inferSelect;
export type NewSopStageRecord = typeof sopStageRecords.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;

// 项目角色类型
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

// ============================================================
// v3.0 Phase E: 首页内容表（独立于 documents，用于公开 API）
// ============================================================

export const landingPages = sqliteTable('landing_pages', {
  id: text('id').primaryKey(),                    // 'landing-en' | 'landing-zh'
  locale: text('locale', { enum: ['en', 'zh'] }).notNull(),
  title: text('title').notNull(),
  content: text('content'),                       // MD 内容（含 @slot 标记）
  renderTemplateId: text('render_template_id'),   // 关联渲染模板
  // SEO 元数据（预留）
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  // 发布状态
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('published'),
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 类型导出
export type LandingPage = typeof landingPages.$inferSelect;
export type NewLandingPage = typeof landingPages.$inferInsert;

// ============================================================
// v3.0 Phase F: Agent MCP Token 表（对话信道自动认证）
// ============================================================

export const agentMcpTokens = sqliteTable('agent_mcp_tokens', {
  id: text('id').primaryKey(),
  // Agent 身份标识
  agentId: text('agent_id'),                                    // Gateway Agent ID（可选）
  memberId: text('member_id').references(() => members.id, { onDelete: 'cascade' }), // AI 成员 ID
  // Token 存储
  tokenHash: text('token_hash').notNull(),                      // SHA-256 哈希（快速查找）
  encryptedToken: text('encrypted_token').notNull(),            // AES-256-GCM 加密存储
  // 来源追踪
  source: text('source', { enum: ['chat', 'mcp', 'gateway', 'auto'] }).notNull().default('auto'), // Token 来源
  // 状态
  status: text('status', { enum: ['active', 'inactive', 'revoked'] }).notNull().default('active'),
  // 使用追踪
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  usageCount: integer('usage_count').notNull().default(0),
  // 有效期
  expiresAt: integer('expires_at', { mode: 'timestamp' }),      // null=永不过期
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 按 Token Hash 查找（认证时使用）
  tokenHashIdx: index('idx_agent_mcp_tokens_hash').on(table.tokenHash),
  // 按 Agent ID 查找
  agentIdIdx: index('idx_agent_mcp_tokens_agent').on(table.agentId),
  // 按 Member ID 查找（对话信道注入时使用）
  memberIdIdx: index('idx_agent_mcp_tokens_member').on(table.memberId),
  // 按状态筛选
  statusIdx: index('idx_agent_mcp_tokens_status').on(table.status),
}));

// 类型导出
export type AgentMcpToken = typeof agentMcpTokens.$inferSelect;
export type NewAgentMcpToken = typeof agentMcpTokens.$inferInsert;

// ============================================================
// v3.0 表关系定义
// ============================================================

// Documents 关系（需在 renderTemplates 定义之后）
export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  renderTemplate: one(renderTemplates, { fields: [documents.renderTemplateId], references: [renderTemplates.id] }),
}));

// SOP 模板关系
export const sopTemplatesRelations = relations(sopTemplates, ({ one, many }) => ({
  project: one(projects, { fields: [sopTemplates.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

// 渲染模板关系
export const renderTemplatesRelations = relations(renderTemplates, ({ many }) => ({
  documents: many(documents),
}));

// v3.0 Phase E 关系定义
export const usersRelations = relations(users, ({ many }) => ({
  mcpTokens: many(userMcpTokens),
  activityLogs: many(activityLogs),
}));

export const userMcpTokensRelations = relations(userMcpTokens, ({ one }) => ({
  user: one(users, { fields: [userMcpTokens.userId], references: [users.id] }),
}));

export const sopStageRecordsRelations = relations(sopStageRecords, ({ one }) => ({
  task: one(tasks, { fields: [sopStageRecords.taskId], references: [tasks.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
  member: one(members, { fields: [activityLogs.memberId], references: [members.id] }),
}));

// ============================================================
// Skill 管理相关表（v3.0 新增）
// ============================================================

/**
 * Skill 信息表
 * 记录所有发现的 Skill（包括 TeamClaw 安装和 Agent 已有的）
 */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  skillKey: text('skill_key').notNull().unique(),  // Skill 唯一标识（如 teamclaw.sop.weekly-report）
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').default('1.0.0'),
  category: text('category', { 
    enum: ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'] 
  }),
  
  // 来源标识
  source: text('source', { 
    enum: ['teamclaw', 'external', 'unknown'] 
  }).notNull().default('unknown'),
  // teamclaw: 通过 TeamClaw 安装
  // external: 管理员手动信任的外部 Skill
  // unknown: 发现时来源未知
  
  // SOP 关联（source=teamclaw 时）
  sopTemplateId: text('sop_template_id'),
  sopTemplateVersion: text('sop_template_version'),  // 关联时的 SOP 版本（用于检测更新）
  sopUpdateAvailable: integer('sop_update_available', { mode: 'boolean' }).default(false),  // SOP 有新版本时标记
  
  // 创建者（v3.0 用户隔离，无 FK 约束）
  createdBy: text('created_by'),  // userId
  
  // 信任状态
  trustStatus: text('trust_status', { 
    enum: ['trusted', 'untrusted', 'pending'] 
  }).notNull().default('pending'),
  // trusted: 已信任（管理员确认安全）
  // untrusted: 不信任（已被拒绝）
  // pending: 待审核
  
  // 敏感标记
  isSensitive: integer('is_sensitive', { mode: 'boolean' }).default(false),
  sensitivityNote: text('sensitivity_note'),
  
  // 外部发布状态
  externalPublished: integer('external_published', { mode: 'boolean' }).default(false),
  externalUrl: text('external_url'),
  externalPublishedAt: integer('external_published_at', { mode: 'timestamp' }),
  
  // 状态管理
  status: text('status', {
    enum: ['draft', 'pending_approval', 'active', 'rejected']
  }).notNull().default('draft'),
  // draft: 草稿（已创建，未提交审批）
  // pending_approval: 审批中
  // active: 已激活（审批通过）
  // rejected: 已拒绝
  
  // 文件路径
  skillPath: text('skill_path'),  // Skill 目录路径
  skillMd: text('skill_md'),  // SKILL.md 原始内容

  // 安装到的 Agent 列表
  installedAgents: text('installed_agents', { mode: 'json' }).$type<string[]>().default([]),
  
  // 时间戳
  discoveredAt: integer('discovered_at', { mode: 'timestamp' }),  // 首次发现时间
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  skillKeyIdx: index('idx_skills_skill_key').on(table.skillKey),
  statusIdx: index('idx_skills_status').on(table.status),
  trustStatusIdx: index('idx_skills_trust_status').on(table.trustStatus),
  sourceIdx: index('idx_skills_source').on(table.source),
  createdByIdx: index('idx_skills_created_by').on(table.createdBy),
}));

/**
 * Skill 快照表
 * 记录 Agent 在某一时刻安装的所有 Skill
 */
export const skillSnapshots = sqliteTable('skill_snapshots', {
  id: text('id').primaryKey(),
  // Gateway Agent ID (not referencing members table - Gateway agents are separate from TeamClaw members)
  agentId: text('agent_id').notNull(),
  
  // Agent 名称（冗余存储，方便查询）
  agentName: text('agent_name'),
  
  // 快照时间
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
  
  // Skill 列表
  skills: text('skills', { mode: 'json' }).$type<Array<{
    skillKey: string;
    name: string;
    version?: string;
    enabled: boolean;
  }>>().notNull(),
  
  // 差异分析结果
  diff: text('diff', { mode: 'json' }).$type<{
    added: string[];      // 新增的 skillKey 列表
    removed: string[];    // 删除的 skillKey 列表
    unchanged: string[];  // 未变化的 skillKey 列表
  }>(),
  
  // 风险提示
  riskAlerts: text('risk_alerts', { mode: 'json' }).$type<Array<{
    type: 'unknown_skill' | 'untrusted_skill' | 'sensitive_skill';
    skillKey: string;
    message: string;
  }>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  agentIdx: index('idx_skill_snapshots_agent').on(table.agentId),
  snapshotAtIdx: index('idx_skill_snapshots_at').on(table.snapshotAt),
}));

/**
 * Skill 信任记录表
 * 记录管理员的信任/拒绝操作
 */
export const skillTrustRecords = sqliteTable('skill_trust_records', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull(),  // 无 FK 约束，支持 'global' 等特殊值
  agentId: text('agent_id').notNull(),  // 无 FK 约束，支持 'global' 等特殊值
  
  // 操作类型
  action: text('action', { 
    enum: ['trust', 'untrust', 'install', 'uninstall'] 
  }).notNull(),
  
  // 操作说明
  note: text('note'),
  
  // 操作者
  operatedBy: text('operated_by').notNull(),  // userId
  
  operatedAt: integer('operated_at', { mode: 'timestamp' }),
  
  // 兼容旧表结构
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  skillIdx: index('idx_skill_trust_skill').on(table.skillId),
  agentIdx: index('idx_skill_trust_agent').on(table.agentId),
}));

// 类型导出
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillSnapshot = typeof skillSnapshots.$inferSelect;
export type NewSkillSnapshot = typeof skillSnapshots.$inferInsert;
export type SkillTrustRecord = typeof skillTrustRecords.$inferSelect;
export type NewSkillTrustRecord = typeof skillTrustRecords.$inferInsert;

// Skill 表关系定义
export const skillsRelations = relations(skills, ({ one, many }) => ({
  sopTemplate: one(sopTemplates, { fields: [skills.sopTemplateId], references: [sopTemplates.id] }),
  snapshots: many(skillSnapshots),
  trustRecords: many(skillTrustRecords),
}));

export const skillSnapshotsRelations = relations(skillSnapshots, ({ one }) => ({
  agent: one(members, { fields: [skillSnapshots.agentId], references: [members.id] }),
}));

export const skillTrustRecordsRelations = relations(skillTrustRecords, ({ one }) => ({
  skill: one(skills, { fields: [skillTrustRecords.skillId], references: [skills.id] }),
  agent: one(members, { fields: [skillTrustRecords.agentId], references: [members.id] }),
}));

// ============================================================
// 审批系统相关表（v3.0 新增）
// ============================================================

/**
 * 审批请求表（通用）
 * 支持多种业务场景：Skill 发布/安装、项目加入等
 */
export const approvalRequests = sqliteTable('approval_requests', {
  id: text('id').primaryKey(),
  
  // 审批类型
  type: text('type', { 
    enum: ['skill_publish', 'skill_install', 'project_join', 'sensitive_action'] 
  }).notNull(),
  
  // 资源信息
  resourceType: text('resource_type').notNull(),  // 'skill' | 'project' | 'task'
  resourceId: text('resource_id').notNull(),      // 资源 ID
  
  // 申请人
  requesterId: text('requester_id').notNull(), // 用户 ID（来自 users 表）
  
  // 申请内容（JSON 格式，根据类型不同）
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  
  // 申请说明
  requestNote: text('request_note'),
  
  // 状态
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'] 
  }).notNull().default('pending'),
  
  // 审批结果
  approvedBy: text('approved_by'), // 审批人用户 ID
  rejectedBy: text('rejected_by'), // 拒绝人用户 ID
  approvalNote: text('approval_note'),  // 审批备注
  rejectionNote: text('rejection_note'), // 拒绝原因
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }),  // 处理时间
  
  // 过期时间
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  
}, (table) => ({
  // 按类型和状态查询
  typeStatusIdx: index('idx_approval_type_status').on(table.type, table.status),
  // 按资源查询
  resourceIdx: index('idx_approval_resource').on(table.resourceType, table.resourceId),
  // 按申请人查询
  requesterIdx: index('idx_approval_requester').on(table.requesterId),
  // 按状态查询
  statusIdx: index('idx_approval_status').on(table.status),
}));

/**
 * 审批历史表（审计日志）
 */
export const approvalHistories = sqliteTable('approval_histories', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => approvalRequests.id),
  
  // 操作信息
  action: text('action', { 
    enum: ['created', 'approved', 'rejected', 'cancelled', 'expired', 'reassigned'] 
  }).notNull(),
  
  operatorId: text('operator_id').notNull(), // 操作者用户ID（来自 users 表）
  
  // 变更详情
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  note: text('note'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  requestIdx: index('idx_approval_history_request').on(table.requestId),
  operatorIdx: index('idx_approval_history_operator').on(table.operatorId),
}));

/**
 * 审批策略配置表
 */
export const approvalStrategies = sqliteTable('approval_strategies', {
  id: text('id').primaryKey(),
  type: text('type').notNull().unique(),  // 审批类型
  
  // 策略配置
  strategy: text('strategy', { mode: 'json' }).$type<{
    type: string;
    approverRule: 'any_admin' | 'specific_role' | 'project_admin' | 'custom';
    requireMultiple: boolean;
    requiredApprovals: number;
    timeoutHours: number;
    timeoutAction: 'auto_approve' | 'auto_reject' | 'none';
    notifyRequester: boolean;
    notifyApprover: boolean;
  }>().notNull(),
  
  // 是否启用
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  
  // 配置信息
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 类型导出
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type ApprovalHistory = typeof approvalHistories.$inferSelect;
export type NewApprovalHistory = typeof approvalHistories.$inferInsert;
export type ApprovalStrategyConfig = typeof approvalStrategies.$inferSelect;
export type NewApprovalStrategyConfig = typeof approvalStrategies.$inferInsert;

// 审批表关系定义
export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  histories: many(approvalHistories),
}));

export const approvalHistoriesRelations = relations(approvalHistories, ({ one }) => ({
  request: one(approvalRequests, { fields: [approvalHistories.requestId], references: [approvalRequests.id] }),
}));

// ============================================================
// 系统配置表（通用 Key-Value 存储）
// ============================================================

/**
 * 系统配置表
 * 用于存储全局配置（如 SkillHub 设置、系统初始化状态等）
 */
export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<Record<string, unknown>>(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
