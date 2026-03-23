/**
 * MCP 工具 JSON Schema 定义
 * 
 * 37 个工具的完整定义，移植自 teamclaw v1 并针对 v2 优化
 */

export const TEAMCLAW_TOOLS = {
  get_task: {
    name: 'get_task',
    description: '获取任务详情。默认返回 L1 索引（精简数据），传 detail=true 返回完整详情',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        detail: { type: 'boolean', description: '是否返回完整详情（默认 false，仅返回索引）' },
      },
      required: ['task_id'],
    },
  },
  
  list_my_tasks: {
    name: 'list_my_tasks',
    description: '获取分配给当前 AI 成员的任务列表。默认返回 L1 索引，传 detail=true 返回完整详情。通过外部 API 调用时身份自动注入，无需传 member_id。也支持按昵称查询',
    parameters: {
      type: 'object',
      properties: {
        status: { 
          type: 'string', 
          enum: ['todo', 'in_progress', 'reviewing', 'completed', 'all'],
          description: '任务状态筛选（默认 todo，返回待办任务）' 
        },
        member_name: { type: 'string', description: 'AI 成员昵称（可选，用于按昵称查询其他成员的任务）' },
        project_id: { type: 'string', description: '限定项目 ID（可选）' },
        limit: { type: 'number', description: '返回数量限制（默认 20）' },
        detail: { type: 'boolean', description: '是否返回完整详情（默认 false，仅返回索引）' },
      },
    },
  },
  
  update_task_status: {
    name: 'update_task_status',
    description: '更新任务状态：todo(待办)、in_progress(进行中)、reviewing(审核中)、completed(已完成)',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        status: { 
          type: 'string', 
          enum: ['todo', 'in_progress', 'reviewing', 'completed'],
          description: '新状态' 
        },
        progress: { type: 'number', description: '进度 0-100（可选）' },
        message: { type: 'string', description: '状态变更说明（可选）' },
      },
      required: ['task_id', 'status'],
    },
  },
  
  add_task_comment: {
    name: 'add_task_comment',
    description: '向任务添加评论，用于汇报进度、提出问题或提交结果',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        content: { type: 'string', description: '评论内容' },
      },
      required: ['task_id', 'content'],
    },
  },
  
  create_check_item: {
    name: 'create_check_item',
    description: '为任务创建检查项（子任务）',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        text: { type: 'string', description: '检查项内容' },
      },
      required: ['task_id', 'text'],
    },
  },
  
  complete_check_item: {
    name: 'complete_check_item',
    description: '完成某个检查项',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        item_id: { type: 'string', description: '检查项 ID' },
      },
      required: ['task_id', 'item_id'],
    },
  },

  get_project: {
    name: 'get_project',
    description: '获取项目详情，包括名称、描述、成员、任务列表等',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '项目 ID' },
      },
      required: ['project_id'],
    },
  },
  
  get_project_members: {
    name: 'get_project_members',
    description: '获取项目成员列表，包括人类和 AI 成员',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '项目 ID' },
      },
      required: ['project_id'],
    },
  },

  get_document: {
    name: 'get_document',
    description: '获取 Wiki 文档。默认返回 L1 索引（元信息），传 detail=true 返回完整内容',
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题（二选一）' },
        detail: { type: 'boolean', description: '是否返回完整内容（默认 false，仅返回元信息）' },
      },
    },
  },
  
  create_document: {
    name: 'create_document',
    description: '创建新的 Wiki 文档',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文档标题' },
        content: { type: 'string', description: '文档内容（Markdown）' },
        doc_type: { type: 'string', enum: ['report', 'note', 'decision', 'scheduled_task', 'task_list', 'other'], description: '文档类型（默认 note）' },
        project_id: { type: 'string', description: '关联项目 ID（可选）' },
        // v3.0 Content Studio 扩展
        render_mode: { type: 'string', enum: ['markdown', 'visual'], description: '渲染模式：markdown（纯文本）或 visual（可视化编辑）' },
        render_template_id: { type: 'string', description: '关联的渲染模板 ID（render_mode=visual 时使用）' },
      },
      required: ['title', 'content'],
    },
  },
  
  update_document: {
    name: 'update_document',
    description: '更新 Wiki 文档内容',
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: '文档 ID' },
        content: { type: 'string', description: '新的文档内容' },
        doc_type: { type: 'string', enum: ['report', 'note', 'decision', 'scheduled_task', 'task_list', 'other'], description: '更新文档类型（可选）' },
      },
      required: ['document_id', 'content'],
    },
  },

  search_documents: {
    name: 'search_documents',
    description: '搜索 Wiki 文档',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        project_id: { type: 'string', description: '限定项目（可选）' },
      },
      required: ['query'],
    },
  },

  update_status: {
    name: 'update_status',
    description: '更新 AI 实时状态面板，显示当前正在做什么',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: 'AI 成员 ID（可选，默认当前 AI）' },
        status: { 
          type: 'string', 
          enum: ['idle', 'working', 'waiting', 'offline'],
          description: '状态' 
        },
        current_action: { type: 'string', description: '当前操作描述' },
        task_id: { type: 'string', description: '当前任务 ID（可选）' },
        progress: { type: 'number', description: '进度 0-100' },
      },
      required: ['status'],
    },
  },

  set_queue: {
    name: 'set_queue',
    description: '设置任务队列，显示接下来要做的任务',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: 'AI 成员 ID（可选）' },
        queued_tasks: { 
          type: 'array', 
          items: { 
            type: 'object',
            properties: {
              id: { type: 'string', description: '任务 ID' },
              title: { type: 'string', description: '任务标题' },
            }
          },
          description: '队列中的任务列表' 
        },
      },
      required: ['queued_tasks'],
    },
  },

  set_do_not_disturb: {
    name: 'set_do_not_disturb',
    description: '设置免打扰模式',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: 'AI 成员 ID（可选）' },
        interruptible: { type: 'boolean', description: '是否可被打扰' },
        reason: { type: 'string', description: '免打扰原因' },
      },
      required: ['interruptible'],
    },
  },

  create_schedule: {
    name: 'create_schedule',
    description: '创建定时任务，支持每日/每周/每月执行',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '定时任务标题' },
        task_type: { type: 'string', enum: ['report', 'summary', 'backup', 'notification', 'custom'], description: '任务类型' },
        schedule_type: { type: 'string', enum: ['once', 'daily', 'weekly', 'monthly'], description: '调度类型' },
        schedule_time: { type: 'string', description: '执行时间 "HH:MM"' },
        schedule_days: { type: 'array', items: { type: 'number' }, description: '执行日期' },
        description: { type: 'string', description: '任务描述' },
        config: { type: 'object', description: '任务配置参数' },
      },
      required: ['title', 'task_type', 'schedule_type'],
    },
  },

  list_schedules: {
    name: 'list_schedules',
    description: '获取定时任务列表',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: '筛选 AI 成员（可选）' },
        enabled_only: { type: 'boolean', description: '仅显示启用的任务' },
      },
    },
  },

  delete_schedule: {
    name: 'delete_schedule',
    description: '删除定时任务',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: { type: 'string', description: '定时任务 ID' },
      },
      required: ['schedule_id'],
    },
  },

  deliver_document: {
    name: 'deliver_document',
    description: '提交文档交付，支持关联内部 Wiki 文档或外部文档链接供用户审核',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文档标题' },
        description: { type: 'string', description: '文档描述' },
        platform: { type: 'string', enum: ['tencent-doc', 'feishu', 'notion', 'local', 'other'], description: '文档平台' },
        external_url: { type: 'string', description: '外部文档链接' },
        document_id: { type: 'string', description: 'TeamClaw 内部文档 ID' },
        task_id: { type: 'string', description: '关联任务 ID（可选）' },
      },
      required: ['title', 'platform'],
    },
  },

  list_my_deliveries: {
    name: 'list_my_deliveries',
    description: '获取当前 AI 成员的交付物列表。通过外部 API 调用时身份自动注入，无需传 member_id。可用于检查交付物的审核状态',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'revision_needed', 'all'],
          description: '交付物状态筛选（默认 all）'
        },
        limit: { type: 'number', description: '返回数量限制（默认 20）' },
      },
    },
  },

  get_delivery: {
    name: 'get_delivery',
    description: '获取交付物详情，包括审核意见、关联文档、关联任务等信息',
    parameters: {
      type: 'object',
      properties: {
        delivery_id: { type: 'string', description: '交付记录 ID' },
      },
      required: ['delivery_id'],
    },
  },

  review_delivery: {
    name: 'review_delivery',
    description: '审核文档交付，可批准、拒绝或要求修改',
    parameters: {
      type: 'object',
      properties: {
        delivery_id: { type: 'string', description: '交付记录 ID' },
        status: { type: 'string', enum: ['approved', 'rejected', 'revision_needed'], description: '审核结果' },
        comment: { type: 'string', description: '审核意见（可选）' },
      },
      required: ['delivery_id', 'status'],
    },
  },

  update_schedule: {
    name: 'update_schedule',
    description: '更新定时任务配置',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: { type: 'string', description: '定时任务 ID' },
        title: { type: 'string', description: '任务标题' },
        schedule_time: { type: 'string', description: '执行时间 "HH:MM"' },
        schedule_days: { type: 'array', items: { type: 'number' }, description: '执行日期' },
        enabled: { type: 'boolean', description: '是否启用' },
        description: { type: 'string', description: '任务描述' },
      },
      required: ['schedule_id'],
    },
  },

  register_member: {
    name: 'register_member',
    description: 'AI 成员自注册（幂等），相同 endpoint 会更新已有记录',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '成员名称' },
        endpoint: { type: 'string', description: '成员服务端点 URL' },
        deploy_mode: { type: 'string', description: '部署模式（cloud/local/knot）' },
        execution_mode: { type: 'string', description: '执行模式（chat_only/api_first/api_only）' },
        tools: { type: 'array', items: { type: 'string' }, description: '擅长工具列表' },
        task_types: { type: 'array', items: { type: 'string' }, description: '擅长任务类型' },
        api_token: { type: 'string', description: 'API Token' },
      },
      required: ['name', 'endpoint'],
    },
  },

  // ==================== 消息模板工具（v1.0.1 新增）====================

  get_message_template: {
    name: 'get_message_template',
    description: '获取渲染后的消息模板内容，模板支持 Mustache 风格变量替换',
    parameters: {
      type: 'object',
      properties: {
        template_name: { type: 'string', description: '模板名称（如 system-info, task-push, task-board, task-push-unified）' },
      },
      required: ['template_name'],
    },
  },

  list_message_templates: {
    name: 'list_message_templates',
    description: '列出所有可用的消息模板',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  // ==================== v1.0.1 Deprecated 工具（仍可用，但建议迁移）====================

  get_template: {
    name: 'get_template',
    description: '[DEPRECATED v1.0.1] 请使用 get_message_template',
    parameters: {
      type: 'object',
      properties: {
        template_name: { type: 'string', description: '模板名称（如 system-info, task-push, task-board）' },
      },
      required: ['template_name'],
    },
  },

  list_templates: {
    name: 'list_templates',
    description: '[DEPRECATED v1.0.1] 请使用 list_message_templates',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  create_milestone: {
    name: 'create_milestone',
    description: '创建项目里程碑，用于划分项目阶段',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '里程碑标题' },
        project_id: { type: 'string', description: '所属项目 ID' },
        description: { type: 'string', description: '里程碑描述（可选）' },
        status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: '状态（默认 open）' },
        due_date: { type: 'string', description: '截止日期 ISO 格式（可选）' },
        sort_order: { type: 'number', description: '排序顺序（默认 0）' },
      },
      required: ['title', 'project_id'],
    },
  },

  list_milestones: {
    name: 'list_milestones',
    description: '获取里程碑列表，可按项目筛选',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '项目 ID（可选，不传则返回全部）' },
      },
    },
  },

  update_milestone: {
    name: 'update_milestone',
    description: '更新里程碑信息',
    parameters: {
      type: 'object',
      properties: {
        milestone_id: { type: 'string', description: '里程碑 ID' },
        title: { type: 'string', description: '标题' },
        description: { type: 'string', description: '描述' },
        status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: '状态' },
        due_date: { type: 'string', description: '截止日期 ISO 格式' },
        sort_order: { type: 'number', description: '排序顺序' },
      },
      required: ['milestone_id'],
    },
  },

  delete_milestone: {
    name: 'delete_milestone',
    description: '删除里程碑，关联任务的里程碑字段会被清空',
    parameters: {
      type: 'object',
      properties: {
        milestone_id: { type: 'string', description: '里程碑 ID' },
      },
      required: ['milestone_id'],
    },
  },

  // ========== SOP 引擎工具（v3.0 新增）==========

  advance_sop_stage: {
    name: 'advance_sop_stage',
    description: 'AI 完成当前 SOP 阶段，推进到下一阶段。仅对绑定了 SOP 模板的任务有效',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        stage_output: { type: 'string', description: '当前阶段产出内容（可选）' },
      },
      required: ['task_id'],
    },
  },

  request_sop_confirm: {
    name: 'request_sop_confirm',
    description: 'AI 请求人工确认当前 SOP 阶段产出。会触发通知，等待用户确认后才能继续',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        confirm_message: { type: 'string', description: '请求确认的说明文字' },
        stage_output: { type: 'string', description: '当前阶段产出，供用户审核' },
      },
      required: ['task_id', 'confirm_message', 'stage_output'],
    },
  },

  get_sop_context: {
    name: 'get_sop_context',
    description: '获取当前 SOP 执行上下文，包括阶段信息、知识库、前序产出等。AI 用于了解当前进度和参考信息',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
      },
      required: ['task_id'],
    },
  },

  save_stage_output: {
    name: 'save_stage_output',
    description: '保存当前 SOP 阶段的产出内容（不推进到下一阶段）。用于中间保存或分段输出',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        output: { type: 'string', description: '阶段产出内容' },
        output_type: { type: 'string', enum: ['text', 'markdown', 'html', 'data', 'file'], description: '产出类型（默认 text）' },
      },
      required: ['task_id', 'output'],
    },
  },

  update_knowledge: {
    name: 'update_knowledge',
    description: '向 know-how 知识库追加经验内容。对于分层知识库文档（含 L1-L5），自动追加到 L4 经验记录层；对于普通文档，追加到末尾',
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: '知识库文档 ID' },
        content: { type: 'string', description: '追加的知识内容（纯文本，无需日期前缀）' },
        layer: { type: 'string', enum: ['L4'], description: '追加到的层级（目前仅支持 L4），默认自动判断' },
      },
      required: ['document_id', 'content'],
    },
  },

  // ========== AI 自主创作工具（v3.0 新增）==========

  create_sop_template: {
    name: 'create_sop_template',
    description: 'AI 自主创建 SOP 模板。创建后状态为 draft，需用户确认后才能使用',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'SOP 模板名称' },
        description: { type: 'string', description: 'SOP 描述' },
        category: { type: 'string', enum: ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'], description: '分类' },
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '阶段唯一 ID' },
              label: { type: 'string', description: '阶段名称' },
              type: { type: 'string', enum: ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'], description: '阶段类型' },
              promptTemplate: { type: 'string', description: '该阶段的 AI 指令模板（Mustache 语法）' },
              outputType: { type: 'string', enum: ['text', 'markdown', 'html', 'json'], description: '产出格式' },
              requireConfirm: { type: 'boolean', description: '是否需要人工确认' },
            },
            required: ['id', 'label', 'type'],
          },
          description: 'SOP 阶段列表（至少 1 个）',
        },
        system_prompt: { type: 'string', description: '整体系统 prompt（可选）' },
        required_tools: { type: 'array', items: { type: 'string' }, description: '执行所需的 Agent 工具列表（可选）' },
        quality_checklist: { type: 'array', items: { type: 'string' }, description: '质量检查项（可选）' },
        project_id: { type: 'string', description: '关联项目 ID（可选，null 为全局）' },
      },
      required: ['name', 'stages'],
    },
  },

  update_sop_template: {
    name: 'update_sop_template',
    description: 'AI 优化/修改已有 SOP 模板',
    parameters: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'SOP 模板 ID' },
        name: { type: 'string', description: '模板名称' },
        description: { type: 'string', description: '描述' },
        stages: { type: 'array', description: '阶段列表（完整替换）' },
        system_prompt: { type: 'string', description: '系统 prompt' },
        required_tools: { type: 'array', items: { type: 'string' }, description: '所需工具' },
        quality_checklist: { type: 'array', items: { type: 'string' }, description: '质量检查项' },
        status: { type: 'string', enum: ['draft', 'active', 'archived'], description: '状态' },
      },
      required: ['template_id'],
    },
  },

  // ==================== 渲染模板查询（v3.0 新增） ====================

  list_render_templates: {
    name: 'list_render_templates',
    description: '获取系统中的渲染模板列表。用于选择合适的模板来渲染内容。返回模板 ID、名称、分类、状态。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['report', 'card', 'poster', 'presentation', 'custom', 'content'], description: '按分类筛选（可选）' },
        status: { type: 'string', enum: ['draft', 'active', 'archived', 'all'], description: '按状态筛选（默认 active）' },
      },
    },
  },

  get_render_template: {
    name: 'get_render_template',
    description: '获取渲染模板详情，包括 HTML 结构、Markdown 模板、Slots 定义、Sections 划分。用于了解模板语法和填充内容。',
    parameters: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: '渲染模板 ID' },
      },
      required: ['template_id'],
    },
  },

  create_render_template: {
    name: 'create_render_template',
    description: 'AI 自主编写 HTML 渲染模板。创建后状态为 draft，需用户确认后才能使用。HTML 会经过安全校验',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '模板名称' },
        description: { type: 'string', description: '模板描述' },
        category: { type: 'string', enum: ['report', 'card', 'poster', 'presentation', 'custom'], description: '分类' },
        html_template: { type: 'string', description: 'HTML 模板内容（必须包含 data-slot 属性，禁止 <script>）' },
        css_template: { type: 'string', description: 'CSS 样式（可选，内联或 <style> 标签）' },
        md_template: { type: 'string', description: 'Markdown 模板（双栏编辑用）' },
        slots: {
          type: 'object',
          description: '可编辑区域定义 Record<slotName, {type, label, default}>',
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              slotIds: { type: 'array', items: { type: 'string' } },
            },
          },
          description: '区块划分（可选）',
        },
        export_config: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['png', 'jpeg', 'pdf'] },
            width: { type: 'number' },
            height: { type: 'number' },
            scale: { type: 'number' },
          },
          description: '导出配置',
        },
      },
      required: ['name', 'html_template', 'md_template', 'slots'],
    },
  },

  update_render_template: {
    name: 'update_render_template',
    description: 'AI 优化/修改已有 HTML 渲染模板',
    parameters: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: '渲染模板 ID' },
        name: { type: 'string', description: '模板名称' },
        description: { type: 'string', description: '描述' },
        html_template: { type: 'string', description: 'HTML 模板' },
        css_template: { type: 'string', description: 'CSS 样式' },
        md_template: { type: 'string', description: 'Markdown 模板' },
        slots: { type: 'object', description: '可编辑区域定义' },
        sections: { type: 'array', description: '区块划分' },
        export_config: { type: 'object', description: '导出配置' },
        status: { type: 'string', enum: ['draft', 'active', 'archived'], description: '状态' },
      },
      required: ['template_id'],
    },
  },

  // ==================== v3.0 Phase F: Agent MCP Token ====================

  get_agent_mcp_token: {
    name: 'get_agent_mcp_token',
    description: '获取当前 Agent 的 MCP API Token，用于调用外部 API。首次调用会自动创建 Token。通过外部 API 调用时身份自动注入，无需传 member_id。',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: 'AI 成员 ID（可选，外部 API 调用时自动注入）' },
      },
    },
  },

  list_agent_mcp_tokens: {
    name: 'list_agent_mcp_tokens',
    description: '列出当前 Agent 的所有 MCP Token',
    parameters: {
      type: 'object',
      properties: {
        member_id: { type: 'string', description: 'AI 成员 ID（可选，外部 API 调用时自动注入）' },
      },
    },
  },

  revoke_agent_mcp_token: {
    name: 'revoke_agent_mcp_token',
    description: '撤销指定的 Agent MCP Token',
    parameters: {
      type: 'object',
      properties: {
        token_id: { type: 'string', description: 'Token ID' },
        member_id: { type: 'string', description: 'AI 成员 ID（可选）' },
      },
      required: ['token_id'],
    },
  },

  // ==================== v3.0 Phase F: 上下文获取工具（渐进式） ====================

  // ==================== v1.0.1 Deprecated 上下文工具（仍可用，但建议迁移）====================

  get_task_detail: {
    name: 'get_task_detail',
    description: '[DEPRECATED v1.0.1] 请使用 get_task 并传 detail=true',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID' },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['comments', 'checklist', 'attachments', 'history'] },
          description: '包含的额外信息（可选）',
        },
      },
      required: ['task_id'],
    },
  },

  get_project_detail: {
    name: 'get_project_detail',
    description: '[DEPRECATED v1.0.1] 请使用 get_project 并传 detail=true',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '项目 ID' },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['members', 'tasks', 'documents', 'milestones'] },
          description: '包含的额外信息（可选）',
        },
      },
      required: ['project_id'],
    },
  },

  get_document_detail: {
    name: 'get_document_detail',
    description: '[DEPRECATED v1.0.1] 请使用 get_document 并传 detail=true',
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题（可选，与 document_id 二选一）' },
      },
    },
  },

  get_sop_previous_output: {
    name: 'get_sop_previous_output',
    description: '[DEPRECATED v1.0.1] 请使用 get_sop_context',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'SOP 任务 ID' },
        stage_id: { type: 'string', description: '指定阶段 ID（可选，默认返回所有前序产出）' },
      },
      required: ['task_id'],
    },
  },

  get_sop_knowledge_layer: {
    name: 'get_sop_knowledge_layer',
    description: '[DEPRECATED v1.0.1] 请使用 get_sop_context',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'SOP 任务 ID' },
        layer: {
          type: 'string',
          enum: ['L1', 'L2', 'L3', 'L4', 'L5'],
          description: '知识层级（默认 L1）',
        },
      },
      required: ['task_id'],
    },
  },

  invoke_skill: {
    name: 'invoke_skill',
    description: '调用 Skill 执行任务。Skill 是预定义的工作流程模板，可自动化完成复杂任务。',
    parameters: {
      type: 'object',
      properties: {
        skill_key: { 
          type: 'string', 
          description: 'Skill 唯一标识（如 teamclaw.sop.weekly-report）' 
        },
        task_id: { 
          type: 'string', 
          description: '关联的任务 ID（可选，用于上下文注入）' 
        },
        parameters: { 
          type: 'object',
          description: 'Skill 执行参数（JSON 对象，具体参数根据 Skill 定义）' 
        },
        context: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: '项目 ID（用于加载项目上下文）' },
            member_id: { type: 'string', description: '执行成员 ID' },
            auto_load_context: { 
              type: 'boolean', 
              description: '是否自动加载前置上下文（默认 true）' 
            },
          },
          description: '执行上下文配置',
        },
      },
      required: ['skill_key'],
    },
  },

  list_skills: {
    name: 'list_skills',
    description: '获取可用的 Skill 列表。返回所有 active 状态的 Skill。',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'],
          description: '按分类筛选（可选）',
        },
        search: { type: 'string', description: '搜索关键词（可选）' },
        limit: { type: 'number', description: '返回数量限制（默认 20）' },
      },
    },
  },
} as const;

export type TeamClawToolName = keyof typeof TEAMCLAW_TOOLS;

export function getToolDefinitions() {
  return Object.values(TEAMCLAW_TOOLS);
}
