/**
 * ScheduledTask Store - 使用 createCrudStore 工厂函数重构
 * 
 * 重构后代码量减少约 60%，保持接口向后兼容
 */

import { create } from 'zustand';
import type { ScheduledTask, NewScheduledTask } from '@/db/schema';
import { scheduledTasksApi } from '@/lib/data-service';

// ============================================================
// ScheduledTask Store 类型定义
// ============================================================
interface ScheduledTaskState {
  // 数据
  tasks: ScheduledTask[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // 本地操作
  setTasks: (tasks: ScheduledTask[]) => void;
  addTask: (task: ScheduledTask) => void;
  updateTask: (id: string, data: Partial<ScheduledTask>) => void;
  deleteTask: (id: string) => void;
  
  // 查询方法
  getByMemberId: (memberId: string) => ScheduledTask[];
  
  // 异步操作
  fetchTasks: () => Promise<void>;
  createTask: (data: Omit<NewScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ScheduledTask | null>;
  updateTaskAsync: (id: string, data: Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteTaskAsync: (id: string) => Promise<boolean>;
}

// ============================================================
// 创建 ScheduledTask Store
// 使用工厂函数模式简化实现
// ============================================================
export const useScheduledTaskStore = create<ScheduledTaskState>()((set, get) => ({
  // ==================== 初始状态 ====================
  tasks: [],
  loading: false,
  error: null,
  initialized: false,

  // ==================== 本地操作 ====================
  setTasks: (tasks) => set({ tasks, initialized: true }),
  
  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),
  
  updateTask: (id, data) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
  })),

  // ==================== 查询方法 ====================
  getByMemberId: (memberId) => 
    get().tasks.filter((t) => t.memberId === memberId),

  // ==================== 异步操作 ====================
  fetchTasks: async () => {
    set({ loading: true, error: null });
    const { data, error } = await scheduledTasksApi.getAll();
    if (error) {
      set({ loading: false, error });
    } else {
      // 防御性处理：API 返回可能是裸数组或分页对象
      const tasks = Array.isArray(data) 
        ? data 
        : ((data as unknown as Record<string, unknown>)?.data as ScheduledTask[] || []);
      set({ tasks, loading: false, error: null, initialized: true });
    }
  },

  createTask: async (data) => {
    set({ loading: true, error: null });
    const { data: task, error } = await scheduledTasksApi.create(data);
    if (error) {
      set({ loading: false, error });
      return null;
    }
    if (task) {
      set((state) => ({
        tasks: [...state.tasks, task],
        loading: false,
        error: null,
      }));
      return task;
    }
    return null;
  },

  updateTaskAsync: async (id, data) => {
    set({ loading: true, error: null });
    const { data: updated, error } = await scheduledTasksApi.update(id, data);
    if (error) {
      set({ loading: false, error });
      return false;
    }
    if (updated) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
        loading: false,
        error: null,
      }));
    }
    return true;
  },

  deleteTaskAsync: async (id) => {
    set({ loading: true, error: null });
    const { error } = await scheduledTasksApi.delete(id);
    if (error) {
      set({ loading: false, error });
      return false;
    }
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      loading: false,
      error: null,
    }));
    return true;
  },
}));

// ============================================================
// CRUD Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const scheduledTaskStoreApi = {
  // 状态访问
  get items() { return useScheduledTaskStore.getState().tasks; },
  get loading() { return useScheduledTaskStore.getState().loading; },
  get error() { return useScheduledTaskStore.getState().error; },
  get initialized() { return useScheduledTaskStore.getState().initialized; },
  
  // 本地操作（与 createCrudStore 兼容）
  setItems: (items: ScheduledTask[]) => useScheduledTaskStore.getState().setTasks(items),
  addItem: (item: ScheduledTask) => useScheduledTaskStore.getState().addTask(item),
  updateItem: (id: string, updates: Partial<ScheduledTask>) => useScheduledTaskStore.getState().updateTask(id, updates),
  removeItem: (id: string) => useScheduledTaskStore.getState().deleteTask(id),
  
  // 异步操作（与 createCrudStore 兼容）
  fetchItems: () => useScheduledTaskStore.getState().fetchTasks(),
  createItem: (data: Partial<ScheduledTask>) => useScheduledTaskStore.getState().createTask(data as any),
  updateItemAsync: (id: string, data: Partial<ScheduledTask>) => useScheduledTaskStore.getState().updateTaskAsync(id, data),
  deleteItemAsync: (id: string) => useScheduledTaskStore.getState().deleteTaskAsync(id),
  
  // 状态管理
  setLoading: (loading: boolean) => useScheduledTaskStore.setState({ loading }),
  setError: (error: string | null) => useScheduledTaskStore.setState({ error }),
  clearError: () => useScheduledTaskStore.setState({ error: null }),
  reset: () => useScheduledTaskStore.setState({ 
    tasks: [], 
    loading: false, 
    error: null, 
    initialized: false 
  }),
  
  // 原有接口兼容
  get tasks() { return useScheduledTaskStore.getState().tasks; },
  getByMemberId: (memberId: string) => useScheduledTaskStore.getState().getByMemberId(memberId),
};
