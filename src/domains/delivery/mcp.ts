/**
 * MCP Handler: 文档交付操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 45%
 */

import { db } from '@/db';
import { deliveries, tasks, members, documents } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateDeliveryId } from '@/lib/id';
import { resolveAIMemberId, resolveHumanMemberId } from '@/core/member-resolver';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Delivery } from '@/db/schema';

// 动态导入避免循环依赖: delivery.handler -> server-gateway-client -> chat-channel/executor -> delivery.handler
async function getGatewayClient() {
  const { getServerGatewayClient } = await import('@/lib/server-gateway-client');
  return getServerGatewayClient();
}

/** 获取 TeamClaw 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建交付记录访问链接 */
function buildDeliveryUrl(deliveryId: string): string {
  return `${getBaseUrl()}/deliveries?delivery=${deliveryId}`;
}

/**
 * Delivery Handler - 继承 McpHandlerBase 基类
 */
class DeliveryHandler extends McpHandlerBase<Delivery> {
  constructor() {
    super('Delivery', 'delivery_update');
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
      case 'deliver':
        return this.handleDeliverDocument(params);
      case 'review':
        return this.handleReviewDelivery(params);
      case 'list_my':
        return this.handleListMyDeliveries(params);
      case 'get':
        return this.handleGetDelivery(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 交付文档
   * - 如果文档已有 delivery_id → 更新现有记录，递增 version
   * - 如果文档没有 delivery_id → 创建新记录
   */
  private async handleDeliverDocument(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'title', 'platform');
    if (validation) return validation;

    const { title, description, platform, external_url, task_id, document_id } = params as {
      title: string;
      description?: string;
      platform: 'tencent-doc' | 'feishu' | 'notion' | 'local' | 'other';
      external_url?: string;
      task_id?: string;
      document_id?: string;
    };

    const member_id = params.member_id as string | undefined;
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    // 验证平台特定参数
    if (platform === 'local' && !document_id) {
      return this.failure('Local delivery requires document_id');
    }
    if (platform !== 'local' && !external_url) {
      return this.failure('External delivery requires external_url');
    }

    try {
      const now = new Date();
      let deliveryId: string | undefined;
      let newVersion = 1;

      // 检查文档是否已有 delivery_id
      if (document_id) {
        const existingDoc = await db.select().from(documents).where(eq(documents.id, document_id)).then(r => r[0]);
        if (existingDoc?.content) {
          // 解析 frontmatter 获取 delivery_id
          const fmMatch = existingDoc.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (fmMatch) {
            const fmLines = fmMatch[1].split('\n');
            for (const line of fmLines) {
              const match = line.match(/^delivery_id:\s*(.+)$/);
              if (match) {
                deliveryId = match[1].trim();
                break;
              }
            }
          }
        }

        // 如果已有 delivery_id，获取当前最大 version 并递增
        if (deliveryId) {
          const [existingDelivery] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId));
          if (existingDelivery) {
            newVersion = (existingDelivery.version || 1) + 1;
            // 更新现有记录
            await db.update(deliveries).set({
              title,
              description: description || null,
              platform,
              externalUrl: external_url || null,
              taskId: task_id || null,
              status: 'pending',
              version: newVersion,
              reviewerId: null,
              reviewComment: null,
              reviewedAt: null,
              updatedAt: now,
            }).where(eq(deliveries.id, deliveryId));

            this.emitUpdate(deliveryId);
            triggerMarkdownSync('teamclaw:deliveries');
            this.log('Document re-delivered (updated)', deliveryId, { title, platform, version: newVersion });

            return this.success(`Document "${title}" resubmitted (v${newVersion})`, {
              id: deliveryId,
              title,
              version: newVersion,
              url: buildDeliveryUrl(deliveryId),
            });
          }
        }
      }

      // 没有 delivery_id → 创建新记录
      deliveryId = generateDeliveryId();
      await db.insert(deliveries).values({
        id: deliveryId,
        memberId: targetMemberId,
        taskId: task_id || null,
        documentId: document_id || null,
        title,
        description: description || null,
        platform,
        externalUrl: external_url || null,
        status: 'pending',
        version: newVersion,
        createdAt: now,
        updatedAt: now,
      } as any);

      // 写入 delivery_id 到文档 frontmatter
      if (document_id) {
        await this.writeDeliveryIdToDocument(document_id, deliveryId);
      }

      this.emitUpdate(deliveryId);
      triggerMarkdownSync('teamclaw:deliveries');
      this.log('Document delivered', deliveryId, { title, platform });

      return this.success(`Document "${title}" submitted for delivery`, {
        id: deliveryId,
        title,
        version: newVersion,
        url: buildDeliveryUrl(deliveryId),
      });
    } catch (error) {
      this.logError('Deliver document', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to deliver document', message);
    }
  }

