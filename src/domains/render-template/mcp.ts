/**
 * 模板库 MCP Handler
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 50%
 */

import { renderTemplateWithContext, listTemplates } from '@/lib/template-engine';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';

/**
 * Template Handler - 继承 McpHandlerBase 基类
 */
class TemplateHandler extends McpHandlerBase<unknown> {
  constructor() {
    super('Template');
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
      case 'get':
        return this.handleGetTemplate(params);
      case 'list':
        return this.handleListTemplates();
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取模板
   */
  private async handleGetTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'template_name');
    if (validation) return validation;

    const { template_name, ...extraParams } = params as { template_name: string; [key: string]: unknown };

    try {
      const rendered = await renderTemplateWithContext(template_name, extraParams);
      if (!rendered) {
        return this.failure(`Template "${template_name}" not found`);
      }

      return this.success(`Template "${template_name}" rendered`, {
        template_name,
        content: rendered,
      });
    } catch (error) {
      this.logError('Get template', error, template_name);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to get template', message);
    }
  }

  /**
   * 列出所有模板
   */
  private async handleListTemplates(): Promise<HandlerResult> {
    try {
      const templates = listTemplates();
      return this.success(`${templates.length} templates available`, {
        templates,
      });
    } catch (error) {
      this.logError('List templates', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to list templates', message);
    }
  }
}

// 导出单例
export const templateHandler = new TemplateHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleGetTemplate(params: Record<string, unknown>) {
  return templateHandler.execute({ ...params, action: 'get' }, {});
}

export async function handleListTemplates() {
  return templateHandler.execute({ action: 'list' }, {});
}

// 默认导出
export default templateHandler;
