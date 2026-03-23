/**
 * 对话信道 - 增量更新模块
 *
 * 功能：
 * - 增量数据广播
 * - Store 增量更新
 * - 与全量刷新共存
 *
 * @module lib/chat-channel/incremental
 */

import { eventBus } from '@/lib/event-bus';
import { getLogger } from './logger';

const logger = getLogger();

/** 增量更新数据 */
export interface IncrementalUpdate<T = Record<string, unknown>> {
  /** 资源类型 */
  type: string;
  /** 资源 ID */
  id: string;
  /** 变更字段 */
  changes: Partial<T>;
  /** 时间戳 */
  timestamp: number;
  /** 操作类型 */
  operation: 'update' | 'delete' | 'create';
}

/** 任务增量更新 */
export interface TaskIncrementalUpdate {
  id: string;
  status?: string;
  progress?: number;
  assignees?: string[];
  checkItems?: unknown[];
  updatedAt?: Date;
}

/** 文档增量更新 */
export interface DocumentIncrementalUpdate {
  id: string;
  title?: string;
  content?: string;
  docType?: string;
  updatedAt?: Date;
}

/** 交付物增量更新 */
export interface DeliveryIncrementalUpdate {
  id: string;
  status?: string;
  reviewComment?: string;
  reviewedAt?: Date;
  updatedAt?: Date;
}

/**
 * 广播增量更新事件
 *
 * @param update 增量更新数据
 */
export function broadcastIncrementalUpdate<T>(
  update: IncrementalUpdate<T>
): void {
  const eventType = `${update.type}:incremental`;
  
  logger.debug(update.id, `Broadcasting incremental update: ${eventType}`, { data: { changes: Object.keys(update.changes) } });
  
  // 通过 eventBus 广播
  eventBus.emit({
    type: eventType as Parameters<typeof eventBus.emit>[0]['type'],
    resourceId: update.id,
    data: update as unknown as Record<string, unknown>,
  });
  
  // 同时广播通用更新事件（兼容旧逻辑）
  eventBus.emit({
    type: `${update.type}_update` as Parameters<typeof eventBus.emit>[0]['type'],
    resourceId: update.id,
  });
}

/**
 * 广播任务增量更新
 */
export function broadcastTaskUpdate(
  taskId: string,
  changes: Partial<TaskIncrementalUpdate>
): void {
  broadcastIncrementalUpdate<TaskIncrementalUpdate>({
    type: 'task',
    id: taskId,
    changes,
    timestamp: Date.now(),
    operation: 'update',
  });
}

/**
 * 广播文档增量更新
 */
export function broadcastDocumentUpdate(
  docId: string,
  changes: Partial<DocumentIncrementalUpdate>
): void {
  broadcastIncrementalUpdate<DocumentIncrementalUpdate>({
    type: 'document',
    id: docId,
    changes,
    timestamp: Date.now(),
    operation: 'update',
  });
}

/**
 * 广播交付物增量更新
 */
export function broadcastDeliveryUpdate(
  deliveryId: string,
  changes: Partial<DeliveryIncrementalUpdate>
): void {
  broadcastIncrementalUpdate<DeliveryIncrementalUpdate>({
    type: 'delivery',
    id: deliveryId,
    changes,
    timestamp: Date.now(),
    operation: 'update',
  });
}

/**
 * 合并增量更新到现有数据
 *
 * @param current 当前数据
 * @param update 增量更新
 * @returns 合并后的数据
 */
export function mergeIncrementalUpdate<T extends Record<string, unknown>>(
  current: T,
  update: IncrementalUpdate<T>
): T {
  if (update.operation === 'delete') {
    // 删除操作返回 null（由 Store 处理删除）
    return null as unknown as T;
  }
  
  if (update.operation === 'create') {
    // 创建操作，返回新数据
    return { ...update.changes } as T;
  }
  
  // 更新操作，合并变更
  return {
    ...current,
    ...update.changes,
  };
}

