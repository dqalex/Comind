/**
 * TaskLog Store - 任务日志状态管理
 */

import { create } from 'zustand';
import type { TaskLog, NewTaskLog } from '@/db/schema';
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
  addLog: (log: TaskLog) => void;
  
  // 查询方法
  getByTaskId: (taskId: string) => TaskLog[];
  
  // 异步操作
  fetchLogsByTask: (taskId: string) => Promise<void>;
  createLog: (data: { taskId: string; action: string; message: string }) => Promise<TaskLog | null>;
}

// ============================================================
// 创建 TaskLog Store
// ============================================================
export const useTaskLogStore = create<TaskLogState>()((set, get) => ({
  // ==================== 初始状态 ====================
  logs: [],
  loading: false,
  error: null,
  initialized: false,

  // ==================== 本地操作 ====================
  setLogs: (logs) => set({ logs, initialized: true }),
  
  addLog: (log) => set((state) => ({ 
    logs: [...state.logs, log] 
  })),

  // ==================== 查询方法 ====================
  getByTaskId: (taskId) => 
    get().logs.filter((log) => log.taskId === taskId),

  // ==================== 异步操作 ====================
  fetchLogsByTask: async (taskId) => {
    set({ loading: true, error: null });
    const { data, error } = await taskLogsApi.getByTask(taskId);
    if (error) {
      set({ loading: false, error });
    } else {
      const logs = data || [];
      set({ logs, loading: false, error: null, initialized: true });
    }
  },

  createLog: async (data) => {
    set({ loading: true, error: null });
    const { data: log, error } = await taskLogsApi.create(data);
    if (error) {
      set({ loading: false, error });
      return null;
    }
    if (log) {
      set((state) => ({
        logs: [...state.logs, log],
        loading: false,
        error: null,
      }));
      return log;
    }
    return null;
  },
}));

// ============================================================
// 兼容层
// ============================================================

export const taskLogStoreApi = {
  // 状态访问
  get items() { return useTaskLogStore.getState().logs; },
  get loading() { return useTaskLogStore.getState().loading; },
  get error() { return useTaskLogStore.getState().error; },
  get initialized() { return useTaskLogStore.getState().initialized; },
  
  // 本地操作
  setItems: (items: TaskLog[]) => useTaskLogStore.getState().setLogs(items),
  addItem: (item: TaskLog) => useTaskLogStore.getState().addLog(item),
  
  // 异步操作
  fetchByTask: (taskId: string) => useTaskLogStore.getState().fetchLogsByTask(taskId),
  createItem: (data: { taskId: string; action: string; message: string }) => 
    useTaskLogStore.getState().createLog(data),
  
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
  
  // 查询
  getByTaskId: (taskId: string) => useTaskLogStore.getState().getByTaskId(taskId),
};
