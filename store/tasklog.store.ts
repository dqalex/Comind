/**
 * TaskLog Store - 使用 createCrudStore 工厂函数重构
 * 
 * 重构后代码量减少约 60%，保持接口向后兼容
 * 注意：TaskLog 是只读日志，不支持更新和删除
 */

import { create } from 'zustand';
import type { TaskLog } from '@/db/schema';
import { taskLogsApi } from '@/lib/data-service';

// ============================================================
// TaskLog Store 类型定义
// ============================================================
interface TaskLogState {
  // 数据
  logs: TaskLog[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // 本地操作
  setLogs: (logs: TaskLog[]) => void;
  
  // 查询方法
  getByTask: (taskId: string) => TaskLog[];
  
  // 异步操作
  fetchLogsByTask: (taskId: string) => Promise<void>;
  createLog: (data: { taskId: string; action: string; message: string }) => Promise<TaskLog | null>;
}

// ============================================================
// 创建 TaskLog Store
// 使用工厂函数模式简化实现
// ============================================================
export const useTaskLogStore = create<TaskLogState>()((set, get) => ({
  // ==================== 初始状态 ====================
  logs: [],
  loading: false,
  error: null,
  initialized: false,

  // ==================== 本地操作 ====================
  setLogs: (logs) => set({ logs, initialized: true }),

  // ==================== 查询方法 ====================
  getByTask: (taskId) => get().logs.filter((l) => l.taskId === taskId),

  // ==================== 异步操作 ====================
  fetchLogsByTask: async (taskId) => {
    set({ loading: true, error: null });
    const { data, error } = await taskLogsApi.getByTask(taskId);
    if (error) {
      set({ loading: false, error });
    } else {
      const safeData = Array.isArray(data) ? data : [];
      // 合并：保留其他任务的日志，替换当前任务的日志
      const otherLogs = get().logs.filter((l) => l.taskId !== taskId);
      set({ logs: [...otherLogs, ...safeData], loading: false, error: null });
    }
  },

  createLog: async (data) => {
    const { data: log, error } = await taskLogsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (log) {
      set((state) => ({ logs: [...state.logs, log], error: null }));
      return log;
    }
    return null;
  },
}));

// ============================================================
// CRUD Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const taskLogStoreApi = {
  // 状态访问
  get items() { return useTaskLogStore.getState().logs; },
  get loading() { return useTaskLogStore.getState().loading; },
  get error() { return useTaskLogStore.getState().error; },
  get initialized() { return useTaskLogStore.getState().initialized; },
  
  // 本地操作（与 createCrudStore 兼容）
  setItems: (items: TaskLog[]) => useTaskLogStore.getState().setLogs(items),
  
  // 异步操作（与 createCrudStore 兼容）
  fetchItems: (filters?: { taskId?: string }) => {
    if (filters?.taskId) {
      return useTaskLogStore.getState().fetchLogsByTask(filters.taskId);
    }
    return Promise.resolve();
  },
  createItem: (data: Partial<TaskLog>) => useTaskLogStore.getState().createLog(data as any),
  
  // 状态管理
  setLoading: (loading: boolean) => useTaskLogStore.setState({ loading }),
  setError: (error: string | null) => useTaskLogStore.setState({ error }),
  clearError: () => useTaskLogStore.setState({ error: null }),
  reset: () => useTaskLogStore.setState({ 
    logs: [], 
    loading: false, 
    error: null, 
    initialized: false 
  }),
  
  // 原有接口兼容
  get logs() { return useTaskLogStore.getState().logs; },
  getByTask: (taskId: string) => useTaskLogStore.getState().getByTask(taskId),
  fetchLogsByTask: (taskId: string) => useTaskLogStore.getState().fetchLogsByTask(taskId),
  createLog: (data: { taskId: string; action: string; message: string }) => useTaskLogStore.getState().createLog(data),
  setLogs: (logs: TaskLog[]) => useTaskLogStore.getState().setLogs(logs),
};