/**
 * 创建 Store 增量更新处理器
 *
 * 用于在客户端订阅增量更新事件并合并到本地 Store。
 * 通过 SSE 事件总线接收增量更新，避免全量刷新。
 *
 * @param storeName Store 名称（用于日志和事件匹配）
 * @param getItems 获取当前 items 的函数
 * @param setItems 设置 items 的函数
 * @param onDelete 删除回调（可选）
 * @returns 清理函数（用于取消订阅）
 *
 * @example
 * ```typescript
 * const cleanup = createIncrementalHandler<Task>(
 *   'tasks',
 *   () => useTaskStore.getState().tasks,
 *   (items) => useTaskStore.getState().setTasks(items),
 *   (id) => useTaskStore.getState().deleteTask(id)
 * );
 * ```
 */
export function createIncrementalHandler<T extends { id: string }>(
  storeName: string,
  getItems: () => T[],
  setItems: (items: T[]) => void,
  onDelete?: (id: string) => void
): () => void {
  // 客户端环境检查
  if (typeof window === 'undefined') {
    logger.debug('', `Incremental handler for ${storeName} skipped: not in browser`);
    return () => {};
  }

  // 处理器函数：接收增量更新事件
  const handleIncrementalUpdate = (event: Event) => {
    try {
      const customEvent = event as CustomEvent<IncrementalUpdate<T>>;
      const update = customEvent.detail;

      if (!update || !update.id) {
        logger.warn('', `Invalid incremental update for ${storeName}`, { data: update as unknown as Record<string, unknown> });
        return;
      }

      const items = getItems();
      const itemIndex = items.findIndex(item => item.id === update.id);
      
      if (itemIndex === -1 && update.operation !== 'create') {
        logger.warn('', `Item not found for incremental update: ${update.id}`, { data: { storeName } });
        return;
      }

      let newItems: T[];

      if (update.operation === 'delete') {
        // 删除操作
        newItems = items.filter(item => item.id !== update.id);
        onDelete?.(update.id);
      } else if (update.operation === 'create') {
        // 创建操作
        newItems = [...items, { ...update.changes as unknown as T, id: update.id }];
      } else {
        // 更新操作：合并变更到指定项
        newItems = items.map((item, index) => 
          index === itemIndex ? { ...item, ...update.changes as unknown as Partial<T> } : item
        );
      }

      setItems(newItems);
      logger.debug('', `Incremental update applied for ${storeName}`, {
        data: { id: update.id, operation: update.operation }
      });
    } catch (error) {
      logger.error('', `Error handling incremental update for ${storeName}`, { error: error as Error });
    }
  };

  // 构建事件名称
  const eventName = `${storeName}:incremental`;

  // 使用自定义事件机制（客户端）
  window.addEventListener(eventName, handleIncrementalUpdate as EventListener);

  logger.info('', `Incremental handler registered for ${storeName}`);

  // 返回清理函数
  return () => {
    window.removeEventListener(eventName, handleIncrementalUpdate as EventListener);
    logger.info('', `Incremental handler unregistered for ${storeName}`);
  };
}

/**
 * 检测是否需要全量刷新
 *
 * 当增量更新过于复杂或数据不一致时，触发全量刷新
 *
 * @param update 增量更新
 * @returns 是否需要全量刷新
 */
export function shouldFullRefresh<T>(update: IncrementalUpdate<T>): boolean {
  // 变更字段过多（超过 5 个）
  const changeCount = Object.keys(update.changes).length;
  if (changeCount > 5) {
    logger.debug('', `Full refresh triggered: too many changes (${changeCount})`);
    return true;
  }
  
  // 包含嵌套对象变更（可能是复杂更新）
  for (const value of Object.values(update.changes)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      logger.debug('', 'Full refresh triggered: nested object change');
      return true;
    }
  }
  
  return false;
}

/**
 * 批量广播增量更新
 *
 * @param updates 增量更新数组
 */
export function broadcastBatchUpdates<T>(
  updates: IncrementalUpdate<T>[]
): void {
  if (updates.length === 0) return;

  logger.info('', `Broadcasting batch updates: ${updates.length} items`);

  // 暂时只单独广播，batch 功能等待 eventBus 支持
  for (const update of updates) {
    broadcastIncrementalUpdate(update);
  }
}
