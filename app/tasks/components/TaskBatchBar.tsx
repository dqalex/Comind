'use client';

import clsx from 'clsx';
import {
  CheckSquare,
  Trash2,
  Send,
  X,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/shared/ui';
import type { StatusColumn } from '../hooks/useTasksPage';

interface StatusColumnConfig {
  key: StatusColumn;
  label: string;
  color: string;
}

interface TaskBatchBarProps {
  selectedCount: number;
  pushing: boolean;
  pushError: string | null;
  gwConnected: boolean;
  STATUS_COLUMNS: StatusColumnConfig[];
  showBatchStatusMenu: boolean;
  setShowBatchStatusMenu: (v: boolean) => void;
  onBatchStatusChange: (status: StatusColumn) => void;
  onBatchDelete: () => void;
  onBatchPush: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onClearPushError: () => void;
}

export default function TaskBatchBar({
  selectedCount, pushing, pushError, gwConnected,
  STATUS_COLUMNS, showBatchStatusMenu, setShowBatchStatusMenu,
  onBatchStatusChange, onBatchDelete, onBatchPush,
  onSelectAll, onClearSelection, onClearPushError,
}: TaskBatchBarProps) {
  return (
    <>
      {/* 批量操作栏 */}
      <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800">
        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
          已选择 {selectedCount} 个任务
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {/* 批量状态变更 */}
          <div className="relative">
            <Button size="sm" variant="secondary" onClick={() => setShowBatchStatusMenu(!showBatchStatusMenu)}>
              <CheckSquare className="w-3.5 h-3.5" />
              批量改状态
              <ChevronDown className="w-3 h-3" />
            </Button>
            {showBatchStatusMenu && (
              <div className="absolute top-full left-0 mt-1 w-32 rounded-lg shadow-float border z-30 py-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                {STATUS_COLUMNS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { onBatchStatusChange(s.key); setShowBatchStatusMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', s.color)} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* 批量删除 */}
          <Button size="sm" variant="danger" onClick={onBatchDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            批量删除
          </Button>
          {gwConnected && (
            <Button size="sm" onClick={onBatchPush} disabled={pushing}>
              <Send className="w-3.5 h-3.5" />
              {pushing ? '推送中...' : '批量推送'}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onSelectAll}>
            全选
          </Button>
          <Button size="sm" variant="secondary" onClick={onClearSelection}>
            <X className="w-3.5 h-3.5" />
            取消
          </Button>
        </div>
      </div>

      {/* 推送错误提示 */}
      {pushError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{pushError}</span>
          <button onClick={onClearPushError} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