  /**
   * 写入 delivery_id 到文档 frontmatter
   */
  private async writeDeliveryIdToDocument(documentId: string, deliveryId: string): Promise<void> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      if (!doc || !doc.content) return;

      const fmMatch = doc.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) return;

      const fmContent = fmMatch[1];
      // 检查是否已有 delivery_id
      if (fmContent.includes('delivery_id:')) {
        // 更新现有
        const updatedFm = fmContent.replace(/^delivery_id:.*$/m, `delivery_id: ${deliveryId}`);
        const newContent = doc.content.replace(/^---[\s\S]*?---\n/, `---\n${updatedFm}\n---\n`);
        await db.update(documents).set({ content: newContent, updatedAt: new Date() }).where(eq(documents.id, documentId));
      } else {
        // 添加新字段
        const updatedFm = fmContent + `\ndelivery_id: ${deliveryId}`;
        const newContent = doc.content.replace(/^---[\s\S]*?---\n/, `---\n${updatedFm}\n---\n`);
        await db.update(documents).set({ content: newContent, updatedAt: new Date() }).where(eq(documents.id, documentId));
      }
    } catch (err) {
      this.logError('Write delivery_id to document', err, documentId);
    }
  }

  /**
   * 审核交付
   */
  private async handleReviewDelivery(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'delivery_id', 'status');
    if (validation) return validation;

    const { delivery_id, status, comment } = params as {
      delivery_id: string;
      status: 'approved' | 'rejected' | 'revision_needed';
      comment?: string;
    };

    // 验证状态枚举值
    const validStatuses = ['approved', 'rejected', 'revision_needed'] as const;
    const statusValidation = this.validateEnum(status, validStatuses, 'status');
    if (statusValidation) return statusValidation;

    return this.withResource(
      delivery_id,
      async (id) => {
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, id));
        return delivery || null;
      },
      async (delivery) => {
        const member_id = params.member_id as string | undefined;
        const resolvedReviewer = await resolveHumanMemberId(member_id);
        if ('error' in resolvedReviewer) {
          return this.failure(resolvedReviewer.error as string);
        }
        const reviewerId = resolvedReviewer.memberId;

        await db.update(deliveries).set({
          status,
          reviewerId: reviewerId || null,
          reviewComment: comment || null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(deliveries.id, delivery_id));

        this.emitUpdate(delivery_id);
        triggerMarkdownSync('teamclaw:deliveries');
        this.log('Reviewed', delivery_id, { status, reviewerId });

        // 同步更新文档 Front Matter + 追加审核历史
        if (delivery.documentId) {
          await this.updateDocumentDeliveryFrontmatter(
            delivery.documentId,
            delivery.version || 1,
            status,
            reviewerId || undefined,
            comment
          );
        }

        // 同步关联任务状态 + 信道通知 agent
        if (delivery.taskId) {
          await this.syncTaskStatusFromReview(delivery.taskId, status, delivery.title, delivery.memberId, comment);
        }

        const statusLabel = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'needs revision';
        return this.success(`Document delivery ${statusLabel}`, { delivery_id, status });
      }
    );
  }

  /**
   * 获取我的交付列表
   */
  private async handleListMyDeliveries(params: Record<string, unknown>): Promise<HandlerResult> {
    const { status = 'all', limit = 20 } = params as {
      status?: 'pending' | 'approved' | 'rejected' | 'revision_needed' | 'all';
      limit?: number;
    };

    const member_id = params.member_id as string | undefined;
    const resolved = await resolveAIMemberId(member_id);
    if ('error' in resolved) return this.failure(resolved.error);
    const targetMemberId = resolved.memberId;

    try {
      const whereCondition = status === 'all'
        ? eq(deliveries.memberId, targetMemberId)
        : and(eq(deliveries.memberId, targetMemberId), eq(deliveries.status, status));

      const results = await db.select().from(deliveries)
        .where(whereCondition)
        .orderBy(desc(deliveries.updatedAt))
        .limit(limit);

      const deliveryList = results.map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
        platform: d.platform,
        document_id: d.documentId,
        task_id: d.taskId,
        created_at: d.createdAt?.toISOString(),
        updated_at: d.updatedAt?.toISOString(),
      }));

      return this.success('Deliveries retrieved', {
        total: deliveryList.length,
        deliveries: deliveryList,
      });
    } catch (error) {
      this.logError('List my deliveries', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to query delivery list', message);
    }
  }

  /**
   * 获取交付详情
   * 优化：使用单次 JOIN 查询替代多次独立查询（N+1 问题修复）
   */
  private async handleGetDelivery(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'delivery_id');
    if (validation) return validation;

    const { delivery_id } = params as { delivery_id: string };

    try {
      // 使用单次 JOIN 查询获取所有关联数据
      const result = await db
        .select({
          delivery: deliveries,
          document: {
            id: documents.id,
            title: documents.title,
            type: documents.type,
          },
          task: {
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
          },
          reviewer: {
            id: members.id,
            name: members.name,
          },
        })
        .from(deliveries)
        .leftJoin(documents, eq(deliveries.documentId, documents.id))
        .leftJoin(tasks, eq(deliveries.taskId, tasks.id))
        .leftJoin(members, eq(deliveries.reviewerId, members.id))
        .where(eq(deliveries.id, delivery_id))
        .limit(1);

      const [row] = result;

      if (!row?.delivery) {
        return this.failure('Delivery not found');
      }

      const { delivery, document, task, reviewer } = row;

      return this.success('Delivery retrieved', {
        id: delivery.id,
        title: delivery.title,
        description: delivery.description,
        status: delivery.status,
        platform: delivery.platform,
        external_url: delivery.externalUrl,
        version: delivery.version,
        review_comment: delivery.reviewComment,
        reviewed_at: delivery.reviewedAt?.toISOString(),
        created_at: delivery.createdAt?.toISOString(),
        updated_at: delivery.updatedAt?.toISOString(),
        document: document?.id ? { id: document.id, title: document.title, type: document.type } : null,
        task: task?.id ? { id: task.id, title: task.title, status: task.status } : null,
        reviewer: reviewer?.id ? { id: reviewer.id, name: reviewer.name } : null,
      });
    } catch (error) {
      this.logError('Get delivery', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to retrieve delivery', message);
    }
  }

  /**
   * 更新文档 Front Matter 中的交付字段 + 追加审核历史
   * 审核历史格式：<!-- [v1 R @14:56] 审核意见 -->
   */
  private async updateDocumentDeliveryFrontmatter(
    documentId: string,
    version: number,
    status: 'approved' | 'rejected' | 'revision_needed',
    reviewerId?: string,
    comment?: string,
  ): Promise<void> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      if (!doc || !doc.content) return;

      // 获取审核人名称
      let reviewerName = '';
      if (reviewerId) {
        const [reviewer] = await db.select().from(members).where(eq(members.id, reviewerId));
        reviewerName = reviewer?.name || '';
      }

      // 更新 Front Matter
      const updatedContent = this.updateFrontmatterDeliveryFields(doc.content, {
        delivery_status: status,
        delivery_reviewer: reviewerName,
        delivery_comment: comment || '',
      });

      // 追加审核历史到 frontmatter 下方
      const finalContent = this.appendReviewHistory(updatedContent, version, status, reviewerName, comment);

      if (finalContent !== doc.content) {
        await db.update(documents).set({
          content: finalContent,
          updatedAt: new Date(),
        }).where(eq(documents.id, documentId));
        this.emitUpdate(documentId);
      }
    } catch (err) {
      this.logError('Update document frontmatter', err, documentId);
    }
  }

  /**
   * 追加审核历史到文档头部（frontmatter 下方）
   * 格式：<!-- [v1 R @14:56] 审核意见 -->
   */
  private appendReviewHistory(
    content: string,
    version: number,
    status: 'approved' | 'rejected' | 'revision_needed',
    reviewerName: string,
    comment?: string,
  ): string {
    // 生成时间戳 MMDD:hh:mm
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 状态简写：R=rejected, A=approved, N=revision_needed
    const statusMap: Record<string, string> = {
      approved: 'A',
      rejected: 'R',
      revision_needed: 'N',
    };
    const statusCode = statusMap[status] || '?';

    // 构建审核历史批注
    const historyNote = comment
      ? `<!-- [v${version} ${statusCode} @${hhmm}] ${comment} -->`
      : `<!-- [v${version} ${statusCode} @${hhmm}] -->`;

    // 插入到 frontmatter 下方（第一个空行之后）
    const frontmatterEnd = content.indexOf('---', 4);
    if (frontmatterEnd === -1) return content;

    // 找到 frontmatter 结束后的位置
    let insertPos = frontmatterEnd + 3;
    // 跳过可能的空行
    while (insertPos < content.length && (content[insertPos] === '\n' || content[insertPos] === '\r')) {
      insertPos++;
    }

    // 检查是否已存在相同版本的审核历史，有则替换
    const versionPattern = new RegExp(`<!-- \\[v${version} \\w+ @\\d{2}:\\d{2}\\]`);
    if (versionPattern.test(content)) {
      // 替换该版本的审核历史
      return content.replace(versionPattern, `<!-- [v${version} ${statusCode} @${hhmm}`);
    }

    // 插入新审核历史
    return content.slice(0, insertPos) + '\n' + historyNote + content.slice(insertPos);
  }

  /**
   * 更新文档 Front Matter 中的交付字段
   */
  private updateFrontmatterDeliveryFields(
    content: string,
    fields: {
      delivery_status: string;
      delivery_reviewer: string;
      delivery_comment: string;
    }
  ): string {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return content;

    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split('\n');
    const updatedLines: string[] = [];
    const updatedKeys = new Set<string>();

    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):\s*(.*)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        if (key === 'delivery_status') {
          updatedLines.push(`delivery_status: ${fields.delivery_status}`);
          updatedKeys.add('delivery_status');
        } else if (key === 'delivery_reviewer') {
          updatedLines.push(`delivery_reviewer: ${fields.delivery_reviewer}`);
          updatedKeys.add('delivery_reviewer');
        } else if (key === 'delivery_comment') {
          updatedLines.push(`delivery_comment: ${fields.delivery_comment}`);
          updatedKeys.add('delivery_comment');
        } else if (key === 'updated') {
          updatedLines.push(`updated: ${new Date().toISOString()}`);
        } else {
          updatedLines.push(line);
        }
      } else {
        updatedLines.push(line);
      }
    }

    // 添加缺失的字段
    if (!updatedKeys.has('delivery_status')) {
      updatedLines.push(`delivery_status: ${fields.delivery_status}`);
    }
    if (!updatedKeys.has('delivery_reviewer') && fields.delivery_reviewer) {
      updatedLines.push(`delivery_reviewer: ${fields.delivery_reviewer}`);
    }
    if (!updatedKeys.has('delivery_comment') && fields.delivery_comment) {
      updatedLines.push(`delivery_comment: ${fields.delivery_comment}`);
    }

    const newFrontmatter = updatedLines.join('\n');
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFrontmatter}\n---`);
  }

  /**
   * 审核状态 -> 任务状态映射 + 信道通知
   */
  private async syncTaskStatusFromReview(
    taskId: string,
    reviewStatus: string,
    deliveryTitle: string,
    memberId: string,
    reviewComment?: string,
  ): Promise<void> {
    try {
      type TaskStatus = 'todo' | 'in_progress' | 'reviewing' | 'completed';
      const taskStatusMap: Record<string, TaskStatus> = {
        approved: 'completed',
        revision_needed: 'in_progress',
        rejected: 'in_progress',
      };
      const newTaskStatus = taskStatusMap[reviewStatus];
      if (!newTaskStatus) return;

      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) return;

      await db.update(tasks).set({
        status: newTaskStatus,
        updatedAt: new Date(),
      }).where(eq(tasks.id, taskId));

      // 注意：这里使用 task_update 事件类型，不是 delivery_update
      // 所以直接调用 eventBus
      const { eventBus } = await import('@/lib/event-bus');
      eventBus.emit({ type: 'task_update', resourceId: taskId });
      triggerMarkdownSync('teamclaw:tasks');

      // 需要修改/退回时，通过信道通知 agent
      if (reviewStatus === 'revision_needed' || reviewStatus === 'rejected') {
        await this.notifyAgentViaChat(memberId, deliveryTitle, reviewStatus, reviewComment);
      }
    } catch (err) {
      this.logError('Sync task status from review', err, taskId);
    }
  }

  /**
   * 通过 Gateway 信道通知 agent 审核结果
   */
  private async notifyAgentViaChat(
    memberId: string,
    deliveryTitle: string,
    reviewStatus: string,
    reviewComment?: string,
  ): Promise<void> {
    try {
      const client = await getGatewayClient();
      if (!client.isConnected) return;

      const [member] = await db.select().from(members).where(
        and(eq(members.id, memberId), eq(members.type, 'ai'))
      );
      if (!member) return;

      const agentId = member.openclawAgentId || member.openclawName;
      if (!agentId) return;

      // 通过 Gateway agents.list 获取准确的 mainKey 作为 sessionKey
      let sessionKey = `agent:${agentId}`;
      try {
        const agentsResult = await client.request('agents.list', {}) as { mainKey?: string };
        if (agentsResult?.mainKey) {
          sessionKey = agentsResult.mainKey;
        }
      } catch {
        // fallback 到拼接的 sessionKey
      }

      const statusLabel = reviewStatus === 'revision_needed' ? 'needs revision' : 'rejected';
      const commentPart = reviewComment ? `\nReview comment: ${reviewComment}` : '';
      const message = `[TeamClaw Review Notification] Your document "${deliveryTitle}" review result: ${statusLabel}.${commentPart}\nPlease revise and resubmit based on the review comments.`;

      await client.request('chat.send', {
        sessionKey,
        message,
        idempotencyKey: `review-notify-${memberId}-${Date.now()}`,
      });
    } catch (err) {
      this.logError('Notify agent via chat', err, memberId);
    }
  }
}

// 导出单例
export const deliveryHandler = new DeliveryHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleDeliverDocument(params: Record<string, unknown>) {
  return deliveryHandler.execute({ ...params, action: 'deliver' }, {});
}

export async function handleReviewDelivery(params: Record<string, unknown>) {
  return deliveryHandler.execute({ ...params, action: 'review' }, {});
}

export async function handleListMyDeliveries(params: Record<string, unknown>) {
  return deliveryHandler.execute({ ...params, action: 'list_my' }, {});
}

export async function handleGetDelivery(params: Record<string, unknown>) {
  return deliveryHandler.execute({ ...params, action: 'get' }, {});
}

// 默认导出
export default deliveryHandler;
