/**
 * SOP 引擎相关 MCP Handler
 *
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 40%
 */

import { db } from '@/db';
import { tasks, documents, sopTemplates, renderTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { parseKnowHow, extractLayers, appendToL4 } from '@/lib/knowhow-parser';
import { renderTemplateWithContext } from '@/lib/template-engine';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type {
  SOPStage,
  StageRecord,
  SOPCategory,
  StageOutputType,
  KnowledgeConfig,
  Task,
  SOPTemplate,
  RenderTemplate,
  Document,
} from '@/db/schema';

/**
 * SOP Handler - 继承 McpHandlerBase 基类
 */
class SOPHandler extends McpHandlerBase<Task> {
  constructor() {
    super('SOP', 'task_update');
  }

  /**
   * 主入口 - 调度各个具体处理方法
   */
  async execute(
    params: Record<string, unknown>,
    _context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string;

    switch (action) {
      case 'advance_stage':
        return this.handleAdvanceSopStage(params);
      case 'request_confirm':
        return this.handleRequestSopConfirm(params);
      case 'get_context':
        return this.handleGetSopContext(params);
      case 'save_stage_output':
        return this.handleSaveStageOutput(params);
      case 'update_knowledge':
        return this.handleUpdateKnowledge(params);
      case 'create_template':
        return this.handleCreateSopTemplate(params);
      case 'update_template':
        return this.handleUpdateSopTemplate(params);
      case 'create_render_template':
        return this.handleCreateRenderTemplate(params);
      case 'update_render_template':
        return this.handleUpdateRenderTemplate(params);
      case 'list_render_templates':
        return this.handleListRenderTemplates(params);
      case 'get_render_template':
        return this.handleGetRenderTemplate(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  // ========== SOP 执行工具 ==========

  /**
   * advance_sop_stage - AI 完成当前阶段，推进到下一阶段
   */
  private async handleAdvanceSopStage(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id');
    if (validation) return validation;

    const { task_id, stage_output } = params as { task_id: string; stage_output?: string };

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, task_id),
    });

    if (!task) {
      return this.failure('Task not found');
    }

    if (!task.sopTemplateId || !task.currentStageId) {
      return this.failure('Task is not bound to a SOP template or has not started execution');
    }

    // 获取 SOP 模板
    const template = await db.query.sopTemplates.findFirst({
      where: eq(sopTemplates.id, task.sopTemplateId),
    });

    if (!template) {
      return this.failure('SOP template not found');
    }

    const sopStages = template.stages as SOPStage[];
    const currentIndex = sopStages.findIndex((s) => s.id === task.currentStageId);

    if (currentIndex === -1) {
      return this.failure('Current stage not found');
    }

    // 检查当前阶段状态
    const stageHistory = (task.stageHistory || []) as StageRecord[];
    const existingRecord = stageHistory.find((h) => h.stageId === task.currentStageId);

    // 如果已经在等待确认，不允许 AI 直接推进
    if (existingRecord?.status === 'waiting_confirm') {
      return this.failure(
        'Current stage is waiting for human confirmation. Use request_sop_confirm or wait for human action'
      );
    }

    // ai_with_confirm 类型阶段必须先通过 request_sop_confirm 请求确认
    const currentStage = sopStages[currentIndex];
    if (currentStage.type === 'ai_with_confirm' && existingRecord?.status === 'active') {
      return this.failure(
        'This stage type is ai_with_confirm. Please call request_sop_confirm first, then wait for human confirmation to advance automatically'
      );
    }

    // 更新阶段历史
    const now = new Date();
    const nowStr = now.toISOString();

    // 完成当前阶段
    const currentStageRecord: StageRecord = {
      stageId: task.currentStageId,
      status: 'completed',
      output: stage_output,
      outputType: 'text',
      startedAt: existingRecord?.startedAt || nowStr,
      completedAt: nowStr,
    };

    // 更新历史（替换或添加）
    const existingIndex = stageHistory.findIndex((h) => h.stageId === task.currentStageId);
    if (existingIndex >= 0) {
      stageHistory[existingIndex] = currentStageRecord;
    } else {
      stageHistory.push(currentStageRecord);
    }

    // 确定下一阶段
    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= sopStages.length;
    const nextStageId = isCompleted ? null : sopStages[nextIndex].id;

    // 使用事务确保文档创建 + 任务更新的原子性
    let nextRenderDocId: string | null = null;

    await db.transaction(async (tx) => {
      // 如果有下一阶段，初始化其记录
      if (!isCompleted && nextStageId) {
        const nextStage = sopStages[nextIndex];
        const initialStatus = nextStage.type === 'input' ? 'waiting_input' : 'active';
        const nextRecord: StageRecord = {
          stageId: nextStageId,
          status: initialStatus,
          startedAt: nowStr,
        };

        // render 阶段：自动创建 visual 文档
        if (nextStage.type === 'render') {
          const lastOutput = [...stageHistory].reverse().find((r) => r.status === 'completed' && r.output);
          const docId = generateId();
          const initialContent = lastOutput?.output || `# ${nextStage.label}\n\n`;

          await tx.insert(documents).values({
            id: docId,
            title: `[SOP] ${task.title} - ${nextStage.label}`,
            content: initialContent,
            type: 'report',
            source: 'local',
            renderMode: 'visual',
            renderTemplateId: nextStage.renderTemplateId || null,
            projectId: task.projectId || null,
            createdAt: now,
            updatedAt: now,
          });

          nextRecord.renderDocumentId = docId;
          nextRenderDocId = docId;
        }

        stageHistory.push(nextRecord);
      }

      // 更新任务
      await tx
        .update(tasks)
        .set({
          currentStageId: nextStageId,
          stageHistory: stageHistory,
          status: isCompleted ? 'reviewing' : task.status,
          progress: Math.round(((currentIndex + 1) / sopStages.length) * 100),
          updatedAt: now,
        })
        .where(eq(tasks.id, task_id));
    });

    // 事务成功后发送事件通知
    if (nextRenderDocId) {
      const { eventBus } = await import('@/lib/event-bus');
      eventBus.emit({ type: 'document_update', resourceId: nextRenderDocId });
    }

    this.emitUpdate(task_id);
    this.log('Stage advanced', task_id, {
      completedStage: task.currentStageId,
      nextStage: nextStageId,
      isCompleted,
    });

    // 渲染阶段完成通知
    let stageResultNotification: string | null = null;
    try {
      const completedStage = sopStages[currentIndex];
      const nextStage = !isCompleted && nextStageId ? sopStages[nextIndex] : null;
      stageResultNotification = await renderTemplateWithContext('sop-stage-result', {
        timestamp: new Date().toLocaleString('zh-CN'),
        task_id,
        task_title: task.title,
        sop_name: template.name,
        completed_stage_label: completedStage.label,
        completed_stage_index: currentIndex + 1,
        total_stages: sopStages.length,
        stage_output: stage_output || '',
        is_sop_completed: isCompleted,
        has_next_stage: !isCompleted && !!nextStage,
        next_stage_label: nextStage?.label || '',
        next_stage_type: nextStage?.type || '',
        progress: Math.round(((currentIndex + 1) / sopStages.length) * 100),
      });
    } catch {
      // 模板渲染失败不影响核心流程
    }

    return this.success('Stage advanced', {
      task_id,
      completed_stage: task.currentStageId,
      next_stage: nextStageId,
      is_sop_completed: isCompleted,
      progress: Math.round(((currentIndex + 1) / sopStages.length) * 100),
      render_document_id: nextRenderDocId,
      stage_result_notification: stageResultNotification,
    });
  }

  /**
   * request_sop_confirm - AI 请求人工确认当前阶段产出
   */
  private async handleRequestSopConfirm(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'confirm_message', 'stage_output');
    if (validation) return validation;

    const { task_id, confirm_message, stage_output } = params as {
      task_id: string;
      confirm_message: string;
      stage_output: string;
    };

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, task_id),
    });

    if (!task || !task.currentStageId) {
      return this.failure('Task not found or SOP execution not started');
    }

    // 更新阶段历史，标记为等待确认
    const stageHistory = (task.stageHistory || []) as StageRecord[];
    const currentIndex = stageHistory.findIndex((h) => h.stageId === task.currentStageId);
    const nowStr = new Date().toISOString();

    if (currentIndex >= 0) {
      stageHistory[currentIndex] = {
        ...stageHistory[currentIndex],
        status: 'waiting_confirm',
        output: stage_output,
        outputType: 'text',
      };
    } else {
      stageHistory.push({
        stageId: task.currentStageId,
        status: 'waiting_confirm',
        output: stage_output,
        outputType: 'text',
        startedAt: nowStr,
      });
    }

    await db
      .update(tasks)
      .set({
        stageHistory: stageHistory,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task_id));

    this.emitUpdate(task_id);
    this.log('Confirmation requested', task_id, { stageId: task.currentStageId });

    // 渲染确认请求通知
    let confirmNotification: string | null = null;
    try {
      const sopTemplate = task.sopTemplateId
        ? await db.query.sopTemplates.findFirst({ where: eq(sopTemplates.id, task.sopTemplateId) })
        : null;
      const stages = (sopTemplate?.stages || []) as SOPStage[];
      const stageIndex = stages.findIndex((s) => s.id === task.currentStageId);
      const currentSopStage = stageIndex >= 0 ? stages[stageIndex] : null;

      confirmNotification = await renderTemplateWithContext('sop-confirm-request', {
        timestamp: new Date().toLocaleString('zh-CN'),
        task_id,
        task_title: task.title,
        sop_name: sopTemplate?.name || '',
        stage_label: currentSopStage?.label || '',
        stage_index: stageIndex + 1,
        total_stages: stages.length,
        confirm_message,
        stage_output,
      });
    } catch {
      // 模板渲染失败不影响核心流程
    }

    // 发送确认请求事件
    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({
      type: 'sop_confirm_request',
      resourceId: task_id,
      data: { message: confirm_message, notification: confirmNotification },
    });

    return this.success('Confirmation requested', {
      task_id,
      stage_id: task.currentStageId,
      confirm_message,
      awaiting_confirmation: true,
      confirm_notification: confirmNotification,
    });
  }

  /**
   * get_sop_context - 获取当前 SOP 执行上下文
   */
  private async handleGetSopContext(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id');
    if (validation) return validation;

    const { task_id } = params as { task_id: string };

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, task_id),
    });

    if (!task) {
      return this.failure('Task not found');
    }

    if (!task.sopTemplateId) {
      return this.failure('Task is not bound to a SOP template');
    }

    // 获取 SOP 模板
    const template = await db.query.sopTemplates.findFirst({
      where: eq(sopTemplates.id, task.sopTemplateId),
    });

    if (!template) {
      return this.failure('SOP template not found');
    }

    const stages = template.stages as SOPStage[];
    const stageHistory = (task.stageHistory || []) as StageRecord[];
    const currentStage = stages.find((s) => s.id === task.currentStageId);
    const currentIndex = stages.findIndex((s) => s.id === task.currentStageId);

    // 获取前序阶段产出
    const previousOutputs = stageHistory
      .filter((h) => h.status === 'completed' && h.output)
      .map((h) => ({
        stage_id: h.stageId,
        stage_label: stages.find((s) => s.id === h.stageId)?.label || h.stageId,
        output: h.output,
        output_type: h.outputType,
      }));

    // 知识库内容（分层读取）
    let knowledgeContent: string | null = null;
    if (template.knowledgeConfig) {
      const config = template.knowledgeConfig as KnowledgeConfig;
      if (config.documentId) {
        const doc = await db.query.documents.findFirst({
          where: eq(documents.id, config.documentId),
        });
        if (doc?.content && typeof doc.content === 'string') {
          const parsed = parseKnowHow(doc.content);
          // 使用当前阶段配置的层级，默认 L1
          const requestedLayers = (currentStage?.knowledgeLayers as Array<'L1' | 'L2' | 'L3' | 'L4' | 'L5'>) || ['L1'];
          knowledgeContent = extractLayers(parsed, requestedLayers);
        }
      }
    }

    return this.success('SOP context retrieved', {
      task_id,
      task_title: task.title,
      task_description: task.description,
      sop_template: {
        id: template.id,
        name: template.name,
        system_prompt: template.systemPrompt,
      },
      current_stage: currentStage
        ? {
            id: currentStage.id,
            label: currentStage.label,
            type: currentStage.type,
            prompt_template: currentStage.promptTemplate,
            output_type: currentStage.outputType,
            require_confirm: currentStage.type === 'ai_with_confirm',
          }
        : null,
      progress: {
        current_index: currentIndex,
        total_stages: stages.length,
        percentage: currentIndex >= 0 ? Math.round((currentIndex / stages.length) * 100) : 0,
      },
      previous_outputs: previousOutputs,
      sop_inputs: task.sopInputs,
      knowledge_content: knowledgeContent,
    });
  }

  /**
   * save_stage_output - 保存当前阶段产出（不推进）
   */
  private async handleSaveStageOutput(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'output');
    if (validation) return validation;

    const { task_id, output, output_type = 'text' } = params as {
      task_id: string;
      output: string;
      output_type?: string;
    };

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, task_id),
    });

    if (!task || !task.currentStageId) {
      return this.failure('Task not found or SOP execution not started');
    }

    // 更新阶段历史
    const stageHistory = (task.stageHistory || []) as StageRecord[];
    const currentIndex = stageHistory.findIndex((h) => h.stageId === task.currentStageId);
    const nowStr = new Date().toISOString();

    // 校验 output_type 是否为合法的 StageOutputType
    const validOutputTypes: StageOutputType[] = ['text', 'markdown', 'html', 'data', 'file'];
    const validOutputType: StageOutputType = validOutputTypes.includes(output_type as StageOutputType)
      ? (output_type as StageOutputType)
      : 'text';

    // 保留已有的 status
    const existingStatus = currentIndex >= 0 ? stageHistory[currentIndex].status : 'active';
    const updatedRecord: StageRecord = {
      stageId: task.currentStageId,
      status: existingStatus,
      output: output,
      outputType: validOutputType,
      startedAt: currentIndex >= 0 ? stageHistory[currentIndex].startedAt : nowStr,
    };

    if (currentIndex >= 0) {
      stageHistory[currentIndex] = updatedRecord;
    } else {
      stageHistory.push(updatedRecord);
    }

    await db
      .update(tasks)
      .set({
        stageHistory: stageHistory,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task_id));

    this.emitUpdate(task_id);
    this.log('Stage output saved', task_id, { stageId: task.currentStageId });

    return this.success('Stage output saved', {
      task_id,
      stage_id: task.currentStageId,
      output_saved: true,
    });
  }

  /**
   * update_knowledge - 向知识库追加内容
   *
   * 支持两种模式：
   * 1. Know-how 文档（含 L1-L5 分层）：智能追加到 L4 经验记录
   * 2. 普通文档：以分隔线追加到末尾
   */
  private async handleUpdateKnowledge(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'document_id', 'content');
    if (validation) return validation;

    const { document_id, content, layer } = params as {
      document_id: string;
      content: string;
      layer?: string;
    };

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, document_id),
    });

    if (!doc) {
      return this.failure('Document not found');
    }

    const existingContent = (typeof doc.content === 'string' ? doc.content : '') || '';
    let newContent: string;
    let appendMode: string;

    // 检查是否为 Know-how 文档（包含 L1/L2 等分层标记）
    const isKnowHow = /^##\s+L[1-5]\b/m.test(existingContent);

    if (isKnowHow && (layer === 'L4' || !layer)) {
      // Know-how 文档：智能追加到 L4
      newContent = appendToL4(existingContent, content);
      appendMode = 'knowhow_l4';
    } else {
      // 普通文档：以分隔线追加到末尾
      const timestamp = new Date().toISOString().split('T')[0];
      newContent = `${existingContent}\n\n---\n\n### ${timestamp} 更新\n\n${content}`;
      appendMode = 'append';
    }

    await db
      .update(documents)
      .set({
        content: newContent,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, document_id));

    // 使用 document_update 事件类型
    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({ type: 'document_update', resourceId: document_id });

    this.log('Knowledge updated', document_id, { appendMode });

    return this.success('Knowledge updated', {
      document_id,
      appended: true,
      mode: appendMode,
    });
  }

  // ========== AI 自主创作工具 ==========

  /**
   * create_sop_template - AI 创建 SOP 模板
   */
  private async handleCreateSopTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const {
      name,
      description = '',
      category = 'custom',
      stages,
      system_prompt,
      required_tools,
      quality_checklist,
      project_id,
    } = params as {
      name?: string;
      description?: string;
      category?: string;
      stages?: SOPStage[];
      system_prompt?: string;
      required_tools?: string[];
      quality_checklist?: string[];
      project_id?: string;
    };

    if (!name || !stages || stages.length === 0) {
      return this.failure('Missing required parameters: name, stages (at least 1 stage)');
    }

    // 校验阶段
    const validTypes = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
    for (const stage of stages) {
      if (!stage.id || !stage.label || !stage.type) {
        return this.failure('Each stage must contain id, label, type');
      }
      if (!validTypes.includes(stage.type)) {
        return this.failure(`Invalid stage type: ${stage.type}`);
      }
    }

    // 校验 category
    const validCategories: SOPCategory[] = [
      'content',
      'analysis',
      'research',
      'development',
      'operations',
      'media',
      'custom',
    ];
    const finalCategory: SOPCategory = validCategories.includes(category as SOPCategory)
      ? (category as SOPCategory)
      : 'custom';

    const id = generateId();
    const now = new Date();

    await db.insert(sopTemplates).values({
      id,
      name,
      description,
      category: finalCategory,
      icon: 'clipboard-list',
      status: 'draft',
      stages: stages,
      requiredTools: required_tools || [],
      systemPrompt: system_prompt || '',
      qualityChecklist: quality_checklist || [],
      projectId: project_id || null,
      createdBy: 'ai',
      createdAt: now,
      updatedAt: now,
    });

    // 使用 sop_template_update 事件类型
    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({ type: 'sop_template_update', resourceId: id });

    this.log('SOP template created', id, { name, category: finalCategory });

    return this.success(
      'SOP template created (draft status), please confirm in management page to activate',
      {
        id,
        name,
        status: 'draft',
      }
    );
  }

  /**
   * update_sop_template - AI 更新 SOP 模板
   */
  private async handleUpdateSopTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const { template_id, ...updates } = params as {
      template_id?: string;
      name?: string;
      description?: string;
      stages?: SOPStage[];
      system_prompt?: string;
      required_tools?: string[];
      quality_checklist?: string[];
      status?: string;
    };

    if (!template_id) {
      return this.failure('Missing template_id');
    }

    const template = await db.query.sopTemplates.findFirst({
      where: eq(sopTemplates.id, template_id),
    });

    if (!template) {
      return this.failure('SOP template not found');
    }

    // 校验阶段（如果提供了）
    if (updates.stages) {
      const validTypes = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
      for (const stage of updates.stages) {
        if (!stage.id || !stage.label || !stage.type) {
          return this.failure('Each stage must contain id, label, type');
        }
        if (!validTypes.includes(stage.type)) {
          return this.failure(`Invalid stage type: ${stage.type}`);
        }
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.stages !== undefined) updateData.stages = updates.stages;
    if (updates.system_prompt !== undefined) updateData.systemPrompt = updates.system_prompt;
    if (updates.required_tools !== undefined) updateData.requiredTools = updates.required_tools;
    if (updates.quality_checklist !== undefined) updateData.qualityChecklist = updates.quality_checklist;
    if (updates.status !== undefined) updateData.status = updates.status;

    await db.update(sopTemplates).set(updateData).where(eq(sopTemplates.id, template_id));

    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({ type: 'sop_template_update', resourceId: template_id });

    this.log('SOP template updated', template_id);

    return this.success('SOP template updated', {
      id: template_id,
      updated: true,
    });
  }

  /**
   * create_render_template - AI 创建渲染模板
   */
  private async handleCreateRenderTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const {
      name,
      description = '',
      category = 'custom',
      html_template,
      css_template = '',
      md_template,
      slots,
      sections = [],
      export_config = {},
    } = params as {
      name?: string;
      description?: string;
      category?: string;
      html_template?: string;
      css_template?: string;
      md_template?: string;
      slots?: Record<string, unknown>;
      sections?: Array<{ id: string; label: string; slotIds?: string[] }>;
      export_config?: Record<string, unknown>;
    };

    if (!name || !html_template || !md_template || !slots) {
      return this.failure(
        'Missing required parameters: name, html_template, md_template, slots'
      );
    }

    // HTML 安全校验
    const dangerousPatterns = [
      /<script[\s>]/i,
      /on\w+\s*=/i,
      /javascript\s*:/i,
      /<iframe[\s>]/i,
      /<object[\s>]/i,
      /<embed[\s>]/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(html_template)) {
        return this.failure(`HTML template contains unsafe content: ${pattern.source}`);
      }
    }

    // 检查是否有 data-slot
    if (!html_template.includes('data-slot')) {
      return this.failure(
        'HTML template must contain at least one data-slot attribute to mark editable areas'
      );
    }

    // 校验 category
    type RenderCategory = 'report' | 'card' | 'poster' | 'presentation' | 'custom';
    const validCategories: RenderCategory[] = ['report', 'card', 'poster', 'presentation', 'custom'];
    const finalCategory: RenderCategory = validCategories.includes(category as RenderCategory)
      ? (category as RenderCategory)
      : 'custom';

    const id = generateId();
    const now = new Date();

    await db.insert(renderTemplates).values({
      id,
      name,
      description,
      category: finalCategory,
      status: 'draft',
      htmlTemplate: html_template,
      cssTemplate: css_template,
      mdTemplate: md_template,
      slots: slots as Record<
        string,
        { label: string; type: 'text' | 'richtext' | 'image' | 'data'; description?: string; placeholder?: string }
      >,
      sections: sections.map((s) => ({ id: s.id, label: s.label, slots: s.slotIds || [] })),
      exportConfig: {
        formats: ['jpg', 'html'],
        ...export_config,
      } as {
        formats: ('jpg' | 'png' | 'html' | 'pdf')[];
        defaultWidth?: number;
        defaultScale?: number;
        mode?: '16:9' | 'long' | 'a4' | 'custom';
      },
      createdBy: 'ai',
      createdAt: now,
      updatedAt: now,
    });

    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({ type: 'render_template_update', resourceId: id });

    this.log('Render template created', id, { name, category: finalCategory });

    return this.success(
      'Render template created (draft status), please confirm in management page to activate',
      {
        id,
        name,
        status: 'draft',
      }
    );
  }

  /**
   * update_render_template - AI 更新渲染模板
   */
  private async handleUpdateRenderTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const { template_id, ...updates } = params as {
      template_id?: string;
      name?: string;
      description?: string;
      html_template?: string;
      css_template?: string;
      md_template?: string;
      slots?: Record<string, unknown>;
      sections?: Array<{ id: string; label: string; slotIds?: string[] }>;
      export_config?: Record<string, unknown>;
      status?: string;
    };

    if (!template_id) {
      return this.failure('Missing template_id');
    }

    const template = await db.query.renderTemplates.findFirst({
      where: eq(renderTemplates.id, template_id),
    });

    if (!template) {
      return this.failure('Render template not found');
    }

    // HTML 安全校验（如果提供了）
    if (updates.html_template) {
      const dangerousPatterns = [
        /<script[\s>]/i,
        /on\w+\s*=/i,
        /javascript\s*:/i,
        /<iframe[\s>]/i,
        /<object[\s>]/i,
        /<embed[\s>]/i,
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(updates.html_template)) {
          return this.failure(`HTML template contains unsafe content: ${pattern.source}`);
        }
      }
      if (!updates.html_template.includes('data-slot')) {
        return this.failure('HTML template must contain at least one data-slot attribute');
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.html_template !== undefined) updateData.htmlTemplate = updates.html_template;
    if (updates.css_template !== undefined) updateData.cssTemplate = updates.css_template;
    if (updates.md_template !== undefined) updateData.mdTemplate = updates.md_template;
    if (updates.slots !== undefined) updateData.slots = updates.slots;
    if (updates.sections !== undefined) {
      updateData.sections = Array.isArray(updates.sections)
        ? updates.sections.map((s) => ({ id: s.id, label: s.label, slots: s.slotIds || [] }))
        : updates.sections;
    }
    if (updates.export_config !== undefined) updateData.exportConfig = updates.export_config;
    if (updates.status !== undefined) updateData.status = updates.status;

    await db.update(renderTemplates).set(updateData).where(eq(renderTemplates.id, template_id));

    const { eventBus } = await import('@/lib/event-bus');
    eventBus.emit({ type: 'render_template_update', resourceId: template_id });

    this.log('Render template updated', template_id);

    return this.success('Render template updated', {
      id: template_id,
      updated: true,
    });
  }

  /**
   * list_render_templates - 获取渲染模板列表
   */
  private async handleListRenderTemplates(params: Record<string, unknown>): Promise<HandlerResult> {
    const { category, status = 'active' } = params as { category?: string; status?: string };
    const { and } = await import('drizzle-orm');

    // 构建查询条件
    const conditions = [];
    if (category && category !== 'all') {
      conditions.push(eq(renderTemplates.category, category as 'report' | 'card' | 'poster' | 'presentation' | 'custom'));
    }
    if (status && status !== 'all') {
      conditions.push(eq(renderTemplates.status, status as 'draft' | 'active' | 'archived'));
    }

    // 查询模板列表
    const templates = await db.query.renderTemplates.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        name: true,
        description: true,
        category: true,
        status: true,
        thumbnail: true,
        isBuiltin: true,
      },
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    this.log('Listed render templates', `count: ${templates.length}`);

    return this.success('Render templates fetched', { templates });
  }

  /**
   * get_render_template - 获取渲染模板详情
   */
  private async handleGetRenderTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const { template_id } = params as { template_id?: string };

    if (!template_id) {
      return this.failure('Missing template_id');
    }

    const template = await db.query.renderTemplates.findFirst({
      where: eq(renderTemplates.id, template_id),
    });

    if (!template) {
      return this.failure(`Render template not found: ${template_id}`);
    }

    this.log('Fetched render template detail', template_id);

    return this.success('Render template fetched', { template });
  }
}

// 导出单例
export const sopHandler = new SOPHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleAdvanceSopStage(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'advance_stage' }, {});
}

export async function handleRequestSopConfirm(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'request_confirm' }, {});
}

export async function handleGetSopContext(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'get_context' }, {});
}

export async function handleSaveStageOutput(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'save_stage_output' }, {});
}

export async function handleUpdateKnowledge(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'update_knowledge' }, {});
}

export async function handleCreateSopTemplate(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'create_template' }, {});
}

export async function handleUpdateSopTemplate(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'update_template' }, {});
}

export async function handleCreateRenderTemplate(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'create_render_template' }, {});
}

export async function handleUpdateRenderTemplate(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'update_render_template' }, {});
}

export async function handleListRenderTemplates(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'list_render_templates' }, {});
}

export async function handleGetRenderTemplate(params: Record<string, unknown>) {
  return sopHandler.execute({ ...params, action: 'get_render_template' }, {});
}

// 默认导出
export default sopHandler;
