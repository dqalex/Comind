/**
 * 确认操作 Hook
 * 统一管理删除/危险操作的确认弹窗状态
 * 搭配 ConfirmDialog 组件使用
 */
'use client';

import { useState, useCallback } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

interface UseConfirmActionReturn<T> {
  /** 当前待确认目标（null 表示弹窗关闭） */
  target: T | null;
  /** 弹窗是否打开 */
  isOpen: boolean;
  /** 打开确认弹窗 */
  requestConfirm: (target: T) => void;
  /** 关闭确认弹窗 */
  cancel: () => void;
  /** 执行确认操作 + 自动关闭弹窗 */
  confirm: (action: (target: T) => Promise<void>) => Promise<void>;
  /** 是否正在执行 */
  isLoading: boolean;
}

/**
 * 通用确认操作 Hook
 * 
 * @example
 * ```tsx
 * const deleteConfirm = useConfirmAction<string>();
 * 
 * // 触发确认
 * <button onClick={() => deleteConfirm.requestConfirm(item.id)}>删除</button>
 * 
 * // 渲染弹窗
 * <ConfirmDialog
 *   isOpen={deleteConfirm.isOpen}
 *   onClose={deleteConfirm.cancel}
 *   onConfirm={() => deleteConfirm.confirm(async (id) => { await deleteItem(id); })}
 *   title={t('common.delete')}
 *   message={t('common.deleteConfirm')}
 *   isLoading={deleteConfirm.isLoading}
 * />
 * ```
 */
export function useConfirmAction<T = string>(): UseConfirmActionReturn<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = target !== null;

  const cancel = useCallback(() => {
    if (!isLoading) {
      setTarget(null);
    }
  }, [isLoading]);

  // ESC 键关闭
  useEscapeKey(isOpen, cancel);

  const requestConfirm = useCallback((t: T) => {
    setTarget(t);
  }, []);

  const confirm = useCallback(async (action: (t: T) => Promise<void>) => {
    if (target === null) return;
    setIsLoading(true);
    try {
      await action(target);
      setTarget(null);
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  return {
    target,
    isOpen,
    requestConfirm,
    cancel,
    confirm,
    isLoading,
  };
}
